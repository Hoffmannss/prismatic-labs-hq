#!/usr/bin/env node
// =============================================================
// AUTOPILOT DAILY SCHEDULER - PRISMATIC LABS
// Roda 1x por dia automaticamente com delays aumentados
// Objetivo: 10-20 leads novos por dia sem bater rate limit
// =============================================================

require('dotenv').config();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// =========== CONFIGURACOES ===========
const HORARIO_EXECUCAO = process.env.AUTOPILOT_DAILY_HOUR || '09:00'; // HH:MM formato 24h
const META_LEADS_DIA = parseInt(process.env.AUTOPILOT_DAILY_TARGET) || 15; // Meta de leads/dia

const CONFIG_FILE = path.join(__dirname, 'data', 'autopilot-config.json');
const LOG_FILE = path.join(__dirname, 'logs', 'autopilot-daily.log');

// Cria pasta de logs
if (!fs.existsSync(path.dirname(LOG_FILE))) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function log(msg) {
  const timestamp = new Date().toISOString();
  const linha = `[${timestamp}] ${msg}\n`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, linha);
}

function parseHorario(horario) {
  const [hora, minuto] = horario.split(':').map(Number);
  return { hora, minuto };
}

function getProximaExecucao() {
  const agora = new Date();
  const { hora, minuto } = parseHorario(HORARIO_EXECUCAO);
  
  const proxima = new Date();
  proxima.setHours(hora, minuto, 0, 0);
  
  // Se já passou o horário hoje, agenda para amanhã
  if (proxima <= agora) {
    proxima.setDate(proxima.getDate() + 1);
  }
  
  return proxima;
}

function getMsAteProxima() {
  const proxima = getProximaExecucao();
  const agora = new Date();
  return proxima.getTime() - agora.getTime();
}

function formatarTempo(ms) {
  const horas = Math.floor(ms / (1000 * 60 * 60));
  const minutos = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${horas}h${minutos}m`;
}

async function executarAutopilot() {
  log('\n======================================================================');
  log('  AUTOPILOT DAILY - INICIANDO EXECUCAO AGENDADA');
  log('======================================================================');
  
  return new Promise((resolve, reject) => {
    const autopilot = spawn('node', ['agents/10-autopilot.js'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: {
        ...process.env,
        AUTOPILOT_DELAY_MULTIPLIER: '3.0' // 3x mais delay para evitar rate limit
      }
    });
    
    autopilot.on('close', (code) => {
      if (code === 0) {
        log('\u2705 Autopilot concluído com sucesso!');
        resolve();
      } else {
        log(`❌ Autopilot falhou com código ${code}`);
        reject(new Error(`Exit code ${code}`));
      }
    });
    
    autopilot.on('error', (err) => {
      log(`❌ Erro ao executar autopilot: ${err.message}`);
      reject(err);
    });
  });
}

function agendarProxima() {
  const ms = getMsAteProxima();
  const proxima = getProximaExecucao();
  
  log(`\n⏰ Próxima execução agendada para: ${proxima.toLocaleString('pt-BR')}`);
  log(`   (em ${formatarTempo(ms)})`);
  
  setTimeout(async () => {
    try {
      await executarAutopilot();
    } catch (error) {
      log(`❌ Erro na execução: ${error.message}`);
    }
    
    // Agenda próxima execução
    agendarProxima();
  }, ms);
}

// =========== INICIO ===========
log('\n======================================================================');
log('  AUTOPILOT DAILY SCHEDULER - PRISMATIC LABS');
log('======================================================================');
log(`  Horário: ${HORARIO_EXECUCAO}`);
log(`  Meta: ${META_LEADS_DIA} leads/dia`);
log(`  Config: ${CONFIG_FILE}`);
log(`  Log: ${LOG_FILE}`);
log('======================================================================\n');

// Verifica se o arquivo de config existe
if (!fs.existsSync(CONFIG_FILE)) {
  log('❌ Arquivo de configuração não encontrado!');
  log('   Crie data/autopilot-config.json primeiro.');
  process.exit(1);
}

// Atualiza config para a meta diária
const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
config.qtd = META_LEADS_DIA;
config.max_analyze = Math.min(META_LEADS_DIA, 10); // Máximo 10 analisados por vez
fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

log('✅ Configuração atualizada:');
log(`   Nicho: ${config.nicho}`);
log(`   Quantidade: ${config.qtd} leads`);
log(`   Max Analyze: ${config.max_analyze}`);

// Se --now, executa imediatamente
if (process.argv.includes('--now')) {
  log('\n🚀 Executando AGORA (modo manual)...');
  executarAutopilot()
    .then(() => {
      log('\n✅ Execução manual concluída!');
      process.exit(0);
    })
    .catch((err) => {
      log(`\n❌ Execução manual falhou: ${err.message}`);
      process.exit(1);
    });
} else {
  // Agenda primeira execução
  agendarProxima();
  
  log('\n✅ Scheduler ativo! Mantenha este terminal aberto.');
  log('   Pressione Ctrl+C para cancelar.\n');
}

// Graceful shutdown
process.on('SIGINT', () => {
  log('\n🛁 Scheduler encerrado pelo usuário.');
  process.exit(0);
});
