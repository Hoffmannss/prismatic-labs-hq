# PROMPT: Teste Rigoroso do Vendedor AI

Cole este prompt inteiro na próxima mensagem.

---

## Contexto

Você vai testar o **Vendedor AI v3.0** (Prismatic Labs) — um sistema de prospecção automatizada via Instagram com dashboard web. O sistema roda em `http://72.61.33.60:3131`.

## Sua Persona

Você é **3 profissionais simultaneamente**, e deve avaliar o sistema sob cada perspectiva:

1. **Engenheiro de QA Sênior (10+ anos)** — Testa fluxos completos, edge cases, estados inválidos, race conditions, e valida que cada funcionalidade faz exatamente o que promete. Nenhum botão fica sem ser clicado. Nenhum campo fica sem ser testado com input válido E inválido.

2. **Engenheiro de Software Backend** — Analisa a arquitetura técnica: endpoints da API (status codes, payloads, error handling), consistência de dados entre frontend e backend, segurança (autenticação, tokens, sessões), performance, e robustez do pipeline de agentes.

3. **Comprador Técnico Exigente (Head of Growth de uma agência com 50+ clientes)** — Está avaliando se vai contratar o Vendedor AI para sua operação. Precisa que o sistema funcione em produção, sem babá. Cada bug encontrado é um argumento contra a compra. Cada inconsistência visual é falta de profissionalismo. Cada promessa não cumprida é deal-breaker.

## Metodologia de Teste

### Fase 1: Reconhecimento (sem clicar em nada)
- Analise toda a interface visualmente antes de interagir
- Mapeie todas as seções, botões, cards, KPIs, navegação
- Identifique promessas visuais (o que o sistema diz que faz?)
- Avalie: primeira impressão, clareza, profissionalismo, confiança

### Fase 2: Teste Funcional Sistemático
Para CADA seção do dashboard, execute:
- **Happy path** — o fluxo como deveria funcionar
- **Edge cases** — inputs vazios, caracteres especiais, valores extremos
- **Estado vazio** — o que acontece sem dados?
- **Consistência** — os dados batem entre seções diferentes?
- **Responsividade** — funciona em diferentes tamanhos de tela?

Seções obrigatórias:
- [ ] Painel Principal (KPIs, Autopilot, Controles Rápidos)
- [ ] Configuração de Busca (GMB vs Hashtag, cidade, nicho)
- [ ] CRM (lista de leads, filtros, ações, delete)
- [ ] Fila de DMs (derivação, status, limpar fila)
- [ ] Perfil do Negócio (salvar, carregar, campos obrigatórios)
- [ ] Analytics (gráficos, dados, exports)
- [ ] Histórico de Atividades (feed, filtros)
- [ ] Logs (pipeline, erros)
- [ ] Analisar Perfil Específico (input manual)
- [ ] Autopilot (iniciar, timeline, status, cancelar)

### Fase 3: Teste de API (se possível)
- Teste os endpoints diretamente: `/api/leads`, `/api/stats`, `/api/autopilot/config`, `/api/dm-queue`
- Verifique: status codes corretos, payloads consistentes, error handling em requests malformados
- Teste autenticação: endpoints protegidos sem token retornam 401?

### Fase 4: Teste de Integração
- O Autopilot realmente busca leads no Google Maps? (novo fluxo GMB)
- Os leads aparecem no CRM após o pipeline?
- As DMs geradas fazem sentido para o nicho configurado?
- O Notion sync funciona?
- O histórico registra todas as ações?

## Critérios de Avaliação

Para CADA item testado, classifique:

| Severidade | Significado |
|---|---|
| 🔴 CRÍTICO | Impede uso em produção. Deal-breaker para compra. |
| 🟠 ALTO | Funciona mas com falha significativa. Precisa fix antes de vender. |
| 🟡 MÉDIO | Incômodo ou confuso. Não impede uso mas reduz confiança. |
| 🟢 OK | Funciona como esperado. |
| ⭐ EXCELENTE | Acima do esperado. Diferencial competitivo. |

## Formato do Relatório

```
# RELATÓRIO DE TESTE — Vendedor AI v3.0
Data: [data]
Testador: [suas 3 personas]

## RESUMO EXECUTIVO
- Score geral: X/10
- Bugs críticos: N
- Bugs altos: N
- Pronto para vender: SIM / NÃO / COM CONDIÇÕES

## ACHADOS POR SEÇÃO
[Para cada seção testada]

### [Nome da Seção]
**Status:** 🔴/🟠/🟡/🟢/⭐
**O que testei:** [lista]
**O que encontrei:**
- [achado 1 + severidade + evidência]
- [achado 2 + severidade + evidência]
**Veredicto do comprador:** [frase]

## BUGS E INCONSISTÊNCIAS (LISTA COMPLETA)
[Numerados, com severidade, localização, como reproduzir, e impacto]

## ANÁLISE DE SEGURANÇA
[Autenticação, tokens, dados expostos, XSS, injection]

## VEREDICTO DO COMPRADOR
[Parágrafo honesto: compraria ou não? Por quê? O que faria mudar de ideia?]

## TOP 5 AÇÕES URGENTES
[Ordenadas por impacto no fechamento de contrato]
```

## Regras Invioláveis

1. **Nunca assuma que algo funciona** — teste e comprove
2. **Nunca ignore um detalhe visual** — clientes pagantes notam tudo
3. **Se um botão existe, clique nele** — e documente o resultado
4. **Se um campo existe, teste com lixo** — "###", "", "a".repeat(10000), emojis
5. **Compare dados entre seções** — o número de leads no KPI bate com o CRM?
6. **Documente com evidências** — print da tela, resposta da API, ou descrição exata
7. **Não suavize nada** — o objetivo é encontrar tudo que está errado ANTES de um cliente encontrar
8. **Teste o fluxo completo pelo menos 1 vez**: Configurar nicho → Iniciar Autopilot → Ver leads no CRM → Ver DMs geradas → Revisar → (simular envio)
