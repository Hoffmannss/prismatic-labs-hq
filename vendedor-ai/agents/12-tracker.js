// =============================================================
// MODULO 12: TRACKER - PRISMATIC LABS VENDEDOR AUTOMATICO
// Rastreia outcomes reais das DMs enviadas (enviada, respondeu,
// ignorou, negociando, converteu, recusou) e alimenta o learner
// com sinal de conversao real, nao apenas score do reviewer.
//
// Uso:
//   node 12-tracker.js list
//   node 12-tracker.js sent     <username>
//   node 12-tracker.js respondeu <username> [nota]
//   node 12-tracker.js ignorou   <username>
//   node 12-tracker.js negociando <username> [nota]
//   node 12-tracker.js converteu <username> [valor_em_reais]
//   node 12-tracker.js recusou   <username>
//   node 12-tracker.js pending   (enviadas ha 3+ dias sem update)
//   node 12-tracker.js stats     (painel de conversao geral)
// =============================================================

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const MENSAGENS_DIR = path.join(__dirname, '..', 'data', 'mensagens');
const LEADS_DIR     = path.join(__dirname, '..', 'data', 'leads');

const OUTCOMES = ['enviada', 'respondeu', 'ignorou', 'negociando', 'converteu', 'recusou'];

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', blue: '\x1b[34m', magenta: '\x1b[35m',
  white: '\x1b[37m',
};

const OUTCOME_STYLE = {
  enviada:    { icon: '\u2709\ufe0f ', color: C.cyan    },
  respondeu:  { icon: '\ud83d\udfe2 ', color: C.green   },
  ignorou:    { icon: '\u26aa ',       color: C.dim     },
  negociando: { icon: '\ud83d\udfe1 ', color: C.yellow  },
  converteu:  { icon: '\ud83d\udcb0 ', color: C.green   },
  recusou:    { icon: '\ud83d\udd34 ', color: C.red     },
};

function getAllMensagens() {
  if (!fs.existsSync(MENSAGENS_DIR)) return [];
  return fs.readdirSync(MENSAGENS_DIR)
    .filter(f => f.endsWith('_mensagens.json'))
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(MENSAGENS_DIR, f), 'utf8'));
        return { file: f, username: data.username || f.replace('_mensagens.json',''), data };
      } catch { return null; }
    })
    .filter(Boolean);
}

