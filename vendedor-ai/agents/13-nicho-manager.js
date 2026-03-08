// =============================================================
// MODULO 13: NICHO MANAGER - PRISMATIC LABS VENDEDOR AI
// Gerencia nichos customizados para cada cliente
//
// Comandos:
//   node 13-nicho-manager.js list
//   node 13-nicho-manager.js add <id> <nome> <produto> <dor>
//   node 13-nicho-manager.js edit <id>
//   node 13-nicho-manager.js remove <id>
// =============================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SCOUT_FILE = path.join(__dirname, '6-scout.js');

const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m'
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

function extractNichosFromScout() {
  const content = fs.readFileSync(SCOUT_FILE, 'utf8');
  const match = content.match(/const NICHOS = (\{[\s\S]*?\});/);
  if (!match) throw new Error('NICHOS nao encontrado em 6-scout.js');
  
  // eval é seguro aqui pois estamos lendo nosso próprio código
  const NICHOS = eval(`(${match[1]})`);
  return NICHOS;
}

function saveNichosToScout(nichos) {
  let content = fs.readFileSync(SCOUT_FILE, 'utf8');
  const nichosStr = JSON.stringify(nichos, null, 2)
    .replace(/"([^"]+)":/g, "'$1':")
    .replace(/: "([^"]*)"/g, ": '$1'")
    .replace(/: \[/g, ': [')
    .replace(/\]/g, ']');
  
  content = content.replace(
    /const NICHOS = \{[\s\S]*?\};/,
    `const NICHOS = ${nichosStr};`
  );
  
  fs.writeFileSync(SCOUT_FILE, content);
}

function listNichos() {
  const nichos = extractNichosFromScout();
  
  console.log(`\n${C.magenta}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.bright}  NICHOS CONFIGURADOS${C.reset}`);
  console.log(`${C.magenta}${'='.repeat(70)}${C.reset}\n`);

  Object.entries(nichos).forEach(([id, config]) => {
    console.log(`${C.bright}${id}${C.reset}`);
    console.log(`  Nome: ${C.cyan}${config.nome}${C.reset}`);
    console.log(`  Produto: ${C.green}${config.produto}${C.reset}`);
    console.log(`  Dor: ${config.dor_principal}`);
    console.log(`  Hashtags: ${config.hashtags.slice(0, 4).join(', ')}...`);
    console.log('');
  });

  console.log(`${C.dim}Total: ${Object.keys(nichos).length} nichos${C.reset}`);
  console.log(`${C.dim}Use: node 10-autopilot.js <nicho_id> <quantidade>${C.reset}\n`);
}

async function addNicho(id) {
  if (!id) {
    console.error(`${C.red}[NICHO] Informe o ID do nicho (ex: fitness, consultoria)${C.reset}`);
    process.exit(1);
  }

  const nichos = extractNichosFromScout();
  
  if (nichos[id]) {
    console.log(`${C.yellow}[NICHO] Nicho "${id}" ja existe. Use 'edit' para modificar.${C.reset}`);
    process.exit(1);
  }

  console.log(`\n${C.cyan}=== CRIANDO NOVO NICHO: ${id} ===${C.reset}\n`);

  const nome = await ask('Nome do nicho (ex: Personal Trainers e Studios): ');
  const produtoOpt = await ask('Produto (1=API, 2=Landing Page, 3=Ambos): ');
  const produto = produtoOpt === '1' ? 'Lead Normalizer API' : produtoOpt === '2' ? 'Landing Page Premium' : 'Lead Normalizer API + Landing Page';
  
  const dor = await ask('Dor principal do cliente: ');
  const perfil = await ask('Perfil ideal (ex: 1k-50k seguidores, posts sobre treinos): ');
  const abordagem = await ask('Como abordar (angulo de venda): ');
  
  console.log('\nHashtags (separe por virgula):');
  const hashtagsStr = await ask('Ex: #fitness,#personaltrainer,#academia: ');
  const hashtags = hashtagsStr.split(',').map(h => h.trim().startsWith('#') ? h.trim() : `#${h.trim()}`);
  
  console.log('\nKeywords da bio (separe por virgula):');
  const keywordsStr = await ask('Ex: personal trainer,fitness,musculacao: ');
  const keywords = keywordsStr.split(',').map(k => k.trim());
  
  console.log('\nExemplos de busca (um por linha, digite "fim" para terminar):');
  const exemplos = [];
  while (true) {
    const ex = await ask(`Exemplo ${exemplos.length + 1} (ou "fim"): `);
    if (ex.toLowerCase() === 'fim') break;
    if (ex) exemplos.push(ex);
  }

  nichos[id] = {
    nome,
    produto,
    hashtags,
    keywords_bio: keywords,
    perfil_ideal: perfil,
    dor_principal: dor,
    abordagem,
    exemplos_busca: exemplos.length > 0 ? exemplos : [`buscar ${hashtags[0]} > filtrar perfis com engagement alto`]
  };

  saveNichosToScout(nichos);

  console.log(`\n${C.green}[NICHO] ✅ Nicho "${id}" criado com sucesso!${C.reset}`);
  console.log(`${C.cyan}[NICHO] Teste: node 10-autopilot.js ${id} 10${C.reset}\n`);
  
  rl.close();
}

async function removeNicho(id) {
  if (!id) {
    console.error(`${C.red}[NICHO] Informe o ID do nicho${C.reset}`);
    process.exit(1);
  }

  const nichos = extractNichosFromScout();
  
  if (!nichos[id]) {
    console.error(`${C.red}[NICHO] Nicho "${id}" nao encontrado${C.reset}`);
    process.exit(1);
  }

  const confirm = await ask(`${C.yellow}Remover nicho "${id}"? (s/N): ${C.reset}`);
  if (confirm.toLowerCase() !== 's') {
    console.log('Cancelado.');
    rl.close();
    return;
  }

  delete nichos[id];
  saveNichosToScout(nichos);

  console.log(`${C.green}[NICHO] ✅ Nicho "${id}" removido${C.reset}\n`);
  rl.close();
}

const cmd = process.argv[2];
const arg = process.argv[3];

if (!cmd) {
  console.log(`\n${C.cyan}NICHO MANAGER - Gerenciar nichos customizados${C.reset}\n`);
  console.log('Comandos:');
  console.log('  node 13-nicho-manager.js list');
  console.log('  node 13-nicho-manager.js add <id>');
  console.log('  node 13-nicho-manager.js remove <id>\n');
  process.exit(0);
}

switch (cmd) {
  case 'list':
    listNichos();
    break;
  case 'add':
    addNicho(arg).catch(err => {
      console.error(`${C.red}[NICHO] Erro: ${err.message}${C.reset}`);
      rl.close();
      process.exit(1);
    });
    break;
  case 'remove':
    removeNicho(arg).catch(err => {
      console.error(`${C.red}[NICHO] Erro: ${err.message}${C.reset}`);
      rl.close();
      process.exit(1);
    });
    break;
  default:
    console.error(`${C.red}Comando desconhecido: ${cmd}${C.reset}`);
    process.exit(1);
}
