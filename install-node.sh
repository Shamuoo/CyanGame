#!/usr/bin/env bash
# ============================================================
#  ConsoleHub — Node Agent Install
#  Runs on each Wyse 3040 / N100 / any Linux capture device
#
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-node.sh | bash
#
#  Or with server IP pre-set:
#    CONSOLEHUB_SERVER=192.168.1.100 \
#    curl -fsSL .../install-node.sh | bash
# ============================================================
set -euo pipefail

REPO="https://raw.githubusercontent.com/Shamuoo/CyanGame/main"
INSTALL_DIR="/opt/cyangame-node"
SERVICE_NAME="cyangame-node"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[node]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════╗"
echo "  ║     ConsoleHub  Node Agent        ║"
echo "  ╚═══════════════════════════════════╝"
echo -e "${NC}"

# ── Must be root ────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Run as root: sudo bash install-node.sh"

# ── Detect OS ───────────────────────────────────────────────
info "Detecting OS..."
if   [[ -f /etc/dietpi/dietpi.txt ]];  then OS="dietpi"
elif [[ -f /etc/debian_version ]];     then OS="debian"
elif [[ -f /etc/ubuntu_version ]] || grep -qi ubuntu /etc/os-release 2>/dev/null; then OS="ubuntu"
else OS="unknown"; fi
success "OS: $OS"

# ── Install Dependencies ────────────────────────────────────
info "Installing dependencies (ffmpeg, python3, usbip)..."

apt-get update -qq

PACKAGES=(
  ffmpeg           # capture + encode
  python3          # node agent runtime
  python3-pip      # python packages
  linux-headers-$(uname -r)  # usbip kernel module
  hwdata           # USB device database
  usbip            # controller passthrough
  v4l-utils        # capture card detection
  vainfo           # VAAPI hardware encode check
)

# DietPi has usbutils pre-installed, others may not
apt-get install -y -qq "${PACKAGES[@]}" 2>/dev/null || \
apt-get install -y "${PACKAGES[@]/#linux-headers-$(uname -r)/}" # fallback without kernel headers

# Load VAAPI modules for Intel (Wyse 3040 Atom)
modprobe i915 2>/dev/null || true
modprobe usbip_core 2>/dev/null || true
modprobe vhci_hcd 2>/dev/null || true

success "Dependencies installed"

# ── Install Python packages ─────────────────────────────────
pip3 install -q flask requests 2>/dev/null || \
pip3 install -q flask requests --break-system-packages

# ── Create install dir ──────────────────────────────────────
mkdir -p "$INSTALL_DIR"

# ── Generate Node ID ────────────────────────────────────────
NODE_ID_FILE="$INSTALL_DIR/.node-id"
if [[ ! -f "$NODE_ID_FILE" ]]; then
  # Use MAC address for stable ID across reboots
  NODE_ID="node-$(cat /sys/class/net/*/address 2>/dev/null | grep -v '00:00' | head -1 | tr ':' '-')"
  echo "$NODE_ID" > "$NODE_ID_FILE"
fi
NODE_ID=$(cat "$NODE_ID_FILE")
success "Node ID: $NODE_ID"

# ── Server IP ───────────────────────────────────────────────
echo ""
if [[ -n "${CONSOLEHUB_SERVER:-}" ]]; then
  SERVER_IP="$CONSOLEHUB_SERVER"
  info "Server IP: $SERVER_IP (from environment)"
else
  read -rp "  Enter ConsoleHub server IP: " SERVER_IP
fi

# ── Node Name ───────────────────────────────────────────────
DEFAULT_NAME="$(hostname)"
read -rp "  Node display name [$DEFAULT_NAME]: " NODE_NAME
NODE_NAME="${NODE_NAME:-$DEFAULT_NAME}"

# ── Detect capture cards ────────────────────────────────────
info "Detecting capture cards..."
CAPTURE_DEVICES=$(v4l2-ctl --list-devices 2>/dev/null | grep -E '/dev/video[0-9]+' | tr -d '\t' || echo "none found")
echo -e "  Found: ${BOLD}$CAPTURE_DEVICES${NC}"

# ── Download Agent ──────────────────────────────────────────
info "Downloading node agent..."
curl -fsSL "$REPO/node/agent.py" -o "$INSTALL_DIR/agent.py"
chmod +x "$INSTALL_DIR/agent.py"
success "Agent downloaded"

# ── Write Config ────────────────────────────────────────────
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
success "Config written to $INSTALL_DIR/config.yml"

# ── Systemd Service ─────────────────────────────────────────
info "Installing systemd service..."

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=ConsoleHub Node Agent
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
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

sleep 3

# ── Status check ────────────────────────────────────────────
if systemctl is-active --quiet "$SERVICE_NAME"; then
  echo ""
  echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║   Node Agent running!                     ║${NC}"
  echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  Node ID:  ${BOLD}$NODE_ID${NC}"
  echo -e "  Name:     ${BOLD}$NODE_NAME${NC}"
  echo -e "  Server:   ${BOLD}http://$SERVER_IP:3001${NC}"
  echo ""
  echo -e "  ${CYAN}This node will appear in your portal automatically.${NC}"
  echo -e "  ${CYAN}Plug in your capture card and console, then add them in the portal.${NC}"
  echo ""
  echo -e "  Logs: ${BOLD}journalctl -u $SERVICE_NAME -f${NC}"
else
  die "Service failed to start. Check: journalctl -u $SERVICE_NAME -n 50"
fi
