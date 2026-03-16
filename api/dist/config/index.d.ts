export declare const config: {
    env: string;
    port: number;
    apiPrefix: string;
    corsOrigin: string;
    database: {
        url: string;
    };
    redis: {
        url: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
        refreshSecret: string;
        refreshExpiresIn: string;
    };
    mpesa: {
        consumerKey: string;
        consumerSecret: string;
        passkey: string;
        shortcode: string;
        environment: string;
        callbackUrl: string;
        timeoutUrl: string;
    };
    airtel: {
        clientId: string;
        clientSecret: string;
        shortcode: string;
        environment: string;
        callbackUrl: string;
    };
    sms: {
        apiKey: string;
        username: string;
        senderId: string;
    };
    radius: {
        secret: string;
        host: string;
        port: number;
        accountingPort: number;
    };
    invoice: {
        companyName: string;
        companyAddress: string;
        companyPhone: string;
        companyEmail: string;
        companyKraPin: string;
    };
    logging: {
        level: string;
        filePath: string;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };
    business: {
        defaultCurrency: string;
        taxRate: number;
        taxName: string;
        fupEnabled: boolean;
        gracePeriodDays: number;
    };
};
export declare const validateConfig: () => boolean;
export default config;
//# sourceMappingURL=index.d.ts.map