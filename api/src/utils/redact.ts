/**
 * PII Redaction Utilities
 *
 * Provides functions to redact personally identifiable information (PII)
 * from logs to prevent sensitive data leakage.
 */

/**
 * Redact an email address, showing only the first character of the local part.
 * Example: "john.doe@example.com" → "j***@example.com"
 */
export function redactEmail(email: string): string {
  if (!email || typeof email !== 'string') return '***';

  const atIndex = email.indexOf('@');
  if (atIndex === -1) return '***';

  const localPart = email.substring(0, 1);
  const domain = email.substring(atIndex + 1);
  return `${localPart}***@${domain}`;
}

/**
 * Redact a phone number, showing only the country code prefix and last 3 digits.
 * Example: "+254712345678" → "+2547***678"
 * Example: "0712345678" → "07***678"
 */
export function redactPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '***';

  const cleaned = phone.replace(/\s+/g, '');

  if (cleaned.length <= 4) return '***';

  // Keep first 4 chars (e.g., "+254" or "0712") and last 3 chars
  const prefix = cleaned.substring(0, 4);
  const suffix = cleaned.substring(cleaned.length - 3);
  return `${prefix}***${suffix}`;
}

/**
 * Redact all PII (emails and phone numbers) within an arbitrary string.
 * Use this to sanitize log messages or error strings that may contain embedded PII.
 */
export function redactPII(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // Redact email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let result = text.replace(emailRegex, (match) => redactEmail(match));

  // Redact phone numbers (international and local Kenyan formats)
  // Matches: +254XXXXXXXXX, 07XXXXXXXX, 01XXXXXXXX, 254XXXXXXXXX
  const phoneRegex = /(?:\+?254|0)[71][0-9]{8}/g;
  result = result.replace(phoneRegex, (match) => redactPhone(match));

  return result;
}
