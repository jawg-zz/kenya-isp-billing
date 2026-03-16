import { InputHTMLAttributes, useState, useEffect, useCallback } from 'react';
import { Input } from './Input';
import { validateField, ValidationRule } from '@/lib/validation';
import { clsx } from 'clsx';
import { AlertCircle } from 'lucide-react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  rules?: ValidationRule[];
  onValidationChange?: (isValid: boolean) => void;
}

export function FormField({
  label,
  helperText,
  rules = [],
  onValidationChange,
  className,
  value,
  onChange,
  ...props
}: FormFieldProps) {
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const validate = useCallback((val: string) => {
    if (rules.length === 0) return;
    const err = validateField(val, rules);
    setError(err);
    onValidationChange?.(!err);
  }, [rules, onValidationChange]);

  useEffect(() => {
    if (touched && value !== undefined) {
      validate(String(value));
    }
  }, [value, touched, validate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    if (touched) {
      validate(e.target.value);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    if (value !== undefined) {
      validate(String(value));
    }
  };

  const showError = touched && error;

  return (
    <div className="space-y-1">
      <Input
        label={label}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={clsx(
          showError && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {showError && (
        <div className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {!showError && helperText && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
}
