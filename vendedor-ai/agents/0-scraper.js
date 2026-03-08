// =============================================================
// MODULO 0: SCRAPER - INSTAGRAM SCRAPER PROPRIO (SEM APIFY)
// Usa Playwright com Chromium headless para raspar Instagram
// Substitui totalmente o Apify — roda na VPS 24/7
// 
// 🔒 SEGURANÇA: Sessões protegidas com AES-256-GCM
//
// Uso:
//   node 0-scraper.js hashtag makecom 50
//   node 0-scraper.js profile n8nautomation
//   node 0-scraper.js hashtags api-automacao 30
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

const C = {
  reset:'\x1b[0m', bright:'\x1b[1m', green:'\x1b[32m',
  yellow:'\x1b[33m', red:'\x1b[31m', cyan:'\x1b[36m', magenta:'\x1b[35m'
};

// ---- Rate limit seguro ----
// 1-2 requests por segundo = ~3.600/hora = seguro para nao banir
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleepRandom = async (minMs = 1500, maxMs = 3500) => sleep(rand(minMs, maxMs));

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

async function launchBrowser(headless = true) {
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  // 🔒 Carregar sessao CRIPTOGRAFADA
  const cookies = security.loadEncrypted(SESSION_FILE);
  if (cookies) {
    try {
      await context.addCookies(cookies);
      console.log(`${C.green}[SCRAPER] 🔒 Sessão criptografada carregada${C.reset}`);
    } catch (e) {
      console.log(`${C.yellow}[SCRAPER] Sessão inválida, será necessário novo login${C.reset}`);
    }
  }

  return { browser, context };
}

async function saveSession(context) {
  const cookies = await context.cookies();
  
  // 🔒 Salvar sessao CRIPTOGRAFADA
  security.saveEncrypted(SESSION_FILE, cookies);
  
  console.log(`${C.green}[SCRAPER] 🔒 Sessão criptografada e salva${C.reset}`);
  console.log(`${C.dim}    Arquivo: ${SESSION_FILE}${C.reset}`);
  console.log(`${C.dim}    Algoritmo: AES-256-GCM${C.reset}`);
}

// ---- LOGIN MANUAL ----
// Roda com headless=false para o usuario logar manualmente
async function doLogin() {
  console.log(`\n${C.cyan}[SCRAPER] Abrindo navegador para login manual...${C.reset}`);
  console.log(`${C.yellow}1. Faça login no Instagram que aparecer${C.reset}`);
  console.log(`${C.yellow}2. Depois de logado, pressione ENTER aqui${C.reset}\n`);

  const { browser, context } = await launchBrowser(false);
  const page = await context.newPage();
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle' });

  // Aguardar usuario fazer login
  await new Promise(resolve => {
    process.stdin.resume();
    process.stdin.once('data', resolve);
  });

  await saveSession(context);
  await browser.close();
  
  console.log(`\n${C.green}✅ Login salvo com sucesso!${C.reset}`);
  console.log(`${C.green}🔒 Sessão protegida com criptografia AES-256${C.reset}`);
  console.log(`${C.cyan}⏱️  Validade: ~30 dias${C.reset}`);
  console.log(`${C.dim}   Próximas execuções serão automáticas.${C.reset}\n`);
}

