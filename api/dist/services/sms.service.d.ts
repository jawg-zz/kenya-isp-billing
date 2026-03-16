import { SMSRequest, SMSResponse } from '../types';
declare class SMSService {
    private baseUrl;
    private apiKey;
    private username;
    private senderId;
    constructor();
    private formatPhoneNumber;
    send(request: SMSRequest): Promise<SMSResponse>;
    sendPaymentConfirmation(phone: string, amount: number, reference: string, balance?: number): Promise<SMSResponse>;
    sendSubscriptionActivation(phone: string, planName: string, validity: string): Promise<SMSResponse>;
    sendExpiryWarning(phone: string, planName: string, daysRemaining: number): Promise<SMSResponse>;
    sendSubscriptionExpired(phone: string, planName: string): Promise<SMSResponse>;
    sendFUPWarning(phone: string, percentageUsed: number): Promise<SMSResponse>;
    sendAccountSuspended(phone: string, reason?: string): Promise<SMSResponse>;
    sendOTP(phone: string, otp: string): Promise<SMSResponse>;
    sendInvoiceNotification(phone: string, invoiceNumber: string, amount: number, dueDate: string): Promise<SMSResponse>;
    sendBulk(recipients: Array<{
        phone: string;
        message: string;
    }>): Promise<{
        success: number;
        failed: number;
    }>;
}
export declare const smsService: SMSService;
export default smsService;
//# sourceMappingURL=sms.service.d.ts.map