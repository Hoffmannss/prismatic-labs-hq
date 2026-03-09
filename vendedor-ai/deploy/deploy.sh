#!/bin/bash
# =============================================================
# DEPLOY - Atualiza VPS com ultima versao do GitHub
# Executar sempre que quiser atualizar:
#   bash /opt/prismatic/prismatic-labs-hq/vendedor-ai/deploy/deploy.sh
# =============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO="/opt/prismatic/prismatic-labs-hq"
APP="${REPO}/vendedor-ai"

echo -e "\n${CYAN}=== DEPLOY PRISMATIC LABS ===${NC}"

# 1. Git pull
echo -e "${YELLOW}[1/4] Baixando atualizacoes...${NC}"
cd $REPO
git pull origin fix/consolidate-vendedor-code

# 2. npm install (caso tenha novas dependencias)
echo -e "${YELLOW}[2/4] Verificando dependencias...${NC}"
cd $APP
npm install --production

# 3. Reiniciar processos PM2
echo -e "${YELLOW}[3/4] Reiniciando processos...${NC}"
pm2 restart all

# 4. Status
echo -e "${YELLOW}[4/4] Status:${NC}"
pm2 status

echo -e "\n${GREEN}Deploy concluido!${NC}"
echo -e "Dashboard: ${CYAN}http://SEU_IP_VPS:3131${NC}\n"
