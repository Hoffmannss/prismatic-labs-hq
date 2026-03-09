# 🤖 Autopilot Diário - Vendedor AI

Roda automaticamente 1x por dia e coleta 10-20 leads novos sem bater rate limit.

---

## 📊 Como Funciona

- **Horário**: 09:00 (configurável)
- **Frequência**: 1x por dia
- **Meta**: 15 leads/dia (configurável)
- **Delays**: 3x mais longos que o normal (evita rate limit)
- **Logs**: Salvos em `logs/autopilot-daily.log`

---

## ⚙️ Configuração

### **1. Crie o arquivo `.env`** (se ainda não tiver):

```bash
# Opções do autopilot diário
AUTOPILOT_DAILY_HOUR=09:00        # Horário de execução (formato 24h)
AUTOPILOT_DAILY_TARGET=15         # Meta de leads por dia

# Criptografia de sessão
SESSION_ENCRYPTION_KEY=sua_chave_aqui

# API do Gemini
GOOGLE_API_KEY=sua_chave_aqui
```

### **2. Configure o nicho** em `data/autopilot-config.json`:

```json
{
  "nicho": "personal trainers fitness",
  "qtd": 15,
  "max_analyze": 5,
  "sync_notion": false
}
```

---

## 🚀 Uso

### **Iniciar o scheduler (deixa rodando 24/7)**:

```bash
node autopilot-daily.js
```

Output:
```
======================================================================
  AUTOPILOT DAILY SCHEDULER - PRISMATIC LABS
======================================================================
  Horário: 09:00
  Meta: 15 leads/dia
  Config: data/autopilot-config.json
  Log: logs/autopilot-daily.log
======================================================================

✅ Configuração atualizada:
   Nicho: personal trainers fitness
   Quantidade: 15 leads
   Max Analyze: 5

⏰ Próxima execução agendada para: 09/03/2026 09:00:00
   (em 12h35m)

✅ Scheduler ativo! Mantenha este terminal aberto.
   Pressione Ctrl+C para cancelar.
```

### **Executar AGORA (teste manual)**:

```bash
node autopilot-daily.js --now
```

Isso executa o autopilot imediatamente (sem esperar o horário agendado).

---

## 🔧 Ajustes de Performance

### **Aumentar/diminuir meta diária**:

Edite `.env`:
```bash
AUTOPILOT_DAILY_TARGET=20  # 20 leads/dia
```

### **Mudar horário**:

Edite `.env`:
```bash
AUTOPILOT_DAILY_HOUR=14:30  # 14:30 (2:30 PM)
```

### **Ajustar delays (se bater rate limit)**:

O autopilot diário usa automaticamente delays 3x mais longos. Se ainda bater rate limit, aumente manualmente editando `autopilot-daily.js` linha 57:

```javascript
AUTOPILOT_DELAY_MULTIPLIER: '5.0' // 5x mais lento
```

---

## 📊 Monitoramento

### **Ver logs em tempo real**:

```bash
tail -f logs/autopilot-daily.log
```

### **Verificar última execução**:

```bash
cat logs/autopilot-daily.log | tail -50
```

### **Contar leads gerados hoje**:

```bash
ls -la data/leads/ | grep "$(date +%Y-%m-%d)"
```

---

## 📦 Rodar em Background (VPS/Linux)

### **Opção 1: PM2** (recomendado)

```bash
npm install -g pm2
pm2 start autopilot-daily.js --name vendedor-autopilot
pm2 save
pm2 startup
```

Comandos úteis:
```bash
pm2 logs vendedor-autopilot  # Ver logs
pm2 restart vendedor-autopilot
pm2 stop vendedor-autopilot
pm2 delete vendedor-autopilot
```

### **Opção 2: Screen** (alternativa)

```bash
screen -S autopilot
node autopilot-daily.js
# Pressione Ctrl+A depois D para "desatachar"

# Voltar depois:
screen -r autopilot
```

### **Opção 3: Systemd** (Linux nativo)

Crie `/etc/systemd/system/vendedor-autopilot.service`:

```ini
[Unit]
Description=Vendedor AI Autopilot Daily
After=network.target

[Service]
Type=simple
User=seu_usuario
WorkingDirectory=/caminho/para/vendedor-ai
ExecStart=/usr/bin/node autopilot-daily.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Ativar:
```bash
sudo systemctl enable vendedor-autopilot
sudo systemctl start vendedor-autopilot
sudo systemctl status vendedor-autopilot
```

---

## 🐛 Troubleshooting

### **Rate limit mesmo com delays 3x**

**Solução 1**: Reduza a meta diária
```bash
AUTOPILOT_DAILY_TARGET=10
```

**Solução 2**: Aumente delays para 5x
```javascript
// autopilot-daily.js linha 57
AUTOPILOT_DELAY_MULTIPLIER: '5.0'
```

**Solução 3**: Divida em 2 execuções por dia
```bash
# Primeira: 09:00
AUTOPILOT_DAILY_HOUR=09:00
AUTOPILOT_DAILY_TARGET=8

# Rode 2 instâncias com horários diferentes
```

### **Scheduler não executa no horário**

Verifique timezone do servidor:
```bash
date
timedatectl  # Linux
```

Ajuste se necessário:
```bash
sudo timedatectl set-timezone America/Sao_Paulo
```

### **Sessão expira**

Sessões do Instagram expiram após ~30 dias. Refazer login:
```bash
node agents/0-scraper.js login
```

---

## 📊 Métricas Esperadas

**Setup ideal**:
- Meta: 15 leads/dia
- Delays: 3x (padrão)
- Tempo de execução: ~20-30 min
- Taxa de sucesso: 60-80%
- Leads analisados: 5-8/dia
- Mensagens geradas: 5-8/dia

**Por mês**:
- ~450 leads coletados
- ~150-240 analisados
- ~150-240 mensagens prontas

---

## 🎓 Boas Práticas

1. **Não aumente a meta acima de 20 leads/dia** (risco de ban)
2. **Use conta Instagram secundária** (nunca a principal)
3. **Monitore logs diariamente** (primeiros 7 dias)
4. **Rotacione chave de criptografia a cada 90 dias**
5. **Faça backup do CRM semanalmente**

---

## 🔗 Links Úteis

- [SECURITY.md](./SECURITY.md) - Guia de segurança
- [README.md](./README.md) - Documentação geral
- [Discord](https://discord.gg/prismatic) - Suporte

---

## ❓ FAQ

**P: Posso rodar 24/7 sem ser banido?**
R: Sim, com delays 3x e meta de 10-15 leads/dia é seguro.

**P: Quanto tempo até ter leads suficientes?**
R: Após 7 dias você terá ~100 leads, ~50 analisados.

**P: Preciso de VPS?**
R: Não é obrigatório, mas recomendado para 24/7.

**P: Funciona no Windows?**
R: Sim, mas PM2 funciona melhor no Linux.

**P: Posso ter vários nichos?**
R: Sim, rode múltiplas instâncias com configs diferentes.

---

## 📧 Suporte

Dúvidas ou problemas:
- Discord: [Prismatic Labs](https://discord.gg/prismatic)
- Email: `support@prismatic-labs.com`
- GitHub Issues: [Reportar bug](https://github.com/prismatic-labs/vendedor-ai/issues)
