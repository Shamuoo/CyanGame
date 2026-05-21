#!/usr/bin/env bash
# ============================================================
#  CyanGame — Server Install
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-server.sh | bash
# ============================================================
set -euo pipefail

REPO="https://raw.githubusercontent.com/Shamuoo/CyanGame/main"
INSTALL_DIR="${CYANGAME_DIR:-/mnt/user/appdata/cyangame}"
PORT="${CYANGAME_PORT:-7000}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[cyangame]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║         CyanGame  Server             ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

command -v docker  >/dev/null 2>&1 || die "Docker not found."
command -v git     >/dev/null 2>&1 || die "git not found."

if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then COMPOSE="docker-compose"
else die "Docker Compose not found."; fi

success "Docker ready"

info "Cloning CyanGame into $INSTALL_DIR..."
if [[ -d "$INSTALL_DIR/.git" ]]; then
  cd "$INSTALL_DIR" && git pull
  success "Updated existing install"
else
  git clone https://github.com/Shamuoo/CyanGame.git "$INSTALL_DIR"
  success "Cloned"
fi

cd "$INSTALL_DIR/server"

# Create required directories
mkdir -p ../data ../saves ../emulator-config ../retroarch nginx mediamtx

# Copy retroarch files if not present
[[ -f "../retroarch/Dockerfile" ]] || cp -r ../retroarch ./

info "Starting CyanGame..."
$COMPOSE up -d --build

info "Waiting for portal..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/api/health" >/dev/null 2>&1; then break; fi
  sleep 2
done

NAS_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   CyanGame is running!                       ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Portal:  ${BOLD}http://$NAS_IP:$PORT${NC}"
echo -e "  Wizard:  ${BOLD}http://$NAS_IP:$PORT/setup${NC}"
echo ""
echo -e "  ${YELLOW}Next: install node agent on each Wyse 3040${NC}"
echo -e "  ${CYAN}curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-node.sh | bash${NC}"
echo ""
