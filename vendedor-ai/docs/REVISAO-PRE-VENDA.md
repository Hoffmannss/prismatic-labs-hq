# REVISÃO PRÉ-VENDA — VENDEDOR AI v3.0
## Diagnóstico Completo + Próximos Passos + Requisitos Legais

> **Data:** 23 de março de 2026 | **Status:** Pré-vendas (0 clientes pagantes)

---

## PARTE 1 — ESTADO TÉCNICO DO PRODUTO

### O que funciona (confirmado em código)

| Módulo | Arquivo | Status | Notas |
|--------|---------|--------|-------|
| GMB Scraper | `0-gmb-scraper.js` | ✅ Funcional | Busca Maps, extrai IG. Fixes de tel/handles commitados |
| Instagram Scraper | `0-scraper.js` | ✅ Funcional | Playwright + sessão criptografada |
| Analyzer | `1-analyzer.js` | ✅ Funcional | Groq Llama 3.3 70B |
| Vision | `1b-vision.js` | ✅ Funcional | Gemini Flash — análise de imagens |
| Copywriter | `2-copywriter.js` | ✅ Funcional | Groq — gera DMs personalizadas |
| Cataloger (CRM) | `3-cataloger.js` | ✅ Funcional | Adiciona leads ao CRM JSON |
| Reviewer | `7-reviewer.js` | ✅ Funcional | Revisa qualidade da DM |
| Dashboard | `8-dashboard.js` | ✅ Funcional | Express + UI premium |
| Notion Sync | `9-notion-sync.js` | ✅ Funcional | Sync bidirecional CRM ↔ Notion |
| Autopilot | `10-autopilot.js` | ✅ Funcional | GMB mode padrão, cron 8h |
| Learner | `11-learner.js` | ✅ Funcional | Migrado para Groq, token-limited |
| Orchestrator | `5-orchestrator.js` | ✅ Funcional | Coordena pipeline completo |
| Nicho AI | `13-nicho-ai.js` | ✅ Funcional | Detecta/cria nichos |

### O que NÃO funciona / está desativado

| Módulo | Arquivo | Status | Decisão |
|--------|---------|--------|---------|
| Sender (DM) | `0-sender.js` | ❌ DESATIVADO | Risco de ban. Removido do PM2. Futuro via Meta API |

### Nunca foi testado de ponta a ponta

**FATO CRÍTICO:** Nunca vimos um ciclo completo rodando sem erro:
> GMB encontra lead → Analyzer pontua → Copywriter gera DM → Entra no CRM → Dashboard mostra

O último teste (GMB com 5 leads) teve analyzer falhando 5/5 por quota Groq esgotada. Precisamos de **1 run limpo com quota disponível** antes de poder demonstrar para qualquer cliente.

---

## PARTE 2 — INCONSISTÊNCIAS ENCONTRADAS

### CRÍTICAS (afetam venda/demonstração)

**1. Dashboard ainda tem UI e endpoints do Sender**
- `8-dashboard.js` linhas 393-414: endpoints `/api/sender/config`, `/api/sender/start` ativos
- `dashboard.html`: botão "Enviar DMs", ícone sender nos logs, referência a `/api/sender/start`
- **Problema:** Cliente vai ver botão de "enviar DM automática" que não devemos usar
- **Ação:** Remover ou esconder endpoints/UI do sender, substituir por botão "Copiar DM"

**2. PM2 autopilot usa argumento legado**
- `ecosystem.config.js` linha 42: `args: process.env.AUTOPILOT_NICHO || 'api-automacao'`
- O autopilot agora lê config do dashboard (search_mode, search_city, nicho)
- O argumento `'api-automacao'` não faz sentido com GMB mode
- **Ação:** Remover o `args` do ecosystem — deixar vazio para ler do dashboard

**3. Nenhum run end-to-end validado**
- **Ação:** Rodar teste manual amanhã com quota limpa

### IMPORTANTES (afetam profissionalismo)

**4. `package.json` desatualizado**
- Versão: `"2.0.0"` — deveria ser `"3.0.0"` (GMB mode é v3)
- Dependência `apify-client` listada mas possivelmente não usada
- `@google/generative-ai` ainda listada — confirmar se vision usa

**5. Arquivos mortos na raiz do projeto**
- 4x `.tar.gz` de patches antigos (~86 KB)
- 4x scripts de deploy antigos (`deploy-vps.sh`, `deploy-vps-chunks.txt`, etc.)
- 3x docs avulsos na raiz (`ANALISE-DASHBOARD-UX.md`, `AVALIACAO-RAFAEL-MENDES.md`, `PROMPT-TESTE-RIGOROSO.md`)
- 1x `patch-dashboard-v2.py` — script Python solto
- **Ação:** Mover para `docs/` ou remover

**6. Logs possivelmente não ignorados pelo git**
- Diretório `logs/` pode estar rastreado
- **Ação:** Verificar `.gitignore`

---

## PARTE 3 — O QUE FALTA PARA A PRIMEIRA VENDA

### BLOCO A — Técnico (máximo 2 dias de trabalho)

