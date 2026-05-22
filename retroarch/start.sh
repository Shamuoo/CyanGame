#!/bin/bash
set -e

echo "[emulation] Starting Xvfb..."
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX &
export DISPLAY=:99
sleep 1

echo "[emulation] Starting API on :7002..."
exec python3 /opt/emulation-api.py
