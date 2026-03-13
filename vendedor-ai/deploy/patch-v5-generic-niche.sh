#!/bin/bash
# =============================================================
# PATCH v5 — Generic Niche System
# Remove hardcoded Prismatic Labs products from all agents
# Adds "Meu Negócio" config + Dashboard UI
# =============================================================
set -e

PROJECT_DIR="/opt/prismatic/prismatic-labs-hq/vendedor-ai"
cd "$PROJECT_DIR"

echo "📦 Aplicando patch v5 — Sistema genérico de nicho/produto..."

# 1. Pull do GitHub (se configurado)
if git remote get-url origin &>/dev/null; then
  echo "⬇️  git pull..."
  git pull origin main || echo "⚠️  git pull falhou — continuando com arquivos locais"
fi

# 2. Reiniciar dashboard para recarregar os novos arquivos
echo "🔄 Reiniciando serviços..."
pm2 restart vendedor-dashboard --update-env 2>/dev/null || echo "⚠️  Dashboard não estava rodando, iniciando..."
pm2 start deploy/ecosystem.config.js --only vendedor-dashboard 2>/dev/null || true

# 3. Verificar se negocio-config.js existe
if [ ! -f "$PROJECT_DIR/config/negocio-config.js" ]; then
  echo "❌ ERRO: config/negocio-config.js não encontrado!"
  echo "   Certifique-se de que o arquivo foi commitado no repositório."
  exit 1
fi

# 4. Status final
echo ""
echo "✅ Patch v5 aplicado com sucesso!"
echo ""
echo "PRÓXIMOS PASSOS:"
echo "  1. Acesse o Dashboard → seção 'Meu Negócio'"
echo "  2. Preencha a descrição do seu produto/serviço"
echo "  3. Clique em 'Salvar Negócio'"
echo "  4. Teste o autopilot com qualquer nicho"
echo ""
pm2 status
