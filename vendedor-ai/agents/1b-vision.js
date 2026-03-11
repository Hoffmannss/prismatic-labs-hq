// =============================================================
// MODULO 1B: VISION ANALYZER - PRISMATIC LABS VENDEDOR AI
// Analisa imagens dos posts do lead para extrair sinais
// que texto puro nao revela: ferramentas em uso, tipo de
// negocio real, nivel tecnico, dores visiveis em tela.
//
// Usa: Gemini 1.5 Flash (GOOGLE_API_KEY)
// Custo: ~$0.0005 por lead (3 imagens) — plano pago necessario
// Fallback: pula silenciosamente se sem API key ou quota zerada
//
// Uso:
//   node 1b-vision.js @username                -> analisa via LEAD_IMAGE_URLS env
//   node 1b-vision.js @username "url1|url2"    -> imagens como argumento
// =============================================================

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

const LEADS_DIR = path.join(__dirname, '..', 'data', 'leads');

// ---- CONFIGURACAO ----
const username   = (process.argv[2] || process.env.LEAD_USERNAME || '').replace('@', '');
const urlsArg    = process.argv[3] || process.env.LEAD_IMAGE_URLS || '';
const imageUrls  = urlsArg.split('|').map(u => u.trim()).filter(Boolean).slice(0, 4);

if (!username) {
  console.error('[VISION] ERRO: username obrigatorio');
  process.exit(1);
}

// ---- OUTPUT FILE ----
const visionFile = path.join(LEADS_DIR, `${username}_vision.json`);
const analysisFile = path.join(LEADS_DIR, `${username}_analysis.json`);

// ---- VERIFICAR SE JA FOI ANALISADO ----
if (fs.existsSync(visionFile)) {
  try {
    const cached = JSON.parse(fs.readFileSync(visionFile, 'utf8'));
    if (cached.status === 'ok' && cached.sintese) {
      console.log(`[VISION] @${username} — visao ja cacheada. Pulando.`);
      process.exit(0);
    }
  } catch (_) {}
}

// ---- VERIFICAR API KEY ----
if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_API_KEY.startsWith('AIza')) {
  console.log(`[VISION] GOOGLE_API_KEY ausente — analise visual desativada`);
  process.exit(0);
}

// ---- CARREGAR SDK ----
let genAI, model;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
} catch (e) {
  console.log(`[VISION] @google/generative-ai nao disponivel — pulando`);
  process.exit(0);
}

// ---- OBTER IMAGE URLs ----
// Prioridade: argumento CLI / env var > arquivo de analise existente
function getImageUrlsFromAnalysis() {
  try {
    if (!fs.existsSync(analysisFile)) return [];
    const a = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
    return (a.dados_perfil?.recentPosts || [])
      .filter(p => p.imageUrl)
      .map(p => p.imageUrl)
      .slice(0, 4);
  } catch (_) { return []; }
}

const urls = imageUrls.length > 0 ? imageUrls : getImageUrlsFromAnalysis();

if (urls.length === 0) {
  console.log(`[VISION] @${username} — sem imagens disponíveis. Pulando.`);
  // Salva marcador para nao tentar novamente
  fs.writeFileSync(visionFile, JSON.stringify({
    username, status: 'sem_imagens', timestamp: new Date().toISOString(),
    sintese: null, posts: []
  }, null, 2));
  process.exit(0);
}

// ---- DOWNLOAD DE IMAGEM PARA BASE64 ----
function downloadImageBase64(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Referer': 'https://www.instagram.com/',
      },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf    = Buffer.concat(chunks);
        const base64 = buf.toString('base64');
        const mime   = res.headers['content-type'] || 'image/jpeg';
        resolve({ base64, mime: mime.split(';')[0].trim() });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ---- PROMPT DE ANALISE DE IMAGEM ----
