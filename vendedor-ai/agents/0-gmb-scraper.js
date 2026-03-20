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
async function searchGoogleMaps(query, city, limit = 30) {
  const searchTerm = `${query} ${city}`;
  console.log(`\n${C.cyan}[GMB] Buscando: "${searchTerm}" (meta: ${limit} negócios)${C.reset}`);

  const { browser, context } = await launchBrowser(true);
  const businesses = [];

  try {
    const page = await context.newPage();

    // Navegar para Google Maps com a busca
    const encodedQuery = encodeURIComponent(searchTerm);
    await page.goto(`https://www.google.com/maps/search/${encodedQuery}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Aguardar resultados carregarem
    await sleep(3000);

    // Aceitar cookies se aparecer
    try {
      const acceptBtn = page.locator('button:has-text("Aceitar"), button:has-text("Accept all")').first();
      if (await acceptBtn.isVisible({ timeout: 2000 })) {
        await acceptBtn.click();
        await sleep(1000);
      }
    } catch {}

    // Localizar o container de resultados (feed de resultados do Maps)
    const feedSelector = 'div[role="feed"]';
    try {
      await page.waitForSelector(feedSelector, { timeout: 10000 });
    } catch {
      console.log(`${C.yellow}[GMB] Feed de resultados não encontrado. Tentando seletor alternativo...${C.reset}`);
      // Fallback: tentar buscar direto nos links
    }

    // Scroll para carregar mais resultados
    let previousCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = Math.ceil(limit / 5) + 5; // ~5 resultados por scroll

    while (scrollAttempts < maxScrollAttempts) {
      // Contar resultados visíveis
      const items = await page.locator(`${feedSelector} > div > div > a[href*="/maps/place/"]`).all();
      const currentCount = items.length;

      if (currentCount >= limit) {
        console.log(`  ${C.green}✓ ${currentCount} resultados carregados${C.reset}`);
        break;
      }

      // Verificar se chegou ao fim dos resultados
      const endOfList = await page.locator('text="Você chegou ao final da lista"').isVisible().catch(() => false)
        || await page.locator('text="You\'ve reached the end of the list"').isVisible().catch(() => false)
        || await page.locator('p.fontBodyMedium span:has-text("final")').isVisible().catch(() => false);

      if (endOfList) {
        console.log(`  ${C.yellow}Fim da lista (${currentCount} resultados)${C.reset}`);
        break;
      }

      if (currentCount === previousCount) {
        scrollAttempts++;
        if (scrollAttempts > 3 && currentCount === 0) {
          console.log(`${C.red}[GMB] Nenhum resultado encontrado após ${scrollAttempts} tentativas${C.reset}`);
          break;
        }
      } else {
        scrollAttempts = 0; // Reset se novos resultados apareceram
      }
      previousCount = currentCount;

      // Scroll dentro do feed de resultados
      try {
        await page.evaluate((sel) => {
          const feed = document.querySelector(sel);
          if (feed) feed.scrollTop += 800;
        }, feedSelector);
      } catch {
        // Fallback: scroll na página inteira
        await page.keyboard.press('End');
      }

      await sleepRandom(800, 1500);
    }

    // Extrair links de todos os resultados
    const resultLinks = await page.locator(`${feedSelector} > div > div > a[href*="/maps/place/"]`).all();
    console.log(`\n${C.cyan}[GMB] ${resultLinks.length} resultados encontrados. Extraindo dados...${C.reset}`);

    // Processar cada resultado (limitado ao limit)
    const toProcess = resultLinks.slice(0, limit);

    for (let i = 0; i < toProcess.length; i++) {
      try {
        const link = toProcess[i];
        const href = await link.getAttribute('href');
        const ariaLabel = await link.getAttribute('aria-label') || '';

        // Clicar no resultado para abrir painel lateral
        await link.click();
        await sleepRandom(1500, 2500);

        // Extrair dados do painel lateral
        const business = await extractBusinessData(page, ariaLabel, href);

        if (business && business.nome) {
          businesses.push(business);
          const igIcon = business.instagram ? '📸' : '  ';
          console.log(`  ${C.green}[${i+1}/${toProcess.length}]${C.reset} ${igIcon} ${business.nome} | ${business.telefone || 'sem tel'} | ${business.instagram || 'sem IG'}`);
        }

        // Delay humanizado entre cliques
        if (i < toProcess.length - 1) {
          await sleepRandom(500, 1200);
        }
      } catch (e) {
        console.log(`  ${C.dim}[${i+1}] Erro ao extrair: ${e.message}${C.reset}`);
      }
    }
  } catch (e) {
    console.error(`${C.red}[GMB] Erro geral: ${e.message}${C.reset}`);
  } finally {
    await browser.close();
  }

  console.log(`\n${C.green}[GMB] ${businesses.length} negócios extraídos${C.reset}`);
  return businesses;
}

// ---- EXTRAÇÃO DE DADOS DO NEGÓCIO ----
async function extractBusinessData(page, ariaLabel, href) {
  const business = {
    nome: ariaLabel || '',
    endereco: '',
    telefone: '',
    website: '',
    instagram: '',
    rating: 0,
    reviews: 0,
    categoria: '',
    horario: '',
    mapsUrl: href || '',
  };

  try {
    // Nome (do heading principal)
    const nameEl = page.locator('h1.fontHeadlineLarge, h1[class*="header"]').first();
    if (await nameEl.isVisible({ timeout: 2000 })) {
      business.nome = (await nameEl.textContent()).trim();
    }
  } catch {}

  try {
    // Categoria
    const catEl = page.locator('button[jsaction*="category"]').first();
    if (await catEl.isVisible({ timeout: 1000 })) {
      business.categoria = (await catEl.textContent()).trim();
    }
  } catch {}

  try {
    // Rating e reviews
    const ratingEl = page.locator('div.fontDisplayLarge, span[role="img"][aria-label*="estrela"], span[role="img"][aria-label*="star"]').first();
    if (await ratingEl.isVisible({ timeout: 1000 })) {
      const txt = (await ratingEl.getAttribute('aria-label')) || (await ratingEl.textContent()) || '';
      const rMatch = txt.match(/([\d,\.]+)/);
      if (rMatch) business.rating = parseFloat(rMatch[1].replace(',', '.'));
    }
  } catch {}

  try {
    // Reviews count
    const revEl = page.locator('span[aria-label*="coment"], span[aria-label*="review"]').first();
    if (await revEl.isVisible({ timeout: 1000 })) {
      const revTxt = (await revEl.getAttribute('aria-label')) || (await revEl.textContent()) || '';
      const revMatch = revTxt.match(/([\d.]+)/);
      if (revMatch) business.reviews = parseInt(revMatch[1].replace('.', ''));
    }
  } catch {}

  // Dados dos botões de informação
  try {
    const infoButtons = await page.locator('button[data-item-id]').all();
    for (const btn of infoButtons) {
      const itemId = await btn.getAttribute('data-item-id') || '';
      const text = (await btn.textContent()).trim();

      if (itemId.startsWith('address') || itemId === 'address') {
        business.endereco = text;
      } else if (itemId.startsWith('phone') || itemId.includes('phone')) {
        business.telefone = text.replace(/[^\d+()-\s]/g, '').trim();
      }
    }
  } catch {}

  // Alternativa para endereço
  if (!business.endereco) {
    try {
      const addrEl = page.locator('button[data-item-id="address"] div, [data-item-id*="address"]').first();
      if (await addrEl.isVisible({ timeout: 800 })) {
        business.endereco = (await addrEl.textContent()).trim();
      }
    } catch {}
  }

  // Alternativa para telefone
  if (!business.telefone) {
    try {
      const phoneEl = page.locator('button[data-item-id*="phone"] div, [aria-label*="Telefone"], [aria-label*="Phone"]').first();
      if (await phoneEl.isVisible({ timeout: 800 })) {
        business.telefone = (await phoneEl.textContent()).trim().replace(/[^\d+()-\s]/g, '');
      }
    } catch {}
  }

  // Website
  try {
    const siteEl = page.locator('a[data-item-id="authority"], a[data-item-id*="website"]').first();
    if (await siteEl.isVisible({ timeout: 1000 })) {
      business.website = (await siteEl.getAttribute('href')) || '';
    }
  } catch {}

  // Instagram — extrair de múltiplas fontes
  business.instagram = await findInstagramFromGMB(page, business);

  return business;
}

// ---- BUSCA DE INSTAGRAM A PARTIR DO GMB ----
async function findInstagramFromGMB(page, business) {
  // Fonte 1: Link direto no perfil GMB (redes sociais)
  try {
    const igLinks = await page.locator('a[href*="instagram.com"]').all();
    for (const link of igLinks) {
      const href = await link.getAttribute('href');
      const username = extractIGUsername(href);
      if (username) {
        console.log(`    ${C.dim}→ Instagram via GMB link: @${username}${C.reset}`);
        return username;
      }
    }
  } catch {}

  // Fonte 2: Texto do perfil menciona Instagram
  try {
    const bodyText = await page.locator('div[class*="section-scrollbox"], div[role="main"]').first().textContent();
    const igMatch = bodyText.match(/@([a-zA-Z0-9_.]{3,30})(?:\s|$|\))/);
    if (igMatch) {
      const candidate = igMatch[1].toLowerCase();
      // Filtrar falsos positivos comuns
      if (!['gmail', 'hotmail', 'yahoo', 'outlook'].some(d => candidate.includes(d))) {
        console.log(`    ${C.dim}→ Instagram via texto: @${candidate} (candidato)${C.reset}`);
        return candidate;
      }
    }
  } catch {}

  // Fonte 3: Visitar website e buscar link do Instagram
  if (business.website) {
    try {
      const ig = await findInstagramFromWebsite(business.website);
      if (ig) {
        console.log(`    ${C.dim}→ Instagram via website: @${ig}${C.reset}`);
        return ig;
      }
    } catch {}
  }

  // Fonte 4: Busca direta no Google "nome do negócio" + "instagram"
  // (opcional — ativa apenas se as fontes anteriores falharam)
  // Desativada por padrão para evitar rate limiting
  // TODO: Implementar se necessário

  return '';
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
  const reserved = ['explore', 'p', 'reel', 'reels', 'stories', 'accounts', 'about',
                     'directory', 'developer', 'legal', 'api', 'static', 'graphql',
                     'web', 'tags', 'locations', 'tv', 'direct'];
  if (reserved.includes(u)) return '';
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

  // 4. Filtrar apenas perfis com Instagram válido
  const validProfiles = enriched.filter(p => p.username && p.username.length > 0);

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
