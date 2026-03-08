// =============================================================
// PM2 ECOSYSTEM - PRISMATIC LABS VENDEDOR AI
// Gerencia todos os processos na VPS
//
// Comandos:
//   pm2 start deploy/ecosystem.config.js    - Iniciar tudo
//   pm2 status                              - Ver status
//   pm2 logs                                - Ver logs
//   pm2 restart all                         - Reiniciar
//   pm2 stop all                            - Parar
// =============================================================

const path = require('path');
const ROOT  = path.join(__dirname, '..');
const AGENTS = path.join(ROOT, 'agents');

module.exports = {
  apps: [
    // ---- DASHBOARD (sempre online) ----
    {
      name: 'vendedor-dashboard',
      script: path.join(AGENTS, '8-dashboard.js'),
      cwd: ROOT,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3131
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.join(ROOT, 'logs', 'dashboard-error.log'),
      out_file:   path.join(ROOT, 'logs', 'dashboard-out.log')
    },

    // ---- AUTOPILOT (roda de manha: 08:00) ----
    // Executa uma vez ao dia automaticamente via cron_restart
    {
      name: 'vendedor-autopilot',
      script: path.join(AGENTS, '10-autopilot.js'),
      cwd: ROOT,
      args: process.env.AUTOPILOT_NICHO || 'api-automacao',
      watch: false,
      autorestart: false,    // Nao reinicia automaticamente
      cron_restart: '0 8 * * *',  // Todo dia as 08:00
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.join(ROOT, 'logs', 'autopilot-error.log'),
      out_file:   path.join(ROOT, 'logs', 'autopilot-out.log')
    },

    // ---- NOTION SYNC (a cada 2h) ----
    {
      name: 'vendedor-notion-sync',
      script: path.join(AGENTS, '9-notion-sync.js'),
      cwd: ROOT,
      args: 'sync',
      watch: false,
      autorestart: false,
      cron_restart: '0 */2 * * *',  // A cada 2 horas
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: path.join(ROOT, 'logs', 'notion-sync-error.log'),
      out_file:   path.join(ROOT, 'logs', 'notion-sync-out.log')
    }
  ]
};
