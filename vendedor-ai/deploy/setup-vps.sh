#!/bin/bash
# =============================================================
# SETUP VPS - PRISMATIC LABS VENDEDOR AI
# Hostinger VPS Ubuntu 22.04
# Executar 1x como root: bash setup-vps.sh
# =============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "\n${CYAN}======================================${NC}"
echo -e "${CYAN}  SETUP VPS - PRISMATIC LABS${NC}"
echo -e "${CYAN}======================================${NC}\n"

# ---- 1. UPDATE ----
echo -e "${YELLOW}[1/8] Atualizando sistema...${NC}"
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y git curl wget unzip build-essential

# ---- 2. NODE.JS ----
echo -e "${YELLOW}[2/8] Instalando Node.js 22...${NC}"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node --version && npm --version

# ---- 3. PM2 ----
echo -e "${YELLOW}[3/8] Instalando PM2...${NC}"
npm install -g pm2
pm2 startup systemd -u root --hp /root

# ---- 4. PLAYWRIGHT DEPS ----
echo -e "${YELLOW}[4/8] Instalando dependencias do Playwright/Chromium...${NC}"
apt-get install -y \
  libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
  libasound2 libatspi2.0-0 libwayland-client0 xvfb

# ---- 5. CLONE DO REPO ----
echo -e "${YELLOW}[5/8] Clonando repositorio...${NC}"
mkdir -p /opt/prismatic
cd /opt/prismatic

if [ -d "prismatic-labs-hq" ]; then
  echo "  Repo ja existe. Atualizando..."
  cd prismatic-labs-hq
  git pull origin fix/consolidate-vendedor-code
else
  git clone https://github.com/Hoffmannss/prismatic-labs-hq.git
  cd prismatic-labs-hq
  git checkout fix/consolidate-vendedor-code
fi

# ---- 6. NPM INSTALL ----
echo -e "${YELLOW}[6/8] Instalando dependencias npm...${NC}"
cd /opt/prismatic/prismatic-labs-hq/vendedor-ai
npm install

# Instalar Playwright e Chromium
npx playwright install chromium
npx playwright install-deps chromium

# ---- 7. .ENV ----
echo -e "${YELLOW}[7/8] Configurando .env...${NC}"
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo -e "${RED}ATENCAO: Configure o .env antes de continuar!${NC}"
  echo -e "${YELLOW}  nano /opt/prismatic/prismatic-labs-hq/vendedor-ai/.env${NC}"
else
  echo -e "${GREEN}  .env ja existe${NC}"
fi

# ---- 8. PM2 ----
echo -e "${YELLOW}[8/8] Configurando PM2...${NC}"
cd /opt/prismatic/prismatic-labs-hq/vendedor-ai
pm2 start deploy/ecosystem.config.js
pm2 save

echo -e "\n${GREEN}======================================${NC}"
echo -e "${GREEN}  SETUP CONCLUIDO!${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e ""
echo -e "Proximos passos:"
echo -e "  1. Configure o .env:"
echo -e "     ${CYAN}nano /opt/prismatic/prismatic-labs-hq/vendedor-ai/.env${NC}"
echo -e ""
echo -e "  2. Faca login no Instagram (1x):"
echo -e "     ${CYAN}cd /opt/prismatic/prismatic-labs-hq/vendedor-ai"
echo -e "     node agents/0-scraper.js login${NC}"
echo -e ""
echo -e "  3. Teste o scraper:"
echo -e "     ${CYAN}node agents/0-scraper.js test${NC}"
echo -e ""
echo -e "  4. Ver processos PM2:"
echo -e "     ${CYAN}pm2 status${NC}"
echo -e "     ${CYAN}pm2 logs vendedor-dashboard${NC}"
echo -e ""
