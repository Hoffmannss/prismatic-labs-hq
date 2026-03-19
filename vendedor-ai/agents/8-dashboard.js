// =============================================================
// MODULO 8: DASHBOARD COCKPIT - PRISMATIC LABS VENDEDOR AI
// Uso: node 8-dashboard.js [porta]
// Acesso: http://localhost:3131
// =============================================================

require('dotenv').config();
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const url    = require('url');
const { spawnSync, spawn } = require('child_process');
const { AutopilotDB, DmQueueDB } = require('../config/database');
const SessionSecurity = require('../config/session-security');

const PORT          = parseInt(process.argv[2]) || 3131;
const DATA_DIR      = path.join(__dirname, '..', 'data');
const DB_FILE       = path.join(DATA_DIR, 'crm', 'leads-database.json');
const HTML_FILE     = path.join(__dirname, '..', 'public', 'dashboard.html');
const SETTINGS_FILE   = path.join(__dirname, '..', 'config', 'dashboard-settings.json');
const THEMES_FILE     = path.join(__dirname, '..', 'config', 'dashboard-themes.json');
const BP_FILE         = path.join(__dirname, '..', 'config', 'business-profile.json');
const SCHEDULE_FILE   = path.join(__dirname, '..', 'config', 'schedule-config.json');
const USERS_FILE      = path.join(__dirname, '..', 'config', 'users.json');
const crypto          = require('crypto');
const TRACKER_DIR   = path.join(DATA_DIR, 'tracker');
const LEARNING_FILE = path.join(DATA_DIR, 'learning', 'style-memory.json');
const LOGS_DIR      = path.join(__dirname, '..', 'logs');
const PIPELINE_LOGS = [
  { file: path.join(LOGS_DIR, 'autopilot-out.log'),     label: 'autopilot'   },
  { file: path.join(LOGS_DIR, 'notion-sync-out.log'),   label: 'notion-sync' },
  { file: path.join(LOGS_DIR, 'dashboard-out.log'),     label: 'dashboard'   },
  { file: path.join(LOGS_DIR, 'sender.log'),            label: 'sender'      },
];

const autopilotDB = new AutopilotDB();
const dmQueueDB = new DmQueueDB();

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function loadJSON(f, def) {
  try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : def; }
  catch { return def; }
}

function saveJSON(f, data) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
}

function getLeadMessages(username) {
  const f = path.join(DATA_DIR, 'mensagens', `${username}_mensagens.json`);
  return loadJSON(f, null);
}

// Arquiva página de lead no Notion (soft-delete)
async function archiveNotionPage(username) {
  const NOTION_TOKEN = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN;
  const NOTION_DB    = process.env.NOTION_DATABASE_ID;
  if (!NOTION_TOKEN || !NOTION_DB) return;
  const https = require('https');
  // 1) Buscar página pelo username
  const queryBody = JSON.stringify({
    filter: { property: 'Nome', title: { equals: '@' + username } }
  });
  const searchRes = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.notion.com', path: `/v1/databases/${NOTION_DB}/query`,
      method: 'POST', headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(queryBody)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', reject);
    req.write(queryBody); req.end();
  });
  if (!searchRes?.results?.length) return;
  // 2) Arquivar a página
  const pageId = searchRes.results[0].id;
  const archiveBody = JSON.stringify({ archived: true });
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.notion.com', path: `/v1/pages/${pageId}`,
      method: 'PATCH', headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(archiveBody)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(archiveBody); req.end();
  });
  console.log(`[NOTION] Página de @${username} arquivada`);
}

function getTracker(username) {
  const f = path.join(TRACKER_DIR, `${username}_tracker.json`);
  return loadJSON(f, null);
}

function enrichLeads(leads) {
  return leads.map(l => {
    const msg = getLeadMessages(l.username);
    const trk = getTracker(l.username);
    return {
      ...l,
      mensagem_final:    msg?.revisao?.mensagem_final || msg?.mensagens?.mensagem1?.texto || null,
      mensagem_original: msg?.revisao?.mensagem_original || null,
      score_reviewer:    msg?.revisao?.score || null,
      followups: msg ? [
        msg.followup_dia3  ? { dia: 3,  texto: msg.followup_dia3  } : null,
        msg.followup_dia7  ? { dia: 7,  texto: msg.followup_dia7  } : null,
        msg.followup_dia14 ? { dia: 14, texto: msg.followup_dia14 } : null,
      ].filter(Boolean) : [],
      tracker:    trk || null,
      outcome:    trk?.outcome || null,
      dm_enviada: trk?.dm_enviada || false,
    };
  });
}

