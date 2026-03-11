// =============================================================
// MODULO 0: SCRAPER - INSTAGRAM SCRAPER PROPRIO (SEM APIFY)
// Usa Playwright com Chromium headless para raspar Instagram
// Substitui totalmente o Apify — roda na VPS 24/7
//
// 🔒 SEGURANÇA: Sessões protegidas com AES-256-GCM
//
// ARQUITETURA:
//   1. Scraping visual como método PRINCIPAL (sessão autenticada)
//   2. API como bomús quando disponível (429 é ignorado graciosamente)
//   3. Interceptação de XHR para capturar dados das hashtags
//   4. Regex PT+EN para extrair contadores (seguidores/Followers)
//
// Uso:
//   node 0-scraper.js login              - Login automático (.env)
//   node 0-scraper.js login --manual     - Login manual (navegador)
//   node 0-scraper.js diag               - Diagnóstico completo
//   node 0-scraper.js hashtag makecom 50
//   node 0-scraper.js profile n8nautomation
// =============================================================

require('dotenv').config();
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const SessionSecurity = require('../config/session-security');

const DATA_DIR    = path.join(__dirname, '..', 'data');
const SESSION_DIR = path.join(DATA_DIR, 'session');
const SESSION_FILE = path.join(SESSION_DIR, 'instagram-session.json');

const security = new SessionSecurity();

const DELAY_MULT = parseFloat(process.env.AUTOPILOT_DELAY_MULTIPLIER || '1.0');
if (DELAY_MULT > 1) console.log(`⏱️  [SCRAPER] Modo cauteloso: delays ${DELAY_MULT}x mais longos`);

