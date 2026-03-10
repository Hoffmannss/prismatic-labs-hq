# Arquitetura do Sistema — Prismatic Labs Vendedor AI
> Versão: 2.0 | Atualizado: 2026-03-09 | Referência permanente de decisões de design

---

## 1. Visão Geral

O Vendedor AI é um sistema de prospecção automatizada focado inicialmente no Instagram.
Modelo de negócio: **sistema base + addons (DLCs)**. A Prismatic Labs usa o próprio sistema para se vender.

**Produto alvo atual:**
- Lead Normalizer API (SaaS, $29–$199/mês, USD)
- Landing Page Premium Dark Mode (serviço, R$1.497–R$5.997, pagamento único)

---

## 2. Stack Técnica

| Camada | Tecnologia | Motivo |
|---|---|---|
| Scraping | Playwright + Chromium headless | Autenticado, sem Apify, roda na VPS |
| Análise IA | Groq API / Llama 3.3-70B | Grátis, rápido, suficiente para scoring |
| Copywriting | Google Gemini 1.5 Flash | 1.500 req/dia grátis permanente |
| CRM local | JSON (leads-database.json) | Zero infra, portável, backup fácil |
| CRM visual | Notion API | Dashboard para humano, sync bidirecional |
| Dashboard | Node.js HTTP server (porta 3131) | Cockpit de controle, sem dependências pesadas |
| Extensão | Chrome Extension (MV3) | Monitor de DMs + (próximo: sender de DMs) |
| Sessão | AES-256-GCM (SessionSecurity) | Cookies criptografados em disco |

---

## 3. Arquitetura de Agentes

```
INPUT (Instagram)
       │
       ▼
[0-scraper.js]          → Coleta usernames via hashtag / perfil
       │
       ▼
[6-scout.js]            → Gerencia nichos e hashtags alvos
       │
       ▼
[13-nicho-ai.js]        → Detecta/cria nicho automaticamente via IA
       │
       ▼
[1-analyzer.js]         → Score 0-100, produto ideal, prioridade (hot/warm/cold)
       │
       ▼
[2-copywriter.js]       → 3 variações de DM personalizadas (Gemini)
       │
       ▼
[7-reviewer.js]         → Avalia qualidade, reescreve se necessário
       │
       ▼
[3-cataloger.js]        → Salva no CRM JSON, atualiza status
       │
       ▼
[9-notion-sync.js]      → Sincroniza com Notion (CRM visual)
       │
       ▼
[8-dashboard.js]        → Cockpit web (porta 3131) + API endpoints
       │
       ▼
[Chrome Extension]      → Monitora respostas + (TODO: enviar DMs da fila)
       │
       ▼
[4-followup.js]         → Follow-ups agendados (dia 3, 7, 14)
       │
       ▼
[11-learner.js]         → Aprende com resultados, melhora copywriting
       │
       ▼
[12-tracker.js]         → Tracking de métricas (taxa resposta, conversão)
```

**Orquestrador central:** `5-orchestrator.js` (CLI unificado)
**Autopilot completo:** `10-autopilot.js` (roda tudo: scrape → analyze → sync)
**Scheduler diário:** `14-scheduler.js` + `autopilot-daily.js`

---

## 4. Fluxo Diário de Operação

```
09:00 → autopilot-daily roda automaticamente
         ├─ scrapeHashtag (4 hashtags do nicho)
         ├─ scrapeProfiles (enriquece perfis)
         ├─ filtra por keywords da bio
         ├─ analyze + copywrite + review (N leads)
         ├─ notion-sync
         └─ learner update

Manhã → followup (envia follow-ups pendentes)
Dia   → Chrome Extension envia DMs da fila
Noite → relatorio + ajuste de nicho
```

---

## 5. Estrutura de Dados

### Lead (CRM)
```json
{
  "username": "string",
  "status": "novo|contatado|respondeu|em_negociacao|fechado|perdido",
  "prioridade": "hot|warm|cold",
  "score": 0-100,
  "nicho": "string",
  "analise": { ... },          // output do 1-analyzer.js
  "mensagem_gerada": true,
  "followups_enviados": 0,
  "proximo_followup": "ISO date",
  "historico": [{ evento, timestamp, dados }],
  "notas": []
}
```

### Nicho (config)
```json
{
  "nome": "string",
  "produto": "Lead Normalizer API | Landing Page Premium",
  "hashtags": ["#tag1", ...],
  "keywords_bio": ["palavra1", ...],
  "dor_principal": "string",
  "abordagem": "string"
}
```

---

## 6. Infraestrutura — VPS Hostinger

**Deploy:** VPS Hostinger (Ubuntu) | PM2 como process manager

