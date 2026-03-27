# 🚀 Prismatic Labs — Roadmap da Empresa Automática

> **Objetivo final:** Uma empresa 100% digital, operada por agentes de IA especializados,
> capaz de funcionar sem presença humana ativa por 1 ano ou mais — gerando receita recorrente,
> adquirindo clientes, entregando produtos e evoluindo autonomamente.

**Fundador:** Daniel Hoffmann | **Empresa:** Prismatic Labs
**Início:** Dezembro 2025 | **Revisado:** Março 2026

---

## Estrutura do Monorepo

```
prismatic-labs-hq/
├── vendedor-ai/          → SaaS de prospecção Instagram com IA
├── apps/
│   ├── lead-normalizer-api/   → API de normalização e deduplicação de leads
│   ├── landing-captacao/      → Landing page de captação de orçamentos
│   └── automacao-leads/       → Produto de serviço: automação em 24h
├── infrastructure/
│   ├── agents/                → Exército de IAs internos (OpenClaw + Claude)
│   ├── electron/              → App desktop do Vendedor AI
│   └── mobile/                → App mobile (futuro)
├── assets/
│   ├── instagram-posts/       → Posts HTML dark mode para Instagram
│   └── instagram-screenshots/ → Templates de carrossel e reels
├── strategy/
│   ├── mercado/               → Análise de mercado e nichos
│   ├── progress/              → Progress tracker semanal
│   └── roadmap-2026/          → Estratégia executiva 2026
└── docs/                      → Documentação técnica e operacional
```

---

## Linha do Tempo

---

### ✅ FASE 0 — GENESIS
**Período:** Dezembro 2025 — Janeiro 2026
**Status:** CONCLUÍDA

A fundação. Tudo começa aqui.

**O que foi construído:**
- Criação da Prismatic Labs como entidade e marca
- Definição da visão: automações de IA práticas e vendáveis
- Escolha do stack: Node.js, Playwright, Groq, Gemini, VPS Hostinger, Notion
- Setup inicial de infraestrutura: GitHub, VPS, PM2, domínio
- Primeiros repositórios criados e estruturados
- Definição dos 2 produtos iniciais: Vendedor AI + Lead Normalizer API

---

### ✅ FASE 1 — VENDEDOR AI: CONSTRUÇÃO
**Período:** Janeiro 2026 — Fevereiro 2026
**Status:** CONCLUÍDA

O produto principal toma forma. De zero a pipeline funcional.

**O que foi construído:**
- **14 agentes implementados** em `agents/0` a `agents/14`:
  - `0-scraper` — scraping de perfis Instagram via Playwright headless
  - `1-analyzer` — scoring de leads com Groq/Llama 3.3-70B
  - `2-copywriter` — geração de DMs personalizadas com Gemini
  - `3-cataloger` — operações CRM em JSON
  - `4-followup` — follow-ups agendados (dia 3, 7, 14)
  - `5-orchestrator` — CLI unificado, ponto de entrada
  - `6-scout` — gerenciador de nichos e hashtags
  - `7-crm` / `7-reviewer` — CRM ops + revisão de qualidade das DMs
  - `8-dashboard` — Dashboard web CRM (porta 3131, 2000+ linhas)
  - `9-notion-sync` — Sync bidirecional CRM ↔ Notion
  - `10-autopilot` — Pipeline completo: scrape → analyze → copy → crm → notion
  - `11-learner` — Aprendizado com resultados anteriores
  - `12-tracker` — Métricas e conversão
  - `13-nicho-ai` / `13-nicho-manager` — Criação dinâmica de nichos via IA
  - `14-scheduler` — Cron integrado ao dashboard
- **Chrome Extension** — monitora respostas de DMs no Instagram
- **PM2 ecosystem** — 3 processos gerenciados (dashboard + autopilot + notion-sync)
- **Notion CRM** — sync bidirecional com pipeline visual
- **Segurança** — sessão Instagram criptografada AES-256-GCM
- **Deploy VPS** — scripts de setup, deploy e ecosystem config
- `config/negocio-config.js` — sistema de configuração central por cliente