const C = {
  reset:'\x1b[0m', bright:'\x1b[1m', dim:'\x1b[2m', green:'\x1b[32m',
  yellow:'\x1b[33m', red:'\x1b[31m', cyan:'\x1b[36m', magenta:'\x1b[35m'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleepRandom = async (minMs = 1500, maxMs = 3500) =>
  sleep(rand(Math.floor(minMs * DELAY_MULT), Math.floor(maxMs * DELAY_MULT)));

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// Extrai número de seguidores de strings PT ou EN
// Ex: "701M seguidores" ou "701M Followers" ou "12,345 Followers"
function parseFollowers(text) {
  const match = text.match(/([\d,.]+[KkMmBb]?)\s*(seguidores|[Ff]ollowers)/);
  if (!match) return 0;
  let raw = match[1].replace(',', '.');
  if (/[Mm]$/.test(raw)) return Math.round(parseFloat(raw) * 1_000_000);
  if (/[Kk]$/.test(raw)) return Math.round(parseFloat(raw) * 1_000);
  if (/[Bb]$/.test(raw)) return Math.round(parseFloat(raw) * 1_000_000_000);
  return parseInt(raw.replace(/\./g, '')) || 0;
}

// ---- BROWSER ----
async function launchBrowser(headless = true) {
  const browser = await chromium.launch({
    headless,
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

  const cookies = security.loadEncrypted(SESSION_FILE);
  if (cookies && cookies.length > 0) {
    try {
      await context.addCookies(cookies);
      const s = cookies.find(c => c.name === 'sessionid');
      if (s) console.log(`${C.green}[SCRAPER] 🔒 Sessão carregada (${s.value.slice(0,8)}...)${C.reset}`);
      else   console.log(`${C.yellow}[SCRAPER] ⚠️  Sessão sem sessionid!${C.reset}`);
    } catch (e) {
      console.log(`${C.yellow}[SCRAPER] Sessão inválida: ${e.message}${C.reset}`);
    }
  } else {
    console.log(`${C.yellow}[SCRAPER] ⚠️  Sem sessão — rodando sem login${C.reset}`);
  }

  return { browser, context };
}

async function saveSession(context) {
  const cookies = await context.cookies();
  security.saveEncrypted(SESSION_FILE, cookies);
  console.log(`${C.green}[SCRAPER] 🔒 Sessão salva (${cookies.length} cookies)${C.reset}`);
}

// ---- LOGIN AUTOMÁTICO ----
async function doAutoLogin() {
  const username = process.env.INSTAGRAM_USERNAME;
  const password = process.env.INSTAGRAM_PASSWORD;
  if (!username || !password) {
    console.log(`${C.red}[SCRAPER] ❌ INSTAGRAM_USERNAME / INSTAGRAM_PASSWORD não definidos no .env${C.reset}`);
    process.exit(1);
  }
  console.log(`\n${C.cyan}[SCRAPER] Login automático: @${username}${C.reset}`);
  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();
  try {
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await sleep(2000);
    await page.fill('input[name="username"]', username);
    await sleep(rand(400, 900));
    await page.fill('input[name="password"]', password);
    await sleep(rand(600, 1200));
    await page.click('button[type="submit"]');
    console.log(`${C.cyan}[SCRAPER] Aguardando redirecionamento...${C.reset}`);
    await page.waitForURL(url => !url.includes('/accounts/login'), { timeout: 30000 });
    await sleep(3000);
    const url = page.url();
    if (url.includes('challenge') || url.includes('two_factor')) {
      console.log(`${C.yellow}[SCRAPER] ⚠️  Verificação adicional — use login --manual${C.reset}`);
      await browser.close(); process.exit(1);
    }
    await saveSession(context);
    console.log(`${C.green}✅ Login automático OK!${C.reset}\n`);
  } catch (e) {
    console.error(`${C.red}[SCRAPER] Erro: ${e.message}${C.reset}`);
    console.log(`${C.yellow}Tente: node 0-scraper.js login --manual${C.reset}`);
    await browser.close(); process.exit(1);
  }
  await browser.close();
}

// ---- LOGIN MANUAL ----
async function doManualLogin() {
  console.log(`\n${C.cyan}[SCRAPER] Abrindo navegador...${C.reset}`);
  console.log(`${C.yellow}1. Faça login no Instagram${C.reset}`);
  console.log(`${C.yellow}2. Pressione ENTER aqui quando logado${C.reset}\n`);
  const { browser, context } = await launchBrowser(false);
  const page = await context.newPage();
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle' });
  await new Promise(resolve => { process.stdin.resume(); process.stdin.once('data', resolve); });
  await saveSession(context);
  await browser.close();
  console.log(`\n${C.green}✅ Login salvo! Validade: ~30 dias${C.reset}\n`);
}

// ---- DIAGNÓSTICO ----
async function runDiag() {
  console.log(`\n${C.magenta}===== DIAGNÓSTICO DO SCRAPER =====${C.reset}\n`);

  console.log(`${C.cyan}1. Verificando sessão...${C.reset}`);
  const cookies = security.loadEncrypted(SESSION_FILE);
  if (!cookies) {
    console.log(`   ${C.red}❌ Sem sessão salva${C.reset}`);
  } else {
    const sid = cookies.find(c => c.name === 'sessionid');
    const csrf = cookies.find(c => c.name === 'csrftoken');
    console.log(`   Cookies: ${cookies.length}`);
    console.log(`   sessionid: ${sid  ? C.green+'✅ presente'+C.reset : C.red+'❌ ausente'+C.reset}`);
    console.log(`   csrftoken: ${csrf ? C.green+'✅ presente'+C.reset : C.red+'❌ ausente'+C.reset}`);
    if (sid) {
      const exp = new Date(sid.expires * 1000);
      console.log(`   Expiração: ${exp.toLocaleDateString('pt-BR')} ${exp > new Date() ? C.green+'(válido)'+C.reset : C.red+'(EXPIRADO)'+C.reset}`);
    }
  }

  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();

  console.log(`\n${C.cyan}2. Testando API de perfil (@instagram)...${C.reset}`);
  for (const base of ['https://www.instagram.com','https://i.instagram.com']) {
    try {
      const resp = await context.request.get(`${base}/api/v1/users/web_profile_info/?username=instagram`, {
        headers: { 'X-IG-App-ID':'936619743392459','X-Requested-With':'XMLHttpRequest','Referer':'https://www.instagram.com/instagram/' }
      });
      const s = resp.status();
      if (resp.ok()) {
        const d = await resp.json();
        const f = d?.data?.user?.edge_followed_by?.count;
        console.log(`   ${base.includes('i.') ? 'i.instagram' : 'www.instagram'}: ${f ? C.green+'✅ '+f+' followers'+C.reset : C.yellow+'⚠️  JSON vazio'+C.reset}`);
      } else {
        console.log(`   ${base.includes('i.') ? 'i.instagram' : 'www.instagram'}: ${C.red}❌ HTTP ${s}${C.reset}`);
      }
    } catch(e) { console.log(`   ${C.red}❌ ${e.message}${C.reset}`); }
  }

  console.log(`\n${C.cyan}3. Testando scraping visual autenticado (@instagram)...${C.reset}`);
  try {
    await page.goto('https://www.instagram.com/instagram/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    const url = page.url();
    if (url.includes('login')) {
      console.log(`   ${C.red}❌ Redirecionou para login — sessão inválida${C.reset}`);
    } else {
      const desc = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
      const followers = parseFollowers(desc);
      console.log(`   URL: ${url}`);
      console.log(`   Meta: ${desc.slice(0,80)}`);
      console.log(`   Followers: ${followers > 0 ? C.green+'✅ '+followers.toLocaleString()+C.reset : C.yellow+'⚠️  não encontrado'+C.reset}`);
      if (followers > 0) console.log(`   ${C.green}✅ SESSÃO VÁLIDA E FUNCIONAL!${C.reset}`);
    }
  } catch(e) { console.log(`   ${C.red}❌ ${e.message}${C.reset}`); }

  console.log(`\n${C.cyan}4. Testando scraping de hashtag (#automacao)...${C.reset}`);
  try {
    const captured = new Set();
    page.on('response', async resp => {
      if (!resp.url().includes('/api/v1/tags/')) return;
      try {
        const json = await resp.json().catch(() => null);
        if (json?.data?.recent?.sections)
          for (const s of json.data.recent.sections)
            for (const m of (s.layout_content?.medias||[]))
              if (m.media?.user?.username) captured.add(m.media.user.username);
      } catch(_) {}
    });
    await page.goto('https://www.instagram.com/explore/tags/automacao/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(3000);
    for (let i = 0; i < 3; i++) { await page.evaluate(() => window.scrollBy(0,2000)); await sleep(1500); }
    console.log(`   XHR capturados: ${captured.size > 0 ? C.green+'✅ '+captured.size+' usernames'+C.reset : C.yellow+'⚠️  0 (API bloqueada)'+C.reset}`);
    if (captured.size === 0) {
      const alts = await page.$$eval('a[href*="/p/"] img', imgs => imgs.map(i => i.alt||'').filter(Boolean));
      let fromAlt = 0;
      for (const alt of alts) { const m = alt.match(/@([a-zA-Z0-9._]+)/); if (m) { captured.add(m[1]); fromAlt++; } }
      console.log(`   Alt text: ${fromAlt > 0 ? C.green+'✅ '+fromAlt+' usernames'+C.reset : C.red+'❌ 0 — bloqueio total'+C.reset}`);
    }
  } catch(e) { console.log(`   ${C.red}❌ ${e.message}${C.reset}`); }

  await browser.close();
  console.log(`\n${C.magenta}===== FIM DO DIAGNÓSTICO =====${C.reset}\n`);
}

// ---- SCRAPER DE HASHTAG ----
// Método 1: API (quando disponível)
// Método 2: Interceptar XHR enquanto navega
// Método 3: Extrair alt de imagens
async function scrapeHashtag(hashtag, limit = 50) {
  const tag = hashtag.replace('#','').toLowerCase();
  console.log(`\n${C.cyan}[SCRAPER] Hashtag: #${tag} | Meta: ${limit} perfis${C.reset}`);

  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,mov}', r => r.abort());

  const usernames = new Set();

  try {
    // Método 1: API direta
    try {
      const resp = await context.request.get(
        `https://www.instagram.com/api/v1/tags/web_info/?tag_name=${tag}`,
        { headers: { 'X-IG-App-ID':'936619743392459','X-Requested-With':'XMLHttpRequest',
                     'Referer':`https://www.instagram.com/explore/tags/${tag}/` } }
      );
      if (resp.ok()) {
        const data = await resp.json();
        for (const s of (data?.data?.recent?.sections||[]))
          for (const m of (s.layout_content?.medias||[]))
            if (m.media?.user?.username) usernames.add(m.media.user.username.toLowerCase());
        if (usernames.size > 0) console.log(`${C.green}[SCRAPER] Método 1 (API): ${usernames.size} usernames${C.reset}`);
      }
    } catch(_) {}

    // Método 2: Navegar + interceptar XHR
    if (usernames.size < limit) {
      const captured = new Set();
      page.on('response', async resp => {
        const url = resp.url();
        if (!url.includes('/api/v1/tags/') && !url.includes('/api/v1/feed/')) return;
        try {
          const json = await resp.json().catch(() => null);
          if (!json) return;
          // Formato hashtag
          if (json?.data?.recent?.sections)
            for (const s of json.data.recent.sections)
              for (const m of (s.layout_content?.medias||[]))
                if (m.media?.user?.username) captured.add(m.media.user.username.toLowerCase());
          // Formato feed
          for (const item of (json?.items||[]))
            if (item?.user?.username) captured.add(item.user.username.toLowerCase());
        } catch(_) {}
      });

      await page.goto(`https://www.instagram.com/explore/tags/${tag}/`, {
        waitUntil: 'domcontentloaded', timeout: 30000
      });

      const currentUrl = page.url();
      if (currentUrl.includes('login')) {
        console.log(`${C.red}[SCRAPER] Sessão expirada — refaz o login${C.reset}`);
      } else {
        await sleep(3000);
        for (let i = 0; i < 5 && captured.size < limit; i++) {
          await page.evaluate(() => window.scrollBy(0, 2000));
          await sleep(2000);
        }
        captured.forEach(u => usernames.add(u));
        if (captured.size > 0) console.log(`${C.green}[SCRAPER] Método 2 (XHR): ${captured.size} usernames${C.reset}`);
      }
    }

    // Método 3: Alt de imagens (fallback final)
    if (usernames.size < 5) {
      console.log(`${C.yellow}[SCRAPER] Método 3: extraindo de alt de imagens...${C.reset}`);
      const alts = await page.$$eval('a[href*="/p/"] img', imgs => imgs.map(i => i.alt||'').filter(Boolean));
      for (const alt of alts) {
        const m = alt.match(/@([a-zA-Z0-9._]+)/);
        if (m) usernames.add(m[1].toLowerCase());
        if (usernames.size >= limit) break;
      }
    }

  } catch(e) {
    console.error(`${C.red}[SCRAPER] Erro hashtag ${tag}: ${e.message}${C.reset}`);
  } finally {
    await browser.close();
  }

  // Filtro: remove entradas que parecem emails ou domínios (ex: "hotmail.com")
  const isValidUsername = u => u && !u.includes('.') && !u.includes('@') && u.length >= 2 && u.length <= 30;
  const result = Array.from(usernames).filter(isValidUsername).slice(0, limit);
  console.log(`${C.green}[SCRAPER] Total coletado: ${result.length} de #${tag}${C.reset}`);
  return result;
}

// ---- SCRAPER DE PERFIL ----
// Método 1: API (quando não há 429)
// Método 2: Scraping visual autenticado
async function scrapeProfile(username) {
  username = username.replace('@','').toLowerCase();
  console.log(`${C.cyan}[SCRAPER] Perfil: @${username}${C.reset}`);

  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,mov}', r => r.abort());

  let profile = { username, bio:'', followers:0, posts:0, following:0 };

  try {
    // Método 1: API
    const resp = await context.request.get(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      { headers: { 'X-IG-App-ID':'936619743392459','X-Requested-With':'XMLHttpRequest',
                   'Referer':`https://www.instagram.com/${username}/` } }
    );
    if (resp.ok()) {
      const data = await resp.json();
      const u = data?.data?.user;
      if (u) {
        profile = {
          username,  bio: u.biography||'',
          user_id:   u.id||'',
          followers: u.edge_followed_by?.count||0,
          following: u.edge_follow?.count||0,
          posts:     u.edge_owner_to_timeline_media?.count||0,
          fullName:  u.full_name||'',
          isPrivate: u.is_private||false,
          isVerified:u.is_verified||false,
          externalUrl:u.external_url||''
        };
      }
    }

    // Método 2: Scraping visual (quando API retorna 429 ou vazio)
    if (profile.followers === 0) {
      await page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: 'domcontentloaded', timeout: 30000
      });
      await sleep(2000);

      // Tentar capturar via XHR disparado pela própria página
      const apiData = await page.evaluate(async (user) => {
        try {
          const r = await fetch(`/api/v1/users/web_profile_info/?username=${user}`, {
            headers: { 'X-IG-App-ID':'936619743392459','X-Requested-With':'XMLHttpRequest' }
          });
          if (r.ok) return r.json();
        } catch(_) {}
        return null;
      }, username);

      if (apiData?.data?.user) {
        const u = apiData.data.user;
        profile = {
          username,  bio: u.biography||'',
          user_id:   u.id||'',
          followers: u.edge_followed_by?.count||0,
          following: u.edge_follow?.count||0,
          posts:     u.edge_owner_to_timeline_media?.count||0,
          fullName:  u.full_name||'',
          isPrivate: u.is_private||false,
          isVerified:u.is_verified||false,
          externalUrl:u.external_url||''
        };
      }

      // Fallback final: meta description (PT e EN)
      if (profile.followers === 0) {
        const desc = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
        if (desc) {
          profile.followers = parseFollowers(desc);
          // Tentar bio via ld+json
          const ld = await page.$eval('script[type="application/ld+json"]', el => el.textContent).catch(() => null);
          if (ld) { try { profile.bio = JSON.parse(ld).description||''; } catch(_) {} }
        }
      }
    }

  } catch(e) {
    console.error(`${C.yellow}[SCRAPER] Aviso @${username}: ${e.message}${C.reset}`);
  } finally {
    await browser.close();
  }

  return profile;
}

// ---- SCRAPER DE MÚLTIPLOS PERFIS (1 browser) ----
async function scrapeProfiles(usernames) {
  console.log(`\n${C.cyan}[SCRAPER] Enriquecendo ${usernames.length} perfis...${C.reset}`);
  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,mov}', r => r.abort());

  const profiles = [];
  let success = 0, fail = 0;

  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i].replace('@','').toLowerCase();
    process.stdout.write(`  [${i+1}/${usernames.length}] @${username}... `);

    try {
      // Primeiro tenta API
      let profile = null;
      const resp = await context.request.get(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
        { headers: { 'X-IG-App-ID':'936619743392459','X-Requested-With':'XMLHttpRequest',
                     'Referer':`https://www.instagram.com/${username}/` } }
      );

      if (resp.ok()) {
        const data = await resp.json();
        const u = data?.data?.user;
        if (u) profile = {
          username, bio:u.biography||'', user_id:u.id||'',
          followers:u.edge_followed_by?.count||0,
          following:u.edge_follow?.count||0, posts:u.edge_owner_to_timeline_media?.count||0,
          fullName:u.full_name||'', isPrivate:u.is_private||false, externalUrl:u.external_url||''
        };
      } else if (resp.status() === 429) {
        // Rate limit: usar scraping visual inline
        await page.goto(`https://www.instagram.com/${username}/`, { waitUntil:'domcontentloaded', timeout:20000 });
        await sleep(1500);
        const apiData = await page.evaluate(async (user) => {
          try {
            const r = await fetch(`/api/v1/users/web_profile_info/?username=${user}`, {
              headers: { 'X-IG-App-ID':'936619743392459','X-Requested-With':'XMLHttpRequest' }
            });
            if (r.ok) return r.json();
          } catch(_) {}
          return null;
        }, username);
        if (apiData?.data?.user) {
          const u = apiData.data.user;
          profile = {
            username, bio:u.biography||'', user_id:u.id||'',
            followers:u.edge_followed_by?.count||0,
            following:u.edge_follow?.count||0, posts:u.edge_owner_to_timeline_media?.count||0,
            fullName:u.full_name||'', isPrivate:u.is_private||false, externalUrl:u.external_url||''
          };
        }
        if (!profile) {
          const desc = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
          profile = { username, bio:'', followers:parseFollowers(desc), posts:0, following:0 };
        }
      }

      if (profile && (profile.followers > 0 || profile.bio)) {
        profiles.push(profile);
        success++;
        process.stdout.write(`${C.green}OK (${profile.followers.toLocaleString()} followers)${C.reset}\n`);
      } else {
        profiles.push({ username, bio:'', followers:0, posts:0 });
        fail++;
        process.stdout.write(`${C.yellow}sem dados${C.reset}\n`);
      }
    } catch(e) {
      profiles.push({ username, bio:'', followers:0, posts:0 });
      fail++;
      process.stdout.write(`${C.red}erro: ${e.message.slice(0,40)}${C.reset}\n`);
    }

    if (i < usernames.length - 1) await sleepRandom(1500, 3500);
  }

  await browser.close();
  console.log(`${C.green}[SCRAPER] Perfis: ${success} ok | ${fail} falhas${C.reset}`);
  return profiles;
}

