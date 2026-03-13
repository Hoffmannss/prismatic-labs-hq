// =============================================================
// MODULO 1: ANALYZER AI - PRISMATIC LABS VENDEDOR AUTOMATICO
// Analisa perfil + posts e identifica fit com o produto do usuário
// Stack: Groq API (Llama 3.3 70B) - GRATIS
// Funciona para QUALQUER nicho/produto — configurado via Dashboard
// =============================================================

require('dotenv').config();
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const { loadNegocio, buildContexto } = require('../config/negocio-config');

// ---- CONFIGURAÇÃO DO NEGÓCIO (definida no Dashboard) ----
const negocio        = loadNegocio();
const negocioCtx     = buildContexto(negocio);

// ---- DADOS DO LEAD ----
const username       = process.argv[2] || process.env.LEAD_USERNAME || 'exemplo_lead';
const bioText        = process.argv[3] || process.env.LEAD_BIO || '';
const followersCount = process.argv[4] || process.env.LEAD_FOLLOWERS || '0';
const postsCount     = process.argv[5] || process.env.LEAD_POSTS || '0';
const postsDesc      = process.argv[6] || process.env.LEAD_POSTS_DESC || '';

async function analyzeProfile() {
  console.log(`\n[ANALYZER] Iniciando analise do perfil: @${username}`);
  console.log(`[ANALYZER] Seguidores: ${followersCount} | Posts: ${postsCount}`);
  if (postsDesc) console.log(`[ANALYZER] Posts descritos: SIM ✓`);

  // ---- SECAO DE POSTS (se fornecida) ----
  const postsSection = postsDesc ? `
POSTS RECENTES DO PERFIL (analise com atencao — aqui estao as oportunidades reais):
${postsDesc}

Para os posts acima, identifique:
- Ferramentas ou plataformas mencionadas
- Dores ou problemas que o lead demonstra ter
- Oportunidades de abordagem especificas (ex: "postou sobre flow quebrando", "perguntou sobre deduplicacao")
- Se algum post e um gancho PERFEITO para a abordagem
` : '';

  // ---- PROMPT PRINCIPAL ----
  const prompt = `Você é um especialista em análise de perfis do Instagram para prospecção B2B/B2C.

${negocioCtx.prompt}

Seu objetivo: analisar o perfil abaixo e determinar o quanto esse lead é um potencial cliente para o produto/serviço acima.

PERFIL A ANALISAR:
- Username: @${username}
- Bio: ${bioText || 'Não disponível'}
- Seguidores: ${followersCount}
- Posts: ${postsCount}
${postsSection}
CRITÉRIOS DE SCORE (0-100):
- 80-100: Lead ideal — bio/posts mostram dor direta que o produto resolve
- 60-79:  Bom lead — perfil compatível com o público-alvo, sinal claro de interesse
- 40-59:  Lead morno — possível fit, mas sem sinal forte
- 20-39:  Lead frio — perfil genérico, pouco contexto
- 0-19:   Desqualificado — fora do público-alvo ou perfil irrelevante

INSTRUÇÃO: Avalie o fit entre o perfil do lead e o produto/serviço configurado.
Se o negócio não estiver configurado, faça uma análise genérica de qualidade do perfil para prospecção.

Responda JSON com esta estrutura:
{
  "score_potencial": (0-100, suba o score se os posts revelarem dor direta),
  "nicho": "nicho especifico",
  "tipo_negocio": "infoprodutor/ecommerce/agencia/dev/automacao/servicos/outro",
  "problema_principal": "problema mais especifico possivel com base na bio e posts",
  "nivel_consciencia": "nao_sabe/sabe_problema/sabe_solucao/produto_aware",
  "tamanho_negocio": "micro/pequeno/medio/grande",
  "urgencia_estimada": "baixa/media/alta",
  "angulo_abordagem": "angulo mais especifico possivel para este lead",
  "objecoes_previstas": ["lista"],
  "produto_sugerido": "nome do produto/servico do negocio configurado que melhor resolve a dor deste lead",
  "motivo_fit": "por que este produto resolve a dor DESTE lead especificamente",
  "preco_estimado_aceito": "faixa",
  "melhor_horario_contato": "manha/tarde/noite",
  "plataforma_adicional": "LinkedIn/YouTube/outro se visivel na bio",
  "insights_extras": "observacoes estrategicas importantes",
  "prioridade": "hot/warm/cold",
  "analise_posts": {
    "tem_posts_analisados": ${postsDesc ? 'true' : 'false'},
    "ferramentas_mencionadas": ["lista ou vazio"],
    "dores_identificadas": ["dores especificas dos posts ou vazio"],
    "oportunidades": ["oportunidades de abordagem especificas ou vazio"],
    "gancho_ideal": "melhor gancho baseado nos posts, ou null se sem posts",
    "score_boost": "justificativa se os posts aumentaram o score"
  }
}

RESPONDA APENAS O JSON, SEM TEXTO ADICIONAL.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 1200,
    });

    const rawResponse = completion.choices[0].message.content.trim();
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta nao contem JSON valido');

    const analysis = JSON.parse(jsonMatch[0]);

    const result = {
      timestamp: new Date().toISOString(),
      username,
      dados_perfil: { bio: bioText, seguidores: followersCount, posts: postsCount, posts_descritos: postsDesc || null },
      analise: analysis
    };

    const outputDir = path.join(__dirname, '..', 'data', 'leads');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, `${username}_analysis.json`);
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

    console.log(`\n[ANALYZER] Analise concluida!`);
    console.log(`[ANALYZER] Score de potencial: ${analysis.score_potencial}/100`);
    console.log(`[ANALYZER] Prioridade: ${analysis.prioridade?.toUpperCase()}`);
    if (analysis.produto_sugerido) console.log(`[ANALYZER] Produto sugerido: ${analysis.produto_sugerido}`);
    console.log(`[ANALYZER] Problema principal: ${analysis.problema_principal}`);
    if (analysis.motivo_fit) console.log(`[ANALYZER] Motivo fit: ${analysis.motivo_fit}`);

    if (analysis.analise_posts?.tem_posts_analisados) {
      console.log(`\n[ANALYZER] 📊 ANALISE DE POSTS:`);
      if (analysis.analise_posts.ferramentas_mencionadas?.length)
        console.log(`[ANALYZER]   Ferramentas: ${analysis.analise_posts.ferramentas_mencionadas.join(', ')}`);
      if (analysis.analise_posts.dores_identificadas?.length)
        console.log(`[ANALYZER]   Dores: ${analysis.analise_posts.dores_identificadas.join(' | ')}`);
      if (analysis.analise_posts.gancho_ideal)
        console.log(`[ANALYZER]   ✨ Gancho ideal: ${analysis.analise_posts.gancho_ideal}`);
      if (analysis.analise_posts.oportunidades?.length)
        console.log(`[ANALYZER]   Oportunidades: ${analysis.analise_posts.oportunidades.join(' | ')}`);
    }

    console.log(`[ANALYZER] Arquivo salvo: ${outputFile}`);
    process.env.ANALYSIS_RESULT = JSON.stringify(result);
    console.log(`\nANALYSIS_OUTPUT=${JSON.stringify(result)}`);

    return result;

  } catch (error) {
    console.error('[ANALYZER] Erro:', error.message);
    process.exit(1);
  }
}

analyzeProfile();
