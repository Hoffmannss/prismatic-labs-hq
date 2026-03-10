# 🤖 Vendedor AI — Prismatic Labs
> Sistema autônomo de prospecção e vendas digitais via Instagram

**Versão:** 2.0 | **Stack:** Node.js + Playwright + Groq + Gemini + Notion
**Deploy:** VPS Hostinger (Ubuntu) via PM2
**Modelo de negócio:** Sistema base + Addons (DLCs)

---

## O que este sistema faz

1. **Scraping** — Coleta perfis do Instagram por hashtag/nicho (sem Apify)
2. **Análise IA** — Classifica leads por score, produto ideal e prioridade (Groq/Llama)
3. **Copywriting IA** — Gera 3 variações de DM personalizada por lead (Gemini)
4. **Revisão** — Avalia e melhora qualidade das mensagens automaticamente
5. **CRM** — Persiste leads, status, histórico e follow-ups (JSON local + Notion)
6. **Scheduler** — Roda diariamente via PM2 cron na VPS (08:00)
7. **Dashboard** — Cockpit web de controle em `http://VPS_IP:3131`
8. **Monitor** — Chrome Extension detecta respostas de DMs

---

## Início Rápido (VPS)

```bash
# 1. Clonar e instalar
git clone <repo> && cd vendedor-ai
npm install
npx playwright install chromium

# 2. Configurar variáveis
cp .env.example .env
# → Preencher: GROQ_API_KEY, GOOGLE_API_KEY, NOTION_API_KEY, SESSION_ENCRYPTION_KEY

# 3. Fazer login no Instagram (salva sessão criptografada)
node agents/0-scraper.js login

# 4. Testar scraper
node agents/0-scraper.js diag

# 5. Rodar autopilot (teste com 5 leads)
node agents/10-autopilot.js "automacao n8n" 5

# 6. Subir tudo com PM2
pm2 start deploy/ecosystem.config.js
pm2 save
```

---

## Estrutura de Arquivos

```
vendedor-ai/
├── agents/              ← Módulos do sistema (0-14)
│   ├── 0-scraper.js     ← Playwright scraper Instagram
│   ├── 1-analyzer.js    ← IA scoring e classificação (Groq)
│   ├── 2-copywriter.js  ← IA geração de DMs (Gemini)
│   ├── 3-cataloger.js   ← CRM JSON
│   ├── 4-followup.js    ← Follow-ups agendados
│   ├── 5-orchestrator.js ← CLI unificado (comando central)
│   ├── 6-scout.js       ← Gerenciar nichos e hashtags
│   ├── 7-crm.js         ← Operações CRM
│   ├── 7-reviewer.js    ← Revisão de qualidade das DMs
│   ├── 8-dashboard.js   ← Dashboard web (porta 3131)
│   ├── 9-notion-sync.js ← Sync bidirecional Notion
│   ├── 10-autopilot.js  ← Pipeline completo (principal)
│   ├── 11-learner.js    ← Aprendizado contínuo
│   ├── 12-tracker.js    ← Métricas e tracking
│   ├── 13-nicho-ai.js   ← Criação automática de nichos
│   ├── 13-nicho-manager.js ← Gerenciador de nichos
│   └── 14-scheduler.js  ← Cron scheduler via dashboard
│
├── config/
│   ├── database.js          ← AutopilotDB (config JSON)
│   ├── session-security.js  ← AES-256-GCM para sessões
│   ├── nichos-config.json   ← Nichos padrão do sistema
│   └── copywriting-templates.json ← Templates de DM
│
├── chrome-extension/    ← Extensão Chrome (monitor de DMs)
│   ├── manifest.json
│   ├── background.js    ← Service worker + webhook
│   ├── content.js       ← Monitor de mensagens
│   ├── popup.html       ← Interface da extensão
│   └── icons/
│
├── deploy/              ← Scripts de VPS
│   ├── ecosystem.config.js  ← PM2 (dashboard + autopilot + notion-sync)
│   ├── deploy.sh            ← Deploy automatizado
│   └── setup-vps.sh         ← Setup inicial da VPS
│
├── public/              ← Dashboard frontend HTML
│   └── dashboard.html
│
├── data/                ← Dados de runtime (gitignored)
│   ├── crm/             ← CRM JSON (leads-database.json)
│   ├── leads/           ← Análises individuais (_analysis.json)
│   ├── mensagens/       ← DMs geradas (_mensagens.json)
│   ├── scout/           ← Filas do autopilot
│   ├── session/         ← Sessão Instagram (NUNCA commitar)
│   └── relatorios/      ← Relatórios de performance
│
├── docs/                ← Documentação técnica
│   ├── architecture.md  ← Arquitetura completa
│   ├── vps-deploy.md    ← Guia de deploy na VPS
│   ├── security.md      ← Políticas de segurança
│   ├── autopilot.md     ← Manual do autopilot
│   └── autopilot-setup.md ← Setup do autopilot
│
├── logs/                ← Logs de runtime (gitignored)
├── .env.example         ← Template de configuração
├── .gitignore
├── CLAUDE.md            ← Instruções para IA (system prompt)
├── package.json
└── README.md            ← Este arquivo
```

---

## Comandos Principais

```bash
# Orchestrator (comando central)
node agents/5-orchestrator.js help

# Autopilot (pipeline completo)
node agents/10-autopilot.js "nicho descricao" 20

# Dashboard
node agents/8-dashboard.js
# → http://localhost:3131

# Criar novo nicho com IA
node agents/13-nicho-ai.js "coaches de emagrecimento"

# CRM
node agents/7-crm.js list
node agents/7-crm.js stats

# Notion sync
node agents/9-notion-sync.js sync

# PM2 (VPS)
pm2 start deploy/ecosystem.config.js
pm2 status
pm2 logs vendedor-autopilot
```

---

## Produtos que o sistema vende

| Produto | Tipo | Preço |
|---|---|---|
| Lead Normalizer API | SaaS recorrente | $0–$199/mês (USD) |
| Landing Page Premium Dark Mode | Serviço único | R$1.497–R$5.997 |

---

## Roadmap de Addons

| Addon | Descrição | Status |
|---|---|---|
| **Base** | Scraper + Analyzer + Copywriter + CRM + Notion | ✅ Produção |
| **AutoSend** | Envio automático de DMs via Playwright na VPS | 🔨 Em desenvolvimento |
| **MultiPlatform** | LinkedIn DMs | 📋 Backlog |
| **Analytics Pro** | Dashboard avançado com funil de conversão | 📋 Backlog |
| **WhiteLabel** | Configuração para vender para clientes | 📋 Backlog |

---

## Segurança

- Sessões Instagram: `AES-256-GCM` (nunca commitar `data/session/`)
- Limite diário: 15–20 DMs para evitar ban
- Delays aleatórios: 1.5–3.5s entre requests
- Fingerprint real: Playwright com user-agent e timezone do BR

> Ver `docs/security.md` para políticas completas.

---

## Documentação

- [Arquitetura completa](docs/architecture.md)
- [Deploy na VPS](docs/vps-deploy.md)
- [Manual do Autopilot](docs/autopilot-setup.md)
- [Segurança](docs/security.md)