// ---- SCRAPER POR BUSCA (fallback quando hashtag é bloqueada) ----
async function topsearchQuery(context, query) {
  const q = encodeURIComponent(query.replace('#',''));
  const rankToken = `0.${Math.random().toString().slice(2, 10)}`;
  try {
    const resp = await context.request.get(
      `https://www.instagram.com/api/v1/web/search/topsearch/?context=blended&query=${q}&rank_token=${rankToken}&count=30`,
      { headers: {
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.instagram.com/'
      }}
    );
    if (!resp.ok()) return [];
    const json = await resp.json();
    return (json.users || []).map(item => item?.user?.username).filter(Boolean);
  } catch(_) { return []; }
}

async function scrapeBySearch(query, limit = 20) {
  console.log(`\n${C.cyan}[SCRAPER] Busca: "${query}" | Meta: ${limit} perfis${C.reset}`);

  const { browser, context } = await launchBrowser(true);
  const usernames = new Set();

  try {
    // Gera variações da query (topsearch retorna ~5 por query, então rodamos várias)
    const words   = query.replace('#','').split(/\s+/).filter(w => w.length > 2);
    const queries = [...new Set([query, ...words])].slice(0, 5);

    for (const q of queries) {
      if (usernames.size >= limit) break;
      const results = await topsearchQuery(context, q);
      results.forEach(u => usernames.add(u.toLowerCase()));
      if (results.length > 0)
        console.log(`${C.green}[SCRAPER] topsearch "${q}": +${results.length} → total ${usernames.size}${C.reset}`);
      if (queries.indexOf(q) < queries.length - 1) await sleep(800);
    }

  } catch(e) {
    console.error(`${C.red}[SCRAPER] Erro busca "${query}": ${e.message}${C.reset}`);
  } finally {
    await browser.close();
  }

  const blocked = new Set(['explore','reels','stories','direct','accounts','p','tv','reel','instagram']);
  const looksLikeBot = u => /^[a-z]{2}[0-9a-z_]{9,}$/.test(u) && !/[aeiou]/.test(u);
  const isValid = u =>
    u && u.length >= 3 && u.length <= 30 &&
    !blocked.has(u) && !looksLikeBot(u);

  const result = Array.from(usernames).filter(isValid).slice(0, limit);
  console.log(`${C.green}[SCRAPER] Busca: ${result.length} perfis encontrados${C.reset}`);
  return result;
}