function buildImagePrompt(index, caption) {
  const captionNote = caption ? `\nCaption do post: "${caption.slice(0, 300)}"` : '';
  return `Voce e um especialista em analise de perfis para prospeccao B2B no Instagram.
Analise esta imagem (post ${index + 1}) de um perfil do Instagram.${captionNote}

Responda APENAS em JSON valido, sem texto adicional:
{
  "tipo_conteudo": "screenshot_ferramenta|diagrama_flow|resultado_grafico|video_demo|print_codigo|foto_pessoal|conteudo_educacional|promocional|instalacao_fisica|outro",
  "ferramentas_visiveis": ["liste APENAS ferramentas/plataformas identificaveis: n8n, Make, Zapier, ClickUp, Airtable, HubSpot, ActiveCampaign, Google Ads, Meta Ads, etc. Deixe vazio se nao identificar nenhuma"],
  "contexto_negocio": "automacao_digital|automacao_predial_eletrica|marketing_digital|infoprodutor|ecommerce|servicos_gerais|tecnologia_software|outro",
  "dores_visiveis": ["problemas ou desafios que aparecem na imagem, ex: 'erro no flow', 'tabela desorganizada', 'processo manual'"],
  "nivel_tecnico": "basico|intermediario|avancado",
  "sinal_relevante": true,
  "motivo": "em 1 frase: por que este post e ou nao e relevante para oferecer uma API de normalizacao de dados"
}`;
}

// ---- SINTESE FINAL ----
function buildSintese(postResults, analysisData) {
  const relevant = postResults.filter(p => p.analysis && p.analysis.sinal_relevante);
  const irrelevant = postResults.filter(p => p.analysis && !p.analysis.sinal_relevante);

  // Agregar ferramentas
  const ferramentas = new Set();
  postResults.forEach(p => {
    (p.analysis?.ferramentas_visiveis || []).forEach(f => ferramentas.add(f.toLowerCase()));
  });

  // Agregar dores
  const dores = [];
  postResults.forEach(p => {
    (p.analysis?.dores_visiveis || []).forEach(d => { if (d) dores.push(d); });
  });

  // Contexto predominante
  const contextos = postResults.map(p => p.analysis?.contexto_negocio).filter(Boolean);
  const contextoMap = {};
  contextos.forEach(c => { contextoMap[c] = (contextoMap[c] || 0) + 1; });
  const contextoPredominante = Object.entries(contextoMap).sort((a,b) => b[1]-a[1])[0]?.[0] || 'desconhecido';

  // Nivel tecnico predominante
  const niveis = { basico: 1, intermediario: 2, avancado: 3 };
  const nivelMax = postResults
    .map(p => p.analysis?.nivel_tecnico)
    .filter(Boolean)
    .map(n => niveis[n] || 1)
    .reduce((max, v) => Math.max(max, v), 1);
  const nivelFinal = Object.entries(niveis).find(([, v]) => v === nivelMax)?.[0] || 'basico';

  // Score adjustment
  let scoreAjuste = 0;
  if (ferramentas.size > 0) scoreAjuste += 15;  // usa ferramentas relevantes
  if (relevant.length >= 2) scoreAjuste += 10;   // maioria dos posts relevante
  if (contextoPredominante === 'automacao_predial_eletrica') scoreAjuste -= 20; // lead errado
  if (contextoPredominante === 'servicos_gerais') scoreAjuste -= 10;
  if (nivelFinal === 'avancado') scoreAjuste += 5;

  // Gancho visual
  let ganchoVisual = null;
  if (ferramentas.size > 0) {
    const ferList = Array.from(ferramentas).slice(0, 3).join(', ');
    ganchoVisual = `Vi que você trabalha com ${ferList} — nossos flows costumam ter problema com telefones fora do padrão BR...`;
  } else if (relevant.length > 0) {
    ganchoVisual = relevant[0].analysis?.motivo || null;
  }

  return {
    posts_analisados:         postResults.length,
    posts_relevantes:         relevant.length,
    ferramentas_confirmadas:  Array.from(ferramentas),
    dores_identificadas:      [...new Set(dores)].slice(0, 5),
    nivel_tecnico:            nivelFinal,
    tipo_conteudo_predominante: postResults[0]?.analysis?.tipo_conteudo || 'desconhecido',
    contexto_confirmado:      contextoPredominante,
    gancho_visual:            ganchoVisual,
    score_ajuste:             scoreAjuste,
    descartavel: contextoPredominante === 'automacao_predial_eletrica'
      || (relevant.length === 0 && postResults.length >= 2),
  };
}

