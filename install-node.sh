#!/usr/bin/env bash
# ============================================================
#  CyanGame — Node Agent Install
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-node.sh | bash
#
#  Or with server IP pre-set:
#    CYANGAME_SERVER=192.168.1.100 \
#    curl -fsSL .../install-node.sh | bash
# ============================================================
set -euo pipefail

INSTALL_DIR="/opt/cyangame-node"
SERVICE_NAME="cyangame-node"
REPO="https://raw.githubusercontent.com/Shamuoo/CyanGame/main"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[node]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║     CyanGame  Node Agent             ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash install-node.sh"

info "Installing dependencies..."
apt-get update -qq
apt-get install -y -qq ffmpeg python3 python3-pip v4l-utils vainfo usbip linux-headers-$(uname -r) 2>/dev/null || \
apt-get install -y -qq ffmpeg python3 python3-pip v4l-utils vainfo usbip

modprobe i915 2>/dev/null || true
modprobe usbip_core 2>/dev/null || true
modprobe vhci_hcd 2>/dev/null || true

pip3 install -q flask requests pyyaml 2>/dev/null || \
pip3 install -q flask requests pyyaml --break-system-packages

success "Dependencies installed"

mkdir -p "$INSTALL_DIR"

# Stable node ID from MAC address
NODE_ID_FILE="$INSTALL_DIR/.node-id"
if [[ ! -f "$NODE_ID_FILE" ]]; then
  NODE_ID="node-$(cat /sys/class/net/*/address 2>/dev/null | grep -v '00:00' | head -1 | tr ':' '-')"
  echo "$NODE_ID" > "$NODE_ID_FILE"
fi
NODE_ID=$(cat "$NODE_ID_FILE")
success "Node ID: $NODE_ID"

echo ""
if [[ -n "${CYANGAME_SERVER:-}" ]]; then
  SERVER_IP="$CYANGAME_SERVER"
  info "Server IP: $SERVER_IP"
else
  read -rp "  Enter CyanGame server IP: " SERVER_IP
fi

DEFAULT_NAME="$(hostname)"
read -rp "  Node display name [$DEFAULT_NAME]: " NODE_NAME
NODE_NAME="${NODE_NAME:-$DEFAULT_NAME}"

info "Detecting capture cards..."
v4l2-ctl --list-devices 2>/dev/null || echo "  (none found yet — plug in capture card and recheck)"

info "Downloading agent..."
curl -fsSL "$REPO/node/agent.py" -o "$INSTALL_DIR/agent.py"
chmod +x "$INSTALL_DIR/agent.py"

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
  default_framerate: 60

usbip:
  enabled: true
  port: 3240
EOF
success "Config written"

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=CyanGame Node Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
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
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
sleep 3

if systemctl is-active --quiet "$SERVICE_NAME"; then
  echo ""
  echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║   Node Agent running!                        ║${NC}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  Node ID:  ${BOLD}$NODE_ID${NC}"
  echo -e "  Name:     ${BOLD}$NODE_NAME${NC}"
  echo -e "  Server:   ${BOLD}$SERVER_IP:3001${NC}"
  echo ""
  echo -e "  ${CYAN}Node will appear in your portal automatically.${NC}"
  echo -e "  Logs: ${BOLD}journalctl -u $SERVICE_NAME -f${NC}"
else
  die "Service failed. Check: journalctl -u $SERVICE_NAME -n 50"
fi
