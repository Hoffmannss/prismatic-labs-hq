# 🚀 Deploy VPS - Vendedor AI 24/7

Guia completo para rodar o Vendedor AI na VPS de forma autônoma e ininterrupta.

---

## 🧠 **Entendendo a VPS**

### **O que é?**
Uma VPS (Virtual Private Server) é um computador remoto que **roda 24/7 na nuvem**.

### **Independência total do seu PC:**
✅ **Formatar o PC**: Sistema continua rodando na VPS  
✅ **Desligar o PC**: Sistema continua rodando na VPS  
✅ **Viajar sem notebook**: Sistema continua rodando na VPS  
✅ **Perder o HD local**: Sistema está salvo no GitHub + VPS  

### **O que você perde se formatar o PC?**
❌ Nada importante (tudo está no GitHub + VPS)  
✅ Para recuperar: `git clone` + baixar `.env` da VPS  

### **O que acontece se a VPS cair?**
PM2 reinicia automaticamente em **10 segundos**. Se a VPS reiniciar (manutenção da Contabo, por exemplo), o PM2 volta sozinho via `pm2 startup`.

---

## 💻 **Escolha da VPS**

### **Recomendado: Contabo VPS S (mais barato)**
- **Preço**: €4.50/mês (~R$26/mês)
- **RAM**: 4 GB
- **CPU**: 4 vCores
- **Storage**: 100 GB SSD
- **Transfer**: Ilimitado
- **OS**: Ubuntu 24.04 LTS
- **Link**: https://contabo.com/en/vps/

### **Alternativas:**
- **DigitalOcean Droplet**: $6/mês (4 GB RAM)
- **Vultr Cloud Compute**: $6/mês (4 GB RAM)
- **Hetzner CX22**: €5.83/mês (4 GB RAM)

**Não use**: AWS/GCP free tier (limites de rede e CPU)

---

## 🛠️ **Setup inicial da VPS**

### **1. Conectar via SSH**

```bash
# Após criar a VPS, você receberá:
# - IP: 123.45.67.89
# - User: root
# - Senha: abc123xyz

ssh root@123.45.67.89
# Digite a senha quando solicitado
```

### **2. Atualizar sistema**

```bash
apt update && apt upgrade -y
apt install -y curl wget git build-essential
```

### **3. Instalar Node.js 24.x**

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs

# Verificar
node -v  # v24.14.0
npm -v   # 10.9.2
```

### **4. Instalar PM2**

```bash
npm install -g pm2
pm2 startup systemd  # Copia o comando gerado e executa
pm2 save
```

### **5. Instalar Playwright (para o scraper)**

```bash
npx playwright install-deps
npx playwright install chromium
```

---

## 📦 **Deploy do Vendedor AI**

### **1. Clonar repositório**

```bash
cd /root
git clone https://github.com/Hoffmannss/prismatic-labs-hq.git
cd prismatic-labs-hq/vendedor-ai
```

### **2. Instalar dependências**

```bash
npm install
```

### **3. Configurar `.env`**

```bash
cp .env.example .env
nano .env
```

Preencher:
```bash
GOOGLE_API_KEY=AIza...
SESSION_ENCRYPTION_KEY=sua_chave_64_chars
AUTOPILOT_DAILY_HOUR=09:00
AUTOPILOT_DAILY_TARGET=15
```

Salvar: `Ctrl+O`, `Enter`, `Ctrl+X`

### **4. Fazer login no Instagram (1x)**

```bash
# Este passo precisa de navegador visível
# Opção A: Fazer no seu PC e copiar sessão
node agents/0-scraper.js login
# (no seu PC local, depois copiar data/session/ para VPS)

# Opção B: Usar VNC na VPS (mais complexo)
# Opção C: Copiar cookies manualmente (avançado)
```

**Recomendado: fazer login no PC e copiar sessão:**

```bash
# No seu PC (Windows):
node agents/0-scraper.js login

# Depois copiar para VPS:
scp -r data/session root@123.45.67.89:/root/prismatic-labs-hq/vendedor-ai/data/
```

### **5. Testar antes de deixar 24/7**

```bash
# Teste rápido
node autopilot-daily.js --now

# Se funcionar, continua para o próximo passo
```

---

## 🔄 **Iniciar serviço 24/7 com PM2**

### **1. Iniciar autopilot diário**

```bash
pm2 start autopilot-daily.js --name vendedor-autopilot
pm2 save
```

### **2. Verificar status**

```bash
pm2 status
pm2 logs vendedor-autopilot
```

Output esperado:
```
┌─────────────┬──────────┬─────────────┬──────────┬──────────┐
│ id         │ name     │ mode       │ status   │ cpu      │
├─────────────┼──────────┼─────────────┼──────────┼──────────┤
│ 0          │ vendedor │ fork       │ online   │ 0.2%     │
└─────────────┴──────────┴─────────────┴──────────┴──────────┘
```

### **3. Comandos úteis PM2**

```bash
pm2 logs vendedor-autopilot       # Ver logs em tempo real
pm2 logs vendedor-autopilot --lines 100  # Últimas 100 linhas
pm2 restart vendedor-autopilot    # Reiniciar
pm2 stop vendedor-autopilot       # Parar (temporário)
pm2 delete vendedor-autopilot     # Remover (não inicia mais no boot)

pm2 monit                         # Dashboard interativo
pm2 save                          # Salvar configuração atual
```

---

## 📊 **Monitoramento**

### **Ver logs do autopilot**

```bash
# Logs do PM2
pm2 logs vendedor-autopilot