| # | Tarefa | Prioridade | Tempo | Detalhe |
|---|--------|-----------|-------|---------|
| 1 | Git pull na VPS | P0 | 5 min | Aplicar fixes de telefone + handles |
| 2 | Remover args do autopilot no PM2 | P0 | 5 min | Ecosystem.config.js |
| 3 | 1 run limpo end-to-end | P0 | 30 min | Amanhã com quota resetada |
| 4 | Esconder sender da UI | P1 | 1h | Dashboard: remover botão enviar DM, trocar por "Copiar mensagem" |
| 5 | Limpar raiz do projeto | P2 | 15 min | Remover .tar.gz, scripts antigos |
| 6 | Atualizar package.json v3.0.0 | P2 | 5 min | Versão + limpar dependências |

### BLOCO B — Produto/Experiência do Cliente

| # | Tarefa | Prioridade | Tempo | Detalhe |
|---|--------|-----------|-------|---------|
| 7 | Fluxo "Copiar DM" no dashboard | P0 | 2h | Botão que copia a mensagem para clipboard. Ao copiar, marca como "copiada" |
| 8 | Onboarding mínimo | P1 | 2h | 1 página ou vídeo Loom de 3 min: "como usar o dashboard" |
| 9 | Configurar nichos do cliente | P1 | 30 min | Dashboard precisa permitir trocar nicho/cidade facilmente |
| 10 | Relatório semanal básico | P2 | 3h | Email ou página: "X leads encontrados, Y DMs geradas, Z copiadas" |

### BLOCO C — Comercial/Legal (ver Parte 4 abaixo)

| # | Tarefa | Prioridade | Tempo | Detalhe |
|---|--------|-----------|-------|---------|
| 11 | Política de Privacidade | P0 | 2h | Template LGPD — publicar no site/dashboard |
| 12 | Termos de Serviço | P0 | 2h | Cláusulas de responsabilidade, cancelamento, dados |
| 13 | Contrato simples | P0 | 2h | 1-2 páginas: o que entrega, preço, prazo, cancelamento |
| 14 | Definir oferta e preço | P0 | 1h | Tier, features, preço — testar com primeiro beta |
| 15 | MEI/CNAE | P1 | 1h | Abrir MEI gov.br ou confirmar CNAE com contador |
| 16 | Sistema de cobrança | P1 | 1h | Pix manual ou link de pagamento (ex: Stripe, Asaas, Mercado Pago) |

---

## PARTE 4 — REQUISITOS LEGAIS E DOCUMENTAÇÃO

### O que é OBRIGATÓRIO por lei

**1. Política de Privacidade (LGPD)**
O Vendedor AI coleta dados públicos de Instagram e Google Maps. Mesmo sendo públicos, a LGPD exige:
- Declarar quais dados coleta (nome, bio, email, telefone, posts públicos)
- Para qual finalidade (prospecção comercial a pedido do cliente)
- Onde armazena (VPS Hostinger, localização do servidor)
- Por quanto tempo mantém
- Como o titular pode solicitar exclusão
- Contato do responsável

**2. Base legal para tratamento**
Para dados públicos de redes sociais, a base legal mais adequada é **legítimo interesse** (Art. 7, IX da LGPD). Mas é importante documentar a análise de legítimo interesse (LIA) — mesmo que simples.

**3. CNAE correto**
Para SaaS de prospecção, os CNAEs mais adequados:
- `6202-3/01` — Desenvolvimento e licenciamento de programas de computador customizáveis
- `6204-0/00` — Consultoria em tecnologia da informação
- Ambos são elegíveis para MEI (até R$81k/ano) e Simples Nacional

### O que é RECOMENDADO (não obrigatório, mas protege)

**4. Termos de Serviço**
Cláusulas essenciais:
- Descrição do serviço (o que entrega e o que NÃO entrega)
- **Cláusula de responsabilidade compartilhada:** "O cliente é responsável por conformidade com os termos de uso das plataformas de terceiros (Instagram, Google)"
- Cancelamento e reembolso
- Limites de responsabilidade (sem garantia de resultados de vendas)
- Disponibilidade (não é SLA 99.9% — é beta)

**5. Contrato com Cliente**
Modelo simples, 1-2 páginas:
- Partes (Prismatic Labs x Cliente)
- Escopo do serviço
- Preço e forma de pagamento
- Prazo e renovação
- Responsabilidades de cada parte
- Dados: Prismatic = operador, Cliente = controlador
- Cancelamento com 30 dias de aviso

**6. Cláusula sobre Scraping**
Precisa estar MUITO claro:
> "O sistema coleta dados disponíveis publicamente em plataformas de terceiros. A Prismatic Labs não garante acesso ininterrupto a estas plataformas e não se responsabiliza por alterações nos termos de uso de terceiros."

### O que NÃO precisa agora

- ❌ Registro de software no INPI (proteção automática por direito autoral)
- ❌ DPO/Encarregado formal (obrigatório só para empresas maiores)
- ❌ RIPD formal (relatório de impacto — só para processamento de alto risco)
- ❌ Advogado especializado (templates + contador resolvem para o beta)

### Tributação prática

