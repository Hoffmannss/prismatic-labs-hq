// =============================================================
// PRISMATIC CONNECT — POPUP LOGIC
// =============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await renderIgCard();
  await renderMonitor();
  document.getElementById('settingsBtn').addEventListener('click', openOptions);
  document.getElementById('monitorToggle').addEventListener('click', toggleMonitor);
});

// ── Configurações ────────────────────────────────────────────
function openOptions() {
  chrome.runtime.openOptionsPage();
}

async function getConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get(['vpsUrl', 'authToken', 'igAccount', 'sessionSynced'], resolve);
  });
}

// ── Instagram Session ─────────────────────────────────────────
async function renderIgCard() {
  const cfg = await getConfig();
  const card = document.getElementById('igCard');

  if (!cfg.vpsUrl || !cfg.authToken) {
    card.innerHTML = `
      <div class="not-configured">
        Configure sua VPS para começar.<br>
        <span class="config-link" id="openOptionsLink">Abrir Configurações →</span>
      </div>`;
    document.getElementById('openOptionsLink').addEventListener('click', openOptions);
    return;
  }

  const account  = cfg.igAccount || '@sua_conta';
  const synced   = cfg.sessionSynced;
  const badgeCls = synced ? 'badge-ok' : 'badge-warn';
  const badgeTxt = synced ? 'Ativa' : 'Pendente';

  card.innerHTML = `
    <div class="ig-card">
      <div class="ig-status-row">
        <div class="ig-avatar">📸</div>
        <div class="ig-info">
          <div class="ig-account">${account}</div>
        </div>
        <span class="ig-status-badge ${badgeCls}">${badgeTxt}</span>
      </div>
      <button class="sync-btn" id="syncBtn">
        🔄 Sincronizar Sessão com VPS
      </button>
      <div class="status-msg" id="syncStatus"></div>
    </div>`;
  document.getElementById('syncBtn').addEventListener('click', syncSession);
}

async function syncSession() {
  const btn    = document.getElementById('syncBtn');
  const status = document.getElementById('syncStatus');
  const cfg    = await getConfig();

  if (!cfg.vpsUrl || !cfg.authToken) {
    status.textContent = '⚠ Configure a VPS primeiro.';
    status.className = 'status-msg warn';
    return;
  }

  btn.disabled    = true;
  btn.textContent = '⏳ Lendo sessão…';
  status.textContent = '';
  status.className = 'status-msg';

  // Lê sessionid cookie do instagram.com
  chrome.cookies.get({ url: 'https://www.instagram.com', name: 'sessionid' }, async (cookie) => {
    if (!cookie || !cookie.value) {
      btn.disabled    = false;
      btn.textContent = '🔄 Sincronizar Sessão com VPS';
      status.textContent = '⚠ Faça login no Instagram primeiro e tente novamente.';
      status.className = 'status-msg warn';
      return;
    }

    btn.textContent = '⏳ Enviando para VPS…';

    // Lê também ds_user_id se disponível
    chrome.cookies.get({ url: 'https://www.instagram.com', name: 'ds_user_id' }, async (dsCookie) => {
      try {
        const body = { sessionid: cookie.value };
        if (dsCookie?.value) body.ds_user_id = dsCookie.value;

        const res = await fetch(`${cfg.vpsUrl}/api/instagram/import-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cfg.authToken}`
          },
          body: JSON.stringify(body)
        });

        const data = await res.json();

        if (data.ok) {
          chrome.storage.local.set({ sessionSynced: true });
          btn.disabled    = false;
          btn.textContent = '✓ Sessão Sincronizada';
          status.textContent = '✅ Sessão enviada com sucesso! O Vendedor AI já pode enviar DMs.';
          status.className = 'status-msg ok';
          // Atualiza badge
          const badge = document.querySelector('.ig-status-badge');
          if (badge) { badge.className = 'ig-status-badge badge-ok'; badge.textContent = 'Ativa'; }
          setTimeout(() => { btn.textContent = '🔄 Sincronizar Sessão com VPS'; }, 3000);
        } else {
          throw new Error(data.error || 'Erro desconhecido');
        }
      } catch (e) {
        btn.disabled    = false;
        btn.textContent = '🔄 Sincronizar Sessão com VPS';
        status.textContent = `⚠ ${e.message}`;
        status.className = 'status-msg err';
      }
    });
  });
}

// ── Monitor de Respostas ──────────────────────────────────────
async function renderMonitor() {
  const data = await new Promise(r => chrome.storage.local.get(['isEnabled', 'detectedReplies'], r));

  const isOn   = data.isEnabled !== false;
  const toggle = document.getElementById('monitorToggle');
  const label  = document.getElementById('monitorLabel');
  const total  = document.getElementById('totalDetected');
  const list   = document.getElementById('recentList');

  toggle.className = `toggle-pill ${isOn ? 'on' : 'off'}`;
  label.textContent = isOn ? 'Ativo' : 'Inativo';

  const replies = data.detectedReplies || [];
  total.textContent = replies.length;

  if (replies.length === 0) {
    list.innerHTML = '<div class="empty">Nenhuma resposta ainda</div>';
    return;
  }

  const recent = replies.slice(-5).reverse();
  list.innerHTML = recent.map(r => {
    const t = new Date(r.detected_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    return `<div class="recent-item">
      <span class="recent-user">@${r.username}</span>
      <span class="recent-time">${t}</span>
    </div>`;
  }).join('');
}

async function toggleMonitor() {
  const data  = await new Promise(r => chrome.storage.local.get(['isEnabled'], r));
  const newVal = data.isEnabled === false ? true : !data.isEnabled;
  chrome.storage.local.set({ isEnabled: newVal }, () => renderMonitor());
  chrome.runtime.sendMessage({ type: 'TOGGLE_MONITORING' });
}
