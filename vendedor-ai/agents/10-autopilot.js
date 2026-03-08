// =============================================================
// MODULO 10: AUTOPILOT - SCOUT -> ENRICH -> ANALYZE -> NOTION -> LEARN
// Fluxo totalmente automatico: hashtags -> perfis -> AI -> CRM -> aprendizado
//
// Uso:
//   node 10-autopilot.js api-automacao 20
//   node 10-autopilot.js "personal trainers fitness" 30
//   node 10-autopilot.js "nutricionistas, coaches fitness" 50
// =============================================================

require('dotenv').config();
const https    = require('https');
const fs       = require('fs');
const path     = require('path');
const { spawnSync } = require('child_process');
const { detectOrCreateNicho, getAllNichos } = require('./13-nicho-ai');

const APIFY = process.env.APIFY_API_TOKEN;

const C = {
  reset:'\x1b[0m', bright:'\x1b[1m', green:'\x1b[32m',
  yellow:'\x1b[33m', red:'\x1b[31m', cyan:'\x1b[36m',
  magenta:'\x1b[35m', blue:'\x1b[34m'
};

const DATA_DIR  = path.join(__dirname, '..', 'data');
const DB_FILE   = path.join(DATA_DIR, 'crm', 'leads-database.json');
const SCOUT_DIR = path.join(DATA_DIR, 'scout');