// ---- SCORE DE SEED ACCOUNT ----
// Quanto maior o score, melhor o perfil como seed (0-100)
function scoreSeedAccount(profile) {
  let score = 0;
  const f = profile.followers || 0;
  const bio = (profile.bio || '').toLowerCase();

  // 1. Sweet spot de seguidores: 5k-500k (micro e médio influencers)
  // Muito pequeno = audiência irrelevante; muito grande = seguidores genéricos
  if      (f >= 10000  && f <= 100000) score += 40;  // ideal
  else if (f >= 5000   && f < 10000)   score += 30;
  else if (f >= 100001 && f <= 500000) score += 25;
  else if (f >= 1000   && f < 5000)    score += 10;
  else                                 score += 0;   // <1k ou >500k: penaliza

  // 2. Bio com palavras de conteúdo relevante (educativo, negócios, criadores)
  const seedKeywords = [
    // autoridade / educação
    'coach','mentor','especialista','professor','consultor','treinador',
    'ensino','educação','cursos','formação','mba','certificad',
    // negócios
    'agência','agencia','marketing','vendas','empreendedor','empresário',
    'startup','business','ceo','cofundador','co-fundador','diretor',
    // criadores sérios
    'criador','creator','conteúdo','canal','podcast','newsletter',
    // tech / automação (alinhado ao nicho IA)
    'automação','automacao','inteligência artificial','ia ','tecnologia',
    'software','developer','programador','saas','n8n','make.com'
  ];
  const keyHits = seedKeywords.filter(k => bio.includes(k)).length;
  score += Math.min(keyHits * 6, 25);  // até +25

  // 3. Conta ativa (tem posts)
  if (profile.posts >= 12) score += 10;
  else if (profile.posts >= 4) score += 5;

  // 4. Ratio followers/following saudável (criadores reais têm mais seguidores que seguindo)
  const ratio = profile.following > 0 ? f / profile.following : 0;
  if (ratio >= 3)   score += 10;
  else if (ratio >= 1.5) score += 5;

  // 5. Tem link externo (sinal de negócio/profissional)
  if (profile.externalUrl) score += 5;

  // 6. Não privada (se privada, não conseguimos scrape dos seguidores)
  if (!profile.isPrivate) score += 5;

  // Penalidade: verificada com > 500k followers (celebridades têm fãs, não compradores)
  if (profile.isVerified && f > 500000) score -= 15;

  return Math.max(0, Math.min(100, score));
}

