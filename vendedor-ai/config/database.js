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

// =============================================================
// DM QUEUE DATABASE — Fila de envio de DMs
// =============================================================

const DM_QUEUE_FILE = path.join(DATA_DIR, 'dm-queue.json');
const DM_SENDER_CONFIG_FILE = path.join(DATA_DIR, 'sender-config.json');

const DEFAULT_SENDER_CONFIG = {
  enabled: false,
  max_per_day: 15,
  delay_between_min_sec: 180,  // 3 min
  delay_between_max_sec: 480,  // 8 min
  typing_speed_min_ms: 50,
  typing_speed_max_ms: 150,
  pause_on_challenge: true,
  today_count: 0,
  today_date: null,
  last_send_at: null,
  status: 'idle'  // idle | running | paused | error
};

class DmQueueDB {
  constructor() {
    this.ensureFiles();
  }

  ensureFiles() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DM_QUEUE_FILE)) this._saveQueue([]);
    if (!fs.existsSync(DM_SENDER_CONFIG_FILE)) this._saveConfig(DEFAULT_SENDER_CONFIG);
  }

  _loadJSON(f, def) {
    try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : def; }
    catch { return def; }
  }
  _saveJSON(f, data) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(data, null, 2));
  }
  _saveQueue(q) { this._saveJSON(DM_QUEUE_FILE, q); }
  _saveConfig(c) { this._saveJSON(DM_SENDER_CONFIG_FILE, { ...c, updated_at: new Date().toISOString() }); }

  // --- Queue CRUD ---
  loadQueue() { return this._loadJSON(DM_QUEUE_FILE, []); }

  addToQueue(username, message, followup_day = null) {
    const queue = this.loadQueue();
    const id = `dm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const item = {
      id, username: username.replace('@','').toLowerCase(), message,
      followup_day, status: 'pending', retries: 0,
      created_at: new Date().toISOString(), sent_at: null, error: null
    };
    queue.push(item);
    this._saveQueue(queue);
    return item;
  }

  getNextPending() {
    return this.loadQueue().find(i => i.status === 'pending') || null;
  }

  updateItem(id, updates) {
    const queue = this.loadQueue();
    const idx = queue.findIndex(i => i.id === id);
    if (idx === -1) return false;
    queue[idx] = { ...queue[idx], ...updates };
    this._saveQueue(queue);
    return true;
  }

  markSent(id) {
    return this.updateItem(id, { status: 'sent', sent_at: new Date().toISOString() });
  }

  markFailed(id, error) {
    const queue = this.loadQueue();
    const item = queue.find(i => i.id === id);
    if (!item) return false;
    item.retries = (item.retries || 0) + 1;
    item.status = item.retries >= 3 ? 'failed' : 'pending';
    item.error = error;
    this._saveQueue(queue);
    return true;
  }

  removeItem(id) {
    const queue = this.loadQueue().filter(i => i.id !== id);
    this._saveQueue(queue);
    return true;
  }

  getStats() {
    const queue = this.loadQueue();
    return {
      total: queue.length,
      pending: queue.filter(i => i.status === 'pending').length,
      sending: queue.filter(i => i.status === 'sending').length,
      sent: queue.filter(i => i.status === 'sent').length,
      failed: queue.filter(i => i.status === 'failed').length,
    };
  }

  // --- Sender Config ---
  loadSenderConfig() {
    const config = this._loadJSON(DM_SENDER_CONFIG_FILE, DEFAULT_SENDER_CONFIG);
    // Reset daily count if new day
    const today = new Date().toISOString().slice(0, 10);
    if (config.today_date !== today) {
      config.today_count = 0;
      config.today_date = today;
      this._saveConfig(config);
    }
    return config;
  }

  updateSenderConfig(updates) {
    const current = this.loadSenderConfig();
    const updated = { ...current, ...updates };
    this._saveConfig(updated);
    return updated;
  }

  incrementDailyCount() {
    const config = this.loadSenderConfig();
    config.today_count = (config.today_count || 0) + 1;
    config.last_send_at = new Date().toISOString();
    this._saveConfig(config);
    return config;
  }

  canSendMore() {
    const config = this.loadSenderConfig();
    return config.enabled && config.today_count < config.max_per_day;
  }
}

module.exports = { AutopilotDB, DEFAULT_CONFIG, DmQueueDB, DEFAULT_SENDER_CONFIG };
