// =============================================================
// MODULO 10: AUTOPILOT - SCOUT -> ENRICH -> ANALYZE -> NOTION -> LEARN
// Fluxo totalmente automatico SEM APIFY - usa scraper proprio na VPS
//
// Uso:
//   node 10-autopilot.js                          (lê config do dashboard)
//   node 10-autopilot.js api-automacao 20         (CLI override)
//   node 10-autopilot.js "personal trainers" 30   (CLI override)
// =============================================================

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { detectOrCreateNicho } = require('./13-nicho-ai');
const { scrapeNicho } = require('./0-scraper');
const { AutopilotDB } = require('../config/database');

const C = {
  reset:'\x1b[0m', bright:'\x1b[1m', green:'\x1b[32m',
  yellow:'\x1b[33m', red:'\x1b[31m', cyan:'\x1b[36m',
  magenta:'\x1b[35m', blue:'\x1b[34m', dim:'\x1b[2m'
};

const DATA_DIR  = path.join(__dirname, '..', 'data');
const DB_FILE   = path.join(DATA_DIR, 'crm', 'leads-database.json');
const SCOUT_DIR = path.join(DATA_DIR, 'scout');
const LOGS_DIR  = path.join(__dirname, '..', 'logs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const db = new AutopilotDB();

function loadCRMUsernames() {
  if (!fs.existsSync(DB_FILE)) return new Set();
  const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  return new Set((dbData.leads || []).map(l => (l.username || '').toLowerCase()).filter(Boolean));
}

function runAnalyze(username, bio, followers, posts, postsDesc, nichoId, imageUrls) {
  const script = path.join(__dirname, '5-orchestrator.js');
  const args = [
    script, 'analyze',
    '@' + username,
    bio          || '',
    String(followers || 0),
    String(posts     || 0),
    postsDesc    || '',
    nichoId      || ''
  ];
  // Passa URLs de imagens via env var (evita argumentos muito longos no CLI)
  const env = { ...process.env };
  if (imageUrls && imageUrls.length > 0) {
    env.LEAD_IMAGE_URLS = imageUrls.join('|');
  }
  const r = spawnSync('node', args, { stdio: 'inherit', cwd: __dirname, env });
  return r.status === 0;
}

// Constrói descrição de posts a partir dos dados reais do perfil
// Se recentPosts estiver disponível (do scrapeProfile), usa as captions reais.
// Captions reais = melhor análise pelo LLM sem custo extra.
function buildPostsDesc(profile) {
  const posts = profile.recentPosts || [];
  const withCaption = posts.filter(p => p.caption && p.caption.trim().length > 5);
  if (withCaption.length === 0) return '';
  return withCaption.slice(0, 6)
    .map((p, i) => {
      const likes = p.likes > 0 ? ` [${p.likes} likes]` : '';
      const vid   = p.isVideo ? ' [vídeo]' : '';
      return `Post ${i+1}${likes}${vid}: ${p.caption.slice(0, 300).replace(/\n/g, ' ')}`;
    })
    .join('\n');
}

async function processNicho(nichoDesc, qtd, maxAnalyze) {
  console.log(`\n${C.yellow}>>> Processando nicho: "${nichoDesc}"${C.reset}`);

  // IA detecta ou cria o nicho automaticamente
  const { id: nichoId, config } = await detectOrCreateNicho(nichoDesc);
  const jaCRM = loadCRMUsernames();

  // ---- FASE 1+2: SCRAPING INTELIGENTE via scrapeNicho ----
  // scrapeNicho já tenta: hashtag → smart seed (topsearch+score+followers) → seeds manuais
  console.log(`\n${C.cyan}[1/4] Scraping inteligente (hashtag → smart seed → followers)...${C.reset}`);
  const rawProfiles = await scrapeNicho(config, qtd * 2);

  // Deduplicação contra o CRM existente
  const filtered = rawProfiles.filter(p => {
    const u = (p.username || '').toLowerCase();
    if (jaCRM.has(u)) {
      console.log(`  ${C.dim}@${u} já no CRM — ignorado${C.reset}`);
      return false;
    }
    return true;
  });

  console.log(`\n${C.cyan}[2/4] Deduplicação CRM: ${filtered.length}/${rawProfiles.length} novos${C.reset}`);

  if (filtered.length === 0) {
    console.log(`${C.yellow}  Nenhum candidato novo após deduplicação. Pulando.${C.reset}`);
    return { nichoId, leads: 0, analisados: 0 };
  }

  // Montar queue de leads com captions reais dos posts (zero custo extra)
  const queue = filtered.slice(0, qtd).map(p => ({
    username:    p.username,
    bio:         p.bio,
    followers:   p.followers,
    posts:       p.posts,
    postsDesc:   buildPostsDesc(p),   // captions reais ou '' se não disponível
    imageUrls:   (p.recentPosts || []).filter(rp => rp.imageUrl).map(rp => rp.imageUrl).slice(0, 4),
    nicho:       nichoId
  }));

  // Salvar queue em arquivo
  const dateStr = new Date().toISOString().split('T')[0];
  if (!fs.existsSync(SCOUT_DIR)) fs.mkdirSync(SCOUT_DIR, { recursive: true });
  const outFile = path.join(SCOUT_DIR, `autopilot-${dateStr}-${nichoId}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ nichoId, date: dateStr, total: queue.length, queue }, null, 2));
  console.log(`  Queue salva: ${outFile}`);

  // ---- FASE 3: ANALYZE (IA) ----
  console.log(`\n${C.cyan}[3/4] Analyze IA em ${Math.min(queue.length, maxAnalyze)} leads...${C.reset}`);
  const toAnalyze = queue.slice(0, maxAnalyze);
  let okCount = 0;

  for (let i = 0; i < toAnalyze.length; i++) {
    const l = toAnalyze[i];
    console.log(`\n  ${C.bright}[${i+1}/${toAnalyze.length}] @${l.username}${C.reset} | ${l.followers} followers`);
    const ok = runAnalyze(l.username, l.bio, l.followers, l.posts, l.postsDesc, nichoId, l.imageUrls);
    if (ok) okCount++;
    await sleep(400);
  }

  console.log(`\n  ${C.green}Analyze: ${okCount}/${toAnalyze.length} ok${C.reset}`);
  return { nichoId, leads: queue.length, analisados: okCount };
}

async function main() {
  const args = process.argv.slice(2);

  // ---- MODO 1: LÊ CONFIGURAÇÕES DO DASHBOARD ----
  let inputNicho, qtdTotal, maxAnalyze, syncNotion;

  if (args.length === 0) {
    console.log(`\n${C.cyan}>>> Lendo configurações do dashboard...${C.reset}`);
    const config = db.loadConfig();

    if (!config.active) {
      console.log(`${C.red}[ERRO] Autopilot está desativado no dashboard!${C.reset}`);
      console.log(`${C.yellow}Ative em: http://localhost:3131${C.reset}\n`);
      process.exit(1);
    }

    if (!config.nicho) {
      console.log(`${C.red}[ERRO] Nenhum nicho configurado no dashboard!${C.reset}`);
      console.log(`${C.yellow}Configure em: http://localhost:3131${C.reset}\n`);
      process.exit(1);
    }

    inputNicho  = config.nicho;
    qtdTotal    = config.quantidade_leads || 20;
    maxAnalyze  = config.max_analyze || 10;
    syncNotion  = config.sync_notion !== false;

    console.log(`${C.green}✓${C.reset} Nicho: ${inputNicho}`);
    console.log(`${C.green}✓${C.reset} Quantidade: ${qtdTotal} leads`);
    console.log(`${C.green}✓${C.reset} Max Analyze: ${maxAnalyze}`);
    console.log(`${C.green}✓${C.reset} Sync Notion: ${syncNotion}\n`);

  } else if (args[0] === 'help') {
    console.log(`\n${C.cyan}AUTOPILOT - Sem Apify, roda direto na VPS${C.reset}\n`);
    console.log('Uso:');
    console.log('  node 10-autopilot.js                            (lê config do dashboard)');
    console.log('  node 10-autopilot.js api-automacao 20           (CLI override)');
    console.log('  node 10-autopilot.js "personal trainers" 30     (CLI override)');
    console.log('  node 10-autopilot.js "fitness, nutricionistas" 50  (multiplos nichos)\n');
    process.exit(0);

  } else {
    // ---- MODO 2: CLI OVERRIDE (backward compatibility) ----
    inputNicho  = args[0];
    qtdTotal    = parseInt(args[1] || '20', 10);
    maxAnalyze  = parseInt(args[2] || '10', 10);
    syncNotion  = true;
    console.log(`\n${C.yellow}>>> Modo CLI (override do dashboard)${C.reset}\n`);
  }

  // Detectar multiplos nichos (separados por virgula)
  const nichos = inputNicho.split(',').map(n => n.trim()).filter(Boolean);

  console.log(`\n${C.magenta}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.bright}  AUTOPILOT VPS - ${nichos.length} nicho(s) - SEM APIFY${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(70)}${C.reset}`);
  console.log(`  Meta: ${qtdTotal} leads por nicho | Max analyze: ${maxAnalyze}`);
  console.log(`  Nichos: ${nichos.join(' | ')}`);

  const jaCRM = loadCRMUsernames();
  console.log(`  Leads no CRM (skip duplicados): ${jaCRM.size}\n`);

  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

  const resultados = [];

  for (let i = 0; i < nichos.length; i++) {
    console.log(`\n${C.magenta}${'='.repeat(70)}${C.reset}`);
    console.log(`${C.bright}  NICHO ${i+1}/${nichos.length}: ${nichos[i]}${C.reset}`);
    console.log(`${C.magenta}${'='.repeat(70)}${C.reset}`);

    try {
      const resultado = await processNicho(nichos[i], qtdTotal, maxAnalyze);
      resultados.push(resultado);
    } catch (e) {
      console.error(`${C.red}[ERRO] Nicho "${nichos[i]}": ${e.message}${C.reset}`);
      resultados.push({ nichoId: nichos[i], leads: 0, analisados: 0, erro: e.message });
    }

    if (i < nichos.length - 1) {
      console.log(`\n${C.dim}Aguardando 5s antes do proximo nicho...${C.reset}`);
      await sleep(5000);
    }
  }

  // ---- NOTION SYNC ----
  if (syncNotion) {
    console.log(`\n${C.cyan}[4/5] Sincronizando com Notion...${C.reset}`);
    const r = spawnSync(
      'node', [path.join(__dirname, '9-notion-sync.js'), 'sync'],
      { stdio: 'inherit', cwd: __dirname, env: process.env }
    );
    if (r.status !== 0) console.log(`${C.yellow}  [WARN] notion-sync retornou erro${C.reset}`);
  }

  // ---- LEARNER ----
  console.log(`\n${C.blue}[5/5] Atualizando memoria de aprendizado...${C.reset}`);
  try {
    const { runLearner } = require('./11-learner');
    await runLearner();
  } catch (e) {
    console.log(`${C.yellow}[LEARNER] ${e.message} (nao critico)${C.reset}`);
  }

  // ---- ATUALIZAR LAST RUN NO DB ----
  if (args.length === 0) {
    db.updateLastRun();
  }

  // ---- RESUMO ----
  const totalLeads    = resultados.reduce((s, r) => s + r.leads, 0);
  const totalAnalisados = resultados.reduce((s, r) => s + r.analisados, 0);

  console.log(`\n${C.magenta}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.bright}  AUTOPILOT CONCLUIDO${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(70)}${C.reset}\n`);

  resultados.forEach(r => {
    const st = r.erro ? `${C.red}ERRO${C.reset}` : `${C.green}OK${C.reset}`;
    console.log(`  ${st} ${r.nichoId}: ${r.leads} leads | ${r.analisados} analisados`);
  });

  console.log(`\n  ${C.bright}TOTAL: ${totalLeads} leads | ${totalAnalisados} analisados${C.reset}`);
  console.log(`  Dashboard: http://localhost:3131`);
  console.log(`${C.magenta}${'='.repeat(70)}${C.reset}\n`);
}

main().catch(e => {
  console.error(`\n${C.red}[AUTOPILOT ERROR]${C.reset}`, e.message);
  process.exit(1);
});
