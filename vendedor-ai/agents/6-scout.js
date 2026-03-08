// =============================================================
// MODULO 6: SCOUT AI - PRISMATIC LABS VENDEDOR AUTOMATICO
// Gera guia diario de prospeccao com hashtags, keywords e perfil ideal
// Uso: node 6-scout.js [nicho] [quantidade]
// Nichos: api-automacao | api-trafego | api-dev | api-crm | lp-infoprodutor | lp-ecommerce
// =============================================================

require('dotenv').config();
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'crm', 'leads-database.json');

function ensureDirs() {
  ['crm', 'leads', 'mensagens', 'relatorios', 'scout'].forEach(d => {
    const p = path.join(DATA_DIR, d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
}

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { leads: [], updated_at: null };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(db) {
  db.updated_at = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ---- NICHOS CONFIGURADOS ----
const NICHOS = {
  'api-automacao': {
    nome: 'Builders de Automacao (Make / n8n / Zapier)',
    produto: 'Lead Normalizer API',
    hashtags: ['#makecom', '#n8n', '#zapier', '#automacao', '#nocode', '#lowcode', '#automation', '#workflow'],
    keywords_bio: ['make.com', 'n8n', 'zapier', 'automacao', 'workflow', 'integracao', 'webhook', 'nocode', 'lowcode', 'activepieces'],
    perfil_ideal: '500-50.000 seguidores, posts com screenshots de flows, bio menciona ferramentas de automacao',
    dor_principal: 'Leads chegando com telefone em formato errado quebrando os flows',
    abordagem: 'dev para dev — mostrar problema tecnico especifico de telefone BR no Make/n8n',
    exemplos_busca: ['buscar #makecom > filtrar quem posta flows com CRM/leads', 'buscar #n8n > ver quem menciona leads, webhook, dados']
  },
  'api-trafego': {
    nome: 'Gestores de Trafego e Agencias de Performance',
    produto: 'Lead Normalizer API',
    hashtags: ['#trafegopago', '#metaads', '#googleads', '#gestaodeleads', '#performance', '#agenciadigital', '#gestordetrafego'],
    keywords_bio: ['trafego pago', 'meta ads', 'google ads', 'performance', 'leads', 'roi', 'gestor de trafego', 'agencia'],
    perfil_ideal: '2.000-100.000 seguidores, posts sobre campanhas e resultados, bio menciona ads ou agencia',
    dor_principal: 'Leads do Meta Ads chegam com telefone fora do padrao, duplicatas em remarketing',
    abordagem: 'mostrar o problema de lead sujo no CRM como erosao silenciosa do ROAS',
    exemplos_busca: ['buscar #trafegopago > filtrar quem fala de CRM e gestao de leads', 'buscar #metaads > ver quem reclama de qualidade de leads']
  },
  'api-dev': {
    nome: 'Desenvolvedores e SaaS Brasileiros',
    produto: 'Lead Normalizer API',
    hashtags: ['#devbr', '#api', '#saas', '#backend', '#fullstack', '#startup', '#programacao', '#javascript', '#python'],
    keywords_bio: ['dev', 'desenvolvedor', 'api', 'saas', 'backend', 'fullstack', 'startup', 'founder', 'cto'],
    perfil_ideal: '500-30.000 seguidores, posts tecnicos sobre codigo ou produto, bio menciona stack ou projeto',
    dor_principal: 'Formulario de cadastro recebe telefone em 20 formatos diferentes, precisam de dedupe confiavel',
    abordagem: 'dev para dev — API REST pronta que resolve problema classico de formularios BR',
    exemplos_busca: ['buscar #saas > filtrar quem tem produto com formulario/cadastro BR', 'buscar #devbr > ver quem fala de validacao ou dados de usuarios']
  },
  'api-crm': {
    nome: 'Consultores de CRM e RevOps',
    produto: 'Lead Normalizer API',
    hashtags: ['#crm', '#hubspot', '#rdstation', '#salesforce', '#pipedrive', '#revops', '#vendas'],
    keywords_bio: ['crm', 'hubspot', 'rd station', 'salesforce', 'pipedrive', 'revops', 'gestao de leads', 'funil de vendas'],
    perfil_ideal: '1.000-30.000 seguidores, posts sobre CRM e pipeline, bio menciona plataformas',
    dor_principal: 'Base de leads suja causando relatorios imprecisos, clientes reclamam de duplicatas',
    abordagem: 'mostrar a API como step de higienizacao no onboarding de leads, antes de chegar no CRM',
    exemplos_busca: ['buscar #hubspot > filtrar quem implementa para empresas BR', 'buscar #rdstation > ver consultores e parceiros']
  },
  'lp-infoprodutor': {
    nome: 'Infoprodutores e Criadores de Conteudo',
    produto: 'Landing Page Premium',
    hashtags: ['#infoprodutor', '#cursoonline', '#mentoria', '#lancamento', '#coachdigital', '#infoproduto'],
    keywords_bio: ['mentor', 'coach', 'curso', 'ebook', 'mentoria', 'infoprodutor', 'lancamento', 'infoproduto'],
    perfil_ideal: '10.000-150.000 seguidores, posts sobre conhecimento e resultados, bio menciona produto digital',
    dor_principal: 'Landing page generica com baixa conversao perdendo leads do lancamento',
    abordagem: 'mostrar conversao 15-25% vs media do mercado de 5-10%',
    exemplos_busca: ['buscar #infoprodutor > filtrar quem esta lancando produto', 'buscar #mentoria > ver quem tem audiencia engajada']
  },
  'lp-ecommerce': {
    nome: 'E-commerce e Marcas DTC',
    produto: 'Landing Page Premium',
    hashtags: ['#ecommerce', '#lojavirtual', '#dropshipping', '#dtc', '#marcadigital'],
    keywords_bio: ['loja virtual', 'e-commerce', 'ecommerce', 'dtc', 'marca propria', 'loja online'],
    perfil_ideal: '8.000-100.000 seguidores, posts de produto, bio com link para loja',
    dor_principal: 'Paginas de produto genericas com baixa conversao em lancamentos',
    abordagem: 'mostrar design premium aumentando percepcao de valor e conversao',
    exemplos_busca: ['buscar #ecommerce > filtrar marcas com produto premium', 'buscar #lojavirtual > ver quem tem produtos diferenciados']
  }
};

async function gerarGuiaProspeccao(nicho = 'api-automacao', quantidade = 10) {
  ensureDirs();

  const config = NICHOS[nicho];
  if (!config) {
    console.log(`\n[SCOUT] Nicho desconhecido: "${nicho}"`);
    console.log('[SCOUT] Nichos disponíveis:', Object.keys(NICHOS).join(' | '));
    process.exit(1);
  }

  const C = { reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m' };

  console.log(`\n${C.magenta}${'='.repeat(60)}${C.reset}`);
  console.log(`${C.bright}  SCOUT AI — GUIA DE PROSPECCAO DO DIA${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(60)}${C.reset}`);
  console.log(`  Nicho: ${C.cyan}${config.nome}${C.reset}`);
  console.log(`  Produto: ${C.green}${config.produto}${C.reset}`);

  console.log(`\n${C.yellow}--- HASHTAGS PARA BUSCAR HOJE ---${C.reset}`);
  config.hashtags.forEach(h => console.log(`  ${h}`));

  console.log(`\n${C.yellow}--- PALAVRAS-CHAVE NA BIO ---${C.reset}`);
  console.log(`  ${config.keywords_bio.join(', ')}`);

  console.log(`\n${C.yellow}--- PERFIL IDEAL ---${C.reset}`);
  console.log(`  ${config.perfil_ideal}`);

  console.log(`\n${C.yellow}--- DOR PRINCIPAL ---${C.reset}`);
  console.log(`  ${config.dor_principal}`);

  console.log(`\n${C.yellow}--- COMO ABORDAR ---${C.reset}`);
  console.log(`  ${config.abordagem}`);

  console.log(`\n${C.yellow}--- ONDE PROCURAR ---${C.reset}`);
  config.exemplos_busca.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));

  // Gerar exemplos de perfis-alvo com IA
  console.log(`\n${C.blue}Gerando ${quantidade} exemplos de perfis-alvo via Groq...${C.reset}`);

  const prompt = `Gere ${quantidade} exemplos FICTICIOS mas REALISTAS de perfis do Instagram que se encaixam neste nicho para o Brasil:

Nicho: ${config.nome}
Perfil ideal: ${config.perfil_ideal}
Keywords da bio: ${config.keywords_bio.join(', ')}

Para cada perfil:
- username: username Instagram realista (sem @, lowercase, underscores)
- bio: bio real de Instagram (max 150 chars)
- seguidores: numero realista
- posts: numero de posts
- por_que_bom_lead: 1 frase explicando por que e um bom lead

Responda APENAS JSON:
{"perfis": [{"username": "", "bio": "", "seguidores": 0, "posts": 0, "por_que_bom_lead": ""}]}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.8,
      max_tokens: 2000,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const dados = jsonMatch ? JSON.parse(jsonMatch[0]) : { perfis: [] };
    const perfis = dados.perfis || [];

    console.log(`\n${C.yellow}--- EXEMPLOS DE PERFIS-ALVO (use como referencia no Instagram) ---${C.reset}`);
    console.log(`${C.cyan}  Esses sao perfis ficticios. Busque perfis SIMILARES no Instagram.${C.reset}`);

    perfis.forEach((p, i) => {
      console.log(`\n  ${C.bright}${i + 1}. @${p.username}${C.reset} | ${p.seguidores} seguidores | ${p.posts} posts`);
      console.log(`     Bio: "${p.bio}"`);
      console.log(`     ${C.green}-> ${p.por_que_bom_lead}${C.reset}`);
    });

    // Salvar guia
    const hoje = new Date().toISOString().split('T')[0];
    const arquivoGuia = path.join(DATA_DIR, 'scout', `guia-${hoje}-${nicho}.json`);
    fs.writeFileSync(arquivoGuia, JSON.stringify({ geradoEm: new Date().toISOString(), nicho, config, exemplos: perfis }, null, 2));

    console.log(`\n${C.magenta}${'='.repeat(60)}${C.reset}`);
    console.log(`${C.bright}  PROXIMO PASSO${C.reset}`);
    console.log(`${C.magenta}${'='.repeat(60)}${C.reset}`);
    console.log(`  1. Abra o Instagram e busque as hashtags acima`);
    console.log(`  2. Encontrou um perfil interessante? Rode:`);
    console.log(`  ${C.green}  node agents/5-orchestrator.js analyze @usuario "bio" seguidores posts${C.reset}`);
    console.log(`  3. Copie a mensagem gerada e envie no DM`);
    console.log(`  4. Depois rode: node agents/5-orchestrator.js sent @usuario`);
    console.log(`\n  Guia salvo em: ${arquivoGuia}`);
    console.log(`${C.magenta}${'='.repeat(60)}${C.reset}\n`);

  } catch (error) {
    console.error('[SCOUT] Erro ao gerar exemplos:', error.message);
    console.log('[SCOUT] Guia de hashtags e keywords acima ainda e valido — use para prospectar!');
  }
}

if (require.main === module) {
  const nicho = process.argv[2] || 'api-automacao';
  const quantidade = parseInt(process.argv[3]) || 8;
  gerarGuiaProspeccao(nicho, quantidade)
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { gerarGuiaProspeccao, NICHOS };
