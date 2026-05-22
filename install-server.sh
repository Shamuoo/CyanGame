#!/usr/bin/env bash
# CyanGame Server Install
# curl -fsSL https://raw.githubusercontent.com/Shamuoo/CyanGame/main/install-server.sh | bash
set -euo pipefail

INSTALL_DIR="/mnt/user/appdata/cyangame"
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[cyangame]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║         CyanGame  Server             ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

command -v docker >/dev/null 2>&1 || die "Docker not found"
docker compose version >/dev/null 2>&1 || die "Docker Compose not found. Run: mkdir -p /usr/local/lib/docker/cli-plugins && curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose"

command -v git >/dev/null 2>&1 || { apt-get install -y -qq git 2>/dev/null || die "git not found"; }

info "Setting up CyanGame in $INSTALL_DIR..."

if [[ -d "$INSTALL_DIR/.git" ]]; then
  cd "$INSTALL_DIR" && git pull && success "Updated"
else
  git clone https://github.com/Shamuoo/CyanGame.git "$INSTALL_DIR" && success "Cloned"
fi

mkdir -p "$INSTALL_DIR"/{data,saves,bios,emulator-config}

info "Building and starting containers..."
cd "$INSTALL_DIR/server"
docker compose up -d --build

info "Waiting for portal..."
for i in $(seq 1 30); do
  curl -sf "http://localhost:7000/health" >/dev/null 2>&1 && break || sleep 3
done

NAS_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   CyanGame is running!                       ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Portal:  ${BOLD}http://$NAS_IP:7000${NC}"
echo ""
echo -e "  Open the portal — go to Setup to configure and scan ROMs."
echo ""
