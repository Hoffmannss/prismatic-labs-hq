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
const { spawnSync } = require('child_process');

const PORT          = parseInt(process.argv[2]) || 3131;
const DATA_DIR      = path.join(__dirname, '..', 'data');
const DB_FILE       = path.join(DATA_DIR, 'crm', 'leads-database.json');
const HTML_FILE     = path.join(__dirname, '..', 'public', 'dashboard.html');
const SETTINGS_FILE = path.join(__dirname, '..', 'config', 'dashboard-settings.json');
const THEMES_FILE   = path.join(__dirname, '..', 'config', 'dashboard-themes.json');
const TRACKER_DIR   = path.join(DATA_DIR, 'tracker');
const LEARNING_FILE = path.join(DATA_DIR, 'learning', 'style-memory.json');

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
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
    const byOutcome  = { enviada: 0, respondeu: 0, ignorou: 0, negociando: 0, converteu: 0 };
    let totalValue = 0;
    leads.forEach(l => {
      if (l.prioridade in byPriority) byPriority[l.prioridade]++;
      const trk = getTracker(l.username);
      if (trk?.outcome && trk.outcome in byOutcome) byOutcome[trk.outcome]++;
      if (trk?.outcome === 'converteu' && trk?.valor) totalValue += Number(trk.valor) || 0;
    });
    const learning = loadJSON(LEARNING_FILE, null);
    return json(res, {
      total: leads.length,
      byPriority,
      byOutcome,
      totalValue,
      learning: learning
        ? { versao: learning.versao, score_medio: learning.score_medio, total_amostras: learning.total_amostras }
        : null
    });
  }

  json(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  const C = { r: '\x1b[0m', b: '\x1b[1m', m: '\x1b[35m', c: '\x1b[36m' };
  console.log(`\n${C.m}${'='.repeat(52)}${C.r}`);
  console.log(`${C.b}  DASHBOARD COCKPIT - Prismatic Labs${C.r}`);
  console.log(`${C.m}${'='.repeat(52)}${C.r}`);
  console.log(`  URL     : ${C.c}http://localhost:${PORT}${C.r}`);
  console.log(`  APIs    : /api/leads /api/settings /api/themes`);
  console.log(`            /api/tracker /api/autopilot /api/stats`);
  console.log(`${C.m}${'='.repeat(52)}${C.r}\n`);
});
