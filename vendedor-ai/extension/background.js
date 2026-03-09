// =============================================================
// VENDEDOR IA - DM MONITOR EXTENSION
// Background Service Worker (Manifest V3)
// =============================================================

const WEBHOOK_URL = 'http://localhost:3131/api/tracker';
const CHECK_INTERVAL = 5000; // 5 segundos

let monitoringActive = true;
let lastProcessedMessages = new Set();

// Load state from storage on startup
chrome.storage.local.get(['monitoringActive', 'lastProcessed'], (data) => {
  if (data.monitoringActive !== undefined) {
    monitoringActive = data.monitoringActive;
  }
  if (data.lastProcessed) {
    lastProcessedMessages = new Set(data.lastProcessed);
  }
  console.log('[DM Monitor] Iniciado. Monitoring:', monitoringActive);
});

// Listen to messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_DM_DETECTED') {
    handleNewDM(message.data);
    sendResponse({ ok: true });
  }
  
  if (message.type === 'GET_STATUS') {
    sendResponse({ 
      active: monitoringActive,
      processed: lastProcessedMessages.size 
    });
  }
  
  if (message.type === 'TOGGLE_MONITORING') {
    monitoringActive = !monitoringActive;
    chrome.storage.local.set({ monitoringActive });
    sendResponse({ active: monitoringActive });
  }
  
  return true; // Keep channel open for async response
});

// Handle new DM detected
async function handleNewDM(data) {
  const { username, messageText, timestamp } = data;
  const messageId = `${username}_${timestamp}`;
  
  // Skip if already processed
  if (lastProcessedMessages.has(messageId)) {
    console.log('[DM Monitor] Já processado:', username);
    return;
  }
  
  if (!monitoringActive) {
    console.log('[DM Monitor] Monitoring desativado, ignorando');
    return;
  }
  
  console.log('[DM Monitor] Nova resposta detectada:', username);
  
  // Send webhook to backend
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.replace('@', ''),
        action: 'respondeu',
        extra: messageText ? messageText.substring(0, 100) : ''
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      // Mark as processed
      lastProcessedMessages.add(messageId);
      
      // Keep only last 1000 messages in memory
      if (lastProcessedMessages.size > 1000) {
        const arr = Array.from(lastProcessedMessages);
        lastProcessedMessages = new Set(arr.slice(-1000));
      }
      
      // Save to storage
      chrome.storage.local.set({ 
        lastProcessed: Array.from(lastProcessedMessages) 
      });
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'DM Detectada',
        message: `@${username} respondeu! Registrado no sistema.`,
        priority: 2
      });
      
      console.log('[DM Monitor] ✅ Registrado:', username);
    } else {
      console.error('[DM Monitor] ❌ Erro no webhook:', result.error);
    }
  } catch (err) {
    console.error('[DM Monitor] ❌ Erro ao enviar webhook:', err);
  }
}

// Badge update
function updateBadge() {
  if (monitoringActive) {
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    chrome.action.setBadgeText({ text: '✓' });
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    chrome.action.setBadgeText({ text: '✗' });
  }
}

// Update badge on startup and when monitoring changes
updateBadge();
chrome.storage.onChanged.addListener((changes) => {
  if (changes.monitoringActive) {
    monitoringActive = changes.monitoringActive.newValue;
    updateBadge();
  }
});
