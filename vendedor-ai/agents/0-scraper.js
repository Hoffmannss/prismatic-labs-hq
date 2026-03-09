// =============================================================
// MODULO 0: SCRAPER - INSTAGRAM SCRAPER PROPRIO (SEM APIFY)
// Usa Playwright com Chromium headless para raspar Instagram
// Substitui totalmente o Apify — roda na VPS 24/7
//
// 🔒 SEGURANÇA: Sessões protegidas com AES-256-GCM
//
// FIXES:
//   - Usa context.request.get() para passar cookies corretamente
//   - Múltiplos endpoints com fallback automático
//   - Scraping visual com sessão autenticada como último recurso
//   - Diagnóstico detalhado em modo debug
//
// Uso:
//   node 0-scraper.js login              - Login automático (usa .env)
//   node 0-scraper.js login --manual     - Login manual (navegador)
//   node 0-scraper.js hashtag makecom 50
//   node 0-scraper.js profile n8nautomation
//   node 0-scraper.js diag               - Diagnóstico completo
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
const sleepRandom = async (minMs = 1500, maxMs = 3500) => {
  await sleep(rand(Math.floor(minMs * DELAY_MULT), Math.floor(maxMs * DELAY_MULT)));
};

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

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

  // 🔒 Carregar sessão CRIPTOGRAFADA
  const cookies = security.loadEncrypted(SESSION_FILE);
  if (cookies && cookies.length > 0) {
    try {
      await context.addCookies(cookies);
      const sessionCookie = cookies.find(c => c.name === 'sessionid');
      if (sessionCookie) {
        console.log(`${C.green}[SCRAPER] 🔒 Sessão carregada (sessionid: ${sessionCookie.value.slice(0,8)}...)${C.reset}`);
      } else {
        console.log(`${C.yellow}[SCRAPER] ⚠️  Sessão carregada mas sem sessionid!${C.reset}`);
      }
    } catch (e) {
      console.log(`${C.yellow}[SCRAPER] Sessão inválida: ${e.message}${C.reset}`);
    }
  } else {
    console.log(`${C.yellow}[SCRAPER] ⚠️  Nenhuma sessão encontrada — rodando sem login${C.reset}`);
  }

  return { browser, context };
}

async function saveSession(context) {
  const cookies = await context.cookies();
  security.saveEncrypted(SESSION_FILE, cookies);
  console.log(`${C.green}[SCRAPER] 🔒 Sessão criptografada e salva (${cookies.length} cookies)${C.reset}`);
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
      console.log(`${C.yellow}[SCRAPER] ⚠️  Instagram pediu verificação — use login --manual${C.reset}`);
      await browser.close();
      process.exit(1);
    }

    await saveSession(context);
    console.log(`${C.green}✅ Login automático OK!${C.reset}\n`);
  } catch (e) {
    console.error(`${C.red}[SCRAPER] Erro no login: ${e.message}${C.reset}`);
    console.log(`${C.yellow}Tente: node 0-scraper.js login --manual${C.reset}`);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
}

