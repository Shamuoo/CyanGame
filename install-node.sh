#!/usr/bin/env bash
# CyanGame Node Agent Install — runs on Wyse 3040 / N100
# curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-node.sh | bash
set -euo pipefail

INSTALL_DIR="/opt/cyangame-node"
SERVICE="cyangame-node"
REPO="https://raw.githubusercontent.com/Shamuoo/CyanGame/main"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[node]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*"; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root"

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║     CyanGame  Node Agent             ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

info "Installing dependencies..."
apt-get update -qq
apt-get install -y -qq ffmpeg python3 python3-pip v4l-utils
pip3 install flask pyyaml requests 2>/dev/null || pip3 install flask pyyaml requests --break-system-packages
modprobe i915 2>/dev/null || true
success "Dependencies ready"

mkdir -p "$INSTALL_DIR"
NODE_ID_FILE="$INSTALL_DIR/.node-id"
[[ -f "$NODE_ID_FILE" ]] || echo "node-$(cat /sys/class/net/*/address 2>/dev/null | grep -v '00:00' | head -1 | tr ':' '-')" > "$NODE_ID_FILE"
NODE_ID=$(cat "$NODE_ID_FILE")
success "Node ID: $NODE_ID"

if [[ -n "${CYANGAME_SERVER:-}" ]]; then SERVER_IP="$CYANGAME_SERVER"
else read -rp "  Server IP: " SERVER_IP; fi
DEFAULT_NAME="$(hostname)"
read -rp "  Node name [$DEFAULT_NAME]: " NODE_NAME
NODE_NAME="${NODE_NAME:-$DEFAULT_NAME}"

curl -fsSL "$REPO/node/agent.py" -o "$INSTALL_DIR/agent.py"

cat > "$INSTALL_DIR/config.yml" <<EOF
node:
  id: "$NODE_ID"
  name: "$NODE_NAME"
  server_ip: "$SERVER_IP"
  server_port: 3001
  agent_port: 7001
  srt_port: 8890
capture:
  vaapi_device: /dev/dri/renderD128
  default_resolution: 1080p
EOF

cat > "/etc/systemd/system/$SERVICE.service" <<EOF
[Unit]
Description=CyanGame Node Agent
After=network-online.target
Wants=network-online.target
[Service]
ExecStart=/usr/bin/python3 $INSTALL_DIR/agent.py --config $INSTALL_DIR/config.yml
Restart=always
RestartSec=10
User=root
WorkingDirectory=$INSTALL_DIR
Environment=PYTHONUNBUFFERED=1
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"
sleep 3

systemctl is-active --quiet "$SERVICE" || die "Service failed — check: journalctl -u $SERVICE -n 50"

echo ""
echo -e "${GREEN}${BOLD}Node agent running!${NC}"
echo -e "  ID: ${BOLD}$NODE_ID${NC}  Name: ${BOLD}$NODE_NAME${NC}"
echo -e "  Will appear in portal within 30 seconds."
echo -e "  Logs: journalctl -u $SERVICE -f"
