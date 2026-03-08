// =============================================================
// MODULO 10: AUTOPILOT - SCOUT -> ENRICH -> ANALYZE -> NOTION -> LEARN
// Fluxo totalmente automatico: hashtags -> perfis -> AI -> CRM -> aprendizado
//
// Uso:
//   node 10-autopilot.js [nicho] [qtd] [maxAnalyze]
//   node 10-autopilot.js api-automacao 20 8
// =============================================================

require('dotenv').config();
const https    = require('https');
const fs       = require('fs');
const path     = require('path');
const { spawnSync } = require('child_process');
const { NICHOS } = require('./6-scout');

const APIFY       = process.env.APIFY_API_TOKEN;
const NICHO       = process.argv[2] || process.env.AUTOPILOT_NICHO || 'api-automacao';
const QTD         = parseInt(process.argv[3] || process.env.AUTOPILOT_QTD  || '20',  10);
const MAX_ANALYZE = parseInt(process.argv[4] || process.env.AUTOPILOT_MAX_ANALYZE || '10', 10);
const SYNC_NOTION = (process.env.AUTOPILOT_SYNC_NOTION || 'true').toLowerCase() === 'true';

// paths (agents/ esta dentro de vendedor-ai/)
const DATA_DIR  = path.join(__dirname, '..', 'data');
const DB_FILE   = path.join(DATA_DIR, 'crm', 'leads-database.json');
const SCOUT_DIR = path.join(DATA_DIR, 'scout');

const C = {
  reset:'\x1b[0m', bright:'\x1b[1m', green:'\x1b[32m',
  yellow:'\x1b[33m', red:'\x1b[31m', cyan:'\x1b[36m',
  magenta:'\x1b[35m', blue:'\x1b[34m'
};

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

function runAnalyze(username, bio, followers, posts, postsDesc) {
  const script = path.join(__dirname, '5-orchestrator.js');
  const args   = [
    script, 'analyze',
    '@' + username,
    bio         || '',
    String(followers || 0),
    String(posts     || 0),
    postsDesc   || ''
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

async function main() {
  if (!APIFY) {
    console.error(`${C.red}[AUTOPILOT] APIFY_API_TOKEN ausente no .env${C.reset}`);
    process.exit(1);
  }

  const config = NICHOS[NICHO];
  if (!config) {
    console.error(`${C.red}[AUTOPILOT] Nicho invalido: "${NICHO}"${C.reset}`);
    console.log('Nichos disponiveis:', Object.keys(NICHOS).join(' | '));
    process.exit(1);
  }

  if (!fs.existsSync(SCOUT_DIR)) fs.mkdirSync(SCOUT_DIR, { recursive: true });

  console.log(`\n${C.magenta}${'='.repeat(64)}${C.reset}`);
  console.log(`${C.bright}  AUTOPILOT — ${config.nome}${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(64)}${C.reset}`);
  console.log(`  Meta: ${QTD} leads  |  Max analyze: ${MAX_ANALYZE}  |  Notion: ${SYNC_NOTION}`);

  const jaCRM = loadCRMUsernames();
  console.log(`  Leads ja no CRM (skip): ${jaCRM.size}\n`);

  // 1. Hashtags
  console.log(`${C.cyan}[1/5] Scraping hashtags via Apify...${C.reset}`);
  const posts = await scrapeByHashtags(config.hashtags.slice(0, 4), QTD * 6);
  console.log(`  Posts coletados: ${posts.length}`);

  const uniq = new Map();
  for (const p of posts) {
    const u = (p.ownerUsername || '').toLowerCase().trim();
    if (!u || jaCRM.has(u)) continue;
    if (!uniq.has(u)) uniq.set(u, { username: u, caption: p.caption || '', ts: p.timestamp || '' });
  }
  console.log(`  Usernames novos (nao no CRM): ${uniq.size}`);

  const candidates = Array.from(uniq.values()).slice(0, Math.max(QTD * 2, MAX_ANALYZE * 3));
  const usernames  = candidates.map(x => x.username);

  if (usernames.length === 0) {
    console.log(`${C.yellow}  Nenhum candidato novo. Tente outro nicho ou aumente QTD.${C.reset}`);
    process.exit(0);
  }

  // 2. Enrich perfis
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
      postsDesc: pickPostsDesc(config, c.caption)
    });
    if (queue.length >= QTD) break;
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const outFile = path.join(SCOUT_DIR, `autopilot-${dateStr}-${NICHO}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ nicho: NICHO, date: dateStr, total: queue.length, queue }, null, 2));
  console.log(`  Queue salva: ${outFile}`);

  // 3. Analyze
  console.log(`\n${C.cyan}[3/5] Analyze em ${Math.min(queue.length, MAX_ANALYZE)} leads...${C.reset}`);
  const toAnalyze = queue.slice(0, MAX_ANALYZE);
  let okCount = 0;

  for (let i = 0; i < toAnalyze.length; i++) {
    const l = toAnalyze[i];
    console.log(`\n${C.bright}[${i+1}/${toAnalyze.length}] @${l.username}${C.reset} | ${l.followers} followers`);
    const ok = runAnalyze(l.username, l.bio, l.followers, l.posts, l.postsDesc);
    if (ok) okCount++;
    await sleep(400);
  }

  console.log(`\n${C.green}  Analyze: ${okCount}/${toAnalyze.length} ok${C.reset}`);

  // 4. Notion sync
  if (SYNC_NOTION) {
    console.log(`\n${C.cyan}[4/5] Sincronizando com Notion...${C.reset}`);
    const r = spawnSync(
      'node', [path.join(__dirname, '9-notion-sync.js'), 'sync'],
      { stdio: 'inherit', cwd: __dirname, env: process.env }
    );
    if (r.status !== 0) console.log(`${C.yellow}  [WARN] notion-sync retornou erro${C.reset}`);
  } else {
    console.log(`\n${C.yellow}[4/5] Notion sync pulado (AUTOPILOT_SYNC_NOTION=false)${C.reset}`);
  }

  // 5. Learner
  console.log(`\n${C.blue}[5/5] Atualizando memoria de aprendizado...${C.reset}`);
  try {
    const { runLearner } = require('./11-learner');
    await runLearner();
  } catch (e) {
    console.log(`${C.yellow}[LEARNER] Aviso: ${e.message}${C.reset}`);
    console.log(`${C.yellow}  (nao critico — pipeline concluido)${C.reset}`);
  }

  console.log(`\n${C.magenta}${'='.repeat(64)}${C.reset}`);
  console.log(`${C.bright}  AUTOPILOT CONCLUIDO${C.reset}`);
  console.log(`  ✓ ${queue.length} leads na queue`);
  console.log(`  ✓ ${okCount} analisados e salvos no CRM`);
  console.log(`  ✓ Memoria de aprendizado atualizada`);
  console.log(`  → Dashboard: node 8-dashboard.js  —  http://localhost:3131`);
  console.log(`${C.magenta}${'='.repeat(64)}${C.reset}\n`);
}

main().catch(e => {
  console.error(`\n${C.red}[AUTOPILOT ERROR]${C.reset}`, e.message);
  process.exit(1);
});
