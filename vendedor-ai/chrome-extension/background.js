// =============================================================
// VENDEDOR IA - CHROME EXTENSION BACKGROUND SERVICE WORKER
// Processa notificações de mensagens e dispara webhooks
// =============================================================

const WEBHOOK_URL = 'http://localhost:3131/api/tracker';
const CHECK_INTERVAL = 10000; // 10 segundos

let lastCheckedMessages = new Set();
let isMonitoring = false;

// Configurações padrão
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    webhookUrl: WEBHOOK_URL,
    checkInterval: CHECK_INTERVAL,
    isEnabled: true,
    detectedReplies: []
  });
  console.log('[Vendedor IA] Extension installed');
});

// Recebe mensagens do content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NEW_MESSAGE_DETECTED') {
    handleNewMessage(message.data);
    sendResponse({ ok: true });
  }
  
  if (message.type === 'GET_STATUS') {
    chrome.storage.local.get(['isEnabled', 'detectedReplies'], (data) => {
      sendResponse({ 
        isEnabled: data.isEnabled, 
        totalDetected: (data.detectedReplies || []).length 
      });
    });
    return true; // Will respond asynchronously
  }
  
  if (message.type === 'TOGGLE_MONITORING') {
    chrome.storage.local.get(['isEnabled'], (data) => {
      const newState = !data.isEnabled;
      chrome.storage.local.set({ isEnabled: newState });
      sendResponse({ isEnabled: newState });
    });
    return true;
  }
});

// Processa nova mensagem detectada
async function handleNewMessage(data) {
  const { username, messageText, timestamp } = data;
  
  // Evita duplicatas
  const messageId = `${username}_${timestamp}`;
  if (lastCheckedMessages.has(messageId)) {
    return;
  }
  lastCheckedMessages.add(messageId);
  
  // Limita tamanho do Set
  if (lastCheckedMessages.size > 100) {
    const firstItem = lastCheckedMessages.values().next().value;
    lastCheckedMessages.delete(firstItem);
  }
  
  console.log(`[Vendedor IA] Nova resposta detectada: @${username}`);
  
  // Salva no storage
  chrome.storage.local.get(['detectedReplies'], (result) => {
    const replies = result.detectedReplies || [];
    replies.push({ username, messageText, timestamp, detected_at: Date.now() });
    
    // Mantém apenas últimas 50
    if (replies.length > 50) replies.shift();
    
    chrome.storage.local.set({ detectedReplies: replies });
  });
  
  // Dispara webhook
  chrome.storage.local.get(['webhookUrl', 'isEnabled'], async (config) => {
    if (!config.isEnabled) return;
    
    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.replace('@', ''),
          action: 'respondeu',
          extra: `Auto-detectado: ${messageText.substring(0, 50)}...`
        })
      });
      
      if (response.ok) {
        console.log(`[Vendedor IA] Webhook enviado com sucesso para @${username}`);
        
        // Notificação
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Vendedor IA - Resposta Detectada',
          message: `@${username} respondeu! Tracker atualizado automaticamente.`
        });
      } else {
        console.error('[Vendedor IA] Erro ao enviar webhook:', response.status);
      }
    } catch (error) {
      console.error('[Vendedor IA] Erro na requisição webhook:', error);
    }
  });
}

// Health check periódico
setInterval(() => {
  chrome.storage.local.get(['isEnabled'], (data) => {
    if (data.isEnabled) {
      console.log('[Vendedor IA] Monitoring active');
    }
  });
}, 60000); // A cada 1 minuto
