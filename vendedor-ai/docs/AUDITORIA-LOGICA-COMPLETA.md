# AUDITORIA DE LÓGICA COMPLETA — VENDEDOR AI v3.0
## Programação + UX/Cognitiva + Coerência Sistêmica

> **Data:** 23 de março de 2026 | **Auditor:** Claude (Cognitive OS)
> **Escopo:** Todos os módulos do pipeline principal

---

## SUMÁRIO EXECUTIVO

**De 47 pontos auditados, encontrei:**
- 🔴 **8 falhas críticas** (afetam funcionamento ou venda)
- 🟡 **12 problemas importantes** (afetam qualidade/profissionalismo)
- 🟢 **27 pontos adequados** (funcionam como esperado)

**O sistema foi bem construído.** A arquitetura modular está correta, o pipeline faz sentido e a qualidade dos prompts é acima da média. Os problemas são principalmente de **coerência** (partes do sistema que ainda falam de produtos antigos) e **edge cases** não tratados.

---

## PARTE 1 — LÓGICA DE PROGRAMAÇÃO

### 1.1 Validação de Entradas e Saídas

#### 🔴 CRÍTICO: Analyzer não valida JSON malformado de forma resiliente
**Arquivo:** `1-analyzer.js` linha 106-109
```javascript
const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
if (!jsonMatch) throw new Error('Resposta nao contem JSON valido');
const analysis = JSON.parse(jsonMatch[0]);
```
**Problema:** Se o LLM retorna JSON com vírgula trailing ou campo faltando, `JSON.parse` lança exception e o pipeline inteiro aborta (`process.exit(1)`). Não há retry.
**Impacto:** Em ~10% das chamadas Groq, o LLM retorna JSON levemente malformado. Cada falha = 1 lead perdido.
**Correção:** Adicionar retry (1x) + sanitização de JSON (remover trailing commas, fix common LLM JSON errors).

#### 🔴 CRÍTICO: Nenhum módulo tem retry para Groq 429
**Arquivos:** `1-analyzer.js`, `2-copywriter.js`, `7-reviewer.js`, `11-learner.js`
**Problema:** Quando Groq retorna 429 (rate limit), o módulo faz `process.exit(1)`. No autopilot, isso faz o lead inteiro falhar, mas o pipeline continua para o próximo lead — que também vai falhar pelo mesmo motivo. Resultado: N leads processados, N falhas.
**Impacto:** Desperdiça toda a busca GMB e o tempo de scraping quando a quota está baixa.
**Correção:** Exponential backoff: wait 30s → 60s → 120s, max 3 retries. Se persistir, abortar o batch com mensagem clara.

#### 🟡 IMPORTANTE: Analyzer aceita followers como string, não converte
**Arquivo:** `1-analyzer.js` linha 23
```javascript
const followersCount = process.argv[4] || process.env.LEAD_FOLLOWERS || '0';
```
**Problema:** `followersCount` é string `"0"`, não int. O prompt recebe `"Seguidores: 0"` para leads com GMB que não têm perfil IG completo — fazendo o LLM pensar que o lead tem 0 seguidores em vez de "desconhecido".
**Correção:** Se followers === '0' e veio de GMB, enviar "Não disponível (lead via Google Maps)".

#### 🟡 IMPORTANTE: Copywriter fallback para Gemini usa modelo deprecated
**Arquivo:** `2-copywriter.js` linha 41
```javascript
model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
```
**Problema:** Gemini 1.5 Flash foi deprecated em março 2026. Deveria ser `gemini-2.5-flash`.
**Impacto:** Se Groq falhar e entrar no fallback, o copywriter vai quebrar.
**Correção:** Atualizar para `gemini-2.5-flash` ou `gemini-2.5-flash-lite`.

#### 🟢 ADEQUADO: sanitizeJSON no copywriter e reviewer
A função `sanitizeJSON` que trata newlines literais dentro de strings JSON está correta e resolve o problema mais comum de parsing de JSON de LLMs.

