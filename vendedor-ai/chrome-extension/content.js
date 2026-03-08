// =============================================================
// VENDEDOR IA - CHROME EXTENSION CONTENT SCRIPT
// Monitora a página do Instagram Direct e detecta novas mensagens
// =============================================================

const PRISMATIC_PREFIX = '[Vendedor IA]';
let observedUsers = new Set();
let isInitialized = false;

console.log(`${PRISMATIC_PREFIX} Content script carregado`);

// Aguarda a página carregar completamente
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  if (isInitialized) return;
  isInitialized = true;
  
  console.log(`${PRISMATIC_PREFIX} Inicializando monitor...`);
  
  // Verifica se está na página de Direct
  if (window.location.pathname.includes('/direct')) {
    startMonitoring();
  }
  
  // Monitora mudanças de URL (SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (url.includes('/direct')) {
        console.log(`${PRISMATIC_PREFIX} Navegou para Direct, reiniciando monitor`);
        startMonitoring();
      }
    }
  }).observe(document, { subtree: true, childList: true });
}

function startMonitoring() {
  console.log(`${PRISMATIC_PREFIX} Monitor ativo na página Direct`);
  
  // Observer para detectar novas mensagens
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          checkForNewMessages(node);
        }
      });
    });
  });
  
  // Observa o container principal de mensagens
  const messageContainer = document.querySelector('[role="main"]');
  if (messageContainer) {
    observer.observe(messageContainer, {
      childList: true,
      subtree: true
    });
    console.log(`${PRISMATIC_PREFIX} Observer configurado no container de mensagens`);
  } else {
    console.warn(`${PRISMATIC_PREFIX} Container de mensagens não encontrado, tentando novamente em 2s`);
    setTimeout(startMonitoring, 2000);
  }
  
  // Verifica mensagens existentes ao carregar
  setTimeout(() => {
    const existingMessages = document.querySelectorAll('[role="main"] [data-testid="message-container"]');
    console.log(`${PRISMATIC_PREFIX} Encontradas ${existingMessages.length} mensagens existentes`);
  }, 1000);
}

function checkForNewMessages(element) {
  // Detecta elementos de mensagem do Instagram
  // Instagram usa estrutura dinâmica, então verificamos múltiplos seletores
  
  const messageSelectors = [
    '[data-testid="message-container"]',
    '[role="listitem"]',
    '.x1n2onr6' // Classe genérica de mensagem (pode mudar)
  ];
  
  messageSelectors.forEach(selector => {
    const messages = element.matches ? 
      (element.matches(selector) ? [element] : element.querySelectorAll(selector)) :
      element.querySelectorAll(selector);
    
    messages.forEach(msg => processMessage(msg));
  });
}

function processMessage(messageElement) {
  try {
    // Extrai username da conversa atual
    const username = extractUsername();
    if (!username) return;
    
    // Extrai texto da mensagem
    const messageText = extractMessageText(messageElement);
    if (!messageText) return;
    
    // Verifica se é mensagem RECEBIDA (não enviada por você)
    const isReceived = isReceivedMessage(messageElement);
    if (!isReceived) return;
    
    // Cria ID único para evitar duplicatas
    const messageId = `${username}_${messageText.substring(0, 30)}`;
    
    if (observedUsers.has(messageId)) return;
    observedUsers.add(messageId);
    
    // Limita tamanho do Set
    if (observedUsers.size > 200) {
      const firstItem = observedUsers.values().next().value;
      observedUsers.delete(firstItem);
    }
    
    console.log(`${PRISMATIC_PREFIX} Nova mensagem de @${username}: "${messageText.substring(0, 50)}..."`);
    
    // Envia para background script
    chrome.runtime.sendMessage({
      type: 'NEW_MESSAGE_DETECTED',
      data: {
        username,
        messageText,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    console.error(`${PRISMATIC_PREFIX} Erro ao processar mensagem:`, error);
  }
}

function extractUsername() {
  // Tenta extrair username do header da conversa
  const headerSelectors = [
    'header a[href*="/"]',
    '[role="button"] a[href*="/"]',
    'a[role="link"][href*="/"]'
  ];
  
  for (const selector of headerSelectors) {
    const link = document.querySelector(selector);
    if (link && link.href) {
      const match = link.href.match(/instagram\.com\/([^\/\?]+)/);
      if (match && match[1] && match[1] !== 'direct') {
        return match[1];
      }
    }
  }
  
  return null;
}

function extractMessageText(element) {
  // Tenta extrair texto da mensagem
  const textElements = element.querySelectorAll('[dir="auto"]');
  if (textElements.length > 0) {
    const text = Array.from(textElements)
      .map(el => el.textContent.trim())
      .filter(t => t.length > 0)
      .join(' ');
    return text.substring(0, 200); // Limita tamanho
  }
  
  return element.textContent.trim().substring(0, 200);
}

function isReceivedMessage(element) {
  // Mensagens recebidas normalmente estão à esquerda
  // Mensagens enviadas à direita
  // Instagram usa flex-direction ou justify-content pra isso
  
  const style = window.getComputedStyle(element);
  const parent = element.parentElement;
  const parentStyle = parent ? window.getComputedStyle(parent) : null;
  
  // Verifica alinhamento (mensagens recebidas geralmente flex-start)
  if (parentStyle?.justifyContent === 'flex-start') return true;
  if (parentStyle?.justifyContent === 'flex-end') return false;
  
  // Fallback: verifica posição horizontal
  const rect = element.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  
  // Se mensagem está no lado esquerdo da tela (< 50% da largura)
  return rect.left < windowWidth * 0.5;
}

// Listener para comandos externos
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkStatus') {
    sendResponse({ 
      active: isInitialized, 
      observedCount: observedUsers.size,
      currentUrl: window.location.href
    });
  }
});
