# Plano de Migração — Consolidação de Repositórios
## Prismatic Labs → Monorepo `prismatic-labs-hq`

**Status:** Pronto para executar
**Tempo estimado:** 30-40 minutos
**Resultado:** GitHub limpo, todos os projetos Prismatic em um só lugar

---

## Pré-requisitos

```bash
# Clone o monorepo se ainda não tiver local
git clone https://github.com/Hoffmannss/prismatic-labs-hq.git
cd prismatic-labs-hq

# Confirme que está na branch main
git checkout main
git pull origin main
```

---

## PASSO 1 — Criar estrutura de pastas no monorepo

```bash
# Na raiz de prismatic-labs-hq/
mkdir -p apps/lead-normalizer-api
mkdir -p apps/landing-captacao
mkdir -p apps/automacao-leads
mkdir -p infrastructure/agents
mkdir -p assets/instagram-posts
mkdir -p assets/instagram-screenshots
mkdir -p strategy/roadmap-2026
```

---

## PASSO 2 — Migrar cada repositório com histórico preservado

### 2A. Lead Normalizer API → apps/lead-normalizer-api/

```bash
# Adicionar como remote temporário
git remote add lead-normalizer https://github.com/Hoffmannss/prismatic-lead-normalizer-api.git
git fetch lead-normalizer

# Criar branch com o conteúdo do repo
git checkout -b import/lead-normalizer lead-normalizer/main

# Mover para subpasta (reescreve histórico preservando)
git filter-branch --prune-empty --tree-filter '
  mkdir -p apps/lead-normalizer-api
  git ls-files | while read f; do
    dir=$(dirname "apps/lead-normalizer-api/$f")
    mkdir -p "$dir"
    git mv "$f" "apps/lead-normalizer-api/$f" 2>/dev/null || true
  done
' HEAD

# Voltar para main e fazer merge
git checkout main
git merge --allow-unrelated-histories import/lead-normalizer
git branch -d import/lead-normalizer
git remote remove lead-normalizer
```

### 2B. Landing Captação → apps/landing-captacao/

```bash
git remote add landing-captacao https://github.com/Hoffmannss/prismatic-landing-captacao.git
git fetch landing-captacao

# Simples: copiar arquivos (sem preservar histórico — repo simples)
git checkout landing-captacao/main -- .
mkdir -p apps/landing-captacao
# Mover arquivos manualmente para apps/landing-captacao/
git remote remove landing-captacao
```

### 2C. Automação de Leads → apps/automacao-leads/

```bash
git remote add automacao-leads https://github.com/Hoffmannss/automacao-leads-prismatic.git
git fetch automacao-leads

# Copiar conteúdo
git checkout automacao-leads/main -- .
# Reorganizar em apps/automacao-leads/
git remote remove automacao-leads
```

### 2D. Agente Pessoal IA → infrastructure/agents/

```bash
git remote add agente-ia https://github.com/Hoffmannss/agente-pessoal-ia.git
git fetch agente-ia
git checkout agente-ia/main -- docs README.md
mv docs infrastructure/agents/docs-pessoal
mv README.md infrastructure/agents/README-agente-pessoal.md
git remote remove agente-ia
```

### 2E. Instagram Posts → assets/instagram-posts/

```bash
git remote add insta-posts https://github.com/Hoffmannss/prismatic-instagram-posts.git
git fetch insta-posts
git checkout insta-posts/main -- .
# Mover para assets/instagram-posts/
git remote remove insta-posts
```

### 2F. Posts Screenshots → assets/instagram-screenshots/

```bash
git remote add insta-ss https://github.com/Hoffmannss/prismatic-posts-screenshots.git
git fetch insta-ss
git checkout insta-ss/main -- .
# Mover para assets/instagram-screenshots/
git remote remove insta-ss
```

### 2G. Estratégia 2026 → strategy/roadmap-2026/

```bash
git remote add strategy-2026 https://github.com/Hoffmannss/prismatic-labs-2026.git
git fetch strategy-2026
git checkout strategy-2026/main -- .
# Mover para strategy/roadmap-2026/
git remote remove strategy-2026
```

---

## PASSO 3 — Mover ROADMAP.md para a raiz do monorepo

