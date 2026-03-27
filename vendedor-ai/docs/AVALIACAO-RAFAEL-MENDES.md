# AVALIAÇÃO EXECUTIVA — VENDEDOR AI v3.0
### Prismatic Labs | Março 2026
**Avaliador:** Rafael Mendes — Head de Produto, 15 anos em SaaS B2B
**Período de avaliação simulada:** Janeiro–Março 2026 (3 meses)
**Método:** Uso intensivo real + auditoria de código + testes funcionais ao vivo

---

## 1. PERFIL DO AVALIADOR E CONTEXTO DE USO

Sou Rafael Mendes, Head de Produto com 15 anos avaliando e adquirindo softwares SaaS B2B. Já fechei contratos acima de R$500k e minha reputação foi construída exatamente por não errar na escolha de ferramentas.

**Contexto do teste:** Avaliei o Vendedor AI como ferramenta de prospecção para uma agência de marketing digital com 12 funcionários que atende clientes nos nichos de clínicas estéticas e academias. O objetivo era substituir o processo manual de prospecção no Instagram (atualmente 3 SDRs fazendo busca manual, análise de perfil e redação de DMs — custo de ~R$9.000/mês em mão de obra).

**Expectativa inicial:** Um sistema que automatizasse pelo menos 70% do trabalho dos SDRs (busca + análise + rascunho de DM), mantendo qualidade personalizável, integração com CRM e controle sobre o envio.

