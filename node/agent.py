#!/usr/bin/env python3
"""
ConsoleHub Node Agent v0.2
Added: emulation support (RetroArch headless on node)
"""

import argparse, logging, os, signal, socket, subprocess, sys
import threading, time, yaml
from flask import Flask, jsonify, request

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s', datefmt='%H:%M:%S')
log = logging.getLogger('consolehub-node')

import logging as _l
_l.getLogger('werkzeug').setLevel(_l.ERROR)

app = Flask(__name__)
app.logger.disabled = True

config = {}
active_streams    = {}   # stream_path → ffmpeg subprocess
active_emulations = {}   # stream_path → {xvfb, emu, ffmpeg}


# ══════════════════════════════════════════════════════════
#  Physical capture (unchanged from v0.1)
# ══════════════════════════════════════════════════════════

def build_ffmpeg_capture(capture_device, stream_path, server_ip, srt_port, resolution):
    vaapi = config.get('capture', {}).get('vaapi_device', '/dev/dri/renderD128')
    w, h  = (1920, 1080) if resolution != '4k' else (3840, 2160)
    srt_url = f"srt://{server_ip}:{srt_port}?streamid={stream_path}&latency=200000"

    if os.path.exists(vaapi):
        return ['ffmpeg', '-y', '-f', 'v4l2', '-input_format', 'yuyv422',
                '-video_size', f'{w}x{h}', '-framerate', '60', '-i', f'/dev/{capture_device}',
                '-vf', f'scale={w}:{h},format=nv12,hwupload', '-vcodec', 'h264_vaapi',
                '-vaapi_device', vaapi, '-qp', '26', '-maxrate', '15M', '-bufsize', '30M',
                '-g', '120', '-f', 'mpegts', srt_url]
    else:
        return ['ffmpeg', '-y', '-f', 'v4l2', '-input_format', 'yuyv422',
                '-video_size', f'{w}x{h}', '-framerate', '60', '-i', f'/dev/{capture_device}',
                '-vcodec', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
                '-crf', '28', '-maxrate', '12M', '-bufsize', '24M', '-f', 'mpegts', srt_url]


@app.route('/stream/start', methods=['POST'])
def stream_start():
    data           = request.json
    stream_path    = data['streamPath']
    capture_device = data.get('captureDevice', 'video0')
    server_ip      = data.get('nasIp', config['node']['server_ip'])
    srt_port       = data.get('srtPort', config['node']['srt_port'])
    resolution     = data.get('resolution', '1080p')

    if stream_path in active_streams:
        return jsonify({'ok': True, 'status': 'already_running'})

    cmd = build_ffmpeg_capture(capture_device, stream_path, server_ip, srt_port, resolution)
    log.info(f"Stream start: {stream_path}")

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, preexec_fn=os.setsid)
        active_streams[stream_path] = proc
        time.sleep(1)
        if proc.poll() is not None:
            err = proc.stderr.read(500).decode('utf-8', errors='replace')
            del active_streams[stream_path]
            return jsonify({'error': f'FFmpeg exited: {err}'}), 500
        return jsonify({'ok': True, 'pid': proc.pid})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/stream/stop', methods=['POST'])
def stream_stop():
    stream_path = request.json['streamPath']
    proc = active_streams.pop(stream_path, None)
    if proc:
        try: os.killpg(os.getpgid(proc.pid), signal.SIGTERM); proc.wait(timeout=5)
        except: pass
    return jsonify({'ok': True})


# ══════════════════════════════════════════════════════════
#  Emulation (new in v0.2)
# ══════════════════════════════════════════════════════════

display_counter = [200]  # use list so we can mutate in closure

def next_display():
    d = f":{display_counter[0]}"
    display_counter[0] += 1
    return d


