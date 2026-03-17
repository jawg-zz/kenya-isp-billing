'use client';

import { useState, useCallback, useRef } from 'react';
import { validateField, ValidationRule, ValidationErrors } from '@/lib/validation';

interface UseFormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

/**
 * Hook for real-time form field validation.
 *
 * Usage:
 *   const { errors, validateFieldOnChange, validateFieldOnBlur, validateAll, clearErrors, setFieldError } = useFormValidation();
 *
 *   <Input onChange={e => validateFieldOnChange('email', e.target.value, emailRules)} onBlur={e => validateFieldOnBlur('email', e.target.value, emailRules)} />
 */
export function useFormValidation(options: UseFormValidationOptions = {}) {
  const { validateOnChange = true, validateOnBlur = true, debounceMs = 300 } = options;

  const [errors, setErrors] = useState<ValidationErrors>({});
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const setFieldError = useCallback((field: string, error: string | null) => {
    setErrors(prev => {
      if (error) {
        if (prev[field] === error) return prev;
        return { ...prev, [field]: error };
      }
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const validateFieldOnChange = useCallback((field: string, value: string, rules: ValidationRule[]) => {
    if (!validateOnChange) return;

    // Clear any pending debounced validation
    if (debounceRef.current[field]) {
      clearTimeout(debounceRef.current[field]);
    }

    // Debounce validation on keystroke to avoid flashing errors while typing
    debounceRef.current[field] = setTimeout(() => {
      const error = validateField(value, rules);
      setFieldError(field, error);
    }, debounceMs);
  }, [validateOnChange, debounceMs, setFieldError]);

  const validateFieldOnBlur = useCallback((field: string, value: string, rules: ValidationRule[]) => {
    if (!validateOnBlur) return;

    // Clear any pending debounced validation (validate immediately on blur)
    if (debounceRef.current[field]) {
      clearTimeout(debounceRef.current[field]);
    }

    const error = validateField(value, rules);
    setFieldError(field, error);
  }, [validateOnBlur, setFieldError]);

  const validateAll = useCallback((values: Record<string, string>, schema: Record<string, ValidationRule[]>): boolean => {
    const newErrors: ValidationErrors = {};
    for (const [field, rules] of Object.entries(schema)) {
      const error = validateField(values[field] || '', rules);
      if (error) {
        newErrors[field] = error;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, []);

  const hasErrors = Object.keys(errors).length > 0;

  return {
    errors,
    hasErrors,
    validateFieldOnChange,
    validateFieldOnBlur,
    validateAll,
    clearErrors,
    clearFieldError,
    setFieldError,
  };
}