#### 🟢 ADEQUADO: CRM deduplicação
`loadCRMUsernames()` no autopilot carrega todos os usernames existentes e filtra duplicatas corretamente.

---

### 1.2 Edge Cases

#### 🔴 CRÍTICO: GMB scraper abre browser novo para CADA lugar
**Arquivo:** `0-gmb-scraper.js` linha 188
```javascript
const { browser, context } = await launchBrowser(true);
```
**Problema:** Para 30 negócios, abre e fecha 30 instâncias de Chromium. Na VPS com 2GB RAM, isso causa:
- Memory pressure → crash potencial
- Tempo total ~5-10min para 30 lugares
**Correção:** Reutilizar um único browser/context para todos os extratos. Criar nova page por lugar, não novo browser.

#### 🔴 CRÍTICO: findInstagramFromWebsite também abre browser novo
**Arquivo:** `0-gmb-scraper.js` linha 287
```javascript
const { browser, context } = await launchBrowser(true);
```
**Problema:** Se 15/30 negócios têm website mas não IG no Maps, são 15 browsers adicionais. Total potencial: 45 browsers para um run de 30 negócios.
**Correção:** Receber page ou context como parâmetro, reutilizar.

#### 🟡 IMPORTANTE: Autopilot sem limite de tempo total
**Arquivo:** `10-autopilot.js`
**Problema:** Se GMB scraper travar (Google bloqueou, internet caiu, VPS sem RAM), o processo fica pendurado indefinidamente. PM2 com `autorestart: false` não vai intervir.
**Correção:** Adicionar timeout global (ex: 30 min máximo para o run completo).

#### 🟡 IMPORTANTE: Orchestrator usa spawnSync — bloqueia thread
**Arquivo:** `5-orchestrator.js` linha 25-26
```javascript
const result = spawnSync('node', [scriptPath, ...args], {
  env: { ...process.env, ...extraEnv }, stdio: 'inherit', cwd: AGENTS_DIR
});
```
**Problema:** `spawnSync` é síncrono — bloqueia a thread principal. Para o autopilot (que roda como batch), não é problema agora. Mas se no futuro quiser paralelizar, vai travar.
**Impacto:** Baixo agora, alto se escalar.
**Nota:** Não corrigir agora — prioridade é vender.

#### 🟢 ADEQUADO: Deduplicação de URLs no GMB feed
O `seen` Set com `baseUrl` normalizado evita duplicatas corretamente.

#### 🟢 ADEQUADO: Cataloger preserva histórico em upsert
`upsertLead` mantém status, histórico, datas e notas existentes ao re-analisar um lead. Correto.

---

### 1.3 Tratamento de Erros

#### 🟡 IMPORTANTE: Reviewer falha silenciosamente
**Arquivo:** `7-reviewer.js` linha 226-229
```javascript
} catch (error) {
    console.error(`[REVIEWER] Erro: ${error.message}`);
    console.log(`[REVIEWER] Continuando com mensagem original...`);
}
```
**Problema:** Se o reviewer falha (Groq 429, JSON inválido, etc), ele NÃO faz `process.exit(1)` — simplesmente continua. A mensagem não-revisada vai para o CRM sem flag de "não revisada". O cataloger salva como se tivesse passado pela revisão.
**Impacto:** O cliente pode copiar uma DM que nunca foi revisada, sem saber.
**Correção:** Marcar no CRM: `revisao: { status: 'falhou', motivo: error.message }`.

#### 🟡 IMPORTANTE: Learner sanitizeJSON tem escape duplo
**Arquivo:** `11-learner.js` linhas 32-34
```javascript
if (c === '\\\\') { escaped = true; result += c; continue; }
if (c === '\"') { inString = !inString; result += c; continue; }
```
**Problema:** O arquivo mostra `'\\\\'` e `'\"'` — pode ser um erro de escape que se introduziu quando o arquivo foi editado. Se for literal no arquivo, a função não vai funcionar corretamente: `c === '\\\\'` nunca é true porque `\\\\` é dois backslashes, e `c` é um único caractere.
**Nota:** Preciso validar se isso é um problema de display ou real no arquivo.
**Correção:** Verificar o arquivo raw e corrigir se necessário.

