// =============================================================
// MODULO 7: REVIEWER AI - PRISMATIC LABS VENDEDOR AUTOMATICO
// Avalia qualidade da mensagem gerada e melhora se necessario
// Ultima linha de defesa antes de enviar para o lead
// + Criterios extras aprendidos via 11-learner.js
// =============================================================

require('dotenv').config();
const Groq = require('groq-sdk');
const fs   = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const username      = process.argv[2] || process.env.LEAD_USERNAME;
const mensagensFile = path.join(__dirname, '..', 'data', 'mensagens', `${username}_mensagens.json`);
const analysisFile  = path.join(__dirname, '..', 'data', 'leads',    `${username}_analysis.json`);

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m'
};

function sanitizeJSON(str) {
  let inString = false, escaped = false, result = '';
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

async function reviewMessage() {
  console.log(`\n${C.magenta}[REVIEWER] Iniciando revisao de qualidade para @${username}${C.reset}`);

  let mensagensData, analysisData;
  try {
    mensagensData = JSON.parse(fs.readFileSync(mensagensFile, 'utf8'));
    analysisData  = JSON.parse(fs.readFileSync(analysisFile,  'utf8'));
  } catch (e) {
    console.error(`${C.red}[REVIEWER] Erro: arquivos nao encontrados. Execute analyze primeiro.${C.reset}`);
    process.exit(1);
  }

  // ---- CRITERIOS EXTRAS DO APRENDIZADO ----
  const MEM_FILE = path.join(__dirname, '..', 'data', 'learning', 'style-memory.json');
  let criteriosExtras = '';
  let memoriaVersao   = null;
  try {
    if (fs.existsSync(MEM_FILE)) {
      const mem = JSON.parse(fs.readFileSync(MEM_FILE, 'utf8'));
      memoriaVersao = mem.versao;
      if (mem.criterios_reviewer_extras?.length) {
        criteriosExtras = `\nCRITERIOS EXTRAS APRENDIDOS (memoria v${mem.versao}):\n${mem.criterios_reviewer_extras.map((c, i) => `${i + 13}. ${c}`).join('\n')}`;
        console.log(`${C.cyan}[REVIEWER] Memoria v${mem.versao} carregada (${mem.criterios_reviewer_extras.length} criterios extras)${C.reset}`);
      }
    }
  } catch {}

  const a    = analysisData.analise;
  const ap   = a.analise_posts || {};
  const msgs = mensagensData.mensagens;
  const recKey      = `mensagem_${msgs.mensagem_recomendada}`;
  const msgOriginal = msgs[recKey]?.texto || '';
  const isAPI       = mensagensData.produto_detectado === 'lead_normalizer_api';

  const produtoCtx = isAPI
    ? 'Lead Normalizer API — dev para dev, direto, parece colega que encontrou algo util'
    : 'Landing Page Premium — aspiracional, focado em resultado, parece conselho de colega';

  const prompt = `Voce e um ESPECIALISTA em copywriting B2B para DM no Instagram, com foco em vendas de produtos tech/SaaS.

Sua tarefa: avaliar a qualidade de uma mensagem de primeiro contato e, se necessario, reescrever uma versao melhorada.

CONTEXTO DO LEAD:
- Nicho: ${a.nicho}
- Tipo: ${a.tipo_negocio}
- Problema principal: ${a.problema_principal}
- Gancho disponivel (dos posts): ${ap.gancho_ideal || 'nenhum'}
- Produto sendo vendido: ${produtoCtx}
- Prioridade do lead: ${a.prioridade}

MENSAGEM A REVISAR:
"${msgOriginal}"

CHECKLIST DE QUALIDADE:
1. Contem @handle no corpo do texto?
2. Abre com frase batida? ("Vi seu perfil", "Parabens pelo conteudo", "Notei que")
3. Tem menos de 3 linhas sem estrutura completa (hook + valor + pergunta)?
4. Menciona preco, valor ou plano na primeira mensagem?
5. Tom de vendedor formal? ("Estou oferecendo", "Aproveite", "Oportunidade unica")
6. E generica demais? (poderia ser enviada para QUALQUER pessoa sem mudanca)
7. Nao termina com pergunta de resposta simples?
8. Tem mais de 4 linhas de texto?
9. Usa "tambem" sugerindo que voce tem o mesmo problema do lead?
10. Tem erros graves de portugues?
11. O gancho dos posts NAO foi usado (sendo que estava disponivel)?
12. A mensagem soa automatizada, como se fosse um bot?
${criteriosExtras}

CRITERIOS:
- Score >= 80: aprovada sem mudancas
- Score 60-79: aprovada com sugestao opcional
- Score < 60: REPROVADA, versao melhorada obrigatoria

Retorne JSON:
{
  "score": (0-100),
  "aprovada": true/false,
  "nivel": "excelente"/"boa"/"adequada"/"fraca"/"reprovada",
  "problemas": ["..."],
  "pontos_positivos": ["..."],
  "versao_melhorada": "texto ou null",
  "justificativa_melhoria": "texto ou null",
  "resumo_revisor": "frase curta"
}

Se reescrever: [HOOK especifico] + [VALOR concreto] + [PERGUNTA simples], min 3 linhas, max 4, NUNCA @handle, tom colega.

RESPONDA APENAS O JSON.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model:    'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens:  1500,
    });

    const raw = completion.choices[0].message.content.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON nao encontrado na resposta');

    const review = JSON.parse(sanitizeJSON(jsonMatch[0]));

    const scoreColor = review.score >= 80 ? C.green : review.score >= 60 ? C.yellow : C.red;
    const nivelEmoji = { excelente: '🟢', boa: '🟢', adequada: '🟡', fraca: '🟠', reprovada: '🔴' };
    const emoji      = nivelEmoji[review.nivel] || '⚪';

    console.log(`\n${C.magenta}${'='.repeat(56)}${C.reset}`);
    console.log(`${C.bright}  RESULTADO DA REVISAO${C.reset}`);
    console.log(`${C.magenta}${'='.repeat(56)}${C.reset}`);
    console.log(`  Score: ${scoreColor}${C.bright}${review.score}/100${C.reset}  ${emoji} ${review.nivel?.toUpperCase()}`);
    if (memoriaVersao) console.log(`  ${C.cyan}Criterios: checklist base + v${memoriaVersao} aprendizado${C.reset}`);
    console.log(`  ${review.resumo_revisor}`);

    if (review.pontos_positivos?.length) {
      console.log(`\n${C.green}  PONTOS POSITIVOS:${C.reset}`);
      review.pontos_positivos.forEach(p => console.log(`  + ${p}`));
    }

    if (review.problemas?.length) {
      console.log(`\n${C.yellow}  PROBLEMAS:${C.reset}`);
      review.problemas.forEach(p => console.log(`  ! ${p}`));
    }

    let mensagemFinal;
    if (review.aprovada && !review.versao_melhorada) {
      console.log(`\n${C.green}  MENSAGEM APROVADA${C.reset}`);
      mensagemFinal = msgOriginal;
    } else if (review.versao_melhorada) {
      console.log(`\n${C.yellow}  VERSAO MELHORADA GERADA${C.reset}`);
      if (review.justificativa_melhoria) console.log(`  Mudancas: ${review.justificativa_melhoria}`);
      mensagemFinal = review.versao_melhorada;
    } else {
      mensagemFinal = msgOriginal;
    }

    console.log(`\n${C.magenta}${'='.repeat(56)}${C.reset}`);
    if (review.versao_melhorada) {
      console.log(`${C.bright}  MENSAGEM ORIGINAL:${C.reset}`);
      console.log(`  ${msgOriginal.replace(/\\n/g, '\n  ')}`);
      console.log(`\n${C.bright}${C.green}  MENSAGEM FINAL (USE ESTA):${C.reset}`);
    } else {
      console.log(`${C.bright}  MENSAGEM APROVADA:${C.reset}`);
    }
    console.log(`${C.magenta}${'-'.repeat(56)}${C.reset}`);
    console.log(mensagemFinal.replace(/\\n/g, '\n'));
    console.log(`${C.magenta}${'='.repeat(56)}${C.reset}\n`);

    mensagensData.revisao = {
      timestamp:         new Date().toISOString(),
      score:             review.score,
      nivel:             review.nivel,
      aprovada:          review.aprovada,
      problemas:         review.problemas,
      pontos_positivos:  review.pontos_positivos,
      mensagem_original: msgOriginal,
      mensagem_final:    mensagemFinal,
      melhorada:         !!review.versao_melhorada,
      learning_versao:   memoriaVersao,
    };
    fs.writeFileSync(mensagensFile, JSON.stringify(mensagensData, null, 2));

    console.log(`${C.cyan}[REVIEWER] Revisao salva em: ${mensagensFile}${C.reset}`);
    console.log(`\nREVIEWER_OUTPUT=${JSON.stringify({ score: review.score, nivel: review.nivel, mensagem_final: mensagemFinal })}`);

    return { score: review.score, mensagem_final: mensagemFinal, aprovada: review.aprovada };

  } catch (error) {
    console.error(`${C.red}[REVIEWER] Erro: ${error.message}${C.reset}`);
    console.log(`${C.yellow}[REVIEWER] Continuando com mensagem original...${C.reset}`);
  }
}

reviewMessage();