// ---- LOGIN MANUAL ----
async function doManualLogin() {
  console.log(`\n${C.cyan}[SCRAPER] Abrindo navegador para login manual...${C.reset}`);
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

// ---- DIAGNÓSTICO COMPLETO ----
async function runDiag() {
  console.log(`\n${C.magenta}===== DIAGNÓSTICO DO SCRAPER =====${C.reset}\n`);

  // 1. Verificar arquivo de sessão
  console.log(`${C.cyan}1. Verificando sessão...${C.reset}`);
  const cookies = security.loadEncrypted(SESSION_FILE);
  if (!cookies) {
    console.log(`   ${C.red}❌ Sem sessão salva${C.reset}`);
  } else {
    const sessionid = cookies.find(c => c.name === 'sessionid');
    const csrftoken = cookies.find(c => c.name === 'csrftoken');
    console.log(`   Total de cookies: ${cookies.length}`);
    console.log(`   sessionid: ${sessionid ? C.green+'✅ presente'+C.reset : C.red+'❌ ausente'+C.reset}`);
    console.log(`   csrftoken: ${csrftoken ? C.green+'✅ presente'+C.reset : C.red+'❌ ausente'+C.reset}`);
    if (sessionid) {
      const exp = new Date(sessionid.expires * 1000);
      console.log(`   Expiração: ${exp.toLocaleDateString('pt-BR')} ${exp > new Date() ? C.green+'(válido)'+C.reset : C.red+'(EXPIRADO)'+C.reset}`);
    }
  }

  // 2. Testar conectividade
  console.log(`\n${C.cyan}2. Testando conectividade com Instagram...${C.reset}`);
  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();

  // 3. Testar endpoint de perfil
  console.log(`\n${C.cyan}3. Testando endpoint de perfil (@instagram)...${C.reset}`);
  const endpoints = [
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=instagram`,
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=instagram`,
  ];

  for (const url of endpoints) {
    try {
      const resp = await context.request.get(url, {
        headers: {
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.instagram.com/instagram/'
        }
      });
      const status = resp.status();
      let detail = '';
      if (resp.ok()) {
        const data = await resp.json();
        const followers = data?.data?.user?.edge_followed_by?.count;
        detail = followers ? `${C.green}✅ OK — followers: ${followers}${C.reset}` : `${C.yellow}⚠️  JSON vazio${C.reset}`;
      } else {
        const text = await resp.text().catch(() => '');
        detail = `${C.red}❌ HTTP ${status} — ${text.slice(0,80)}${C.reset}`;
      }
      console.log(`   ${url.includes('i.insta') ? 'i.instagram' : 'www.instagram'}: ${detail}`);
    } catch (e) {
      console.log(`   ${C.red}❌ Erro: ${e.message}${C.reset}`);
    }
  }

  // 4. Testar endpoint de hashtag
  console.log(`\n${C.cyan}4. Testando endpoint de hashtag (#brasil)...${C.reset}`);
  try {
    const resp = await context.request.get(
      'https://www.instagram.com/api/v1/tags/web_info/?tag_name=brasil',
      {
        headers: {
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www.instagram.com/explore/tags/brasil/'
        }
      }
    );
    const status = resp.status();
    if (resp.ok()) {
      const data = await resp.json();
      const sections = data?.data?.recent?.sections || [];
      let count = 0;
      for (const s of sections) for (const m of (s.layout_content?.medias || [])) if (m.media?.user?.username) count++;
      console.log(`   HTTP ${status}: ${count > 0 ? C.green+'✅ '+count+' usernames'+C.reset : C.yellow+'⚠️  0 usernames (bloqueado ou vazio)'+C.reset}`);
    } else {
      console.log(`   ${C.red}❌ HTTP ${status}${C.reset}`);
    }
  } catch (e) {
    console.log(`   ${C.red}❌ Erro: ${e.message}${C.reset}`);
  }

  // 5. Testar scraping visual
  console.log(`\n${C.cyan}5. Testando scraping visual de perfil (@instagram)...${C.reset}`);
  try {
    await page.goto('https://www.instagram.com/instagram/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    const url = page.url();
    if (url.includes('login')) {
      console.log(`   ${C.red}❌ Redirecionou para login — sessão não reconhecida${C.reset}`);
    } else {
      const desc = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
      console.log(`   URL final: ${url}`);
      console.log(`   Meta desc: ${desc.slice(0,80) || '(vazia)'}`);
      console.log(`   ${desc.includes('Followers') || desc.includes('follower') ? C.green+'✅ Sessão válida!' : C.yellow+'⚠️  Conectou mas sem dados de seguidores'}${C.reset}`);
    }
  } catch (e) {
    console.log(`   ${C.red}❌ Erro: ${e.message}${C.reset}`);
  }

  await browser.close();
  console.log(`\n${C.magenta}===== FIM DO DIAGNÓSTICO =====${C.reset}\n`);
}

// ---- SCRAPER DE HASHTAG ----
async function scrapeHashtag(hashtag, limit = 50) {
  const tag = hashtag.replace('#', '').toLowerCase();
  console.log(`\n${C.cyan}[SCRAPER] Hashtag: #${tag} | Meta: ${limit} perfis${C.reset}`);

  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,mov}', r => r.abort());

  const usernames = new Set();

  try {
    // Endpoint principal — usa context.request (passa cookies!)
    const apiUrl = `https://www.instagram.com/api/v1/tags/web_info/?tag_name=${tag}`;
    const response = await context.request.get(apiUrl, {
      headers: {
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.instagram.com/explore/tags/${tag}/`
      }
    });

    console.log(`${C.dim}[SCRAPER] API hashtag: HTTP ${response.status()}${C.reset}`);

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

    // Fallback: scraping visual autenticado
    if (usernames.size < 5) {
      console.log(`${C.yellow}[SCRAPER] API retornou poucos dados, tentando scraping visual...${C.reset}`);
      await page.goto(`https://www.instagram.com/explore/tags/${tag}/`, {
        waitUntil: 'domcontentloaded', timeout: 30000
      });
      await sleep(3000);

      // Verificar se está logado
      const currentUrl = page.url();
      if (currentUrl.includes('login')) {
        console.log(`${C.red}[SCRAPER] Sessão expirada — refaça o login${C.reset}`);
      } else {
        // Interceptar requests da API enquanto navega
        const captured = new Set();
        page.on('response', async resp => {
          if (resp.url().includes('/api/v1/tags/') || resp.url().includes('explore/tags')) {
            try {
              const json = await resp.json().catch(() => null);
              if (json?.data?.recent?.sections) {
                for (const s of json.data.recent.sections)
                  for (const m of (s.layout_content?.medias || []))
                    if (m.media?.user?.username) captured.add(m.media.user.username.toLowerCase());
              }
            } catch (_) {}
          }
        });

        // Scroll para disparar requisições
        for (let i = 0; i < 5 && usernames.size + captured.size < limit; i++) {
          await page.evaluate(() => window.scrollBy(0, 2000));
          await sleep(2000);
        }

        captured.forEach(u => usernames.add(u));

        // Último recurso: extrair dos alts das imagens
        if (usernames.size < 5) {
          const links = await page.$$eval('a[href*="/p/"] img', imgs =>
            imgs.map(img => img.alt || '').filter(Boolean)
          );
          for (const alt of links) {
            const match = alt.match(/@([a-zA-Z0-9._]+)/);
            if (match) usernames.add(match[1].toLowerCase());
            if (usernames.size >= limit) break;
          }
        }
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
    // Usa context.request para passar cookies
    const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    const response = await context.request.get(apiUrl, {
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
          bio:        user.biography || '',
          followers:  user.edge_followed_by?.count || 0,
          following:  user.edge_follow?.count || 0,
          posts:      user.edge_owner_to_timeline_media?.count || 0,
          fullName:   user.full_name || '',
          isPrivate:  user.is_private || false,
          isVerified: user.is_verified || false,
          externalUrl: user.external_url || ''
        };
      }
    }

    // Fallback: scraping visual
    if (!profile.bio && profile.followers === 0) {
      await page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: 'domcontentloaded', timeout: 30000
      });
      await sleep(2000);

      const scriptContent = await page.$eval(
        'script[type="application/ld+json"]', el => el.textContent
      ).catch(() => null);

      if (scriptContent) {
        const ldJson = JSON.parse(scriptContent);
        profile.bio = ldJson.description || '';
      }

      const desc = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
      const followersMatch = desc.match(/([\d,.]+)\s*[Ff]ollowers/);
      if (followersMatch) profile.followers = parseInt(followersMatch[1].replace(/[,.]/g, '')) || 0;
    }

  } catch (e) {
    console.error(`${C.yellow}[SCRAPER] Aviso @${username}: ${e.message}${C.reset}`);
  } finally {
    await browser.close();
  }

  return profile;
}

