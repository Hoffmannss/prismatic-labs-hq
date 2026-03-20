// =============================================================
// MODULO 0-GMB: GOOGLE MY BUSINESS SCRAPER - PRISMATIC LABS
// Busca negócios no Google Maps por nicho + cidade
// Extrai dados do GMB + link Instagram → enriquece via 0-scraper
//
// ARQUITETURA:
//   1. Busca Google Maps por query (ex: "salão de beleza São Paulo")
//   2. Scrolling para carregar mais resultados
//   3. Extrai: nome, endereço, telefone, website, rating, reviews
//   4. Busca Instagram: website → scrape → regex Instagram link
//   5. Retorna perfis no MESMO formato que scrapeNicho() para
//      integração direta com 10-autopilot.js
//
// Uso:
//   node 0-gmb-scraper.js "salão de beleza" "São Paulo" 30
//   node 0-gmb-scraper.js "consultório odontológico" "São Paulo"
// =============================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GMB_CACHE_DIR = path.join(DATA_DIR, 'gmb-cache');

const DELAY_MULT = parseFloat(process.env.AUTOPILOT_DELAY_MULTIPLIER || '1.0');

const C = {
  reset:'\x1b[0m', bright:'\x1b[1m', dim:'\x1b[2m', green:'\x1b[32m',
  yellow:'\x1b[33m', red:'\x1b[31m', cyan:'\x1b[36m', magenta:'\x1b[35m',
  blue:'\x1b[34m'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleepRandom = async (minMs = 1500, maxMs = 3500) =>
  sleep(rand(Math.floor(minMs * DELAY_MULT), Math.floor(maxMs * DELAY_MULT)));

if (!fs.existsSync(GMB_CACHE_DIR)) fs.mkdirSync(GMB_CACHE_DIR, { recursive: true });

// ---- BROWSER ----
async function launchBrowser(headless = true) {
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ]
  });
  const context = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
  });
  return { browser, context };
}

