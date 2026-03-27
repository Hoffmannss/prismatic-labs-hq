# Análise Completa — Dashboard Vendedor AI v3.0
**Data:** 19/03/2026 | **Método:** Navegação real via Chrome + leitura de código

---

## Resumo Executivo

O dashboard tem uma base visual sólida (dark mode profissional, layout limpo) mas apresenta **5 bugs funcionais** e **8 problemas de UX** que impedem a venda para clientes. Os bugs mais críticos já foram corrigidos no código local — falta apenas deploy.

---

## Seções Analisadas

### 1. Painel Principal ✅ Funcional (com ressalvas)

**O que funciona:**
- Layout geral limpo e profissional
- KPIs visíveis (Leads Hoje, DMs na Fila, Taxa de Resposta, Total no CRM)
- Pipeline de Prospecção visual (5 etapas)
- Botão "Iniciar Autopilot" proeminente e intuitivo
- Campo "Analisar Perfil Específico" bem posicionado
- Controles Rápidos executam os agentes corretamente via `runAgent()`

**Problemas encontrados:**
- 🔴 **BUG: KPI "DMs na Fila" mostra 0 mas Fila tem 5** — contava só leads do CRM, ignorava `dm-queue.json` → **CORRIGIDO**
- 🟡 **"Ver todos →"** nos Controles Rápidos leva para seção Módulos de IA (hidden) → **CORRIGIDO no código local, pendente deploy**
- 🟡 **Últimas Ações** vazio ("Nenhuma atividade ainda") — normal para sistema recém-reiniciado, mas poderia mostrar histórico recente

### 2. Meus Leads ✅ Funcional

**O que funciona:**
- Tabela com colunas: checkbox, avatar, username, nicho, score, status, ações
- Checkbox individual + "select all" para bulk delete
- Botão delete individual por lead
- Barra de bulk delete aparece quando há seleção
- Badge no nav mostra contagem correta (0)

**Problemas encontrados:**
- 🟡 Tabela vazia (0 leads) mas Fila de Mensagens tem 5 DMs — dados órfãos
- 🟡 Sem indicação visual de "como adicionar leads" quando tabela está vazia (empty state poderia ser mais orientador)

### 3. Fila de Mensagens 🔴 Bug Crítico (corrigido)

**O que funciona:**
- Cards de DM com avatar, username, nicho, score, preview da mensagem
- Botões Enviar, Regenerar, Pular por mensagem
- Busca por username
- Ordenação por Score
- Contador "5 DMs na fila · máx 20/dia (anti-ban)"
- "Enviar Fila Completa" presente

**Problemas encontrados:**
- 🔴 **BUG: "Limpar Fila" não persistia** — limpava UI mas ao navegar e voltar, 5 DMs retornavam do `dm-queue.json` → **CORRIGIDO** (agora chama DELETE /api/dm-queue + confirm dialog)
- 🟡 Todas as DMs com score 0 e nicho "Geral" — indica geração sem análise prévia ou sem perfil do negócio configurado
- 🟡 DMs mencionam "Landing Page Premium" e "Lead Normalizer API" — são produtos internos, não o produto do cliente. O copywriter gerou mensagens vendendo os NOSSOS produtos para leads aleatórios

### 4. Relatórios ✅ Funcional (dados zerados)

**O que funciona:**
- 4 KPIs: Score Médio, DMs Enviadas, Taxa de Conversão, Leads esta Semana
- 3 gráficos: Leads por Dia, Distribuição de Score, Breakdown por Status
- Top Nichos por Volume

**Problemas encontrados:**
- 🟡 Tudo zerado — esperado sem dados, mas o estado vazio poderia ter uma mensagem tipo "Execute o Autopilot para começar a ver dados aqui"
- 🟡 Gráficos renderizados mas sem dados visíveis — barras invisíveis em vez de empty state elegante

### 5. Histórico 🟡 Filtros Quebrados (corrigido no local)

**O que funciona:**
- Feed com cards de atividade (estilo humanizado)
- Timestamp por atividade
- Botão "Limpar" funcional

**Problemas encontrados:**
- 🟡 **VPS tem 5 filtros antigos** (Buscas, Análises, Mensagens, Automático, Problemas) que não funcionam → **Código local já simplificou para 2** ("Tudo" + "Só Problemas")
- 🟡 Só mostra "Sistema iniciado" — sem histórico persistente entre restarts

### 6. Perfil do Negócio ✅ Excelente

**O que funciona:**
- Formulário completo: nome, segmento, produto, proposta de valor, problema, tom, diferenciais, público-alvo, Instagram, site
- Dados preenchidos corretamente (Prismatic Labs)
- Seção explicativa "Como isso funciona?" com descrição clara
- Dropdown de tom (Profissional e Amigável selecionado)

**Problemas encontrados:**
- 🟡 Campo "Faixa de Preço" vazio — poderia ajudar o copywriter a calibrar mensagens
- 🟡 Link do site é placeholder (https://seusite.com) — sem site real configurado

### 7. Como Usar ✅ Excelente

**O que funciona:**
- Fluxo visual do sistema (Busca → Análise → Mensagem → Envio → Resultado)
- 8 cards com passos detalhados
- Dicas e alertas contextuais
- Seção da extensão Prismatic Connect

**Problemas encontrados:**
- 🟢 Nenhum problema significativo — melhor seção do dashboard

### 8. Modo Avançado ✅ Funcional

**O que funciona:**
- Toggle no canto inferior esquerdo
- Revela 3 seções: Módulos de IA, Conta Instagram, Agendamento
- Visual do botão muda para "Modo Avançado: Ativo"
- Desativar esconde as seções novamente

---

## Classificação de Bugs por Severidade

| # | Bug | Severidade | Status |
|---|-----|-----------|--------|
| 1 | Limpar Fila não persiste | 🔴 Crítico | ✅ Corrigido |
| 2 | KPI DMs = 0 mas Fila tem 5 | 🔴 Crítico | ✅ Corrigido |
| 3 | Filtros Histórico não funcionam | 🟡 Médio | ✅ Corrigido (local) |
| 4 | "Ver todos →" leva para seção hidden | 🟡 Médio | ✅ Corrigido (local) |
| 5 | DMs com produtos errados (nossos vs cliente) | 🟡 Médio | Precisa re-gerar |

## Recomendações de UX para v2.0

1. **Empty states orientadores** — quando não há leads/DMs/relatórios, mostrar CTA claro ("Configure seu Perfil do Negócio e inicie o Autopilot")
2. **Onboarding wizard** — primeiro acesso deveria guiar: Perfil → Autopilot → Revisar DMs
3. **Badge da Fila sincronizado** — usar fonte única de verdade para contagem
4. **Histórico persistente** — salvar logs entre restarts do PM2
5. **Validação do Perfil** — avisar se campos críticos estão vazios antes de rodar Autopilot

---

## Comandos para Deploy

**No Windows (seu PC):**
```bash
cd C:\Users\hoffm\projetos\prismatic-labs-hq\vendedor-ai
git add agents/8-dashboard.js agents/10-autopilot.js config/database.js public/dashboard.html
git commit -m "fix: limpar fila persiste, KPI DMs sincronizado, timeline autopilot, filtros historico"
git push origin main
```

**Na VPS (SSH):**
```bash
cd /root/projetos/prismatic-labs-hq/vendedor-ai
git pull origin main
pm2 restart vendedor-dashboard
```
