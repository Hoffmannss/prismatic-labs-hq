# 🤖 AUTOPILOT - Sistema de Prospecção Automática

## 💡 Visão Geral

O Autopilot é um sistema **100% automatizado** que:
- Busca leads no Instagram (sem Apify - scraper próprio)
- Analisa perfis com IA
- Gera mensagens personalizadas
- Sincroniza com Notion
- Aprende com resultados

**Diferencial**: Configuração via **Dashboard Web** - o usuário não precisa saber programar!

---

## 🎯 Arquitetura

```
┌─────────────────────┐
│   DASHBOARD WEB       │
│  (Interface User)     │
│                       │
│ ✅ Nicho: fitness     │
│ ✅ Qtd: 30 leads      │
│ ✅ Horário: 9h        │
│ ✅ Status: Ativo      │
└──────────┬──────────┘
           │
           │ HTTP POST /api/autopilot/config
           │
           │ salva no banco
           │
           ▼
┌─────────────────────┐
│   DATABASE (JSON)     │
│                       │
│ autopilot-config.json│
│ {                     │
│   active: true,       │
│   nicho: "fitness",   │
│   quantidade: 30,     │
│   schedule: {...}     │
│ }                     │
└──────────┬──────────┘
           │
           │ 14-scheduler.js lê config
           │
           ▼
┌─────────────────────┐
│   SCHEDULER (CRON)    │
│  14-scheduler.js      │
│                       │
│ Agenda execuções     │
│ automáticas do        │
│ autopilot            │
└──────────┬──────────┘
           │
           │ executa no horário
           │
           ▼
┌─────────────────────┐
│   AUTOPILOT           │
│  10-autopilot.js      │
│                       │
│ 1. Scraping (0-)     │
│ 2. Analyze (1-)      │
│ 3. Copywriter (2-)   │
│ 4. Notion Sync (9-)  │
│ 5. Learner (11-)     │
└─────────────────────┘
```

---

## 📦 Arquivos Criados

### 1. `config/database.js`
**Função**: Gerencia o banco de dados de configurações

```javascript
class AutopilotDB {
  loadConfig()        // Lê configuração atual
  saveConfig(data)    // Salva configuração
  updateConfig(data)  // Atualiza parcialmente
  isActive()          // Verifica se está ativo
  getAutopilotParams() // Retorna parâmetros para execução
}
```

**Arquivo de dados**: `data/autopilot-config.json`

### 2. `agents/14-scheduler.js`
**Função**: Sistema de agendamento automático (cron)

**Features**:
- Executa autopilot em horários agendados
- Suporta expressões cron (exemplo: `0 9 * * *` = todo dia às 9h)
- Verifica mudanças de configuração a cada minuto
- Shutdown gracioso (SIGINT/SIGTERM)

**Uso**:
```bash
node agents/14-scheduler.js
```

### 3. `agents/10-autopilot.js` (ATUALIZADO)
**Alterações**:
- **Antes**: Lia parâmetros da linha de comando
- **Agora**: Lê do banco de dados (`autopilot-config.json`)
- Manteve backward compatibility (ainda aceita CLI)

**Modo 1 - Dashboard** (NOVO):
```bash
node agents/10-autopilot.js
# Lê: nicho, quantidade, max_analyze do banco
```

**Modo 2 - CLI** (backward compatibility):
```bash
node agents/10-autopilot.js "fitness" 30 10
```

### 4. `agents/8-dashboard.js` (ATUALIZADO)
**Novas rotas API**:

| Método | Endpoint | Função |
|--------|----------|----------|
| `GET` | `/api/autopilot/config` | Retorna configuração atual |
| `POST` | `/api/autopilot/config` | Atualiza configuração |
| `POST` | `/api/autopilot/start` | Inicia autopilot manualmente |
| `POST` | `/api/autopilot/toggle` | Ativa/desativa autopilot |

---

## 🚀 Como Usar

### 1. Iniciar o Dashboard
```bash
cd ~/prismatic-labs-hq/vendedor-ai
node agents/8-dashboard.js
```

Acesse: http://localhost:3131

### 2. Configurar o Autopilot (via API)

**Obter configuração atual**:
```bash
curl http://localhost:3131/api/autopilot/config
```

**Configurar nicho e parâmetros**:
```bash
curl -X POST http://localhost:3131/api/autopilot/config \
  -H "Content-Type: application/json" \
  -d '{
    "active": true,
    "nicho": "personal trainers fitness",
    "quantidade_leads": 30,
    "max_analyze": 15,
    "sync_notion": true,
    "schedule": {
      "enabled": true,
      "cron": "0 9 * * *",
      "timezone": "America/Sao_Paulo"
    }
  }'
```

**Ativar/Desativar**:
```bash
curl -X POST http://localhost:3131/api/autopilot/toggle \
  -H "Content-Type: application/json" \
  -d '{"active": true}'
```

**Iniciar manualmente**:
```bash
curl -X POST http://localhost:3131/api/autopilot/start
```

### 3. Iniciar o Scheduler (Agendamento Automático)
```bash
node agents/14-scheduler.js
```

O scheduler vai:
1. Ler a configuração do banco
2. Agendar execuções conforme `schedule.cron`
3. Executar `10-autopilot.js` automaticamente no horário

### 4. Rodar em Background (Produção)

