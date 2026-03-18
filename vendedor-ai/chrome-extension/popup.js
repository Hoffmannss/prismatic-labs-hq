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
  const cfg  = await getConfig();
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

  const synced   = cfg.sessionSynced;
  const badgeCls = synced ? 'badge-ok' : 'badge-warn';
  const badgeTxt = synced ? 'Ativa' : 'Pendente';
  const syncTime = cfg.lastSyncAt
    ? new Date(cfg.lastSyncAt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
    : null;

  card.innerHTML = `
    <div class="ig-card">
      <div class="ig-status-row">
        <div class="ig-avatar">📸</div>
        <div class="ig-info">
          <div class="ig-account">Instagram</div>
          <div class="ig-sub">${synced && syncTime ? 'Sync ' + syncTime : 'Aguardando login no Instagram'}</div>
        </div>
        <span class="ig-status-badge ${badgeCls}">${badgeTxt}</span>
      </div>
      <div class="auto-sync-info">⚡ Sincronização automática ativa</div>
      <button class="sync-btn secondary" id="syncBtn">↻ Forçar sync agora</button>
      <div class="status-msg" id="syncStatus"></div>
    </div>`;
  document.getElementById('syncBtn').addEventListener('click', manualSync);
}

async function manualSync() {
  const btn    = document.getElementById('syncBtn');
  const status = document.getElementById('syncStatus');
  btn.disabled = true;
  btn.textContent = '⏳ Sincronizando…';
  status.textContent = '';

  chrome.runtime.sendMessage({ type: 'MANUAL_SYNC' }, (resp) => {
    btn.disabled = false;
    btn.textContent = '↻ Forçar sync agora';
    if (resp?.ok) {
      status.textContent = '✅ Sincronizado com sucesso!';
      status.className = 'status-msg ok';
      renderIgCard();
    } else {
      status.textContent = '⚠ Falha — verifique se está logado no Instagram.';
      status.className = 'status-msg warn';
    }
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
