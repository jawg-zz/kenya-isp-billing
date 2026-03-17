import { z } from 'zod';

// ── Kenyan Counties ──────────────────────────────────────────────────────────
export const KENYAN_COUNTIES = [
  'Mombasa', 'Kwale', 'Kilifi', 'Tana River', 'Lamu', 'Taita-Taveta',
  'Garissa', 'Wajir', 'Mandera', 'Marsabit', 'Isiolo', 'Meru',
  'Tharaka-Nithi', 'Embu', 'Kitui', 'Machakos', 'Makueni', 'Nyandarua',
  'Nyeri', "Kirinyga", "Murang'a", 'Kiambu', 'Turkana', 'West Pokot',
  'Samburu', 'Trans Nzoia', 'Uasin Gishu', 'Elgeyo-Marakwet', 'Nandi',
  'Baringo', 'Laikipia', 'Nakuru', 'Narok', 'Kajiado', 'Kericho',
  'Bomet', 'Kakamega', 'Vihiga', 'Bungoma', 'Busia', 'Siaya',
  'Kisumu', 'Homa Bay', 'Migori', 'Kisii', 'Nyamira',
  'Nairobi', 'Kiambu', 'Kajiado', 'Machakos', 'Murang\'a', 'Nyeri',
] as const;

// ── Shared reusable schemas ─────────────────────────────────────────────────

/** Kenyan phone number: +254XXXXXXXXX or 07XXXXXXXX */
export const phoneSchema = z
  .string()
  .regex(
    /^(\+254)[17]\d{8}$/,
    'Invalid Kenyan phone number format. Use +254XXXXXXXXX'
  );

/** Kenyan phone accepting both formats, normalized to +254XXXXXXXXX */
export const phoneInputSchema = z
  .string()
  .regex(
    /^(\+254|0)[17]\d{8}$/,
    'Invalid Kenyan phone number format. Use +254XXXXXXXXX or 07XXXXXXXX'
  )
  .transform((val) => (val.startsWith('0') ? '+254' + val.slice(1) : val));

/** Email: normalized to lowercase, trimmed */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(100, 'Email must not exceed 100 characters')
  .transform((val) => val.trim().toLowerCase());

/** String with trim + length limits */
export const trimmedString = (min: number, max: number, fieldName: string) =>
  z
    .string()
    .trim()
    .min(min, `${fieldName} must be at least ${min} characters`)
    .max(max, `${fieldName} must not exceed ${max} characters`);

/** Optional trimmed string */
export const optionalTrimmedString = (max: number) =>
  z.string().trim().max(max).optional();

/** Kenyan ID number: exactly 8 digits */
export const idNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{8}$/, 'ID number must be exactly 8 digits');

/** KRA PIN: 10-character alphanumeric, uppercased */
export const kraPinSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9]{10}$/,
    'KRA PIN must be exactly 10 alphanumeric characters'
  )
  .transform((val) => val.toUpperCase());

/** Valid Kenyan county */
export const countySchema = z
  .string()
  .trim()
  .refine(
    (val) => KENYAN_COUNTIES.map((c) => c.toLowerCase()).includes(val.toLowerCase()),
    { message: 'Invalid Kenyan county' }
  )
  .transform((val) => {
    const match = KENYAN_COUNTIES.find(
      (c) => c.toLowerCase() === val.toLowerCase()
    );
    return match ?? val;
  });

/** UUID */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/** Positive decimal (number) */
export const positiveDecimal = (fieldName: string, opts?: { min?: number; max?: number }) => {
  let schema = z.number().positive(`${fieldName} must be a positive number`);
  if (opts?.min !== undefined) {
    schema = schema.min(opts.min, `${fieldName} must be at least ${opts.min}`);
  }
  if (opts?.max !== undefined) {
    schema = schema.max(opts.max, `${fieldName} must not exceed ${opts.max}`);
  }
  return schema;
};

/** Non-negative integer */
export const nonNegativeInt = (fieldName: string) =>
  z.number().int().nonnegative(`${fieldName} must be a non-negative integer`);

/** Positive integer */
export const positiveInt = (fieldName: string) =>
  z.number().int().positive(`${fieldName} must be a positive integer`);

/** Password: min 8 chars, upper, lower, digit */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(
    /[^A-Za-z0-9]/,
    'Password must contain at least one special character'
  );

/** DateTime ISO string in the future */
export const futureDateSchema = z
  .string()
  .datetime('Invalid date format. Use ISO 8601')
  .refine(
    (val) => new Date(val) > new Date(),
    'Date must be in the future'
  );