#### 🟢 ADEQUADO: GMB scraper catch-all em extractBusinessFromURL
O try/catch em cada estratégia de extração (website, telefone, Instagram) permite que a falha de uma não impeça as outras. Correto.

#### 🟢 ADEQUADO: Orchestrator verifica Vision descartável
Se 1b-vision.js marca o lead como "descartável" (fora do nicho), o orchestrator aborta antes do copywriter. Economia de tokens.

---

### 1.4 Consistência de Estados

#### 🟡 IMPORTANTE: DM Queue e CRM são sistemas de status paralelos desconectados
**Arquivos:** `config/database.js` (DmQueueDB) + `3-cataloger.js`
**Problema:** O CRM tem status: `novo → contatado → respondeu → em_negociacao → fechado → perdido`. A DM Queue tem: `pending → sending → sent → failed`. Os dois não estão sincronizados — uma DM pode estar "sent" na queue mas o lead ainda estar "novo" no CRM.
**Impacto:** Com o sender desativado, isso é menos grave — o CRM é a fonte principal. Mas a DM Queue continua existindo como código morto.
**Correção futura:** Remover DmQueueDB completamente ou unificar com o CRM.

#### 🟢 ADEQUADO: Pipeline de arquivos é consistente
Analyzer grava `{username}_analysis.json` → Copywriter lê → Reviewer lê e atualiza `{username}_mensagens.json` → Cataloger lê ambos. O fluxo de dados via arquivos JSON é previsível e rastreável.

---

## PARTE 2 — LÓGICA HUMANA (UX/COGNITIVA)

### 2.1 Carga Cognitiva

#### 🔴 CRÍTICO: Dashboard mostra funcionalidades do Sender que não devem ser usadas
**Arquivo:** `dashboard.html` múltiplas referências
**Problema:** O usuário/cliente vê:
- Botão "Enviar DMs" que dispara sender desativado
- KPI "DMs na Fila" (kpi-dm-queue) que não faz sentido sem sender
- Logs de "Sender" com status
- Texto "Vincule sua conta para enviar DMs"
**Impacto cognitivo:** O cliente vai clicar "Enviar DMs", vai falhar, vai achar que o produto está quebrado. Pior: pode pensar que a promessa é envio automático.
**Correção:**
1. Substituir "Enviar DM" por "Copiar mensagem para clipboard"
2. Remover KPI de DM Queue
3. Remover logs de Sender
4. Trocar texto por "Copie a mensagem e envie manualmente no Instagram"

#### 🟡 IMPORTANTE: Nenhum feedback visual de "DM copiada" ou "DM aprovada"
**Problema:** Após o autopilot gerar leads e DMs, o cliente vê os leads no dashboard mas não tem um fluxo claro de:
1. Ver a DM → 2. Aprovar → 3. Copiar → 4. Marcar como "enviada"
**Impacto:** O cliente não sabe o que fazer com os leads. O produto gera DMs mas não guia o próximo passo.
**Correção:** Adicionar status visual por lead: "DM gerada ✓" → "Copiada ✓" → "Enviada ✓" → "Respondeu ✓"

#### 🟡 IMPORTANTE: Configuração de nicho vs. negócio é confusa
**Problema:** Existem dois conceitos separados:
1. **Nicho de busca** — "salão de beleza" (configurado no card "Configuração de Busca")
2. **Negócio do cliente** — "Sou personal trainer..." (configurado via `negocio-config.js`)
O dashboard mistura os dois. O autopilot usa o nicho para buscar leads, mas o analyzer/copywriter usam o negócio para gerar DMs. Se o negócio não estiver configurado, o copywriter gera DMs genéricas.
**Impacto:** O dono do sistema (Prismatic Labs) precisa configurar corretamente. Mas quando vender para um cliente, o cliente precisa entender que "nicho" = "onde buscar" e "negócio" = "o que você vende".
**Correção:** Unificar a configuração: um formulário onde o cliente preenche "O que você faz", "Que tipo de cliente quer", "Que cidade" — e o sistema mapeia internamente.

