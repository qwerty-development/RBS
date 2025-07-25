import { Alert } from 'react-native';
import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Security configuration
const SECURITY_CONFIG = {
  maxInputLength: 10000,
  rateLimitWindow: 60000, // 1 minute
  maxRequestsPerWindow: 100,
  sensitiveDataPatterns: [
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
    /\b\d{3}-?\d{2}-?\d{4}\b/, // SSN
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email (for logging protection)
  ],
};

/**
 * Input sanitization utilities
 */
export class InputSanitizer {
  /**
   * Sanitize text input to prevent XSS and injection attacks
   */
  static sanitizeText(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Limit length
    if (sanitized.length > SECURITY_CONFIG.maxInputLength) {
      sanitized = sanitized.substring(0, SECURITY_CONFIG.maxInputLength);
    }

    // Remove potentially dangerous characters for SQL injection
    sanitized = sanitized.replace(/[<>'";&\\]/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  /**
   * Sanitize email input
   */
  static sanitizeEmail(email: string): string {
    if (typeof email !== 'string') {
      return '';
    }

    // Basic email format validation and sanitization
    const sanitized = email.toLowerCase().trim();
    
    // Remove dangerous characters
    return sanitized.replace(/[<>'";&\\]/g, '');
  }

  /**
   * Sanitize phone number
   */
  static sanitizePhoneNumber(phone: string): string {
    if (typeof phone !== 'string') {
      return '';
    }

    // Keep only digits, spaces, hyphens, plus, and parentheses
    return phone.replace(/[^0-9\s\-+()]/g, '').trim();
  }

  /**
   * Sanitize URL input
   */
  static sanitizeUrl(url: string): string {
    if (typeof url !== 'string') {
      return '';
    }

    try {
      const urlObj = new URL(url);
      
      // Only allow https and http protocols
      if (!['https:', 'http:'].includes(urlObj.protocol)) {
        return '';
      }

      return urlObj.toString();
    } catch {
      return '';
    }
  }

  /**
   * Remove sensitive data from logs
   */
  static sanitizeForLogging(data: any): any {
    if (typeof data === 'string') {
      let sanitized = data;
      
      // Replace sensitive patterns
      SECURITY_CONFIG.sensitiveDataPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      });

      return sanitized;
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = Array.isArray(data) ? [] : {};
      
      for (const [key, value] of Object.entries(data)) {
        // Redact common sensitive field names
        if (['password', 'token', 'secret', 'key', 'auth'].some(sensitive => 
          key.toLowerCase().includes(sensitive)
        )) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeForLogging(value);
        }
      }

      return sanitized;
    }

    return data;
  }
}

/**
 * Input validation utilities
 */
export class InputValidator {
  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
    return emailRegex.test(email) && email.length <= 320; // RFC 5321 limit
  }

  /**
   * Validate phone number format
   */
  static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-()]{7,15}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
    strength: 'weak' | 'medium' | 'strong';
  } {
    const errors: string[] = [];
    let score = 0;

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    } else {
      score += 1;
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else {
      score += 1;
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else {
      score += 1;
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else {
      score += 1;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else {
      score += 1;
    }

    // Check for common weak passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'abc123'];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
      score = 0;
    }

    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    if (score >= 4) strength = 'strong';
    else if (score >= 2) strength = 'medium';

    return {
      isValid: errors.length === 0,
      errors,
      strength,
    };
  }

  /**
   * Validate URL
   */
  static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['https:', 'http:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Validate input length
   */
  static isValidLength(input: string, min: number = 0, max: number = SECURITY_CONFIG.maxInputLength): boolean {
    return input.length >= min && input.length <= max;
  }
}

/**
 * Rate limiting utilities
 */
export class RateLimiter {
  private static requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Check if request is within rate limit
   */
  static async checkRateLimit(identifier: string, limit: number = SECURITY_CONFIG.maxRequestsPerWindow): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - SECURITY_CONFIG.rateLimitWindow;

    const current = this.requestCounts.get(identifier);

    if (!current || current.resetTime < windowStart) {
      // Reset or initialize counter
      this.requestCounts.set(identifier, { count: 1, resetTime: now });
      return true;
    }

    if (current.count >= limit) {
      // Rate limit exceeded
      this.logSecurityEvent('rate_limit_exceeded', { identifier, count: current.count });
      return false;
    }

    // Increment counter
    current.count++;
    return true;
  }

  /**
   * Log security event
   */
  private static logSecurityEvent(event: string, data: any) {
    console.warn(`Security event: ${event}`, InputSanitizer.sanitizeForLogging(data));
    
    Sentry.addBreadcrumb({
      message: `Security: ${event}`,
      category: 'security',
      level: 'warning',
      data: InputSanitizer.sanitizeForLogging(data),
    });
  }
}

/**
 * Secure storage utilities
 */
export class SecureStorage {
  private static readonly ENCRYPTION_KEY = 'app_encryption_key';

  /**
   * Store sensitive data securely
   */
  static async store(key: string, value: string): Promise<void> {
    try {
      // In a real app, you would use a proper encryption library
      // This is a simplified example
      const encrypted = this.simpleEncrypt(value);
      await AsyncStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Secure storage error:', error);
      throw new Error('Failed to store sensitive data');
    }
  }

  /**
   * Retrieve sensitive data securely
   */
  static async retrieve(key: string): Promise<string | null> {
    try {
      const encrypted = await AsyncStorage.getItem(key);
      if (!encrypted) return null;
      
      return this.simpleDecrypt(encrypted);
    } catch (error) {
      console.error('Secure retrieval error:', error);
      return null;
    }
  }

  /**
   * Remove sensitive data
   */
  static async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Secure removal error:', error);
    }
  }

  /**
   * Simple encryption (use a proper crypto library in production)
   */
  private static simpleEncrypt(text: string): string {
    // This is NOT secure encryption - use react-native-keychain or similar in production
    return Buffer.from(text).toString('base64');
  }

  /**
   * Simple decryption (use a proper crypto library in production)
   */
  private static simpleDecrypt(encrypted: string): string {
    // This is NOT secure decryption - use react-native-keychain or similar in production
    return Buffer.from(encrypted, 'base64').toString();
  }
}