// ---- MAIN ----
async function analyzeVision() {
  console.log(`\n[VISION] Iniciando analise visual: @${username} (${urls.length} imagens)`);

  // Ler captions do arquivo de analise se existir
  let captionsMap = {};
  try {
    if (fs.existsSync(analysisFile)) {
      const a = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
      (a.dados_perfil?.recentPosts || []).forEach((p, i) => {
        captionsMap[p.imageUrl] = p.caption || '';
      });
    }
  } catch (_) {}

  const postResults = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const caption = captionsMap[url] || '';
    process.stdout.write(`  [VISION ${i+1}/${urls.length}] `);

    try {
      // Download imagem
      const { base64, mime } = await downloadImageBase64(url);
      process.stdout.write(`download OK (${Math.round(base64.length * 0.75 / 1024)}KB) → `);

      // Enviar para Gemini
      const prompt = buildImagePrompt(i, caption);
      const result = await model.generateContent([
        { inlineData: { data: base64, mimeType: mime } },
        prompt,
      ]);

      const raw = result.response.text().trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Resposta nao tem JSON valido');

      const analysis = JSON.parse(jsonMatch[0]);
      postResults.push({ index: i, url, caption: caption.slice(0, 200), analysis });

      const emoji = analysis.sinal_relevante ? '✅' : '⬜';
      process.stdout.write(`${emoji} ${analysis.tipo_conteudo} | ctx=${analysis.contexto_negocio}\n`);

    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
        console.log(`quota — pulando analise visual`);
        // Salva marcador de quota exceeded para nao tentar novamente por 1h
        fs.writeFileSync(visionFile, JSON.stringify({
          username, status: 'quota_exceeded', timestamp: new Date().toISOString(),
          sintese: null, posts: []
        }, null, 2));
        process.exit(0);
      }
      process.stdout.write(`erro: ${msg.slice(0, 60)}\n`);
      postResults.push({ index: i, url, caption: caption.slice(0, 200), analysis: null, erro: msg });
    }

    // Delay entre imagens (evitar rate limit)
    if (i < urls.length - 1) await new Promise(r => setTimeout(r, 1500));
  }

  if (postResults.length === 0 || postResults.every(p => !p.analysis)) {
    console.log(`[VISION] Nenhuma imagem analisada com sucesso.`);
    process.exit(0);
  }

  // Sintese
  const sintese = buildSintese(postResults);

  const output = {
    username,
    status:    'ok',
    timestamp: new Date().toISOString(),
    sintese,
    posts:     postResults,
  };

  fs.mkdirSync(LEADS_DIR, { recursive: true });
  fs.writeFileSync(visionFile, JSON.stringify(output, null, 2));

  // Imprimir resultado
  console.log(`\n[VISION] ========== RESULTADO ==========`);
  console.log(`  Ferramentas: ${sintese.ferramentas_confirmadas.join(', ') || 'nenhuma identificada'}`);
  console.log(`  Contexto:    ${sintese.contexto_confirmado}`);
  console.log(`  Nível:       ${sintese.nivel_tecnico}`);
  console.log(`  Score:       ${sintese.score_ajuste >= 0 ? '+' : ''}${sintese.score_ajuste}`);
  if (sintese.descartavel) {
    console.log(`  ⚠️  LEAD DESCARTAVEL: contexto nao alinhado ao produto`);
  }
  if (sintese.gancho_visual) {
    console.log(`  Gancho:      ${sintese.gancho_visual}`);
  }
  console.log(`[VISION] Salvo em: ${visionFile}`);
  console.log(`VISION_OUTPUT=${JSON.stringify({ score_ajuste: sintese.score_ajuste, contexto: sintese.contexto_confirmado, ferramentas: sintese.ferramentas_confirmadas, descartavel: sintese.descartavel })}`);
}

analyzeVision().catch(e => {
  console.error(`[VISION] Erro fatal: ${e.message}`);
  process.exit(0); // exit 0 para nao travar o pipeline
});