function bodyJSON(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ── Instagram connection status: flag in-memory + persiste em disco ──
const IG_STATUS_FILE  = path.join(__dirname, '..', 'data', 'session', 'connection-status.json');
let   igConnectedFlag = false;
(function loadIgStatus() {
  try {
    if (fs.existsSync(IG_STATUS_FILE)) {
      const s = JSON.parse(fs.readFileSync(IG_STATUS_FILE, 'utf8'));
      igConnectedFlag = s.connected === true;
      if (igConnectedFlag) console.log('[SESSION] ✅ Flag de sessão carregada do disco');
    }
  } catch {}
})();

function setIgConnected(val) {
  igConnectedFlag = val;
  try {
    fs.mkdirSync(path.dirname(IG_STATUS_FILE), { recursive: true });
    fs.writeFileSync(IG_STATUS_FILE, JSON.stringify({ connected: val, updatedAt: new Date().toISOString() }));
  } catch {}
}

// ── Auth sessions: persiste em disco para sobreviver reinicializações do PM2 ──
const SESSIONS_FILE = path.join(__dirname, '..', 'config', 'auth-sessions.json');
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias

let activeSessions = {};
(function loadPersistedSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      const now = Date.now();
      for (const [tok, sess] of Object.entries(raw)) {
        if (sess && sess.createdAt && (now - sess.createdAt) < SESSION_TTL_MS) {
          activeSessions[tok] = sess;
        }
      }
    }
  } catch {}
})();

function saveActiveSessions() {
  try {
    const dir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(activeSessions));
  } catch {}
}

function verifyToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  return activeSessions[token] || null;
}

function ensureUsersFile() {
  if (!fs.existsSync(USERS_FILE)) {
    const defaultAdmin = {
      email: 'admin@prismatic.com',
      password: hashPassword('admin123'),
      is_admin: true,
      company_name: 'Prismatic Labs',
      created_at: new Date().toISOString()
    };
    saveJSON(USERS_FILE, { users: [defaultAdmin] });
  }
}

function runTracker(args) {
  const r = spawnSync('node', [path.join(__dirname, '12-tracker.js'), ...args],
    { stdio: 'pipe', cwd: __dirname, env: process.env });
  return { ok: r.status === 0, out: (r.stdout || '').toString() };
}

