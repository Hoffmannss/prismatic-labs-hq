// =============================================================
// MODULO 11: LEARNER AI - PRISMATIC LABS VENDEDOR AUTOMATICO
// Analisa todas as mensagens revisadas + dados reais de tracking
// (respondeu/converteu) para extrair padroes com LLM e gravar
// uma memoria de aprendizado continuo (style-memory.json)
// Alimenta copywriter e reviewer nas proximas geracoes
// =============================================================

require('dotenv').config();
const Groq   = require('groq-sdk');
const fs     = require('fs');
const path   = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MENSAGENS_DIR = path.join(__dirname, '..', 'data', 'mensagens');
const LEADS_DIR     = path.join(__dirname, '..', 'data', 'leads');
const LEARNING_DIR  = path.join(__dirname, '..', 'data', 'learning');
const MEMORY_FILE   = path.join(LEARNING_DIR, 'style-memory.json');

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', blue: '\x1b[34m', red: '\x1b[31m',
};

function sanitizeJSON(str) {
  let inString = false, escaped = false, result = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escaped) { result += c; escaped = false; continue; }
    if (c === '\\') { escaped = true; result += c; continue; }
    if (c === '"') { inString = !inString; result += c; continue; }
    if (inString && c === '\n') { result += '\\n'; continue; }
    if (inString && c === '\r') { result += '\\r'; continue; }
    if (inString && c === '\t') { result += '\\t'; continue; }
    result += c;
  }
  return result;
}

