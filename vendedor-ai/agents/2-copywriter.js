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
const visionFile   = path.join(__dirname, '..', 'data', 'leads', `${username}_vision.json`);

const templates = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'copywriting-templates.json'), 'utf8'));
const { loadNegocio, buildContexto } = require('../config/negocio-config');
const negocio    = loadNegocio();
const negocioCtx = buildContexto(negocio);

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

  const a  = analysisData.analise;
  const ap = a.analise_posts || {};

  // ---- CARREGAR DADOS DE VISÃO (1b-vision.js) ----
  let visionSintese = null;
  try {
    if (fs.existsSync(visionFile)) {
      const vd = JSON.parse(fs.readFileSync(visionFile, 'utf8'));
      if (vd.status === 'ok' && vd.sintese) {
        visionSintese = vd.sintese;
        console.log(`[COPYWRITER] 👁️  Vision carregada: ${vd.sintese.posts_analisados} posts | ferramentas: ${vd.sintese.ferramentas_confirmadas.join(', ') || 'nenhuma'}`);
      }
    }
  } catch (_) {}

  // ---- CONTEXTO DO PRODUTO (genérico via negocio-config) ----
  const produtoNome = a.produto_sugerido || negocioCtx.produto || 'Produto/serviço configurado';
  const precoInfo   = negocioCtx.preco ? `\nFaixa de preço: ${negocioCtx.preco}` : '';
  const contexto_produto = negocioCtx.resumo && negocioCtx.resumo !== '(Negócio não configurado — use tom genérico de prospecção)'
    ? `NEGÓCIO DO VENDEDOR:\n${negocioCtx.resumo}\nPRODUTO/SERVIÇO: ${produtoNome}${precoInfo}\nTom: colega útil, focado em resultado real para o lead\nAVISO: NAO mencione preços ou valores no primeiro contato — isso vai para followup`
    : `PRODUTO/SERVIÇO: Solução de automação/tecnologia para empreendedores\nTom: consultor direto, focado em dor do lead\nAVISO: NAO mencione preços ou valores no primeiro contato`;

  // ---- CONTEXTO DE POSTS (análise de texto) ----
  const postsContext = ap.tem_posts_analisados
    ? `\nINSIGHTS DOS POSTS (análise de texto):\n- Ferramentas mencionadas: ${(ap.ferramentas_mencionadas || []).join(', ') || 'nenhuma'}\n- Dores: ${(ap.dores_identificadas || []).join(' | ') || 'nenhuma'}\n- Oportunidades: ${(ap.oportunidades || []).join(' | ') || 'nenhuma'}\n- Gancho textual: ${ap.gancho_ideal || 'nenhum'}`
    : '';

  // ---- CONTEXTO DE VISÃO (análise de imagens — mais confiável que texto) ----
  let visionContext = '';
  if (visionSintese) {
    const ferrStr  = visionSintese.ferramentas_confirmadas.length > 0
      ? visionSintese.ferramentas_confirmadas.join(', ')
      : 'nenhuma identificada visualmente';
    const doresStr = visionSintese.dores_identificadas.length > 0
      ? visionSintese.dores_identificadas.join(' | ')
      : 'nenhuma';
    const ganchoVis = visionSintese.gancho_visual || null;

    visionContext = `\nANÁLISE VISUAL DOS POSTS (imagens analisadas por Gemini — MAIS CONFIÁVEL que texto):
- Ferramentas CONFIRMADAS nas imagens: ${ferrStr}
- Dores visíveis nos screenshots: ${doresStr}
- Nível técnico: ${visionSintese.nivel_tecnico}
- Contexto do negócio (imagens): ${visionSintese.contexto_confirmado}
${ganchoVis ? `- GANCHO VISUAL PRONTO: "${ganchoVis}"` : ''}

REGRAS DE USO DA VISÃO:
${ganchoVis
  ? `1. mensagem_1 DEVE começar com o GANCHO VISUAL acima (pode adaptar levemente o tom, mas preserve a referência às ferramentas/dores reais).`
  : `1. Use as ferramentas e dores confirmadas visualmente para personalizar as mensagens.`
}
2. Se ferramentas foram confirmadas nas imagens, mencione pelo menos 1 delas na mensagem de abertura.
3. Não mencione "vi suas imagens" ou "analisei seus posts" — fale como se você conhecesse o trabalho dele naturalmente.`;
  }

  // Gancho final: visão tem prioridade sobre texto (é baseada em evidência visual real)
  const ganchoFinal = visionSintese?.gancho_visual || ap.gancho_ideal || null;
  const postsContextFull = [postsContext, visionContext].filter(Boolean).join('\n');
  const hasGancho = !!ganchoFinal;
  const postsContextWithRule = postsContextFull
    ? postsContextFull + (hasGancho && !visionSintese?.gancho_visual
        ? `\n\nREGRA: mensagem_1 DEVE abrir com o gancho textual acima.`
        : '')
    : '';

  const estruturaIdeal = `ESTRUTURA OBRIGATORIA (3 partes, CADA mensagem deve ter as 3):\n[HOOK] 1 linha especifica ao problema identificado no perfil do lead\n[VALOR] 1-2 linhas: o que o produto/servico resolve + resultado concreto SEM mencionar preco\n[PERGUNTA] 1 linha simples e direta\nMINIMO: 3 linhas. Mensagem de 1 linha = INVALIDO.\nPROIBIDO no texto da mensagem: preco, R$, $, plano, gratis, free, desconto, investimento, solucao, beneficios.`;

  // ---- INJETAR APRENDIZADO ACUMULADO ----
  const memoria = loadMemory();
  let memoriaStr = '';
  if (memoria?.regras_copywriting?.length) {
    memoriaStr = `\nAPRENDIZADO ACUMULADO (v${memoria.versao} — ${memoria.total_amostras} amostras, score medio ${memoria.score_medio}/100):\n\nREGRAS APRENDIDAS — siga TODAS obrigatoriamente:\n${memoria.regras_copywriting.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nERROS PARA NUNCA REPETIR:\n${(memoria.erros_recorrentes || []).map(e => `- ${e}`).join('\n') || '(nenhum ainda)'}\n`;
    console.log(`[COPYWRITER] 🧠 Memoria v${memoria.versao} carregada (${memoria.regras_copywriting.length} regras)`);
  } else {
    console.log('[COPYWRITER] 📝 Sem memoria previa — gerando sem aprendizado acumulado');
  }

  const prompt = `Voce e o melhor copywriter do Brasil para vendas B2B via DM no Instagram.\n\n${contexto_produto}\n\nDADOS DO LEAD:\n- Nicho: ${a.nicho}\n- Tipo: ${a.tipo_negocio}\n- Problema: ${a.problema_principal}\n- Consciencia: ${a.nivel_consciencia}\n- Angulo: ${a.angulo_abordagem}\n- Objecoes: ${JSON.stringify(a.objecoes_previstas)}\n- Motivo fit: ${a.motivo_fit || a.motivo_produto || 'não especificado'}\n- Prioridade: ${a.prioridade}\n${postsContextWithRule}\n\n${estruturaIdeal}\n${memoriaStr}\nREGRAS FINAIS:\n1. NUNCA coloque @handle no texto da mensagem\n2. NAO comece com \"Vi seu perfil\", \"Parabens\", \"Notei que\"\n3. Tom: colega util, nao vendedor\n4. Followups: 2-3 linhas naturais, sem @handle\n5. Use \\\\n para quebras de linha no JSON\n6. PROIBIDO em mensagem_1/2/3: free, gratis, plano, preco, R$, $, sem cartao, trial, desconto — preco so em followup se o lead perguntar\n7. NAO use linguagem de vendedor: \"solucao\", \"investimento\", \"beneficios\", \"diferenciais\" — escreva como colega de profissao\n\nRetorne SOMENTE o JSON (sem markdown, sem backticks, sem texto fora do JSON):\n{\n  \"mensagem_1\": {\"texto\": \"HOOK aqui.\\\\n\\\\nVALOR aqui.\\\\n\\\\nPERGUNTA?\", \"angulo\": \"...\", \"temperatura\": \"direta\"},\n  \"mensagem_2\": {\"texto\": \"HOOK aqui.\\\\n\\\\nVALOR aqui.\\\\n\\\\nPERGUNTA?\", \"angulo\": \"...\", \"temperatura\": \"suave\"},\n  \"mensagem_3\": {\"texto\": \"HOOK aqui.\\\\n\\\\nVALOR aqui.\\\\n\\\\nPERGUNTA?\", \"angulo\": \"...\", \"temperatura\": \"curiosidade\"},\n  \"mensagem_recomendada\": \"1\",\n  \"motivo_recomendacao\": \"...\",\n  \"followup_dia_3\": \"2-3 linhas naturais\",\n  \"followup_dia_7\": \"2-3 linhas com valor concreto\",\n  \"followup_dia_14\": \"2-3 linhas com oferta especifica\"\n}`;

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
      timestamp:            new Date().toISOString(),
      username,
      produto_detectado:    a.produto_sugerido || negocioCtx.produto || '(não configurado)',
      analise_score:        a.score_potencial,
      prioridade:           a.prioridade,
      posts_analisados:     ap.tem_posts_analisados || false,
      vision_analisada:     !!visionSintese,
      vision_ferramentas:   visionSintese?.ferramentas_confirmadas || [],
      vision_score_ajuste:  visionSintese?.score_ajuste ?? null,
      learning_versao:      memoria?.versao || null,
      mensagens:            messages
    };

    const outputFile = path.join(outputDir, `${username}_mensagens.json`);
    fs.writeFileSync(outputFile, JSON.stringify(resultData, null, 2));

    const recKey   = `mensagem_${messages.mensagem_recomendada}`;
    const recMsg   = messages[recKey];
    const postsLbl = ap.tem_posts_analisados ? ' + posts ✓' : '';
    const visionLbl = visionSintese ? ` + vision ✓ (${visionSintese.ferramentas_confirmadas.length} ferramentas)` : '';

    console.log(`\n[COPYWRITER] Mensagens geradas!`);
    console.log(`[COPYWRITER] Produto: ${produtoNome}${postsLbl}${visionLbl}`);
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