// ---- SCRAPE DE SEGUIDORES DE UM PERFIL SEED ----
async function scrapeFollowers(userId, limit = 100) {
  if (!userId) {
    console.log(`${C.yellow}[SCRAPER] scrapeFollowers: user_id ausente, pulando${C.reset}`);
    return [];
  }
  console.log(`${C.cyan}[SCRAPER] Buscando seguidores de user_id=${userId} | meta: ${limit}${C.reset}`);

  const { browser, context } = await launchBrowser(true);
  const collected = [];
  let maxId = null;
  let page = 0;

  try {
    while (collected.length < limit) {
      page++;
      const url = `https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=50&search_surface=follow_list_page${maxId ? `&max_id=${maxId}` : ''}`;
      const resp = await context.request.get(url, {
        headers: {
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.instagram.com/'
        }
      });

      if (!resp.ok()) {
        const status = resp.status();
        if (status === 429) console.log(`${C.yellow}[SCRAPER] Followers rate-limit (429) — parando${C.reset}`);
        else if (status === 401) console.log(`${C.yellow}[SCRAPER] Followers não autorizado (401) — conta privada?${C.reset}`);
        else console.log(`${C.yellow}[SCRAPER] Followers HTTP ${status} — parando${C.reset}`);
        break;
      }

      const json = await resp.json();
      const users = json.users || [];
      if (users.length === 0) break;

      for (const u of users) {
        if (collected.length >= limit) break;
        if (!u.username || u.is_private) continue;
        collected.push(u.username.toLowerCase());
      }

      console.log(`  Página ${page}: +${users.length} → total ${collected.length}/${limit}`);

      maxId = json.next_max_id || null;
      if (!maxId) break;  // sem próxima página

      await sleepRandom(1500, 3000);
    }
  } catch(e) {
    console.error(`${C.red}[SCRAPER] Erro scrapeFollowers: ${e.message}${C.reset}`);
  } finally {
    await browser.close();
  }

  console.log(`${C.green}[SCRAPER] Seguidores coletados: ${collected.length}${C.reset}`);
  return collected;
}

