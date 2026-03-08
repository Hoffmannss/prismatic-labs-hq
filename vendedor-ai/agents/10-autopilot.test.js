// =============================================================
// AUTOPILOT TEST MODE - Pula Apify, usa leads ficticios
// Testa fluxo completo: Analyzer -> Copywriter -> Notion -> Learner
// =============================================================

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const PERSONAS = {
  'api-automacao': [
    {
      username: 'teste_makeautomation',
      bio: 'Make.com Builder | Automating workflows for SaaS companies',
      seguidores: 1250,
      posts: 45,
      posts_descritos: 'Recent post about n8n integration issues with phone number formatting breaking flows'
    },
    {
      username: 'teste_zapierexpert',
      bio: 'Zapier Certified | Helping businesses automate everything',
      seguidores: 890,
      posts: 32,
      posts_descritos: 'Post complaining about lead data validation errors in Make.com scenarios'
    },
    {
      username: 'teste_n8nbuilder',
      bio: 'n8n workflows | Low-code automation specialist',
      seguidores: 2100,
      posts: 67,
      posts_descritos: 'Tutorial about handling Brazilian phone formats in automation tools'
    }
  ],
  'infoprodutores': [
    {
      username: 'teste_lancadorpro',
      bio: 'Lancamentos digitais 7 figuras | Mentor de infoprodutores',
      seguidores: 15000,
      posts: 120,
      posts_descritos: 'Post showing launch results with low landing page conversion (3%)'
    },
    {
      username: 'teste_expertdigital',
      bio: 'Criador de cursos online | R$ 2M+ em vendas',
      seguidores: 8500,
      posts: 89,
      posts_descritos: 'Complaining about generic landing pages not converting traffic'
    }
  ]
};

async function runCommand(cmd, label) {
  console.log(`\n[ORCHESTRATOR] Executando: ${label}`);
  try {
    const { stdout, stderr } = await execPromise(cmd, { 
      cwd: __dirname,
      env: { ...process.env, FORCE_COLOR: '0' }
    });
    if (stderr && !stderr.includes('ExperimentalWarning')) console.error(stderr);
    console.log(stdout);
    return { success: true, output: stdout };
  } catch (error) {
    console.error(`[ORCHESTRATOR] ERRO em ${label}`);
    console.error(error.message);
    return { success: false, error: error.message };
  }
}

async function testAutopilot() {
  const nicho = process.argv[2] || 'api-automacao';
  const maxAnalyze = parseInt(process.argv[3]) || 2;

  console.log(`\n================================================================`);
  console.log(`  AUTOPILOT TEST MODE - ${nicho}`);
  console.log(`================================================================`);
  console.log(`  Mode: TESTE (sem Apify, leads ficticios)`);
  console.log(`  Max analyze: ${maxAnalyze}`);

  const leads = PERSONAS[nicho] || PERSONAS['api-automacao'];
  const toAnalyze = leads.slice(0, maxAnalyze);

  console.log(`\n[TEST] Usando ${toAnalyze.length} leads ficticios...\n`);

  let successCount = 0;

  for (let i = 0; i < toAnalyze.length; i++) {
    const lead = toAnalyze[i];
    console.log(`\n[${ i+1}/${toAnalyze.length}] @${lead.username} | ${lead.seguidores} followers`);
    console.log(`\n============================================================`);
    console.log(`  VENDEDOR AI — ANALISANDO @${lead.username}`);
    console.log(`  Posts descritos: SIM ✨`);
    console.log(`============================================================`);

    // STEP 1: Analyzer
    console.log(`\n[STEP 1/4] Analisando perfil + posts...\n`);
    const analyzeCmd = `node 1-analyzer.js ${lead.username} "${lead.bio}" ${lead.seguidores} ${lead.posts} "${lead.posts_descritos}"`;
    const analyzeResult = await runCommand(analyzeCmd, `1-analyzer.js ${lead.username}`);

    if (!analyzeResult.success) {
      console.log(`Falha no Analyzer. Pulando lead.\n`);
      continue;
    }

    // STEP 2: Copywriter
    console.log(`\n[STEP 2/4] Gerando mensagem personalizada...\n`);
    const copyCmd = `node 2-copywriter.js ${lead.username}`;
    const copyResult = await runCommand(copyCmd, `2-copywriter.js ${lead.username}`);

    if (!copyResult.success) {
      console.log(`Falha no Copywriter. Abortando.\n`);
      continue;
    }

    // STEP 3: Notion Sync (opcional)
    console.log(`\n[STEP 3/4] Salvando no Notion...\n`);
    if (process.env.NOTION_API_KEY) {
      const notionCmd = `node 9-notion-sync.js ${lead.username}`;
      await runCommand(notionCmd, `9-notion-sync.js ${lead.username}`);
    } else {
      console.log(`[SKIP] NOTION_API_KEY nao encontrada`);
    }

    successCount++;
  }

  // STEP 4: Learning
  console.log(`\n[4/4] Atualizando memoria de aprendizado...\n`);
  await runCommand('node 11-learner.js', '11-learner.js');

  console.log(`\n================================================================`);
  console.log(`  AUTOPILOT TEST CONCLUIDO`);
  console.log(`  ✓ ${toAnalyze.length} leads testados`);
  console.log(`  ✓ ${successCount} analisados com sucesso`);
  console.log(`  → Dashboard: node 8-dashboard.js  —  http://localhost:3131`);
  console.log(`================================================================\n`);
}

testAutopilot().catch(err => {
  console.error('\n[TEST ERROR]', err);
  process.exit(1);
});