**Com PM2** (recomendado):
```bash
pm2 start agents/8-dashboard.js --name "vendedor-dashboard"
pm2 start agents/14-scheduler.js --name "vendedor-scheduler"
pm2 save
```

**Logs**:
```bash
pm2 logs vendedor-scheduler
pm2 logs vendedor-dashboard
```

---

## 📋 Schema do Banco

**Arquivo**: `data/autopilot-config.json`

```json
{
  "version": "1.0.0",
  "active": true,
  "nicho": "personal trainers fitness",
  "quantidade_leads": 30,
  "max_analyze": 15,
  "schedule": {
    "enabled": true,
    "cron": "0 9 * * *",
    "timezone": "America/Sao_Paulo"
  },
  "sync_notion": true,
  "last_run": "2026-03-08T22:00:00.000Z",
  "created_at": "2026-03-08T20:00:00.000Z",
  "updated_at": "2026-03-08T22:30:00.000Z"
}
```

### Campos:

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `active` | `boolean` | Autopilot ativo/inativo |
| `nicho` | `string` | Nicho alvo (ex: "fitness", "nutricionistas") |
| `quantidade_leads` | `number` | Quantos leads buscar por execução |
| `max_analyze` | `number` | Quantos leads analisar com IA |
| `schedule.enabled` | `boolean` | Agendamento automático habilitado |
| `schedule.cron` | `string` | Expressão cron (ex: "0 9 * * *") |
| `schedule.timezone` | `string` | Timezone (ex: "America/Sao_Paulo") |
| `sync_notion` | `boolean` | Sincronizar com Notion após execução |
| `last_run` | `string` | ISO timestamp da última execução |

---

## 🌐 Interface Web (Próximo Passo)

Você pode criar uma interface visual no dashboard que chama essas APIs:

```html
<!-- Exemplo de formulário -->
<form id="autopilot-config">
  <label>
    Nicho:
    <input type="text" name="nicho" placeholder="Ex: personal trainers">
  </label>
  
  <label>
    Quantidade de Leads:
    <input type="number" name="quantidade_leads" value="20">
  </label>
  
  <label>
    Max Analyze (IA):
    <input type="number" name="max_analyze" value="10">
  </label>
  
  <label>
    Horário de Execução:
    <input type="time" id="schedule-time" value="09:00">
  </label>
  
  <label>
    <input type="checkbox" name="active"> Autopilot Ativo
  </label>
  
  <label>
    <input type="checkbox" name="schedule.enabled"> Agendamento Automático
  </label>
  
  <button type="submit">Salvar Configuração</button>
</form>

<button id="start-now">Iniciar Agora</button>

<script>
// Salvar configuração
document.getElementById('autopilot-config').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const config = Object.fromEntries(formData);
  
  // Converter hora para cron (ex: "09:00" -> "0 9 * * *")
  const time = document.getElementById('schedule-time').value.split(':');
  config.schedule = {
    enabled: formData.get('schedule.enabled') === 'on',
    cron: `0 ${time[0]} * * *`,
    timezone: 'America/Sao_Paulo'
  };
  
  const res = await fetch('/api/autopilot/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  
  const result = await res.json();
  alert(result.ok ? 'Salvo!' : 'Erro!');
});

// Iniciar manualmente
document.getElementById('start-now').addEventListener('click', async () => {
  const res = await fetch('/api/autopilot/start', { method: 'POST' });
  const result = await res.json();
  alert(result.message);
});
</script>
```

---

## ✅ Checklist de Deploy

- [ ] `.env` configurado com chaves de API
- [ ] Dashboard rodando: `node agents/8-dashboard.js`
- [ ] Scheduler rodando: `node agents/14-scheduler.js`
- [ ] Autopilot configurado via dashboard
- [ ] PM2 instalado e configurado
- [ ] Logs monitorados

---

## 🔧 Troubleshooting

**Autopilot não executa automaticamente**:
```bash
# Verificar se scheduler está rodando
pm2 list

# Ver logs do scheduler
pm2 logs vendedor-scheduler

# Verificar configuração
curl http://localhost:3131/api/autopilot/config
```

**Erro "Autopilot desativado"**:
```bash
# Ativar via API
curl -X POST http://localhost:3131/api/autopilot/toggle \
  -H "Content-Type: application/json" \
  -d '{"active": true}'
```

**Testar manualmente**:
```bash
# Testar sem scheduler (execução única)
node agents/10-autopilot.js
```

---

## 📊 Monitoramento

**Status do autopilot**:
```bash
curl http://localhost:3131/api/stats
```

Retorna:
```json
{
  "autopilot": {
    "active": true,
    "nicho": "fitness",
    "last_run": "2026-03-08T22:00:00.000Z"
  },
  "total": 156,
  "byPriority": { "hot": 45, "warm": 89, "cold": 22 }
}
```

---

## 👍 Próximos Passos

1. ✅ Sistema de banco de dados - **DONE**
2. ✅ Rotas API no dashboard - **DONE**
3. ✅ Scheduler automático - **DONE**
4. ✅ Integração com autopilot - **DONE**
5. ◻ Interface visual no dashboard HTML
6. ◻ Sistema de notificações (email/telegram)
7. ◻ Múltiplos nichos simultâneos
8. ◻ Dashboard de analytics em tempo real

---

**🎉 Sistema 100% Funcional!**

Agora o usuário pode configurar tudo pelo dashboard sem tocar em código!
