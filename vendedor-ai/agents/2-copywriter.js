// =============================================================
// MODULO 2: COPYWRITER AI - PRISMATIC LABS VENDEDOR AUTOMATICO
// Gera DM hiperpersonalizada usando few-shot + analise de posts
// + Aprendizado continuo via style-memory.json (11-learner.js)
// Stack: Groq Llama 3.3 70B (fallback: Gemini se GROQ_API_KEY invalida)
// =============================================================

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const username     = process.argv[2] || process.env.LEAD_USERNAME;
const analysisFile = path.join(__dirname, '..', 'data', 'leads', `${username}_analysis.json`);

const templates = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'copywriting-templates.json'), 'utf8'));
const produtos  = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'produtos.json'), 'utf8')).produtos;

// ---- AUTO-DETECT LLM PROVIDER ----
let model, generateFunc, provider;

// PRIORIDADE 1: Groq (mais estável + grátis)
if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.startsWith('gsk_')) {
  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    model = groq;
    provider = 'groq';
    console.log('[COPYWRITER] Using Groq Llama 3.3 70B (primary)');
  } catch (e) {
    console.log('[COPYWRITER] Groq falhou, tentando Gemini fallback');
    provider = null;
  }
}

// FALLBACK: Gemini (se Groq não disponível)
if (!provider && process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.startsWith('AIza')) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    provider = 'gemini';
    console.log('[COPYWRITER] Using Google Gemini 1.5 Flash (fallback)');
  } catch (e) {
    console.error('[COPYWRITER] Nenhum LLM disponível. Configure GROQ_API_KEY ou GOOGLE_API_KEY no .env');
    process.exit(1);
  }
}

