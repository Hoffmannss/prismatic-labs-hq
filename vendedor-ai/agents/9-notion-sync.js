// =============================================================
// MODULO 9: NOTION SYNC - PRISMATIC LABS VENDEDOR AI
// Sincroniza o CRM JSON com um Database no Notion
//
// Comandos:
//   node 9-notion-sync.js setup  -> Cria o database no Notion
//   node 9-notion-sync.js sync   -> Sincroniza todos os leads
//   node 9-notion-sync.js status -> Verifica conexao
// =============================================================

require('dotenv').config();
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const TOKEN       = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const PARENT_ID   = process.env.NOTION_PARENT_PAGE_ID;
const DB_FILE     = path.join(__dirname, '..', 'data', 'crm', 'leads-database.json');
const CACHE_FILE  = path.join(__dirname, '..', 'data', 'crm', 'notion-sync-cache.json');
const CMD         = process.argv[2] || 'sync';

// Gera fingerprint dos campos que podem mudar — detecta se lead precisa de UPDATE
function leadFingerprint(lead) {
  const a  = lead.analise || {};
  const ap = a.analise_posts || {};
  let reviewScore = null;
  try {
    const mFile = path.join(__dirname, '..', 'data', 'mensagens', lead.username + '_mensagens.json');
    if (fs.existsSync(mFile)) {
      const m = JSON.parse(fs.readFileSync(mFile, 'utf8'));
      reviewScore = m.revisao?.score || null;
    }
  } catch {}
  return JSON.stringify({
    score:        lead.score,
    status:       lead.status,
    prioridade:   lead.prioridade,
    nicho:        lead.nicho || a.nicho,
    problema:     a.problema_principal,
    servico:      a.servico_ideal,
    followups:    lead.followups_enviados || 0,
    prox:         lead.proximo_followup || null,
    ultima:       lead.data_ultima_interacao || null,
    gancho:       ap.gancho_ideal || null,
    reviewer:     reviewScore,
  });
}

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m'
};

if (!TOKEN) {
  console.error(`${C.red}[NOTION] NOTION_API_KEY ou NOTION_TOKEN nao encontrada no .env${C.reset}`);
  console.log('  1. Acesse https://www.notion.so/my-integrations');
  console.log('  2. Crie uma integracao (ex: Vendedor AI)');
  console.log('  3. Copie o token e adicione ao .env: NOTION_TOKEN=ntn_...');
  process.exit(1);
}

function notionRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'api.notion.com',
      path: '/v1' + endpoint,
      method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const DB_SCHEMA = {
  'Nome':              { title: {} },
  'Status':            { select: { options: [
    { name: 'novo',          color: 'blue'   },
    { name: 'contatado',     color: 'green'  },
    { name: 'respondeu',     color: 'yellow' },
    { name: 'em_negociacao', color: 'orange' },
    { name: 'fechado',       color: 'green'  },
    { name: 'perdido',       color: 'red'    }
  ]}},
  'Prioridade':        { select: { options: [
    { name: 'hot',  color: 'red'    },
    { name: 'warm', color: 'yellow' },
    { name: 'cold', color: 'blue'   }
  ]}},
  'Score':             { number: { format: 'number' } },
  'Produto':           { select: { options: [
    { name: 'Lead Normalizer API', color: 'purple' },
    { name: 'Landing Page',        color: 'pink'   }
  ]}},
  'Nicho':             { rich_text: {} },
  'Problema':          { rich_text: {} },
  'Prox Followup':     { date: {} },
  'Ultima Interacao':  { date: {} },
  'Score Reviewer':    { number: { format: 'number' } },
  'Posts Analisados':  { checkbox: {} },
  'Gancho':            { rich_text: {} },
  'Msgs Enviadas':     { number: { format: 'number' } },
};