// ---- SCRAPER DE HASHTAG (publico, sem login) ----
async function scrapeHashtag(hashtag, limit = 50) {
  const tag = hashtag.replace('#', '').toLowerCase();
  console.log(`\n${C.cyan}[SCRAPER] Hashtag: #${tag} | Meta: ${limit} perfis${C.reset}`);

  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();

  // Bloquear imagens e videos para ser mais rapido
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,mov}', r => r.abort());

  const usernames = new Set();

  try {
    // Tentar via API grafica do Instagram (mais rapido)
    const apiUrl = `https://www.instagram.com/api/v1/tags/web_info/?tag_name=${tag}`;
    const response = await page.request.get(apiUrl, {
      headers: {
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.instagram.com/explore/tags/${tag}/`,
      }
    });

    if (response.ok()) {
      const data = await response.json();
      const media = data?.data?.recent?.sections || [];
      for (const section of media) {
        for (const layout of (section.layout_content?.medias || [])) {
          const username = layout.media?.user?.username;
          if (username) usernames.add(username.toLowerCase());
        }
        if (usernames.size >= limit) break;
      }
      console.log(`${C.green}[SCRAPER] API: ${usernames.size} usernames${C.reset}`);
    }

    // Fallback: scraping da pagina
    if (usernames.size < 10) {
      await page.goto(`https://www.instagram.com/explore/tags/${tag}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await sleep(3000);

      // Extrair usernames dos links de posts
      const links = await page.$$eval('a[href*="/p/"]', els =>
        els.map(el => {
          const img = el.querySelector('img');
          return img?.alt || '';
        }).filter(Boolean)
      );

      // Extrair usernames dos alts das imagens (formato: "Foto de @username")
      for (const alt of links) {
        const match = alt.match(/@([a-zA-Z0-9._]+)/);
        if (match) usernames.add(match[1].toLowerCase());
        if (usernames.size >= limit) break;
      }

      // Scroll para mais resultados
      let lastCount = 0;
      let scrolls = 0;
      while (usernames.size < limit && scrolls < 10) {
        await page.evaluate(() => window.scrollBy(0, 1500));
        await sleep(2000);
        const newLinks = await page.$$eval('a[href*="/p/"]', els =>
          els.map(el => el.querySelector('img')?.alt || '').filter(Boolean)
        );
        for (const alt of newLinks) {
          const match = alt.match(/@([a-zA-Z0-9._]+)/);
          if (match) usernames.add(match[1].toLowerCase());
        }
        if (usernames.size === lastCount) break;
        lastCount = usernames.size;
        scrolls++;
      }
    }
  } catch (e) {
    console.error(`${C.red}[SCRAPER] Erro hashtag ${tag}: ${e.message}${C.reset}`);
  } finally {
    await browser.close();
  }

  const result = Array.from(usernames).slice(0, limit);
  console.log(`${C.green}[SCRAPER] Coletados: ${result.length} usernames de #${tag}${C.reset}`);
  return result;
}

// ---- SCRAPER DE PERFIL ----
async function scrapeProfile(username) {
  username = username.replace('@', '').toLowerCase();
  console.log(`${C.cyan}[SCRAPER] Perfil: @${username}${C.reset}`);

  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,mov}', r => r.abort());

  let profile = { username, bio: '', followers: 0, posts: 0, following: 0 };

  try {
    // Tentar via API primeiro
    const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    const response = await page.request.get(apiUrl, {
      headers: {
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.instagram.com/${username}/`
      }
    });

    if (response.ok()) {
      const data = await response.json();
      const user = data?.data?.user;
      if (user) {
        profile = {
          username,
          bio:       user.biography || '',
          followers: user.edge_followed_by?.count || 0,
          following: user.edge_follow?.count || 0,
          posts:     user.edge_owner_to_timeline_media?.count || 0,
          fullName:  user.full_name || '',
          isPrivate: user.is_private || false,
          isVerified: user.is_verified || false,
          externalUrl: user.external_url || ''
        };
      }
    }

    // Fallback: scraping da pagina
    if (!profile.bio && profile.followers === 0) {
      await page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await sleep(2000);

      // Extrair via JSON embedado na pagina
      const scriptContent = await page.$eval(
        'script[type="application/ld+json"]',
        el => el.textContent
      ).catch(() => null);

      if (scriptContent) {
        const ldJson = JSON.parse(scriptContent);
        profile.bio = ldJson.description || '';
      }

      // Extrair contadores via meta tags
      const desc = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
      const followersMatch = desc.match(/([\d,.]+)\s*Followers/);
      if (followersMatch) {
        profile.followers = parseInt(followersMatch[1].replace(/[,.]/, '')) || 0;
      }
    }

  } catch (e) {
    console.error(`${C.yellow}[SCRAPER] Aviso @${username}: ${e.message}${C.reset}`);
  } finally {
    await browser.close();
  }

  return profile;
}

// ---- SCRAPER DE MULTIPLOS PERFIS (otimizado - 1 browser) ----
async function scrapeProfiles(usernames) {
  console.log(`\n${C.cyan}[SCRAPER] Enriquecendo ${usernames.length} perfis...${C.reset}`);

  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,mov}', r => r.abort());

  const profiles = [];
  let success = 0;
  let fail = 0;

  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i].replace('@', '').toLowerCase();
    process.stdout.write(`  [${i+1}/${usernames.length}] @${username}... `);

    try {
      const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
      const response = await page.request.get(apiUrl, {
        headers: {
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `https://www.instagram.com/${username}/`
        }
      });

      if (response.ok()) {
        const data = await response.json();
        const user = data?.data?.user;
        if (user) {
          profiles.push({
            username,
            bio:       user.biography || '',
            followers: user.edge_followed_by?.count || 0,
            following: user.edge_follow?.count || 0,
            posts:     user.edge_owner_to_timeline_media?.count || 0,
            fullName:  user.full_name || '',
            isPrivate: user.is_private || false,
            externalUrl: user.external_url || ''
          });
          success++;
          process.stdout.write(`${C.green}OK (${user.edge_followed_by?.count || 0} followers)${C.reset}\n`);
        } else {
          profiles.push({ username, bio:'', followers:0, posts:0 });
          fail++;
          process.stdout.write(`${C.yellow}vazio${C.reset}\n`);
        }
      } else if (response.status() === 429) {
        // Rate limit atingido - esperar mais
        console.log(`\n${C.red}[SCRAPER] Rate limit! Aguardando 60s...${C.reset}`);
        await sleep(60000);
        profiles.push({ username, bio:'', followers:0, posts:0 });
        fail++;
        process.stdout.write(`${C.red}rate-limit${C.reset}\n`);
      } else {
        profiles.push({ username, bio:'', followers:0, posts:0 });
        fail++;
        process.stdout.write(`${C.red}${response.status()}${C.reset}\n`);
      }
    } catch (e) {
      profiles.push({ username, bio:'', followers:0, posts:0 });
      fail++;
      process.stdout.write(`${C.red}erro${C.reset}\n`);
    }

    // Rate limit seguro: 1.5-3.5s entre requests
    if (i < usernames.length - 1) await sleepRandom(1500, 3500);
  }

  await browser.close();
  console.log(`${C.green}[SCRAPER] Perfis: ${success} ok | ${fail} falhas${C.reset}`);
  return profiles;
}

