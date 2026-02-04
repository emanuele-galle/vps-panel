/**
 * Password Validator Utility
 * Validates password strength according to security best practices
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export class PasswordValidator {
  private static readonly MIN_LENGTH = 8;
  private static readonly MAX_LENGTH = 128;

  /**
   * Validate password strength
   * Requirements:
   * - At least 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   * - No more than 128 characters
   */
  static validate(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // Check length
    if (password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters long`);
    }

    if (password.length > this.MAX_LENGTH) {
      errors.push(`Password must not exceed ${this.MAX_LENGTH} characters`);
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check for lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check for number
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for special character (no unnecessary escapes in character class)
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?)');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate and throw error if invalid
   */
  static validateOrThrow(password: string): void {
    const result = this.validate(password);

    if (!result.isValid) {
      throw new Error(result.errors.join(', '));
    }
  }

  /**
   * Get password strength score (0-5)
   * 0 = Very Weak, 5 = Very Strong
   */
  static getStrengthScore(password: string): number {
    let score = 0;

    // Length score
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Character variety score
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score++;

    return score;
  }

  /**
   * Get human-readable strength label
   */
  static getStrengthLabel(password: string): string {
    const score = this.getStrengthScore(password);

    switch (score) {
      case 0:
      case 1:
        return 'Very Weak';
      case 2:
        return 'Weak';
      case 3:
        return 'Fair';
      case 4:
        return 'Strong';
      case 5:
        return 'Very Strong';
      default:
        return 'Unknown';
    }
  }
}
