// =============================================================
// MODULO 1: ANALYZER AI - PRISMATIC LABS VENDEDOR AUTOMATICO
// Analisa perfil + posts e detecta produto ideal (API ou LP)
// Stack: Groq API (Llama 3.3 70B) - GRATIS
// =============================================================

require('dotenv').config();
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ---- CARREGAR KNOWLEDGE BASE ----
const nichosConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'nichos-config.json'), 'utf8'));
const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'produtos.json'), 'utf8')).produtos;

// ---- DADOS DO LEAD ----
const username   = process.argv[2] || process.env.LEAD_USERNAME || 'exemplo_lead';
const bioText    = process.argv[3] || process.env.LEAD_BIO || '';
const followersCount = process.argv[4] || process.env.LEAD_FOLLOWERS || '0';
const postsCount = process.argv[5] || process.env.LEAD_POSTS || '0';
const postsDesc  = process.argv[6] || process.env.LEAD_POSTS_DESC || '';

// ---- MONTAR CONTEXTO DOS PRODUTOS ----
const api = produtos.find(p => p.id === 'lead-normalizer-api');
const nichosSinaisAPI = nichosConfig.nichos
  .filter(n => n.produto_alvo === 'lead_normalizer_api')
  .map(n => `- ${n.nome}: sinais [${n.sinais ? n.sinais.join(', ') : n.keywords.join(', ')}]`)
  .join('\n');

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
  const prompt = `Voce e o SUPER VENDEDOR da Prismatic Labs.

A Prismatic Labs tem 2 produtos:

PRODUTO A - Lead Normalizer API (SaaS, recorrente em USD)
- O que faz: 1 chamada normaliza telefone BR para E.164, limpa email, parseia UTMs, gera SHA-256 dedupe hash
- Preco: Free (100 req/mes), Starter $29/mes, Pro $79/mes, Enterprise $199/mes
- URL: ${api.url_landing}
- Ideal para: ${api.icp.primario.join('; ')}
- Sinais no perfil para detectar API lead:
${nichosSinaisAPI}

PRODUTO B - Landing Page Premium Dark Mode + Neon (servico, pagamento unico)
- O que faz: landing pages premium para infoprodutores
- Preco: R$1.497 a R$5.997
- Ideal para: infoprodutores, ecommerce, coaches, consultores com audiencia

PERFIL A ANALISAR:
- Username: @${username}
- Bio: ${bioText || 'Nao disponivel'}
- Seguidores: ${followersCount}
- Posts: ${postsCount}
${postsSection}
INSTRUCAO CRITICA PARA DETECCAO DE PRODUTO:
- Bio/posts com Make.com, n8n, Zapier, automacao, CRM, trafego, leads, webhook, API, SaaS, dev, integracao -> servico_ideal = "lead_normalizer_api"
- Bio/posts com infoprodutor, lancamento, coach, ecommerce, criador de conteudo, mentoria -> servico_ideal = "landing_page"
- Em caso de duvida: analise o tipo de negocio e decida pelo produto com mais chance de dor real

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
  "servico_ideal": "lead_normalizer_api" ou "landing_page",
  "motivo_produto": "por que este produto resolve a dor DESTE lead especificamente",
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

    const produtoLabel = analysis.servico_ideal === 'lead_normalizer_api' ? '🔵 Lead Normalizer API' : '🟣 Landing Page Premium';

    console.log(`\n[ANALYZER] Analise concluida!`);
    console.log(`[ANALYZER] Score de potencial: ${analysis.score_potencial}/100`);
    console.log(`[ANALYZER] Prioridade: ${analysis.prioridade?.toUpperCase()}`);
    console.log(`[ANALYZER] Produto detectado: ${produtoLabel}`);
    console.log(`[ANALYZER] Problema principal: ${analysis.problema_principal}`);
    console.log(`[ANALYZER] Motivo: ${analysis.motivo_produto}`);

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
