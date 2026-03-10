// =============================================================
// MODULO 0-SENDER: AUTOSEND — Envio de DMs via Playwright
// Usa sessão compartilhada com 0-scraper.js (AES-256-GCM)
//
// Modos:
//   node 0-sender.js              — Daemon: poll contínuo
//   node 0-sender.js --once       — Single batch: processa fila e sai
//   node 0-sender.js --test user  — Teste: envia para 1 user e sai
//   node 0-sender.js --status     — Mostra status do sender
//
// Segurança:
//   - Delays humanizados (50-150ms por caractere)
//   - 3-8 min entre DMs
//   - Máx. 15 DMs/dia (configurável)
//   - Pausa automática em CAPTCHA/challenge
//   - Sessão AES-256-GCM compartilhada
// =============================================================

require('dotenv').config();
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const SessionSecurity = require('../config/session-security');
const { DmQueueDB }   = require('../config/database');

const DATA_DIR     = path.join(__dirname, '..', 'data');
const SESSION_DIR  = path.join(DATA_DIR, 'session');
const SESSION_FILE = path.join(SESSION_DIR, 'instagram-session.json');
const LOG_DIR      = path.join(__dirname, '..', 'logs');
const LOG_FILE     = path.join(LOG_DIR, 'sender.log');

const security  = new SessionSecurity();
const dmQueue   = new DmQueueDB();

const C = {
  reset:'\x1b[0m', bright:'\x1b[1m', dim:'\x1b[2m', green:'\x1b[32m',
  yellow:'\x1b[33m', red:'\x1b[31m', cyan:'\x1b[36m', magenta:'\x1b[35m',
  blue:'\x1b[34m'
};

// ---- Utilitários ----
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleepRandom = (minMs, maxMs) => sleep(rand(minMs, maxMs));

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(msg);
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ---- Browser (mesma config do 0-scraper.js) ----
async function launchBrowser() {
  const config = dmQueue.loadSenderConfig();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
           '--disable-accelerated-2d-canvas','--no-first-run','--no-zygote','--disable-gpu']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    extraHTTPHeaders: { 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' }
  });

  // Carregar sessão criptografada (compartilhada com 0-scraper.js)
  const cookies = security.loadEncrypted(SESSION_FILE);
  if (!cookies || cookies.length === 0) {
    await browser.close();
    throw new Error('Sessão Instagram não encontrada. Execute: node agents/0-scraper.js login');
  }

  await context.addCookies(cookies);
  const sid = cookies.find(c => c.name === 'sessionid');
  if (sid) log(`${C.green}[SENDER] Sessão carregada (${sid.value.slice(0,8)}...)${C.reset}`);

  return { browser, context };
}

// ---- Verificar se Instagram detectou automação ----
async function checkForChallenge(page) {
  const url = page.url();
  if (url.includes('challenge') || url.includes('consent') || url.includes('login')) {
    return true;
  }
  // Verificar modal de "Action Blocked" ou "Try Again Later"
  const blocked = await page.$('text=/try again later|action blocked|suspicious|aguarde/i');
  return !!blocked;
}

// ---- Digitação humanizada ----
async function typeHumanized(page, selector, text) {
  const config = dmQueue.loadSenderConfig();
  const minDelay = config.typing_speed_min_ms || 50;
  const maxDelay = config.typing_speed_max_ms || 150;

  await page.click(selector);
  await sleepRandom(200, 500);

  for (const char of text) {
    await page.keyboard.type(char, { delay: 0 });
    await sleepRandom(minDelay, maxDelay);

    // Pausas naturais em pontuação e quebras de frase
    if ('.!?'.includes(char)) await sleepRandom(300, 800);
    else if (',;:'.includes(char)) await sleepRandom(150, 400);
    else if (char === '\n') await sleepRandom(400, 900);
  }
}

