// =============================================================
// MODULO 4: FOLLOW-UP AI - PRISMATIC LABS VENDEDOR AUTOMATICO
// Verifica diariamente quem precisa de followup e gera a mensagem
// =============================================================

require('dotenv').config();
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'crm', 'leads-database.json');
const REPORT_DIR = path.join(DATA_DIR, 'relatorios');

function ensureDirs() {
  [DB_FILE, REPORT_DIR].forEach(p => {
    const dir = fs.statSync ? path.dirname(p) : p;
    if (!fs.existsSync(path.dirname(p))) fs.mkdirSync(path.dirname(p), { recursive: true });
  });
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { leads: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(db) {
  db.updated_at = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getLeadsForFollowup(db) {
  const today = new Date();
  return db.leads.filter(lead => {
    if (['fechado', 'perdido'].includes(lead.status)) return false;
    if (!lead.primeira_mensagem_enviada) return false;
    if (!lead.proximo_followup) return false;
    return new Date(lead.proximo_followup) <= today;
  });
}

function getFollowupType(lead) {
  const n = lead.followups_enviados || 0;
  if (n === 0) return 'dia3';
  if (n === 1) return 'dia7';
  if (n === 2) return 'dia14';
  return 'encerrar';
}

async function generateFollowup(lead) {
  const followupType = getFollowupType(lead);

  if (followupType === 'encerrar') return { tipo: 'encerrar', mensagem: null };

  // Tentar usar followup pre-gerado pelo Copywriter
  const mensagensFile = path.join(DATA_DIR, 'mensagens', `${lead.username}_mensagens.json`);
  if (fs.existsSync(mensagensFile)) {
    const md = JSON.parse(fs.readFileSync(mensagensFile, 'utf8'));
    const key = `followup_${followupType}`;
    if (md.mensagens?.[key]) {
      return { tipo: followupType, mensagem: md.mensagens[key], fonte: 'pre_gerado' };
    }
  }

  // Gerar com IA se nao tem pre-gerado
  const a = lead.analise || {};
  const isAPI = lead.servico_ideal === 'lead_normalizer_api';
  const dayMap = { dia3: 3, dia7: 7, dia14: 14 };
  const dias = dayMap[followupType];

  const produtoCtx = isAPI
    ? 'Lead Normalizer API ($29/mes, free plan sem cartao, normaliza telefone BR + dedupe hash)'
    : 'Landing Page Premium Dark Mode (R$1.497-R$5.997, conversao 15-25%)';

  const prompt = `Followup DIA ${dias} para lead que nao respondeu DM no Instagram.

Produto: ${produtoCtx}
Lead: nicho ${a.nicho || 'tech'}, problema: ${a.problema_principal || 'desconhecido'}, prioridade: ${lead.prioridade}
Followup numero ${(lead.followups_enviados || 0) + 1} de 3.

Regras:
- Maximo 3 linhas
- NAO comece com o nome ou @handle da pessoa
- NAO diga "nao sei se viu" ou "so passando por aqui" - e batido
- Dia 3: leve, reforcar o beneficio, nova pergunta
- Dia 7: mostrar resultado concreto, urgencia sutil
- Dia 14: ultima tentativa, oferta especifica com prazo curto
- Tom: colega util, nao vendedor desesperado

Retorne APENAS o texto da mensagem.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      max_tokens: 200,
    });
    return { tipo: followupType, mensagem: completion.choices[0].message.content.trim(), fonte: 'gerado_agora' };
  } catch (e) {
    console.error(`[FOLLOWUP] Erro ao gerar para @${lead.username}:`, e.message);
    return null;
  }
}

function calcNextFollowup(followupsEnviados) {
  const daysMap = [7, 7, null];
  const days = daysMap[followupsEnviados] || null;
  if (!days) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function processLeadFollowup(lead) {
  console.log(`\n[FOLLOWUP] @${lead.username} (followup #${(lead.followups_enviados || 0) + 1} | ${lead.prioridade?.toUpperCase()})`);

  const result = await generateFollowup(lead);
  if (!result) return null;

  if (result.tipo === 'encerrar') {
    lead.status = 'perdido';
    lead.proximo_followup = null;
    lead.historico = lead.historico || [];
    lead.historico.push({ evento: 'sequencia_encerrada', timestamp: new Date().toISOString() });
    console.log(`[FOLLOWUP] @${lead.username} -> PERDIDO (sem resposta em 3 tentativas)`);
    return { username: lead.username, acao: 'encerrado' };
  }

  lead.followups_enviados = (lead.followups_enviados || 0) + 1;
  lead.proximo_followup = calcNextFollowup(lead.followups_enviados);
  lead.data_ultima_interacao = new Date().toISOString();
  lead.historico = lead.historico || [];
  lead.historico.push({ evento: 'followup_gerado', timestamp: new Date().toISOString(), dados: result.tipo });

  const label = result.tipo.toUpperCase();
  console.log(`\n  ========== COPIE E COLE (${label}) ==========`);
  console.log(`  ${result.mensagem}`);
  console.log(`  ================================================\n`);

  return { username: lead.username, prioridade: lead.prioridade, tipo: result.tipo, mensagem: result.mensagem };
}

async function run() {
  ensureDirs();
  console.log('\n[FOLLOWUP] Verificando followups do dia...');

  const db = loadDB();
  const pendentes = getLeadsForFollowup(db);

  console.log(`[FOLLOWUP] ${pendentes.length} lead(s) precisam de followup hoje.`);

  if (pendentes.length === 0) {
    console.log('[FOLLOWUP] Nenhum followup pendente. Ate amanha! ok');
    return;
  }

  const sorted = pendentes.sort((a, b) => {
    const order = { hot: 0, warm: 1, cold: 2 };
    return (order[a.prioridade] || 2) - (order[b.prioridade] || 2);
  });

  const results = [];
  for (const lead of sorted) {
    const r = await processLeadFollowup(lead);
    if (r) results.push(r);
    await new Promise(res => setTimeout(res, 800));
  }

  saveDB(db);

  const hoje = new Date().toISOString().split('T')[0];
  const reportFile = path.join(REPORT_DIR, `followup-${hoje}.json`);
  fs.writeFileSync(reportFile, JSON.stringify({ data: new Date().toISOString(), total: results.length, followups: results }, null, 2));

  console.log(`\n[FOLLOWUP] ${results.filter(r => r.acao !== 'encerrado').length} mensagens geradas.`);
  console.log(`[FOLLOWUP] Relatorio: ${reportFile}`);
}

run().catch(e => { console.error('[FOLLOWUP] Erro fatal:', e.message); process.exit(1); });