// ---- SCRAPER COMPLETO POR NICHO (substitui Apify) ----
async function scrapeNicho(nichoConfig, limit = 30) {
  const hashtags = nichoConfig.hashtags.slice(0, 4);
  console.log(`\n${C.magenta}${'='.repeat(60)}${C.reset}`);
  console.log(`${C.bright}  SCRAPER: ${nichoConfig.nome}${C.reset}`);
  console.log(`  Hashtags: ${hashtags.join(', ')}`);
  console.log(`  Meta: ${limit} leads`);
  console.log(`${C.magenta}${'='.repeat(60)}${C.reset}\n`);

  const allUsernames = new Set();

  // Raspar cada hashtag
  for (const hashtag of hashtags) {
    if (allUsernames.size >= limit * 2) break;
    const usernames = await scrapeHashtag(hashtag, Math.ceil(limit / hashtags.length) + 10);
    usernames.forEach(u => allUsernames.add(u));
    await sleepRandom(3000, 6000); // Pausa entre hashtags
  }

  console.log(`${C.cyan}[SCRAPER] Total usernames unicos: ${allUsernames.size}${C.reset}`);

  // Enriquecer perfis
  const usernames = Array.from(allUsernames).slice(0, Math.min(limit * 2, 60));
  const profiles = await scrapeProfiles(usernames);

  // Filtrar por keywords da bio
  const keywords = (nichoConfig.keywords_bio || []).map(k => k.toLowerCase());
  const filtered = profiles.filter(p => {
    if (!p.bio) return true; // sem bio, incluir mesmo assim
    const bioLower = p.bio.toLowerCase();
    return keywords.length === 0 || keywords.some(k => bioLower.includes(k));
  });

  console.log(`${C.green}[SCRAPER] Filtrados por keywords: ${filtered.length}/${profiles.length}${C.reset}`);

  return filtered.slice(0, limit);
}

// ---- MAIN CLI ----
if (require.main === module) {
  const [,, cmd, arg1, arg2] = process.argv;

  if (!cmd || cmd === 'help') {
    console.log(`\n${C.cyan}SCRAPER - Instagram sem Apify${C.reset}`);
    console.log(`${C.dim}🔒 Sessões protegidas com AES-256-GCM${C.reset}\n`);
    console.log('Comandos:');
    console.log('  node 0-scraper.js login                     - Login no Instagram (1x)');
    console.log('  node 0-scraper.js hashtag makecom 50        - Scrape por hashtag');
    console.log('  node 0-scraper.js profile n8nautomation     - Scrape perfil');
    console.log('  node 0-scraper.js profiles user1,user2,...  - Scrape multiplos perfis');
    console.log('  node 0-scraper.js test                      - Teste de conectividade');
    console.log('  node 0-scraper.js rotate-key                - Rotacionar chave de criptografia\n');
    process.exit(0);
  }

  (async () => {
    try {
      if (cmd === 'login') {
        await doLogin();
      } else if (cmd === 'rotate-key') {
        console.log(`\n${C.yellow}🔄 ROTACIONAR CHAVE DE CRIPTOGRAFIA${C.reset}\n`);
        const newKey = security.rotateKey(SESSION_DIR);
        console.log(`\n${C.bright}Adicione ao .env:${C.reset}`);
        console.log(`SESSION_ENCRYPTION_KEY=${newKey}\n`);
      } else if (cmd === 'hashtag') {
        const results = await scrapeHashtag(arg1 || 'makecom', parseInt(arg2 || '20'));
        console.log('\nUsernames encontrados:');
        results.forEach((u, i) => console.log(`  ${i+1}. @${u}`));
      } else if (cmd === 'profile') {
        const profile = await scrapeProfile(arg1 || 'instagram');
        console.log('\nPerfil:');
        console.log(JSON.stringify(profile, null, 2));
      } else if (cmd === 'profiles') {
        const usernames = (arg1 || '').split(',').filter(Boolean);
        const profiles = await scrapeProfiles(usernames);
        console.log('\nPerfis:');
        console.log(JSON.stringify(profiles, null, 2));
      } else if (cmd === 'test') {
        console.log(`${C.cyan}[SCRAPER] Testando conectividade...${C.reset}`);
        const profile = await scrapeProfile('instagram');
        if (profile.followers > 0) {
          console.log(`${C.green}[SCRAPER] OK! @instagram: ${profile.followers} followers${C.reset}`);
        } else {
          console.log(`${C.yellow}[SCRAPER] Conectou mas nao obteve dados. Tente fazer login.${C.reset}`);
        }
      }
    } catch (e) {
      console.error(`${C.red}[SCRAPER] Erro: ${e.message}${C.reset}`);
      process.exit(1);
    }
  })();
}

module.exports = { scrapeHashtag, scrapeProfile, scrapeProfiles, scrapeNicho };
