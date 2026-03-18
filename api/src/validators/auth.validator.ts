import { z } from 'zod';
import {
  emailSchema,
  phoneInputSchema,
  passwordSchema,
  trimmedString,
  countySchema,
  optionalTrimmedString,
  idNumberSchema,
} from './common';

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    firstName: trimmedString(2, 50, 'First name'),
    lastName: trimmedString(2, 50, 'Last name'),
    phone: phoneInputSchema,
    addressLine1: optionalTrimmedString(200),
    addressLine2: optionalTrimmedString(200),
    city: optionalTrimmedString(100),
    county: countySchema.optional(),
    postalCode: z.string().trim().max(10).optional(),
    idNumber: idNumberSchema.optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export const updateProfileSchema = z.object({
  firstName: trimmedString(2, 50, 'First name').optional(),
  lastName: trimmedString(2, 50, 'Last name').optional(),
  phone: phoneInputSchema.optional(),
  addressLine1: optionalTrimmedString(200),
  addressLine2: optionalTrimmedString(200),
  city: optionalTrimmedString(100),
  county: countySchema.optional(),
  postalCode: z.string().trim().max(10).optional(),
  preferredPayment: z
    .enum(['MPESA', 'AIRTEL_MONEY', 'CASH', 'BANK_TRANSFER', 'CARD'])
    .optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, 'Verification token is required'),
});

export const verifyPhoneSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Verification code must be exactly 6 digits'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type VerifyPhoneInput = z.infer<typeof verifyPhoneSchema>;