// ---- GOOGLE MAPS SEARCH ----
// Fase 1: Coleta os URLs e nomes de todos os resultados do feed
async function searchGoogleMaps(query, city, limit = 30) {
  const searchTerm = `${query} ${city}`;
  console.log(`\n${C.cyan}[GMB] Buscando: "${searchTerm}" (meta: ${limit} negócios)${C.reset}`);

  const { browser, context } = await launchBrowser(true);
  const placeEntries = []; // { href, nome }

  try {
    const page = await context.newPage();
    const encodedQuery = encodeURIComponent(searchTerm);
    await page.goto(`https://www.google.com/maps/search/${encodedQuery}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await sleep(3000);

    // Aceitar cookies se aparecer
    try {
      const acceptBtn = page.locator('button:has-text("Aceitar tudo"), button:has-text("Accept all"), button:has-text("Aceitar")').first();
      if (await acceptBtn.isVisible({ timeout: 2000 })) {
        await acceptBtn.click();
        await sleep(1000);
      }
    } catch {}

    const feedSelector = 'div[role="feed"]';
    try { await page.waitForSelector(feedSelector, { timeout: 10000 }); } catch {}

    // Scroll para carregar resultados suficientes
    let prevCount = 0;
    let staleRounds = 0;
    const maxRounds = Math.ceil(limit / 4) + 8;

    for (let round = 0; round < maxRounds; round++) {
      // Seletores amplos para pegar todos os links de lugares
      const links = await page.locator('a[href*="/maps/place/"]').all();
      const count = links.length;

      if (count >= limit) { console.log(`  ${C.green}✓ ${count} links coletados${C.reset}`); break; }

      const endMsg = await page.locator('text=/chegou ao final|end of the list/i').isVisible().catch(() => false);
      if (endMsg) { console.log(`  ${C.yellow}Fim da lista (${count} resultados)${C.reset}`); break; }

      if (count === prevCount) {
        staleRounds++;
        if (staleRounds >= 4) { console.log(`  ${C.yellow}Sem novos resultados após ${staleRounds} scrolls (${count} total)${C.reset}`); break; }
      } else {
        staleRounds = 0;
      }
      prevCount = count;

      // Scroll no feed ou na página toda
      await page.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]');
        if (feed) feed.scrollTop += 900;
        else window.scrollBy(0, 900);
      });
      await sleepRandom(900, 1600);
    }

    // Extrair {href, nome} de cada link único
    const allLinks = await page.locator('a[href*="/maps/place/"]').all();
    const seen = new Set();
    for (const link of allLinks.slice(0, limit * 2)) {
      try {
        const href = await link.getAttribute('href');
        const label = (await link.getAttribute('aria-label') || '').trim();
        if (!href || !label) continue;
        // Normalizar URL para evitar duplicatas
        const baseUrl = href.split('?')[0];
        if (seen.has(baseUrl)) continue;
        seen.add(baseUrl);
        placeEntries.push({ href, nome: label });
      } catch {}
    }
    console.log(`\n${C.cyan}[GMB] ${placeEntries.length} lugares únicos identificados${C.reset}`);
  } catch (e) {
    console.error(`${C.red}[GMB] Erro na busca: ${e.message}${C.reset}`);
  } finally {
    await browser.close();
  }

  if (placeEntries.length === 0) return [];

  // Fase 2: Para cada lugar, navegar diretamente na URL e extrair dados
  console.log(`${C.cyan}[GMB] Extraindo detalhes de cada lugar (site + Instagram)...${C.reset}`);
  const businesses = [];
  const toProcess = placeEntries.slice(0, limit);

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i];
    try {
      const biz = await extractBusinessFromURL(entry.href, entry.nome);
      businesses.push(biz);
      const igIcon = biz.instagram ? '📸' : '  ';
      const telStr = biz.telefone || 'sem tel';
      const igStr  = biz.instagram ? `@${biz.instagram}` : 'sem IG';
      const siteStr = biz.website ? '🌐' : '  ';
      console.log(`  ${C.green}[${i+1}/${toProcess.length}]${C.reset} ${igIcon}${siteStr} ${biz.nome.slice(0,40)} | ${telStr} | ${igStr}`);
    } catch (e) {
      console.log(`  ${C.dim}[${i+1}] Erro: ${e.message.slice(0, 60)}${C.reset}`);
      businesses.push({ nome: entry.nome, telefone: '', website: '', instagram: '', mapsUrl: entry.href });
    }
    await sleepRandom(600, 1200);
  }

  console.log(`\n${C.green}[GMB] ${businesses.length} negócios extraídos${C.reset}`);
  return businesses;
}

// ---- EXTRAÇÃO DE DETALHES: navega direto na URL do lugar ----
async function extractBusinessFromURL(placeUrl, nomeFallback = '') {
  const business = {
    nome: nomeFallback,
    endereco: '',
    telefone: '',
    website: '',
    instagram: '',
    rating: 0,
    reviews: 0,
    categoria: '',
    mapsUrl: placeUrl,
  };

  const { browser, context } = await launchBrowser(true);
  try {
    const page = await context.newPage();
    await page.goto(placeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Aguardar o painel do lugar carregar (h1 com o nome)
    try { await page.waitForSelector('h1', { timeout: 8000 }); } catch {}
    await sleep(1500);

    // ── Nome ──
    try {
      const h1 = page.locator('h1').first();
      const txt = (await h1.textContent({ timeout: 2000 })).trim();
      if (txt) business.nome = txt;
    } catch {}

    // ── Extrair HTML completo do painel para análise ampla ──
    let panelHtml = '';
    try { panelHtml = await page.content(); } catch {}

    // ── Website — múltiplas estratégias ──
    // Estratégia 1: link com data-item-id="authority"
    try {
      const siteLink = page.locator('a[data-item-id="authority"]').first();
      if (await siteLink.isVisible({ timeout: 1500 })) {
        business.website = (await siteLink.getAttribute('href') || '').split('?')[0];
      }
    } catch {}

    // Estratégia 2: aria-label contendo "Site" ou "Website"
    if (!business.website) {
      try {
        const siteLink = page.locator('a[aria-label*="Site"], a[aria-label*="Website"], a[aria-label*="Visitar"]').first();
        if (await siteLink.isVisible({ timeout: 1000 })) {
          business.website = (await siteLink.getAttribute('href') || '').split('?')[0];
        }
      } catch {}
    }

    // Estratégia 3: qualquer link http externo no painel (exclui google.com)
    if (!business.website) {
      try {
        const links = await page.locator('a[href^="http"]').all();
        for (const link of links) {
          const href = (await link.getAttribute('href') || '');
          if (href && !href.includes('google.com') && !href.includes('goo.gl') &&
              !href.includes('instagram.com') && !href.includes('facebook.com') &&
              href.startsWith('http')) {
            business.website = href.split('?')[0];
            break;
          }
        }
      } catch {}
    }

    // ── Telefone ──
    // Estratégia 1: link tel: no DOM (mais preciso — href="tel:+55...")
    try {
      const telLink = page.locator('a[href^="tel:"]').first();
      if (await telLink.isVisible({ timeout: 1500 })) {
        const href = (await telLink.getAttribute('href') || '').replace('tel:', '').trim();
        if (href) business.telefone = href;
      }
    } catch {}

    // Estratégia 2: buscar href="tel:..." no HTML (pega mesmo se não visível)
    if (!business.telefone) {
      const telHrefMatch = panelHtml.match(/href="tel:([^"]+)"/);
      if (telHrefMatch) business.telefone = telHrefMatch[1].trim();
    }

    // Estratégia 3: aria-label com "Telefone" ou "Ligar para"
    if (!business.telefone) {
      try {
        const phoneEl = page.locator('[aria-label*="Telefone"], [aria-label*="Ligar para"], [data-tooltip*="telefone"]').first();
        if (await phoneEl.isVisible({ timeout: 1000 })) {
          const label = await phoneEl.getAttribute('aria-label') || '';
          const m = label.match(/(\+?[\d\s().-]{8,20})/);
          if (m) business.telefone = m[0].trim();
        }
      } catch {}
    }

    // ── Instagram: link direto na página do Maps ──
    try {
      const igLinks = await page.locator('a[href*="instagram.com"]').all();
      for (const link of igLinks) {
        const href = await link.getAttribute('href');
        const u = extractIGUsername(href);
        if (u) { business.instagram = u; break; }
      }
    } catch {}

    // ── Instagram: regex no HTML do Maps ──
    if (!business.instagram) {
      const igMatch = panelHtml.match(/instagram\.com\/([a-zA-Z0-9_.]{3,30})\/?/);
      if (igMatch) {
        const u = extractIGUsername(`https://instagram.com/${igMatch[1]}`);
        if (u) business.instagram = u;
      }
    }

  } catch (e) {
    // Falha silenciosa — retorna o que conseguiu extrair
  } finally {
    await browser.close();
  }

  // ── Instagram: visitar website se ainda não encontrou ──
  if (!business.instagram && business.website) {
    try {
      business.instagram = await findInstagramFromWebsite(business.website);
    } catch {}
  }

  return business;
}

