/**
 * Encryption Service
 *
 * Provides secure AES-256-GCM encryption for sensitive data.
 * Uses a dedicated encryption key separate from JWT_SECRET.
 *
 * Security features:
 * - AES-256-GCM (authenticated encryption)
 * - Random IV per encryption
 * - Authentication tag verification
 * - Timing-safe comparisons
 */

import crypto from 'crypto';
import { config } from '../config/env';

/**
 * Encryption algorithm - AES-256-GCM (authenticated encryption)
 */
const ALGORITHM = 'aes-256-gcm';

/**
 * IV length in bytes (96 bits recommended for GCM)
 */
const IV_LENGTH = 12;

/**
 * Auth tag length in bytes
 */
const AUTH_TAG_LENGTH = 16;

/**
 * Key length in bytes (256 bits)
 */
const KEY_LENGTH = 32;

class EncryptionService {
  private key: Buffer;

  constructor() {
    this.key = this.deriveKey();
  }

  /**
   * Derive encryption key from configuration
   * Validates key format and converts hex to Buffer
   */
  private deriveKey(): Buffer {
    const keyHex = config.ENCRYPTION_KEY;

    // Validate key length (64 hex chars = 32 bytes = 256 bits)
    if (keyHex.length !== 64) {
      throw new Error(
        `ENCRYPTION_KEY must be 64 hex characters (256 bits). Got ${keyHex.length} characters.`
      );
    }

    // Validate hex format
    if (!/^[a-f0-9]+$/i.test(keyHex)) {
      throw new Error('ENCRYPTION_KEY must be a valid hex string');
    }

    return Buffer.from(keyHex, 'hex');
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   *
   * Format: base64(iv:authTag:ciphertext)
   *
   * @param plaintext - Text to encrypt
   * @returns Encrypted string in format: base64(iv:authTag:ciphertext)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty value');
    }

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine: iv + authTag + ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);

    // Return as base64
    return combined.toString('base64');
  }

  /**
   * Decrypt ciphertext using AES-256-GCM
   *
   * @param ciphertext - Encrypted string from encrypt()
   * @returns Decrypted plaintext
   * @throws Error if decryption fails (tampering, wrong key, etc.)
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext) {
      throw new Error('Cannot decrypt empty value');
    }

    try {
      // Decode from base64
      const combined = Buffer.from(ciphertext, 'base64');

      // Extract parts
      const iv = combined.subarray(0, IV_LENGTH);
      const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

      // Validate minimum length
      if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error('Invalid ciphertext format');
      }

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });

      // Set auth tag
      decipher.setAuthTag(authTag);

      // Decrypt
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (_error) {
      // Don't leak information about why decryption failed
      throw new Error('Decryption failed');
    }
  }

  /**
   * Check if a string appears to be encrypted with this service
   * (Base64 encoded and minimum expected length)
   */
  isEncrypted(value: string): boolean {
    if (!value) return false;

    // Check if it looks like base64
    if (!/^[A-Za-z0-9+/]+=*$/.test(value)) {
      return false;
    }

    try {
      const decoded = Buffer.from(value, 'base64');
      // Minimum length: IV (12) + AuthTag (16) + at least 1 byte of data
      return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
    } catch {
      return false;
    }
  }

  /**
   * Re-encrypt a value (useful for key rotation)
   */
  reEncrypt(oldCiphertext: string): string {
    const plaintext = this.decrypt(oldCiphertext);
    return this.encrypt(plaintext);
  }

  /**
   * Generate a new random encryption key (for setup/rotation)
   * Returns a 64-character hex string (256 bits)
   */
  static generateKey(): string {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
  }

  /**
   * Migrate from old CBC encryption format to new GCM format
   * Old format: hex(iv):hex(ciphertext) using AES-256-CBC
   *
   * @param oldCiphertext - Old format encrypted string
   * @param oldKey - Old encryption key (32 bytes)
   * @returns New format encrypted string
   */
  migrateFromCBC(oldCiphertext: string, oldKey: Buffer): string {
    // Check if it's old format (contains colon and is hex)
    if (!oldCiphertext.includes(':')) {
      throw new Error('Not in old CBC format');
    }

    const parts = oldCiphertext.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid old format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');

    // Decrypt with old algorithm
    const decipher = crypto.createDecipheriv('aes-256-cbc', oldKey, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    const plaintext = decrypted.toString('utf8');

    // Re-encrypt with new algorithm
    return this.encrypt(plaintext);
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();

// Export class for testing
export { EncryptionService };
