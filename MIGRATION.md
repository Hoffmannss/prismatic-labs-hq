# 🔄 Migração: Consolidação do Vendedor IA

**Data:** 07/03/2026 23:00 BRT  
**Branch:** `fix/consolidate-vendedor-code`  
**Status:** ✅ Concluído

---

## 📋 Contexto

### Problema Identificado
O código do **Vendedor IA** estava fragmentado entre dois repositórios:

- **prismatic-labs-2026** (repo público): Continha todo o código funcional em `/vendedor/`
  - 20+ arquivos JavaScript (agentes, orquestrador, dashboard)
  - Configurações e dados
  - **Problema:** Repo é para landing pages e docs, não código privado

- **prismatic-labs-hq** (repo privado): Branch `refactor/electron-desktop-app`
  - Apenas estrutura Electron (main.js, preload.js, splash.html)
  - Pasta `vendedor-ai/` com apenas 1 arquivo de documentação
  - **Problema:** Faltava o código core do sistema

### Decisão
Consolidar **TODO** o código do Vendedor IA no repositório correto: `prismatic-labs-hq`.

---

## 🎯 Ações Executadas

### 1. Migração de Código
**De:** `Hoffmannss/prismatic-labs-2026/vendedor/*`  
**Para:** `Hoffmannss/prismatic-labs-hq/vendedor-ai/*`

**Arquivos movidos:**
```
vendedor-ai/
├── agents/               ← NOVO: todos os agentes IA
│   ├── 1-analyzer.js
│   ├── 2-copywriter.js
│   ├── 3-cataloger.js
│   ├── 4-followup.js
│   ├── 5-orchestrator.js
│   ├── 6-scout.js
│   ├── 6-scout-auto.js
│   ├── 7-reviewer.js
│   ├── 8-dashboard.js
│   ├── 9-notion-sync.js
│   ├── 10-autopilot.js
│   ├── 11-learner.js
│   └── 12-tracker.js
├── config/               ← Configurações (nichos, templates)
├── data/                 ← Dados e learning memory
├── .env.example
└── package.json          ← Atualizado v2.0.0
```

### 2. Nova Estrutura de Paths
**Antes:**
```javascript
const config = require('../config/nichos-config.json');
```

**Depois:** (já ajustado)
```javascript
const config = require(path.join(__dirname, '..', 'config', 'nichos-config.json'));
```

### 3. Arquivamento (próximo passo)
**Repo:** `prismatic-labs-2026`  
**Ação:** Mover `/vendedor/` → `/_ARCHIVED/vendedor-old/`  
**Motivo:** Preservar histórico, mas sinalizar obsoleto

---

## 🧪 Validação Necessária

### Checklist Pós-Migração

- [ ] **Clonar repo atualizado localmente**
  ```bash
  cd C:\Users\hoffm\projetos
  git clone https://github.com/Hoffmannss/prismatic-labs-hq.git
  cd prismatic-labs-hq
  git checkout fix/consolidate-vendedor-code
  ```

- [ ] **Instalar dependências**
  ```bash
  cd vendedor-ai
  npm install
  ```

- [ ] **Configurar .env**
  ```bash
  cp .env.example .env
  # Adicionar GROQ_API_KEY e outras chaves
  ```

- [ ] **Testar agente isolado**
  ```bash
  node agents/1-analyzer.js teste_user "Bio de teste" 1000 5
  ```

- [ ] **Testar orquestrador**
  ```bash
  npm start
  ```

- [ ] **Testar Electron**
  ```bash
  cd ..
  npm install
  npm run dev
  ```

---

## 📚 Referências

### Commits Relacionados
- `feat: migrar código completo do Vendedor IA para repo correto` (este commit)

### Branches
- **Origem:** `Hoffmannss/prismatic-labs-2026:main`
- **Destino:** `Hoffmannss/prismatic-labs-hq:fix/consolidate-vendedor-code`
- **Base:** `refactor/electron-desktop-app`

### Issues/PRs
- PR pendente: `fix/consolidate-vendedor-code` → `refactor/electron-desktop-app`

---

## 🔮 Próximos Passos

1. **Validar testes** (checklist acima)
2. **Merge para `refactor/electron-desktop-app`**
3. **Arquivar código antigo** em `prismatic-labs-2026`
4. **Atualizar README** do `prismatic-labs-hq` com nova estrutura
5. **Documentar integração** Electron ↔ Vendedor IA

---

**Autor:** Hoffmannss + Perplexity IA  
**Revisão:** Pendente