// ---- SCRAPER DE MÚLTIPLOS PERFIS ----
async function scrapeProfiles(usernames) {
  console.log(`\n${C.cyan}[SCRAPER] Enriquecendo ${usernames.length} perfis...${C.reset}`);

  const { browser, context } = await launchBrowser(true);
  const page = await context.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,mov}', r => r.abort());

  const profiles = [];
  let success = 0, fail = 0;

  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i].replace('@', '').toLowerCase();
    process.stdout.write(`  [${i+1}/${usernames.length}] @${username}... `);

    try {
      const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
      // USA context.request PARA PASSAR COOKIES DA SESSÃO
      const response = await context.request.get(apiUrl, {
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
            bio:        user.biography || '',
            followers:  user.edge_followed_by?.count || 0,
            following:  user.edge_follow?.count || 0,
            posts:      user.edge_owner_to_timeline_media?.count || 0,
            fullName:   user.full_name || '',
            isPrivate:  user.is_private || false,
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
        const waitTime = Math.floor(60000 * DELAY_MULT);
        console.log(`\n${C.red}[SCRAPER] Rate limit! Aguardando ${waitTime/1000}s...${C.reset}`);
        await sleep(waitTime);
        profiles.push({ username, bio:'', followers:0, posts:0 });
        fail++;
        process.stdout.write(`${C.red}rate-limit${C.reset}\n`);
      } else {
        profiles.push({ username, bio:'', followers:0, posts:0 });
        fail++;
        process.stdout.write(`${C.red}HTTP ${response.status()}${C.reset}\n`);
      }
    } catch (e) {
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

// ---- SCRAPER COMPLETO POR NICHO ----
async function scrapeNicho(nichoConfig, limit = 30) {
  const hashtags = nichoConfig.hashtags.slice(0, 4);
  console.log(`\n${C.magenta}${'='.repeat(60)}${C.reset}`);
  console.log(`${C.bright}  SCRAPER: ${nichoConfig.nome}${C.reset}`);
  console.log(`  Hashtags: ${hashtags.join(', ')} | Meta: ${limit} leads`);
  console.log(`${C.magenta}${'='.repeat(60)}${C.reset}\n`);

  const allUsernames = new Set();
  for (const hashtag of hashtags) {
    if (allUsernames.size >= limit * 2) break;
    const usernames = await scrapeHashtag(hashtag, Math.ceil(limit / hashtags.length) + 10);
    usernames.forEach(u => allUsernames.add(u));
    await sleepRandom(3000, 6000);
  }

  console.log(`${C.cyan}[SCRAPER] Total usernames únicos: ${allUsernames.size}${C.reset}`);

  const usernames = Array.from(allUsernames).slice(0, Math.min(limit * 2, 60));
  const profiles = await scrapeProfiles(usernames);

  const keywords = (nichoConfig.keywords_bio || []).map(k => k.toLowerCase());
  const filtered = profiles.filter(p => {
    if (!p.bio) return true;
    const bioLower = p.bio.toLowerCase();
    return keywords.length === 0 || keywords.some(k => bioLower.includes(k));
  });

  console.log(`${C.green}[SCRAPER] Filtrados: ${filtered.length}/${profiles.length}${C.reset}`);
  return filtered.slice(0, limit);
}

// ---- MAIN CLI ----
if (require.main === module) {
  const [,, cmd, arg1, arg2] = process.argv;

  if (!cmd || cmd === 'help') {
    console.log(`\n${C.cyan}SCRAPER - Instagram sem Apify${C.reset}`);
    console.log('Comandos:');
    console.log('  login                     Login automático (usa .env)');
    console.log('  login --manual            Login manual (navegador visível)');
    console.log('  diag                      Diagnóstico completo');
    console.log('  hashtag <tag> [limite]    Scrape por hashtag');
    console.log('  profile <user>            Scrape de perfil');
    console.log('  profiles <u1,u2,...>      Scrape de múltiplos perfis');
    console.log('  test                      Teste rápido de conectividade');
    console.log('  rotate-key                Rotacionar chave de criptografia\n');
    process.exit(0);
  }

  (async () => {
    try {
      if (cmd === 'login') {
        if (arg1 === '--manual') await doManualLogin();
        else await doAutoLogin();
      } else if (cmd === 'diag') {
        await runDiag();
      } else if (cmd === 'rotate-key') {
        const newKey = security.rotateKey(SESSION_DIR);
        console.log(`\nAdicione ao .env:\nSESSION_ENCRYPTION_KEY=${newKey}\n`);
      } else if (cmd === 'hashtag') {
        const results = await scrapeHashtag(arg1 || 'makecom', parseInt(arg2 || '20'));
        console.log('\nUsernames encontrados:');
        results.forEach((u, i) => console.log(`  ${i+1}. @${u}`));
      } else if (cmd === 'profile') {
        const profile = await scrapeProfile(arg1 || 'instagram');
        console.log('\nPerfil:');
        console.log(JSON.stringify(profile, null, 2));
      } else if (cmd === 'profiles') {
        const list = (arg1 || '').split(',').filter(Boolean);
        const profiles = await scrapeProfiles(list);
        console.log(JSON.stringify(profiles, null, 2));
      } else if (cmd === 'test') {
        console.log(`${C.cyan}[SCRAPER] Testando...${C.reset}`);
        const profile = await scrapeProfile('instagram');
        if (profile.followers > 0) {
          console.log(`${C.green}✅ OK! @instagram: ${profile.followers} followers${C.reset}`);
        } else {
          console.log(`${C.yellow}⚠️  Conectou mas sem dados. Rode: node 0-scraper.js diag${C.reset}`);
        }
      }
    } catch (e) {
      console.error(`${C.red}[SCRAPER] Erro: ${e.message}${C.reset}`);
      process.exit(1);
    }
  })();
}

module.exports = { scrapeHashtag, scrapeProfile, scrapeProfiles, scrapeNicho };