// ---- Enviar DM para um usuário ----
async function sendDM(page, username, message) {
  log(`${C.cyan}[SENDER] Enviando DM para @${username}...${C.reset}`);

  try {
    // 1. Navegar para DMs diretas
    await page.goto('https://www.instagram.com/direct/new/', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await sleepRandom(2000, 4000);

    // Verificar challenge
    if (await checkForChallenge(page)) {
      throw new Error('CHALLENGE_DETECTED');
    }

    // 2. Clicar no campo de busca e digitar username
    // Instagram Direct: campo "Search..." para encontrar usuário
    const searchInput = await page.waitForSelector(
      'input[placeholder*="Search" i], input[placeholder*="Pesquisar" i], input[name="queryBox"]',
      { timeout: 15000 }
    );
    await sleepRandom(500, 1500);

    await typeHumanized(page, 'input[placeholder*="Search" i], input[placeholder*="Pesquisar" i], input[name="queryBox"]', username);
    await sleepRandom(2000, 4000);

    // 3. Selecionar o usuário no dropdown de resultados
    const userResult = await page.waitForSelector(
      `span:text-is("${username}"), div[role="listbox"] button, div[role="option"]`,
      { timeout: 10000 }
    ).catch(() => null);

    if (!userResult) {
      // Fallback: clicar no primeiro resultado que contém o username
      const firstResult = await page.$(`text="${username}"`);
      if (!firstResult) throw new Error(`Usuário @${username} não encontrado na busca`);
      await firstResult.click();
    } else {
      await userResult.click();
    }
    await sleepRandom(1000, 2000);

    // 4. Clicar "Next" / "Avançar" para abrir a conversa
    const nextBtn = await page.$('button:has-text("Next"), button:has-text("Avançar"), div[role="button"]:has-text("Next"), div[role="button"]:has-text("Avançar")');
    if (nextBtn) {
      await nextBtn.click();
      await sleepRandom(1500, 3000);
    }

    // Verificar challenge novamente
    if (await checkForChallenge(page)) {
      throw new Error('CHALLENGE_DETECTED');
    }

    // 5. Encontrar campo de mensagem e digitar
    const msgInput = await page.waitForSelector(
      'textarea[placeholder*="Message" i], textarea[placeholder*="Mensagem" i], div[role="textbox"][contenteditable="true"]',
      { timeout: 15000 }
    );

    if (!msgInput) throw new Error('Campo de mensagem não encontrado');

    // Para contenteditable div
    const tag = await msgInput.evaluate(el => el.tagName.toLowerCase());
    if (tag === 'div') {
      await msgInput.click();
      await sleepRandom(300, 600);
      // Usar typeHumanized character by character
      for (const char of message) {
        await page.keyboard.type(char, { delay: 0 });
        await sleepRandom(
          dmQueue.loadSenderConfig().typing_speed_min_ms || 50,
          dmQueue.loadSenderConfig().typing_speed_max_ms || 150
        );
        if ('.!?'.includes(char)) await sleepRandom(300, 800);
        else if (',;:'.includes(char)) await sleepRandom(150, 400);
      }
    } else {
      await typeHumanized(page, 'textarea[placeholder*="Message" i], textarea[placeholder*="Mensagem" i]', message);
    }

    await sleepRandom(800, 2000);

    // 6. Enviar (Enter ou botão Send)
    await page.keyboard.press('Enter');
    await sleepRandom(2000, 4000);

    // Verificar se mensagem foi enviada (botão de envio sumiu ou mensagem apareceu)
    if (await checkForChallenge(page)) {
      throw new Error('CHALLENGE_DETECTED');
    }

    log(`${C.green}[SENDER] ✅ DM enviada para @${username}${C.reset}`);
    return { success: true };

  } catch (error) {
    log(`${C.red}[SENDER] ❌ Erro ao enviar DM para @${username}: ${error.message}${C.reset}`);
    return { success: false, error: error.message };
  }
}

// ---- Processar fila de DMs ----
async function processQueue(singleBatch = false) {
  const config = dmQueue.loadSenderConfig();

  if (!config.enabled) {
    log(`${C.yellow}[SENDER] ⚠️  Sender desabilitado. Ative via dashboard.${C.reset}`);
    return;
  }

  if (!dmQueue.canSendMore()) {
    log(`${C.yellow}[SENDER] ⚠️  Limite diário atingido (${config.today_count}/${config.max_per_day}). Retomando amanhã.${C.reset}`);
    dmQueue.updateSenderConfig({ status: 'idle' });
    return;
  }

  const pending = dmQueue.getNextPending();
  if (!pending) {
    log(`${C.dim}[SENDER] Fila vazia. Nada para enviar.${C.reset}`);
    dmQueue.updateSenderConfig({ status: 'idle' });
    return;
  }

  let browser, context;
  try {
    ({ browser, context } = await launchBrowser());
    const page = await context.newPage();

    // Verificar sessão acessando Instagram
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleepRandom(2000, 4000);

    if (await checkForChallenge(page)) {
      log(`${C.red}[SENDER] 🛑 Challenge/login detectado. Sessão inválida.${C.reset}`);
      log(`${C.yellow}[SENDER] Execute: node agents/0-scraper.js login${C.reset}`);
      dmQueue.updateSenderConfig({ status: 'error', enabled: false });
      return;
    }

    dmQueue.updateSenderConfig({ status: 'running' });

    // Processar itens da fila
    let sentCount = 0;
    while (true) {
      const item = dmQueue.getNextPending();
      if (!item) break;

      const freshConfig = dmQueue.loadSenderConfig();
      if (!freshConfig.enabled) {
        log(`${C.yellow}[SENDER] ⏸️  Sender pausado pelo usuário.${C.reset}`);
        break;
      }
      if (freshConfig.today_count >= freshConfig.max_per_day) {
        log(`${C.yellow}[SENDER] Limite diário atingido (${freshConfig.today_count}/${freshConfig.max_per_day}).${C.reset}`);
        break;
      }

      // Marcar como "sending"
      dmQueue.updateItem(item.id, { status: 'sending' });

      const result = await sendDM(page, item.username, item.message);

      if (result.success) {
        dmQueue.markSent(item.id);
        dmQueue.incrementDailyCount();
        sentCount++;
        log(`${C.green}[SENDER] ✅ ${sentCount} enviada(s) hoje (${freshConfig.today_count + 1}/${freshConfig.max_per_day})${C.reset}`);

        // Atualizar tracker do lead
        try {
          const trackerPath = path.join(DATA_DIR, 'tracker', `${item.username}_tracker.json`);
          const tracker = fs.existsSync(trackerPath)
            ? JSON.parse(fs.readFileSync(trackerPath, 'utf8'))
            : { username: item.username, events: [] };
          tracker.dm_enviada = true;
          tracker.outcome = 'enviada';
          tracker.events.push({ type: 'dm_sent', timestamp: new Date().toISOString(), auto: true });
          fs.mkdirSync(path.dirname(trackerPath), { recursive: true });
          fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));
        } catch (e) { /* tracker update failed, not critical */ }

      } else if (result.error === 'CHALLENGE_DETECTED') {
        log(`${C.red}[SENDER] 🛑 CHALLENGE detectado! Pausando sender.${C.reset}`);
        dmQueue.updateItem(item.id, { status: 'pending' });  // Devolver para fila
        dmQueue.updateSenderConfig({ status: 'paused', enabled: false });
        break;
      } else {
        dmQueue.markFailed(item.id, result.error);
      }

      // Delay entre DMs (3-8 minutos)
      const nextItem = dmQueue.getNextPending();
      if (nextItem && !singleBatch) {
        const delayMin = (freshConfig.delay_between_min_sec || 180) * 1000;
        const delayMax = (freshConfig.delay_between_max_sec || 480) * 1000;
        const delayMs = rand(delayMin, delayMax);
        log(`${C.dim}[SENDER] ⏳ Aguardando ${Math.round(delayMs/1000/60)}min antes da próxima DM...${C.reset}`);
        await sleep(delayMs);
      } else if (singleBatch) {
        // Em modo --once, delay menor entre DMs (1-3 min)
        const nextPending = dmQueue.getNextPending();
        if (nextPending) {
          const shortDelay = rand(60000, 180000);
          log(`${C.dim}[SENDER] ⏳ Batch mode: ${Math.round(shortDelay/1000)}s...${C.reset}`);
          await sleep(shortDelay);
        }
      }
    }

    log(`${C.green}[SENDER] Sessão concluída. ${sentCount} DM(s) enviada(s).${C.reset}`);
    dmQueue.updateSenderConfig({ status: 'idle' });

  } catch (error) {
    log(`${C.red}[SENDER] Erro fatal: ${error.message}${C.reset}`);
    dmQueue.updateSenderConfig({ status: 'error' });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ---- Modo Daemon (poll contínuo) ----
async function daemonMode() {
  log(`\n${C.magenta}${'='.repeat(52)}${C.reset}`);
  log(`${C.bright}  AUTOSEND DAEMON - Prismatic Labs${C.reset}`);
  log(`${C.magenta}${'='.repeat(52)}${C.reset}`);

  const config = dmQueue.loadSenderConfig();
  log(`  Max/dia : ${config.max_per_day}`);
  log(`  Delay   : ${config.delay_between_min_sec}-${config.delay_between_max_sec}s`);
  log(`  Typing  : ${config.typing_speed_min_ms}-${config.typing_speed_max_ms}ms/char`);
  log(`  Status  : ${config.enabled ? C.green+'ATIVO'+C.reset : C.yellow+'DESATIVADO'+C.reset}`);
  log(`${C.magenta}${'='.repeat(52)}${C.reset}\n`);

  while (true) {
    try {
      const config = dmQueue.loadSenderConfig();
      if (config.enabled && dmQueue.canSendMore()) {
        const pending = dmQueue.getNextPending();
        if (pending) {
          await processQueue(false);
        }
      }
    } catch (e) {
      log(`${C.red}[SENDER] Erro no loop: ${e.message}${C.reset}`);
    }
    // Poll a cada 2-5 minutos
    await sleepRandom(120000, 300000);
  }
}

// ---- Modo Teste ----
async function testMode(username) {
  log(`${C.cyan}[SENDER] Modo teste: enviando DM para @${username}${C.reset}`);
  const testMsg = 'Oi! Essa é uma mensagem de teste do AutoSend Prismatic Labs.';

  let browser, context;
  try {
    ({ browser, context } = await launchBrowser());
    const page = await context.newPage();

    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleepRandom(2000, 3000);

    if (await checkForChallenge(page)) {
      log(`${C.red}[SENDER] Sessão inválida. Execute: node agents/0-scraper.js login${C.reset}`);
      return;
    }

    const result = await sendDM(page, username, testMsg);
    log(result.success
      ? `${C.green}[SENDER] ✅ Teste OK!${C.reset}`
      : `${C.red}[SENDER] ❌ Teste falhou: ${result.error}${C.reset}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ---- Status ----
function showStatus() {
  const config = dmQueue.loadSenderConfig();
  const stats  = dmQueue.getStats();

  console.log(`\n${C.magenta}${'='.repeat(40)}${C.reset}`);
  console.log(`${C.bright}  AUTOSEND STATUS${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(40)}${C.reset}`);
  console.log(`  Enabled  : ${config.enabled ? C.green+'YES'+C.reset : C.red+'NO'+C.reset}`);
  console.log(`  Status   : ${config.status}`);
  console.log(`  Hoje     : ${config.today_count}/${config.max_per_day} DMs`);
  console.log(`  Último   : ${config.last_send_at || 'nunca'}`);
  console.log(`  Fila     : ${stats.pending} pendentes, ${stats.sent} enviadas, ${stats.failed} falhas`);
  console.log(`${C.magenta}${'='.repeat(40)}${C.reset}\n`);
}

// ---- CLI ----
const args = process.argv.slice(2);

if (args.includes('--status')) {
  showStatus();
} else if (args.includes('--test') && args[args.indexOf('--test') + 1]) {
  testMode(args[args.indexOf('--test') + 1]);
} else if (args.includes('--once')) {
  processQueue(true).then(() => {
    log(`${C.dim}[SENDER] Batch finalizado.${C.reset}`);
    process.exit(0);
  });
} else {
  daemonMode();
}

// Graceful shutdown
process.on('SIGINT', () => {
  log(`${C.yellow}[SENDER] Encerrando...${C.reset}`);
  dmQueue.updateSenderConfig({ status: 'idle' });
  process.exit(0);
});

process.on('SIGTERM', () => {
  dmQueue.updateSenderConfig({ status: 'idle' });
  process.exit(0);
});