// ---- BUSCA INSTAGRAM NO WEBSITE ----
async function findInstagramFromWebsite(websiteUrl) {
  const { browser, context } = await launchBrowser(true);
  try {
    const page = await context.newPage();

    // Timeout curto — se o site demora, pula
    await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await sleep(1500);

    // Buscar links do Instagram na página
    const links = await page.locator('a[href*="instagram.com"]').all();
    for (const link of links) {
      const href = await link.getAttribute('href');
      const username = extractIGUsername(href);
      if (username) return username;
    }

    // Fallback: buscar no HTML por menções
    const html = await page.content();
    const igPattern = /instagram\.com\/([a-zA-Z0-9_.]{3,30})\/?/gi;
    let match;
    while ((match = igPattern.exec(html)) !== null) {
      const u = match[1].toLowerCase();
      if (!['explore', 'p', 'reel', 'stories', 'accounts', 'about', 'directory', 'developer'].includes(u)) {
        return u;
      }
    }

    return '';
  } catch {
    return '';
  } finally {
    await browser.close();
  }
}

// ---- EXTRAI USERNAME DE URL INSTAGRAM ----
function extractIGUsername(url) {
  if (!url) return '';
  const match = url.match(/instagram\.com\/([a-zA-Z0-9_.]{3,30})\/?/);
  if (!match) return '';
  const u = match[1].toLowerCase();
  // Caminhos reservados da própria plataforma Instagram
  const reservedPaths = ['explore', 'p', 'reel', 'reels', 'stories', 'accounts', 'about',
                          'directory', 'developer', 'legal', 'api', 'static', 'graphql',
                          'web', 'tags', 'locations', 'tv', 'direct', 'challenge',
                          'oauth', 'login', 'logout', 'signup'];
  // Handles de plataformas/marcas globais — nunca são negócios locais
  const globalBrands = ['whatsapp', 'facebook', 'twitter', 'youtube', 'tiktok', 'linkedin',
                         'pinterest', 'snapchat', 'telegram', 'instagram', 'google', 'apple',
                         'meta', 'microsoft', 'amazon', 'netflix', 'spotify', 'uber',
                         'ifood', 'rappi', 'shopify', 'wordpress'];
  if (reservedPaths.includes(u) || globalBrands.includes(u)) return '';
  return u;
}

