// =============================================================
// PRISMATIC CONNECT — CONTENT SCRIPT
// Detecta respostas reais a DMs na conversa ABERTA no Instagram
// Só ativa em instagram.com/direct/t/* (conversa específica)
// =============================================================

const PRISMATIC_PREFIX = '[Prismatic Connect]';
const seenMessages = new Set(); // IDs de mensagens já processadas
let currentObserver = null;
let lastUrl = location.href;

console.log(`${PRISMATIC_PREFIX} Content script carregado`);

// Aguarda DOM pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

function bootstrap() {
  maybeStartMonitor();

  // Monitora navegação SPA (Instagram não recarrega a página)
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      maybeStartMonitor();
    }
  }).observe(document.body, { childList: true, subtree: true });
}

function maybeStartMonitor() {
  // Só monitora quando está dentro de uma conversa aberta
  // URL padrão: instagram.com/direct/t/THREAD_ID/
  if (!location.pathname.match(/^\/direct\/t\/.+/)) {
    stopObserver();
    return;
  }
  console.log(`${PRISMATIC_PREFIX} Conversa aberta — iniciando monitor`);
  waitForContainer();
}

function waitForContainer(attempt = 0) {
  if (attempt > 15) {
    console.warn(`${PRISMATIC_PREFIX} Container não encontrado após 15 tentativas`);
    return;
  }
  const container = document.querySelector('[role="main"]');
  if (!container) {
    setTimeout(() => waitForContainer(attempt + 1), 1000);
    return;
  }
  startObserver(container);
}

function startObserver(container) {
  stopObserver(); // garante que não há observer duplicado

  currentObserver = new MutationObserver(() => {
    scanConversation(container);
  });

  currentObserver.observe(container, { childList: true, subtree: true });

  // Escaneia mensagens já visíveis na abertura
  scanConversation(container);
  console.log(`${PRISMATIC_PREFIX} Observer ativo na conversa`);
}

function stopObserver() {
  if (currentObserver) {
    currentObserver.disconnect();
    currentObserver = null;
  }
}

function scanConversation(container) {
  // Username da pessoa com quem você está conversando
  // Vem do header da conversa: elemento com aria-label ou link de perfil no topo
  const partner = getConversationPartner();
  if (!partner) return;

  // Pega TODAS as mensagens visíveis na tela
  // Instagram: mensagens são <div role="row"> dentro do listbox de mensagens
  const messageRows = container.querySelectorAll('[role="row"]');

  messageRows.forEach(row => {
    // Só processa mensagens RECEBIDAS (lado esquerdo / flex-start)
    if (!isReceivedMessage(row)) return;

    const text = extractText(row);
    if (!text || text.length < 2) return;

    // ID estável: partner + primeiros 50 chars do texto
    const msgId = `${partner}::${text.substring(0, 50)}`;
    if (seenMessages.has(msgId)) return;
    seenMessages.add(msgId);

    // Limpa Set para não crescer indefinidamente
    if (seenMessages.size > 300) {
      seenMessages.delete(seenMessages.values().next().value);
    }

    console.log(`${PRISMATIC_PREFIX} Resposta de @${partner}: "${text.substring(0, 60)}"`);

    chrome.runtime.sendMessage({
      type: 'NEW_MESSAGE_DETECTED',
      data: { username: partner, messageText: text, timestamp: Date.now() }
    });
  });
}

function getConversationPartner() {
  // Tenta 1: link de perfil no header da conversa
  // Instagram coloca o username na URL do perfil no topo da conversa
  const headerLinks = document.querySelectorAll('header a[href], [role="banner"] a[href]');
  for (const link of headerLinks) {
    const match = link.href.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?($|\?)/);
    if (match && match[1] && !['direct', 'explore', 'reels', 'stories'].includes(match[1])) {
      return match[1];
    }
  }

  // Tenta 2: span com o username no topo da conversa (fallback)
  const spans = document.querySelectorAll('header span, [role="banner"] span');
  for (const span of spans) {
    const text = span.textContent.trim();
    if (text.startsWith('@') && text.length > 1) return text.slice(1);
    if (/^[a-zA-Z0-9._]{3,30}$/.test(text) && !['Direct', 'Messages', 'Mensagens'].includes(text)) {
      return text;
    }
  }

  return null;
}

function isReceivedMessage(row) {
  // Mensagens recebidas têm alinhamento flex-start no Instagram
  // Mensagens enviadas têm flex-end
  const style = window.getComputedStyle(row);
  if (style.justifyContent === 'flex-end') return false;
  if (style.justifyContent === 'flex-start') return true;

  // Fallback: posição horizontal na tela
  const rect = row.getBoundingClientRect();
  return rect.width > 0 && rect.left < window.innerWidth * 0.45;
}

function extractText(element) {
  const textNodes = element.querySelectorAll('[dir="auto"]');
  if (textNodes.length > 0) {
    return Array.from(textNodes)
      .map(n => n.textContent.trim())
      .filter(t => t.length > 0)
      .join(' ')
      .substring(0, 300);
  }
  return element.textContent.trim().substring(0, 300);
}

// Listener para ping do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkStatus') {
    sendResponse({
      active:        !!currentObserver,
      seenCount:     seenMessages.size,
      currentUrl:    location.href,
      inConversation: !!location.pathname.match(/^\/direct\/t\/.+/)
    });
  }
});