---

### 🔨 FASE 2 — BETA ESTÁVEL
**Período:** Março 2026
**Status:** EM ANDAMENTO

Bugs críticos eliminados. Produto pronto para o primeiro cliente.

**Concluído:**
- [x] Fix `negocio-config.js` — agora lê `business-profile.json` corretamente
- [x] Fix `enrichLeads()` — mapeamento de campos PT/EN normalizado
- [x] Fix `agents/3-cataloger.js` — campo `produto_sugerido` correto
- [x] Fix `agents/2-copywriter.js` — refs `isAPI` removidas, modo genérico funcional
- [x] Fix `agents/7-reviewer.js` — contexto genérico via negocio-config
- [x] Dashboard: botão "Enviar DM" → "Copiar DM" (clipboard)
- [x] Backend: rotas `/api/sender/*` desativadas (403) — risco de ban eliminado
- [x] Gemini 1.5 Flash → Gemini 2.5 Flash (modelo atualizado)
- [x] Limpeza de arquivos temporários e reorganização de docs

**Em aberto (bloqueadores para primeiro contrato):**
- [ ] Salvar `config/business-profile.json` na VPS (5 min — abrir dashboard na VPS e preencher)
- [ ] Limpar CRM atual (leads com DMs em modo FALLBACK)
- [ ] Retry logic para Groq 429 (rate limit em produção)
- [ ] Validar ciclo completo com negócio configurado: scrape → DM no modo correto

---

### ⏳ FASE 3 — PRIMEIROS CONTRATOS
**Período:** Abril — Maio 2026
**Status:** PLANEJADA

A empresa começa a receber. Validação no mercado real.

**O que construir:**
- [ ] Arquitetura multi-tenant fase 1 (diretório por cliente em `data/clients/`)
- [ ] Onboarding de cliente: guia de 5 passos para configurar perfil do negócio
- [ ] Script de diagnóstico: `node agents/diagnostic.js` — verifica tudo antes de ativar
- [ ] Upgrade Groq pay-as-you-go ($5 de crédito para começar)
- [ ] Vídeo demo de 2 minutos para pitch
- [ ] Precificação definida e página de vendas
- [ ] Primeiros 3 clientes beta fechados (R$497-797/mês cada)

**Meta:**
```
KPI: clientes_pagantes | meta: 3 | prazo: 30 de Maio 2026
KPI: receita_mensal    | meta: R$1.800 | prazo: 31 de Maio 2026
```

---

### ⏳ FASE 4 — ESCALA DO VENDEDOR AI
**Período:** Junho — Agosto 2026
**Status:** PLANEJADA

Produto estável. Escalando para 15+ clientes sem degradar qualidade.

