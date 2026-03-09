// =============================================================
// VENDEDOR IA - CHROME EXTENSION POPUP LOGIC
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadStatus();
  loadRecentDetections();
  
  document.getElementById('toggleBtn').addEventListener('click', toggleMonitoring);
});

async function loadStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    
    const statusText = document.getElementById('statusText');
    const toggleBtn = document.getElementById('toggleBtn');
    const totalDetected = document.getElementById('totalDetected');
    
    if (response.isEnabled) {
      statusText.textContent = 'Ativo ✅';
      statusText.className = 'status-value active';
      toggleBtn.textContent = 'Desativar Monitor';
      toggleBtn.className = 'toggle-btn active';
    } else {
      statusText.textContent = 'Inativo ❌';
      statusText.className = 'status-value inactive';
      toggleBtn.textContent = 'Ativar Monitor';
      toggleBtn.className = 'toggle-btn inactive';
    }
    
    totalDetected.textContent = response.totalDetected || 0;
  } catch (error) {
    console.error('Erro ao carregar status:', error);
  }
}

async function toggleMonitoring() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'TOGGLE_MONITORING' });
    loadStatus();
    
    if (response.isEnabled) {
      showNotification('✅ Monitor ativado');
    } else {
      showNotification('❌ Monitor desativado');
    }
  } catch (error) {
    console.error('Erro ao alternar monitoring:', error);
  }
}

async function loadRecentDetections() {
  try {
    const data = await chrome.storage.local.get(['detectedReplies']);
    const replies = data.detectedReplies || [];
    
    const recentList = document.getElementById('recentList');
    
    if (replies.length === 0) {
      recentList.innerHTML = '<div class="empty-state">Nenhuma resposta detectada ainda</div>';
      return;
    }
    
    // Mostra últimas 5
    const recent = replies.slice(-5).reverse();
    
    recentList.innerHTML = recent.map(r => {
      const time = new Date(r.detected_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `
        <div class="recent-item">
          <div class="recent-username">@${r.username}</div>
          <div class="recent-time">${time}</div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Erro ao carregar detecções recentes:', error);
  }
}

function showNotification(message) {
  // Poderia adicionar toast notification aqui
  console.log(message);
}

// Auto-refresh a cada 5 segundos
setInterval(() => {
  loadStatus();
  loadRecentDetections();
}, 5000);
