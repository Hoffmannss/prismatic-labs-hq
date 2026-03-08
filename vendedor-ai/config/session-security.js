// =============================================================
// SESSION SECURITY - CRIPTOGRAFIA DE SESSÕES INSTAGRAM
// Protege cookies e tokens com AES-256-GCM
// =============================================================

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const TAG_LENGTH = 16; // 128 bits

class SessionSecurity {
  constructor() {
    this.encryptionKey = this.getOrCreateKey();
  }

  getOrCreateKey() {
    const keyEnv = process.env.SESSION_ENCRYPTION_KEY;
    
    if (keyEnv) {
      // Usar chave do .env
      return Buffer.from(keyEnv, 'hex');
    }

    // Gerar nova chave e salvar no .env
    const newKey = crypto.randomBytes(KEY_LENGTH);
    const keyHex = newKey.toString('hex');
    
    console.warn('\n⚠️  [SECURITY] Chave de criptografia gerada!');
    console.warn('Adicione ao seu .env:');
    console.warn(`SESSION_ENCRYPTION_KEY=${keyHex}`);
    console.warn('\nIMPORTANTE: Guarde essa chave em local seguro!\n');
    
    return newKey;
  }

  /**
   * Criptografa dados sensíveis (cookies, tokens)
   * @param {Object} data - Dados a serem criptografados
   * @returns {Object} - Objeto com dados criptografados
   */
  encrypt(data) {
    try {
      const plaintext = JSON.stringify(data);
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        version: '1.0',
        algorithm: ALGORITHM,
        encrypted: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Descriptografa dados
   * @param {Object} encryptedData - Objeto com dados criptografados
   * @returns {Object} - Dados originais
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData.encrypted || !encryptedData.iv || !encryptedData.authTag) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
      
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Salva sessão criptografada em arquivo
   * @param {string} filepath - Caminho do arquivo
   * @param {Object} sessionData - Dados da sessão
   */
  saveEncrypted(filepath, sessionData) {
    const encrypted = this.encrypt(sessionData);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(encrypted, null, 2));
  }

  /**
   * Carrega sessão criptografada de arquivo
   * @param {string} filepath - Caminho do arquivo
   * @returns {Object|null} - Dados da sessão ou null se não existir
   */
  loadEncrypted(filepath) {
    if (!fs.existsSync(filepath)) return null;
    
    try {
      const fileContent = fs.readFileSync(filepath, 'utf8');
      const encryptedData = JSON.parse(fileContent);
      
      // Verificar se é formato criptografado
      if (encryptedData.version && encryptedData.encrypted) {
        return this.decrypt(encryptedData);
      }
      
      // Formato antigo (não criptografado) - migrar
      console.warn('⚠️  [SECURITY] Sessão não criptografada detectada. Migrando...');
      this.saveEncrypted(filepath, encryptedData);
      return encryptedData;
      
    } catch (error) {
      console.error(`[SECURITY] Erro ao carregar sessão: ${error.message}`);
      return null;
    }
  }

  /**
   * Verifica se a sessão expirou (30 dias)
   * @param {Object} encryptedData - Dados criptografados
   * @returns {boolean}
   */
  isExpired(encryptedData) {
    if (!encryptedData.timestamp) return false;
    
    const timestamp = new Date(encryptedData.timestamp);
    const now = new Date();
    const diffDays = (now - timestamp) / (1000 * 60 * 60 * 24);
    
    return diffDays > 30;
  }

  /**
   * Rotaciona chave de criptografia (re-criptografa sessões)
   * @param {string} sessionDir - Diretório de sessões
   */
  rotateKey(sessionDir) {
    const newKey = crypto.randomBytes(KEY_LENGTH);
    const oldKey = this.encryptionKey;
    
    console.log('🔄 [SECURITY] Rotacionando chave de criptografia...');
    
    // Re-criptografar todas as sessões
    const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const filepath = path.join(sessionDir, file);
      try {
        // Descriptografar com chave antiga
        this.encryptionKey = oldKey;
        const data = this.loadEncrypted(filepath);
        
        if (data) {
          // Re-criptografar com chave nova
          this.encryptionKey = newKey;
          this.saveEncrypted(filepath, data);
          console.log(`✅ Sessão re-criptografada: ${file}`);
        }
      } catch (error) {
        console.error(`❌ Erro ao re-criptografar ${file}: ${error.message}`);
      }
    }
    
    const newKeyHex = newKey.toString('hex');
    console.log('\n✅ Rotação completa! Nova chave:');
    console.log(`SESSION_ENCRYPTION_KEY=${newKeyHex}`);
    console.log('\nATUALIZE SEU .env COM ESSA NOVA CHAVE!\n');
    
    this.encryptionKey = newKey;
    return newKeyHex;
  }
}

module.exports = SessionSecurity;