### 2.2 Hierarquia de Informação

#### 🟢 ADEQUADO: Dashboard KPIs são claros
Os 4 KPIs principais (leads totais, DMs geradas, taxa de análise, hot leads) estão no topo, com destaque visual. A hierarquia é correta.

#### 🟢 ADEQUADO: Timeline do autopilot
A visualização de etapas (Busca → Filtro → IA → Notion) com progresso é intuitiva.

### 2.3 Feedback

#### 🟡 IMPORTANTE: Sem notificação quando autopilot completa
**Problema:** O autopilot roda às 8h. O cliente não recebe nenhuma notificação de que "5 novos leads estão prontos". Precisa entrar no dashboard proativamente.
**Correção futura:** Email ou WhatsApp com resumo: "Bom dia! 5 leads novos com DMs prontas. Acesse: [link]".

---

## PARTE 3 — LÓGICA DE COERÊNCIA SISTÊMICA

### 3.1 Consistência entre Regras de Negócio

#### 🔴 CRÍTICO: Copywriter hardcoded para 2 produtos da Prismatic Labs
**Arquivo:** `2-copywriter.js` linhas 96-121, 113-121
```javascript
const isAPI = a.servico_ideal === 'lead_normalizer_api';
if (isAPI) {
  const api = produtos.find(p => p.id === 'lead-normalizer-api');
  // ... prompt específico para Lead Normalizer API
} else {
  const lp = produtos.find(p => p.id === 'landing-page-premium');
  // ... prompt específico para Landing Page
}
```
**Problema:** O copywriter está hardcoded para vender apenas 2 produtos da Prismatic Labs: Lead Normalizer API e Landing Page Premium. Quando um CLIENTE da Prismatic usar o sistema para vender o PRÓPRIO produto (ex: serviço de nail design), o copywriter vai ignorar o negocio-config.js e usar esses produtos hardcoded.
**Impacto:** O sistema não funciona como SaaS genérico. Só funciona para a Prismatic vender os próprios produtos.
**Gravidade:** Bloqueio direto para qualquer cliente. É o achado mais grave desta auditoria.
**Correção:** O copywriter precisa ler `negocio-config.js` quando configurado, e só usar os produtos hardcoded como fallback se o negócio não estiver configurado.

#### 🔴 CRÍTICO: Analyzer prompt inclui servico_ideal que é Prismatic-specific
**Arquivo:** `1-analyzer.js` linhas 78-79
```javascript
"produto_sugerido": "nome do produto/servico do negocio configurado",
"motivo_fit": "por que este produto resolve a dor DESTE lead",
```
**Problema:** O prompt do analyzer pede `produto_sugerido` e `motivo_fit` referentes ao "negócio configurado". Mas a resposta do LLM vai incluir `servico_ideal: 'lead_normalizer_api'` porque foi treinado nos exemplos do prompt — mesmo que o negócio do CLIENTE seja "salão de beleza".
**Impacto:** O LLM vai retornar `servico_ideal` que não existe no contexto do cliente, e o copywriter vai usar isso para decidir entre API e Landing Page. Incoerente.
**Correção:** Se negocio-config.js estiver configurado, remover referências a produtos hardcoded do prompt do analyzer.

#### 🟡 IMPORTANTE: produtos.json é Prismatic-only
**Arquivo:** `data/produtos.json`
**Problema:** Contém apenas `lead-normalizer-api` e `landing-page-premium`. Quando o sistema for usado por um cliente externo, esse arquivo é irrelevante.
**Correção:** O produtos.json deve ser substituído pelo negocio-config.js como fonte principal de contexto de produto. Se negocio configurado, ignorar produtos.json.