async function runLearner() {
  console.log(`\n${C.blue}${'='.repeat(60)}${C.reset}`);
  console.log(`${C.bright}  LEARNER — APRENDIZADO CONTINUO${C.reset}`);
  console.log(`${C.blue}${'='.repeat(60)}${C.reset}`);

  if (!fs.existsSync(LEARNING_DIR)) fs.mkdirSync(LEARNING_DIR, { recursive: true });
  if (!fs.existsSync(MENSAGENS_DIR)) {
    console.log(`${C.yellow}[LEARNER] Diretorio de mensagens nao encontrado.${C.reset}`);
    return null;
  }

  const msgFiles = fs.readdirSync(MENSAGENS_DIR)
    .filter(f => f.endsWith('_mensagens.json'))
    .sort();

  const comRevisao = msgFiles.filter(f => {
    try { return !!JSON.parse(fs.readFileSync(path.join(MENSAGENS_DIR, f), 'utf8')).revisao; }
    catch { return false; }
  });

  console.log(`${C.cyan}[LEARNER] Arquivos com revisao: ${comRevisao.length} / ${msgFiles.length}${C.reset}`);

  if (comRevisao.length < 3) {
    console.log(`${C.yellow}[LEARNER] Minimo 3 amostras com revisao. Atual: ${comRevisao.length}${C.reset}`);
    return null;
  }

  const allData = [];
  for (const file of msgFiles.slice(-40)) {
    const username = file.replace('_mensagens.json', '');
    try {
      const msgData = JSON.parse(fs.readFileSync(path.join(MENSAGENS_DIR, file), 'utf8'));
      if (!msgData.revisao) continue;

      let analise = null;
      const leadPath = path.join(LEADS_DIR, `${username}_analysis.json`);
      if (fs.existsSync(leadPath)) {
        analise = JSON.parse(fs.readFileSync(leadPath, 'utf8'))?.analise || null;
      }

      const tk = msgData.tracking || null;

      allData.push({
        username,
        produto:            msgData.produto_detectado,
        prioridade:         msgData.prioridade,
        score:              msgData.revisao.score,
        nivel:              msgData.revisao.nivel,
        aprovada:           msgData.revisao.aprovada,
        melhorada:          msgData.revisao.melhorada,
        problemas:          (msgData.revisao.problemas         || []).slice(0, 4),
        pontos_positivos:   (msgData.revisao.pontos_positivos  || []).slice(0, 4),
        msg_original:       (msgData.revisao.mensagem_original || '').slice(0, 200),
        msg_final:          (msgData.revisao.mensagem_final    || '').slice(0, 200),
        nicho:              analise?.nicho                     || null,
        tipo_negocio:       analise?.tipo_negocio              || null,
        gancho:             (analise?.analise_posts?.gancho_ideal || '').slice(0, 100),
        nivel_consciencia:  analise?.nivel_consciencia         || null,
        tracking_outcome:        tk?.outcome              || null,
        tracking_respondeu:      tk?.respondeu            || false,
        tracking_converteu:      tk?.converteu            || false,
        tracking_dias_resposta:  tk?.dias_ate_resposta    || null,
        tracking_nota:           (tk?.nota || '').slice(0, 100),
        tracking_valor:          tk?.valor_fechado        || null,
      });
    } catch {}
  }

  if (allData.length < 3) {
    console.log(`${C.yellow}[LEARNER] Dados insuficientes apos filtro (${allData.length}).${C.reset}`);
    return null;
  }

  const scores          = allData.map(d => d.score);
  const scoreMedio      = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const totalMelhoradas = allData.filter(d => d.melhorada).length;
  const taxaMelhoria    = Math.round((totalMelhoradas / allData.length) * 100);

  const comTracking    = allData.filter(d => d.tracking_outcome && d.tracking_outcome !== 'enviada');
  const totalTracked   = comTracking.length;
  const totalResponderam  = comTracking.filter(d => d.tracking_respondeu).length;
  const totalConverteram  = comTracking.filter(d => d.tracking_converteu).length;
  const taxaRespostaReal  = totalTracked > 0 ? Math.round((totalResponderam  / totalTracked) * 100) : null;
  const taxaConversaoReal = totalTracked > 0 ? Math.round((totalConverteram  / totalTracked) * 100) : null;

  const scoreResponderam = totalResponderam > 0
    ? Math.round(comTracking.filter(d => d.tracking_respondeu).reduce((s, d) => s + d.score, 0) / totalResponderam)
    : null;
  const scoreIgnoraram = comTracking.filter(d => !d.tracking_respondeu).length > 0
    ? Math.round(comTracking.filter(d => !d.tracking_respondeu).reduce((s, d) => s + d.score, 0) / comTracking.filter(d => !d.tracking_respondeu).length)
    : null;

  const errosCount = {};
  allData.forEach(d => d.problemas.forEach(p => {
    const k = p.toLowerCase().slice(0, 60);
    errosCount[k] = (errosCount[k] || 0) + 1;
  }));
  const errosFrequentes = Object.entries(errosCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([k, v]) => `"${k}" (${v}x)`);

  let memoriaAnterior = null;
  if (fs.existsSync(MEMORY_FILE)) {
    try { memoriaAnterior = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8')); } catch {}
  }

  const memAntStr = memoriaAnterior?.regras_copywriting?.length
    ? `VERSAO ANTERIOR (v${memoriaAnterior.versao}, score medio ${memoriaAnterior.score_medio}/100, taxa resposta real ${memoriaAnterior.taxa_resposta_real ?? 'N/A'}%):\nRegras anteriores:\n${memoriaAnterior.regras_copywriting.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
    : 'SEM MEMORIA ANTERIOR (primeira execucao)';

  const trackingStr = totalTracked > 0
    ? `DADOS REAIS DE TRACKING (${totalTracked} leads com outcome registrado):
- Taxa resposta real: ${taxaRespostaReal}%
- Taxa conversao real: ${taxaConversaoReal}%
- Score medio dos que RESPONDERAM: ${scoreResponderam ?? 'N/A'}
- Score medio dos que IGNORARAM: ${scoreIgnoraram ?? 'N/A'}
- Correlacao score->resposta: ${scoreResponderam && scoreIgnoraram ? (scoreResponderam - scoreIgnoraram > 5 ? 'POSITIVA (score alto = mais resposta)' : 'FRACA (score nao prediz resposta)') : 'sem dados suficientes'}`
    : 'SEM DADOS DE TRACKING REAL AINDA (learner usa apenas score do reviewer)';

  const prompt = `Voce e um especialista em copywriting B2B para outreach via Instagram DM.

Analise ${allData.length} mensagens avaliadas e extraia padroes de aprendizado.

DADOS:
${JSON.stringify(allData, null, 2)}

ESTATISTICAS DO REVIEWER:
- Score medio: ${scoreMedio}/100
- Total amostras: ${allData.length}
- Mensagens reescritas pelo reviewer: ${totalMelhoradas}/${allData.length} (${taxaMelhoria}%)
- Erros mais frequentes: ${errosFrequentes.join(' | ')}

${trackingStr}

${memAntStr}

Gere um JSON com esta estrutura EXATA (sem markdown, sem backticks):
{
  "padroes_eficazes": [
    "Padrao especifico que gerou score alto OU resposta real — max 5 itens"
  ],
  "erros_recorrentes": [
    "Erro formulado como REGRA NEGATIVA clara — max 5 itens"
  ],
  "regras_copywriting": [
    "REGRA POSITIVA obrigatoria, especifica e acionavel — max 8 itens"
  ],
  "criterios_reviewer_extras": [
    "Criterio extra para o reviewer checar — max 4 itens"
  ],
  "angulos_por_produto": {
    "lead_normalizer_api": {
      "melhor_angulo": "angulo que consistentemente gera mais resposta ou score alto",
      "ganchos_eficazes": ["exemplos de ganchos dos posts que foram bem aproveitados"],
      "evitar": ["padroes que geram score baixo ou ignorados"]
    }
  },
  "insights_tracking": [
    "Insight derivado dos dados REAIS de tracking — vazio se sem dados suficientes"
  ],
  "evolucao": {
    "score_anterior": ${memoriaAnterior?.score_medio || null},
    "score_atual": ${scoreMedio},
    "taxa_resposta_anterior": ${memoriaAnterior?.taxa_resposta_real || null},
    "taxa_resposta_atual": ${taxaRespostaReal},
    "tendencia": "melhora ou piora ou estavel",
    "conquistas": ["o que melhorou desde versao anterior"],
    "proximas_melhorias": ["foco para o proximo batch"]
  }
}

RETORNE APENAS O JSON.`;

  console.log(`${C.cyan}[LEARNER] Sintetizando com LLM (${allData.length} amostras, ${totalTracked} com tracking real)...${C.reset}`);

  const completion = await groq.chat.completions.create({
    messages:    [{ role: 'user', content: prompt }],
    model:       'llama-3.3-70b-versatile',
    temperature:  0.25,
    max_tokens:   2800,
  });

  const raw = completion.choices[0].message.content.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM nao retornou JSON valido');

  const insights = JSON.parse(sanitizeJSON(jsonMatch[0]));

  const memoria = {
    versao:                    (memoriaAnterior?.versao || 0) + 1,
    ultima_atualizacao:        new Date().toISOString(),
    score_medio:               scoreMedio,
    total_amostras:            allData.length,
    taxa_melhoria_reviewer:    taxaMelhoria,
    total_tracked:             totalTracked,
    taxa_resposta_real:        taxaRespostaReal,
    taxa_conversao_real:       taxaConversaoReal,
    score_medio_responderam:   scoreResponderam,
    score_medio_ignoraram:     scoreIgnoraram,
    padroes_eficazes:          insights.padroes_eficazes          || [],
    erros_recorrentes:         insights.erros_recorrentes         || [],
    regras_copywriting:        insights.regras_copywriting        || [],
    criterios_reviewer_extras: insights.criterios_reviewer_extras || [],
    angulos_por_produto:       insights.angulos_por_produto       || {},
    insights_tracking:         insights.insights_tracking         || [],
    evolucao:                  insights.evolucao                  || {},
  };

  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memoria, null, 2));

  console.log(`\n${C.green}[LEARNER] ✅ Memoria atualizada! (versao ${memoria.versao})${C.reset}`);
  console.log(`${C.cyan}[LEARNER] Score medio: ${memoria.score_medio}/100  (anterior: ${memoriaAnterior?.score_medio || 'N/A'})${C.reset}`);
  console.log(`${C.cyan}[LEARNER] Taxa reescrita reviewer: ${memoria.taxa_melhoria_reviewer}%${C.reset}`);

  if (totalTracked > 0) {
    const trColor = taxaRespostaReal >= 20 ? C.green : taxaRespostaReal >= 10 ? C.yellow : C.red;
    console.log(`\n${C.bright}[LEARNER] SINAL REAL DE CONVERSAO:${C.reset}`);
    console.log(`  ${trColor}Taxa resposta real:  ${taxaRespostaReal}%  (${totalResponderam}/${totalTracked})${C.reset}`);
    if (taxaConversaoReal > 0) console.log(`  ${C.green}Taxa conversao real: ${taxaConversaoReal}%  (${totalConverteram}/${totalTracked})${C.reset}`);
    if (scoreResponderam && scoreIgnoraram) {
      const diff = scoreResponderam - scoreIgnoraram;
      const dColor = diff > 5 ? C.green : C.yellow;
      console.log(`  ${dColor}Score responderam: ${scoreResponderam}  |  Score ignoraram: ${scoreIgnoraram}  |  diff: ${diff > 0 ? '+' : ''}${diff}${C.reset}`);
    }
    if (memoria.insights_tracking?.length) {
      console.log(`\n${C.cyan}[LEARNER] Insights do tracking real:${C.reset}`);
      memoria.insights_tracking.forEach(i => console.log(`  💡 ${i}`));
    }
  } else {
    console.log(`${C.yellow}[LEARNER] Sem tracking real — use 12-tracker.js para registrar outcomes${C.reset}`);
  }

  console.log(`\n${C.cyan}[LEARNER] Regras aprendidas: ${memoria.regras_copywriting.length}${C.reset}`);
  memoria.regras_copywriting.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));

  if (memoria.erros_recorrentes.length) {
    console.log(`\n${C.yellow}[LEARNER] Erros recorrentes:${C.reset}`);
    memoria.erros_recorrentes.forEach(e => console.log(`  ⚠️  ${e}`));
  }

  const tendencia = memoria.evolucao?.tendencia || 'estavel';
  const icon = { melhora: '📈', piora: '📉', estavel: '➡️' }[tendencia] || '➡️';
  console.log(`\n${C.blue}[LEARNER] Tendencia: ${icon} ${tendencia.toUpperCase()}${C.reset}`);
  if (memoria.evolucao?.proximas_melhorias?.length)
    console.log(`${C.blue}[LEARNER] Foco proximo batch: ${memoria.evolucao.proximas_melhorias[0]}${C.reset}`);
  console.log(`${C.blue}[LEARNER] Arquivo: ${MEMORY_FILE}${C.reset}\n`);

  return memoria;
}

module.exports = { runLearner };

if (require.main === module) {
  runLearner().catch(err => {
    console.error('[LEARNER] Erro fatal:', err.message);
    process.exit(1);
  });
}
