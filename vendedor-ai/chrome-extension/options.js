// =============================================================
// PRISMATIC CONNECT — OPTIONS PAGE LOGIC
// =============================================================

// ── Inicialização ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadSavedSettings();
  await refreshIgStatus();
});

async function loadSavedSettings() {
  const data = await storageGet(['vpsUrl', 'authUser', 'authToken', 'sessionSynced']);
  if (data.vpsUrl)   document.getElementById('vpsUrl').value   = data.vpsUrl;
  if (data.authUser) document.getElementById('authUser').value = data.authUser;
}

// ── Salvar e Conectar ─────────────────────────────────────────
async function saveAndConnect() {
  const btn      = document.getElementById('saveBtn');
  const vpsUrl   = document.getElementById('vpsUrl').value.trim().replace(/\/$/, '');
  const authUser = document.getElementById('authUser').value.trim();
  const authPass = document.getElementById('authPass').value;

  // Validação básica
  if (!vpsUrl) {
    return showStatus('Informe a URL da VPS.', 'err');
  }
  if (!vpsUrl.startsWith('http')) {
    return showStatus('URL inválida. Use http:// ou https://', 'err');
  }
  if (!authUser || !authPass) {
    return showStatus('Informe usuário e senha.', 'err');
  }

  btn.disabled    = true;
  btn.textContent = 'Conectando…';
  showStatus('', '');

  try {
    const res = await fetch(`${vpsUrl}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: authUser, password: authPass }),
      signal:  AbortSignal.timeout(10000)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.token) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }

    // Salva config completa
    await storageSet({
      vpsUrl,
      authUser,
      authToken:     data.token,
      sessionSynced: false
    });

    showStatus('✅ Conectado com sucesso! Configurações salvas.', 'ok');
    await refreshIgStatus();

  } catch (e) {
    const msg = e.name === 'TimeoutError'
      ? 'Timeout — VPS não respondeu. Verifique a URL e se o servidor está online.'
      : e.message;
    showStatus(`⚠ ${msg}`, 'err');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Salvar e Conectar';
  }
}

// ── Desconectar ───────────────────────────────────────────────
async function clearSession() {
  await storageSet({
    vpsUrl:        '',
    authUser:      '',
    authToken:     '',
    sessionSynced: false,
    detectedReplies: [],
    igAccount:     ''
  });

  document.getElementById('vpsUrl').value   = '';
  document.getElementById('authUser').value = '';
  document.getElementById('authPass').value = '';

  setIgDot(false);
  document.getElementById('igStatusText').textContent = 'Desconectado';
  showStatus('Dados limpos. Configure novamente para reconectar.', 'ok');
}

// ── Status da Sessão Instagram ────────────────────────────────
async function refreshIgStatus() {
  const data = await storageGet(['vpsUrl', 'authToken', 'sessionSynced', 'igAccount']);

  if (!data.vpsUrl || !data.authToken) {
    setIgDot(false);
    document.getElementById('igStatusText').textContent = 'Não configurado';
    return;
  }

  // Tenta pingar o servidor para verificar se sessão IG está ativa
  try {
    const res = await fetch(`${data.vpsUrl}/api/instagram/session-status`, {
      headers: { 'Authorization': `Bearer ${data.authToken}` },
      signal:  AbortSignal.timeout(5000)
    });

    if (res.ok) {
      const info = await res.json().catch(() => ({}));
      const active = info.active || data.sessionSynced;
      setIgDot(active);
      document.getElementById('igStatusText').textContent = active
        ? `Sessão ativa${info.account ? ' — @' + info.account : ''}`
        : 'Servidor conectado · Sessão Instagram pendente';
    } else {
      setIgDot(false);
      document.getElementById('igStatusText').textContent = 'Servidor conectado · Sessão não sincronizada';
    }
  } catch {
    // Servidor offline ou endpoint inexistente — usa sessionSynced como fallback
    setIgDot(!!data.sessionSynced);
    document.getElementById('igStatusText').textContent = data.sessionSynced
      ? 'Sessão sincronizada (servidor offline no momento)'
      : 'Servidor offline ou URL incorreta';
  }
}

// ── Helpers ───────────────────────────────────────────────────
function setIgDot(active) {
  const dot = document.getElementById('igDot');
  dot.className = active ? 'ig-dot ok' : 'ig-dot';
}

function showStatus(msg, type) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className   = type ? type : '';
}

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function storageSet(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}
