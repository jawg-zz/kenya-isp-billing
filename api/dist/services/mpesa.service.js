"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mpesaService = void 0;
const database_1 = require("../config/database");
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../config/logger");
const types_1 = require("../types");
class MpesaService {
    baseUrl;
    accessToken = null;
    tokenExpiry = null;
    constructor() {
        this.baseUrl = config_1.default.mpesa.environment === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
    }
    // Get OAuth token
    async getAccessToken() {
        // Return cached token if still valid
        if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
            return this.accessToken;
        }
        const auth = Buffer.from(`${config_1.default.mpesa.consumerKey}:${config_1.default.mpesa.consumerSecret}`).toString('base64');
        try {
            const response = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
                method: 'GET',
                headers: {
                    Authorization: `Basic ${auth}`,
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to get M-Pesa access token: ${response.statusText}`);
            }
            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = new Date(Date.now() + (parseInt(data.expires_in) * 1000) - 60000); // 1 min buffer
            return this.accessToken;
        }
        catch (error) {
            logger_1.logger.error('M-Pesa token error:', error);
            throw new types_1.AppError('Failed to authenticate with M-Pesa', 500);
        }
    }
    // Generate password for STK Push
    generatePassword() {
        const timestamp = this.getTimestamp();
        const password = Buffer.from(`${config_1.default.mpesa.shortcode}${config_1.default.mpesa.passkey}${timestamp}`).toString('base64');
        return password;
    }
    // Get current timestamp
    getTimestamp() {
        const now = new Date();
        return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }
    // Format phone number to 254 format
    formatPhoneNumber(phone) {
        // Remove all non-numeric characters
        let cleaned = phone.replace(/\D/g, '');
        // Handle different formats
        if (cleaned.startsWith('254')) {
            return cleaned;
        }
        else if (cleaned.startsWith('0')) {
            return `254${cleaned.substring(1)}`;
        }
        else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
            return `254${cleaned}`;
        }
        return cleaned;
    }
    // Initiate STK Push
    async initiateSTKPush(request) {
        const accessToken = await this.getAccessToken();
        const formattedPhone = this.formatPhoneNumber(request.phoneNumber);
        // Validate phone number format
        if (!/^254[17]\d{8}$/.test(formattedPhone)) {
            throw new types_1.PaymentError('Invalid phone number format');
        }
        const payload = {
            BusinessShortCode: config_1.default.mpesa.shortcode,
            Password: this.generatePassword(),
            Timestamp: this.getTimestamp(),
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(request.amount),
            PartyA: formattedPhone,
            PartyB: config_1.default.mpesa.shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: config_1.default.mpesa.callbackUrl,
            AccountReference: request.accountReference.substring(0, 20),
            TransactionDesc: request.transactionDesc.substring(0, 100),
        };
        logger_1.logger.info('Initiating M-Pesa STK Push:', {
            phone: formattedPhone,
            amount: request.amount,
            reference: request.accountReference,
        });
        try {
            const response = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (data.ResponseCode !== '0') {
                logger_1.logger.error('M-Pesa STK Push failed:', data);
                throw new types_1.PaymentError(data.ResponseDescription || 'STK Push failed');
            }
            logger_1.logger.info('M-Pesa STK Push initiated:', {
                merchantRequestId: data.MerchantRequestID,
                checkoutRequestId: data.CheckoutRequestID,
            });
            return data;
        }
        catch (error) {
            if (error instanceof types_1.PaymentError) {
                throw error;
            }
            logger_1.logger.error('M-Pesa STK Push error:', error);
            throw new types_1.PaymentError('Failed to initiate payment');
        }
    }
    // Query STK Push status
    async querySTKPushStatus(checkoutRequestId) {
        const accessToken = await this.getAccessToken();
        const payload = {
            BusinessShortCode: config_1.default.mpesa.shortcode,
            Password: this.generatePassword(),
            Timestamp: this.getTimestamp(),
            CheckoutRequestID: checkoutRequestId,
        };
        try {
            const response = await fetch(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            logger_1.logger.info('M-Pesa STK Push query:', data);
            return data;
        }
        catch (error) {
            logger_1.logger.error('M-Pesa STK Push query error:', error);
            throw new types_1.AppError('Failed to query payment status', 500);
        }
    }
    // Process callback
    async processCallback(callback) {
        const { stkCallback } = callback.Body;
        const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;
        logger_1.logger.info('M-Pesa callback received:', {
            merchantRequestId: MerchantRequestID,
            checkoutRequestId: CheckoutRequestID,
            resultCode: ResultCode,
        });
        // Find the payment record
        const payment = await database_1.prisma.payment.findFirst({
            where: {
                OR: [
                    { merchantRequestId: MerchantRequestID },
                    { checkoutRequestId: CheckoutRequestID },
                ],
            },
            include: {
                customer: true,
                subscription: true,
            },
        });
        if (!payment) {
            logger_1.logger.error('Payment not found for callback:', {
                merchantRequestId: MerchantRequestID,
                checkoutRequestId: CheckoutRequestID,
            });
            return;
        }
        // Extract callback metadata
        let mpesaReceiptNumber;
        let transactionDate;
        let phoneNumber;
        if (stkCallback.CallbackMetadata) {
            for (const item of stkCallback.CallbackMetadata.Item) {
                switch (item.Name) {
                    case 'MpesaReceiptNumber':
                        mpesaReceiptNumber = item.Value;
                        break;
                    case 'TransactionDate':
                        transactionDate = item.Value;
                        break;
                    case 'PhoneNumber':
                        phoneNumber = item.Value;
                        break;
                }
            }
        }
        // Update payment based on result code
        const updateData = {
            resultCode: ResultCode.toString(),
            resultDesc: ResultDesc,
            metadata: {
                ...(payment.metadata || {}),
                mpesaReceiptNumber,
                transactionDate,
                phoneNumber,
            },
        };
        if (ResultCode === 0) {
            // Payment successful
            updateData.status = 'COMPLETED';
            updateData.reference = mpesaReceiptNumber;
            updateData.processedAt = new Date();
            await database_1.prisma.payment.update({
                where: { id: payment.id },
                data: updateData,
            });
            // Process successful payment
            await this.handleSuccessfulPayment(payment);
        }
        else {
            // Payment failed
            updateData.status = 'FAILED';
            await database_1.prisma.payment.update({
                where: { id: payment.id },
                data: updateData,
            });
            logger_1.logger.warn('M-Pesa payment failed:', {
                paymentId: payment.id,
                resultCode: ResultCode,
                resultDesc: ResultDesc,
            });
            // Notify customer of failed payment
            await database_1.prisma.notification.create({
                data: {
                    userId: payment.customer.userId,
                    type: 'PAYMENT_FAILED',
                    title: 'Payment Failed',
                    message: `Your M-Pesa payment of KES ${payment.amount} failed: ${ResultDesc}`,
                    channel: 'in_app',
                },
            });
        }
    }
    // Handle successful payment
    async handleSuccessfulPayment(payment) {
        try {
            // Update customer balance
            await database_1.prisma.customer.update({
                where: { id: payment.customerId },
                data: {
                    balance: {
                        increment: payment.amount,
                    },
                },
            });
            // Update invoice if exists
            if (payment.invoiceId) {
                await database_1.prisma.invoice.update({
                    where: { id: payment.invoiceId },
                    data: {
                        status: 'PAID',
                        paidAt: new Date(),
                    },
                });
            }
            // Activate or renew subscription if exists
            if (payment.subscriptionId) {
                const subscription = await database_1.prisma.subscription.findUnique({
                    where: { id: payment.subscriptionId },
                    include: { plan: true },
                });
                if (subscription) {
                    const plan = subscription.plan;
                    const now = new Date();
                    const newEndDate = new Date(now);
                    newEndDate.setDate(newEndDate.getDate() + plan.validityDays);
                    await database_1.prisma.subscription.update({
                        where: { id: subscription.id },
                        data: {
                            status: 'ACTIVE',
                            startDate: now,
                            endDate: newEndDate,
                            dataUsed: 0,
                            dataRemaining: plan.dataAllowance,
                            voiceMinutesUsed: 0,
                            smsUsed: 0,
                        },
                    });
                    // Create notification
                    await database_1.prisma.notification.create({
                        data: {
                            userId: payment.customer.userId,
                            type: 'SUBSCRIPTION_ACTIVATED',
                            title: 'Subscription Activated',
                            message: `Your ${plan.name} subscription has been activated. Valid until ${newEndDate.toLocaleDateString('en-KE')}`,
                            channel: 'in_app',
                        },
                    });
                }
            }
            // Create payment notification
            await database_1.prisma.notification.create({
                data: {
                    userId: payment.customer.userId,
                    type: 'PAYMENT_RECEIVED',
                    title: 'Payment Received',
                    message: `Your M-Pesa payment of KES ${payment.amount} has been received successfully.`,
                    channel: 'in_app',
                },
            });
            logger_1.logger.info('Payment processed successfully:', { paymentId: payment.id });
        }
        catch (error) {
            logger_1.logger.error('Error processing successful payment:', error);
        }
    }
    // Validate callback signature
    validateCallback(body) {
        // In production, validate the callback using the certificate
        // For now, we'll just check if the body has required fields
        return body?.Body?.stkCallback?.MerchantRequestID != null;
    }
}
exports.mpesaService = new MpesaService();
exports.default = exports.mpesaService;
//# sourceMappingURL=mpesa.service.js.map