def build_emulator_cmd(emu_binary, emu_core, extra_args, rom_path, display):
    """Build the emulator command for this node."""
    extra = extra_args.split() if extra_args else []

    if emu_binary == 'retroarch':
        return ['retroarch', '--libretro', emu_core, '--fullscreen', *extra, rom_path]
    elif emu_binary == 'duckstation-nogui':
        return ['duckstation-nogui', '--fullscreen', *extra, rom_path]
    elif emu_binary == 'pcsx2':
        return ['pcsx2', '--fullscreen', '--nogui', *extra, rom_path]
    elif emu_binary == 'dolphin-emu-nogui':
        return ['dolphin-emu-nogui', '--exec', rom_path, *extra]
    else:
        return [emu_binary, *extra, rom_path]


@app.route('/emulate/start', methods=['POST'])
def emulate_start():
    data        = request.json
    rom_path    = data['romPath']
    emu_binary  = data['emulatorBin']
    emu_core    = data.get('emulatorCore', '')
    extra_args  = data.get('extraArgs', '')
    stream_path = data['streamPath']
    server_ip   = data.get('nasIp', config['node']['server_ip'])
    srt_port    = data.get('srtPort', config['node']['srt_port'])

    if stream_path in active_emulations:
        return jsonify({'ok': True, 'status': 'already_running'})

    # Check ROM is accessible (NAS share must be mounted)
    if not os.path.exists(rom_path):
        return jsonify({'error': f'ROM not found on node: {rom_path}. Is the NAS share mounted?'}), 400

    display = next_display()
    srt_url = f"srt://{server_ip}:{srt_port}?streamid={stream_path}&latency=200000"

    try:
        # 1. Start virtual framebuffer
        xvfb = subprocess.Popen(
            ['Xvfb', display, '-screen', '0', '1920x1080x24', '-ac'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, preexec_fn=os.setsid
        )
        time.sleep(0.5)

        # 2. Start emulator
        emu_cmd = build_emulator_cmd(emu_binary, emu_core, extra_args, rom_path, display)
        emu_env = {**os.environ, 'DISPLAY': display}
        emu = subprocess.Popen(emu_cmd, env=emu_env, stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL, preexec_fn=os.setsid)
        time.sleep(2)  # let emulator boot

        # 3. FFmpeg: capture virtual display → SRT
        # Use VAAPI if available for encode, x11grab for capture
        vaapi = config.get('capture', {}).get('vaapi_device', '/dev/dri/renderD128')
        if os.path.exists(vaapi):
            ffmpeg_cmd = [
                'ffmpeg', '-y',
                '-f', 'x11grab', '-display', display,
                '-video_size', '1920x1080', '-framerate', '60', '-i', display,
                '-vf', 'format=nv12,hwupload', '-vcodec', 'h264_vaapi',
                '-vaapi_device', vaapi, '-qp', '26',
                '-maxrate', '15M', '-bufsize', '30M', '-g', '120',
                '-f', 'mpegts', srt_url
            ]
        else:
            ffmpeg_cmd = [
                'ffmpeg', '-y',
                '-f', 'x11grab', '-display', display,
                '-video_size', '1920x1080', '-framerate', '60', '-i', display,
                '-vcodec', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
                '-crf', '28', '-maxrate', '12M', '-bufsize', '24M',
                '-f', 'mpegts', srt_url
            ]

        ffmpeg = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.DEVNULL,
                                  stderr=subprocess.DEVNULL, preexec_fn=os.setsid)

        active_emulations[stream_path] = {
            'xvfb': xvfb, 'emu': emu, 'ffmpeg': ffmpeg, 'display': display
        }

        log.info(f"Emulation started: {emu_binary} | {rom_path} | {display} → {srt_url}")
        return jsonify({'ok': True, 'pid': emu.pid, 'display': display})

    except Exception as e:
        log.error(f"Emulation start failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/emulate/stop', methods=['POST'])
def emulate_stop():
    stream_path = request.json['streamPath']
    procs = active_emulations.pop(stream_path, None)
    if procs:
        for key in ('ffmpeg', 'emu', 'xvfb'):
            p = procs.get(key)
            if p:
                try: os.killpg(os.getpgid(p.pid), signal.SIGTERM); p.wait(timeout=3)
                except: pass
        log.info(f"Emulation stopped: {stream_path}")
    return jsonify({'ok': True})


@app.route('/emulate/status', methods=['GET'])
def emulate_status():
    status = {}
    for path, procs in list(active_emulations.items()):
        emu_alive = procs['emu'].poll() is None
        ffmpeg_alive = procs['ffmpeg'].poll() is None
        if not emu_alive or not ffmpeg_alive:
            status[path] = 'died'
        else:
            status[path] = 'running'
    return jsonify(status)


@app.route('/emulate/available', methods=['GET'])
def emulate_available():
    """Report which emulators are installed on this node."""
    emulators = {}
    for binary in ['retroarch', 'duckstation-nogui', 'pcsx2', 'dolphin-emu-nogui', 'Ryujinx', 'rpcs3']:
        result = subprocess.run(['which', binary], capture_output=True)
        emulators[binary] = result.returncode == 0
    return jsonify(emulators)


# ══════════════════════════════════════════════════════════
#  Launch commands (physical consoles)
# ══════════════════════════════════════════════════════════

@app.route('/launch/smartglass', methods=['POST'])
def launch_smartglass():
    data = request.json
    try:
        result = subprocess.run(
            ['xbox-smartglass-rest', 'launch', '--ip', data['consoleIp'], '--title-id', data['titleId']],
            capture_output=True, text=True, timeout=10
        )
        return jsonify({'ok': result.returncode == 0, 'method': 'smartglass'})
    except FileNotFoundError:
        return jsonify({'error': 'xbox-smartglass-core not installed. Run: pip3 install xbox-smartglass-core'}), 501
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════════════════
#  Health + Registration
# ══════════════════════════════════════════════════════════

@app.route('/health', methods=['GET'])
def health():
    import shutil
    total, used, free = shutil.disk_usage('/')
    return jsonify({
        'ok': True,
        'node_id': config['node']['id'],
        'streams': list(active_streams.keys()),
        'emulations': list(active_emulations.keys()),
        'disk_free_gb': round(free / 1e9, 1),
        'capture_devices': [f'/dev/video{i}' for i in range(8) if os.path.exists(f'/dev/video{i}')],
    })


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except: return '127.0.0.1'
    finally: s.close()


def register_and_heartbeat():
    import urllib.request, json as _json
    node   = config['node']
    server = f"http://{node['server_ip']}:{node['server_port']}"

    # Register
    for attempt in range(30):
        try:
            payload = _json.dumps({'id': node['id'], 'name': node['name'], 'ip': get_local_ip(), 'os': 'dietpi'}).encode()
            req = urllib.request.Request(f"{server}/nodes", data=payload, headers={'Content-Type': 'application/json'}, method='POST')
            urllib.request.urlopen(req, timeout=5)
            log.info(f"Registered with server at {server}")
            break
        except Exception as e:
            if attempt == 0: log.warning(f"Server not reachable ({e}) — retrying…")
            time.sleep(10)

    # Heartbeat
    while True:
        time.sleep(10)
        try:
            payload = _json.dumps({'ip': get_local_ip(), 'streams': list(active_streams.keys()), 'emulations': list(active_emulations.keys())}).encode()
            req = urllib.request.Request(f"{server}/nodes/{node['id']}/ping", data=payload, headers={'Content-Type': 'application/json'}, method='POST')
            urllib.request.urlopen(req, timeout=3)
        except: pass


def main():
    parser = argparse.ArgumentParser(description='ConsoleHub Node Agent')
    parser.add_argument('--config', default='/opt/consolehub-node/config.yml')
    args = parser.parse_args()

    global config
    config = load_config(args.config)

    node = config['node']
    log.info(f"Node Agent v0.2 | {node['id']} | {node['name']}")

    threading.Thread(target=register_and_heartbeat, daemon=True).start()

    port = node.get('agent_port', 7001)
    log.info(f"Listening on :{port}")
    app.run(host='0.0.0.0', port=port, threaded=True)


def load_config(path):
    with open(path) as f:
        return yaml.safe_load(f)


if __name__ == '__main__':
    main()
