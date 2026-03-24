// =============================================================
// NEGOCIO CONFIG — Configuração central do negócio do usuário
// Lido por: 1-analyzer, 2-copywriter, 7-reviewer, 13-nicho-ai
// Editado via: Dashboard → Configurações → Perfil do Negócio
// =============================================================

const fs   = require('fs');
const path = require('path');

// Arquivo REAL salvo pelo Dashboard (POST /api/business-profile)
const BP_FILE       = path.join(__dirname, 'business-profile.json');
// Fallback legado (se existir)
const SETTINGS_FILE = path.join(__dirname, 'dashboard-settings.json');

const DEFAULT_NEGOCIO = {
  descricao:    '',
  produto_nome: '',
  preco_faixa:  '',
  tom:          '',
  diferenciais: '',
  publico_alvo: '',
  problema:     '',
  instagram:    '',
  website:      '',
  configurado:  false
};

function loadNegocio() {
  // 1. Tentar ler business-profile.json (fonte primária — Dashboard)
  try {
    if (fs.existsSync(BP_FILE)) {
      const bp = JSON.parse(fs.readFileSync(BP_FILE, 'utf8'));
      // Mapear campos do dashboard (inglês) → formato interno (português)
      if (bp.company_name && bp.product) {
        return {
          descricao:    bp.value_prop
            ? `${bp.company_name} — ${bp.value_prop}${bp.problem ? '. Problema que resolve: ' + bp.problem : ''}`
            : `${bp.company_name} — ${bp.product}`,
          produto_nome: bp.product || '',
          preco_faixa:  bp.price || '',
          tom:          bp.tone || 'profissional',
          diferenciais: bp.differentials || '',
          publico_alvo: bp.target || '',
          problema:     bp.problem || '',
          instagram:    bp.instagram || '',
          website:      bp.website || '',
          segmento:     bp.segment || '',
          empresa:      bp.company_name || '',
          configurado:  true
        };
      }
    }
  } catch {}

  // 2. Fallback legado: dashboard-settings.json → { negocio: {...} }
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const s   = JSON.parse(raw);
      if (s.negocio && s.negocio.configurado) return { ...DEFAULT_NEGOCIO, ...s.negocio };
    }
  } catch {}

  return DEFAULT_NEGOCIO;
}

function buildContexto(negocio) {
  if (!negocio.configurado || !negocio.descricao) {
    return {
      resumo:   '(Negócio não configurado — use tom genérico de prospecção)',
      produto:  'Produto/serviço do usuário',
      preco:    '',
      prompt:   'Você está ajudando um empreendedor a prospectar clientes para seu negócio. Use tom profissional e focado em valor.'
    };
  }

  const preco = negocio.preco_faixa ? ` | Preço: ${negocio.preco_faixa}` : '';
  const diffs = negocio.diferenciais ? `\nDIFERENCIAIS: ${negocio.diferenciais}` : '';
  const target = negocio.publico_alvo ? `\nPÚBLICO-ALVO: ${negocio.publico_alvo}` : '';
  const problema = negocio.problema ? `\nPROBLEMA QUE RESOLVE: ${negocio.problema}` : '';
  const tom = negocio.tom ? `\nTOM: ${negocio.tom}` : '';

  return {
    resumo:  negocio.descricao,
    produto: negocio.produto_nome || negocio.descricao.split('.')[0],
    preco:   negocio.preco_faixa || '',
    prompt:  `NEGÓCIO DO USUÁRIO:\n${negocio.descricao}\nPRODUTO/SERVIÇO: ${negocio.produto_nome || 'conforme descrição acima'}${preco}${diffs}${target}${problema}${tom}`
  };
}

module.exports = { loadNegocio, buildContexto, DEFAULT_NEGOCIO };
