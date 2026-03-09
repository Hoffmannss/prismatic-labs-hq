// =============================================================
// VENDEDOR IA - DM MONITOR EXTENSION
// Content Script (injected on Instagram pages)
// =============================================================

let observerActive = false;
let lastCheck = Date.now();
const CHECK_DEBOUNCE = 2000; // 2 segundos entre checks

// Check if we're on Instagram Direct inbox
function isInboxPage() {
  return window.location.pathname.includes('/direct/');
}

// Extract username from DM thread
function extractUsername(element) {
  try {
    // Try to find username in thread header
    const headerLinks = element.querySelectorAll('a[href*="/"]');
    for (const link of headerLinks) {
      const href = link.getAttribute('href');
      if (href && href.startsWith('/') && !href.includes('/direct/')) {
        const username = href.replace('/', '').split('/')[0];
        if (username && username.length > 0 && username !== 'direct') {
          return username;
        }
      }
    }
    
    // Fallback: try to find in text content
    const textElements = element.querySelectorAll('[role="heading"]');
    for (const el of textElements) {
      const text = el.textContent.trim();
      if (text && !text.includes(' ') && text.length > 2) {
        return text;
      }
    }
  } catch (err) {
    console.error('[DM Monitor] Erro ao extrair username:', err);
  }
  return null;
}

// Extract last message text
function extractLastMessage(element) {
  try {
    const messages = element.querySelectorAll('[role="row"]');
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const textEl = lastMsg.querySelector('[dir="auto"]');
      return textEl ? textEl.textContent.trim() : '';
    }
  } catch (err) {
    console.error('[DM Monitor] Erro ao extrair mensagem:', err);
  }
  return '';
}

// Check if message is from lead (not from you)
function isIncomingMessage(messageElement) {
  try {
    // Instagram marca mensagens suas com classes específicas
    // Mensagens recebidas geralmente ficam à esquerda
    const computedStyle = window.getComputedStyle(messageElement);
    const justifyContent = computedStyle.getPropertyValue('justify-content');
    
    // Se está alinhado à esquerda (flex-start), é mensagem recebida
    return justifyContent === 'flex-start';
  } catch (err) {
    console.error('[DM Monitor] Erro ao verificar tipo de mensagem:', err);
  }
  return false;
}

// Scan inbox for new messages
function scanInbox() {
  const now = Date.now();
  
  // Debounce checks
  if (now - lastCheck < CHECK_DEBOUNCE) {
    return;
  }
  lastCheck = now;
  
  try {
    // Find all conversation threads
    const threads = document.querySelectorAll('[role="listitem"]');
    
    threads.forEach(thread => {
      // Check if thread has unread indicator
      const hasUnread = thread.querySelector('[aria-label*="unread"]') || 
                        thread.querySelector('[style*="font-weight: 700"]') ||
                        thread.querySelector('[style*="font-weight:700"]');
      
      if (hasUnread) {
        const username = extractUsername(thread);
        
        if (username) {
          console.log('[DM Monitor] Thread não lida detectada:', username);
          
          // Send to background script
          chrome.runtime.sendMessage({
            type: 'NEW_DM_DETECTED',
            data: {
              username: username,
              messageText: '', // Não conseguimos ler texto direto da lista
              timestamp: Date.now()
            }
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('[DM Monitor] Erro ao enviar:', chrome.runtime.lastError);
            } else {
              console.log('[DM Monitor] Enviado ao background:', response);
            }
          });
        }
      }
    });
  } catch (err) {
    console.error('[DM Monitor] Erro ao escanear inbox:', err);
  }
}

// Scan open conversation for new messages
function scanOpenConversation() {
  try {
    const messages = document.querySelectorAll('[role="row"]');
    
    if (messages.length === 0) return;
    
    // Get last message
    const lastMessage = messages[messages.length - 1];
    
    // Check if it's incoming (not from you)
    if (isIncomingMessage(lastMessage)) {
      // Try to extract username from URL
      const match = window.location.pathname.match(/\/direct\/t\/([^\/]+)/);
      if (match) {
        const threadId = match[1];
        const messageText = extractLastMessage(document);
        
        console.log('[DM Monitor] Mensagem recebida detectada no thread:', threadId);
        
        // Note: threadId is not the username, but we send it anyway
        // Backend will try to match by threadId or we'll need to extract username differently
        chrome.runtime.sendMessage({
          type: 'NEW_DM_DETECTED',
          data: {
            username: threadId, // Isso é uma limitação - pode precisar ajuste
            messageText: messageText,
            timestamp: Date.now()
          }
        });
      }
    }
  } catch (err) {
    console.error('[DM Monitor] Erro ao escanear conversa:', err);
  }
}

// Start monitoring
function startMonitoring() {
  if (observerActive) return;
  
  console.log('[DM Monitor] Iniciando monitoramento...');
  observerActive = true;
  
  // Initial scan
  if (isInboxPage()) {
    scanInbox();
  }
  
  // Set up MutationObserver to detect DOM changes
  const observer = new MutationObserver((mutations) => {
    if (isInboxPage()) {
      scanInbox();
    } else {
      scanOpenConversation();
    }
  });
  
  // Observe changes in main content area
  const mainContent = document.querySelector('[role="main"]');
  if (mainContent) {
    observer.observe(mainContent, {
      childList: true,
      subtree: true
    });
    console.log('[DM Monitor] ✅ Observer ativo');
  } else {
    console.warn('[DM Monitor] ⚠️ Não encontrou [role="main"], tentando novamente em 3s...');
    setTimeout(startMonitoring, 3000);
  }
  
  // Also check periodically as fallback
  setInterval(() => {
    if (isInboxPage()) {
      scanInbox();
    }
  }, 10000); // Every 10 seconds
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startMonitoring);
} else {
  startMonitoring();
}

// Re-initialize when navigating within Instagram SPA
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('[DM Monitor] Navegação detectada:', url);
    setTimeout(startMonitoring, 1000);
  }
}).observe(document, { subtree: true, childList: true });

console.log('[DM Monitor] Content script carregado');
