#!/usr/bin/env python3
"""CyanGame Node Agent v0.2 — runs on Wyse 3040 / N100"""
import argparse, logging, os, signal, socket, subprocess, threading, time, yaml
from flask import Flask, jsonify, request

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s', datefmt='%H:%M:%S')
log = logging.getLogger('node')
logging.getLogger('werkzeug').setLevel(logging.ERROR)

app = Flask(__name__)
app.logger.disabled = True
config = {}
active_streams = {}

def build_cmd(capture_device, stream_path, server_ip, srt_port, resolution):
    vaapi = config.get('capture', {}).get('vaapi_device', '/dev/dri/renderD128')
    w, h  = (1920, 1080) if resolution != '4k' else (3840, 2160)
    srt   = f'srt://{server_ip}:{srt_port}?streamid={stream_path}&latency=200000'
    if os.path.exists(vaapi):
        return ['ffmpeg','-y','-f','v4l2','-input_format','yuyv422','-video_size',f'{w}x{h}',
                '-framerate','60','-i',f'/dev/{capture_device}',
                '-vf',f'scale={w}:{h},format=nv12,hwupload','-vcodec','h264_vaapi',
                '-vaapi_device',vaapi,'-qp','26','-maxrate','15M','-bufsize','30M','-g','120','-f','mpegts',srt]
    return ['ffmpeg','-y','-f','v4l2','-input_format','yuyv422','-video_size',f'{w}x{h}',
            '-framerate','60','-i',f'/dev/{capture_device}',
            '-vcodec','libx264','-preset','ultrafast','-tune','zerolatency',
            '-crf','28','-maxrate','12M','-bufsize','24M','-f','mpegts',srt]

@app.route('/stream/start', methods=['POST'])
def stream_start():
    d = request.json or {}
    sp = d.get('streamPath')
    if sp in active_streams: return jsonify({'ok':True,'status':'running'})
    cmd = build_cmd(d.get('captureDevice','video0'), sp, d.get('nasIp', config['node']['server_ip']),
                    d.get('srtPort', config['node']['srt_port']), d.get('resolution','1080p'))
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, preexec_fn=os.setsid)
    active_streams[sp] = proc
    time.sleep(1)
    if proc.poll() is not None:
        err = proc.stderr.read(300).decode(errors='replace')
        del active_streams[sp]
        return jsonify({'error': f'FFmpeg failed: {err}'}), 500
    return jsonify({'ok':True,'pid':proc.pid})

@app.route('/stream/stop', methods=['POST'])
def stream_stop():
    sp = (request.json or {}).get('streamPath')
    proc = active_streams.pop(sp, None)
    if proc:
        try: os.killpg(os.getpgid(proc.pid), signal.SIGTERM); proc.wait(timeout=5)
        except: pass
    return jsonify({'ok':True})

@app.route('/health')
def health():
    return jsonify({'ok':True,'node_id':config['node']['id'],'streams':list(active_streams.keys()),
      'devices':[f'/dev/video{i}' for i in range(8) if os.path.exists(f'/dev/video{i}')]})

def get_ip():
    try:
        s = socket.socket(); s.connect(('8.8.8.8',80)); return s.getsockname()[0]
    except: return '127.0.0.1'
    finally: s.close()

def register_and_heartbeat():
    import urllib.request, json as _j
    n = config['node']
    srv = f"http://{n['server_ip']}:{n['server_port']}"
    for _ in range(30):
        try:
            req = urllib.request.Request(f'{srv}/nodes', method='POST',
              data=_j.dumps({'id':n['id'],'name':n['name'],'ip':get_ip(),'os':'linux'}).encode(),
              headers={'Content-Type':'application/json'})
            urllib.request.urlopen(req, timeout=5)
            log.info(f'Registered with {srv}')
            break
        except Exception as e: log.warning(f'Register failed: {e}'); time.sleep(10)
    while True:
        time.sleep(10)
        try:
            req = urllib.request.Request(f"{srv}/nodes/{n['id']}/ping", method='POST',
              data=_j.dumps({'ip':get_ip()}).encode(), headers={'Content-Type':'application/json'})
            urllib.request.urlopen(req, timeout=3)
        except: pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='/opt/cyangame-node/config.yml')
    args = parser.parse_args()
    global config
    with open(args.config) as f: config = yaml.safe_load(f)
    log.info(f"Node Agent | {config['node']['id']} | {config['node']['name']}")
    threading.Thread(target=register_and_heartbeat, daemon=True).start()
    app.run(host='0.0.0.0', port=config['node'].get('agent_port',7001), threaded=True)

if __name__ == '__main__': main()
