// =============================================================
// MODULO 13: MONITOR DM HEADLESS - PRISMATIC LABS VENDEDOR AI
// Uso: node 13-monitor-dm.js
// Roda Chrome com extensao para detectar respostas automaticamente
// =============================================================

require('dotenv').config();
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.join(__dirname, '..', 'chrome-extension');
const INSTAGRAM_URL  = 'https://www.instagram.com/direct/inbox/';
const CHECK_INTERVAL = 30000;

// Caminhos do Chrome no Windows
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Chromium\\Application\\chrome.exe',
];

const C = {
  r: '\x1b[0m', b: '\x1b[1m', m: '\x1b[35m',
  c: '\x1b[36m', g: '\x1b[32m', y: '\x1b[33m'
};

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

if (!fs.existsSync(EXTENSION_PATH)) {
  console.error(`${C.m}[ERRO]${C.r} Extensao nao encontrada em: ${EXTENSION_PATH}`);
  process.exit(1);
}

const chromePath = findChrome();
if (!chromePath) {
  console.error(`${C.m}[ERRO]${C.r} Chrome nao encontrado. Instale o Google Chrome.`);
  process.exit(1);
}

console.log(`\n${C.m}${'='.repeat(60)}${C.r}`);
console.log(`${C.b}  MONITOR DM - Prismatic Labs Vendedor IA${C.r}`);
console.log(`${C.m}${'='.repeat(60)}${C.r}`);
console.log(`  Chrome  : ${C.c}${chromePath}${C.r}`);
console.log(`  Extensao: ${C.c}${EXTENSION_PATH}${C.r}`);
console.log(`${C.m}${'='.repeat(60)}${C.r}\n`);

(async () => {
  let browser;

  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--window-position=-2400,-2400', // Fora da tela, invisivel
        '--window-size=1280,900',
      ],
      defaultViewport: null
    });

    console.log(`${C.g}[OK]${C.r} Chrome iniciado com extensao carregada`);

    const pages = await browser.pages();
    const page  = pages[0] || await browser.newPage();

    await page.goto(INSTAGRAM_URL, { waitUntil: 'networkidle2', timeout: 60000 })
      .catch(() => page.goto(INSTAGRAM_URL, { timeout: 60000 }));

    console.log(`${C.g}[OK]${C.r} Pagina Instagram carregada`);
    console.log(`\n${C.b}ACAO NECESSARIA:${C.r}`);
    console.log(`  1. Procure a janela do Chrome que abriu (pode estar na barra de tarefas)`);
    console.log(`  2. Faca login no Instagram`);
    console.log(`  3. Volte aqui - o monitor vai ativar automaticamente\n`);

    // Aguarda login (max 5 minutos)
    await page.waitForFunction(
      () => !window.location.pathname.includes('/accounts/login') &&
            !window.location.pathname.includes('/challenge'),
      { timeout: 300000 }
    ).catch(() => {
      console.log(`${C.y}[AVISO]${C.r} Timeout aguardando login. Continuando mesmo assim...`);
    });

    console.log(`${C.g}[OK]${C.r} Login detectado!`);
    console.log(`${C.g}[OK]${C.r} Monitor ativo. Aguardando respostas automaticamente...\n`);

    // Redireciona para inbox se necessario
    const currentUrl = page.url();
    if (!currentUrl.includes('/direct')) {
      await page.goto(INSTAGRAM_URL, { waitUntil: 'networkidle2' });
    }

    // Captura logs da extensao
    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('[Vendedor IA]')) return;

      if (text.includes('Nova resposta detectada') || text.includes('Webhook enviado')) {
        console.log(`${C.g}[DETECTADO]${C.r} ${text}`);
      }
    });

    // Health check
    setInterval(async () => {
      try {
        const url = await page.url();
        const now = new Date().toLocaleTimeString('pt-BR');
        console.log(`${C.c}[${now}]${C.r} Monitor ativo | URL: ${url.substring(0, 50)}`);

        if (!url.includes('instagram.com')) {
          await page.goto(INSTAGRAM_URL, { waitUntil: 'networkidle2' });
        }
      } catch (err) {
        console.error(`${C.m}[ERRO]${C.r} Health check:`, err.message);
      }
    }, CHECK_INTERVAL);

    console.log(`${C.m}${'='.repeat(60)}${C.r}`);
    console.log(`${C.b}  Monitor rodando. Pressione Ctrl+C para parar.${C.r}`);
    console.log(`${C.m}${'='.repeat(60)}${C.r}\n`);

    await new Promise(() => {});

  } catch (error) {
    console.error(`\n${C.m}[ERRO FATAL]${C.r}`, error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
})();

process.on('SIGINT', async () => {
  console.log(`\n${C.y}Encerrando monitor...${C.r}`);
  process.exit(0);
});
