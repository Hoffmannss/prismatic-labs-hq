// =============================================================
// MODULO 13: NICHO AI - PRISMATIC LABS VENDEDOR AI
// Sistema inteligente que detecta, cria e gerencia nichos
// automaticamente via IA
//
// Comandos:
//   node 13-nicho-ai.js "personal trainers fitness"
//   node 13-nicho-ai.js list
// =============================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SCOUT_FILE = path.join(__dirname, '6-scout.js');
const NICHOS_CACHE = path.join(__dirname, '..', 'data', 'nichos-cache.json');

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m'
};

function ensureDataDir() {
  const dir = path.dirname(NICHOS_CACHE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadNichosCache() {
  ensureDataDir();
  if (!fs.existsSync(NICHOS_CACHE)) return {};
  return JSON.parse(fs.readFileSync(NICHOS_CACHE, 'utf8'));
}

function saveNichosCache(nichos) {
  ensureDataDir();
  fs.writeFileSync(NICHOS_CACHE, JSON.stringify(nichos, null, 2));
}

function extractNichosFromScout() {
  const content = fs.readFileSync(SCOUT_FILE, 'utf8');
  const match = content.match(/const NICHOS = (\{[\s\S]*?\});/);
  if (!match) return {};
  
  try {
    // Converter formato JS para JSON
    const jsObj = match[1]
      .replace(/'/g, '"')
      .replace(/([a-zA-Z_][a-zA-Z0-9_-]*):/g, '"$1":')
      .replace(/,\s*\}/g, '}')
      .replace(/,\s*\]/g, ']');
    return JSON.parse(jsObj);
  } catch (e) {
    console.error(`${C.red}[NICHO-AI] Erro ao parsear NICHOS do scout: ${e.message}${C.reset}`);
    return {};
  }
}

function getAllNichos() {
  const scoutNichos = extractNichosFromScout();
  const cacheNichos = loadNichosCache();
  return { ...scoutNichos, ...cacheNichos };
}

function generateNichoId(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 30);
}

