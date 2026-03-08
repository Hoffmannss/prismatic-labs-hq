# Vendedor IA - Chrome Extension

## 🚀 O que faz?

Extensão do Chrome que **detecta automaticamente** quando alguém responde suas DMs no Instagram e notifica o sistema Vendedor IA.

---

## 📦 Instalação

### Opção 1: Instalação Manual (uso diário)

1. Abra o Chrome e vá em `chrome://extensions/`

2. Ative o **Modo do desenvolvedor** (canto superior direito)

3. Clique em **Carregar sem compactação**

4. Selecione a pasta:
   ```
   vendedor-ai/chrome-extension/
   ```

5. A extensão 🤖 **Vendedor IA** aparecerá na barra de extensões

6. Acesse [instagram.com/direct/inbox](https://www.instagram.com/direct/inbox/) e faça login

7. **Pronto!** A extensão começa a monitorar automaticamente.

---

### Opção 2: Modo Headless (automação total)

**Pré-requisitos:**
```bash
npm install puppeteer
```

**Iniciar monitor:**
```bash
cd vendedor-ai/agents
node 13-monitor-dm.js
```

- Abre Chrome automaticamente com a extensão carregada
- Janela fica **minimizada** fora da tela
- Você faz login uma vez e deixa rodando
- Detecta respostas 24/7

---

## ⚙️ Como funciona?

1. **Content Script** monitora `instagram.com/direct/*` via `MutationObserver`

2. Quando detecta mensagem nova **recebida** (não enviada por você):
   - Extrai: `username`, `messageText`, `timestamp`

3. **Background Script** dispara webhook:
   ```javascript
   POST http://localhost:3131/api/tracker
   {
     "username": "fulano",
     "action": "respondeu",
     "extra": "Auto-detectado: Oi, quero saber mais..."
   }
   ```

4. **Backend** (`8-dashboard.js`) recebe e atualiza CRM automaticamente

5. **Learner** (`11-learner.js`) usa esse dado para melhorar próximas DMs

---

## 🔧 Popup de Controle

Clique no ícone 🤖 da extensão para:
- ✅ Ativar/Desativar monitor
- 📊 Ver total de respostas detectadas
- ⌛ Ver últimas 5 detecções

---

## ⚠️ Limitações

### Headless não funciona 100%
- Chrome **não suporta extensões em modo headless** (limitação do Chromium)
- Solução: `13-monitor-dm.js` abre Chrome com janela **fora da tela** (`--window-position=-2400,-2400`)
- Você não vê a janela, mas ela existe

### Instagram pode detectar?
- **NÃO**: a extensão só **lê** o DOM, não faz scraping agressivo
- Usa sua **sessão real** do Chrome (como se você estivesse navegando)
- Sem automação de cliques ou requisições fakes

---

## 📝 Arquivos

```
chrome-extension/
├── manifest.json       # Configuração Manifest V3
├── background.js       # Service worker (webhooks)
├── content.js          # Monitora página Instagram
├── popup.html          # Interface de controle
├── popup.js            # Lógica do popup
├── icons/              # Ícones 16x16, 48x48, 128x128
└── README.md           # Documentação
```

---

## 🐛 Debug

### Ver logs da extensão:
1. `chrome://extensions/` → Vendedor IA → **Inspecionar visões: service worker**
2. Console mostrará logs de detecção

### Ver logs do content script:
1. Abra `instagram.com/direct/inbox/`
2. `F12` → Console
3. Procure por `[Vendedor IA]`

### Testar webhook manualmente:
```bash
curl -X POST http://localhost:3131/api/tracker \
  -H "Content-Type: application/json" \
  -d '{"username":"teste","action":"respondeu","extra":"teste manual"}'
```

---

## 🚀 Próximos Passos

- [ ] Adicionar filtro de leads cadastrados (só notificar quem está no CRM)
- [ ] Suporte a Instagram Business API (oficial)
- [ ] Notificações desktop com ações rápidas
- [ ] Dashboard integrado no popup

---

## 💬 Suporte

Problemas? Abra issue no repo ou contate Prismatic Labs.