```
PM2 Apps:
  vendedor-dashboard    → 8-dashboard.js     (sempre online, porta 3131)
  vendedor-autopilot    → 10-autopilot.js    (cron: 0 8 * * * — 08h diário)
  vendedor-notion-sync  → 9-notion-sync.js   (cron: 0 */2 * * * — cada 2h)
```

**IMPORTANTE:** A Chrome Extension roda no navegador do USUÁRIO (local), não na VPS.
O **envio de DMs** será via Playwright headless na VPS (mesmo mecanismo do scraper).

### Estratégia de Envio de DMs na VPS (AutoSend)

A extensão Chrome é para monitoramento de respostas (local). O envio é via Playwright na VPS:

```
Dashboard → POST /api/dm-queue (enfileira DM)
              ↓
        agents/0-sender.js (novo módulo)
              ↓
        Playwright abre instagram.com/direct/new
        → digita username
        → digita mensagem com delays humanizados (50-150ms/char)
        → envia
        → confirma no dashboard (PATCH /api/leads/:username/status)
```

**Limites de segurança:**
- Máx. 20 DMs/dia (configurável)
- Delay entre DMs: 3–8 minutos (aleatório)
- Sessão compartilhada com o scraper (mesmo arquivo)
- Pause automático se detectar challenge/captcha

## 7. Segurança e Rate Limiting

- Sessão do Instagram: AES-256-GCM, chave rotacionável com `rotate-key`
- Delays aleatórios: 1.5–3.5s entre requests (multiplicador configurável via `.env`)
- `waitUntil: 'domcontentloaded'` em vez de `networkidle` (evita timeouts)
- Hashtags combinadas: `[...topSections, ...recentSections]` (fix do bug de array vazio)
- Meta diária de DMs: 20 máximo (evitar ban)
- Delays humanizados no envio: 3–8 min entre DMs, 50–150ms por caractere digitado

---

## 8. Decisões de Design (Log)

| Data | Decisão | Motivo |
|---|---|---|
| 2026-02 | Remover Apify, usar scraper próprio | Custo zero, controle total |
| 2026-02 | Groq para Analyzer, Gemini para Copywriter | Grátis, velocidade adequada |
| 2026-02 | CRM JSON local + Notion sync | Simples de manter, visual no Notion |
| 2026-03 | Chrome Extension para envio de DMs | Mais seguro que Playwright headless |
| 2026-03 | `domcontentloaded` em vez de `networkidle` | Instagram causa timeout no networkidle |
| 2026-03 | Fix: `[...top, ...recent]` em hashtags | `||` ignorava `top` quando `recent` era `[]` |

---

## 9. Addons Planejados (DLCs)

| Addon | Descrição | Status |
|---|---|---|
| **Base** | Scraper + Analyzer + Copywriter + CRM + Notion | ✅ Implementado |
| **AutoSend** | Chrome Extension com envio automático de DMs | 🔨 Em construção |
| **MultiPlatform** | Extensão para LinkedIn DMs | 📋 Backlog |
| **Analytics** | Dashboard avançado com métricas de conversão | 📋 Backlog |
| **Learner Pro** | Otimização automática de copy baseada em resultados | 📋 Backlog |
| **WhiteLabel** | Configuração para outros nichos/empresas | 📋 Backlog |

---

## 10. Variáveis de Ambiente Necessárias

```
GROQ_API_KEY          → Analyzer (Llama 3.3-70B)
GOOGLE_API_KEY        → Copywriter (Gemini 1.5 Flash)
SESSION_ENCRYPTION_KEY → Scraper (AES-256-GCM)
NOTION_API_KEY        → CRM visual
NOTION_DATABASE_ID    → ID da base no Notion
AUTOPILOT_DAILY_HOUR  → Horário do autopilot (ex: 09:00)
AUTOPILOT_DAILY_TARGET → Meta de leads/dia (recomendado: 15)
MIN_DELAY_MS / MAX_DELAY_MS → Rate limiting do scraper
```

---

## 11. Próximos Passos Críticos

1. **[URGENTE]** Implementar `sendDM()` na Chrome Extension (AutoSend addon)
2. Endpoint `/api/dm-queue` no dashboard (GET/POST fila de DMs pendentes)
3. Corrigir lead `hotmail.com` no CRM (bug de scraping — email capturado como username)
4. Documentar SETUP para clientes (guia de onboarding)
5. Criar landing page do próprio produto para venda

---

## 12. Diagnóstico de Erros Comuns

| Erro | Causa | Solução |
|---|---|---|
| Timeout no scraper | `networkidle` em vez de `domcontentloaded` | Já corrigido |
| 0 usernames retornados | Session expirada ou rate limit | `node agents/0-scraper.js login` |
| Array vazio de hashtags | Bug `||` com array vazio | Já corrigido para spread `[...]` |
| Username = email.com | Regex capturando email como username | Filtrar strings com `.` sem `@` antes |
| 429 no API | Rate limit do Instagram | Sleep 60s + retry automático |