async function detectOrCreateNicho(descricao) {
  console.log(`\n${C.magenta}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.bright}  NICHO AI - Analisando: "${descricao}"${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(70)}${C.reset}\n`);

  const nichos = getAllNichos();
  const nichosExistentes = Object.entries(nichos).map(([id, config]) => ({
    id,
    nome: config.nome,
    produto: config.produto,
    dor: config.dor_principal
  }));

  console.log(`${C.cyan}[1/3] Verificando se nicho ja existe...${C.reset}`);

  // IA decide se é um nicho existente ou novo
  const promptDeteccao = `Analise esta descricao de nicho: "${descricao}"

Nichos existentes no sistema:
${JSON.stringify(nichosExistentes, null, 2)}

RESPONDA APENAS JSON:
{
  "match": true/false,
  "nicho_id": "id do nicho existente" OU null,
  "razao": "explicacao curta"
}`;

  try {
    const deteccao = await groq.chat.completions.create({
      messages: [{ role: 'user', content: promptDeteccao }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 500
    });

    const raw = deteccao.choices[0]?.message?.content || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : { match: false };

    if (resultado.match && resultado.nicho_id && nichos[resultado.nicho_id]) {
      console.log(`${C.green}✅ Nicho existente encontrado: ${resultado.nicho_id}${C.reset}`);
      console.log(`${C.dim}   ${resultado.razao}${C.reset}\n`);
      return { id: resultado.nicho_id, config: nichos[resultado.nicho_id], novo: false };
    }

    console.log(`${C.yellow}⚠️  Nicho nao existe. Criando automaticamente...${C.reset}`);

  } catch (e) {
    console.log(`${C.yellow}⚠️  Erro na deteccao. Criando novo nicho...${C.reset}`);
  }

  // CRIAR NOVO NICHO COM IA
  console.log(`${C.cyan}[2/3] Gerando configuracao do nicho com IA...${C.reset}`);

  const promptCriacao = `Crie uma configuracao COMPLETA para este nicho de prospeccao no Instagram Brasil:

NICHO: "${descricao}"

Gere uma configuracao detalhada considerando:
1. Qual o nome descritivo do nicho
2. Qual produto da Prismatic Labs se encaixa melhor:
   - "Lead Normalizer API" (para quem trabalha com automacao, CRM, leads, dados)
   - "Landing Page Premium" (para infoprodutores, e-commerce, criadores)
3. Qual a DOR PRINCIPAL desse publico relacionada ao produto
4. 8-12 hashtags relevantes no Instagram BR
5. 8-12 palavras-chave que aparecem na bio desses perfis
6. Descricao do perfil ideal (seguidores, tipo de conteudo)
7. Como abordar esse publico (angulo de venda)
8. 3 exemplos de onde buscar esses perfis no Instagram

RESPONDA APENAS JSON:
{
  "nome": "Nome completo do nicho",
  "produto": "Lead Normalizer API" OU "Landing Page Premium",
  "hashtags": ["#tag1", "#tag2", ...],
  "keywords_bio": ["palavra1", "palavra2", ...],
  "perfil_ideal": "descricao detalhada",
  "dor_principal": "problema especifico que o produto resolve",
  "abordagem": "como abordar e vender",
  "exemplos_busca": ["exemplo 1", "exemplo 2", "exemplo 3"]
}`;

  try {
    const criacao = await groq.chat.completions.create({
      messages: [{ role: 'user', content: promptCriacao }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 1500
    });

    const raw = criacao.choices[0]?.message?.content || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('IA nao retornou JSON valido');

    const config = JSON.parse(jsonMatch[0]);
    const nichoId = generateNichoId(descricao);

    console.log(`${C.green}✅ Configuracao gerada!${C.reset}`);
    console.log(`${C.cyan}[3/3] Salvando nicho: ${nichoId}${C.reset}\n`);

    // Salvar no cache
    const cache = loadNichosCache();
    cache[nichoId] = {
      ...config,
      criado_em: new Date().toISOString(),
      descricao_original: descricao,
      gerado_por_ia: true
    };
    saveNichosCache(cache);

    // Exibir resumo
    console.log(`${C.magenta}${'='.repeat(70)}${C.reset}`);
    console.log(`${C.bright}  NICHO CRIADO: ${nichoId}${C.reset}`);
    console.log(`${C.magenta}${'='.repeat(70)}${C.reset}`);
    console.log(`  Nome: ${C.cyan}${config.nome}${C.reset}`);
    console.log(`  Produto: ${C.green}${config.produto}${C.reset}`);
    console.log(`  Dor: ${config.dor_principal}`);
    console.log(`  Hashtags: ${config.hashtags.slice(0, 5).join(', ')}...`);
    console.log(`  Keywords: ${config.keywords_bio.slice(0, 5).join(', ')}...`);
    console.log(`\n${C.bright}PROXIMO PASSO:${C.reset}`);
    console.log(`  ${C.green}node agents/10-autopilot.js ${nichoId} 30${C.reset}\n`);

    return { id: nichoId, config: cache[nichoId], novo: true };

  } catch (e) {
    console.error(`${C.red}[NICHO-AI] Erro ao criar nicho: ${e.message}${C.reset}`);
    throw e;
  }
}

function listAllNichos() {
  const nichos = getAllNichos();
  
  console.log(`\n${C.magenta}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.bright}  TODOS OS NICHOS DISPONIVEIS${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(70)}${C.reset}\n`);

  const scoutNichos = extractNichosFromScout();
  const cacheNichos = loadNichosCache();

  if (Object.keys(scoutNichos).length > 0) {
    console.log(`${C.bright}NICHOS PADRAO (built-in):${C.reset}\n`);
    Object.entries(scoutNichos).forEach(([id, config]) => {
      console.log(`  ${C.cyan}${id}${C.reset}`);
      console.log(`    ${config.nome}`);
      console.log(`    Produto: ${C.green}${config.produto}${C.reset}`);
      console.log('');
    });
  }

  if (Object.keys(cacheNichos).length > 0) {
    console.log(`${C.bright}NICHOS CUSTOMIZADOS (criados por IA):${C.reset}\n`);
    Object.entries(cacheNichos).forEach(([id, config]) => {
      console.log(`  ${C.cyan}${id}${C.reset} ${C.dim}(${config.descricao_original})${C.reset}`);
      console.log(`    ${config.nome}`);
      console.log(`    Produto: ${C.green}${config.produto}${C.reset}`);
      console.log('');
    });
  }

  console.log(`${C.dim}Total: ${Object.keys(nichos).length} nichos${C.reset}`);
  console.log(`${C.dim}Criar novo: node 13-nicho-ai.js "descricao do nicho"${C.reset}\n`);
}

// Exportar funcoes para uso como modulo
module.exports = { detectOrCreateNicho, getAllNichos, listAllNichos };

// MAIN - so executa se for chamado diretamente (nao como modulo)
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`\n${C.cyan}NICHO AI - Sistema inteligente de nichos${C.reset}\n`);
    console.log('Uso:');
    console.log('  node 13-nicho-ai.js "personal trainers fitness"');
    console.log('  node 13-nicho-ai.js "advogados previdenciarios"');
    console.log('  node 13-nicho-ai.js "nutricionistas online"');
    console.log('  node 13-nicho-ai.js list\n');
    console.log('O sistema vai:');
    console.log('  1. Detectar se o nicho ja existe');
    console.log('  2. Se nao existir, criar automaticamente com IA');
    console.log('  3. Gerar ID, hashtags, keywords e estrategia\n');
    process.exit(0);
  }

  if (args[0] === 'list') {
    listAllNichos();
    process.exit(0);
  }

  const descricao = args.join(' ');

  if (!process.env.GROQ_API_KEY) {
    console.error(`${C.red}[NICHO-AI] GROQ_API_KEY nao encontrada no .env${C.reset}`);
    process.exit(1);
  }

  detectOrCreateNicho(descricao)
    .then(resultado => {
      process.exit(0);
    })
    .catch(err => {
      console.error(`${C.red}[NICHO-AI] Erro: ${err.message}${C.reset}`);
      process.exit(1);
    });
}
