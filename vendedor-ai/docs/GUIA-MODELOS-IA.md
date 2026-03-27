# GUIA DE MODELOS DE IA — PRISMATIC LABS
## Plano de Evolução, Custo-Benefício e Add-ons para Clientes

> **Atualizado:** Março 2026 | **Versão:** 1.0
> *Preços em USD. Câmbio referência: ~R$5,80/USD.*
> *Confirme preços nos sites oficiais antes de fechar contratos.*

---

## ÍNDICE

1. [Panorama Atual dos Modelos](#1-panorama-atual)
2. [Comparativo de Preços por Provedor](#2-comparativo-de-preços)
3. [Análise por Tarefa do Vendedor AI](#3-análise-por-tarefa)
4. [Plano de Evolução em 4 Fases](#4-plano-de-evolução)
5. [Indicadores para Trocar de Modelo](#5-quando-trocar-de-modelo)
6. [Tabela de Add-ons para Clientes](#6-add-ons-para-clientes)
7. [Stack Recomendada por Orçamento](#7-stack-por-orçamento)
8. [Riscos e Defesas](#8-riscos-e-defesas)

---

## 1. PANORAMA ATUAL

O mercado de LLMs em março 2026 se estabilizou em **3 categorias claras**:

| Categoria | Uso Ideal | Custo Típico (1M tokens) |
|-----------|-----------|--------------------------|
| **Budget** | Volume alto, tarefas simples | $0.02 – $0.40 |
| **Mid-range** | Produção equilibrada | $0.80 – $5.00 |
| **Premium** | Qualidade máxima, raciocínio | $5.00 – $75.00 |

**Tendência relevante:** Modelos que eram "premium" em 2024 viraram "mid-range" em 2026. O Claude Haiku era $0.25, hoje está $1.00 — mas entrega qualidade que antes custava $15+. O mercado está comprimindo.

---

## 2. COMPARATIVO DE PREÇOS

### 2.1 Todos os Provedores (março 2026)

| Modelo | Provedor | Input /1M | Output /1M | Context | PTG* | Velocidade |
|--------|----------|-----------|------------|---------|------|------------|
| **Llama 4 Scout** | Groq | FREE** | FREE** | 128k | ✅ | ⚡⚡⚡ |
| **Llama 3.3 70B** | Groq | FREE** | FREE** | 128k | ✅ | ⚡⚡⚡ |
| **Llama 3.1 8B** | Groq | FREE** | FREE** | 8k | ⚠️ | ⚡⚡⚡⚡ |
| **Mistral Nemo** | Mistral | $0.02 | $0.04 | 128k | ⚠️ | ⚡⚡ |
| **Mistral Small 3.2** | Mistral | $0.07 | $0.20 | 256k | ✅ | ⚡⚡ |
| **GPT-4o-mini** | OpenAI | $0.15 | $0.60 | 128k | ✅ | ⚡⚡ |
| **Gemini 2.5 Flash-Lite** | Google | $0.10 | $0.40 | 1M | ✅ | ⚡⚡⚡ |
| **Llama 4 Maverick** | Together AI | $0.27 | $0.85 | 128k | ✅ | ⚡⚡ |
| **Gemini 2.5 Flash** | Google | $0.30 | $2.50 | 1M | ✅ | ⚡⚡⚡ |
| **Mistral Medium 3** | Mistral | $0.40 | $2.00 | 256k | ✅ | ⚡⚡ |
| **Claude 3.5 Haiku** | Anthropic | $0.80 | $4.00 | 200k | ✅✅ | ⚡⚡ |
| **Claude Haiku 4.5** | Anthropic | $1.00 | $5.00 | 200k | ✅✅ | ⚡⚡ |
| **Mistral Large** | Mistral | $2.00 | $6.00 | 256k | ✅ | ⚡ |
| **GPT-4o** | OpenAI | $2.50 | $10.00 | 128k | ✅✅ | ⚡⚡ |
| **Gemini 2.5 Pro** | Google | $1.25 | $10.00 | 1M | ✅✅ | ⚡⚡ |
| **Claude 3.5 Sonnet** | Anthropic | $3.00 | $15.00 | 200k | ✅✅ | ⚡⚡ |
| **Claude Opus 4.6** | Anthropic | $5.00 | $25.00 | 200k | ✅✅ | ⚡ |
| **o3-mini** | OpenAI | $1.00 | $4.00 | 128k | ✅ | ⚡ |
| **o1** | OpenAI | $15.00 | $60.00 | 128k | ✅ | lento |

> *PTG = Qualidade em Português: ✅✅ excelente / ✅ boa / ⚠️ aceitável*
> ***FREE = limite de tokens/dia no free tier (ver abaixo)*

### 2.2 Free Tiers Disponíveis (março 2026)

| Provedor | Modelo | Limite Diário | RPM | Cartão? |
|----------|--------|---------------|-----|---------|
| Groq | Llama 4 Scout | 500.000 tokens | 30 | ❌ Não |
| Groq | Llama 3.3 70B | 100.000 tokens | 30 | ❌ Não |
| Groq | Llama 3.1 8B | 500.000 tokens | 30 | ❌ Não |
| Google | Gemini 2.5 Flash | ~1.000 req/dia | 15 | ❌ Não |
| Google | Gemini 2.5 Pro | ~50 req/dia | 5 | ❌ Não |
| Mistral | Le Chat | 25 msg/dia | — | ❌ Não |

---

## 3. ANÁLISE POR TAREFA DO VENDEDOR AI

O sistema possui 4 tarefas críticas com exigências diferentes:

### TAREFA A — Analyzer (`1-analyzer.js`)
**O que faz:** Analisa perfil Instagram + dados GMB → identifica nicho, dor, gancho
**Exigências:** Raciocínio em português, compreensão de contexto de negócio
**Volume típico:** 5–20 perfis/dia, ~800–1200 tokens por perfil

| Modelo | Custo/perfil | Qualidade | Recomendação |
|--------|-------------|-----------|--------------|
| Groq Llama 3.3 70B (free) | R$0.00 | ⭐⭐⭐ | ✅ MVP / beta |
| Groq Llama 4 Scout (free) | R$0.00 | ⭐⭐⭐ | ✅ MVP / beta |
| GPT-4o-mini | ~R$0.004 | ⭐⭐⭐⭐ | ✅ Produção econômica |
| Claude Haiku 4.5 | ~R$0.009 | ⭐⭐⭐⭐⭐ | ✅ Produção padrão |
| GPT-4o | ~R$0.07 | ⭐⭐⭐⭐⭐ | ⚠️ Só se $$$$ |

### TAREFA B — Copywriter (`2-copywriter.js`)
**O que faz:** Gera DM personalizada, persuasiva, em tom natural
**Exigências:** Escrita criativa em PT-BR, naturalidade, sem parecer robô
**Volume típico:** 3–10 DMs aprovadas/dia, ~1500–2500 tokens por DM

| Modelo | Custo/DM | Qualidade | Recomendação |
|--------|----------|-----------|--------------|
| Groq Llama 3.3 70B (free) | R$0.00 | ⭐⭐⭐ | ✅ MVP (aceitável) |
| GPT-4o-mini | ~R$0.01 | ⭐⭐⭐⭐ | ✅ Produção econômica |
| Claude Haiku 4.5 | ~R$0.025 | ⭐⭐⭐⭐⭐ | ✅ Produção padrão |
| Claude Sonnet 3.5 | ~R$0.12 | ⭐⭐⭐⭐⭐+ | ✅ Premium (melhor copywriter) |
| GPT-4o | ~R$0.09 | ⭐⭐⭐⭐⭐ | ⚠️ Premium alternativo |

> **Nota:** DMs são a alma do produto. O copywriter é onde VALE investir em qualidade. Um modelo melhor aqui = mais respostas = mais vendas para o cliente.

### TAREFA C — Learner (`11-learner.js`)
**O que faz:** Analisa histórico de DMs, identifica padrões, sugere melhorias
**Exigências:** Análise de dados, raciocínio estratégico, max 20 amostras
**Volume típico:** 1x/dia, ~5.000–8.000 tokens por execução

| Modelo | Custo/execução | Qualidade | Recomendação |
|--------|---------------|-----------|--------------|
| Groq Llama 4 Scout (free) | R$0.00 | ⭐⭐⭐ | ✅ MVP |
| Claude Haiku 4.5 | ~R$0.05 | ⭐⭐⭐⭐⭐ | ✅ Produção |
| Claude Sonnet 3.5 | ~R$0.25 | ⭐⭐⭐⭐⭐+ | ⚠️ Overkill para esta tarefa |

### TAREFA D — Vision (`1b-vision.js`)
**O que faz:** Analisa imagens de posts do Instagram
**Exigências:** Multimodal, entender contexto visual
**Volume:** Apenas quando ativado

| Modelo | Custo/imagem | Qualidade | Recomendação |
|--------|-------------|-----------|--------------|
| Gemini 2.0 Flash (free) | R$0.00 | ⭐⭐⭐⭐ | ✅ Atual (funciona bem) |
| Gemini 2.5 Flash | ~R$0.003 | ⭐⭐⭐⭐⭐ | ✅ Próxima migração |
| GPT-4o | ~R$0.05/img | ⭐⭐⭐⭐⭐ | ⚠️ Só premium tier |
| Claude Haiku 4.5 | ~R$0.02/img | ⭐⭐⭐⭐⭐ | ✅ Add-on premium |

---

## 4. PLANO DE EVOLUÇÃO EM 4 FASES

### FASE 1 — MVP Gratuito (atual)
**Orçamento:** R$0/mês
**Duração estimada:** Agora até ~50 leads prospectados com sucesso

| Componente | Modelo | Custo |
|------------|--------|-------|
| Analyzer | Groq Llama 4 Scout (free) | R$0 |
| Copywriter | Groq Llama 3.3 70B (free) | R$0 |
| Learner | Groq Llama 4 Scout (free) | R$0 |
| Vision | Gemini 2.5 Flash (free) | R$0 |
| **Total** | | **R$0/mês** |

**Limitações:**
- 100k tokens/dia no Llama 70B = ~80-100 perfis/dia máximo
- 500k tokens/dia no Scout = mais folgado para analyzer/learner
- Qualidade de DM: boa, mas não excelente em PT-BR
- Sem SLA de uptime

**Gatilho para próxima fase:** Primeiro cliente pagante OU quota diária esgotando todo dia.

---

### FASE 2 — Produção Econômica (primeiro cliente)
**Orçamento:** R$50–150/mês
**Duração estimada:** Até ~5 clientes ativos ou 500 DMs/mês

| Componente | Modelo | Custo estimado/mês |
|------------|--------|--------------------|
| Analyzer | Groq pago (sem limite TPD) | ~R$15 |
| Copywriter | Claude Haiku 4.5 | ~R$20 |
| Learner | Groq Llama 4 Scout (free) | R$0 |
| Vision | Gemini 2.5 Flash | ~R$5 |
| **Total** | | **~R$40–80/mês** |

**Por que Haiku só no copywriter?** É onde o modelo faz mais diferença na conversão. O analyzer precisa de raciocínio, não de criatividade — Groq resolve bem.

**Ganho:** DMs em português muito melhores, sem limite de quota, uptime confiável.

**Gatilho para próxima fase:** 5+ clientes ativos OU cliente pedindo qualidade premium OU taxa de resposta abaixo de 5%.

---

### FASE 3 — Produção Padrão (escala inicial)
**Orçamento:** R$150–400/mês
**Duração estimada:** 5–20 clientes ativos

| Componente | Modelo | Custo estimado/mês |
|------------|--------|--------------------|
| Analyzer | Claude Haiku 4.5 | ~R$25 |
| Copywriter | Claude Sonnet 3.5 | ~R$80 |
| Learner | Claude Haiku 4.5 | ~R$10 |
| Vision | Gemini 2.5 Flash | ~R$10 |
| **Total** | | **~R$125–250/mês** |

**Por que Sonnet no copywriter aqui?** Com 5+ clientes, cada % de melhoria na taxa de resposta multiplica o ROI do produto. Claude Sonnet escreve DMs que soam completamente humanas em PT-BR.

**Ganho:** Qualidade de DM premium, analyzer mais preciso, produto defensável a R$500+/mês por cliente.

**Gatilho para próxima fase:** 20+ clientes OU cliente enterprise pedindo dedicação de recursos OU necessidade de fine-tuning.

---

### FASE 4 — Escala e White-Label
**Orçamento:** R$500–2000/mês
**Duração estimada:** 20+ clientes, múltiplos nichos

| Componente | Modelo | Estratégia |
|------------|--------|------------|
| Analyzer | Claude Haiku 4.5 + cache | Prompt caching -50% custo |
| Copywriter | Claude Sonnet 3.5 + cache | Batch API para volume |
| Learner | Claude Haiku 4.5 | 1x/dia por cliente |
| Vision | GPT-4o Vision OU Claude Haiku | Por demanda |
| Fine-tuning | OpenAI GPT-4o-mini fine-tuned | Baseado em DMs aprovadas |

**Estratégias de otimização:**
- **Prompt Caching (Anthropic/OpenAI):** Até -50% no custo de input repetido
- **Batch API:** Para processar leads off-peak com -50% de desconto
- **Fine-tuning:** Após 1.000 DMs aprovadas, fine-tune um modelo menor e mais barato
- **Multi-tenant:** Compartilhar instâncias entre clientes do mesmo nicho

---

## 5. QUANDO TROCAR DE MODELO

### Indicadores Técnicos (dados do sistema)

| Sinal | Threshold | Ação |
|-------|-----------|------|
| Taxa de resposta < 3% | 2 semanas consecutivas | Melhorar copywriter (subir modelo) |
| Quota 429 todo dia | Mais de 3x/semana | Migrar para tier pago |
| DMs rejeitadas pelo usuário > 40% | Semana inteira | Revisar prompt + considerar modelo melhor |
| Custo/DM > R$0.50 | Mês inteiro | Otimizar prompts ou migrar para modelo mais barato |
| Analyzer errado de nicho > 20% | Amostra de 50 leads | Melhorar prompt OU subir modelo de analyzer |

### Indicadores de Negócio

| Sinal | Threshold | Ação |
|-------|-----------|------|
| Primeiro cliente pagante | Qualquer | Migrar Fase 1 → Fase 2 |
| 5 clientes ativos | Qualquer | Avaliar Fase 3 |
| Cliente reclama de qualidade | 1x | Subir modelo do copywriter |
| Cliente pede mais de 20 DMs/dia | Qualquer | Verificar quota + planejar Fase 3 |
| Receita mensal > R$2.000 | MRR | Investir em Fase 3 completa |

### Checklist de Avaliação Mensal

Execute todo dia 1 do mês:

```
[ ] Taxa de resposta média das DMs enviadas
[ ] % de leads com Instagram encontrado (meta: >40%)
[ ] Custo total de API no mês (verificar dashboards de cada provedor)
[ ] Quota de tokens esgotada quantos dias?
[ ] Número de DMs aprovadas vs. rejeitadas
[ ] Novos modelos lançados que valem testar?
```

---

## 6. ADD-ONS PARA CLIENTES

O Vendedor AI pode ser oferecido em tiers com modelos diferentes. O cliente paga mais para ter DMs melhores — você repassa parte do custo e margina o resto.

### Estrutura de Tiers Sugerida

---

#### 🥉 TIER STARTER — "Piloto Automático"
**Preço sugerido:** R$297–497/mês
**Modelo usado:** Groq Llama 4 Scout + Claude Haiku
**Volume:** Até 10 DMs/dia, 1 nicho, 1 cidade

| Recurso | Incluído |
|---------|----------|
| Busca Google Maps (GMB) | ✅ |
| Análise de perfil Instagram | ✅ |
| DM personalizada (modelo econômico) | ✅ |
| Dashboard CRM | ✅ |
| Relatório semanal de leads | ✅ |
| Aprendizado automático (Learner) | ✅ |
| Suporte por WhatsApp | ✅ |

**Custo de API estimado:** R$30–60/mês
**Margem bruta:** ~R$200–400/mês por cliente

---

#### 🥈 TIER GROWTH — "DMs Premium"
**Preço sugerido:** R$697–997/mês
**Modelo usado:** Claude Haiku (analyzer) + Claude Sonnet 3.5 (copywriter)
**Volume:** Até 25 DMs/dia, 2 nichos, 3 cidades

| Recurso | Incluído |
|---------|----------|
| Tudo do Starter | ✅ |
| Copywriter premium (Claude Sonnet) | ✅ |
| Análise de imagens de posts (Vision) | ✅ |
| 2 nichos simultâneos | ✅ |
| Busca em 3 cidades | ✅ |
| A/B test de DMs | ✅ |
| Relatório quinzenal de performance | ✅ |
| Suporte prioritário | ✅ |

**Custo de API estimado:** R$100–180/mês
**Margem bruta:** ~R$500–800/mês por cliente

---

#### 🥇 TIER PREMIUM — "Máquina de Vendas"
**Preço sugerido:** R$1.497–2.497/mês
**Modelo usado:** Claude Sonnet 3.5 (tudo) + GPT-4o Vision
**Volume:** Até 50 DMs/dia, nichos ilimitados, cidades ilimitadas

| Recurso | Incluído |
|---------|----------|
| Tudo do Growth | ✅ |
| Modelo GPT-4o / Claude Sonnet em todo pipeline | ✅ |
| Nichos e cidades ilimitados | ✅ |
| Onboarding personalizado (1h de setup) | ✅ |
| Integração Notion CRM | ✅ |
| Relatório mensal executivo | ✅ |
| Customização de tom de voz da DM | ✅ |
| Suporte dedicado (resposta em 2h) | ✅ |

**Custo de API estimado:** R$250–450/mês
**Margem bruta:** ~R$1.000–2.000/mês por cliente

---

#### ⚡ ADD-ON: Upgrade de Modelo (a la carte)
Para clientes já existentes que querem testar um modelo melhor:

| Add-on | Preço extra/mês | O que muda |
|--------|-----------------|------------|
| Copywriter Sonnet | +R$200/mês | Troca modelo do copywriter para Claude Sonnet 3.5 |
| Vision Premium | +R$100/mês | Ativa análise de imagens de posts |
| Volume Extra | +R$150/mês | +25 DMs/dia no limite |
| Cidades Extra | +R$80/mês por cidade | Adiciona busca em nova cidade |
| Nicho Extra | +R$120/mês por nicho | Adiciona novo nicho ao autopilot |

---

## 7. STACK RECOMENDADA POR ORÇAMENTO

### Orçamento Zero (R$0/mês)
```
Analyzer:   Groq Llama 4 Scout (500k tokens/dia free)
Copywriter: Groq Llama 3.3 70B (100k tokens/dia free)
Learner:    Groq Llama 4 Scout (free)
Vision:     Gemini 2.5 Flash (free tier)
Limite:     ~80 perfis/dia no total
```

### Orçamento Mínimo (R$80/mês)
```
Analyzer:   Groq pago (sem TPD limit)  →  ~R$30/mês
Copywriter: Claude Haiku 4.5           →  ~R$35/mês
Learner:    Groq free                  →  R$0
Vision:     Gemini 2.5 Flash free      →  R$0
Limite:     Sem limite prático
```

### Orçamento Padrão (R$300/mês)
```
Analyzer:   Claude Haiku 4.5           →  ~R$50/mês
Copywriter: Claude Sonnet 3.5          →  ~R$180/mês
Learner:    Claude Haiku 4.5           →  ~R$20/mês
Vision:     Gemini 2.5 Flash           →  ~R$15/mês
Qualidade:  Máxima possível hoje
```

### Orçamento Premium / White-Label (R$600+/mês)
```
Analyzer:   Claude Haiku 4.5 + prompt cache
Copywriter: Claude Sonnet 3.5 + batch API
Learner:    Claude Haiku 4.5
Vision:     GPT-4o Vision (por demanda)
Otimização: Prompt caching reduz até 50% do custo de input
```

---

## 8. RISCOS E DEFESAS

| Risco | Probabilidade | Impacto | Defesa |
|-------|--------------|---------|--------|
| Groq muda/remove free tier | Média | Alto | Manter fallback para Gemini Flash (também free) |
| Anthropic aumenta preço | Baixa | Médio | Contratos anuais têm preço fixo; migrar para GPT-4o se necessário |
| Modelo piora qualidade em PT-BR | Baixa | Alto | Monitorar taxa de aprovação de DMs mensalmente |
| OpenAI depreca modelo em uso | Alta (histórico) | Médio | Nunca usar modelo com "-preview" em produção |
| Novo modelo mais barato aparece | Alta | Positivo | Rodar avaliação trimestral com 50 DMs de teste |
| Cliente migra para concorrente com IA | Média | Alto | Vantagem é o sistema, não o modelo; modelo é commodity |

### Protocolo de Avaliação Trimestral

A cada 3 meses, rodar este teste antes de decidir trocar de modelo:

1. Gerar 30 DMs com modelo atual
2. Gerar 30 DMs com modelo candidato (mesmo dataset)
3. Avaliar cegamente: qual parece mais natural? Qual teria mais resposta?
4. Comparar custo total das 30 DMs
5. Só migrar se: qualidade melhor E custo igual ou menor, OU custo -40% com qualidade equivalente

---

## RESUMO EXECUTIVO — DECISÃO AGORA

**Hoje (Fase 1 — R$0/mês):**
- Groq Llama 4 Scout para analyzer e learner (500k tokens/dia)
- Groq Llama 3.3 70B para copywriter (100k tokens/dia)
- Gemini 2.5 Flash free para vision

**Primeira mudança a fazer (quando o 1º cliente fechar):**
- Pagar Groq Dev (~$10/mês = R$58) → remove limite TPD
- Migrar copywriter para Claude Haiku 4.5 (~R$35/mês)
- Custo total: ~R$80/mês → produto vendável a R$297+

**Próxima evolução (5 clientes):**
- Subir copywriter para Claude Sonnet 3.5
- Produto passa a valer R$697+/mês por cliente
- Margem bruta de ~70–75%

---

*Documento mantido pela Prismatic Labs. Revisar a cada 3 meses ou após lançamento de novos modelos relevantes.*