const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') { json(res, {}); return; }

  if (req.method === 'GET' && pathname === '/') {
    const html = fs.existsSync(HTML_FILE)
      ? fs.readFileSync(HTML_FILE, 'utf8')
      : '<h1>dashboard.html nao encontrado em public/dashboard.html</h1>';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // ── AUTH GUARD: protege todas as rotas /api/ exceto auth ─────────────
  const isPublicRoute = pathname === '/api/auth/login' || pathname === '/api/auth/verify';
  if (pathname.startsWith('/api/') && !isPublicRoute) {
    const session = verifyToken(req);
    if (!session) {
      return json(res, { ok: false, error: 'Autenticação necessária' }, 401);
    }
    req.userSession = session;
  }

  if (req.method === 'GET' && pathname === '/api/leads') {
    const db    = loadJSON(DB_FILE, { leads: [] });
    const leads = enrichLeads(db.leads || []);
    return json(res, { leads, total: leads.length, updated_at: db.updated_at });
  }

  if (req.method === 'GET' && pathname === '/api/settings') {
    return json(res, loadJSON(SETTINGS_FILE, {}));
  }

  if (req.method === 'POST' && pathname === '/api/settings') {
    const body    = await bodyJSON(req);
    const current = loadJSON(SETTINGS_FILE, {});
    const updated = { ...current, ...body };
    saveJSON(SETTINGS_FILE, updated);
    return json(res, { ok: true, settings: updated });
  }

  if (req.method === 'GET' && pathname === '/api/themes') {
    return json(res, loadJSON(THEMES_FILE, { themes: [] }));
  }

  if (req.method === 'GET' && pathname === '/api/learning') {
    return json(res, loadJSON(LEARNING_FILE, null));
  }

  // ====== NOVAS ROTAS PARA AUTOPILOT ======

  if (req.method === 'GET' && pathname === '/api/autopilot/config') {
    const config = autopilotDB.loadConfig();
    return json(res, config);
  }

  if (req.method === 'POST' && pathname === '/api/autopilot/config') {
    const body = await bodyJSON(req);
    const success = autopilotDB.updateConfig(body);
    if (success) {
      return json(res, { ok: true, config: autopilotDB.loadConfig() });
    } else {
      return json(res, { ok: false, error: 'Falha ao salvar configuração' }, 500);
    }
  }

  if (req.method === 'POST' && pathname === '/api/autopilot/start') {
    const config = autopilotDB.loadConfig();
    
    if (!config.active) {
      return json(res, { ok: false, error: 'Autopilot está desativado' }, 400);
    }

    if (!config.nicho) {
      return json(res, { ok: false, error: 'Nenhum nicho configurado' }, 400);
    }

    // Limpa status anterior e inicia autopilot em processo separado
    try {
      const apStatusFile = path.join(DATA_DIR, 'autopilot-status.json');
      fs.writeFileSync(apStatusFile, JSON.stringify({ status: 'running', startedAt: new Date().toISOString() }));
    } catch {}
    setTimeout(() => {
      const child = spawn('node', [path.join(__dirname, '10-autopilot.js')], {
        detached: true,
        stdio: 'ignore',
        cwd: __dirname,
        env: process.env
      });
      child.unref();
    }, 100);

    return json(res, { 
      ok: true, 
      message: `Autopilot iniciado para nicho: ${config.nicho}`,
      config: {
        nicho: config.nicho,
        quantidade_leads: config.quantidade_leads,
        max_analyze: config.max_analyze
      }
    });
  }

  if (req.method === 'POST' && pathname === '/api/autopilot/toggle') {
    const { active } = await bodyJSON(req);
    autopilotDB.updateConfig({ active: active === true });
    return json(res, { ok: true, active: autopilotDB.loadConfig().active });
  }

  if (req.method === 'GET' && pathname === '/api/autopilot/status') {
    const apStatusFile = path.join(DATA_DIR, 'autopilot-status.json');
    if (!fs.existsSync(apStatusFile)) return json(res, { status: 'idle' });
    try {
      const s = JSON.parse(fs.readFileSync(apStatusFile, 'utf8'));
      return json(res, s);
    } catch {
      return json(res, { status: 'idle' });
    }
  }

  // ====== DM QUEUE API ======

  if (req.method === 'GET' && pathname === '/api/dm-queue') {
    const queue = dmQueueDB.loadQueue();
    const stats = dmQueueDB.getStats();
    const config = dmQueueDB.loadSenderConfig();
    return json(res, { queue, stats, sender: config });
  }

  if (req.method === 'POST' && pathname === '/api/dm-queue') {
    const { username, message, followup_day } = await bodyJSON(req);
    if (!username || !message) return json(res, { ok: false, error: 'username e message obrigatórios' }, 400);
    const item = dmQueueDB.addToQueue(username, message, followup_day || null);
    return json(res, { ok: true, item });
  }

  if (req.method === 'POST' && pathname === '/api/dm-queue/enqueue-lead') {
    // Enqueue a lead's best message directly from CRM
    const { username } = await bodyJSON(req);
    if (!username) return json(res, { ok: false, error: 'username obrigatório' }, 400);
    const msg = getLeadMessages(username);
    const text = msg?.revisao?.mensagem_final || msg?.mensagens?.mensagem1?.texto;
    if (!text) return json(res, { ok: false, error: 'Nenhuma mensagem encontrada para este lead' }, 404);
    const item = dmQueueDB.addToQueue(username, text);
    return json(res, { ok: true, item });
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/dm-queue/')) {
    const id = pathname.split('/').pop();
    const updates = await bodyJSON(req);
    const ok = dmQueueDB.updateItem(id, updates);
    return json(res, { ok });
  }

  // Clear entire DM queue
  if (req.method === 'DELETE' && pathname === '/api/dm-queue') {
    dmQueueDB.clearQueue();
    return json(res, { ok: true, message: 'Fila limpa' });
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/dm-queue/')) {
    const id = pathname.split('/').pop();
    dmQueueDB.removeItem(id);
    return json(res, { ok: true });
  }

  // Sender config
  if (req.method === 'GET' && pathname === '/api/sender/config') {
    return json(res, dmQueueDB.loadSenderConfig());
  }

  if (req.method === 'POST' && pathname === '/api/sender/config') {
    const body = await bodyJSON(req);
    const config = dmQueueDB.updateSenderConfig(body);
    return json(res, { ok: true, config });
  }

  if (req.method === 'POST' && pathname === '/api/sender/start') {
    const config = dmQueueDB.loadSenderConfig();
    if (!config.enabled) return json(res, { ok: false, error: 'Sender está desabilitado' }, 400);
    setTimeout(() => {
      const child = spawn('node', [path.join(__dirname, '0-sender.js'), '--once'], {
        detached: true, stdio: 'ignore', cwd: __dirname, env: process.env
      });
      child.unref();
    }, 100);
    dmQueueDB.updateSenderConfig({ status: 'running' });
    return json(res, { ok: true, message: 'Sender iniciado (modo single batch)' });
  }

  // ====== FIM DM QUEUE API ======

  if (req.method === 'POST' && pathname === '/api/tracker') {
    const { username, action, extra } = await bodyJSON(req);
    if (!username || !action)
      return json(res, { ok: false, error: 'username e action obrigatorios' }, 400);
    const args = [action, username];
    if (extra) args.push(String(extra));
    const result = runTracker(args);
    return json(res, { ok: result.ok, out: result.out });
  }

  if (req.method === 'POST' && pathname === '/api/autopilot') {
    // DEPRECATED: mantido para backward compatibility
    const body     = await bodyJSON(req);
    const settings = loadJSON(SETTINGS_FILE, {});
    const n  = body.nicho      || settings.autopilotDefaults?.nicho      || 'api-automacao';
    const q  = body.qtd        || settings.autopilotDefaults?.qtd        || 20;
    const ma = body.maxAnalyze || settings.autopilotDefaults?.maxAnalyze || 8;
    setTimeout(() => {
      spawnSync('node', [path.join(__dirname, '10-autopilot.js'), n, String(q), String(ma)],
        { stdio: 'inherit', cwd: __dirname, env: process.env });
    }, 100);
    return json(res, { ok: true, message: `Autopilot iniciado: ${n} | qtd:${q} | max:${ma}` });
  }

  // Analisar perfil específico pelo pipeline completo (5-orchestrator.js)
  if (req.method === 'POST' && pathname === '/api/lead/run') {
    const { username } = await bodyJSON(req);
    if (!username) return json(res, { ok: false, error: 'username obrigatorio' }, 400);
    const clean = username.replace(/^@/, '').trim().toLowerCase();
    if (!clean) return json(res, { ok: false, error: 'username invalido' }, 400);
    setTimeout(() => {
      // 5-orchestrator.js requer: analyze @username bio followers posts
      // Bio/followers/posts opcionais — o pipeline roda com dados mínimos
      spawnSync('node', [path.join(__dirname, '5-orchestrator.js'), 'analyze', clean, '', '0', '0'],
        { stdio: 'inherit', cwd: __dirname, env: process.env });
    }, 100);
    return json(res, { ok: true, message: `Pipeline iniciado para @${clean}` });
  }

  if (req.method === 'POST' && pathname === '/api/lead/status') {
    const { username, status, nota } = await bodyJSON(req);
    if (!username || !status)
      return json(res, { ok: false, error: 'username e status obrigatorios' }, 400);
    const db   = loadJSON(DB_FILE, { leads: [] });
    const lead = (db.leads || []).find(l => l.username === username);
    if (!lead) return json(res, { ok: false, error: 'Lead nao encontrado' }, 404);
    lead.status        = status;
    lead.atualizado_em = new Date().toISOString();
    if (nota) {
      lead.notas = lead.notas || [];
      lead.notas.push({ timestamp: new Date().toISOString(), texto: nota });
    }
    saveJSON(DB_FILE, db);
    return json(res, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/stats') {
    const db    = loadJSON(DB_FILE, { leads: [] });
    const leads = db.leads || [];
    const byPriority = { hot: 0, warm: 0, cold: 0 };
    const byOutcome  = { sent: 0, respondeu: 0, ignorou: 0, negociando: 0, converteu: 0, recusou: 0 };
    let totalValue = 0;
    leads.forEach(l => {
      if (l.prioridade in byPriority) byPriority[l.prioridade]++;
      const trk = getTracker(l.username);
      if (trk?.outcome && trk.outcome in byOutcome) byOutcome[trk.outcome]++;
      if (trk?.outcome === 'converteu' && trk?.valor) totalValue += Number(trk.valor) || 0;
    });
    const learning = loadJSON(LEARNING_FILE, null);
    const autopilotConfig = autopilotDB.loadConfig();
    return json(res, {
      total: leads.length,
      byPriority,
      byOutcome,
      totalValue,
      learning: learning
        ? { versao: learning.versao, score_medio: learning.score_medio, total_amostras: learning.total_amostras }
        : null,
      autopilot: {
        active: autopilotConfig.active,
        nicho: autopilotConfig.nicho,
        last_run: autopilotConfig.last_run
      }
    });
  }

  // ── LOGS: últimas N linhas de todos os arquivos de log ──────────────────
  if (req.method === 'GET' && pathname === '/api/logs') {
    const lines = parseInt(new URLSearchParams(req.url.split('?')[1] || '').get('lines') || '120');
    const result = [];
    for (const { file, label } of PIPELINE_LOGS) {
      if (!fs.existsSync(file)) continue;
      try {
        const content = fs.readFileSync(file, 'utf8');
        const all = content.split('\n').filter(Boolean);
        all.slice(-lines).forEach(text => result.push({ label, text }));
      } catch {}
    }
    result.sort((a, b) => 0); // mantém ordem cronológica por arquivo
    return json(res, { ok: true, lines: result });
  }

  // ── LOGS: SSE stream — envia novas linhas em tempo real ─────────────────
  if (req.method === 'GET' && pathname === '/api/logs/stream') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    const send = (label, text) => {
      res.write(`data: ${JSON.stringify({ label, text })}\n\n`);
    };
    // Envia histórico inicial (últimas 80 linhas)
    const sizes = {};
    for (const { file, label } of PIPELINE_LOGS) {
      try {
        if (fs.existsSync(file)) {
          const st = fs.statSync(file);
          sizes[file] = st.size;
          const content = fs.readFileSync(file, 'utf8');
          const last = content.split('\n').filter(Boolean).slice(-80);
          last.forEach(text => send(label, text));
        } else { sizes[file] = 0; }
      } catch { sizes[file] = 0; }
    }
    send('system', '── histórico carregado — aguardando novos logs ──');
    // Poll a cada 1.5s para novas linhas
    const iv = setInterval(() => {
      for (const { file, label } of PIPELINE_LOGS) {
        try {
          if (!fs.existsSync(file)) continue;
          const st = fs.statSync(file);
          const prev = sizes[file] || 0;
          if (st.size > prev) {
            const fd = fs.openSync(file, 'r');
            const buf = Buffer.alloc(st.size - prev);
            fs.readSync(fd, buf, 0, buf.length, prev);
            fs.closeSync(fd);
            sizes[file] = st.size;
            buf.toString('utf8').split('\n').filter(Boolean).forEach(text => send(label, text));
          }
        } catch {}
      }
    }, 1500);
    req.on('close', () => clearInterval(iv));
    return;
  }

  // ── NOTION: forçar sync manual ───────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/notion/sync') {
    setTimeout(() => {
      spawnSync('node', [path.join(__dirname, '9-notion-sync.js'), 'sync'],
        { stdio: 'inherit', cwd: __dirname, env: process.env });
    }, 100);
    return json(res, { ok: true, message: 'Notion sync iniciado' });
  }

  // ── NOTION: verificar status da integração ───────────────────────────────
  if (req.method === 'GET' && pathname === '/api/notion/status') {
    const r = spawnSync('node', [path.join(__dirname, '9-notion-sync.js'), 'status'],
      { stdio: 'pipe', cwd: __dirname, env: process.env });
    const out = (r.stdout?.toString() || '') + (r.stderr?.toString() || '');
    const ok  = r.status === 0;
    return json(res, { ok, output: out.trim() });
  }

  // ── STATUS DAS APIs ──────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/status') {
    const sessionPath = process.env.INSTAGRAM_SESSION_FILE
      ? path.join(__dirname, '..', process.env.INSTAGRAM_SESSION_FILE)
      : path.join(DATA_DIR, 'session', 'instagram-session.json');
    const fileExists = fs.existsSync(sessionPath);
    // Flag in-memory OU arquivo em disco — qualquer um válido indica sessão ativa
    const igOk = igConnectedFlag || fileExists;
    // Sincroniza a flag se o arquivo existe mas a flag estava apagada (ex: restart)
    if (fileExists && !igConnectedFlag) setIgConnected(true);
    return json(res, {
      groq:      !!process.env.GROQ_API_KEY,
      gemini:    !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY),
      notion:    !!process.env.NOTION_API_KEY,
      instagram: igOk,
      instagram_username: process.env.INSTAGRAM_USERNAME || null,
    });
  }

  // ── RUN AGENT ────────────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname.startsWith('/api/run/')) {
    const agentKey = pathname.split('/').pop();
    const agentMap = {
      scraper:    ['0-scraper.js'],
      analyzer:   ['1-analyzer.js'],
      copywriter: ['2-copywriter.js'],
      notion:     ['9-notion-sync.js', 'sync'],
      autopilot:  ['10-autopilot.js'],
      scheduler:  ['14-scheduler.js'],
    };
    const args = agentMap[agentKey];
    if (!args) return json(res, { ok: false, error: `Agente '${agentKey}' não encontrado` }, 404);
    // Se for autopilot, escreve status 'running' antes de spawnar
    if (agentKey === 'autopilot') {
      try {
        fs.writeFileSync(path.join(DATA_DIR, 'autopilot-status.json'),
          JSON.stringify({ status: 'running', startedAt: new Date().toISOString() }));
      } catch {}
    }
    setTimeout(() => {
      const child = spawn('node', [path.join(__dirname, ...args)], {
        detached: true, stdio: 'ignore', cwd: __dirname, env: process.env
      });
      child.unref();
    }, 100);
    return json(res, { ok: true, message: `Agente ${agentKey} iniciado` });
  }

  // ── AUTHENTICATION ──────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    ensureUsersFile();
    const { email, password } = await bodyJSON(req);
    if (!email || !password) return json(res, { ok: false, error: 'E-mail e senha obrigatórios' }, 400);
    const usersData = loadJSON(USERS_FILE, { users: [] });
    const user = usersData.users.find(u => u.email === email && u.password === hashPassword(password));
    if (!user) return json(res, { ok: false, error: 'E-mail ou senha incorretos' }, 401);
    const token = generateToken();
    activeSessions[token] = { email: user.email, is_admin: user.is_admin, company_name: user.company_name, createdAt: Date.now() };
    saveActiveSessions();
    return json(res, { ok: true, token, user: { email: user.email, is_admin: user.is_admin, company_name: user.company_name } });
  }

  if (req.method === 'GET' && pathname === '/api/auth/verify') {
    const session = verifyToken(req);
    if (session) return json(res, { ok: true, user: session });
    return json(res, { ok: false, error: 'Token inválido' }, 401);
  }

  if (req.method === 'POST' && pathname === '/api/auth/create-user') {
    const session = verifyToken(req);
    if (!session || !session.is_admin) return json(res, { ok: false, error: 'Acesso negado' }, 403);
    const { email, password, company_name } = await bodyJSON(req);
    if (!email || !password) return json(res, { ok: false, error: 'E-mail e senha obrigatórios' }, 400);
    const usersData = loadJSON(USERS_FILE, { users: [] });
    if (usersData.users.find(u => u.email === email)) return json(res, { ok: false, error: 'E-mail já cadastrado' }, 409);
    usersData.users.push({ email, password: hashPassword(password), is_admin: false, company_name: company_name || '', created_at: new Date().toISOString() });
    saveJSON(USERS_FILE, usersData);
    return json(res, { ok: true, message: 'Usuário criado com sucesso' });
  }

  // ── BUSINESS PROFILE ────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/business-profile') {
    return json(res, loadJSON(BP_FILE, {}));
  }

  if (req.method === 'POST' && pathname === '/api/business-profile') {
    const body = await bodyJSON(req);
    saveJSON(BP_FILE, body);
    return json(res, { ok: true, profile: body });
  }

  // ── SCHEDULE ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/schedule') {
    return json(res, loadJSON(SCHEDULE_FILE, { active: false, time: '08:00', frequency: 'daily', days: [0,1,2,3,4,5,6] }));
  }

  if (req.method === 'POST' && pathname === '/api/schedule') {
    const body = await bodyJSON(req);
    const current = loadJSON(SCHEDULE_FILE, {});
    const updated = { ...current, ...body };
    // Calculate next run
    if (updated.active && updated.time) {
      const now = new Date();
      const [h, m] = updated.time.split(':').map(Number);
      const next = new Date(now);
      next.setHours(h, m, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      // Find next valid day
      const days = updated.days || [0,1,2,3,4,5,6];
      for (let i = 0; i < 7; i++) {
        if (days.includes(next.getDay())) break;
        next.setDate(next.getDate() + 1);
      }
      updated.next_run = next.toISOString();
    } else {
      updated.next_run = null;
    }
    saveJSON(SCHEDULE_FILE, updated);
    return json(res, { ok: true, schedule: updated });
  }

  // ── INSTAGRAM SESSION MANAGEMENT ───────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/instagram/request-renewal') {
    const renewalLog = path.join(DATA_DIR, 'instagram-renewal-requests.json');
    const requests = loadJSON(renewalLog, { requests: [] });
    requests.requests.push({ timestamp: new Date().toISOString(), status: 'pending' });
    saveJSON(renewalLog, requests);
    return json(res, { ok: true, message: 'Solicitação registrada' });
  }

  // ── INSTAGRAM AUTO-RENEW (roda 0-scraper.js login) ────────────────────
  // Aceita credenciais no body OU usa as do .env (fallback)
  // As credenciais do body NÃO são armazenadas — usadas apenas para o spawn
  if (req.method === 'POST' && pathname === '/api/instagram/auto-renew') {
    const body = await bodyJSON(req);
    const igUser = (body.username || '').trim() || process.env.INSTAGRAM_USERNAME;
    const igPass = (body.password || '').trim() || process.env.INSTAGRAM_PASSWORD;
    if (!igUser || !igPass) {
      return json(res, {
        ok: false,
        need_credentials: true,
        error: 'Credenciais do Instagram não fornecidas'
      }, 400);
    }
    // Arquivo de log do processo de renovação (substituído a cada tentativa)
    const renewalLogFile = path.join(DATA_DIR, 'instagram-renewal-log.txt');
    try {
      fs.writeFileSync(renewalLogFile, `[${new Date().toISOString()}] INICIANDO login para @${igUser}...\n`);
    } catch {}
    // Spawna 0-scraper login com as credenciais (nunca armazena no arquivo)
    const spawnEnv = { ...process.env, INSTAGRAM_USERNAME: igUser, INSTAGRAM_PASSWORD: igPass };
    const child = spawn('node', [path.join(__dirname, '0-scraper.js'), 'login', '--auto'], {
      stdio: ['ignore', 'pipe', 'pipe'], cwd: __dirname, env: spawnEnv
    });
    // Redireciona stdout e stderr para o arquivo de log — dá visibilidade total ao processo
    const logStream = fs.createWriteStream(renewalLogFile, { flags: 'a' });
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);
    child.on('exit', (code) => {
      try {
        fs.appendFileSync(renewalLogFile, `\n[EXIT] code=${code} ts=${new Date().toISOString()}\n`);
        logStream.end();
      } catch {}
    });
    child.on('error', (err) => {
      try {
        fs.appendFileSync(renewalLogFile, `\n[ERROR] ${err.message}\n`);
        logStream.end();
      } catch {}
    });
    return json(res, { ok: true, message: 'Login iniciado' });
  }

  // ── INSTAGRAM RENEWAL STATUS (lê log do processo de login) ────────────
  if (req.method === 'GET' && pathname === '/api/instagram/renewal-status') {
    const renewalLogFile = path.join(DATA_DIR, 'instagram-renewal-log.txt');
    if (!fs.existsSync(renewalLogFile)) {
      return json(res, { status: 'idle', message: 'Nenhum processo de login iniciado' });
    }
    let log = '';
    try { log = fs.readFileSync(renewalLogFile, 'utf8'); } catch {}
    const logLower = log.toLowerCase();
    let status = 'running';
    let message = 'Login em andamento…';
    if (log.includes('[EXIT] code=0')) {
      status = 'success';
      message = 'Sessão renovada com sucesso!';
    } else if (/\[EXIT\] code=[^0\n]/.test(log)) {
      if (logLower.includes('challenge') || logLower.includes('checkpoint') || logLower.includes('verification') || logLower.includes('suspicious')) {
        status = 'challenge';
        message = 'Instagram pediu verificação de segurança — tente login manual pelo app.';
      } else if (logLower.includes('incorrect password') || logLower.includes('wrong password') || logLower.includes('senha') || logLower.includes('invalid')) {
        status = 'error';
        message = 'Usuário ou senha incorretos.';
      } else {
        status = 'error';
        message = 'Login falhou. Verifique logs para detalhes.';
      }
    }
    // Detecta sucesso via linha de log (antes do EXIT)
    if (status === 'running' && (logLower.includes('sessão salva') || logLower.includes('session saved') || logLower.includes('login successful') || logLower.includes('logged in'))) {
      status = 'success';
      message = 'Sessão renovada com sucesso!';
    }
    return json(res, { status, message, tail: log.slice(-600) });
  }

  // ── INSTAGRAM IMPORT SESSION (cola sessionid do browser) ──────────────
  if (req.method === 'POST' && pathname === '/api/instagram/import-session') {
    const body = await bodyJSON(req);
    const sessionid = (body.sessionid || '').trim();
    if (!sessionid || sessionid.length < 10) {
      return json(res, { ok: false, error: 'sessionid inválido ou muito curto' }, 400);
    }
    try {
      const sessionSec = new SessionSecurity();
      const SESSION_DIR = path.join(DATA_DIR, 'session');
      const SESSION_FILE = path.join(SESSION_DIR, 'instagram-session.json');
      if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
      // Monta objeto de cookie mínimo válido para o Playwright
      const expires = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 dias
      const cookies = [
        { name: 'sessionid', value: sessionid, domain: '.instagram.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax', expires },
        { name: 'ds_user_id', value: body.ds_user_id || '', domain: '.instagram.com', path: '/', httpOnly: true, secure: true, sameSite: 'Lax', expires },
      ].filter(c => c.value); // remove cookies sem valor
      sessionSec.saveEncrypted(SESSION_FILE, cookies);
      setIgConnected(true);
      console.log(`[SESSION] ✅ Sessão importada via sessionid (${sessionid.slice(0,8)}...) → ${SESSION_FILE}`);
      console.log(`[SESSION] 📁 Arquivo existe: ${fs.existsSync(SESSION_FILE)}`);
      return json(res, { ok: true, message: 'Sessão importada com sucesso! O sistema já pode usar sua conta do Instagram.' });
    } catch (e) {
      return json(res, { ok: false, error: `Erro ao salvar sessão: ${e.message}` });
    }
  }

  // ── REGENERATE DM (re-analyzes profile, then regenerates message with old as context) ──
  if (req.method === 'POST' && pathname === '/api/regenerate-dm') {
    const { username } = await bodyJSON(req);
    if (!username) return json(res, { ok: false, error: 'username obrigatório' }, 400);
    const clean = username.replace(/^@/, '').trim().toLowerCase();

    // Lê mensagem anterior para passar como contexto de melhoria
    let previousMessage = null;
    try {
      const oldFile = path.join(DATA_DIR, 'mensagens', `${clean}_mensagens.json`);
      if (fs.existsSync(oldFile)) {
        const old = loadJSON(oldFile, null);
        if (old) {
          const recKey = `mensagem_${old.mensagens?.mensagem_recomendada || '1'}`;
          previousMessage = old.revisao?.mensagem_final
            || old.mensagens?.[recKey]?.texto
            || old.mensagens?.mensagem_1?.texto
            || null;
        }
      }
    } catch {}

    // Passo 1: re-analisa o perfil (1-analyzer.js) para ter análise fresca
    try {
      console.log(`[REGEN-DM] ▶ Analisando @${clean}...`);
      const analyzeResult = spawnSync('node', [path.join(__dirname, '1-analyzer.js'), clean], {
        stdio: 'pipe', cwd: __dirname, env: process.env, timeout: 120000
      });
      if (analyzeResult.status !== 0) {
        const errOut = (analyzeResult.stderr || analyzeResult.stdout || '').toString().slice(0, 400);
        return json(res, { ok: false, error: `Análise falhou: ${errOut || 'erro desconhecido. Verifique GROQ_API_KEY'}` });
      }
    } catch (e) {
      return json(res, { ok: false, error: `Timeout na análise (>120s): ${e.message}` });
    }

    // Passo 2: gera nova mensagem (2-copywriter.js) passando a mensagem anterior como contexto
    const copyEnv = { ...process.env };
    if (previousMessage) copyEnv.PREVIOUS_MESSAGE = previousMessage;
    try {
      console.log(`[REGEN-DM] ▶ Gerando mensagem para @${clean}...`);
      const copyResult = spawnSync('node', [path.join(__dirname, '2-copywriter.js'), clean], {
        stdio: 'pipe', cwd: __dirname, env: copyEnv, timeout: 60000
      });
      if (copyResult.status === 0) {
        // Lê arquivo gerado diretamente (mensagem_1 key, não mensagem1)
        const raw = loadJSON(path.join(DATA_DIR, 'mensagens', `${clean}_mensagens.json`), null);
        if (raw) {
          const recKey = `mensagem_${raw.mensagens?.mensagem_recomendada || '1'}`;
          const newText = raw.revisao?.mensagem_final
            || raw.mensagens?.[recKey]?.texto
            || raw.mensagens?.mensagem_1?.texto;
          if (newText) return json(res, { ok: true, new_message: newText, username: clean });
        }
        return json(res, { ok: false, error: 'Mensagem gerada mas não encontrada no arquivo' });
      } else {
        const errOut = (copyResult.stderr || copyResult.stdout || '').toString().slice(0, 300);
        return json(res, { ok: false, error: `Copywriter falhou: ${errOut || 'erro desconhecido'}` });
      }
    } catch (e) {
      return json(res, { ok: false, error: `Timeout no copywriter: ${e.message}` });
    }
  }

  // ── DELETE LEAD (individual) ────────────────────────────────────────────
  if (req.method === 'DELETE' && pathname.startsWith('/api/lead/') && !pathname.includes('/bulk')) {
    const username = decodeURIComponent(pathname.slice('/api/lead/'.length)).replace(/^@/, '').trim().toLowerCase();
    if (!username) return json(res, { ok: false, error: 'username obrigatório' }, 400);
    const db = loadJSON(DB_FILE, { leads: [] });
    const idx = db.leads.findIndex(l => l.username === username);
    if (idx === -1) return json(res, { ok: false, error: `Lead @${username} não encontrado` }, 404);
    db.leads.splice(idx, 1);
    saveJSON(DB_FILE, db);
    // Limpar cache Notion + arquivar página no Notion
    try {
      const cacheFile = path.join(DATA_DIR, 'crm', 'notion-sync-cache.json');
      if (fs.existsSync(cacheFile)) {
        const cache = loadJSON(cacheFile, {});
        delete cache[username];
        saveJSON(cacheFile, cache);
      }
    } catch {}
    // Arquivar no Notion (async, não bloqueia resposta)
    archiveNotionPage(username).catch(() => {});
    return json(res, { ok: true, message: `@${username} removido do CRM` });
  }

  // ── DELETE LEADS (bulk) ───────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/leads/bulk-delete') {
    const body = await bodyJSON(req);
    const usernames = (body.usernames || []).map(u => u.replace(/^@/, '').trim().toLowerCase()).filter(Boolean);
    if (!usernames.length) return json(res, { ok: false, error: 'Nenhum username fornecido' }, 400);
    const db = loadJSON(DB_FILE, { leads: [] });
    let removed = 0;
    for (const uname of usernames) {
      const idx = db.leads.findIndex(l => l.username === uname);
      if (idx !== -1) { db.leads.splice(idx, 1); removed++; }
    }
    saveJSON(DB_FILE, db);
    // Limpar cache Notion
    try {
      const cacheFile = path.join(DATA_DIR, 'crm', 'notion-sync-cache.json');
      if (fs.existsSync(cacheFile)) {
        const cache = loadJSON(cacheFile, {});
        for (const uname of usernames) delete cache[uname];
        saveJSON(cacheFile, cache);
      }
    } catch {}
    // Arquivar no Notion (async)
    for (const uname of usernames) archiveNotionPage(uname).catch(() => {});
    return json(res, { ok: true, removed, message: `${removed} lead(s) removido(s) do CRM` });
  }

  // ── SEND DM (bridge → DmQueueDB + sender) ───────────────────────────────
  if (req.method === 'POST' && pathname === '/api/send-dm') {
    const body = await bodyJSON(req);
    const { username, mensagem_final, dm_message, message } = body;
    if (!username) return json(res, { ok: false, error: 'username obrigatório' }, 400);
    const text = mensagem_final || dm_message || message;
    if (!text) return json(res, { ok: false, error: 'mensagem não encontrada' }, 400);
    const item = dmQueueDB.addToQueue(username, text);
    const senderConfig = dmQueueDB.loadSenderConfig();
    if (senderConfig.enabled) {
      setTimeout(() => {
        const child = spawn('node', [path.join(__dirname, '0-sender.js'), '--once'], {
          detached: true, stdio: 'ignore', cwd: __dirname, env: process.env
        });
        child.unref();
      }, 200);
    }
    return json(res, { ok: true, item, message: `DM para @${username} adicionada à fila` });
  }

  json(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  const C = { r: '\x1b[0m', b: '\x1b[1m', m: '\x1b[35m', c: '\x1b[36m' };
  console.log(`\n${C.m}${'='.repeat(52)}${C.r}`);
  console.log(`${C.b}  DASHBOARD COCKPIT - Prismatic Labs${C.r}`);
  console.log(`${C.m}${'='.repeat(52)}${C.r}`);
  console.log(`  URL     : ${C.c}http://localhost:${PORT}${C.r}`);
  console.log(`  APIs    : /api/leads /api/settings /api/stats /api/status`);
  console.log(`  Profile : /api/business-profile /api/schedule`);
  console.log(`  Auth    : /api/auth/login | /verify | /create-user`);
  console.log(`  Autopilot: /api/autopilot/config | /start | /toggle`);
  console.log(`  Pipeline : /api/lead/run | /api/run/:agent | /api/send-dm`);
  console.log(`  Extra   : /api/regenerate-dm /api/instagram/request-renewal`);
  console.log(`${C.m}${'='.repeat(52)}${C.r}\n`);
});
