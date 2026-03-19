// =============================================================
// PRISMATIC CONNECT — BACKGROUND SERVICE WORKER
// Auto-sync de sessão Instagram + monitor de respostas
// =============================================================

// ── Instalação ────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isEnabled:       true,
    detectedReplies: [],
    sessionSynced:   false,
    lastSyncAt:      null
  });
  console.log('[Prismatic Connect] Extensão instalada.');
  autoSyncSession('install');
});

// Toda vez que o Chrome abre, re-sincroniza a sessão existente
chrome.runtime.onStartup.addListener(() => {
  console.log('[Prismatic Connect] Chrome iniciou — verificando sessão...');
  autoSyncSession('startup');
});

// ── Auto-sync via cookie change ───────────────────────────────
// Dispara automaticamente sempre que o sessionid do Instagram muda
// (login, renovação de token, etc.) — sem nenhuma ação do usuário
chrome.cookies.onChanged.addListener((changeInfo) => {
  const { cookie, removed } = changeInfo;
  if (removed) return;
  if (cookie.domain !== '.instagram.com' && cookie.domain !== 'instagram.com') return;
  if (cookie.name !== 'sessionid') return;

  console.log('[Prismatic Connect] sessionid detectado — sincronizando...');
  autoSyncSession('cookie_change');
});

// ── Função de sync ────────────────────────────────────────────
async function autoSyncSession(source) {
  const cfg = await storageGet(['vpsUrl', 'authToken']);
  if (!cfg.vpsUrl || !cfg.authToken) return; // extensão não configurada ainda

  // Lê sessionid atual do browser
  const sessionCookie = await getCookie('https://www.instagram.com', 'sessionid');
  if (!sessionCookie) return; // usuário não está logado no Instagram

  // Lê ds_user_id se disponível (identifica a conta)
  const dsCookie = await getCookie('https://www.instagram.com', 'ds_user_id');

  try {
    const body = { sessionid: sessionCookie.value, source };
    if (dsCookie?.value) body.ds_user_id = dsCookie.value;

    const res = await fetch(`${cfg.vpsUrl}/api/instagram/import-session`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${cfg.authToken}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      const now = new Date().toISOString();
      await storageSet({ sessionSynced: true, lastSyncAt: now });
      console.log(`[Prismatic Connect] Sessão sincronizada automaticamente (${source})`);

      // Notificação discreta só no primeiro sync (não em cada renovação)
      if (source === 'install' || source === 'cookie_change') {
        chrome.notifications.create({
          type:    'basic',
          iconUrl: 'icons/icon48.png',
          title:   'Prismatic Connect',
          message: 'Sessão Instagram sincronizada com o Vendedor AI ✓'
        });
      }
    } else {
      console.warn('[Prismatic Connect] Sync falhou:', data.error || res.status);
      // Token expirado — limpa sessão para forçar relogin no options
      if (res.status === 401) {
        await storageSet({ authToken: '', sessionSynced: false });
      }
    }
  } catch (e) {
    console.error('[Prismatic Connect] Erro no auto-sync:', e.message);
  }
}

// ── Monitor de Respostas ──────────────────────────────────────
const lastCheckedMessages = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_MESSAGE_DETECTED') {
    handleNewMessage(message.data);
    sendResponse({ ok: true });
  }

  if (message.type === 'GET_STATUS') {
    chrome.storage.local.get(['isEnabled', 'detectedReplies', 'sessionSynced', 'lastSyncAt'], (data) => {
      sendResponse({
        isEnabled:      data.isEnabled,
        totalDetected:  (data.detectedReplies || []).length,
        sessionSynced:  data.sessionSynced,
        lastSyncAt:     data.lastSyncAt
      });
    });
    return true;
  }

  if (message.type === 'TOGGLE_MONITORING') {
    chrome.storage.local.get(['isEnabled'], (data) => {
      const newState = !data.isEnabled;
      chrome.storage.local.set({ isEnabled: newState });
      sendResponse({ isEnabled: newState });
    });
    return true;
  }

  if (message.type === 'MANUAL_SYNC') {
    autoSyncSession('manual').then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
});

async function handleNewMessage(data) {
  const { username, messageText, timestamp } = data;
  const messageId = `${username}_${messageText.substring(0, 40)}`;
  if (lastCheckedMessages.has(messageId)) return;
  lastCheckedMessages.add(messageId);
  if (lastCheckedMessages.size > 100) {
    lastCheckedMessages.delete(lastCheckedMessages.values().next().value);
  }

  console.log(`[Prismatic Connect] Resposta detectada: @${username}`);

  // Salva localmente
  chrome.storage.local.get(['detectedReplies'], (result) => {
    const replies = result.detectedReplies || [];
    replies.push({ username, messageText, timestamp, detected_at: Date.now() });
    if (replies.length > 50) replies.shift();
    chrome.storage.local.set({ detectedReplies: replies });
  });

  // Envia para VPS (usa vpsUrl do storage, não localhost hardcoded)
  const cfg = await storageGet(['vpsUrl', 'authToken', 'isEnabled']);
  if (!cfg.isEnabled || !cfg.vpsUrl || !cfg.authToken) return;

  try {
    const res = await fetch(`${cfg.vpsUrl}/api/tracker`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${cfg.authToken}`
      },
      body: JSON.stringify({
        username:  username.replace('@', ''),
        action:    'respondeu',
        extra:     `Auto-detectado: ${messageText.substring(0, 50)}`
      })
    });

    if (res.ok) {
      chrome.notifications.create({
        type:    'basic',
        iconUrl: 'icons/icon48.png',
        title:   'Prismatic Connect',
        message: `@${username} respondeu! Registrado no Vendedor AI.`
      });
    }
  } catch (e) {
    console.error('[Prismatic Connect] Erro ao enviar tracker:', e.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────
function getCookie(url, name) {
  return new Promise(resolve => chrome.cookies.get({ url, name }, resolve));
}

function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function storageSet(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}
