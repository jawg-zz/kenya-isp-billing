import { z } from 'zod';
export declare const registerSchema: z.ZodEffects<z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    phone: z.ZodString;
    addressLine1: z.ZodOptional<z.ZodString>;
    addressLine2: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    county: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    idNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    idNumber?: string;
}, {
    phone?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    idNumber?: string;
}>, {
    phone?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    idNumber?: string;
}, {
    phone?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    idNumber?: string;
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
    password?: string;
}, {
    email?: string;
    password?: string;
}>;
export declare const refreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken?: string;
}, {
    refreshToken?: string;
}>;
export declare const changePasswordSchema: z.ZodEffects<z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
    confirmNewPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword?: string;
    newPassword?: string;
    confirmNewPassword?: string;
}, {
    currentPassword?: string;
    newPassword?: string;
    confirmNewPassword?: string;
}>, {
    currentPassword?: string;
    newPassword?: string;
    confirmNewPassword?: string;
}, {
    currentPassword?: string;
    newPassword?: string;
    confirmNewPassword?: string;
}>;
export declare const updateProfileSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    addressLine1: z.ZodOptional<z.ZodString>;
    addressLine2: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    county: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    preferredPayment: z.ZodOptional<z.ZodEnum<["MPESA", "AIREL_MONEY", "CASH", "BANK_TRANSFER", "CARD"]>>;
}, "strip", z.ZodTypeAny, {
    phone?: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    preferredPayment?: "MPESA" | "AIREL_MONEY" | "CASH" | "BANK_TRANSFER" | "CARD";
}, {
    phone?: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    preferredPayment?: "MPESA" | "AIREL_MONEY" | "CASH" | "BANK_TRANSFER" | "CARD";
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
}, {
    email?: string;
}>;
export declare const resetPasswordSchema: z.ZodEffects<z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password?: string;
    token?: string;
    confirmPassword?: string;
}, {
    password?: string;
    token?: string;
    confirmPassword?: string;
}>, {
    password?: string;
    token?: string;
    confirmPassword?: string;
}, {
    password?: string;
    token?: string;
    confirmPassword?: string;
}>;
export declare const verifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token?: string;
}, {
    token?: string;
}>;
export declare const verifyPhoneSchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code?: string;
}, {
    code?: string;
}>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type VerifyPhoneInput = z.infer<typeof verifyPhoneSchema>;
//# sourceMappingURL=auth.validator.d.ts.map