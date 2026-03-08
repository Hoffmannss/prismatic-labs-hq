// =============================================================
// MODULO 14: SCHEDULER - Agendamento automático do Autopilot
// Uso: node 14-scheduler.js
// =============================================================

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const { AutopilotDB } = require('../config/database');

const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m'
};

const db = new AutopilotDB();
let cronJob = null;
let isRunning = false;

// Parsear expressão cron para intervalo em ms (simplificado)
function parseCronToMs(cronExpr) {
  // Formato: minuto hora dia mes dia-semana
  // Exemplo: "0 9 * * *" = todo dia às 9h
  // Simplificado: apenas suporta execução diária no formato "0 H * * *"
  const parts = cronExpr.split(' ');
  if (parts.length !== 5) return null;
  
  const hour = parseInt(parts[1]);
  if (isNaN(hour) || hour < 0 || hour > 23) return null;
  
  // Retorna a hora alvo
  return hour;
}

function getNextRunTime(targetHour) {
  const now = new Date();
  const next = new Date();
  next.setHours(targetHour, 0, 0, 0);
  
  // Se já passou a hora de hoje, agenda para amanhã
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

function calculateDelayMs(targetHour) {
  const next = getNextRunTime(targetHour);
  return next.getTime() - Date.now();
}

async function runAutopilot() {
  if (isRunning) {
    console.log(`${C.yellow}[SCHEDULER] Autopilot já está rodando, pulando...${C.reset}`);
    return;
  }

  const config = db.loadConfig();
  
  if (!config.active) {
    console.log(`${C.yellow}[SCHEDULER] Autopilot está desativado no dashboard${C.reset}`);
    return;
  }

  if (!config.nicho) {
    console.log(`${C.red}[SCHEDULER] Nenhum nicho configurado!${C.reset}`);
    return;
  }

  isRunning = true;
  console.log(`\n${C.cyan}[SCHEDULER] Iniciando Autopilot...${C.reset}`);
  console.log(`  Nicho: ${config.nicho}`);
  console.log(`  Qtd: ${config.quantidade_leads}`);
  console.log(`  Max Analyze: ${config.max_analyze}\n`);

  const autopilotPath = path.join(__dirname, '10-autopilot.js');
  const args = [
    autopilotPath,
    config.nicho,
    String(config.quantidade_leads),
    String(config.max_analyze)
  ];

  const child = spawn('node', args, {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  });

  child.on('close', (code) => {
    isRunning = false;
    db.updateLastRun();
    
    if (code === 0) {
      console.log(`${C.green}[SCHEDULER] Autopilot concluído com sucesso!${C.reset}`);
    } else {
      console.log(`${C.red}[SCHEDULER] Autopilot terminou com erro (code: ${code})${C.reset}`);
    }
  });

  child.on('error', (err) => {
    isRunning = false;
    console.error(`${C.red}[SCHEDULER] Erro ao executar autopilot: ${err.message}${C.reset}`);
  });
}

function scheduleNext() {
  const schedConfig = db.getScheduleConfig();
  
  if (!schedConfig.enabled) {
    console.log(`${C.yellow}[SCHEDULER] Agendamento desabilitado${C.reset}`);
    return;
  }

  const targetHour = parseCronToMs(schedConfig.cron);
  if (targetHour === null) {
    console.log(`${C.red}[SCHEDULER] Expressão cron inválida: ${schedConfig.cron}${C.reset}`);
    return;
  }

  const delayMs = calculateDelayMs(targetHour);
  const nextRun = new Date(Date.now() + delayMs);

  console.log(`${C.cyan}[SCHEDULER] Próxima execução agendada para: ${nextRun.toLocaleString('pt-BR', { timeZone: schedConfig.timezone })}${C.reset}`);

  if (cronJob) {
    clearTimeout(cronJob);
  }

  cronJob = setTimeout(async () => {
    await runAutopilot();
    scheduleNext(); // Reagenda para o próximo dia
  }, delayMs);
}

function startScheduler() {
  console.log(`\n${C.magenta}${'='.repeat(60)}${C.reset}`);
  console.log(`${C.bright}  SCHEDULER - Autopilot Automático${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(60)}${C.reset}\n`);

  const config = db.loadConfig();
  const schedConfig = db.getScheduleConfig();

  console.log(`  Status: ${config.active ? C.green + 'ATIVO' : C.red + 'INATIVO'}${C.reset}`);
  console.log(`  Nicho: ${config.nicho || '(não configurado)'}`);
  console.log(`  Agendamento: ${schedConfig.enabled ? C.green + 'HABILITADO' : C.yellow + 'DESABILITADO'}${C.reset}`);
  console.log(`  Cron: ${schedConfig.cron}`);
  console.log(`  Timezone: ${schedConfig.timezone}`);
  
  if (config.last_run) {
    console.log(`  Última execução: ${new Date(config.last_run).toLocaleString('pt-BR')}`);
  }

  console.log(`\n${C.magenta}${'='.repeat(60)}${C.reset}\n`);

  scheduleNext();

  // Verifica mudanças de config a cada 1 minuto
  setInterval(() => {
    const newConfig = db.getScheduleConfig();
    if (newConfig.enabled !== schedConfig.enabled || newConfig.cron !== schedConfig.cron) {
      console.log(`${C.yellow}[SCHEDULER] Configuração alterada, reagendando...${C.reset}`);
      scheduleNext();
    }
  }, 60000);
}

// Tratamento de sinais para shutdown gracioso
process.on('SIGINT', () => {
  console.log(`\n${C.yellow}[SCHEDULER] Recebido SIGINT, encerrando...${C.reset}`);
  if (cronJob) clearTimeout(cronJob);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n${C.yellow}[SCHEDULER] Recebido SIGTERM, encerrando...${C.reset}`);
  if (cronJob) clearTimeout(cronJob);
  process.exit(0);
});

// Iniciar scheduler
if (require.main === module) {
  startScheduler();
}

module.exports = { runAutopilot, scheduleNext, startScheduler };
