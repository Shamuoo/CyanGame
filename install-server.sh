#!/usr/bin/env bash
# ============================================================
#  ConsoleHub — Server Install
#  Runs on your NAS (Unraid, TrueNAS, Ubuntu, etc.)
#
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-server.sh | bash
# ============================================================
set -euo pipefail

REPO="https://raw.githubusercontent.com/Shamuoo/CyanGame/main"
INSTALL_DIR="${CONSOLEHUB_DIR:-$HOME/cyangame}"
PORT="${CONSOLEHUB_PORT:-7000}"

# ── Colours ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[cyangame]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════╗"
echo "  ║       ConsoleHub  Server          ║"
echo "  ╚═══════════════════════════════════╝"
echo -e "${NC}"

# ── Checks ─────────────────────────────────────────────────
info "Checking requirements..."

command -v docker  >/dev/null 2>&1 || die "Docker not found. Install Docker first."
command -v curl    >/dev/null 2>&1 || die "curl not found."

# Docker Compose v2 (plugin) or v1 (standalone)
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  die "Docker Compose not found. Install Docker Compose first."
fi

success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
success "Compose: $COMPOSE"

# ── Detect NAS IP ───────────────────────────────────────────
NAS_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
info "Detected IP: ${BOLD}$NAS_IP${NC}"
read -rp "  Use this as NAS IP? [Y/n]: " CONFIRM
if [[ "$CONFIRM" =~ ^[Nn] ]]; then
  read -rp "  Enter NAS IP: " NAS_IP
fi

# ── Install Directory ───────────────────────────────────────
echo ""
info "Installing to: ${BOLD}$INSTALL_DIR${NC}"
mkdir -p "$INSTALL_DIR"/{server,data}

# ── Download Files ──────────────────────────────────────────
info "Downloading server files..."

FILES=(
  "server/docker-compose.yml"
  "server/.env.example"
  "server/mediamtx/mediamtx.yml"
  "server/nginx/nginx.conf"
)

mkdir -p "$INSTALL_DIR/server/mediamtx" "$INSTALL_DIR/server/nginx"

for f in "${FILES[@]}"; do
  dest="$INSTALL_DIR/$f"
  mkdir -p "$(dirname "$dest")"
  curl -fsSL "$REPO/$f" -o "$dest"
done

# Backend image will be pulled from GHCR (pre-built)
# No need to download source for production install

success "Files downloaded"

# ── Configure ───────────────────────────────────────────────
info "Configuring..."

ENV_FILE="$INSTALL_DIR/server/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$INSTALL_DIR/server/.env.example" "$ENV_FILE"

  # Generate random secrets
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid | tr -d '-')
  TURN_PASS=$(openssl rand -hex 16  2>/dev/null || echo "ch4ng3m3pl34s3")

  sed -i "s|NAS_IP=.*|NAS_IP=$NAS_IP|"                   "$ENV_FILE"
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|"         "$ENV_FILE"
  sed -i "s|TURN_PASSWORD=.*|TURN_PASSWORD=$TURN_PASS|"    "$ENV_FILE"
  sed -i "s|CONSOLEHUB_PORT=.*|CONSOLEHUB_PORT=$PORT|"     "$ENV_FILE"

  success "Config written to $ENV_FILE"
else
  warn ".env already exists — skipping config (delete to regenerate)"
fi

# ── Start Services ──────────────────────────────────────────
echo ""
info "Starting ConsoleHub..."
cd "$INSTALL_DIR/server"
$COMPOSE up -d --pull always

# ── Wait for health ─────────────────────────────────────────
info "Waiting for portal to come up..."
for i in $(seq 1 20); do
  if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   ConsoleHub is running!                  ║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Portal:  ${BOLD}http://$NAS_IP:$PORT${NC}"
echo -e "  API:     ${BOLD}http://$NAS_IP:$PORT/api${NC}"
echo ""
echo -e "  SRT port (nodes push streams here): ${BOLD}8890${NC}"
echo -e "  WebRTC port (browsers pull here):   ${BOLD}8889${NC}"
echo ""
echo -e "  ${YELLOW}Next step: install node agent on each Wyse 3040${NC}"
echo -e "  ${CYAN}curl -fsSL $REPO/install-node.sh | bash${NC}"
echo ""