**MEI:** Pode faturar até R$81k/ano (~R$6.750/mês). Para 3-5 clientes a R$497, está dentro. Custo fixo: ~R$70/mês (DAS).

**Nota Fiscal:** NFS-e (Nota Fiscal de Serviço eletrônica) emitida pelo portal da prefeitura. Cada município tem seu sistema.

**Cobrança:** Para os primeiros clientes, Pix + recibo manual é suficiente. Depois migrar para plataforma (Asaas, Stripe, Mercado Pago).

---

## PARTE 5 — RISCOS REAIS

| Risco | Probabilidade | Impacto | Defesa |
|-------|--------------|---------|--------|
| Meta/Google bloquear scraping | Média | Alto | Cláusula contratual + migração futura para API oficial |
| Groq quota estourar diariamente | Alta | Médio | Pagar tier Dev (~R$60/mês) com primeiro cliente |
| Cliente espera DM automática | Alta | Alto | Deixar claro na venda: "geramos a DM, você envia" |
| VPS cair / PM2 crashar | Baixa | Médio | Monitoramento PM2 + restart automático |
| DM gerada com qualidade ruim | Média | Alto | Reviewer + aprovação manual no dashboard |
| Lead duplicado / irrelevante | Baixa | Baixo | Deduplicação CRM + filtro de followers |

---

## PARTE 6 — PLANO DE AÇÃO PARA PRIMEIRA VENDA

### Semana 1 (24-28 março) — VALIDAÇÃO TÉCNICA

| Dia | Ação | Critério de sucesso |
|-----|------|---------------------|
| Seg 24 | Git pull VPS + remover args PM2 + pm2 restart | Dashboard acessível em 72.61.33.60:3131 |
| Ter 25 | Run autopilot 8h — acompanhar logs ao vivo | ≥3 leads com DM gerada sem erro |
| Ter 25 | Verificar DMs no dashboard — são naturais? Fariam sentido enviar? | ≥2 DMs aprovadas subjetivamente |
| Qua 26 | Esconder sender da UI + botão "Copiar DM" | Dashboard sem referência a envio automático |
| Qui 27 | Segundo run + validar com nicho diferente | Funcionando para ≥2 nichos |
| Sex 28 | Limpar raiz do projeto + atualizar versão | Repo limpo e profissional |

### Semana 2 (31 mar - 4 abr) — DOCUMENTAÇÃO E OFERTA

| Dia | Ação | Critério de sucesso |
|-----|------|---------------------|
| Seg 31 | Escrever Política de Privacidade | Publicada no dashboard ou página |
| Seg 31 | Escrever Termos de Serviço | Documento PDF/HTML pronto |
| Ter 1 | Criar contrato simples para cliente beta | Template 1-2 páginas |
| Qua 2 | Definir oferta beta: preço, features, limites | 1 tier claro com preço definido |
| Qui 3 | Criar onboarding mínimo (Loom ou doc) | Cliente consegue usar sozinho |
| Sex 4 | Abrir MEI no gov.br + configurar cobrança | Pode emitir recibo/NFS-e |

### Semana 3 (7-11 abr) — PRIMEIRA VENDA

| Dia | Ação | Critério de sucesso |
|-----|------|---------------------|
| Seg 7 | Listar 5 prospects (salões/consultórios em SP que precisam de clientes) | 5 nomes com Instagram |
| Ter 8 | Abordar 3 prospects com proposta | DM ou WhatsApp enviado |
| Qua-Sex | Follow-up + fechar beta | ≥1 cliente em teste gratuito de 7 dias |

---

## PARTE 7 — PROPOSTA DE OFERTA BETA

**Nome:** Vendedor AI — Piloto Automático de Leads

**Proposta de valor (1 frase):**
> "A gente encontra seus próximos clientes no Google Maps e Instagram, analisa o perfil, e escreve uma mensagem personalizada pra você enviar. Você só precisa copiar e mandar."

**Tier Beta:**
- R$297/mês (desconto beta — preço normal R$497)
- Até 10 leads qualificados por dia
- DMs personalizadas prontas para enviar
- Dashboard com CRM integrado
- 1 nicho + 1 cidade
- Suporte via WhatsApp

**O que o cliente recebe todo dia:**
1. Acorda e abre o dashboard
2. Vê 5-10 leads novos com DM escrita
3. Lê a DM, aprova, copia
4. Cola no Instagram Direct e envia
5. Registra resposta no dashboard

**Compromisso beta:**
- 30 dias de teste com preço reduzido
- Feedback semanal (5 min call ou WhatsApp)
- Cancelamento sem multa com 7 dias de aviso

---

## MÉTRICAS DE SUCESSO

```
KPI: Run end-to-end limpo         | meta: ≥3 DMs geradas | prazo: 25/03
KPI: Docs legais completos         | meta: 3 documentos   | prazo: 01/04
KPI: Oferta beta definida          | meta: 1 tier         | prazo: 02/04
KPI: Primeiro prospect abordado    | meta: 3 conversas    | prazo: 08/04
KPI: Primeiro cliente beta ativo   | meta: 1 cliente      | prazo: 15/04
```

---

*Documento gerado pela Prismatic Labs. Revisar após cada milestone.*