function loadMsg(username) {
  const fp = path.join(MENSAGENS_DIR, `${username}_mensagens.json`);
  if (!fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

function saveMsg(username, data) {
  const fp = path.join(MENSAGENS_DIR, `${username}_mensagens.json`);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

function daysSince(isoDate) {
  if (!isoDate) return null;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
}

function fmtDate(isoDate) {
  if (!isoDate) return 'N/A';
  return new Date(isoDate).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function header(title) {
  console.log(`\n${C.blue}${'\u2550'.repeat(60)}${C.reset}`);
  console.log(`${C.bright}  ${title}${C.reset}`);
  console.log(`${C.blue}${'\u2550'.repeat(60)}${C.reset}`);
}

// ---- CMD: list -----------------------------------------------
function cmdList() {
  header('TRACKER \u2014 LEADS SEM OUTCOME');
  const all = getAllMensagens();
  const semTracking = all.filter(m => !m.data.tracking?.outcome || m.data.tracking.outcome === 'enviada');

  if (semTracking.length === 0) {
    console.log(`${C.green}  Todos os leads com tracking atualizado! \u2705${C.reset}\n`);
    return;
  }

  const comRevisao = semTracking.filter(m => m.data.revisao);
  const semRevisao = semTracking.filter(m => !m.data.revisao);

  if (comRevisao.length) {
    console.log(`\n${C.bright}  Com mensagem revisada (prontas para enviar):${C.reset}`);
    for (const m of comRevisao) {
      const t = m.data.tracking;
      const score = m.data.revisao?.score || '?';
      const prio  = m.data.prioridade || '?';
      const prioColor = prio === 'ALTA' ? C.green : prio === 'MEDIA' ? C.yellow : C.dim;
      const outcomeStr = t?.outcome === 'enviada'
        ? `${C.cyan}enviada ${fmtDate(t.data_envio)}${C.reset}`
        : `${C.dim}nao enviada${C.reset}`;
      console.log(`  ${C.bright}@${m.username.padEnd(24)}${C.reset} score:${score.toString().padStart(3)} | prio:${prioColor}${prio}${C.reset} | ${outcomeStr}`);
    }
  }

  if (semRevisao.length) {
    console.log(`\n${C.dim}  Sem revisao ainda (rode o reviewer primeiro):${C.reset}`);
    for (const m of semRevisao) console.log(`  ${C.dim}@${m.username}${C.reset}`);
  }

  console.log(`\n  ${C.dim}Total pendente: ${semTracking.length}${C.reset}`);
  console.log(`  ${C.dim}Comandos: node 12-tracker.js sent <user> | respondeu | ignorou | converteu${C.reset}\n`);
}

// ---- CMD: update outcome ------------------------------------
function cmdUpdate(username, outcome, extra) {
  if (!OUTCOMES.includes(outcome)) {
    console.error(`${C.red}[TRACKER] Outcome invalido: "${outcome}"${C.reset}`);
    console.log(`Validos: ${OUTCOMES.join(' | ')}`);
    process.exit(1);
  }

  const data = loadMsg(username);
  if (!data) {
    console.error(`${C.red}[TRACKER] @${username} nao encontrado em data/mensagens/${C.reset}`);
    process.exit(1);
  }

  const now     = new Date().toISOString();
  const prevOut = data.tracking?.outcome;
  const isFirst = outcome === 'enviada';

  if (!data.tracking) data.tracking = {};

  if (isFirst) {
    data.tracking.data_envio  = now;
    data.tracking.outcome     = 'enviada';
    data.tracking.historico   = data.tracking.historico || [];
    data.tracking.historico.push({ ts: now, outcome: 'enviada' });
  } else {
    if (!data.tracking.data_envio) data.tracking.data_envio = now;

    data.tracking.outcome           = outcome;
    data.tracking.data_outcome      = now;
    data.tracking.dias_ate_resposta = daysSince(data.tracking.data_envio);

    if (outcome === 'converteu' && extra) {
      const val = parseFloat(extra.replace(/[^0-9.,]/g, '').replace(',', '.'));
      if (!isNaN(val)) data.tracking.valor_fechado = val;
    }
    if (['respondeu', 'negociando', 'recusou'].includes(outcome) && extra) {
      data.tracking.nota = extra;
    }
    if (outcome === 'respondeu' || outcome === 'negociando') data.tracking.respondeu = true;
    if (outcome === 'converteu') {
      data.tracking.respondeu = true;
      data.tracking.converteu = true;
    }

    data.tracking.historico = data.tracking.historico || [];
    data.tracking.historico.push({ ts: now, outcome, nota: extra || null });
  }

  saveMsg(username, data);

  const st      = OUTCOME_STYLE[outcome] || { icon: '\u2022 ', color: C.white };
  const score   = data.revisao?.score || '?';
  const recKey  = `mensagem_${data.mensagens?.mensagem_recomendada}`;
  const angle   = data.mensagens?.[recKey]?.angulo || '';
  const produto = data.produto_detectado === 'lead_normalizer_api' ? 'API' : 'LP';

  console.log(`\n${C.blue}${'\u2500'.repeat(50)}${C.reset}`);
  console.log(`${C.bright}  TRACKER ATUALIZADO${C.reset}`);
  console.log(`${C.blue}${'\u2500'.repeat(50)}${C.reset}`);
  console.log(`  Lead:    ${C.bright}@${username}${C.reset}`);
  console.log(`  Outcome: ${st.color}${st.icon}${outcome.toUpperCase()}${C.reset}${prevOut ? ` (era: ${prevOut})` : ''}`);
  console.log(`  Score:   ${score}/100 | Produto: ${produto}${angle ? ` | Angulo: ${angle}` : ''}`);
  if (data.tracking.dias_ate_resposta != null)
    console.log(`  Dias:    ${data.tracking.dias_ate_resposta} dia(s) apos envio`);
  if (extra) console.log(`  Extra:   ${extra}`);
  console.log(`${C.blue}${'\u2500'.repeat(50)}${C.reset}\n`);
}

// ---- CMD: pending --------------------------------------------
function cmdPending() {
  header('TRACKER \u2014 AGUARDANDO FOLLOWUP (3+ dias)');
  const all = getAllMensagens();
  const pending = all.filter(m => {
    const t = m.data.tracking;
    if (!t?.data_envio) return false;
    if (t.outcome && t.outcome !== 'enviada') return false;
    return daysSince(t.data_envio) >= 3;
  });

  if (pending.length === 0) {
    console.log(`${C.green}  Nenhum lead pendente de followup.${C.reset}\n`);
    return;
  }

  pending.sort((a, b) => daysSince(b.data.tracking.data_envio) - daysSince(a.data.tracking.data_envio));

  for (const m of pending) {
    const t   = m.data.tracking;
    const d   = daysSince(t.data_envio);
    const fu  = d >= 14 ? 'followup_dia_14' : d >= 7 ? 'followup_dia_7' : 'followup_dia_3';
    const fuMsg = (m.data.mensagens?.[fu] || '').slice(0, 60);
    const score = m.data.revisao?.score || '?';
    const dColor = d >= 7 ? C.red : C.yellow;

    console.log(`\n  ${C.bright}@${m.username}${C.reset} | ${dColor}${d} dias${C.reset} | score: ${score}`);
    console.log(`  ${C.dim}Enviada: ${fmtDate(t.data_envio)}${C.reset}`);
    if (fuMsg) console.log(`  ${C.cyan}Sugestao followup: ${fuMsg}...${C.reset}`);
  }

  console.log(`\n  ${C.dim}Total: ${pending.length} lead(s) aguardando followup.${C.reset}`);
  console.log(`  ${C.dim}Use: node 12-tracker.js respondeu <user> | ignorou <user>${C.reset}\n`);
}

// ---- CMD: stats ---------------------------------------------
function cmdStats() {
  header('TRACKER \u2014 PAINEL DE CONVERSAO');
  const all = getAllMensagens().filter(m => m.data.tracking?.outcome);

  if (all.length === 0) {
    console.log(`${C.yellow}  Nenhum dado de tracking ainda. Use: node 12-tracker.js sent <user>${C.reset}\n`);
    return;
  }

  const counts = {};
  OUTCOMES.forEach(o => counts[o] = 0);
  all.forEach(m => { counts[m.data.tracking.outcome] = (counts[m.data.tracking.outcome] || 0) + 1; });

  const totalEnviadas    = all.length;
  const totalRespostas   = (counts.respondeu || 0) + (counts.negociando || 0) + (counts.converteu || 0) + (counts.recusou || 0);
  const totalPositivos   = (counts.respondeu || 0) + (counts.negociando || 0) + (counts.converteu || 0);
  const totalConvertidos = counts.converteu || 0;
  const taxaResposta     = totalEnviadas > 0 ? ((totalRespostas   / totalEnviadas) * 100).toFixed(1) : 0;
  const taxaConversao    = totalEnviadas > 0 ? ((totalConvertidos / totalEnviadas) * 100).toFixed(1) : 0;
  const taxaPositiva     = totalEnviadas > 0 ? ((totalPositivos   / totalEnviadas) * 100).toFixed(1) : 0;

  const receita = all
    .filter(m => m.data.tracking.converteu && m.data.tracking.valor_fechado)
    .reduce((s, m) => s + (m.data.tracking.valor_fechado || 0), 0);

  const scoreGroup = (outcome) => {
    const g = all.filter(m => m.data.tracking.outcome === outcome && m.data.revisao?.score);
    if (!g.length) return null;
    return Math.round(g.reduce((s, m) => s + m.data.revisao.score, 0) / g.length);
  };

  const scoreResponderam = scoreGroup('respondeu');
  const scoreIgnoraram   = scoreGroup('ignorou');
  const scoreConverteram = scoreGroup('converteu');

  const angleCounts = {};
  all.filter(m => ['respondeu','negociando','converteu'].includes(m.data.tracking.outcome)).forEach(m => {
    const recKey = `mensagem_${m.data.mensagens?.mensagem_recomendada}`;
    const angle  = m.data.mensagens?.[recKey]?.angulo || 'sem angulo';
    angleCounts[angle] = (angleCounts[angle] || 0) + 1;
  });
  const topAngles = Object.entries(angleCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  console.log(`\n${C.bright}  FUNIL DE CONVERSAO${C.reset}`);
  console.log(`${'\u2500'.repeat(50)}`);
  console.log(`  Total enviadas:    ${C.bright}${totalEnviadas}${C.reset}`);
  for (const [o, n] of Object.entries(counts)) {
    if (!n) continue;
    const st = OUTCOME_STYLE[o] || { icon: '\u2022 ', color: C.white };
    console.log(`  ${st.color}${st.icon}${o.padEnd(12)}${C.reset} ${n.toString().padStart(3)}`);
  }

  console.log(`\n${C.bright}  TAXAS${C.reset}`);
  console.log(`${'\u2500'.repeat(50)}`);
  const txColor = (v) => parseFloat(v) >= 20 ? C.green : parseFloat(v) >= 10 ? C.yellow : C.red;
  console.log(`  Taxa resposta:     ${txColor(taxaResposta)}${C.bright}${taxaResposta}%${C.reset}  (benchmark DM: 10-20%)`);
  console.log(`  Taxa positiva:     ${txColor(taxaPositiva)}${C.bright}${taxaPositiva}%${C.reset}`);
  console.log(`  Taxa conversao:    ${txColor(taxaConversao)}${C.bright}${taxaConversao}%${C.reset}`);
  if (receita > 0)
    console.log(`  Receita total:     ${C.green}${C.bright}R$ ${receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${C.reset}`);

  if (scoreResponderam || scoreIgnoraram) {
    console.log(`\n${C.bright}  SCORE vs OUTCOME${C.reset}`);
    console.log(`${'\u2500'.repeat(50)}`);
    if (scoreConverteram) console.log(`  Score converteram: ${C.green}${C.bright}${scoreConverteram}/100${C.reset}`);
    if (scoreResponderam) console.log(`  Score responderam: ${C.cyan}${scoreResponderam}/100${C.reset}`);
    if (scoreIgnoraram)   console.log(`  Score ignoraram:   ${C.dim}${scoreIgnoraram}/100${C.reset}`);
    if (scoreResponderam && scoreIgnoraram) {
      const diff = scoreResponderam - scoreIgnoraram;
      const diffColor = diff > 0 ? C.green : C.red;
      console.log(`  Diferenca: ${diffColor}${diff > 0 ? '+' : ''}${diff} pts${C.reset} ${diff > 5 ? '(reviewer correlaciona \u2714\ufe0f)' : '(correlacao fraca \u26a0\ufe0f)'}`);
    }
  }

  if (topAngles.length) {
    console.log(`\n${C.bright}  TOP ANGULOS QUE GERARAM RESPOSTA${C.reset}`);
    console.log(`${'\u2500'.repeat(50)}`);
    topAngles.forEach(([a, n], i) => console.log(`  ${i + 1}. ${C.cyan}${a}${C.reset} (${n}x)`));
  }

  const diasRespostas = all
    .filter(m => m.data.tracking.dias_ate_resposta != null)
    .map(m => m.data.tracking.dias_ate_resposta);
  if (diasRespostas.length) {
    const media = (diasRespostas.reduce((a, b) => a + b, 0) / diasRespostas.length).toFixed(1);
    console.log(`\n${C.bright}  TEMPO${C.reset}`);
    console.log(`${'\u2500'.repeat(50)}`);
    console.log(`  Media dias ate resposta: ${C.cyan}${media} dias${C.reset}`);
  }

  console.log(`\n${C.dim}  Atualizado: ${new Date().toLocaleString('pt-BR')}${C.reset}\n`);
}

// ---- MAIN ---------------------------------------------------
const [,, cmd, username, ...extras] = process.argv;
const extra = extras.join(' ');

if (!cmd || cmd === 'help') {
  console.log(`
${C.bright}TRACKER — Uso:${C.reset}
  node 12-tracker.js list
  node 12-tracker.js sent      <username>
  node 12-tracker.js respondeu <username> [nota]
  node 12-tracker.js ignorou   <username>
  node 12-tracker.js negociando <username> [nota]
  node 12-tracker.js converteu <username> [valor_R$]
  node 12-tracker.js recusou   <username>
  node 12-tracker.js pending
  node 12-tracker.js stats
`);
  process.exit(0);
}

switch (cmd) {
  case 'list':    cmdList();    break;
  case 'pending': cmdPending(); break;
  case 'stats':   cmdStats();   break;
  case 'sent':
    if (!username) { console.error(`${C.red}Informe o username${C.reset}`); process.exit(1); }
    cmdUpdate(username, 'enviada', extra);
    break;
  case 'respondeu':
  case 'ignorou':
  case 'negociando':
  case 'converteu':
  case 'recusou':
    if (!username) { console.error(`${C.red}Informe o username${C.reset}`); process.exit(1); }
    cmdUpdate(username, cmd, extra || null);
    break;
  default:
    console.error(`${C.red}Comando desconhecido: "${cmd}"${C.reset}`);
    process.exit(1);
}