# Logs do arquivo
tail -f logs/autopilot-daily.log

# Últimas 50 linhas
tail -50 logs/autopilot-daily.log
```

### **Verificar leads gerados hoje**

```bash
ls -lht data/leads/ | head -20
```

### **Estatísticas do CRM**

```bash
node agents/12-tracker.js stats
```

---

## 🔄 **Atualizar código na VPS**

Quando fizer alterações no GitHub:

```bash
ssh root@123.45.67.89
cd /root/prismatic-labs-hq/vendedor-ai

# Parar serviço
pm2 stop vendedor-autopilot

# Atualizar código
git pull origin main
npm install  # Se houve novos pacotes

# Reiniciar
pm2 restart vendedor-autopilot
pm2 logs vendedor-autopilot
```

---

## 🔒 **Backup e recuperação**

### **Fazer backup da VPS para seu PC**

```bash
# Backup completo (recomendado 1x/semana)
scp -r root@123.45.67.89:/root/prismatic-labs-hq/vendedor-ai/data ./backup-vendedor-$(date +%Y%m%d)

# Backup apenas CRM e sessões
scp -r root@123.45.67.89:/root/prismatic-labs-hq/vendedor-ai/data/crm ./backup-crm
scp -r root@123.45.67.89:/root/prismatic-labs-hq/vendedor-ai/data/session ./backup-session
```

### **Restaurar de um backup**

```bash
# Copiar backup do PC para VPS
scp -r ./backup-crm root@123.45.67.89:/root/prismatic-labs-hq/vendedor-ai/data/
scp -r ./backup-session root@123.45.67.89:/root/prismatic-labs-hq/vendedor-ai/data/
```

### **Backup automático diário**

Criar script em `/root/backup-vendedor.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf /root/backups/vendedor-$DATE.tar.gz /root/prismatic-labs-hq/vendedor-ai/data/
find /root/backups -name "vendedor-*.tar.gz" -mtime +7 -delete
```

Agendar no cron:
```bash
crontab -e
# Adicionar linha:
0 3 * * * /root/backup-vendedor.sh
```

---

## ⚡ **Otimizações VPS**

### **1. Firewall (segurança)**

```bash
apt install -y ufw
ufw allow 22/tcp    # SSH
ufw allow 3131/tcp  # Dashboard (opcional)
ufw enable
```

### **2. Fail2ban (proteção contra ataques SSH)**

```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

### **3. Monitoramento de recursos**

```bash
# Ver uso de CPU/RAM
htop

# Ver uso de disco
df -h

# Ver processos Node.js
pm2 monit
```

---

## 🐛 **Troubleshooting**

### **Autopilot não inicia**

```bash
# Ver erro completo
pm2 logs vendedor-autopilot --err

# Verificar .env
cat .env | grep -v "^#" | grep -v "^$"

# Testar manualmente
node autopilot-daily.js --now
```

### **Rate limit mesmo na VPS**

```bash
# Aumentar delays para 5x
nano .env
# Adicionar:
AUTOPILOT_DELAY_MULTIPLIER=5.0

# Ou reduzir meta
AUTOPILOT_DAILY_TARGET=10

pm2 restart vendedor-autopilot
```

### **Sessão Instagram expirou**

```bash
# Refazer login no PC
node agents/0-scraper.js login

# Copiar sessão para VPS
scp -r data/session root@123.45.67.89:/root/prismatic-labs-hq/vendedor-ai/data/

# Reiniciar na VPS
pm2 restart vendedor-autopilot
```

### **VPS sem espaço em disco**

```bash
# Ver uso
df -h

# Limpar logs antigos do PM2
pm2 flush

# Limpar logs do autopilot (mais de 30 dias)
find logs/ -name "*.log" -mtime +30 -delete

# Limpar cache do npm
npm cache clean --force
```

---

## 💼 **Resumo: PC vs VPS**

| Item | No seu PC | Na VPS |
|------|-----------|--------|
| **Código** | Git clone local | Git clone remoto |
| **Dependência do PC** | Precisa estar ligado | **Independente** |
| **Se formatar PC** | Perde tudo local | **Nada acontece** |
| **Custo** | R$0/mês (energia) | R$26/mês (Contabo) |
| **Disponibilidade** | Quando PC ligado | **24/7/365** |
| **Backup** | Seu HD | GitHub + VPS + backups |
| **Acesso remoto** | Não (a menos que configure) | **SSH de qualquer lugar** |

---

## ✅ **Checklist pós-deploy**

- [ ] VPS criada (Contabo/DO/Vultr)
- [ ] SSH funcionando
- [ ] Node.js 24.x instalado
- [ ] PM2 instalado e configurado (`pm2 startup`)
- [ ] Playwright instalado
- [ ] Repositório clonado
- [ ] `.env` configurado
- [ ] Sessão Instagram copiada
- [ ] Teste manual funcionou (`--now`)
- [ ] PM2 rodando (`pm2 start autopilot-daily.js`)
- [ ] Logs aparecendo (`pm2 logs`)
- [ ] Firewall configurado (ufw)
- [ ] Backup semanal agendado (cron)

---

## 📞 **Suporte**

Dúvidas sobre deploy:
- Discord: [Prismatic Labs](https://discord.gg/prismatic)
- Email: `support@prismatic-labs.com`
- GitHub Issues: [Reportar problema](https://github.com/Hoffmannss/prismatic-labs-hq/issues)

---

**🎉 Parabéns!** Agora seu Vendedor AI roda 24/7 sem depender do seu PC.