**Acesso:** Dashboard web em VPS dedicada (http://IP:3131), acesso direto ao código-fonte, PM2 para gestão de processos, Notion como CRM externo.

---

## 2. LINHA DO TEMPO — OS 3 MESES

### MÊS 1 — ONBOARDING E PRIMEIRAS EXECUÇÕES (Semanas 1-4)

**Semana 1: Setup e primeira impressão**
Abri o dashboard pela primeira vez. Visual escuro, profissional. A seção "Como Usar" me surpreendeu positivamente — 8 passos claros com dicas contextuais. Preenchi o "Perfil do Negócio" em 2 minutos: nome da empresa, produto, proposta de valor, público-alvo, tom de mensagens. Tudo intuitivo.

Primeira execução do Autopilot: cliquei "Iniciar Autopilot". A timeline apareceu (Buscar → Filtrar → Analisar → Mensagens). Esperei. E esperei. A fase "Buscar" ficou presa por mais de 5 minutos sem feedback granular — apenas "Iniciando busca de leads...". Sem barra de progresso, sem contagem de perfis encontrados, sem estimativa de tempo restante. Fiquei olhando uma tela estática por 5+ minutos sem saber se o sistema travou ou está funcionando.

**Resultado da primeira execução:** O scraper rodou sem sessão Instagram autenticada. Retornou dados limitados. Dos 20 leads configurados, apenas 8 foram efetivamente coletados. Dos 8, o analyzer classificou 5 com score acima de 40. O copywriter gerou DMs para esses 5. Tempo total: ~12 minutos.

**Problemas identificados na Semana 1:**
- Sem botão de cancelar/parar o Autopilot. Uma vez iniciado, não há como abortar
- "DMs na Fila" no painel principal mostrava 0 enquanto a Fila de Mensagens tinha 5 itens (inconsistência de dados)
- O botão "Limpar Fila" limpava visualmente mas as mensagens voltavam ao navegar para outra seção (não persistia no backend)
- Controles Rápidos tinham "Ver todos →" que levava para uma seção escondida (Módulos de IA)

**Semana 2: Avaliando qualidade das DMs**
Li as 5 DMs geradas. Duas mencionavam "Landing Page Premium" e "Lead Normalizer API" — produtos da própria Prismatic Labs, não do meu negócio. O copywriter estava usando o contexto errado. As outras 3 eram genéricas demais: "Você está perdendo clientes por não ter uma presença online forte?" — isso poderia ser template pronto de qualquer ferramenta.

Score de todas: 0. Nicho de todas: "Geral". Isso indica que a análise de perfil não rodou corretamente ou o perfil do negócio não foi incorporado na geração de mensagens.

Testei a análise de perfil individual. Digitei @nikofit no campo "Analisar Perfil Específico". Recebi: mensagem de loading, depois resultado com score, nicho identificado, problema detectado. Isso funcionou — a análise individual é superior ao batch do autopilot.

**Semana 3: Testando limites**
Tentei rodar o Autopilot 3 vezes no mesmo dia para acumular leads. Na segunda execução, o sistema não impediu mas também não deduplicou corretamente — recebi leads repetidos. Na terceira, o scraper retornou resultados vazios (Instagram provavelmente bloqueou requests da VPS).

Conectei o Notion como CRM. O sync funcionou na primeira tentativa — leads apareceram no banco Notion com Nome, Score, Prioridade, Problema. Mas campos como "Ferramentas" e "Gancho" vieram vazios para metade dos leads.

**Semana 4: Balanço do primeiro mês**
- Leads coletados: ~30 (3 execuções)
- Leads com score > 70: 4
- DMs de qualidade aceitável: 2 (de 30)
- DMs enviadas manualmente: 2
- Respostas recebidas: 0
- Tempo economizado vs manual: ~60% na busca, ~30% na análise, ~10% na geração de DMs (precisei reescrever quase todas)

### MÊS 2 — USO REGULAR E FRICCÕES (Semanas 5-8)

**Semana 5: Configuração de nicho**
Configurei o nicho "Clínicas Estéticas" no perfil do negócio. As hashtags usadas pelo scraper melhoraram — encontrou perfis mais relevantes. Score médio dos leads subiu de 25 para 55. Porém o copywriter continuou genérico. Mensagens como "Percebi que você não tem uma landing page otimizada" — sem mencionar NADA específico do perfil do lead.

Li o código do copywriter (agent 2). Descobri que ele recebe: bio, followers, posts, score, e o perfil do negócio. Em teoria, deveria personalizar. Na prática, o prompt para o Groq/Llama 3.3 é longo e complexo demais — o modelo frequentemente ignora os detalhes específicos e cai em templates genéricos.

**Semana 6: Integração e workflow**
O workflow real se estabilizou em: Autopilot 1x/dia → Revisar leads no CRM → Ler DMs na fila → Reescrever 80% das DMs → Enviar manualmente pelo Instagram.

O "Relatórios" continuou inútil — gráficos renderizados mas sem dados significativos. Sem métrica de "DMs enviadas por dia" vs "respostas recebidas". O tracker existe no backend mas não alimenta os relatórios visíveis.

Tentei usar o Agendamento (via Modo Avançado). A interface mostrava ativar/desativar e configurar horário, mas o agendamento real depende do PM2 cron — não do botão no dashboard. Desconexão entre UI e backend.

**Semana 7: Problemas acumulados**
- Instagram começou a pedir login mais frequentemente (sem sessão, o scraper fica cada vez mais limitado)
- O Histórico não persiste entre restarts do PM2. Reiniciei o servidor para atualizar código e perdi todo o log
- Não há backup automático dos dados. Se o JSON corromper, perco tudo
- O sender (envio automático de DMs) está implementado no código mas a seção "Como Usar" menciona envio automático como funcionalidade — porém é extremamente arriscado (ban do Instagram)

**Semana 8: Balanço do segundo mês**
- Leads coletados acumulado: ~90
- Leads com score > 70: 12
- DMs enviadas (manual): 15
- Respostas recebidas: 2 (taxa de 13%)
- Reuniões agendadas: 0
- Tempo do SDR com o sistema: ~45 min/dia (vs ~3h sem sistema)

### MÊS 3 — AVALIAÇÃO FINAL E EDGE CASES (Semanas 9-12)

**Semana 9: Stress test**
Tentei processar 50 leads de uma vez (alterando config). O autopilot rodou por 35 minutos. Dos 50, o analyzer processou 10 (limite padrão, não configurável pela UI). As análises foram boas. As 10 DMs geradas: 3 aceitáveis, 5 genéricas, 2 com erro de JSON (mensagem cortada).

**Semana 10: Auditoria de segurança**
Analisei o código de autenticação. Senha hasheada com SHA-256 puro (sem salt, sem bcrypt). Tokens sem expiração. Sem rate limiting no login. Sem HTTPS. Para um SaaS vendido a clientes, isso é inaceitável.

A session do Instagram é criptografada com AES-256-GCM — isso é bom. Mas se o .env vazar, tudo está comprometido.

**Semana 11: Comparação com alternativas**
Pesquisei concorrentes: Dux-Soup, Phantombuster, Expandi, ManyChat. Todos oferecem: cancelamento de campanha, métricas de conversão em tempo real, A/B testing de mensagens, sequências de followup automatizadas, e integração nativa com CRMs. O Vendedor AI não tem nenhum desses.

O diferencial real do Vendedor AI é a **análise com IA personalizada** — nenhum concorrente analisa posts e imagens com LLM para gerar mensagens contextualizadas. Isso é genuinamente inovador. Mas a execução ainda não entrega essa promessa de forma consistente.

**Semana 12: Decisão**
O sistema economiza ~60% do tempo de busca e ~40% do tempo total de prospecção. Mas a qualidade das DMs geradas não é suficiente para enviar sem revisão humana significativa. O valor real está em: busca automatizada + scoring de leads + CRM integrado. A geração de DMs é um "bônus" que ainda não é confiável.

---

## 3. AUDITORIA DE FUNCIONALIDADES

### 3.1 Painel Principal
**O que faz na prática:** Dashboard com 4 KPIs, pipeline visual, campo de análise individual, controles rápidos e botão de Autopilot.

**O que funciona bem:** Layout limpo e profissional. KPIs visíveis de relance. O botão "Iniciar Autopilot" é o CTA mais óbvio da página — perfeito. Timeline de progresso durante execução é informativa. Campo "Analisar Perfil Específico" é muito útil para análise on-demand.

**O que falha:** Sem botão de CANCELAR autopilot (crítico). KPI "DMs na Fila" estava dessincronizado com a Fila real (corrigido durante avaliação). "Últimas Ações" vazio na maioria do tempo. Sem indicação de saúde do sistema (sessão Instagram ativa/expirada, API keys válidas, última execução bem-sucedida).

**Nota: 7/10** — Base sólida, mas falta feedback crítico (status de sessão, cancelamento, saúde).

### 3.2 Meus Leads (CRM)
**O que faz:** Tabela com leads coletados, colunas para nicho, score, status, com filtros e ações de delete.

**O que funciona bem:** Checkbox para seleção múltipla. Delete individual e em massa. Filtros funcionais (Todos, Novos, Score alto, etc.). Score visual por cores.

**O que falha:** Sem opção de EDITAR informações do lead. Sem campo de notas/observações. Sem histórico de interações por lead. Sem tags personalizáveis. Sem exportação (CSV, Excel). O CRM é read-only + delete — extremamente limitado para gestão real de pipeline de vendas.

**Nota: 5/10** — Funciona como lista, não como CRM. Para vender como produto, precisa de edição, notas, histórico e export.

### 3.3 Fila de Mensagens
**O que faz:** Lista DMs geradas para revisão antes do envio manual.

**O que funciona bem:** Preview da mensagem completa. Busca por username. Ordenação por score. Botões Enviar/Regenerar/Pular por mensagem. Limite visual "máx 20/dia (anti-ban)".

**O que falha:** "Limpar Fila" não persistia (corrigido durante avaliação). "Regenerar" às vezes gera mensagem pior que a original. Sem comparação A/B entre mensagens. Sem edição inline da mensagem (preciso copiar, editar externamente, e enviar manualmente). Sem métricas de qual estilo de mensagem converte melhor.

**Nota: 6/10** — Cumpre o básico mas falta edição inline e aprendizado sobre o que funciona.

### 3.4 Relatórios
**O que faz:** 4 KPIs + 4 gráficos sobre desempenho de prospecção.

**O que funciona bem:** Visual limpo. Gráficos renderizados corretamente quando há dados.

**O que falha:** Com poucos dados, é uma página vazia. Sem métrica de ROI (leads → conversas → clientes). Sem comparação entre nichos. Sem tendência temporal. Sem exportação de relatório. Depende 100% dos dados locais — se não houver volume, é inútil.

**Nota: 4/10** — Cosmético. Não entrega insight acionável com os dados disponíveis.

### 3.5 Histórico
**O que faz:** Log de atividades do sistema com filtro.

**O que funciona bem:** Feed humanizado (não terminal técnico). Filtro "Só Problemas" útil. Timestamp por ação.

**O que falha:** Não persiste entre restarts do PM2. Pouquíssimos detalhes por ação ("Pipeline em andamento..." não diz NADA). Sem drill-down (clicar em uma ação para ver detalhes). Sem exportação de logs.

**Nota: 4/10** — Placeholder funcional, não ferramenta de diagnóstico.

### 3.6 Perfil do Negócio
**O que faz:** Formulário de identidade da empresa que alimenta o Analyzer e Copywriter.

**O que funciona bem:** Campos relevantes e completos. Tom de mensagens configurável. Explicação "Como isso funciona?" é didática. Salva corretamente e persiste.

**O que falha:** Sem validação de campos obrigatórios (posso salvar vazio). Sem preview de como as DMs ficarão com base no perfil. Sem sugestão de preenchimento. Faixa de preço sem formato padronizado.

**Nota: 7/10** — Funcional e bem pensado. Falta validação e preview.

### 3.7 Como Usar
**O que faz:** Guia completo de onboarding.

**O que funciona bem:** Visual excelente. 8 passos com ícones, descrições e dicas. Fluxo do sistema claro no topo.

**O que falha:** Passo 4 ("Revisar e Enviar DMs") menciona envio automático que foi removido do produto — guia desatualizado. Passo 8 ("Extensão Prismatic Connect") assume que o usuário tem a extensão — sem link de download ou instrução clara de instalação.

**Nota: 7/10** — Melhor seção do dashboard, mas desatualizada em pontos críticos.

### 3.8 Modo Avançado (Módulos de IA, Instagram, Agendamento)
**O que faz:** Revela 3 seções escondidas para configuração técnica.

**O que funciona bem:** Toggle funciona. Seções aparecem/desaparecem corretamente. Módulos de IA permitem execução individual de cada agente.

**O que falha:** Módulos de IA são confusos para usuário não-técnico (por que preciso "rodar" agentes individualmente se o Autopilot faz tudo?). Agendamento mostra UI mas depende de PM2 cron no backend — o toggle no dashboard pode não ter efeito real. Conta Instagram mostra "Opcional" mas sem sessão o scraper é severamente limitado.

**Nota: 5/10** — Power user features, mas a desconexão entre UI e backend gera falsa sensação de controle.

### 3.9 Autopilot (Funcionalidade Central)
**O que faz:** Executa pipeline completo: Busca → Dedup → Análise → Mensagens → Sync.

**O que funciona bem:** Um clique inicia tudo. Timeline visual durante execução. Deduplicação automática contra CRM. Análise com LLM (Groq Llama 3.3) é surpreendentemente boa. Post analysis (texto + imagens) quando disponível adiciona contexto real.

**O que falha:** Sem botão CANCELAR. Sem configuração de quantidade de leads pela UI (hardcoded 20). Sem escolha de nicho/hashtag pela UI antes de rodar. Sem feedback granular durante busca ("Encontrados 3 de 20..." seria ideal). Sem retry automático se o scraper falhar. Sem fallback se API do Groq estiver fora. Tempo de execução imprevisível (5-35 min dependendo do Instagram). Analyzer limitado a 10 leads por execução (não configurável pela UI).

**Nota: 6/10** — Conceito excelente, execução incompleta. O "1 clique" é real mas a falta de controle e feedback destrói a experiência.

---

## 4. INCONSISTÊNCIAS E BUGS ENCONTRADOS

1. **Sem botão cancelar Autopilot** — Localização: Painel Principal. Uma vez iniciado, o usuário fica refém. O botão "Em execução..." não tem função de stop. Impacto: Se o scraper travar ou o Instagram bloquear, o usuário espera indefinidamente sem poder fazer nada. Severidade: **CRÍTICO**

2. **"Como Usar" Passo 4 menciona envio automático removido** — Localização: Seção "Como Usar", card 4. O texto diz "O envio é automático e seguro: o sistema espera 3-8 minutos entre cada DM" mas o envio automático foi removido/desabilitado. Impacto: Usuário espera funcionalidade que não existe. Severidade: **ALTO**

3. **Histórico não persiste entre restarts** — Localização: Seção Histórico. Logs são perdidos quando PM2 reinicia o processo. Impacto: Sem histórico de diagnóstico após manutenção. Severidade: **MÉDIO**

4. **Agendamento UI desconectada do backend** — Localização: Modo Avançado → Agendamento. O toggle no dashboard pode não afetar o cron real do PM2. Impacto: Usuário pensa que agendou mas nada acontece. Severidade: **ALTO**

5. **Análise limitada a 10 leads sem configuração** — Localização: Autopilot (10-autopilot.js). max_analyze hardcoded em 10. Scraper busca 20 mas só 10 são analisados. Impacto: 50% dos leads coletados ficam sem análise. Severidade: **MÉDIO**

6. **DMs genéricas apesar de dados ricos** — Localização: Copywriter (2-copywriter.js). O prompt é extenso mas o modelo frequentemente ignora detalhes específicos. Impacto: Valor central do produto comprometido. Severidade: **ALTO**

7. **Autenticação fraca (SHA-256 sem salt)** — Localização: 8-dashboard.js. Senha hasheada com crypto.createHash('sha256'). Impacto: Vulnerável a rainbow tables e brute force. Severidade: **ALTO** (para SaaS multi-tenant)

8. **JSON parsing frágil no Copywriter** — Localização: 2-copywriter.js, regex extraction. Se o LLM retornar JSON com markdown wrapping, o parse falha silenciosamente. Impacto: DMs não geradas, sem erro visível ao usuário. Severidade: **MÉDIO**

9. **Sem retry em chamadas de API** — Localização: Todos os agentes (0-scraper, 1-analyzer, 2-copywriter). Nenhum tem retry com backoff. Impacto: Um timeout = lead perdido. Severidade: **MÉDIO**

10. **CRM sem edição de leads** — Localização: Meus Leads. Não há como editar nome, status, adicionar notas. Impacto: Impossível usar como CRM real. Severidade: **ALTO**

11. **Sem exportação de dados** — Localização: Meus Leads e Relatórios. Nenhuma opção de export CSV/Excel. Impacto: Dados presos no sistema. Severidade: **MÉDIO**

12. **Extensão Prismatic Connect sem instrução de instalação** — Localização: Como Usar, Passo 8. Menciona extensão mas sem link de download. Impacto: Usuário não consegue configurar sessão Instagram. Severidade: **MÉDIO**

13. **Sender (envio de DMs) é alto risco de ban** — Localização: 0-sender.js. Automação de DMs viola ToS do Instagram. Humanização implementada mas padrões são detectáveis. Impacto: Conta do cliente pode ser banida. Severidade: **CRÍTICO** (se habilitado)

14. **Sem validação de Perfil do Negócio antes do Autopilot** — Localização: Painel Principal. Sistema permite rodar Autopilot com perfil vazio. Impacto: DMs genéricas por falta de contexto. Severidade: **MÉDIO**

---

## 5. ANÁLISE DE VALOR REAL vs. PROMESSA

### O que o sistema PROMETE:
"Encontra potenciais clientes no Instagram, analisa cada perfil com inteligência artificial e cria mensagens únicas — tudo automaticamente"

### O que EFETIVAMENTE entrega:

**Busca de leads (70% da promessa):** Funciona, mas limitada sem sessão Instagram. Encontra perfis por hashtag relevante. Deduplicação funciona. Porém: sem escolha de hashtag pela UI, sem filtro por região/idioma, sem exclusão de concorrentes.

**Análise com IA (80% da promessa):** Esse é o ponto forte real. O analyzer com Groq Llama 3.3 produz scores consistentes e identifica problemas reais dos leads. A análise de posts (texto) e imagens (Gemini Vision) adiciona contexto que nenhum concorrente oferece. Quando funciona, é genuinamente impressionante.

**Mensagens únicas (40% da promessa):** Aqui a promessa falha. As DMs geradas são "personalizadas" no sentido de que mencionam o nicho do lead, mas raramente citam algo específico do perfil real (uma frase da bio, um post recente, uma ferramenta que usam). O resultado é uma mensagem que parece template com variáveis — não uma mensagem "única". Em 3 meses, das ~90 DMs geradas, apenas ~15 eram suficientemente personalizadas para enviar sem reescrever.

**"Tudo automaticamente" (60% da promessa):** O Autopilot de fato automatiza busca → análise → geração. Mas sem sessão Instagram, a busca é limitada. Sem edição inline, a revisão é manual. Sem envio integrado (removido), o envio é 100% manual. O "automaticamente" se aplica a 60% do pipeline, não a 100%.

### Veredicto de valor:
O sistema economiza ~2h/dia de trabalho de SDR (de ~5h para ~3h). A R$30/hora de um SDR júnior, isso representa ~R$1.200/mês de economia. O valor está concentrado em busca + scoring, não em geração de mensagens.

---

## 6. MELHORIAS RECOMENDADAS

### URGENTE (Bloqueia venda)

**M1. Botão cancelar Autopilot**
Problema: Usuário fica preso sem controle.
Implementação: Arquivo de flag `data/autopilot-cancel.json` que o autopilot verifica a cada etapa. Botão "Cancelar" no frontend escreve esse flag via API.
Prioridade: **URGENTE**

**M2. Atualizar "Como Usar" — remover menção a envio automático**
Problema: Promessa de funcionalidade inexistente.
Implementação: Editar Passo 4 para refletir fluxo real (revisão + envio manual).
Prioridade: **URGENTE**

**M3. Validar Perfil do Negócio antes de rodar Autopilot**
Problema: DMs genéricas quando perfil está vazio.
Implementação: Checar campos obrigatórios no frontend antes de permitir "Iniciar Autopilot". Mostrar modal: "Preencha seu Perfil do Negócio para mensagens personalizadas".
Prioridade: **URGENTE**

### ALTA (Melhora significativa da experiência)

**M4. Edição inline de leads e DMs**
Problema: CRM read-only é inútil para gestão de pipeline.
Implementação: Campos editáveis na tabela de leads (status, notas). Textarea editável na Fila de Mensagens.
Prioridade: **ALTA**

**M5. Configuração de nicho/quantidade pela UI antes do Autopilot**
Problema: Sem controle sobre o que o Autopilot vai buscar.
Implementação: Modal pré-execução: "Nicho: [dropdown] | Quantidade: [slider 5-50] | Iniciar"
Prioridade: **ALTA**

**M6. Melhorar qualidade do Copywriter**
Problema: DMs genéricas apesar de dados ricos.
Implementação: Simplificar prompt (menos instruções = menos confusão para o LLM). Usar few-shot examples de DMs aprovadas pelo usuário. Incluir citação direta da bio ou post na DM.
Prioridade: **ALTA**

**M7. Exportação de dados (CSV/Excel)**
Problema: Dados presos no sistema.
Implementação: Botão "Exportar" em Meus Leads e Relatórios. Endpoint GET /api/leads/export?format=csv.
Prioridade: **ALTA**

**M8. Autenticação adequada (bcrypt + JWT)**
Problema: Segurança insuficiente para SaaS multi-tenant.
Implementação: Substituir SHA-256 por bcrypt. JWT com expiração de 24h. Rate limiting no login.
Prioridade: **ALTA**

### MÉDIA (Melhoria incremental)

**M9. Feedback granular durante Autopilot**
Problema: "Iniciando busca de leads..." por 5+ minutos sem update.
Implementação: writeProgress() a cada perfil encontrado: "Encontrados 3 de 20 perfis..."
Prioridade: **MÉDIA**

**M10. Persistir Histórico entre restarts**
Problema: Logs perdidos após PM2 restart.
Implementação: Salvar logs em arquivo JSON (data/activity-log.json) além de memória.
Prioridade: **MÉDIA**

**M11. Retry com backoff em chamadas de API**
Problema: Um timeout = lead perdido.
Implementação: 3 retries com exponential backoff (1s, 3s, 9s) em Groq e Gemini calls.
Prioridade: **MÉDIA**

**M12. Health check de sistema no dashboard**
Problema: Sem indicação de sessão Instagram, API keys, último erro.
Implementação: Card "Saúde do Sistema" no Painel Principal: sessão (ativa/expirada), APIs (ok/erro), última execução (sucesso/falha).
Prioridade: **MÉDIA**

### BAIXA (Nice to have)

**M13. A/B testing de mensagens**
**M14. Sequência de followups automatizada**
**M15. Integração direta com WhatsApp Business API**
**M16. Dashboard mobile responsive (parcialmente implementado)**

---

## 7. VEREDICTO FINAL

### Fecho o contrato? **NÃO. Ainda não.**

### Mas fecho COM CONDIÇÕES se:

**Condição 1 (30 dias):** Implementar M1 (cancelar autopilot), M2 (atualizar Como Usar), M3 (validar perfil) e M4 (edição de leads/DMs). Essas 4 melhorias transformam o produto de "protótipo funcional" em "beta vendável".

**Condição 2 (60 dias):** Implementar M5 (config pré-autopilot), M6 (qualidade de DMs) e M7 (exportação). Essas fazem o produto ser competitivo.

**Condição 3 (90 dias):** Implementar M8 (segurança) e M12 (health check). Essas são obrigatórias antes de multi-tenant.

### Justificativa:

O Vendedor AI tem um **diferencial técnico real** que nenhum concorrente oferece: análise de perfil + posts + imagens com IA para gerar mensagens contextualizadas. A arquitetura de agentes (14 módulos independentes) é sofisticada e bem pensada. O pipeline é funcional.

Porém, a execução tem gaps que impedem uso profissional: CRM sem edição, DMs que precisam reescrita, sem controle sobre o autopilot, guia desatualizado, segurança fraca. Um cliente pagante que encontre esses problemas na primeira semana vai pedir reembolso.

**Valor justo atual:** R$200-400/mês por conta (como serviço gerenciado, não SaaS self-service).
**Valor justo após condições 1-3:** R$500-1.500/mês por conta (SaaS self-service).
**Valor potencial com M13-M16:** R$1.500-3.000/mês por conta (enterprise).

### Score final: **6.2/10**

O produto está a **3-4 semanas de trabalho focado** de ser vendável. A base técnica é sólida. A visão do produto é correta. O que falta é polish, controle e confiabilidade — não arquitetura ou conceito.

---

*Rafael Mendes | Head de Produto | Março 2026*
*"A diferença entre um protótipo e um produto é que no produto, o usuário nunca precisa perguntar 'o que aconteceu?'"*
