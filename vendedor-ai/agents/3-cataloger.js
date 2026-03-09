// =============================================================
// MODULO 3: CATALOGER - PRISMATIC LABS VENDEDOR AUTOMATICO
// Gerencia o banco de dados de leads (CRM simples em JSON)
// Rastreia status, followups e pipeline de vendas
// =============================================================

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'crm', 'leads-database.json');
const PIPELINE_FILE = path.join(__dirname, '..', 'data', 'crm', 'pipeline.json');

// Garantir que diretorios existem
function ensureDirs() {
  const dirs = [
    path.join(__dirname, '..', 'data', 'crm'),
    path.join(__dirname, '..', 'data', 'leads'),
    path.join(__dirname, '..', 'data', 'mensagens'),
    path.join(__dirname, '..', 'data', 'relatorios')
  ];
  dirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}

// Carregar banco de dados
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { leads: [], updated_at: null };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// Salvar banco de dados
function saveDB(db) {
  db.updated_at = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Adicionar ou atualizar lead
function upsertLead(username, analysisData, messagesData) {
  ensureDirs();
  const db = loadDB();
  
  const existingIndex = db.leads.findIndex(l => l.username === username);
  
  const a = analysisData?.analise || {};
  
  const leadRecord = {
    username: username,
    status: 'novo',         // novo / contatado / respondeu / em_negociacao / fechado / perdido
    prioridade: a.prioridade || 'cold',
    score: a.score_potencial || 0,
    nicho: a.nicho || '',
    tipo_negocio: a.tipo_negocio || '',
    problema_principal: a.problema_principal || '',
    servico_ideal: a.servico_ideal || '',
    primeira_mensagem_enviada: false,
    data_primeiro_contato: null,
    data_ultima_interacao: null,
    followups_enviados: 0,
    proximo_followup: null,
    notas: [],
    historico: [],
    analise: a,
    mensagens_geradas: messagesData?.mensagens || null,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    // Manter historico e status existente
    const existing = db.leads[existingIndex];
    leadRecord.status = existing.status;
    leadRecord.primeira_mensagem_enviada = existing.primeira_mensagem_enviada;
    leadRecord.data_primeiro_contato = existing.data_primeiro_contato;
    leadRecord.followups_enviados = existing.followups_enviados;
    leadRecord.notas = existing.notas;
    leadRecord.historico = existing.historico;
    leadRecord.criado_em = existing.criado_em;
    leadRecord.historico.push({
      evento: 'atualizado',
      timestamp: new Date().toISOString(),
      dados: 'Re-analise executada'
    });
    db.leads[existingIndex] = leadRecord;
    console.log(`[CATALOGER] Lead @${username} ATUALIZADO no CRM`);
  } else {
    leadRecord.historico.push({
      evento: 'criado',
      timestamp: new Date().toISOString(),
      dados: 'Lead adicionado ao CRM'
    });
    db.leads.push(leadRecord);
    console.log(`[CATALOGER] Lead @${username} ADICIONADO ao CRM`);
  }

  saveDB(db);
  updatePipeline(db);
  return leadRecord;
}

// Marcar primeira mensagem como enviada
function markMessageSent(username) {
  const db = loadDB();
  const lead = db.leads.find(l => l.username === username);
  if (!lead) { console.error(`[CATALOGER] Lead @${username} nao encontrado`); return; }
  
  lead.status = 'contatado';
  lead.primeira_mensagem_enviada = true;
  lead.data_primeiro_contato = new Date().toISOString();
  lead.data_ultima_interacao = new Date().toISOString();
  
  // Agendar followups
  const now = new Date();
  lead.proximo_followup = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(); // +3 dias
  
  lead.historico.push({
    evento: 'mensagem_enviada',
    timestamp: new Date().toISOString(),
    dados: 'Primeira mensagem enviada pelo usuario'
  });
  
  saveDB(db);
  updatePipeline(db);
  console.log(`[CATALOGER] @${username} marcado como CONTATADO. Proximo followup em 3 dias.`);
}

// Atualizar status do lead
function updateStatus(username, newStatus, nota) {
  const db = loadDB();
  const lead = db.leads.find(l => l.username === username);
  if (!lead) { console.error(`[CATALOGER] Lead @${username} nao encontrado`); return; }
  
  const oldStatus = lead.status;
  lead.status = newStatus;
  lead.data_ultima_interacao = new Date().toISOString();
  lead.atualizado_em = new Date().toISOString();
  
  if (nota) lead.notas.push({ timestamp: new Date().toISOString(), texto: nota });
  
  lead.historico.push({
    evento: 'status_alterado',
    timestamp: new Date().toISOString(),
    dados: `${oldStatus} -> ${newStatus}${nota ? ': ' + nota : ''}`
  });
  
  saveDB(db);
  updatePipeline(db);
  console.log(`[CATALOGER] @${username}: ${oldStatus} -> ${newStatus}`);
}

// Gerar relatorio do pipeline
function updatePipeline(db) {
  const pipeline = {
    total_leads: db.leads.length,
    atualizado_em: new Date().toISOString(),
    por_status: {},
    por_prioridade: { hot: 0, warm: 0, cold: 0 },
    por_nicho: {},
    taxa_contato: 0,
    leads_para_followup_hoje: [],
    hot_leads: []
  };

  const statusCounts = {};
  let contatados = 0;

  db.leads.forEach(lead => {
    // Por status
    statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
    
    // Por prioridade
    if (lead.prioridade in pipeline.por_prioridade) pipeline.por_prioridade[lead.prioridade]++;
    
    // Por nicho
    if (lead.nicho) pipeline.por_nicho[lead.nicho] = (pipeline.por_nicho[lead.nicho] || 0) + 1;
    
    // Contatos feitos
    if (lead.primeira_mensagem_enviada) contatados++;
    
    // Followups para hoje
    if (lead.proximo_followup) {
      const followupDate = new Date(lead.proximo_followup);
      const today = new Date();
      if (followupDate <= today && lead.status !== 'fechado' && lead.status !== 'perdido') {
        pipeline.leads_para_followup_hoje.push({
          username: lead.username,
          status: lead.status,
          followups_ja_enviados: lead.followups_enviados,
          prioridade: lead.prioridade
        });
      }
    }
    
    // Hot leads
    if (lead.prioridade === 'hot' && lead.status !== 'fechado') {
      pipeline.hot_leads.push({ username: lead.username, status: lead.status, score: lead.score });
    }
  });

  pipeline.por_status = statusCounts;
  pipeline.taxa_contato = db.leads.length > 0 ? Math.round((contatados / db.leads.length) * 100) : 0;

  fs.writeFileSync(PIPELINE_FILE, JSON.stringify(pipeline, null, 2));
}

// Listar todos os leads
function listLeads(filter) {
  const db = loadDB();
  let leads = db.leads;
  if (filter) leads = leads.filter(l => l.status === filter || l.prioridade === filter);
  return leads;
}

// Gerar relatorio diario
function dailyReport() {
  ensureDirs();
  const db = loadDB();
  const pipeline = fs.existsSync(PIPELINE_FILE) ? JSON.parse(fs.readFileSync(PIPELINE_FILE, 'utf8')) : {};
  
  console.log('\n========================================');
  console.log('   RELATORIO DIARIO - PRISMATIC LABS CRM');
  console.log('========================================');
  console.log(`Total de Leads: ${db.leads.length}`);
  console.log(`Hot Leads: ${pipeline.por_prioridade?.hot || 0}`);
  console.log(`Warm Leads: ${pipeline.por_prioridade?.warm || 0}`);
  console.log(`Ja Contatados: ${db.leads.filter(l => l.primeira_mensagem_enviada).length}`);
  console.log(`Em Negociacao: ${db.leads.filter(l => l.status === 'em_negociacao').length}`);
  console.log(`Fechados (Clientes): ${db.leads.filter(l => l.status === 'fechado').length}`);
  console.log(`Taxa de Contato: ${pipeline.taxa_contato || 0}%`);
  console.log('\nFOLLOWUPS PARA HOJE:');
  if (pipeline.leads_para_followup_hoje?.length > 0) {
    pipeline.leads_para_followup_hoje.forEach(l => {
      console.log(`  @${l.username} [${l.prioridade.toUpperCase()}] - ${l.followups_ja_enviados} followups ja enviados`);
    });
  } else {
    console.log('  Nenhum followup pendente hoje.');
  }
  console.log('========================================\n');
  
  return { db, pipeline };
}

// ---- EXECUCAO PRINCIPAL ----
const action = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

ensureDirs();

switch(action) {
  case 'add': {
    const analysisFile = path.join(__dirname, '..', 'data', 'leads', `${arg1}_analysis.json`);
    const messagesFile = path.join(__dirname, '..', 'data', 'mensagens', `${arg1}_mensagens.json`);
    const analysis = fs.existsSync(analysisFile) ? JSON.parse(fs.readFileSync(analysisFile, 'utf8')) : null;
    const messages = fs.existsSync(messagesFile) ? JSON.parse(fs.readFileSync(messagesFile, 'utf8')) : null;
    upsertLead(arg1, analysis, messages);
    break;
  }
  case 'sent': markMessageSent(arg1); break;
  case 'status': updateStatus(arg1, arg2, process.argv[5]); break;
  case 'list': {
    const leads = listLeads(arg1);
    console.log(JSON.stringify(leads, null, 2));
    break;
  }
  case 'report': dailyReport(); break;
  default: dailyReport();
}
