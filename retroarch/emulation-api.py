#!/usr/bin/env python3
"""
CyanGame Emulation API
Runs inside the emulation container.
Starts/stops emulators + FFmpeg on Xvfb virtual displays.
"""

import os, signal, subprocess, time, logging
from flask import Flask, jsonify, request

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
log = logging.getLogger('emu-api')

app = Flask(__name__)
app.logger.disabled = True
logging.getLogger('werkzeug').setLevel(logging.ERROR)

# Active sessions: stream_path → {xvfb, emu, ffmpeg, display}
sessions = {}
display_n = [200]

MEDIAMTX_HOST = os.environ.get('MEDIAMTX_HOST', 'cyangame-mediamtx')
SRT_PORT      = os.environ.get('SRT_PORT', '8890')

# Map system → RetroArch core path
CORES = {
    'nes':      '/cores/nestopia_libretro.so',
    'snes':     '/cores/snes9x_libretro.so',
    'gb':       '/cores/gambatte_libretro.so',
    'gbc':      '/cores/gambatte_libretro.so',
    'gba':      '/cores/mgba_libretro.so',
    'genesis':  '/cores/genesis_plus_gx_libretro.so',
    'n64':      '/cores/mupen64plus_next_libretro.so',
    'ps1':      '/cores/pcsx_rearmed_libretro.so',
    'nds':      '/cores/melonds_libretro.so',
}

# Systems with standalone emulators (better compatibility)
STANDALONE = {
    'ps2': ['pcsx2', '--fullscreen', '--nogui'],
}


def next_display():
    d = f':{display_n[0]}'
    display_n[0] += 1
    return d


def kill_proc(proc):
    if proc and proc.poll() is None:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            proc.wait(timeout=3)
        except Exception:
            try: proc.kill()
            except: pass


def build_emu_cmd(system, rom_path):
    """Return (emulator_cmd_list, needs_display)"""
    if system in STANDALONE:
        return STANDALONE[system] + [rom_path], True

    core = CORES.get(system)
    if not core:
        raise ValueError(f'No emulator configured for system: {system}')

    if not os.path.exists(core):
        # Try alternate core name patterns
        core_dir = '/cores'
        system_lower = system.lower()
        found = None
        for f in os.listdir(core_dir):
            if system_lower in f.lower() and f.endswith('.so'):
                found = os.path.join(core_dir, f)
                break
        if not found:
            raise ValueError(f'Core not found for {system}: {core}')
        core = found

    return ['retroarch', '--libretro', core, '--fullscreen', '--verbose', rom_path], True


@app.route('/health')
def health():
    return jsonify({'ok': True, 'sessions': len(sessions)})


@app.route('/emulate/start', methods=['POST'])
def emulate_start():
    data        = request.json or {}
    rom_path    = data.get('romPath')
    system      = data.get('system', '').lower()
    stream_path = data.get('streamPath')

    if not rom_path or not system or not stream_path:
        return jsonify({'error': 'romPath, system, streamPath required'}), 400

    if stream_path in sessions:
        return jsonify({'ok': True, 'status': 'already_running'})

    if not os.path.exists(rom_path):
        return jsonify({'error': f'ROM not found: {rom_path}'}), 400

    display = next_display()
    srt_url = f'srt://{MEDIAMTX_HOST}:{SRT_PORT}?streamid={stream_path}&latency=200000'

    try:
        # 1. Start Xvfb virtual display
        log.info(f'Starting Xvfb {display}')
        xvfb = subprocess.Popen(
            ['Xvfb', display, '-screen', '0', '1920x1080x24', '-ac'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid
        )
        time.sleep(0.8)

        if xvfb.poll() is not None:
            return jsonify({'error': 'Xvfb failed to start'}), 500

        # 2. Start emulator
        emu_cmd, _ = build_emu_cmd(system, rom_path)
        log.info(f'Starting emulator: {emu_cmd[0]} for {system} | {os.path.basename(rom_path)}')
        emu_env = {**os.environ, 'DISPLAY': display}
        emu = subprocess.Popen(
            emu_cmd, env=emu_env,
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            preexec_fn=os.setsid
        )
        time.sleep(2.5)  # wait for emulator to init

        if emu.poll() is not None:
            err = emu.stderr.read(500).decode('utf-8', errors='replace')
            kill_proc(xvfb)
            return jsonify({'error': f'Emulator exited early: {err}'}), 500

        # 3. Start FFmpeg: capture Xvfb → encode → SRT
        log.info(f'Starting FFmpeg → {srt_url}')
        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-f', 'x11grab',
            '-video_size', '1920x1080',
            '-framerate', '60',
            '-i', display,
            '-vcodec', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-crf', '26',
            '-maxrate', '15M', '-bufsize', '30M',
            '-g', '120',
            '-f', 'mpegts',
            srt_url
        ]
        ffmpeg = subprocess.Popen(
            ffmpeg_cmd,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid
        )
        time.sleep(1)

        if ffmpeg.poll() is not None:
            kill_proc(emu)
            kill_proc(xvfb)
            return jsonify({'error': 'FFmpeg failed to start'}), 500

        sessions[stream_path] = {
            'xvfb': xvfb, 'emu': emu, 'ffmpeg': ffmpeg,
            'display': display, 'system': system,
            'rom': os.path.basename(rom_path)
        }

        log.info(f'Session started: {stream_path} | display={display}')
        return jsonify({'ok': True, 'streamPath': stream_path, 'display': display})

    except Exception as e:
        log.error(f'Start failed: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/emulate/stop', methods=['POST'])
def emulate_stop():
    data        = request.json or {}
    stream_path = data.get('streamPath')

    sess = sessions.pop(stream_path, None)
    if sess:
        kill_proc(sess['ffmpeg'])
        kill_proc(sess['emu'])
        kill_proc(sess['xvfb'])
        log.info(f'Session stopped: {stream_path}')

    return jsonify({'ok': True})


@app.route('/emulate/status')
def emulate_status():
    status = {}
    for path, sess in list(sessions.items()):
        alive = sess['emu'].poll() is None and sess['ffmpeg'].poll() is None
        status[path] = {
            'alive': alive,
            'system': sess['system'],
            'rom': sess['rom'],
            'display': sess['display'],
        }
        if not alive:
            # Clean up dead sessions
            kill_proc(sess.get('ffmpeg'))
            kill_proc(sess.get('xvfb'))
            sessions.pop(path, None)
    return jsonify(status)


@app.route('/emulate/available')
def emulate_available():
    available = {}
    for system, core in CORES.items():
        available[system] = os.path.exists(core)
    for system in STANDALONE:
        import shutil
        available[system] = shutil.which(STANDALONE[system][0]) is not None
    return jsonify(available)


if __name__ == '__main__':
    log.info('CyanGame Emulation API starting on :7002')
    app.run(host='0.0.0.0', port=7002, threaded=True)
