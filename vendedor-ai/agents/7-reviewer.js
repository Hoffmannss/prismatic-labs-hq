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

  const prompt = `Voce e um ESPECIALISTA em DM outreach no Instagram para produtos tech B2B.
Avalie a MENSAGEM A REVISAR abaixo com base nos criterios EXATOS a seguir.

CONTEXTO DO LEAD:
- Nicho: ${a.nicho}
- Problema principal: ${a.problema_principal}
- Gancho disponivel (dos posts): ${ap.gancho_ideal || 'nenhum'}
- Produto: ${produtoCtx}

MENSAGEM A REVISAR:
"${msgOriginal}"

=== REGRAS DE OURO PARA DM NO INSTAGRAM ===
MENSAGEM IDEAL: 3 partes em 3-5 linhas. Curta e direta e MELHOR que longa.
- PARTE 1 (HOOK): pergunta ou afirmacao especifica sobre o problema do lead — NAO precisa mencionar post especifico, pode ser sobre o nicho/dor
- PARTE 2 (VALOR): 1-2 linhas do que voce fez/faz e como resolve o problema — sem preco, sem plano
- PARTE 3 (CTA): pergunta simples de sim/nao — "Vale testar?", "Quer dar uma olhada?", "Faz sentido?" — TODAS sao boas

=== O QUE E "FRASE BATIDA" (penalizar fortemente) ===
BATIDA = abertura generica que nao fala sobre o problema: "Vi seu perfil", "Parabens pelo conteudo", "Notei que voce e muito bom"
NAO E BATIDA = pergunta especifica sobre dor do nicho: "Seus flows quebram com telefone fora do formato?" — isso e um BOM HOOK

=== ERROS QUE REPROVAM (score < 50) ===
- Contem @handle no texto
- Menciona preco, valor, plano, free, gratis, desconto, trial
- Tom de vendedor: "solucao", "beneficios", "investimento", "aproveite", "oportunidade unica"
- Mais de 6 linhas de texto
- Pergunta de fechamento com mais de 10 palavras ("Voce gostaria de conhecer como a API pode ajudar nos seus processos?")

=== ERROS MENORES (penalizar -10 a -15 cada) ===
- Abre com frase batida (generica, nao especifica ao problema)
- Nao termina com pergunta simples
- Soa como template (completamente generica)
- Gancho dos posts estava disponivel e nao foi usado

=== O QUE NAO E ERRO ===
- Mensagem curta (3 linhas e IDEAL, nao penalizar)
- "Vale testar?" como CTA (e perfeito)
- Perguntar sobre o problema do nicho sem mencionar post especifico
- Ausencia de bio do lead (nao e falha da mensagem)

EXEMPLOS DE MENSAGENS BOM (score 80+):
EXEMPLO 1: "Seus flows quebram quando o telefone chega fora do formato?\\n\\nFiz uma API que converte qualquer formato BR pra E.164 em menos de 50ms, pronta pro Make, n8n e Zapier.\\n\\nVale testar?"
EXEMPLO 2: "Ja perdeu leads por causa de telefones em formato errado?\\n\\nMinha API resolve isso em 1 request — normaliza telefone, limpa email e parseia UTMs.\\n\\nQuer dar uma olhada?"

EXEMPLOS DE MENSAGENS RUINS (score < 50):
RUIM 1: "Voce esta tendo problemas com os flows quebrando? Eu encontrei uma solucao que pode ajudar! Criei uma API que converte qualquer formato BR para E.164 em menos de 50ms, pronta para uso em Make, n8n e Zapier. Voce gostaria de testar e ver como pode resolver esse problema?"
(por que e ruim: usa "solucao", muito longa, pergunta longa no final)

CRITERIOS DE SCORE:
- Score >= 80: aprovada — NAO gerar versao melhorada
- Score 60-79: adequada — versao melhorada opcional (so se for CLARAMENTE melhor)
- Score < 60: reprovada — versao melhorada obrigatoria
ATENCAO: Se a versao melhorada nao for demonstravelmente superior, mantenha null.
${criteriosExtras}

Retorne JSON:
{
  "score": (0-100),
  "aprovada": true/false,
  "nivel": "excelente"/"boa"/"adequada"/"fraca"/"reprovada",
  "problemas": ["lista apenas erros REAIS dos criterios acima"],
  "pontos_positivos": ["..."],
  "versao_melhorada": "texto melhorado OU null se nao for claramente melhor",
  "justificativa_melhoria": "o que especificamente mudou e por que e melhor OU null",
  "resumo_revisor": "frase curta"
}

Se reescrever: max 5 linhas, HOOK + VALOR (sem preco) + CTA curto, NUNCA "solucao"/"investimento"/"beneficios", NUNCA @handle.
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