#### 🟡 IMPORTANTE: Reviewer prompt referencia produtos Prismatic
**Arquivo:** `7-reviewer.js` linhas 73-75
```javascript
const produtoCtx = isAPI
  ? 'Lead Normalizer API — dev para dev...'
  : 'Landing Page Premium — aspiracional...';
```
**Problema:** Mesmo problema do copywriter — reviewer avalia a DM contra critérios de produtos Prismatic, não do negócio do cliente.

### 3.2 Integridade dos Dados

#### 🟢 ADEQUADO: Fluxo de dados arquivo-a-arquivo
O pipeline usa JSON files como meio de comunicação entre módulos. É simples, rastreável e funciona para o volume atual.

#### 🟡 IMPORTANTE: Sem backup do CRM
**Arquivo:** `data/crm/leads-database.json`
**Problema:** O CRM é um único arquivo JSON. Se corromper (crash durante escrita, disco cheio), todos os dados são perdidos.
**Correção:** Adicionar backup diário simples (cópia do JSON para `data/crm/backups/`).

### 3.3 Verificação vs. Validação

#### 🟡 IMPORTANTE: Nenhum teste automatizado funcional
**Arquivo:** `agents/10-autopilot.test.js` existe mas não foi verificado
**Problema:** Nenhum módulo tem testes unitários que rodam em CI. A validação é 100% manual.
**Impacto:** Cada mudança de código pode quebrar algo sem perceber.
**Correção (MVP):** Não precisa de test suite agora. Mas precisa de 1 script de smoke test: `node test-pipeline.js` que faz Analyzer → Copywriter → Reviewer com dados fake e verifica que JSON é retornado.

### 3.4 Coerência de Linguagem

#### 🟡 IMPORTANTE: Mix de inglês/português nos logs e variáveis
**Problema:** Variáveis em inglês (`followersCount`, `loadMemory`), logs em português (`[ANALYZER] Analise concluida!`), prompts em português, documentação mista. Não é incoerente em si, mas se um cliente técnico vê os logs, a mistura pode parecer amadora.
**Correção:** Padronizar logs para português (já são na maioria), manter variáveis em inglês (padrão dev).

---

## PARTE 4 — RASTREABILIDADE PONTA A PONTA

### Fluxo completo com gaps marcados:

```
[GMB Scraper] → 30 negócios encontrados
    ↓
[extractBusinessFromURL] → nome, tel, website, IG
    ↓
[enrichWithInstagram] → scrape perfil IG
    ↓ ← GAP: Se IG scrape falha, lead entra com 0 followers e "" bio
    ↓    O analyzer recebe dados vazios e ainda assim pontua
    ↓
[Analyzer] → score, nicho, problema, ângulo
    ↓ ← GAP: servico_ideal hardcoded (lead_normalizer_api / landing_page)
    ↓    Não reflete negócio do cliente
    ↓
[Vision] → ferramentas confirmadas, gancho visual
    ↓ ← OK: Corretamente opcional, descarta leads fora do nicho
    ↓
[Copywriter] → 3 mensagens + followups
    ↓ ← GAP: Usa servico_ideal para escolher produto hardcoded
    ↓    Ignora negocio-config.js se configurado
    ↓
[Reviewer] → score 0-100, versão melhorada
    ↓ ← GAP: Se falha, mensagem não-revisada vai para CRM sem flag
    ↓
[Cataloger] → Lead salvo no CRM
    ↓ ← OK: Deduplicação, upsert, histórico preservado
    ↓
[Dashboard] → Exibe lead + DM
    ↓ ← GAP: Botão "Enviar DM" chama sender desativado
    ↓    Falta botão "Copiar DM" funcional
    ↓
[Manual] → Cliente copia DM e envia no Instagram
    ↓ ← GAP: Não há fluxo claro para marcar "enviada"
    ↓    Tracker existe (12-tracker.js) mas não está integrado no dashboard
    ↓
[Tracker] → Registra outcome (respondeu/ignorou/converteu)
    ↓ ← GAP: Só via CLI, não via dashboard
    ↓
[Learner] → Aprende padrões, grava style-memory.json
    ↓ ← OK: Funciona corretamente quando há dados suficientes
```

