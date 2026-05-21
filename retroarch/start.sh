#!/bin/bash
# Start Xvfb and the emulation manager API

set -e

echo "[emulation] Starting virtual display..."
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX &
export DISPLAY=:99

echo "[emulation] Starting PulseAudio..."
pulseaudio --start --exit-idle-time=-1 2>/dev/null || true

echo "[emulation] Starting emulation API on :7002..."
exec python3 /opt/emulation-api.py
