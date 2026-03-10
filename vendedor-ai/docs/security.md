# 🔒 Segurança - Vendedor AI

## Overview

O Vendedor AI implementa múltiplas camadas de segurança para proteger dados sensíveis, sessões e credenciais.

---

## 🔐 Criptografia de Sessões

### **AES-256-GCM**

Todas as sessões do Instagram são criptografadas com:
- **Algoritmo**: AES-256-GCM (Galois/Counter Mode)
- **Chave**: 256 bits (32 bytes) gerada criptograficamente
- **IV**: 128 bits (16 bytes) aleatório por sessão
- **Auth Tag**: 128 bits para verificação de integridade

### **Como funciona**

```javascript
// Salvamento automático criptografado
const cookies = await context.cookies();
security.saveEncrypted(SESSION_FILE, cookies);

// Carregamento automático descriptografado
const cookies = security.loadEncrypted(SESSION_FILE);
await context.addCookies(cookies);
```

### **Estrutura do arquivo criptografado**

```json
{
  "version": "1.0",
  "algorithm": "aes-256-gcm",
  "encrypted": "hex_string_of_encrypted_data",
  "iv": "hex_string_of_initialization_vector",
  "authTag": "hex_string_of_auth_tag",
  "timestamp": "2026-03-08T23:45:00.000Z"
}
```

---

## ⚙️ Configuração

### **1. Chave de Criptografia**

Adicione ao `.env` (gerada automaticamente no primeiro uso):

```bash
SESSION_ENCRYPTION_KEY=64_caracteres_hexadecimais_aqui
```

### **2. Primeira Execução**

Se a chave não existir, o sistema gera automaticamente:

```bash
node agents/0-scraper.js login
```

Output:
```
⚠️  [SECURITY] Chave de criptografia gerada!
Adicione ao seu .env:
SESSION_ENCRYPTION_KEY=abc123...

IMPORTANTE: Guarde essa chave em local seguro!
```

**⚠️ IMPORTANTE:**
- Copie a chave para `.env` imediatamente
- **NUNCA** comite a chave no Git
- Guarde backup da chave em local seguro (1Password, Bitwarden, etc)

---

## 🔄 Rotação de Chave

### **Quando rotacionar**

- A cada 90 dias (recomendado)
- Após suspeita de vazamento
- Ao desativar acesso de colaborador
- Migração de servidor

### **Como rotacionar**

```bash
node agents/0-scraper.js rotate-key
```

O sistema irá:
1. Gerar nova chave criptográfica
2. Descriptografar todas as sessões com chave antiga
3. Re-criptografar com chave nova
4. Exibir nova chave para atualizar `.env`

**Output:**
```
🔄 [SECURITY] Rotacionando chave de criptografia...
✅ Sessão re-criptografada: instagram-session.json

✅ Rotação completa! Nova chave:
SESSION_ENCRYPTION_KEY=xyz789...

ATUALIZE SEU .env COM ESSA NOVA CHAVE!
```

---

## 🛡️ Proteções Implementadas

### **1. .gitignore**

Arquivos protegidos:
```
.env
data/session/
data/crm/
data/leads/
data/mensagens/
```

### **2. Validade de Sessão**

- Sessões expiram após 30 dias
- Verificação automática no carregamento
- Re-login necessário após expiração

### **3. Migração Automática**

Se detectar sessão não criptografada:
```
⚠️  [SECURITY] Sessão não criptografada detectada. Migrando...
✅ Sessão migrada para formato criptografado
```

### **4. Verificação de Integridade**

- Auth Tag garante que dados não foram adulterados
- Falha de verificação = sessão inválida
- Re-login automático necessário

---

## 📝 Logs de Segurança

### **Login bem-sucedido**
```
✅ Login salvo com sucesso!
🔒 Sessão protegida com criptografia AES-256
⏱️  Validade: ~30 dias
   Próximas execuções serão automáticas.
```

### **Carregamento de sessão**
```
[SCRAPER] 🔒 Sessão criptografada carregada
```

### **Erro de descriptografia**
```
[SCRAPER] Sessão inválida, será necessário novo login
```

---

## ⚠️ Melhores Práticas

### **DO ✅**

- Guarde chave de criptografia em gerenciador de senhas
- Rotacione chave a cada 90 dias
- Use conta Instagram secundária para scraping
- Mantenha `.env` fora do Git
- Monitore logs de segurança

### **DON'T ❌**

- NÃO comite `.env` no Git
- NÃO compartilhe chave de criptografia
- NÃO use conta Instagram pessoal/principal
- NÃO desative criptografia
- NÃO armazene chave no código

---

## 🐛 Reportar Vulnerabilidade

Se encontrar vulnerabilidade:

1. **NÃO** abra issue pública
2. Envie email para: `security@prismatic-labs.com`
3. Inclua:
   - Descrição detalhada
   - Steps to reproduce
   - Impacto potencial
   - PoC (se possível)

**Response time**: 48h

---

## 📚 Referências

- [AES-GCM Specification](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

---

## ℹ️ Suporte

Dúvidas sobre segurança:
- Discord: [Prismatic Labs](https://discord.gg/prismatic)
- Email: `security@prismatic-labs.com`
