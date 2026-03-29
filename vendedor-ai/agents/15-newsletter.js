// =============================================================
// MODULO 15: NEWSLETTER — Reddit → Telegram
// Coleta posts quentes do Reddit em nichos relevantes,
// sumariza com IA e envia como newsletter formatada no Telegram.
//
// Setup:
//   1. Crie um bot em t.me/BotFather → copie TELEGRAM_BOT_TOKEN
//   2. Mande qualquer msg para o bot → pegue TELEGRAM_CHAT_ID:
//      curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
//   3. Adicione no .env:
//      TELEGRAM_BOT_TOKEN=123456:ABC-...
//      TELEGRAM_CHAT_ID=123456789
//
// Uso:
//   node agents/15-newsletter.js                   → roda agora
//   node agents/15-newsletter.js --dry-run         → mostra sem enviar
// =============================================================

require('dotenv').config();
const https = require('https');

// ── CONFIG ─────────────────────────────────────────────────────
const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID     = process.env.TELEGRAM_CHAT_ID;
const DRY_RUN     = process.argv.includes('--dry-run');

// Subreddits monitorados — foco em automação, IA e vendas
const SUBREDDITS = [
  { name: 'automation',        emoji: '⚙️',  label: 'Automação'      },
  { name: 'artificial',        emoji: '🤖',  label: 'IA'             },
  { name: 'EntrepreneurRideAlong', emoji: '🚀', label: 'Empreendedorismo' },
  { name: 'sales',             emoji: '💼',  label: 'Vendas'         },
  { name: 'digital_marketing', emoji: '📣',  label: 'Marketing'      },
];

const MAX_POSTS_PER_SUB = 3;   // Top posts por subreddit
const MIN_SCORE         = 50;  // Score mínimo para incluir

// ── HTTP HELPERS ───────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = https.request({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: 'GET',
      headers: {
        'User-Agent': 'PrismaticNewsletterBot/1.0',
        'Accept': 'application/json',
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`JSON parse error: ${data.slice(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function telegramSend(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          if (r.ok) resolve(r);
          else reject(new Error(`Telegram error: ${r.description}`));
        } catch { reject(new Error('Telegram parse error')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── FETCH REDDIT ───────────────────────────────────────────────
async function fetchTopPosts(subreddit, limit = 10) {
  try {
    const data = await httpGet(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}&raw_json=1`
    );
    return (data?.data?.children || [])
      .map(c => c.data)
      .filter(p => !p.stickied && p.score >= MIN_SCORE && !p.is_self_flag)
      .slice(0, MAX_POSTS_PER_SUB);
  } catch (e) {
    console.error(`[NEWSLETTER] Erro ao buscar r/${subreddit}: ${e.message}`);
    return [];
  }
}

// ── SUMMARIZE WITH GROQ ────────────────────────────────────────
async function summarizePost(post) {
  if (!process.env.GROQ_API_KEY) return post.title;

  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const content = post.selftext
      ? `Título: ${post.title}\n\nConteúdo: ${post.selftext.slice(0, 600)}`
      : `Título: ${post.title}`;

    const completion = await groq.chat.completions.create({
      messages: [{
        role: 'user',
        content: `Você é um curador de conteúdo para empreendedores brasileiros focados em automação, IA e vendas.

Resuma este post do Reddit em 1-2 frases em português, destacando o insight mais valioso. Seja direto e prático.

${content}

Retorne APENAS o resumo, sem introduções.`
      }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      max_tokens: 150,
    });

    return completion.choices[0].message.content.trim();
  } catch {
    return post.title;
  }
}

// ── FORMAT NEWSLETTER ─────────────────────────────────────────
function formatDate() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

function escapeHTML(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function buildNewsletter(sections) {
  const date = formatDate();
  let msg = `<b>📰 Prismatic Intel — ${date}</b>\n`;
  msg += `<i>O melhor de automação, IA e vendas nas últimas horas</i>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const { sub, posts, emoji, label } of sections) {
    if (posts.length === 0) continue;
    msg += `${emoji} <b>${label}</b>  <i>r/${sub}</i>\n`;

    for (const post of posts) {
      const summary = await summarizePost(post);
      const score = post.score >= 1000
        ? `${(post.score/1000).toFixed(1)}k`
        : `${post.score}`;
      const url = `https://reddit.com${post.permalink}`;
      msg += `\n• <a href="${url}">${escapeHTML(post.title.slice(0, 80))}</a>\n`;
      msg += `  <i>${escapeHTML(summary)}</i>\n`;
      msg += `  ↑${score}  💬${post.num_comments}\n`;
    }
    msg += '\n';
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `<i>Gerado por Prismatic Labs · Vendedor AI</i>`;
  return msg;
}

// ── MAIN ───────────────────────────────────────────────────────
async function run() {
  console.log('\n[NEWSLETTER] Iniciando coleta...');

  // Validar config
  if (!DRY_RUN) {
    if (!BOT_TOKEN || !CHAT_ID) {
      console.error('[NEWSLETTER] ERRO: Configure TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env');
      console.error('[NEWSLETTER] Instruções: ver comentário no topo deste arquivo');
      process.exit(1);
    }
  }

  // Coletar posts
  const sections = [];
  for (const { name, emoji, label } of SUBREDDITS) {
    console.log(`[NEWSLETTER] Buscando r/${name}...`);
    const posts = await fetchTopPosts(name);
    sections.push({ sub: name, posts, emoji, label });
    console.log(`[NEWSLETTER] r/${name}: ${posts.length} posts encontrados`);
  }

  // Verificar se tem conteúdo
  const totalPosts = sections.reduce((s, sec) => s + sec.posts.length, 0);
  if (totalPosts === 0) {
    console.error('[NEWSLETTER] Nenhum post encontrado — Reddit pode estar bloqueando. Tente mais tarde.');
    process.exit(1);
  }

  // Montar newsletter
  console.log(`\n[NEWSLETTER] Sumarizando ${totalPosts} posts com IA...`);
  const newsletter = await buildNewsletter(sections);

  if (DRY_RUN) {
    console.log('\n[NEWSLETTER] ─── DRY RUN ───────────────────────────');
    console.log(newsletter.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
    console.log('[NEWSLETTER] ─── FIM DRY RUN ───────────────────────');
    console.log('\n[NEWSLETTER] Para enviar de verdade: remova --dry-run');
  } else {
    console.log('[NEWSLETTER] Enviando para Telegram...');
    await telegramSend(newsletter);
    console.log('[NEWSLETTER] ✅ Newsletter enviada!');
  }
}

run().catch(e => {
  console.error('[NEWSLETTER] Erro fatal:', e.message);
  process.exit(1);
});
