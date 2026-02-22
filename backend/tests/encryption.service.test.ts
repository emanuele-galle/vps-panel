import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing the service
vi.mock('../src/config/env', () => ({
  config: {
    ENCRYPTION_KEY: 'a0c8436618d15d7e29d32d4554c4bdbc47395bb5b84144878dbda0d5aa419654',
    NODE_ENV: 'test',
  },
}));

import { encryptionService, EncryptionService } from '../src/services/encryption.service';

describe('EncryptionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'Hello, World! This is a secret message.';

      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertext for same input (random IV)', () => {
      const plaintext = 'Same input twice';

      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to the same value
      expect(encryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(encryptionService.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should throw on empty input for encrypt', () => {
      expect(() => encryptionService.encrypt('')).toThrow('Cannot encrypt empty value');
    });

    it('should throw on empty input for decrypt', () => {
      expect(() => encryptionService.decrypt('')).toThrow('Cannot decrypt empty value');
    });

    it('should throw on tampered ciphertext', () => {
      const plaintext = 'Sensitive data';
      const encrypted = encryptionService.encrypt(plaintext);

      // Tamper with the ciphertext by modifying a character
      const tampered = encrypted.slice(0, -5) + 'XXXXX';

      expect(() => encryptionService.decrypt(tampered)).toThrow('Decryption failed');
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const encrypted = encryptionService.encrypt('test data');
      expect(encryptionService.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(encryptionService.isEncrypted('just plain text')).toBe(false);
      expect(encryptionService.isEncrypted('hello world')).toBe(false);
      expect(encryptionService.isEncrypted('')).toBe(false);
    });

    it('should return false for short base64 strings', () => {
      // A base64 string that is too short to be a valid encrypted value
      // IV (12) + AuthTag (16) + 1 byte = 29 bytes minimum
      const shortBase64 = Buffer.from('short').toString('base64');
      expect(encryptionService.isEncrypted(shortBase64)).toBe(false);
    });
  });

  describe('generateKey', () => {
    it('should return 64 hex chars', () => {
      const key = EncryptionService.generateKey();

      expect(key).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(key)).toBe(true);
    });

    it('should generate unique keys each time', () => {
      const key1 = EncryptionService.generateKey();
      const key2 = EncryptionService.generateKey();

      expect(key1).not.toBe(key2);
    });
  });
});
