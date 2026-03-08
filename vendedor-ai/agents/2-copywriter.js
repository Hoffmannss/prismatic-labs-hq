// =============================================================
// MODULO 2: COPYWRITER AI - PRISMATIC LABS VENDEDOR AUTOMATICO
// Gera DM hiperpersonalizada usando few-shot + analise de posts
// + Aprendizado continuo via style-memory.json (11-learner.js)
// Stack: Google Gemini 2.0 Flash - GRATIS e excelente para copy
// =============================================================

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs   = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

const username     = process.argv[2] || process.env.LEAD_USERNAME;
const analysisFile = path.join(__dirname, '..', 'data', 'leads', `${username}_analysis.json`);

const templates = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'copywriting-templates.json'), 'utf8'));
const produtos  = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'produtos.json'), 'utf8')).produtos;

// ---- LEARNING MEMORY ----------------------------------------
const MEMORY_FILE = path.join(__dirname, '..', 'data', 'learning', 'style-memory.json');
function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
  } catch {}
  return null;
}

// Sanitiza newlines literais dentro de strings JSON
function sanitizeJSON(str) {
  let inString = false;
  let escaped  = false;
  let result   = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escaped) { result += c; escaped = false; continue; }
    if (c === '\\\\') { escaped = true; result += c; continue; }
    if (c === '\"')  { inString = !inString; result += c; continue; }
    if (inString && c === '\n') { result += '\\\\n'; continue; }
    if (inString && c === '\r') { result += '\\\\r'; continue; }
    if (inString && c === '\t') { result += '\\\\t'; continue; }
    result += c;
  }
  return result;
}