// ---- SCRAPER POR NICHO ----
async function scrapeNicho(nichoConfig, limit = 30) {
  const hashtags = nichoConfig.hashtags.slice(0, 4);
  const seedAccounts = (nichoConfig.seed_accounts || []).slice(0, 3);
  console.log(`\n${C.magenta}${'='.repeat(60)}${C.reset}`);
  console.log(`${C.bright}  SCRAPER: ${nichoConfig.nome}${C.reset}`);
  console.log(`  Hashtags: ${hashtags.join(', ')} | Meta: ${limit} leads`);
  if (seedAccounts.length) console.log(`  Seed accounts: ${seedAccounts.join(', ')}`);
  console.log(`${C.magenta}${'='.repeat(60)}${C.reset}\n`);

  const allUsernames = new Set();

  // ── ROTA 1: hashtag scraping (tende a ser bloqueada pelo Instagram) ──────
  for (const hashtag of hashtags) {
    if (allUsernames.size >= limit * 2) break;
    const list = await scrapeHashtag(hashtag, Math.ceil(limit / hashtags.length) + 10);
    list.forEach(u => allUsernames.add(u));
    if (list.length > 0) await sleepRandom(3000, 6000);
  }

  // ── ROTA 2: smart seed selection via topsearch + followers ───────────────
  // Ativa quando hashtag retornou menos da meta (bloqueada ou parcialmente bloqueada)
  if (allUsernames.size < limit) {
    const reason = allUsernames.size === 0
      ? 'Hashtags bloqueadas'
      : `Hashtags insuficientes (${allUsernames.size}/${limit} meta)`;
    console.log(`${C.yellow}[SCRAPER] ${reason} — ativando Smart Seed + Followers...${C.reset}`);

    // 2a. Topsearch multi-query para candidatos a seed
    const { browser: bSearch, context: ctxSearch } = await launchBrowser(true);
    const seedCandidates = new Set();
    try {
      // Limpa nome do nicho antes de fragmentar (remove (, ), /, \ e artigos curtos)
      const stopWords = new Set(['de','do','da','dos','das','em','no','na','nos','nas','e','o','a']);
      const words = nichoConfig.nome
        .replace(/[()\/\\|]/g, ' ')   // remove parênteses, barras, pipes
        .replace(/[^a-zA-ZÀ-ú0-9\s#]/g, '') // remove outros especiais
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
      const queries = [...new Set([nichoConfig.nome, ...hashtags.slice(0,2), ...words])].slice(0, 6);
      for (const q of queries) {
        const results = await topsearchQuery(ctxSearch, q);
        results.forEach(u => seedCandidates.add(u.toLowerCase()));
        if (results.length > 0)
          console.log(`  topsearch "${q}": +${results.length} candidatos`);
        await sleep(700);
      }
    } finally {
      await bSearch.close();
    }

    if (seedCandidates.size === 0) {
      console.log(`${C.yellow}[SCRAPER] Topsearch sem resultados.${C.reset}`);
    } else {
      console.log(`${C.cyan}[SCRAPER] ${seedCandidates.size} candidatos a seed — enriquecendo perfis...${C.reset}`);

      // 2b. Enriquecer candidatos (para ter user_id + dados para score)
      const candidateProfiles = await scrapeProfiles(Array.from(seedCandidates));

      // 2c. Pontuar e selecionar melhores seeds
      const scored = candidateProfiles
        .map(p => ({ ...p, _score: scoreSeedAccount(p) }))
        .sort((a, b) => b._score - a._score);

      const topSeeds = scored.filter(p => p._score >= 20 && p.user_id && !p.isPrivate).slice(0, 2);

      if (topSeeds.length === 0) {
        // Seeds com score baixo: usa todos os candidatos como leads diretos
        console.log(`${C.yellow}[SCRAPER] Seeds com score baixo — usando candidatos diretamente como leads.${C.reset}`);
        candidateProfiles.forEach(p => allUsernames.add(p.username));
      } else {
        console.log(`${C.green}[SCRAPER] Top seeds selecionados:${C.reset}`);
        topSeeds.forEach(s => console.log(`  @${s.username} | score=${s._score} | followers=${s.followers.toLocaleString()}`));

        // 2d. Scrapa seguidores de cada seed
        for (const seed of topSeeds) {
          const perSeed = Math.ceil((limit * 1.5) / topSeeds.length);
          const followers = await scrapeFollowers(seed.user_id, perSeed);
          followers.forEach(u => allUsernames.add(u));
          if (allUsernames.size >= limit * 2) break;
          await sleepRandom(3000, 6000);
        }
        console.log(`${C.cyan}[SCRAPER] Total de leads via followers: ${allUsernames.size}${C.reset}`);
      }
    }
  }

  // ── ROTA 3: seed accounts manuais configurados no nicho ──────────────────
  if (allUsernames.size < limit && seedAccounts.length > 0) {
    console.log(`${C.yellow}[SCRAPER] Usando seed accounts manuais do nicho...${C.reset}`);
    // Enriquece seeds manuais para pegar user_id
    const manualProfiles = await scrapeProfiles(seedAccounts.map(u => u.replace('@','')));
    const validSeeds = manualProfiles.filter(p => p.user_id && !p.isPrivate);
    for (const seed of validSeeds.slice(0, 2)) {
      const followers = await scrapeFollowers(seed.user_id, Math.ceil(limit * 1.5));
      followers.forEach(u => allUsernames.add(u));
      if (allUsernames.size >= limit * 2) break;
      await sleepRandom(3000, 6000);
    }
    // Se ainda sem resultado: usa os seeds como leads diretos
    if (allUsernames.size === 0)
      seedAccounts.forEach(u => allUsernames.add(u.replace('@','').toLowerCase()));
  }

  console.log(`${C.cyan}[SCRAPER] Total únicos coletados: ${allUsernames.size}${C.reset}`);

  const list = Array.from(allUsernames).slice(0, Math.min(limit * 2, 100));
  const profiles = await scrapeProfiles(list);

  // ── FILTRO 1: qualidade mínima (remove perfis fantasma) ──────────────────
  // Rejeita conta com TODOS: bio vazia + followers < 100 + posts < 3
  // Mantém qualquer conta com ao menos um sinal de atividade real
  const qualityFiltered = profiles.filter(p => {
    const hasBio      = p.bio && p.bio.trim().length >= 8;
    const hasFollowers = (p.followers || 0) >= 100;
    const hasPosts    = (p.posts    || 0) >= 3;
    if (!hasBio && !hasFollowers && !hasPosts) {
      console.log(`  ${C.yellow}⚠ @${p.username} — perfil fantasma, ignorado${C.reset}`);
      return false;
    }
    return true;
  });
  if (qualityFiltered.length < profiles.length) {
    console.log(`${C.yellow}[SCRAPER] Qualidade: ${profiles.length - qualityFiltered.length} perfis fantasma removidos${C.reset}`);
  }

  // ── FILTRO 2: relevância de nicho (bio + username + fullName) ────────────
  // Checa os 3 campos para não perder accounts como @projetosdeautomacao
  // Perfis sem bio passam para o analyzer decidir
  const keywords = (nichoConfig.keywords_bio||[]).map(k => k.toLowerCase());
  const filtered = qualityFiltered.filter(p => {
    if (keywords.length === 0) return true;
    if (!p.bio && !p.fullName) return true;  // sem texto → passa para analyzer
    const haystack = [
      (p.bio      || '').toLowerCase(),
      (p.username || '').toLowerCase(),
      (p.fullName || '').toLowerCase(),
    ].join(' ');
    return keywords.some(k => haystack.includes(k));
  });

  // Fallback: se filtro removeu tudo (niche muito restrito), usa qualityFiltered diretamente
  const finalFiltered = filtered.length > 0 ? filtered : qualityFiltered;
  if (filtered.length === 0 && qualityFiltered.length > 0) {
    console.log(`${C.yellow}[SCRAPER] Bio/nicho sem match — usando todos os ${qualityFiltered.length} leads (analyzer vai filtrar)${C.reset}`);
  } else {
    console.log(`${C.green}[SCRAPER] Filtrados por nicho: ${filtered.length}/${qualityFiltered.length} (${profiles.length} total)${C.reset}`);
  }
  return finalFiltered.slice(0, limit);
}

// ---- MAIN CLI ----
if (require.main === module) {
  const [,, cmd, arg1, arg2] = process.argv;

  if (!cmd || cmd === 'help') {
    console.log(`\n${C.cyan}SCRAPER - Instagram sem Apify${C.reset}`);
    console.log('  login                     Login automático (.env)');
    console.log('  login --manual            Login manual (navegador)');
    console.log('  diag                      Diagnóstico completo');
    console.log('  hashtag <tag> [limite]    Scrape por hashtag');
    console.log('  search <query> [limite]   Busca por palavra-chave (fallback)');
    console.log('  profile <user>            Scrape de perfil');
    console.log('  profiles <u1,u2,...>      Scrape múltiplos perfis');
    console.log('  followers <user_id> [n]   Scrape seguidores pelo user_id numérico');
    console.log('  score <user>              Pontua perfil como seed account (0-100)');
    console.log('  test                      Teste rápido');
    console.log('  rotate-key                Rotacionar chave\n');
    process.exit(0);
  }

  (async () => {
    try {
      if      (cmd === 'login')      { if (arg1==='--manual') await doManualLogin(); else await doAutoLogin(); }
      else if (cmd === 'diag')       { await runDiag(); }
      else if (cmd === 'rotate-key') { const k = security.rotateKey(SESSION_DIR); console.log(`\nSESSION_ENCRYPTION_KEY=${k}\n`); }
      else if (cmd === 'hashtag')    {
        const r = await scrapeHashtag(arg1||'makecom', parseInt(arg2||'20'));
        console.log('\nUsernames:'); r.forEach((u,i) => console.log(`  ${i+1}. @${u}`));
      }
      else if (cmd === 'search')     {
        const r = await scrapeBySearch(arg1||'automacao', parseInt(arg2||'20'));
        console.log('\nUsernames:'); r.forEach((u,i) => console.log(`  ${i+1}. @${u}`));
      }
      else if (cmd === 'profile')    {
        const p = await scrapeProfile(arg1||'instagram');
        console.log('\nPerfil:'); console.log(JSON.stringify(p, null, 2));
      }
      else if (cmd === 'profiles')   {
        const ps = await scrapeProfiles((arg1||'').split(',').filter(Boolean));
        console.log(JSON.stringify(ps, null, 2));
      }
      else if (cmd === 'followers')  {
        const uid = arg1;
        const n   = parseInt(arg2||'50');
        if (!uid) { console.log('Uso: node 0-scraper.js followers <user_id> [limite]'); process.exit(1); }
        const r = await scrapeFollowers(uid, n);
        console.log('\nSeguidores:'); r.forEach((u,i) => console.log(`  ${i+1}. @${u}`));
      }
      else if (cmd === 'score')      {
        const p = await scrapeProfile(arg1||'instagram');
        const s = scoreSeedAccount(p);
        console.log(`\n@${p.username} — Score seed: ${s}/100`);
        console.log(`  Followers: ${p.followers.toLocaleString()} | Posts: ${p.posts} | Privado: ${p.isPrivate}`);
        console.log(`  Bio: ${p.bio.slice(0,80)}`);
      }
      else if (cmd === 'test') {
        const p = await scrapeProfile('instagram');
        if (p.followers > 0) console.log(`${C.green}✅ OK! @instagram: ${p.followers.toLocaleString()} followers${C.reset}`);
        else console.log(`${C.yellow}⚠️  Sem dados. Rode: node 0-scraper.js diag${C.reset}`);
      }
    } catch(e) {
      console.error(`${C.red}[SCRAPER] Erro: ${e.message}${C.reset}`);
      process.exit(1);
    }
  })();
}

module.exports = { scrapeHashtag, scrapeBySearch, scrapeProfile, scrapeProfiles, scrapeNicho, scrapeFollowers, scoreSeedAccount };