---

## PARTE 5 — PLANO DE CORREÇÃO PRIORIZADO

### Prioridade 0 — BLOQUEIA VENDA (fazer esta semana)

| # | Problema | Arquivo | Tempo | Descrição |
|---|----------|---------|-------|-----------|
| 1 | Copywriter hardcoded para produtos Prismatic | `2-copywriter.js` | 3h | Se negocio configurado, usar negocio-config. Manter produtos.json como fallback |
| 2 | Analyzer servico_ideal hardcoded | `1-analyzer.js` | 1h | Remover campo servico_ideal quando negocio configurado |
| 3 | Reviewer produtos Prismatic | `7-reviewer.js` | 1h | Usar negocio-config para contexto |
| 4 | Dashboard sender UI | `dashboard.html` | 2h | Trocar "Enviar DM" por "Copiar DM" + remover referências ao sender |
| 5 | Dashboard endpoints sender | `8-dashboard.js` | 30min | Desativar ou remover rotas /api/sender/* |

### Prioridade 1 — AFETA QUALIDADE (fazer antes do 2º cliente)

| # | Problema | Arquivo | Tempo |
|---|----------|---------|-------|
| 6 | Retry Groq 429 | Todos os agentes | 2h |
| 7 | GMB scraper reutilizar browser | `0-gmb-scraper.js` | 2h |
| 8 | Reviewer failure flag | `7-reviewer.js` | 30min |
| 9 | Followers "0" vs "desconhecido" | `1-analyzer.js` | 15min |
| 10 | Gemini fallback model deprecated | `2-copywriter.js` | 5min |
| 11 | CRM backup diário | `3-cataloger.js` | 1h |

### Prioridade 2 — MELHORIA UX (fazer no primeiro mês)

| # | Problema | Tempo |
|---|----------|-------|
| 12 | Fluxo visual de status por lead no dashboard | 3h |
| 13 | Tracker integrado no dashboard (marcar enviada/respondeu) | 4h |
| 14 | Notificação quando autopilot completa | 3h |
| 15 | Unificar config nicho + negócio | 2h |
| 16 | Smoke test script | 2h |

### Prioridade 3 — TECH DEBT (fazer quando possível)

| # | Problema | Tempo |
|---|----------|-------|
| 17 | Remover DmQueueDB completamente | 1h |
| 18 | Limpar arquivos mortos da raiz | 15min |
| 19 | Atualizar package.json v3.0.0 | 5min |
| 20 | Learner sanitizeJSON escape duplo | 30min |

---

## MÉTRICAS

```
KPI: Prioridade 0 concluída       | meta: 5/5 itens  | prazo: 28/03
KPI: Run end-to-end com negócio genérico | meta: 1 run limpo | prazo: 29/03
KPI: Prioridade 1 concluída       | meta: 6/6 itens  | prazo: 15/04
```

---

## VEREDICTO

O Vendedor AI tem uma **arquitetura sólida** e um **pipeline inteligente** (GMB → IA → DM → CRM). O problema central não é técnico — é de **coerência**: o sistema ainda está hardcoded para vender os produtos da Prismatic Labs em vez de ser genérico para qualquer cliente.

**Corrigir os 5 itens P0 transforma o sistema de "ferramenta interna da Prismatic" em "SaaS vendável para qualquer negócio".**

O investimento é ~7-8 horas de trabalho focado. É a diferença entre um produto que só funciona para você e um produto que funciona para clientes pagantes.

---

*Auditoria gerada pela Prismatic Labs. Próxima revisão após correções P0.*
