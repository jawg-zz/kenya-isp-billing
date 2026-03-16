interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
}
interface RegisterInput {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    idNumber?: string;
}
declare class AuthService {
    register(input: RegisterInput): Promise<{
        user: any;
        tokens: AuthTokens;
    }>;
    login(email: string, password: string): Promise<{
        user: any;
        tokens: AuthTokens;
    }>;
    refreshToken(refreshToken: string): Promise<AuthTokens>;
    logout(userId: string, refreshToken?: string): Promise<void>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
    forgotPassword(email: string): Promise<void>;
    resetPassword(token: string, newPassword: string): Promise<void>;
    private generateTokens;
    private generateCustomerCode;
    private generateAccountNumber;
}
export declare const authService: AuthService;
export default authService;
//# sourceMappingURL=auth.service.d.ts.map