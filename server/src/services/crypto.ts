import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recomendado para GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

// Obtém a chave mestre de criptografia a partir do ambiente ou deriva uma padrão segura
function getMasterKey(): Buffer {
  const secret = process.env.VAULT_SECRET_KEY || 'rededoc-vault-master-encryption-key-condominio-2026';
  // Garante uma chave de exatamente 32 bytes (256 bits) usando SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

export interface EncryptedData {
  encryptedPassword: string;
  iv: string;
  authTag: string;
}

/**
 * Criptografa uma senha ou credencial com AES-256-GCM
 */
export function encryptCredential(plainText: string): EncryptedData {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encryptedPassword: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Descriptografa uma senha do cofre validando a integridade da Auth Tag
 */
export function decryptCredential(encryptedHex: string, ivHex: string, authTagHex: string): string {
  const masterKey = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Hash seguro para senhas de usuários do sistema (bcrypt)
 */
export async function hashSystemPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Comparação de senha de usuário
 */
export async function compareSystemPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