/**
 * Security monitoring utilities
 */
export class SecurityMonitor {
  /**
   * Monitor for suspicious activity
   */
  static monitorSuspiciousActivity(activity: {
    type: 'multiple_failed_logins' | 'rapid_requests' | 'invalid_input' | 'unauthorized_access';
    metadata?: any;
  }) {
    const { type, metadata } = activity;

    console.warn(`Suspicious activity detected: ${type}`, metadata);

    // Report to monitoring service
    Sentry.withScope((scope) => {
      scope.setTag('security_alert', true);
      scope.setLevel('warning');
      scope.setContext('suspicious_activity', {
        type,
        metadata: InputSanitizer.sanitizeForLogging(metadata),
        timestamp: new Date().toISOString(),
      });
      
      Sentry.captureMessage(`Suspicious activity: ${type}`);
    });

    // Take appropriate action based on activity type
    switch (type) {
      case 'multiple_failed_logins':
        this.handleMultipleFailedLogins(metadata);
        break;
      case 'rapid_requests':
        this.handleRapidRequests(metadata);
        break;
      case 'invalid_input':
        this.handleInvalidInput(metadata);
        break;
      case 'unauthorized_access':
        this.handleUnauthorizedAccess(metadata);
        break;
    }
  }

  private static handleMultipleFailedLogins(metadata: any) {
    // Could implement account lockout, captcha, etc.
    Alert.alert(
      'Security Alert',
      'Multiple failed login attempts detected. Please verify your credentials.',
      [{ text: 'OK' }]
    );
  }

  private static handleRapidRequests(metadata: any) {
    // Could implement temporary blocks, warnings, etc.
    console.warn('Rapid requests detected - possible bot activity');
  }

  private static handleInvalidInput(metadata: any) {
    // Log and monitor for patterns
    console.warn('Invalid input detected - possible injection attempt');
  }

  private static handleUnauthorizedAccess(metadata: any) {
    // Could trigger logout, session invalidation, etc.
    Alert.alert(
      'Security Alert',
      'Unauthorized access detected. Please log in again.',
      [{ text: 'OK' }]
    );
  }
}

/**
 * Hook for secure input handling
 */
export function useSecureInput() {
  const validateAndSanitize = (
    input: string,
    type: 'text' | 'email' | 'phone' | 'url' | 'password' = 'text'
  ) => {
    // Sanitize first
    let sanitized: string;
    switch (type) {
      case 'email':
        sanitized = InputSanitizer.sanitizeEmail(input);
        break;
      case 'phone':
        sanitized = InputSanitizer.sanitizePhoneNumber(input);
        break;
      case 'url':
        sanitized = InputSanitizer.sanitizeUrl(input);
        break;
      default:
        sanitized = InputSanitizer.sanitizeText(input);
    }

    // Validate
    let isValid = true;
    let errors: string[] = [];

    switch (type) {
      case 'email':
        isValid = InputValidator.isValidEmail(sanitized);
        if (!isValid) errors.push('Invalid email format');
        break;
      case 'phone':
        isValid = InputValidator.isValidPhoneNumber(sanitized);
        if (!isValid) errors.push('Invalid phone number format');
        break;
      case 'url':
        isValid = InputValidator.isValidUrl(sanitized);
        if (!isValid) errors.push('Invalid URL format');
        break;
      case 'password':
        const passwordValidation = InputValidator.validatePassword(sanitized);
        isValid = passwordValidation.isValid;
        errors = passwordValidation.errors;
        break;
    }

    return {
      sanitized,
      isValid,
      errors,
    };
  };

  return { validateAndSanitize };
}

/**
 * Security middleware for API calls
 */
export function withSecurityMiddleware<T extends (...args: any[]) => any>(
  apiCall: T,
  options: {
    rateLimitKey?: string;
    sanitizeArgs?: boolean;
    monitorFailures?: boolean;
  } = {}
): T {
  const { rateLimitKey, sanitizeArgs = true, monitorFailures = true } = options;

  return (async (...args: Parameters<T>) => {
    try {
      // Rate limiting
      if (rateLimitKey) {
        const allowed = await RateLimiter.checkRateLimit(rateLimitKey);
        if (!allowed) {
          throw new Error('Rate limit exceeded');
        }
      }

      // Sanitize arguments
      if (sanitizeArgs) {
        args = args.map(arg => 
          typeof arg === 'string' ? InputSanitizer.sanitizeText(arg) : arg
        ) as Parameters<T>;
      }

      // Make API call
      const result = await apiCall(...args);
      return result;
    } catch (error) {
      if (monitorFailures) {
        SecurityMonitor.monitorSuspiciousActivity({
          type: 'invalid_input',
          metadata: {
            function: apiCall.name,
            error: (error as Error).message,
            args: InputSanitizer.sanitizeForLogging(args),
          },
        });
      }
      throw error;
    }
  }) as T;
} 