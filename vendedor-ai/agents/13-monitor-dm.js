// =============================================================
// MODULO 13: MONITOR DM HEADLESS - PRISMATIC LABS VENDEDOR AI
// Uso: node 13-monitor-dm.js
// Roda Chrome headless com extensão para detectar respostas automaticamente
// =============================================================

require('dotenv').config();
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.join(__dirname, '..', 'chrome-extension');
const INSTAGRAM_URL = 'https://www.instagram.com/direct/inbox/';
const CHECK_INTERVAL = 30000; // 30 segundos

const C = {
  r: '\x1b[0m',
  b: '\x1b[1m',
  m: '\x1b[35m',
  c: '\x1b[36m',
  g: '\x1b[32m',
  y: '\x1b[33m'
};

if (!fs.existsSync(EXTENSION_PATH)) {
  console.error(`${C.m}[ERRO]${C.r} Extensão não encontrada em: ${EXTENSION_PATH}`);
  console.log(`Execute: ${C.c}git pull origin fix/consolidate-vendedor-code${C.r}`);
  process.exit(1);
}

console.log(`\n${C.m}${'='.repeat(60)}${C.r}`);
console.log(`${C.b}  MONITOR DM HEADLESS - Prismatic Labs${C.r}`);
console.log(`${C.m}${'='.repeat(60)}${C.r}`);
console.log(`  Iniciando Chrome headless com extensão...`);
console.log(`  Extensão: ${C.c}${EXTENSION_PATH}${C.r}`);
console.log(`${C.m}${'='.repeat(60)}${C.r}\n`);

(async () => {
  let browser;
  
  try {
    // Lança Chrome headless com extensão
    browser = await puppeteer.launch({
      headless: false, // IMPORTANTE: extensões não funcionam em headless=true (limitação do Chrome)
      // Mas podemos minimizar a janela via window position
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-position=-2400,-2400', // Posiciona janela fora da tela
      ],
      defaultViewport: null
    });
    
    console.log(`${C.g}✓${C.r} Chrome iniciado com extensão carregada`);
    
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    
    // Navega para Instagram Direct
    console.log(`${C.y}➤${C.r} Navegando para ${INSTAGRAM_URL}`);
    await page.goto(INSTAGRAM_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log(`${C.g}✓${C.r} Página carregada`);
    console.log(`\n${C.b}IMPORTANTE:${C.r} Faça login manualmente no Instagram na janela que abriu.`);
    console.log(`Após o login, a extensão começará a monitorar automaticamente.\n`);
    
    // Aguarda login (detecta quando URL muda de /accounts/login/)
    console.log(`${C.y}Aguardando login...${C.r}`);
    
    await page.waitForFunction(
      () => !window.location.pathname.includes('/accounts/login'),
      { timeout: 300000 } // 5 minutos para fazer login
    );
    
    console.log(`${C.g}✓${C.r} Login detectado!`);
    console.log(`${C.g}✓${C.r} Monitor ativo. Detectando respostas automaticamente...\n`);
    
    // Console logs da extensão
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Vendedor IA]')) {
        if (text.includes('Nova resposta detectada')) {
          console.log(`${C.g}✓${C.r} ${text}`);
        } else if (text.includes('Webhook enviado')) {
          console.log(`  ${C.c}➤${C.r} ${text}`);
        } else {
          console.log(`  ${C.y}[DEBUG]${C.r} ${text}`);
        }
      }
    });
    
    // Mantém navegador aberto
    console.log(`${C.m}${'='.repeat(60)}${C.r}`);
    console.log(`${C.b}Monitor rodando. Pressione Ctrl+C para parar.${C.r}`);
    console.log(`${C.m}${'='.repeat(60)}${C.r}\n`);
    
    // Health check periódico
    setInterval(async () => {
      try {
        const url = await page.url();
        if (!url.includes('instagram.com')) {
          console.log(`${C.y}[AVISO]${C.r} Navegou para fora do Instagram. Redirecionando...`);
          await page.goto(INSTAGRAM_URL, { waitUntil: 'networkidle2' });
        }
      } catch (error) {
        console.error(`${C.m}[ERRO]${C.r} Health check falhou:`, error.message);
      }
    }, CHECK_INTERVAL);
    
    // Mantém processo vivo
    await new Promise(() => {}); // Never resolves
    
  } catch (error) {
    console.error(`\n${C.m}[ERRO FATAL]${C.r}`, error.message);
    console.error(error.stack);
    
    if (browser) {
      await browser.close();
    }
    
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(`\n\n${C.y}Encerrando monitor...${C.r}`);
  process.exit(0);
});
