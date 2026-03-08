// =============================================================
// MODULO 1: ANALYZER AI - PRISMATIC LABS VENDEDOR AUTOMATICO
// Analisa perfil + posts e detecta produto ideal (API ou LP)
// Stack: Groq API (Llama 3.3 70B) - GRATIS
// =============================================================

require('dotenv').config();
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ---- CARREGAR KNOWLEDGE BASE ----
const nichosConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'nichos-config.json'), 'utf8'));
const produtos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'produtos.json'), 'utf8')).produtos;

// ---- DADOS DO LEAD ----
const username   = process.argv[2] || process.env.LEAD_USERNAME || 'exemplo_lead';
const bioText    = process.argv[3] || process.env.LEAD_BIO || '';
const followersCount = process.argv[4] || process.env.LEAD_FOLLOWERS || '0';
const postsCount = process.argv[5] || process.env.LEAD_POSTS || '0';
const postsDesc  = process.argv[6] || process.env.LEAD_POSTS_DESC || '';

// ---- MONTAR CONTEXTO DOS PRODUTOS ----
const api = produtos.find(p => p.id === 'lead-normalizer-api');
const nichosSinaisAPI = nichosConfig.nichos
  .filter(n => n.produto_alvo === 'lead_normalizer_api')
  .map(n => `- ${n.nome}: sinais [${n.sinais ? n.sinais.join(', ') : n.keywords.join(', ')}]`)
  .join('\n');

async function analyzeProfile() {
  console.log(`\n[ANALYZER] Iniciando analise do perfil: @${username}`);
  console.log(`[ANALYZER] Seguidores: ${followersCount} | Posts: ${postsCount}`);
  if (postsDesc) console.log(`[ANALYZER] Posts descritos: SIM ✓`);

  // Conteúdo completo do analyzer.js aqui...
  // (incluindo todo o prompt e lógica)
}

analyzeProfile();