async function generateMessage() {
  console.log(`\n[COPYWRITER] Gerando mensagem para: @${username}`);

  let analysisData;
  try {
    analysisData = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
  } catch (e) {
    const envData = process.env.ANALYSIS_OUTPUT;
    if (envData) { analysisData = JSON.parse(envData); }
    else { console.error('[COPYWRITER] Analise nao encontrada. Execute o Modulo 1 primeiro.'); process.exit(1); }
  }

  const a  = analysisData.analise;
  const isAPI = a.servico_ideal === 'lead_normalizer_api';
  const ap = a.analise_posts || {};

  // ---- CONTEXTO DO PRODUTO ----
  let contexto_produto;
  if (isAPI) {
    const api = produtos.find(p => p.id === 'lead-normalizer-api');
    const objecoesStr = api.objecoes.map(o => `"${o.objecao}" -> "${o.resposta}"`).join('\n');
    contexto_produto = `PRODUTO: Lead Normalizer API
URL: ${api.url_landing}
O que faz: ${api.descricao}
USPs: ${api.usp.slice(0, 3).join(' | ')}
Precos: Free (100 req/mes, sem cartao), Starter $29/mes, Pro $79/mes
Objecoes:\n${objecoesStr}
Tom: dev para dev, direto, parece mensagem de colega`;
  } else {
    const lp = produtos.find(p => p.id === 'landing-page-premium');
    const objecoesStr = lp.objecoes.map(o => `"${o.objecao}" -> "${o.resposta}"`).join('\n');
    contexto_produto = `PRODUTO: Landing Page Premium Dark Mode + Neon
O que faz: ${lp.descricao}
USPs: ${lp.usp.slice(0, 3).join(' | ')}
Precos: R$1.497 a R$5.997
Objecoes:\n${objecoesStr}
Tom: aspiracional, focado em resultado`;
  }

  // ---- CONTEXTO DE POSTS ----
  const postsContext = ap.tem_posts_analisados
    ? `\nINSIGHTS DOS POSTS:
- Ferramentas: ${(ap.ferramentas_mencionadas || []).join(', ') || 'nenhuma'}
- Dores: ${(ap.dores_identificadas || []).join(' | ') || 'nenhuma'}
- Oportunidades: ${(ap.oportunidades || []).join(' | ') || 'nenhuma'}
- GANCHO IDEAL: ${ap.gancho_ideal || 'nenhum'}

REGRA: mensagem_1 DEVE abrir com o gancho ideal acima.`
    : '';

  const estruturaIdeal = isAPI
    ? `ESTRUTURA OBRIGATORIA (3 partes, CADA mensagem deve ter as 3):
[HOOK] 1 linha especifica ao problema do lead (ex: "Seus flows do Make quebravam com telefone em formato errado?")
[VALOR] 1-2 linhas: o que a API resolve + prova concreta (ex: "Fiz uma API: qualquer formato BR -> E.164 em <50ms, pronta pro Make. Free plan sem cartao.")
[PERGUNTA] 1 linha simples (ex: "Vale testar?")
MINIMO: 3 linhas. Mensagem de 1 linha = INVALIDO.`
    : `ESTRUTURA OBRIGATORIA (3 partes, CADA mensagem deve ter as 3):
[HOOK] 1 linha sobre conversao ou lancamento do lead
[VALOR] 1-2 linhas: resultado concreto (ex: "Faco LP dark mode: clientes chegando a 22% vs media 6%")
[PERGUNTA] 1 linha simples
MINIMO: 3 linhas. Mensagem de 1 linha = INVALIDO.`;

  // ---- INJETAR APRENDIZADO ACUMULADO ----
  const memoria = loadMemory();
  let memoriaStr = '';
  if (memoria?.regras_copywriting?.length) {
    const prodAngle = isAPI ? memoria.angulos_por_produto?.lead_normalizer_api : memoria.angulos_por_produto?.landing_page;
    memoriaStr = `
APRENDIZADO ACUMULADO (v${memoria.versao} — ${memoria.total_amostras} amostras, score medio ${memoria.score_medio}/100):

REGRAS APRENDIDAS — siga TODAS obrigatoriamente:
${memoria.regras_copywriting.map((r, i) => `${i + 1}. ${r}`).join('\n')}

ERROS PARA NUNCA REPETIR:
${(memoria.erros_recorrentes || []).map(e => `- ${e}`).join('\n') || '(nenhum ainda)'}
${prodAngle ? `
ANGULO MAIS EFICAZ (${a.servico_ideal}): ${prodAngle.melhor_angulo}
EVITAR: ${(prodAngle.evitar || []).join(' | ')}` : ''}
`;
    console.log(`[COPYWRITER] 🧠 Memoria v${memoria.versao} carregada (${memoria.regras_copywriting.length} regras)`);
  } else {
    console.log('[COPYWRITER] 📝 Sem memoria previa — gerando sem aprendizado acumulado');
  }

  const prompt = `Voce e o melhor copywriter do Brasil para vendas B2B via DM no Instagram.

${contexto_produto}

DADOS DO LEAD:
- Nicho: ${a.nicho}
- Tipo: ${a.tipo_negocio}
- Problema: ${a.problema_principal}
- Consciencia: ${a.nivel_consciencia}
- Angulo: ${a.angulo_abordagem}
- Objecoes: ${JSON.stringify(a.objecoes_previstas)}
- Motivo produto: ${a.motivo_produto}
- Prioridade: ${a.prioridade}
${postsContext}

${estruturaIdeal}
${memoriaStr}
REGRAS FINAIS:
1. NUNCA coloque @handle no texto da mensagem
2. NAO comece com "Vi seu perfil", "Parabens", "Notei que"
3. Tom: colega util, nao vendedor
4. Followups: 2-3 linhas naturais, sem @handle
5. Use \\n para quebras de linha (sera convertido depois)

Retorne SOMENTE o JSON (sem markdown, sem backticks, sem texto fora do JSON):
{
  "mensagem_1": {"texto": "HOOK aqui.\\n\\nVALOR aqui.\\n\\nPERGUNTA?", "angulo": "...", "temperatura": "direta"},
  "mensagem_2": {"texto": "HOOK aqui.\\n\\nVALOR aqui.\\n\\nPERGUNTA?", "angulo": "...", "temperatura": "suave"},
  "mensagem_3": {"texto": "HOOK aqui.\\n\\nVALOR aqui.\\n\\nPERGUNTA?", "angulo": "...", "temperatura": "curiosidade"},
  "mensagem_recomendada": "1",
  "motivo_recomendacao": "...",
  "followup_dia_3": "2-3 linhas naturais",
  "followup_dia_7": "2-3 linhas com valor concreto",
  "followup_dia_14": "2-3 linhas com oferta especifica"
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2500,
      },
    });

    const rawResponse = result.response.text().trim();
    const jsonMatch   = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta nao contem JSON valido');

    const sanitized = sanitizeJSON(jsonMatch[0]);
    const messages  = JSON.parse(sanitized);

    const outputDir = path.join(__dirname, '..', 'data', 'mensagens');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const resultData = {
      timestamp:        new Date().toISOString(),
      username,
      produto_detectado: a.servico_ideal,
      analise_score:    a.score_potencial,
      prioridade:       a.prioridade,
      posts_analisados: ap.tem_posts_analisados || false,
      learning_versao:  memoria?.versao || null,
      mensagens:        messages
    };

    const outputFile = path.join(outputDir, `${username}_mensagens.json`);
    fs.writeFileSync(outputFile, JSON.stringify(resultData, null, 2));

    const recKey    = `mensagem_${messages.mensagem_recomendada}`;
    const recMsg    = messages[recKey];
    const prodLabel = isAPI ? '🔵 Lead Normalizer API' : '🟣 Landing Page';
    const postsLbl  = ap.tem_posts_analisados ? ' + posts ✓' : '';

    console.log(`\n[COPYWRITER] Mensagens geradas!`);
    console.log(`[COPYWRITER] Produto: ${prodLabel}${postsLbl}`);
    console.log(`[COPYWRITER] Recomendada: #${messages.mensagem_recomendada} - ${messages.motivo_recomendacao}`);
    console.log(`\n========== COPIE E COLE ESTA MENSAGEM ==========`);
    console.log(recMsg?.texto?.replace(/\\\\n/g, '\n'));
    console.log(`================================================\n`);
    console.log(`[COPYWRITER] Arquivo: ${outputFile}`);
    console.log(`\nMESSAGES_OUTPUT=${JSON.stringify(resultData)}`);

    return resultData;
  } catch (error) {
    console.error('[COPYWRITER] Erro:', error.message);
    if (error.message.includes('API key')) {
      console.error('[COPYWRITER] GOOGLE_API_KEY nao encontrada ou invalida. Pegue em: https://aistudio.google.com/apikey');
    }
    process.exit(1);
  }
}

generateMessage();