**O que construir:**
- [ ] Multi-tenant fase 2: Supabase com Row Level Security
- [ ] Lead Normalizer API em produção (produto #2 ativado)
- [ ] Sistema de billing simples (Stripe ou Pix recorrente via n8n)
- [ ] Painel de saúde do sistema: uptime, taxa de sucesso, erros por cliente
- [ ] Addon AutoSend via API Oficial Meta (sem risco de ban)
- [ ] Suporte a múltiplas plataformas: LinkedIn DMs (addon)
- [ ] Upgrade VPS para 2+ cores e 4GB RAM (Playwright com múltiplos clientes)

**Meta:**
```
KPI: clientes_pagantes | meta: 15  | prazo: 31 de Agosto 2026
KPI: receita_mensal    | meta: R$9.000 | prazo: 31 de Agosto 2026
KPI: custo_ai_pct      | meta: <1% da receita | prazo: contínuo
```

---

### ⏳ FASE 5 — EXÉRCITO DE IAs: NÍVEL 1
**Período:** Agosto — Outubro 2026
**Status:** PLANEJADA

A empresa começa a operar com agentes internos especializados.
Você delega — os agentes executam.

**Arquitetura dos Agentes Internos:**

```
VOCÊ (Telegram)
     │
     ▼
[MAESTRO — Agente Orquestrador]
     │ Recebe tarefas, delega, monitora
     │
     ├──→ [CODER]      — OpenClaw + GitHub + terminal + VPS
     │         Cargo: Engenheiro de software sênior
     │         Entrega: código commitado + PR + deploy
     │
     ├──→ [PLANNER]    — Claude Code + Notion + ROADMAP
     │         Cargo: COO / Estrategista operacional
     │         Entrega: sprint semanal, prioridades, análises
     │
     ├──→ [MARKETER]   — Claude + n8n + Instagram + posts
     │         Cargo: Head de Marketing
     │         Entrega: posts, copies, campanhas
     │
     ├──→ [VENDEDOR]   — Vendedor AI (já existe)
     │         Cargo: SDR / Prospecção 24/7
     │         Entrega: leads qualificados no CRM
     │
     └──→ [RESEARCHER] — Claude + WebSearch + Notion
               Cargo: Analista de inteligência de mercado
               Entrega: briefings, análise de concorrentes, nichos
```

**O que construir:**
- [ ] Instalar OpenClaw na VPS com configuração Telegram
- [ ] CLAUDE.md específico para cada agente (identidade + ferramentas + restrições)
- [ ] Notion como memória compartilhada entre agentes
- [ ] n8n como orquestrador de handoffs entre agentes
- [ ] Primeiro agente interno funcional: CODER (recebe task via Telegram, commita)
- [ ] Protocolo de handoff: como um agente passa output para o próximo

**Meta:**
```
KPI: agentes_operacionais | meta: 3 (Coder + Planner + Vendedor) | prazo: Out 2026
KPI: tarefas_sem_interacao | meta: 70% das tasks | prazo: Out 2026
```

---

### ⏳ FASE 6 — EMPRESA AUTOMÁTICA: NÍVEL 1
**Período:** Outubro — Dezembro 2026
**Status:** PLANEJADA

A empresa opera. Você supervisiona, não executa.

**Estado alvo:**
- Vendedor AI com 30+ clientes, gerenciado pelo agente PLANNER
- Lead Normalizer API com clientes recorrentes
- CODER faz deploys semanais sem você tocar no código
- MARKETER posta no Instagram 3x/semana autonomamente
- VENDEDOR prospecta novos clientes 24/7 para os próprios produtos da Prismatic
- Você recebe relatório diário às 9h no Telegram — intervém só quando necessário

**O que construir:**
- [ ] Dashboard unificado de status da empresa (todos os agentes, todos os produtos)
- [ ] Sistema de alertas: agente notifica você APENAS quando há decisão humana necessária
- [ ] Protocolo de rollback: se agente fizer algo errado, como reverter automaticamente
- [ ] Primeira versão do White-Label: vender o sistema de agentes para outras empresas
- [ ] Documentação de operação autônoma (como cada agente toma decisão)

**Meta:**
```
KPI: receita_mensal     | meta: R$20.000  | prazo: Dez 2026
KPI: horas_suas_semana  | meta: <10h/semana | prazo: Dez 2026
KPI: uptime_operacional | meta: 99%       | prazo: contínuo
```

---

### 🎯 FASE 7 — EMPRESA AUTOMÁTICA: NÍVEL FINAL
**Período:** 2027+
**Status:** VISÃO

**A empresa existe sem você.**

```
[Vendedor AI — 50+ clientes]         → Gerenciado por PLANNER + CODER
[Lead Normalizer API]                 → Self-service, suporte por IA
[White-Label para agências]           → Canal de revenda automatizado
[Novos produtos lançados por agentes] → CODER + MARKETER trabalham juntos
[Instagram / Marketing]              → MARKETER opera 24/7
[Suporte ao cliente]                  → Agente de suporte via Telegram/WhatsApp
[Finanças / Relatórios]               → Agente financeiro reporta mensalmente
```

**Critério de sucesso:**
> Você fica fora por 6 meses. A empresa continua faturando, adquirindo clientes,
> entregando produtos e evoluindo. Você volta e encontra tudo funcionando —
> possivelmente melhor do que quando saiu.

**Meta:**
```
KPI: receita_mensal    | meta: R$50.000+ | prazo: Dez 2027
KPI: clientes_ativos   | meta: 50+       | prazo: Dez 2027
KPI: autonomia         | meta: funcionar 365 dias sem intervenção humana
```

---

## Stack da Empresa Automática

| Camada | Ferramenta | Função |
|---|---|---|
| Agentes | OpenClaw | Execução autônoma, Heartbeat, persistência |
| Agentes | Claude Code `/loop` | Tasks agendadas, codebase-aware |
| Interface | Telegram Bot | Centro de comando — entrada e saída |
| Memória | Notion | Base de conhecimento compartilhada entre agentes |
| Orquestração | n8n | Handoffs automáticos entre agentes |
| Infra | VPS Hostinger | Tudo roda aqui — agentes + produtos |
| Processos | PM2 | Gerenciamento e auto-restart |
| Banco | JSON → Supabase | CRM multi-tenant com isolamento |
| IA Rápida | Groq / Llama 3.3-70B | Análise e scoring (baixo custo) |
| IA Criativa | Gemini 2.5 Flash | Copy, posts, conteúdo |
| IA Estratégica | Claude Sonnet/Haiku | Decisões complexas dos agentes internos |

---

## Repositórios

### Monorepo Principal
`prismatic-labs-hq` — Tudo relacionado à Prismatic Labs vive aqui.

### A Migrar para o Monorepo
| Repositório | Destino no Monorepo | Prioridade |
|---|---|---|
| `prismatic-lead-normalizer-api` | `apps/lead-normalizer-api/` | Alta |
| `prismatic-landing-captacao` | `apps/landing-captacao/` | Média |
| `automacao-leads-prismatic` | `apps/automacao-leads/` | Média |
| `agente-pessoal-ia` | `infrastructure/agents/` | Alta (Fase 5) |
| `prismatic-instagram-posts` | `assets/instagram-posts/` | Baixa |
| `prismatic-posts-screenshots` | `assets/instagram-screenshots/` | Baixa |
| `prismatic-labs-2026` | `strategy/roadmap-2026/` | Baixa |
| `prismatic-hq` | Arquivar (versão antiga de hq) | — |

### Separados (Não Prismatic Labs)
| Repositório | Situação |
|---|---|
| `sushi-dk-premium-sj` | Manter separado (negócio diferente) |
| `Solo-Life` / `rpg-vida` | Manter separado (projeto pessoal) |
| `guia-completo-abrir-empresa` | Manter separado (recurso público) |
| `etsy-templates-business` | Considerar arquivar |
| `dn-institute` | Fork irrelevante — pode deletar |

---

## Princípios de Arquitetura

1. **Cada agente é independente** — tem sua identidade, ferramentas e responsabilidades claras. Pode ser substituído ou atualizado sem afetar os outros.

2. **Memória é compartilhada, execução é isolada** — Notion é o cérebro coletivo. Cada agente lê e escreve lá, mas roda em seu próprio processo.

3. **Telegram é a interface de comando** — você não abre terminal, não faz deploy manual. Envia mensagem, recebe resultado.

4. **Tudo que pode ser automatizado, será** — nenhuma tarefa repetitiva permanece manual por mais de um sprint.

5. **Segurança por padrão** — dados de clientes isolados por client_id, sessões criptografadas, sem secrets no git.

6. **Receita primeiro, otimização depois** — um produto vendido supera 10 features que ninguém usa.

---

*Última atualização: Março 2026*
*Próxima revisão: Após fechar os primeiros 3 contratos*
