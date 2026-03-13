#!/bin/bash
# =============================================================
# PRISMATIC LABS — Setup Git na VPS
# Executa APENAS na VPS (root@srv1473192)
# =============================================================

set -e

REPO_URL="https://github.com/Hoffmannss/prismatic-labs-hq.git"
PROJECT_DIR="/root/projetos/prismatic-labs-hq"

echo "╔═══════════════════════════════════════════╗"
echo "║   PRISMATIC LABS — Git Setup VPS          ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# ---- 1. Verificar se já tem git ----
cd "$PROJECT_DIR"
if [ -d ".git" ]; then
    echo "[INFO] .git já existe em $PROJECT_DIR"
    echo "       Remote atual:"
    git remote -v 2>/dev/null || echo "       (nenhum remote)"
    echo ""
    echo "[AÇÃO] Verificando remote..."
    
    if git remote get-url origin 2>/dev/null; then
        echo "[OK] Remote 'origin' já configurado"
    else
        echo "[ADD] Adicionando remote origin..."
        git remote add origin "$REPO_URL"
    fi
else
    echo "[INIT] Inicializando git em $PROJECT_DIR..."
    git init
    git branch -m main
    git remote add origin "$REPO_URL"
    echo "[OK] Git inicializado + remote adicionado"
fi

echo ""

# ---- 2. Configurar identidade (se não existir) ----
if ! git config user.email > /dev/null 2>&1; then
    git config user.name "Prismatic Labs"
    git config user.email "Hoffmanns_@hotmail.com"
    echo "[OK] Git user configurado"
fi

# ---- 3. Verificar .gitignore ----
if [ -f "vendedor-ai/.gitignore" ]; then
    echo "[OK] .gitignore encontrado em vendedor-ai/"
else
    echo "[WARN] .gitignore não encontrado — verifique manualmente"
fi

# ---- 4. Status ----
echo ""
echo "========== GIT STATUS =========="
git status --short | head -30
TOTAL=$(git status --short | wc -l)
echo "... total: $TOTAL arquivos"
echo ""

# ---- 5. Instruções próximos passos ----
echo "╔═══════════════════════════════════════════════════╗"
echo "║   PRÓXIMOS PASSOS (executar manualmente):        ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║                                                   ║"
echo "║ 1. Revisar arquivos acima                        ║"
echo "║                                                   ║"
echo "║ 2. Fazer o primeiro commit + push:               ║"
echo "║    git add -A                                    ║"
echo "║    git commit -m 'feat: initial VPS codebase'    ║"
echo "║    git push -u origin main                       ║"
echo "║                                                   ║"
echo "║ 3. Se der erro de auth, configurar token:        ║"
echo "║    git remote set-url origin                     ║"
echo "║    https://TOKEN@github.com/Hoffmannss/          ║"
echo "║    prismatic-labs-hq.git                         ║"
echo "║                                                   ║"
echo "║ 4. Depois, qualquer mudança:                     ║"
echo "║    git add . && git commit -m 'msg' && git push  ║"
echo "║                                                   ║"
echo "╚═══════════════════════════════════════════════════╝"

