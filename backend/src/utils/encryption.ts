import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32
const LEGACY_FALLBACK_KEY_PASSPHRASE = 'default-key-change-in-production'
const LEGACY_FALLBACK_SALT = 'salt'

/**
 * Recupera a chave de criptografia obrigatória a partir da variável de ambiente.
 * Falha imediatamente se a chave estiver ausente ou for fraca.
 */
export function getEncryptionKey(): Buffer {
  const key = process.env.IFOOD_ENCRYPTION_KEY

  if (!key) {
    throw new Error('IFOOD_ENCRYPTION_KEY environment variable is required')
  }

  if (key.length < KEY_LENGTH) {
    throw new Error('IFOOD_ENCRYPTION_KEY must be at least 32 characters')
  }

  const isHexKey = key.length === KEY_LENGTH * 2 && /^[0-9a-fA-F]+$/.test(key)
  if (isHexKey) {
    return Buffer.from(key, 'hex')
  }

  return crypto.scryptSync(key, 'ifood-salt', KEY_LENGTH)
}

function getLegacyEncryptionKey(): Buffer {
  return crypto.scryptSync(LEGACY_FALLBACK_KEY_PASSPHRASE, LEGACY_FALLBACK_SALT, KEY_LENGTH)
}

/**
 * Encrypt a string value
 * @param text - Text to encrypt
 * @returns Encrypted string (base64 encoded)
 */
export function encrypt(text: string): string {
  if (!text) {
    return ''
  }
  
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    const tag = cipher.getAuthTag()
    
    // Combine iv, tag, and encrypted data
    const combined = Buffer.concat([
      iv,
      tag,
      Buffer.from(encrypted, 'base64')
    ])
    
    return combined.toString('base64')
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt a string value
 * @param encryptedText - Encrypted text (base64 encoded)
 * @returns Decrypted string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    return ''
  }
  
  try {
    const key = getEncryptionKey()
    const combined = Buffer.from(encryptedText, 'base64')
    
    // Extract iv, tag, and encrypted data
    const iv = combined.slice(0, IV_LENGTH)
    const tag = combined.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = combined.slice(IV_LENGTH + TAG_LENGTH)
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    // Tentativa de compatibilidade: decifrar com chave legada (fallback antigo)
    try {
      const legacyKey = getLegacyEncryptionKey()
      const combined = Buffer.from(encryptedText, 'base64')

      const iv = combined.slice(0, IV_LENGTH)
      const tag = combined.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
      const encrypted = combined.slice(IV_LENGTH + TAG_LENGTH)

      const decipher = crypto.createDecipheriv(ALGORITHM, legacyKey, iv)
      decipher.setAuthTag(tag)

      let decrypted = decipher.update(encrypted, undefined, 'utf8')
      decrypted += decipher.final('utf8')

      console.warn('Decrypt usando chave legada. Regrave client_secret para rotacionar com a nova IFOOD_ENCRYPTION_KEY.')
      return decrypted
    } catch (legacyError) {
      console.error('Decryption error (primary and legacy keys failed):', legacyError)
      throw new Error('Failed to decrypt data')
    }
  }
}

