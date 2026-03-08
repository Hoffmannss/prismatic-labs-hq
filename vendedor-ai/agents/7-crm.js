// =============================================================
// MODULO 7: CRM - PRISMATIC LABS VENDEDOR AI
// Gerencia database local de leads (JSON)
//
// Comandos:
//   node 7-crm.js add <username>      -> Adiciona lead ao CRM
//   node 7-crm.js update <username>   -> Atualiza lead existente
//   node 7-crm.js list                -> Lista todos os leads
//   node 7-crm.js stats               -> Estatisticas do CRM
// =============================================================

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const DB_DIR  = path.join(__dirname, '..', 'data', 'crm');
const DB_FILE = path.join(DB_DIR, 'leads-database.json');
const CMD     = process.argv[2];
const ARG     = process.argv[3];

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m'
};

// ---- INIT DATABASE ----
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ versao: '1.0', leads: [] }, null, 2));
}

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function addLead(username) {
  const analysisFile = path.join(__dirname, '..', 'data', 'leads', `${username}_analysis.json`);
  const messagesFile = path.join(__dirname, '..', 'data', 'mensagens', `${username}_mensagens.json`);

  if (!fs.existsSync(analysisFile)) {
    console.error(`${C.red}[CRM] Analise nao encontrada: ${username}_analysis.json${C.reset}`);
    console.log('Execute primeiro: node 1-analyzer.js ' + username);
    process.exit(1);
  }

  const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
  const a = analysis.analise;
  const ap = a.analise_posts || {};

  let mensagens = null;
  if (fs.existsSync(messagesFile)) {
    mensagens = JSON.parse(fs.readFileSync(messagesFile, 'utf8'));
  }

  const db = loadDB();
  const existing = db.leads.findIndex(l => l.username === username);

  const lead = {
    username,
    data_adicao: new Date().toISOString(),
    status: 'novo',
    prioridade: a.prioridade || 'cold',
    score: a.score_potencial || 0,
    nicho: a.nicho,
    analise: a,
    mensagem_gerada: !!mensagens,
    followups_enviados: 0,
    proximo_followup: null,
    data_ultima_interacao: null,
    notas: []
  };

  if (existing >= 0) {
    db.leads[existing] = { ...db.leads[existing], ...lead, data_atualizacao: new Date().toISOString() };
    console.log(`${C.yellow}[CRM] Lead atualizado: @${username}${C.reset}`);
  } else {
    db.leads.push(lead);
    console.log(`${C.green}[CRM] Lead adicionado: @${username}${C.reset}`);
  }

  saveDB(db);

  console.log(`${C.cyan}[CRM] Score: ${lead.score} | Prioridade: ${lead.prioridade.toUpperCase()}${C.reset}`);
  console.log(`${C.cyan}[CRM] Produto: ${a.servico_ideal === 'lead_normalizer_api' ? 'Lead Normalizer API' : 'Landing Page'}${C.reset}`);
  if (ap.gancho_ideal) {
    console.log(`${C.cyan}[CRM] Gancho: ${ap.gancho_ideal.slice(0, 80)}...${C.reset}`);
  }
}

function updateLead(username) {
  const db = loadDB();
  const lead = db.leads.find(l => l.username === username);

  if (!lead) {
    console.error(`${C.red}[CRM] Lead nao encontrado: ${username}${C.reset}`);
    process.exit(1);
  }

  // Recarregar analise
  const analysisFile = path.join(__dirname, '..', 'data', 'leads', `${username}_analysis.json`);
  if (fs.existsSync(analysisFile)) {
    const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf8'));
    lead.analise = analysis.analise;
    lead.score = analysis.analise.score_potencial || lead.score;
    lead.prioridade = analysis.analise.prioridade || lead.prioridade;
  }

  // Verificar mensagens
  const messagesFile = path.join(__dirname, '..', 'data', 'mensagens', `${username}_mensagens.json`);
  if (fs.existsSync(messagesFile)) {
    lead.mensagem_gerada = true;
  }

  lead.data_atualizacao = new Date().toISOString();
  saveDB(db);

  console.log(`${C.green}[CRM] Lead atualizado: @${username}${C.reset}`);
}