function buildProperties(lead) {
  const a   = lead.analise || {};
  const ap  = a.analise_posts || {};
  const produto = a.servico_ideal === 'lead_normalizer_api' ? 'Lead Normalizer API' : 'Landing Page';

  const safeDate = (d) => {
    if (!d) return { date: null };
    try { return { date: { start: new Date(d).toISOString().split('T')[0] } }; }
    catch { return { date: null }; }
  };

  const safeText = (t) => ({ rich_text: [{ text: { content: String(t || '').slice(0, 2000) } }] });

  let reviewScore = null;
  try {
    const mFile = path.join(__dirname, '..', 'data', 'mensagens', lead.username + '_mensagens.json');
    if (fs.existsSync(mFile)) {
      const m = JSON.parse(fs.readFileSync(mFile, 'utf8'));
      reviewScore = m.revisao?.score || null;
    }
  } catch {}

  return {
    'Nome':             { title: [{ text: { content: '@' + lead.username } }] },
    'Status':           { select: { name: lead.status || 'novo' } },
    'Prioridade':       { select: { name: lead.prioridade || 'cold' } },
    'Score':            { number: lead.score || 0 },
    'Produto':          { select: { name: produto } },
    'Nicho':            safeText(lead.nicho || a.nicho),
    'Problema':         safeText(a.problema_principal),
    'Prox Followup':    safeDate(lead.proximo_followup),
    'Ultima Interacao': safeDate(lead.data_ultima_interacao),
    'Score Reviewer':   { number: reviewScore },
    'Posts Analisados': { checkbox: !!(ap.tem_posts_analisados) },
    'Gancho':           safeText(ap.gancho_ideal),
    'Msgs Enviadas':    { number: lead.followups_enviados || 0 },
  };
}

async function getExistingPages() {
  const map = {};
  let cursor = undefined;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await notionRequest('POST', '/databases/' + DATABASE_ID + '/query', body);
    if (res.status !== 200) {
      console.error(`${C.red}[NOTION] Erro ao consultar database: ${JSON.stringify(res.body.message || res.body)}${C.reset}`);
      return null;
    }
    for (const page of res.body.results || []) {
      const titleProp = page.properties?.Nome?.title;
      if (titleProp?.length > 0) {
        const username = (titleProp[0].text?.content || '').replace('@', '');
        if (username) map[username] = page.id;
      }
    }
    cursor = res.body.has_more ? res.body.next_cursor : undefined;
  } while (cursor);
  return map;
}

async function sync() {
  if (!DATABASE_ID) {
    console.error(`${C.red}[NOTION] NOTION_DATABASE_ID nao encontrado no .env${C.reset}`);
    console.log('  Execute: node 9-notion-sync.js setup');
    process.exit(1);
  }
  if (!fs.existsSync(DB_FILE)) {
    console.error(`${C.red}[NOTION] CRM vazio. Adicione leads primeiro.${C.reset}`);
    process.exit(1);
  }

  const db    = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const leads = db.leads || [];

  console.log(`\n${C.magenta}${'='.repeat(52)}${C.reset}`);
  console.log(`${C.bright}  NOTION SYNC — ${leads.length} leads${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(52)}${C.reset}`);

  console.log(`\n${C.cyan}[NOTION] Consultando database...${C.reset}`);
  const existing = await getExistingPages();
  if (existing === null) process.exit(1);
  console.log(`${C.cyan}[NOTION] ${Object.keys(existing).length} paginas ja no Notion${C.reset}`);

  // Carregar cache de fingerprints
  let cache = {};
  try { if (fs.existsSync(CACHE_FILE)) cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch {}

  let created = 0, updated = 0, skipped = 0, errors = 0;

  for (const lead of leads) {
    const pageId     = existing[lead.username];
    const fingerprint = leadFingerprint(lead);

    // Skip UPDATE se nada mudou desde o último sync
    if (pageId && cache[lead.username] === fingerprint) {
      skipped++;
      console.log(`  ${C.cyan}[SKIP]   @${lead.username} — sem mudanças${C.reset}`);
      continue;
    }

    const props = buildProperties(lead);
    try {
      if (pageId) {
        const res = await notionRequest('PATCH', '/pages/' + pageId, { properties: props });
        if (res.status === 200) {
          updated++;
          cache[lead.username] = fingerprint;
          console.log(`${C.green}  [UPDATE] @${lead.username} — ${lead.prioridade} | score ${lead.score}${C.reset}`);
        } else { errors++; console.log(`${C.red}  [ERRO]   @${lead.username} — ${res.body.message || res.status}${C.reset}`); }
      } else {
        const res = await notionRequest('POST', '/pages', { parent: { database_id: DATABASE_ID }, properties: props });
        if (res.status === 200) {
          created++;
          cache[lead.username] = fingerprint;
          console.log(`${C.cyan}  [CREATE] @${lead.username} — ${lead.prioridade} | score ${lead.score}${C.reset}`);
        } else { errors++; console.log(`${C.red}  [ERRO]   @${lead.username} — ${res.body.message || res.status}${C.reset}`); }
      }
    } catch(e) { errors++; console.log(`${C.red}  [ERRO]   @${lead.username} — ${e.message}${C.reset}`); }
    await sleep(300);
  }

  // Persistir cache atualizado
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2)); } catch {}

  console.log(`\n${C.magenta}${'='.repeat(52)}${C.reset}`);
  console.log(`${C.bright}  SYNC CONCLUIDO${C.reset}`);
  console.log(`  Criados: ${C.cyan}${created}${C.reset}  Atualizados: ${C.green}${updated}${C.reset}  Pulados: ${skipped}  Erros: ${C.red}${errors}${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(52)}${C.reset}\n`);
}