// ---- ENRICHMENT: GMB → Instagram profiles ----
// Retorna no MESMO formato que scrapeNicho para integração com autopilot
async function enrichWithInstagram(businesses) {
  const { scrapeProfile, scrapeProfiles } = require('./0-scraper');

  // Filtrar apenas negócios que têm Instagram
  const withIG = businesses.filter(b => b.instagram);
  const withoutIG = businesses.filter(b => !b.instagram);

  console.log(`\n${C.cyan}[GMB] ${withIG.length}/${businesses.length} negócios com Instagram encontrado${C.reset}`);
  if (withoutIG.length > 0) {
    console.log(`${C.dim}  ${withoutIG.length} sem Instagram: ${withoutIG.slice(0,5).map(b => b.nome).join(', ')}${withoutIG.length > 5 ? '...' : ''}${C.reset}`);
  }

  if (withIG.length === 0) {
    console.log(`${C.yellow}[GMB] Nenhum negócio com Instagram. Retornando dados GMB apenas.${C.reset}`);
    return businesses.map(b => ({
      username: '',
      bio: '',
      followers: 0,
      posts: 0,
      recentPosts: [],
      gmb: b, // Dados do GMB preservados
    }));
  }

  // Enriquecer perfis via Instagram scraper existente (batch)
  console.log(`\n${C.cyan}[GMB] Enriquecendo ${withIG.length} perfis do Instagram...${C.reset}`);
  const usernames = withIG.map(b => b.instagram);
  const igProfiles = await scrapeProfiles(usernames);

  // Merge: dados GMB + dados Instagram
  const merged = [];
  for (const biz of withIG) {
    const igProfile = igProfiles.find(p =>
      p.username && p.username.toLowerCase() === biz.instagram.toLowerCase()
    );

    if (igProfile && igProfile.username) {
      merged.push({
        ...igProfile,
        gmb: {
          nome: biz.nome,
          endereco: biz.endereco,
          telefone: biz.telefone,
          website: biz.website,
          rating: biz.rating,
          reviews: biz.reviews,
          categoria: biz.categoria,
          mapsUrl: biz.mapsUrl,
        }
      });
    } else {
      // Perfil IG falhou mas temos os dados do GMB
      merged.push({
        username: biz.instagram,
        bio: '',
        followers: 0,
        posts: 0,
        recentPosts: [],
        gmb: biz,
      });
    }
  }

  return merged;
}