function listLeads() {
  const db = loadDB();
  const leads = db.leads || [];

  if (leads.length === 0) {
    console.log(`${C.yellow}[CRM] Nenhum lead no database${C.reset}`);
    return;
  }

  console.log(`\n${C.magenta}${'='.repeat(60)}${C.reset}`);
  console.log(`${C.bright}  CRM - ${leads.length} leads${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(60)}${C.reset}\n`);

  leads.sort((a, b) => b.score - a.score).forEach(lead => {
    const prioColor = lead.prioridade === 'hot' ? C.red : lead.prioridade === 'warm' ? C.yellow : C.cyan;
    const statusEmoji = {
      novo: '🆕',
      contatado: '✉️',
      respondeu: '💬',
      em_negociacao: '🤝',
      fechado: '✅',
      perdido: '❌'
    }[lead.status] || '❓';

    console.log(`${statusEmoji} ${C.bright}@${lead.username}${C.reset} - Score: ${C.cyan}${lead.score}${C.reset} - ${prioColor}${lead.prioridade.toUpperCase()}${C.reset}`);
    console.log(`   Nicho: ${lead.nicho || 'N/A'} | Status: ${lead.status}`);
    if (lead.analise?.problema_principal) {
      console.log(`   Problema: ${lead.analise.problema_principal.slice(0, 60)}...`);
    }
    console.log('');
  });
}

function showStats() {
  const db = loadDB();
  const leads = db.leads || [];

  const stats = {
    total: leads.length,
    hot: leads.filter(l => l.prioridade === 'hot').length,
    warm: leads.filter(l => l.prioridade === 'warm').length,
    cold: leads.filter(l => l.prioridade === 'cold').length,
    novo: leads.filter(l => l.status === 'novo').length,
    contatado: leads.filter(l => l.status === 'contatado').length,
    respondeu: leads.filter(l => l.status === 'respondeu').length,
    fechado: leads.filter(l => l.status === 'fechado').length,
    score_medio: leads.length > 0 ? (leads.reduce((sum, l) => sum + (l.score || 0), 0) / leads.length).toFixed(1) : 0
  };

  console.log(`\n${C.magenta}${'='.repeat(60)}${C.reset}`);
  console.log(`${C.bright}  CRM ESTATISTICAS${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(60)}${C.reset}\n`);

  console.log(`${C.cyan}Total de leads:${C.reset} ${stats.total}`);
  console.log(`${C.cyan}Score medio:${C.reset} ${stats.score_medio}\n`);

  console.log(`${C.bright}Por Prioridade:${C.reset}`);
  console.log(`  ${C.red}HOT:${C.reset}  ${stats.hot}`);
  console.log(`  ${C.yellow}WARM:${C.reset} ${stats.warm}`);
  console.log(`  ${C.cyan}COLD:${C.reset} ${stats.cold}\n`);

  console.log(`${C.bright}Por Status:${C.reset}`);
  console.log(`  Novo:         ${stats.novo}`);
  console.log(`  Contatado:    ${stats.contatado}`);
  console.log(`  Respondeu:    ${stats.respondeu}`);
  console.log(`  Fechado:      ${stats.fechado}`);
  console.log(`\n${C.magenta}${'='.repeat(60)}${C.reset}\n`);
}

switch(CMD) {
  case 'add':
    if (!ARG) { console.log('Uso: node 7-crm.js add <username>'); process.exit(1); }
    addLead(ARG);
    break;
  case 'update':
    if (!ARG) { console.log('Uso: node 7-crm.js update <username>'); process.exit(1); }
    updateLead(ARG);
    break;
  case 'list':
    listLeads();
    break;
  case 'stats':
    showStats();
    break;
  default:
    console.log(`\n${C.cyan}CRM - Gerenciador de Leads${C.reset}\n`);
    console.log('Comandos:');
    console.log('  node 7-crm.js add <username>    - Adiciona lead ao CRM');
    console.log('  node 7-crm.js update <username> - Atualiza lead existente');
    console.log('  node 7-crm.js list              - Lista todos os leads');
    console.log('  node 7-crm.js stats             - Estatisticas do CRM\n');
}
