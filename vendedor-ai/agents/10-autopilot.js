// =============================================================
// MODULO 10: AUTOPILOT - GMB -> ENRICH -> ANALYZE -> NOTION -> LEARN
// Fluxo automatico com duas fontes de leads:
//   1. GMB (Google Maps) — busca negócios reais por nicho+cidade (PADRÃO)
//   2. Instagram hashtag — fallback quando GMB não é ideal
//
// Uso:
//   node 10-autopilot.js                          (lê config do dashboard)
//   node 10-autopilot.js api-automacao 20         (CLI override - hashtag)
//   node 10-autopilot.js "personal trainers" 30   (CLI override - hashtag)
// =============================================================

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { detectOrCreateNicho } = require('./13-nicho-ai');
const { scrapeNicho } = require('./0-scraper');
const { scrapeGMB } = require('./0-gmb-scraper');
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

const STATUS_FILE = path.join(DATA_DIR, 'autopilot-status.json');
function writeProgress(extra = {}) {
  try {
    fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
    fs.writeFileSync(STATUS_FILE, JSON.stringify({
      status: 'running',
      updatedAt: new Date().toISOString(),
      ...extra
    }));
  } catch {}
}

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

async function processNicho(nichoDesc, qtd, maxAnalyze, options = {}) {
  const { mode = 'gmb', city = 'São Paulo' } = options;
  console.log(`\n${C.yellow}>>> Processando nicho: "${nichoDesc}" [modo: ${mode.toUpperCase()}]${C.reset}`);

  // IA detecta ou cria o nicho automaticamente
  const { id: nichoId, config } = await detectOrCreateNicho(nichoDesc);
  const jaCRM = loadCRMUsernames();

  let rawProfiles;

  if (mode === 'gmb') {
    // ---- MODO GMB: Google Maps → Instagram ----
    console.log(`\n${C.cyan}[1/4] Buscando negócios no Google Maps (${city})...${C.reset}`);
    writeProgress({ step: 1, stepLabel: 'Buscando no Google Maps', detail: `Procurando "${nichoDesc}" em ${city}` });
    rawProfiles = await scrapeGMB(nichoDesc, city, qtd * 2);
  } else {
    // ---- MODO HASHTAG: Instagram scraping (legado) ----
    console.log(`\n${C.cyan}[1/4] Scraping inteligente (hashtag → smart seed → followers)...${C.reset}`);
    writeProgress({ step: 1, stepLabel: 'Buscando leads', detail: `Procurando perfis em "${nichoDesc}"` });
    rawProfiles = await scrapeNicho(config, qtd * 2);
  }

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
  writeProgress({ step: 2, stepLabel: 'Filtrando duplicados', detail: `${filtered.length} leads novos encontrados` });

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
    nicho:       nichoId,
    // Dados GMB (enriquecimento extra para leads vindos do Google Maps)
    gmb:         p.gmb || null,
  }));

  // Salvar queue em arquivo
  const dateStr = new Date().toISOString().split('T')[0];
  if (!fs.existsSync(SCOUT_DIR)) fs.mkdirSync(SCOUT_DIR, { recursive: true });
  const outFile = path.join(SCOUT_DIR, `autopilot-${dateStr}-${nichoId}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ nichoId, date: dateStr, total: queue.length, queue }, null, 2));
  console.log(`  Queue salva: ${outFile}`);

  // ---- FASE 3: ANALYZE (IA) ----
  console.log(`\n${C.cyan}[3/4] Analyze IA em ${Math.min(queue.length, maxAnalyze)} leads...${C.reset}`);
  writeProgress({ step: 3, stepLabel: 'Analisando com IA', detail: `Pontuando ${Math.min(queue.length, maxAnalyze)} perfis` });
  const toAnalyze = queue.slice(0, maxAnalyze);
  let okCount = 0;

  for (let i = 0; i < toAnalyze.length; i++) {
    const l = toAnalyze[i];
    console.log(`\n  ${C.bright}[${i+1}/${toAnalyze.length}] @${l.username}${C.reset} | ${l.followers} followers`);
    writeProgress({ step: 3, stepLabel: 'Analisando com IA', detail: `Analisando @${l.username} (${i+1}/${toAnalyze.length})`, analyzed: i+1, total: toAnalyze.length });
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
  let inputNicho, qtdTotal, maxAnalyze, syncNotion, searchMode, searchCity;

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
    searchMode  = config.search_mode || 'gmb';  // 'gmb' ou 'hashtag'
    searchCity  = config.search_city || 'São Paulo';

    console.log(`${C.green}✓${C.reset} Modo: ${searchMode.toUpperCase()}`);
    if (searchMode === 'gmb') console.log(`${C.green}✓${C.reset} Cidade: ${searchCity}`);
    console.log(`${C.green}✓${C.reset} Nicho: ${inputNicho}`);
    console.log(`${C.green}✓${C.reset} Quantidade: ${qtdTotal} leads`);
    console.log(`${C.green}✓${C.reset} Max Analyze: ${maxAnalyze}`);
    console.log(`${C.green}✓${C.reset} Sync Notion: ${syncNotion}\n`);

  } else if (args[0] === 'help') {
    console.log(`\n${C.cyan}AUTOPILOT - GMB + Instagram${C.reset}\n`);
    console.log('Uso:');
    console.log('  node 10-autopilot.js                                        (lê config do dashboard)');
    console.log('  node 10-autopilot.js --gmb "salão de beleza" "São Paulo" 20  (modo GMB)');
    console.log('  node 10-autopilot.js --hashtag api-automacao 20              (modo hashtag legado)');
    console.log('  node 10-autopilot.js "fitness, nutricionistas" 50            (hashtag, backward compat)\n');
    process.exit(0);

  } else if (args[0] === '--gmb') {
    // ---- MODO GMB CLI ----
    inputNicho  = args[1] || 'salão de beleza';
    searchCity  = args[2] || 'São Paulo';
    qtdTotal    = parseInt(args[3] || '20', 10);
    maxAnalyze  = parseInt(args[4] || '10', 10);
    searchMode  = 'gmb';
    syncNotion  = true;
    console.log(`\n${C.yellow}>>> Modo CLI GMB: "${inputNicho}" em ${searchCity}${C.reset}\n`);

  } else if (args[0] === '--hashtag') {
    // ---- MODO HASHTAG CLI ----
    inputNicho  = args[1] || 'automacao';
    qtdTotal    = parseInt(args[2] || '20', 10);
    maxAnalyze  = parseInt(args[3] || '10', 10);
    searchMode  = 'hashtag';
    searchCity  = '';
    syncNotion  = true;
    console.log(`\n${C.yellow}>>> Modo CLI Hashtag: "${inputNicho}"${C.reset}\n`);

  } else {
    // ---- MODO 2: CLI OVERRIDE (backward compatibility → hashtag) ----
    inputNicho  = args[0];
    qtdTotal    = parseInt(args[1] || '20', 10);
    maxAnalyze  = parseInt(args[2] || '10', 10);
    searchMode  = 'hashtag';
    searchCity  = '';
    syncNotion  = true;
    console.log(`\n${C.yellow}>>> Modo CLI legado (hashtag)${C.reset}\n`);
  }

  // Detectar multiplos nichos (separados por virgula)
  const nichos = inputNicho.split(',').map(n => n.trim()).filter(Boolean);

  console.log(`\n${C.magenta}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.bright}  AUTOPILOT VPS - ${nichos.length} nicho(s) - ${searchMode === 'gmb' ? 'GOOGLE MAPS' : 'INSTAGRAM HASHTAG'}${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(70)}${C.reset}`);
  console.log(`  Modo: ${searchMode.toUpperCase()}${searchMode === 'gmb' ? ` | Cidade: ${searchCity}` : ''}`);
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
      const resultado = await processNicho(nichos[i], qtdTotal, maxAnalyze, {
        mode: searchMode,
        city: searchCity || 'São Paulo'
      });
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
    writeProgress({ step: 4, stepLabel: 'Criando mensagens', detail: 'Gerando DMs personalizadas com IA' });
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
  const totalLeads      = resultados.reduce((s, r) => s + r.leads, 0);
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

  // ---- ARQUIVO DE STATUS (lido pelo dashboard para saber que concluiu) ----
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({
      status: 'completed',
      completedAt: new Date().toISOString(),
      step: 4, stepLabel: 'Concluído',
      detail: `${totalLeads} leads encontrados · ${totalAnalisados} analisados`,
      totalLeads,
      totalAnalisados,
      nichos: resultados.map(r => r.nichoId)
    }));
  } catch {}
}

main().catch(e => {
  console.error(`\n${C.red}[AUTOPILOT ERROR]${C.reset}`, e.message);
  // Escreve status de erro para o dashboard
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({
      status: 'error',
      errorAt: new Date().toISOString(),
      stepLabel: 'Erro',
      detail: e.message,
      error: e.message
    }));
  } catch {}
  process.exit(1);
});
