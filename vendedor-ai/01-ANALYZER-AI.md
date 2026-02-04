# 🦀 ANALYZER AI - Especificação Técnica

**Status:** 🟠 Em desenvolvimento (04/Fev/2026)

---

## OBJETIVO

Criar IA que analisa um perfil de lead (Instagram/LinkedIn) e extrai:
- Perfil de negócio
- Dores principais
- Oportunidade de venda
- Ticket estimado
- Score de qualificação (0-100)

---

## INPUT

```json
{
  "username": "@designdaju",
  "platform": "instagram"
}
```

---

## PROCESS

### 1. SCRAPING PERFIL
- Número de seguidores
- Bio (extração de keywords)
- Ültimos 5 posts
- Engajamento médio

### 2. ANALYSIS COM IA (Claude)
Prompt:
```
Analize este perfil de Instagram:
- Bio: {bio}
- Seguidores: {seguidores}
- Ültimos posts: {posts}

Identifique:
1. Nicho/indústria principal
2. Principais dores (o que está faltando)
3. Qual serviço Prismatic resolve
4. Ticket provável (R$)
5. Score 0-100

Responda em JSON.
```

### 3. ENRICH COM DATABASE
- Compara nicho com nicho-alvo
- Ajusta score baseado em perfil
- Identifica angle de abordagem­agem

---

## OUTPUT

```json
{
  "username": "@designdaju",
  "perfil": {
    "nicho": "Designer Gráfico",
    "seguidores": 5200,
    "ativo_dias": 2,
    "engajamento": "3.2%"
  },
  "analise": {
    "gap_principal": "Não tem site profissional",
    "dor_especifica": "Perde 50% clientes por falta de site",
    "servico_ideal": "Landing page + Instagram Shop",
    "angle": "Case de designer em BH com +40% vendas",
    "ticket_estimado": 1200
  },
  "qualificacao": {
    "score": 92,
    "nicho_match": "Excelente fit",
    "urgencia": "Alta (comment menciona falta de conversos)"
  },
  "ready_for_copywriter": true
}
```

---

## TECH STACK

- **Input:** REST API (n8n)
- **Scraper:** Puppeteer / Apify
- **IA:** Claude API (Sonnet)
- **Storage:** Notion DB
- **Output:** JSON → Dashboard

---

## TESTS

Testar com 10 perfis reais:
- [ ] @designdaju (designer)
- [ ] @lojaroupasbh (e-commerce)
- [ ] @coachmkt (coach)
- ...

Validar:
- Accuracy do score (vs. realidade)
- Tempo de execução (<30s)
- Taxa de erro

---

## NEXT STEPS

1. Implement scraper Instagram (05/Fev)
2. Integrate Claude API (05/Fev)
3. Test com 10 leads (05/Fev)
4. Integrate com Copywriter AI (06/Fev)
