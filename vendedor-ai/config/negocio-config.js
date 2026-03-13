// =============================================================
// NEGOCIO CONFIG — Configuração central do negócio do usuário
// Lido por: 1-analyzer, 2-copywriter, 13-nicho-ai
// Editado via: Dashboard → Configurações → Meu Negócio
// =============================================================

const fs   = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'dashboard-settings.json');

const DEFAULT_NEGOCIO = {
  descricao:    '',   // "Sou personal trainer. Vendo plano de 3 meses para emagrecer"
  produto_nome: '',   // "Plano Personal Online"
  preco_faixa:  '',   // "R$500/mês" (opcional)
  configurado:  false
};

function loadNegocio() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const s   = JSON.parse(raw);
    if (s.negocio && s.negocio.configurado) return { ...DEFAULT_NEGOCIO, ...s.negocio };
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
  return {
    resumo:  `${negocio.descricao}`,
    produto: negocio.produto_nome || negocio.descricao.split('.')[0],
    preco:   negocio.preco_faixa || '',
    prompt:  `NEGÓCIO DO USUÁRIO:\n${negocio.descricao}\nPRODUTO/SERVIÇO: ${negocio.produto_nome || 'conforme descrição acima'}${preco}`
  };
}

module.exports = { loadNegocio, buildContexto, DEFAULT_NEGOCIO };