function apiRequest(method, host, p, body, tokenQ) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const qs = tokenQ ? `?token=${tokenQ}` : '';
    const req = https.request({
      hostname: host,
      path: p + qs,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadCRMUsernames() {
  if (!fs.existsSync(DB_FILE)) return new Set();
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  return new Set((db.leads || []).map(l => (l.username || '').toLowerCase()).filter(Boolean));
}

async function startRun(actorId, input) {
  const res = await apiRequest('POST', 'api.apify.com', `/v2/acts/${actorId}/runs`, input, APIFY);
  if (res.status !== 201 && res.status !== 200)
    throw new Error(`Apify startRun ${actorId}: ${JSON.stringify(res.body)}`);
  return res.body.data.id;
}

async function waitRun(runId, maxMinutes = 8) {
  const maxPolls = maxMinutes * 12;
  for (let i = 0; i < maxPolls; i++) {
    await sleep(5000);
    const res = await apiRequest('GET', 'api.apify.com', `/v2/actor-runs/${runId}`, null, APIFY);
    const st  = res.body?.data?.status;
    process.stdout.write('.');
    if (st === 'SUCCEEDED') { process.stdout.write('\n'); return true; }
    if (['FAILED','ABORTED','TIMED-OUT'].includes(st)) { process.stdout.write('\n'); return false; }
  }
  process.stdout.write('\n');
  return false;
}

async function datasetItems(runId, limit) {
  const res = await apiRequest(
    'GET', 'api.apify.com',
    `/v2/actor-runs/${runId}/dataset/items`,
    null,
    `${APIFY}&limit=${limit}`
  );
  if (res.status !== 200) return [];
  return Array.isArray(res.body) ? res.body : (res.body.items || []);
}

async function scrapeByHashtags(hashtags, resultsLimit) {
  console.log(`  Actor: apify~instagram-hashtag-scraper`);
  console.log(`  Hashtags: ${hashtags.join(', ')}`);
  const runId = await startRun('apify~instagram-hashtag-scraper', {
    hashtags: hashtags.map(h => h.replace('#','')),
    resultsLimit,
    proxy: { useApifyProxy: true }
  });
  console.log(`  Run ID: ${runId}`);
  process.stdout.write('  Aguardando ');
  const ok = await waitRun(runId);
  if (!ok) throw new Error('Hashtag scraper falhou ou foi abortado');
  return datasetItems(runId, resultsLimit * 5);
}

async function scrapeProfiles(usernames) {
  console.log(`  Actor: apify~instagram-profile-scraper`);
  console.log(`  Perfis: ${usernames.length}`);
  const runId = await startRun('apify~instagram-profile-scraper', {
    usernames,
    resultsLimit: usernames.length,
    proxy: { useApifyProxy: true }
  });
  console.log(`  Run ID: ${runId}`);
  process.stdout.write('  Aguardando ');
  const ok = await waitRun(runId);
  if (!ok) throw new Error('Profile scraper falhou ou foi abortado');
  return datasetItems(runId, usernames.length * 2);
}

function runAnalyze(username, bio, followers, posts, postsDesc, nichoId) {
  const script = path.join(__dirname, '5-orchestrator.js');
  const args   = [
    script, 'analyze',
    '@' + username,
    bio         || '',
    String(followers || 0),
    String(posts     || 0),
    postsDesc   || '',
    nichoId     || ''
  ];
  const r = spawnSync('node', args, { stdio: 'inherit', cwd: __dirname, env: process.env });
  return r.status === 0;
}

function pickPostsDesc(config, caption) {
  const c = (caption || '').replace(/\s+/g,' ').trim().slice(0, 350);
  return [
    `post recente indica contexto do nicho (${config.nome})`,
    `dor alvo: ${config.dor_principal}`,
    c ? `caption: ${c}` : null
  ].filter(Boolean).join(' | ');
}

async function processNicho(nichoDesc, qtdTotal, maxAnalyze, syncNotion) {
  console.log(`\n${C.yellow}>>> Processando nicho: "${nichoDesc}"${C.reset}`);

  // Detectar ou criar nicho
  const { id: nichoId, config } = await detectOrCreateNicho(nichoDesc);

  const qtd = qtdTotal;
  const jaCRM = loadCRMUsernames();

  console.log(`\n${C.cyan}[1/5] Scraping hashtags via Apify...${C.reset}`);
  const posts = await scrapeByHashtags(config.hashtags.slice(0, 4), qtd * 6);
  console.log(`  Posts coletados: ${posts.length}`);

  const uniq = new Map();
  for (const p of posts) {
    const u = (p.ownerUsername || '').toLowerCase().trim();
    if (!u || jaCRM.has(u)) continue;
    if (!uniq.has(u)) uniq.set(u, { username: u, caption: p.caption || '', ts: p.timestamp || '' });
  }
  console.log(`  Usernames novos (nao no CRM): ${uniq.size}`);

  const candidates = Array.from(uniq.values()).slice(0, Math.max(qtd * 2, maxAnalyze * 3));
  const usernames  = candidates.map(x => x.username);

  if (usernames.length === 0) {
    console.log(`${C.yellow}  Nenhum candidato novo. Pulando este nicho.${C.reset}`);
    return { nichoId, leads: 0, analisados: 0 };
  }

  console.log(`\n${C.cyan}[2/5] Enriquecendo ${usernames.length} perfis...${C.reset}`);
  const profs = await scrapeProfiles(usernames);

  const profMap = new Map();
  for (const pr of profs) {
    const u = (pr.username || pr.ownerUsername || '').toLowerCase().trim();
    if (!u) continue;
    profMap.set(u, {
      bio:       pr.biography    || pr.bio       || '',
      followers: pr.followersCount || pr.followers || 0,
      posts:     pr.postsCount   || pr.posts     || 0
    });
  }
  console.log(`  Perfis enriquecidos: ${profMap.size}`);

  const queue = [];
  for (const c of candidates) {
    const pr = profMap.get(c.username) || { bio:'', followers:0, posts:0 };
    queue.push({
      username:  c.username,
      bio:       pr.bio,
      followers: pr.followers,
      posts:     pr.posts,
      postsDesc: pickPostsDesc(config, c.caption),
      nicho:     nichoId
    });
    if (queue.length >= qtd) break;
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const outFile = path.join(SCOUT_DIR, `autopilot-${dateStr}-${nichoId}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ nicho: nichoId, date: dateStr, total: queue.length, queue }, null, 2));
  console.log(`  Queue salva: ${outFile}`);

  console.log(`\n${C.cyan}[3/5] Analyze em ${Math.min(queue.length, maxAnalyze)} leads...${C.reset}`);
  const toAnalyze = queue.slice(0, maxAnalyze);
  let okCount = 0;

  for (let i = 0; i < toAnalyze.length; i++) {
    const l = toAnalyze[i];
    console.log(`\n${C.bright}[${i+1}/${toAnalyze.length}] @${l.username}${C.reset} | ${l.followers} followers`);
    const ok = runAnalyze(l.username, l.bio, l.followers, l.posts, l.postsDesc, nichoId);
    if (ok) okCount++;
    await sleep(400);
  }

  console.log(`\n${C.green}  Analyze: ${okCount}/${toAnalyze.length} ok${C.reset}`);

  return { nichoId, leads: queue.length, analisados: okCount };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`\n${C.cyan}AUTOPILOT - Sistema automatico de prospeccao${C.reset}\n`);
    console.log('Uso:');
    console.log('  node 10-autopilot.js api-automacao 20');
    console.log('  node 10-autopilot.js "personal trainers fitness" 30');
    console.log('  node 10-autopilot.js "nutricionistas, coaches" 50\n');
    console.log('Multiplos nichos (separe por virgula):');
    console.log('  node 10-autopilot.js "fitness, nutricionistas, psicologos" 20\n');
    process.exit(0);
  }

  if (!APIFY) {
    console.error(`${C.red}[AUTOPILOT] APIFY_API_TOKEN ausente no .env${C.reset}`);
    process.exit(1);
  }

  const inputNicho = args[0];
  const qtdTotal   = parseInt(args[1] || process.env.AUTOPILOT_QTD || '20', 10);
  const maxAnalyze = parseInt(args[2] || process.env.AUTOPILOT_MAX_ANALYZE || '10', 10);
  const syncNotion = (process.env.AUTOPILOT_SYNC_NOTION || 'true').toLowerCase() === 'true';

  if (!fs.existsSync(SCOUT_DIR)) fs.mkdirSync(SCOUT_DIR, { recursive: true });

  // Detectar se sao multiplos nichos
  const nichos = inputNicho.split(',').map(n => n.trim()).filter(Boolean);

  console.log(`\n${C.magenta}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.bright}  AUTOPILOT - ${nichos.length} nicho(s)${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(70)}${C.reset}`);
  console.log(`  Meta total: ${qtdTotal} leads por nicho`);
  console.log(`  Max analyze: ${maxAnalyze} por nicho`);
  console.log(`  Notion sync: ${syncNotion}`);
  console.log(`  Nichos: ${nichos.join(', ')}\n`);

  const jaCRM = loadCRMUsernames();
  console.log(`  Leads ja no CRM (skip): ${jaCRM.size}\n`);

  const resultados = [];

  for (let i = 0; i < nichos.length; i++) {
    console.log(`\n${C.magenta}${'='.repeat(70)}${C.reset}`);
    console.log(`${C.bright}  NICHO ${i+1}/${nichos.length}: ${nichos[i]}${C.reset}`);
    console.log(`${C.magenta}${'='.repeat(70)}${C.reset}`);

    try {
      const resultado = await processNicho(nichos[i], qtdTotal, maxAnalyze, syncNotion);
      resultados.push(resultado);
    } catch (e) {
      console.error(`${C.red}[ERRO] Nicho "${nichos[i]}": ${e.message}${C.reset}`);
      resultados.push({ nichoId: nichos[i], leads: 0, analisados: 0, erro: e.message });
    }

    if (i < nichos.length - 1) {
      console.log(`\n${C.dim}Aguardando 3s antes do proximo nicho...${C.reset}`);
      await sleep(3000);
    }
  }

  // Notion sync
  if (syncNotion) {
    console.log(`\n${C.cyan}[4/5] Sincronizando com Notion...${C.reset}`);
    const r = spawnSync(
      'node', [path.join(__dirname, '9-notion-sync.js'), 'sync'],
      { stdio: 'inherit', cwd: __dirname, env: process.env }
    );
    if (r.status !== 0) console.log(`${C.yellow}  [WARN] notion-sync retornou erro${C.reset}`);
  } else {
    console.log(`\n${C.yellow}[4/5] Notion sync pulado (AUTOPILOT_SYNC_NOTION=false)${C.reset}`);
  }

  // Learner
  console.log(`\n${C.blue}[5/5] Atualizando memoria de aprendizado...${C.reset}`);
  try {
    const { runLearner } = require('./11-learner');
    await runLearner();
  } catch (e) {
    console.log(`${C.yellow}[LEARNER] Aviso: ${e.message}${C.reset}`);
    console.log(`${C.yellow}  (nao critico — pipeline concluido)${C.reset}`);
  }

  // Resumo final
  console.log(`\n${C.magenta}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.bright}  AUTOPILOT CONCLUIDO${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(70)}${C.reset}\n`);

  const totalLeads = resultados.reduce((s, r) => s + r.leads, 0);
  const totalAnalise = resultados.reduce((s, r) => s + r.analisados, 0);

  resultados.forEach(r => {
    const status = r.erro ? `${C.red}ERRO${C.reset}` : `${C.green}OK${C.reset}`;
    console.log(`  ${status} ${r.nichoId}: ${r.leads} leads | ${r.analisados} analisados`);
  });

  console.log(`\n  ${C.bright}TOTAL: ${totalLeads} leads | ${totalAnalise} analisados${C.reset}`);
  console.log(`\n  → Dashboard: node 8-dashboard.js  —  http://localhost:3131`);
  console.log(`${C.magenta}${'='.repeat(70)}${C.reset}\n`);
}

main().catch(e => {
  console.error(`\n${C.red}[AUTOPILOT ERROR]${C.reset}`, e.message);
  process.exit(1);
});
