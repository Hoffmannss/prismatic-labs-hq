# 📦 Migração de Código — Reorganização dos Repositórios

**Data:** 07 de Março de 2026  
**Status:** ✅ EM ANDAMENTO

---

## 🎯 Objetivo

Consolidar todo o código do **Vendedor IA** em um único repositório correto:
- **De:** `prismatic-labs-2026/vendedor/` (repo público de landing pages)
- **Para:** `prismatic-labs-hq/vendedor-ai/` (repo privado de código)

---

## 📊 Estrutura Antes vs Depois

### ❌ ANTES (Incorreto)
```
prismatic-labs-2026/              [PÚBLICO]
├── vendedor/                     ← CÓDIGO NO LUGAR ERRADO
│   ├── 1-analyzer.js
│   ├── 2-copywriter.js
│   ├── 5-orchestrator.js
│   └── ... (20+ arquivos)
└── index.html, 08-WEBSITE/, etc.

prismatic-labs-hq/                [PRIVADO]
├── vendedor-ai/
│   └── 01-ANALYZER-AI.md         ← SÓ 1 ARQUIVO DOC
└── (sem código core)
```

### ✅ DEPOIS (Correto)
```
prismatic-labs-2026/              [PÚBLICO]
├── _ARCHIVED/
│   └── vendedor-old/             ← Código movido para cá (preservado)
│       └── README.md             "Este código foi migrado para..."
├── index.html
└── 08-WEBSITE/, docs, etc.       ← Landing pages e docs estratégicos

prismatic-labs-hq/                [PRIVADO]
├── electron/                     ← Desktop app
├── vendedor-ai/                  ← TODO CÓDIGO AQUI
│   ├── agents/
│   │   ├── 1-analyzer.js
│   │   ├── 2-copywriter.js
│   │   ├── 3-cataloger.js
│   │   └── ... (todos os .js)
│   ├── config/
│   │   ├── nichos-config.json
│   │   └── copywriting-templates.json
│   ├── data/
│   │   └── produtos.json
│   ├── 5-orchestrator.js
│   ├── package.json
│   └── SETUP.md
└── package.json (root)
```

---

## ✅ Arquivos Migrados

### Core System
- [x] `.env.example`
- [x] `package.json`
- [x] `SETUP.md`
- [ ] `5-orchestrator.js` (orquestrador principal)

### AI Agents
- [ ] `1-analyzer.js` → `agents/1-analyzer.js`
- [ ] `2-copywriter.js` → `agents/2-copywriter.js`
- [ ] `3-cataloger.js` → `agents/3-cataloger.js`
- [ ] `4-followup.js` → `agents/4-followup.js`
- [ ] `6-scout.js` → `agents/6-scout.js`
- [ ] `6-scout-auto.js` → `agents/6-scout-auto.js`
- [ ] `7-reviewer.js` → `agents/7-reviewer.js`
- [ ] `8-dashboard.js` → `agents/8-dashboard.js`
- [ ] `9-notion-sync.js` → `agents/9-notion-sync.js`
- [ ] `10-autopilot.js` → `agents/10-autopilot.js`
- [ ] `11-learner.js` → `agents/11-learner.js`
- [ ] `12-tracker.js` → `agents/12-tracker.js`

### Config & Data
- [ ] `config/nichos-config.json`
- [ ] `config/copywriting-templates.json`
- [ ] `data/produtos.json`

### UI
- [ ] `jarvis.html`
- [ ] `public/*`

### Docs
- [ ] `README-*.md`

---

## 🚀 Próximos Passos

1. ✅ Criar branch `fix/consolidate-vendedor-code`
2. ⏳ Transferir TODOS os arquivos
3. ⏳ Atualizar imports/paths no código
4. ⏳ Criar PR para review
5. ⏳ Após merge, arquivar código antigo em `prismatic-labs-2026/_ARCHIVED/`
6. ⏳ Atualizar documentação em ambos repos

---

## 🔗 Links Relacionados

- PR: [A ser criado]
- Issue: [A ser criado]
- Branch: `fix/consolidate-vendedor-code`

---

**Última atualização:** 07/03/2026 22:41 BRT