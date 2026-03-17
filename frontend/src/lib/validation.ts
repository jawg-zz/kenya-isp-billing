/**
 * Form validation utilities for ISP Billing Portal
 * Supports Kenya-specific validation (phone numbers, etc.)
 */

export interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
}

export interface FieldValidation {
  [key: string]: ValidationRule[];
}

// Common validation rules
export const validators = {
  required: (message = 'This field is required'): ValidationRule => ({
    validate: (value: string) => value.trim().length > 0,
    message,
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value: string) => value.length >= min,
    message: message || `Must be at least ${min} characters`,
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value: string) => value.length <= max,
    message: message || `Must be at most ${max} characters`,
  }),

  // Kenya phone number validation (+254 format)
  kenyaPhone: (message = 'Please enter a valid Kenya phone number (e.g., +254 7XX XXX XXX)'): ValidationRule => ({
    validate: (value: string) => {
      const cleaned = value.replace(/[\s-]/g, '');
      return /^\+?254[17]\d{8}$/.test(cleaned) || /^0[17]\d{8}$/.test(cleaned);
    },
    message,
  }),

  password: (message = 'Password must be at least 8 characters with uppercase, lowercase, and number'): ValidationRule => ({
    validate: (value: string) => {
      return value.length >= 8 &&
        /[A-Z]/.test(value) &&
        /[a-z]/.test(value) &&
        /[0-9]/.test(value);
    },
    message,
  }),

  // Lenient password: min 8 chars with at least one letter and one number
  passwordSimple: (message = 'Password must be at least 8 characters with at least one letter and one number'): ValidationRule => ({
    validate: (value: string) => {
      return value.length >= 8 &&
        /[a-zA-Z]/.test(value) &&
        /[0-9]/.test(value);
    },
    message,
  }),

  passwordMatch: (passwordGetter: () => string, message = 'Passwords do not match'): ValidationRule => ({
    validate: (value: string) => value === passwordGetter(),
    message,
  }),

  number: (message = 'Please enter a valid number'): ValidationRule => ({
    validate: (value: string) => !isNaN(Number(value)) && value.trim() !== '',
    message,
  }),

  positiveNumber: (message = 'Please enter a positive number'): ValidationRule => ({
    validate: (value: string) => !isNaN(Number(value)) && Number(value) > 0,
    message,
  }),

  ipAddress: (message = 'Please enter a valid IP address'): ValidationRule => ({
    validate: (value: string) => {
      const parts = value.split('.');
      return parts.length === 4 && parts.every((p) => {
        const n = parseInt(p, 10);
        return !isNaN(n) && n >= 0 && n <= 255;
      });
    },
    message,
  }),
};

export type ValidationErrors = Record<string, string>;

/**
 * Validate a field against rules
 * Returns error message or null if valid
 */
export function validateField(value: string, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    if (!rule.validate(value)) {
      return rule.message;
    }
  }
  return null;
}

/**
 * Validate all fields in a form
 * Returns object with field names as keys and error messages as values
 */
export function validateForm(
  values: Record<string, string>,
  schema: FieldValidation
): ValidationErrors {
  const errors: ValidationErrors = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = values[field] || '';
    const error = validateField(value, rules);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
}

/**
 * Check if form has any errors
 */
export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Format Kenya phone number for display
 */
export function formatKenyaPhone(phone: string): string {
  const cleaned = phone.replace(/[\s+]/g, '');

  if (cleaned.startsWith('254') && cleaned.length === 12) {
    return `+254 ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `+254 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  return phone;
}

/**
 * Format KES currency
 */
export function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Form validation hook helper
 * Returns onChange handler and error state
 */
export function createFieldValidator(
  rules: ValidationRule[],
  onError: (error: string | null) => void
) {
  return (value: string) => {
    const error = validateField(value, rules);
    onError(error);
  };
}

// ---- Password Strength ----

export interface PasswordStrength {
  score: number; // 0-4
  label: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
  message: string;
  color: string; // tailwind class for bar
  bgColor: string; // tailwind class for bar bg
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: 'weak', message: '', color: 'bg-gray-300', bgColor: 'bg-gray-200' };
  }

  let score = 0;

  // Length checks
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  // Normalize to 0-4
  const normalized = Math.min(4, Math.floor(score / 1.75));

  const levels: PasswordStrength['label'][] = ['weak', 'fair', 'good', 'strong', 'excellent'];
  const messages = [
    'Very weak — add length, numbers, and symbols',
    'Fair — add uppercase letters and symbols',
    'Good — could be stronger',
    'Strong password',
    'Excellent password',
  ];
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];

  return {
    score: normalized,
    label: levels[normalized],
    message: messages[normalized],
    color: colors[normalized],
    bgColor: 'bg-gray-200 dark:bg-gray-700',
  };
}