async function setup() {
  if (!PARENT_ID) {
    console.log(`\n${C.yellow}Para criar o database:${C.reset}`);
    console.log('  1. Abra a pagina do Notion onde quer criar o CRM');
    console.log('  2. Copie o ID da URL (32 chars apos o ultimo /)');
    console.log('  3. Adicione ao .env: NOTION_PARENT_PAGE_ID=<id>');
    console.log('  4. Execute: node 9-notion-sync.js setup');
    console.log(`\n${C.cyan}Ou crie manualmente com as colunas:${C.reset}`);
    Object.keys(DB_SCHEMA).forEach(k => console.log('  - ' + k));
    return;
  }

  console.log(`\n${C.cyan}[NOTION] Criando database...${C.reset}`);
  const res = await notionRequest('POST', '/databases', {
    parent: { type: 'page_id', page_id: PARENT_ID },
    title: [{ type: 'text', text: { content: 'Vendedor AI — CRM' } }],
    properties: DB_SCHEMA
  });

  if (res.status === 200) {
    console.log(`${C.green}[NOTION] Database criado!${C.reset}`);
    console.log(`${C.bright}  Adicione ao .env: NOTION_DATABASE_ID=${res.body.id}${C.reset}`);
    console.log(`  URL: https://www.notion.so/${res.body.id.replace(/-/g, '')}`);
  } else {
    console.error(`${C.red}[NOTION] Erro: ${res.body.message || JSON.stringify(res.body)}${C.reset}`);
    if (res.status === 403) {
      console.log('  -> Na pagina pai: ... -> Connections -> adicionar sua integracao');
    }
  }
}

async function checkStatus() {
  console.log(`\n${C.cyan}[NOTION] Verificando conexao...${C.reset}`);
  const res = await notionRequest('GET', '/users/me', null);
  if (res.status === 200) {
    console.log(`${C.green}[NOTION] Conectado: ${res.body.name || 'OK'}${C.reset}`);
    if (DATABASE_ID) {
      const db = await notionRequest('GET', '/databases/' + DATABASE_ID, null);
      if (db.status === 200) console.log(`${C.green}[NOTION] Database: "${db.body.title?.[0]?.plain_text || 'sem titulo'}"${C.reset}`);
      else console.log(`${C.yellow}[NOTION] Database ID invalido ou sem acesso${C.reset}`);
    } else {
      console.log(`${C.yellow}[NOTION] NOTION_DATABASE_ID nao configurado. Execute: setup${C.reset}`);
    }
  } else {
    console.error(`${C.red}[NOTION] Falha: ${res.body.message || res.status}${C.reset}`);
  }
}

switch(CMD) {
  case 'setup':  setup(); break;
  case 'status': checkStatus(); break;
  case 'sync':   sync(); break;
  default:
    console.log('Uso: node 9-notion-sync.js [setup|sync|status]');
}