if (!provider) {
  console.error('[COPYWRITER] ERRO: Nenhuma API key válida encontrada.');
  console.error('[COPYWRITER] Configure GROQ_API_KEY (recomendado) ou GOOGLE_API_KEY no .env');
  process.exit(1);
}

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
    if (c === '\\') { escaped = true; result += c; continue; }
    if (c === '"')  { inString = !inString; result += c; continue; }
    if (inString && c === '\n') { result += '\\n'; continue; }
    if (inString && c === '\r') { result += '\\r'; continue; }
    if (inString && c === '\t') { result += '\\t'; continue; }
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

  const a     = analysisData.analise;
  const isAPI = a.servico_ideal === 'lead_normalizer_api';
  const ap    = a.analise_posts || {};

  // ---- CONTEXTO DO PRODUTO ----
  let contexto_produto;
  if (isAPI) {
    const api = produtos.find(p => p.id === 'lead-normalizer-api');
    const objecoesStr = api.objecoes.map(o => `\"${o.objecao}\" -> \"${o.resposta}\"`).join('\n');
    contexto_produto = `PRODUTO: Lead Normalizer API\nURL: ${api.url_landing}\nO que faz: ${api.descricao}\nUSPs: ${api.usp.slice(0, 3).join(' | ')}\nObjecoes:\n${objecoesStr}\nTom: dev para dev, direto, parece mensagem de colega\nAVISO: NAO mencione precos, planos, free, gratis ou valores — isso vai para followup, nunca para primeiro contato`;
  } else {
    const lp = produtos.find(p => p.id === 'landing-page-premium');
    const objecoesStr = lp.objecoes.map(o => `\"${o.objecao}\" -> \"${o.resposta}\"`).join('\n');
    contexto_produto = `PRODUTO: Landing Page Premium Dark Mode + Neon\nO que faz: ${lp.descricao}\nUSPs: ${lp.usp.slice(0, 3).join(' | ')}\nPrecos: R$1.497 a R$5.997\nObjecoes:\n${objecoesStr}\nTom: aspiracional, focado em resultado`;
  }

  // ---- CONTEXTO DE POSTS ----
  const postsContext = ap.tem_posts_analisados
    ? `\nINSIGHTS DOS POSTS:\n- Ferramentas: ${(ap.ferramentas_mencionadas || []).join(', ') || 'nenhuma'}\n- Dores: ${(ap.dores_identificadas || []).join(' | ') || 'nenhuma'}\n- Oportunidades: ${(ap.oportunidades || []).join(' | ') || 'nenhuma'}\n- GANCHO IDEAL: ${ap.gancho_ideal || 'nenhum'}\n\nREGRA: mensagem_1 DEVE abrir com o gancho ideal acima.`
    : '';

  const estruturaIdeal = isAPI
    ? `ESTRUTURA OBRIGATORIA (3 partes, CADA mensagem deve ter as 3):\n[HOOK] 1 linha especifica ao problema do lead (ex: \"Seus flows quebram quando o telefone chega fora do formato?\")\n[VALOR] 1-2 linhas: o que a API resolve + prova concreta SEM mencionar preco (ex: \"Fiz uma API que converte qualquer formato BR pra E.164 em menos de 50ms, pronta pro Make, n8n e Zapier.\")\n[PERGUNTA] 1 linha simples (ex: \"Vale testar?\")\nMINIMO: 3 linhas. Mensagem de 1 linha = INVALIDO.\nPROIBIDO no texto da mensagem: free, gratis, plano, preco, $, R$, sem cartao, trial, desconto.`
    : `ESTRUTURA OBRIGATORIA (3 partes, CADA mensagem deve ter as 3):\n[HOOK] 1 linha sobre conversao ou lancamento do lead\n[VALOR] 1-2 linhas: resultado concreto SEM mencionar preco (ex: \"Faco LP dark mode: clientes chegando a 22% vs media 6%\")\n[PERGUNTA] 1 linha simples\nMINIMO: 3 linhas. Mensagem de 1 linha = INVALIDO.\nPROIBIDO no texto da mensagem: preco, R$, $, plano, gratis, free, desconto, investimento.`;

  // ---- INJETAR APRENDIZADO ACUMULADO ----
  const memoria = loadMemory();
  let memoriaStr = '';
  if (memoria?.regras_copywriting?.length) {
    const prodAngle = isAPI ? memoria.angulos_por_produto?.lead_normalizer_api : memoria.angulos_por_produto?.landing_page;
    memoriaStr = `\nAPRENDIZADO ACUMULADO (v${memoria.versao} — ${memoria.total_amostras} amostras, score medio ${memoria.score_medio}/100):\n\nREGRAS APRENDIDAS — siga TODAS obrigatoriamente:\n${memoria.regras_copywriting.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nERROS PARA NUNCA REPETIR:\n${(memoria.erros_recorrentes || []).map(e => `- ${e}`).join('\n') || '(nenhum ainda)'}\n${prodAngle ? `\nANGULO MAIS EFICAZ (${a.servico_ideal}): ${prodAngle.melhor_angulo}\nEVITAR: ${(prodAngle.evitar || []).join(' | ')}` : ''}\n`;
    console.log(`[COPYWRITER] 🧠 Memoria v${memoria.versao} carregada (${memoria.regras_copywriting.length} regras)`);
  } else {
    console.log('[COPYWRITER] 📝 Sem memoria previa — gerando sem aprendizado acumulado');
  }

  const prompt = `Voce e o melhor copywriter do Brasil para vendas B2B via DM no Instagram.\n\n${contexto_produto}\n\nDADOS DO LEAD:\n- Nicho: ${a.nicho}\n- Tipo: ${a.tipo_negocio}\n- Problema: ${a.problema_principal}\n- Consciencia: ${a.nivel_consciencia}\n- Angulo: ${a.angulo_abordagem}\n- Objecoes: ${JSON.stringify(a.objecoes_previstas)}\n- Motivo produto: ${a.motivo_produto}\n- Prioridade: ${a.prioridade}\n${postsContext}\n\n${estruturaIdeal}\n${memoriaStr}\nREGRAS FINAIS:\n1. NUNCA coloque @handle no texto da mensagem\n2. NAO comece com \"Vi seu perfil\", \"Parabens\", \"Notei que\"\n3. Tom: colega util, nao vendedor\n4. Followups: 2-3 linhas naturais, sem @handle\n5. Use \\\\n para quebras de linha no JSON\n6. PROIBIDO em mensagem_1/2/3: free, gratis, plano, preco, R$, $, sem cartao, trial, desconto — preco so em followup se o lead perguntar\n7. NAO use linguagem de vendedor: \"solucao\", \"investimento\", \"beneficios\", \"diferenciais\" — escreva como colega de profissao\n\nRetorne SOMENTE o JSON (sem markdown, sem backticks, sem texto fora do JSON):\n{\n  \"mensagem_1\": {\"texto\": \"HOOK aqui.\\\\n\\\\nVALOR aqui.\\\\n\\\\nPERGUNTA?\", \"angulo\": \"...\", \"temperatura\": \"direta\"},\n  \"mensagem_2\": {\"texto\": \"HOOK aqui.\\\\n\\\\nVALOR aqui.\\\\n\\\\nPERGUNTA?\", \"angulo\": \"...\", \"temperatura\": \"suave\"},\n  \"mensagem_3\": {\"texto\": \"HOOK aqui.\\\\n\\\\nVALOR aqui.\\\\n\\\\nPERGUNTA?\", \"angulo\": \"...\", \"temperatura\": \"curiosidade\"},\n  \"mensagem_recomendada\": \"1\",\n  \"motivo_recomendacao\": \"...\",\n  \"followup_dia_3\": \"2-3 linhas naturais\",\n  \"followup_dia_7\": \"2-3 linhas com valor concreto\",\n  \"followup_dia_14\": \"2-3 linhas com oferta especifica\"\n}`;

  try {
    let rawResponse;

    if (provider === 'groq') {
      const completion = await model.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 2500,
      });
      rawResponse = completion.choices[0].message.content.trim();
    } else {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 2500,
          topP: 0.95,
          topK: 40,
        },
      });
      rawResponse = result.response.text().trim();
    }

    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta nao contem JSON valido');

    const sanitized = sanitizeJSON(jsonMatch[0]);
    const messages  = JSON.parse(sanitized);

    const outputDir = path.join(__dirname, '..', 'data', 'mensagens');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const resultData = {
      timestamp:         new Date().toISOString(),
      username,
      produto_detectado: a.servico_ideal,
      analise_score:     a.score_potencial,
      prioridade:        a.prioridade,
      posts_analisados:  ap.tem_posts_analisados || false,
      learning_versao:   memoria?.versao || null,
      mensagens:         messages
    };

    const outputFile = path.join(outputDir, `${username}_mensagens.json`);
    fs.writeFileSync(outputFile, JSON.stringify(resultData, null, 2));

    const recKey    = `mensagem_${messages.mensagem_recomendada}`;
    const recMsg    = messages[recKey];
    const prodLabel = isAPI ? '🔵 Lead Normalizer API' : '🟡 Landing Page';
    const postsLbl  = ap.tem_posts_analisados ? ' + posts ✓' : '';

    console.log(`\n[COPYWRITER] Mensagens geradas!`);
    console.log(`[COPYWRITER] Produto: ${prodLabel}${postsLbl}`);
    console.log(`[COPYWRITER] Recomendada: #${messages.mensagem_recomendada} - ${messages.motivo_recomendacao}`);
    console.log(`\n========== COPIE E COLE ESTA MENSAGEM ==========`);
    console.log(recMsg?.texto?.replace(/\\n/g, '\n'));
    console.log(`================================================\n`);
    console.log(`[COPYWRITER] Arquivo: ${outputFile}`);
    console.log(`\nMESSAGES_OUTPUT=${JSON.stringify(resultData)}`);

    return resultData;
  } catch (error) {
    console.error('[COPYWRITER] Erro:', error.message);
    if (error.message.includes('API key')) {
      console.error('[COPYWRITER] API key invalida. Verifique GROQ_API_KEY ou GOOGLE_API_KEY no .env');
    }
    process.exit(1);
  }
}

generateMessage();
