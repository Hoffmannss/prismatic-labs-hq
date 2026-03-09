// =============================================================
// DATABASE - Gerenciamento de configurações do Autopilot
// Schema simples em JSON (pode migrar para SQLite depois)
// =============================================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'autopilot-config.json');

// Schema padrão
const DEFAULT_CONFIG = {
  version: '1.0.0',
  active: false,
  nicho: '',
  quantidade_leads: 20,
  max_analyze: 10,
  schedule: {
    enabled: false,
    cron: '0 9 * * *', // Todos os dias às 9h
    timezone: 'America/Sao_Paulo'
  },
  sync_notion: true,
  last_run: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

class AutopilotDB {
  constructor() {
    this.ensureDataDir();
    this.ensureConfigFile();
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  ensureConfigFile() {
    if (!fs.existsSync(CONFIG_FILE)) {
      this.saveConfig(DEFAULT_CONFIG);
    }
  }

  loadConfig() {
    try {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[DB] Erro ao ler config:', error.message);
      return DEFAULT_CONFIG;
    }
  }

  saveConfig(config) {
    try {
      config.updated_at = new Date().toISOString();
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('[DB] Erro ao salvar config:', error.message);
      return false;
    }
  }

  updateConfig(updates) {
    const current = this.loadConfig();
    const updated = { ...current, ...updates };
    return this.saveConfig(updated);
  }

  getScheduleConfig() {
    const config = this.loadConfig();
    return {
      enabled: config.schedule?.enabled || false,
      cron: config.schedule?.cron || '0 9 * * *',
      timezone: config.schedule?.timezone || 'America/Sao_Paulo'
    };
  }

  updateLastRun() {
    return this.updateConfig({ last_run: new Date().toISOString() });
  }

  isActive() {
    const config = this.loadConfig();
    return config.active === true;
  }

  getAutopilotParams() {
    const config = this.loadConfig();
    return {
      nicho: config.nicho || 'api-automacao',
      quantidade_leads: config.quantidade_leads || 20,
      max_analyze: config.max_analyze || 10,
      sync_notion: config.sync_notion !== false
    };
  }
}

module.exports = { AutopilotDB, DEFAULT_CONFIG };