// ---- EXPORT PRINCIPAL: scrapeGMB ----
// Drop-in replacement para scrapeNicho no autopilot
async function scrapeGMB(query, city, limit = 30) {
  console.log(`\n${C.magenta}${'='.repeat(60)}${C.reset}`);
  console.log(`${C.bright}  GMB SCRAPER: "${query}" em ${city}${C.reset}`);
  console.log(`  Meta: ${limit} negócios com Instagram`);
  console.log(`${C.magenta}${'='.repeat(60)}${C.reset}\n`);

  // 1. Buscar negócios no Google Maps
  const businesses = await searchGoogleMaps(query, city, limit * 2);

  // 2. Salvar cache GMB
  const dateStr = new Date().toISOString().split('T')[0];
  const slug = query.replace(/\s+/g, '-').toLowerCase().slice(0, 30);
  const cacheFile = path.join(GMB_CACHE_DIR, `gmb-${dateStr}-${slug}.json`);
  fs.writeFileSync(cacheFile, JSON.stringify({
    query, city, date: dateStr,
    total: businesses.length,
    businesses
  }, null, 2));
  console.log(`\n${C.dim}Cache GMB salvo: ${cacheFile}${C.reset}`);

  // 3. Enriquecer com dados do Instagram
  const enriched = await enrichWithInstagram(businesses);

  // 4. Filtrar perfis válidos (com username + não são contas globais)
  const validProfiles = enriched.filter(p => {
    if (!p.username || p.username.length === 0) return false;
    if (p.followers > 500000) {
      console.log(`  ${C.yellow}⚠ Descartado @${p.username} (${p.followers.toLocaleString()} followers — conta global)${C.reset}`);
      return false;
    }
    return true;
  });

  console.log(`\n${C.green}[GMB] Pipeline completo: ${validProfiles.length} perfis enriquecidos de ${businesses.length} negócios${C.reset}`);

  return validProfiles;
}

// ---- CLI ----
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'help' || !args[0]) {
    console.log(`\n${C.cyan}GMB SCRAPER - Prismatic Labs${C.reset}\n`);
    console.log('Uso:');
    console.log('  node 0-gmb-scraper.js "salão de beleza" "São Paulo" 30');
    console.log('  node 0-gmb-scraper.js "consultório odontológico" "São Paulo"');
    console.log('  node 0-gmb-scraper.js "clínica estética" "Curitiba" 50');
    console.log('\nParâmetros:');
    console.log('  1: Nicho/query de busca');
    console.log('  2: Cidade (default: São Paulo)');
    console.log('  3: Limite de resultados (default: 30)\n');
    process.exit(0);
  }

  const query = args[0];
  const city  = args[1] || 'São Paulo';
  const limit = parseInt(args[2] || '30', 10);

  scrapeGMB(query, city, limit)
    .then(profiles => {
      console.log(`\n${C.bright}=== RESULTADO ===${C.reset}`);
      console.log(`${profiles.length} perfis encontrados:\n`);
      profiles.forEach((p, i) => {
        const gmb = p.gmb || {};
        console.log(`  ${i+1}. @${p.username} | ${p.followers || 0} followers | ${gmb.nome || '?'} | ⭐${gmb.rating || 0} (${gmb.reviews || 0} reviews)`);
      });
    })
    .catch(e => {
      console.error(`${C.red}[GMB] Erro: ${e.message}${C.reset}`);
      process.exit(1);
    });
}

module.exports = { scrapeGMB, searchGoogleMaps, enrichWithInstagram, findInstagramFromWebsite, extractIGUsername };
