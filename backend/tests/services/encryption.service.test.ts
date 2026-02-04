import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// Create a valid 64-char hex key for testing using vi.hoisted
const { TEST_ENCRYPTION_KEY } = vi.hoisted(() => ({
  TEST_ENCRYPTION_KEY: 'a'.repeat(64),
}));

// Mock config before importing
vi.mock('../../src/config/env', () => ({
  config: {
    ENCRYPTION_KEY: 'a'.repeat(64),
  },
}));

import { EncryptionService, encryptionService } from '../../src/services/encryption.service';

describe('EncryptionService', () => {
  describe('encrypt', () => {
    it('should encrypt a string', () => {
      const plaintext = 'my-secret-password';
      const encrypted = encryptionService.encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toBeTruthy();
      // Should be base64 encoded
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'same-password';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for empty value', () => {
      expect(() => encryptionService.encrypt('')).toThrow('Cannot encrypt empty value');
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~€£¥©®™';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '密码 пароль كلمة السر 🔐🔑';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('decrypt', () => {
    it('should decrypt an encrypted string', () => {
      const plaintext = 'my-secret-password';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for empty value', () => {
      expect(() => encryptionService.decrypt('')).toThrow('Cannot decrypt empty value');
    });

    it('should throw error for invalid ciphertext', () => {
      expect(() => encryptionService.decrypt('not-valid-base64!!!')).toThrow('Decryption failed');
    });

    it('should throw error for truncated ciphertext', () => {
      const encrypted = encryptionService.encrypt('test');
      const truncated = encrypted.substring(0, 10);

      expect(() => encryptionService.decrypt(truncated)).toThrow('Decryption failed');
    });

    it('should throw error for tampered ciphertext', () => {
      const encrypted = encryptionService.encrypt('test');
      // Tamper with the ciphertext
      const decoded = Buffer.from(encrypted, 'base64');
      decoded[decoded.length - 1] ^= 0xff; // Flip last byte
      const tampered = decoded.toString('base64');

      expect(() => encryptionService.decrypt(tampered)).toThrow('Decryption failed');
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const encrypted = encryptionService.encrypt('test');
      expect(encryptionService.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plaintext', () => {
      expect(encryptionService.isEncrypted('plain-text')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(encryptionService.isEncrypted('')).toBe(false);
    });

    it('should return false for short base64', () => {
      expect(encryptionService.isEncrypted('YWJj')).toBe(false); // "abc" in base64
    });

    it('should return false for old hex format', () => {
      // Old format: hex(iv):hex(ciphertext)
      expect(encryptionService.isEncrypted('abcd1234:efgh5678')).toBe(false);
    });
  });

  describe('reEncrypt', () => {
    it('should produce new ciphertext for same plaintext', () => {
      const encrypted1 = encryptionService.encrypt('secret');
      const encrypted2 = encryptionService.reEncrypt(encrypted1);

      expect(encrypted1).not.toBe(encrypted2);
      expect(encryptionService.decrypt(encrypted2)).toBe('secret');
    });
  });

  describe('generateKey', () => {
    it('should generate 64-character hex string', () => {
      const key = EncryptionService.generateKey();

      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique keys', () => {
      const keys = new Set<string>();

      for (let i = 0; i < 10; i++) {
        keys.add(EncryptionService.generateKey());
      }

      expect(keys.size).toBe(10);
    });
  });

  describe('key validation', () => {
    it('should reject key with wrong length', () => {
      vi.doUnmock('../../src/config/env');
      vi.doMock('../../src/config/env', () => ({
        config: {
          ENCRYPTION_KEY: 'tooshort',
        },
      }));

      vi.resetModules();

      expect(async () => {
        const { EncryptionService: ES } = await import('../../src/services/encryption.service');
        new ES();
      }).rejects.toThrow(/ENCRYPTION_KEY must be 64 hex characters/);
    });

    it('should reject non-hex key', () => {
      vi.doUnmock('../../src/config/env');
      vi.doMock('../../src/config/env', () => ({
        config: {
          ENCRYPTION_KEY: 'g'.repeat(64), // 'g' is not hex
        },
      }));

      vi.resetModules();

      expect(async () => {
        const { EncryptionService: ES } = await import('../../src/services/encryption.service');
        new ES();
      }).rejects.toThrow(/ENCRYPTION_KEY must be a valid hex string/);
    });
  });
});

describe('Security: Encryption', () => {
  it('should use AES-256-GCM (authenticated encryption)', () => {
    // GCM provides authenticated encryption which prevents tampering
    const encrypted = encryptionService.encrypt('test');
    const decoded = Buffer.from(encrypted, 'base64');

    // GCM format: IV (12) + AuthTag (16) + Ciphertext
    // Minimum length check
    expect(decoded.length).toBeGreaterThan(12 + 16);
  });

  it('should use random IV for each encryption', () => {
    const plaintext = 'same-text';
    const encrypted1 = encryptionService.encrypt(plaintext);
    const encrypted2 = encryptionService.encrypt(plaintext);

    // Extract IVs (first 12 bytes)
    const iv1 = Buffer.from(encrypted1, 'base64').subarray(0, 12);
    const iv2 = Buffer.from(encrypted2, 'base64').subarray(0, 12);

    expect(iv1.equals(iv2)).toBe(false);
  });

  it('should detect tampered auth tag', () => {
    const encrypted = encryptionService.encrypt('sensitive-data');
    const decoded = Buffer.from(encrypted, 'base64');

    // Tamper with auth tag (bytes 12-28)
    decoded[15] ^= 0xff;

    const tampered = decoded.toString('base64');
    expect(() => encryptionService.decrypt(tampered)).toThrow('Decryption failed');
  });

  it('should detect tampered ciphertext', () => {
    const encrypted = encryptionService.encrypt('sensitive-data');
    const decoded = Buffer.from(encrypted, 'base64');

    // Tamper with ciphertext (after byte 28)
    if (decoded.length > 30) {
      decoded[30] ^= 0xff;
    }

    const tampered = decoded.toString('base64');
    expect(() => encryptionService.decrypt(tampered)).toThrow('Decryption failed');
  });

  it('should not leak information about decryption failures', () => {
    // All decryption failures should throw the same error message
    const invalidInputs = [
      'not-base64!!!',
      'YWJj', // too short
      Buffer.alloc(50).toString('base64'), // random bytes
    ];

    for (const input of invalidInputs) {
      try {
        encryptionService.decrypt(input);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toBe('Decryption failed');
      }
    }
  });
});

describe('Encryption roundtrip', () => {
  const testCases = [
    'simple',
    'with spaces',
    'with\nnewlines',
    'with\ttabs',
    '{"json":"data","num":123}',
    'Password!@#$%^&*()',
    '密码',
    '🔐🔑🗝️',
    '', // Edge case - should fail
  ];

  testCases.forEach((testCase) => {
    if (testCase === '') {
      it('should reject empty string', () => {
        expect(() => encryptionService.encrypt(testCase)).toThrow();
      });
    } else {
      it(`should roundtrip: "${testCase.substring(0, 20)}..."`, () => {
        const encrypted = encryptionService.encrypt(testCase);
        const decrypted = encryptionService.decrypt(encrypted);
        expect(decrypted).toBe(testCase);
      });
    }
  });
});