O arquivo `ROADMAP.md` foi criado em `vendedor-ai/ROADMAP.md`.
Ele deve estar na RAIZ de `prismatic-labs-hq/`:

```bash
# Dentro de prismatic-labs-hq/
cp vendedor-ai/ROADMAP.md ./ROADMAP.md
rm vendedor-ai/ROADMAP.md
git add ROADMAP.md vendedor-ai/ROADMAP.md
git commit -m "docs: move ROADMAP.md para raiz do monorepo"
```

---

## PASSO 4 — Commit e push da estrutura

```bash
# Adicionar tudo
git add -A

# Commit
git commit -m "feat: consolida todos os repos Prismatic Labs no monorepo

- apps/lead-normalizer-api: Lead Normalizer API (de prismatic-lead-normalizer-api)
- apps/landing-captacao: Landing page de captação (de prismatic-landing-captacao)
- apps/automacao-leads: Produto serviço 24h (de automacao-leads-prismatic)
- infrastructure/agents: Agente pessoal IA (de agente-pessoal-ia)
- assets/instagram-posts: Posts profissionais (de prismatic-instagram-posts)
- assets/instagram-screenshots: Templates mobile (de prismatic-posts-screenshots)
- strategy/roadmap-2026: Estratégia executiva (de prismatic-labs-2026)
- ROADMAP.md: Roadmap master da empresa automática"

git push origin main
```

---

## PASSO 5 — Verificação antes de deletar os repos antigos

Execute este checklist ANTES de deletar qualquer repo:

- [ ] `apps/lead-normalizer-api/` tem todos os arquivos do repo original?
- [ ] `apps/landing-captacao/` está completo?
- [ ] `apps/automacao-leads/` está completo?
- [ ] `infrastructure/agents/` tem o README e docs do agente pessoal?
- [ ] `assets/instagram-posts/` está completo?
- [ ] `assets/instagram-screenshots/` está completo?
- [ ] `strategy/roadmap-2026/` está completo?
- [ ] `ROADMAP.md` está na raiz do monorepo?
- [ ] Push foi feito com sucesso?
- [ ] GitHub mostra a estrutura correta?

**Só depois de confirmar TODOS os itens → deletar os repos.**

---

## PASSO 6 — Deletar repositórios antigos no GitHub

> ⚠️ IRREVERSÍVEL. Confirme a checklist do Passo 5 antes de continuar.

Para cada repo migrado, acesse:
`https://github.com/Hoffmannss/[nome-do-repo]/settings`
→ Scroll até "Danger Zone" → "Delete this repository"

**Deletar após migração:**
- [ ] `prismatic-lead-normalizer-api`
- [ ] `prismatic-landing-captacao`
- [ ] `automacao-leads-prismatic`
- [ ] `agente-pessoal-ia`
- [ ] `prismatic-instagram-posts`
- [ ] `prismatic-posts-screenshots`
- [ ] `prismatic-labs-2026`
- [ ] `prismatic-hq` (versão antiga do hq — sem migração necessária)

**Deletar sem migração (arquivar ou ignorar):**
- [ ] `dn-institute` — fork irrelevante

**Manter separado:**
- `sushi-dk-premium-sj` — projeto diferente, manter
- `Solo-Life` / `rpg-vida` — pessoal, manter
- `guia-completo-abrir-empresa` — recurso público, manter
- `etsy-templates-business` — avaliar se quer manter

---

## Estrutura Final Esperada no GitHub

```
Hoffmannss/prismatic-labs-hq/
├── vendedor-ai/           ✅ já existe
├── apps/
│   ├── lead-normalizer-api/   ← novo
│   ├── landing-captacao/      ← novo
│   └── automacao-leads/       ← novo
├── infrastructure/
│   ├── agents/                ← novo
│   ├── electron/          ✅ já existe
│   └── mobile/            ✅ já existe
├── assets/
│   ├── instagram-posts/       ← novo
│   └── instagram-screenshots/ ← novo
├── strategy/
│   ├── mercado/           ✅ já existe
│   ├── progress/          ✅ já existe
│   └── roadmap-2026/          ← novo
├── docs/                  ✅ já existe
├── ROADMAP.md                 ← novo (mover de vendedor-ai/)
├── MIGRATION.md           ✅ já existe
└── README.md              ✅ já existe
```

---

*Criado em: Março 2026*
