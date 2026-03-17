"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.airtelService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../config/logger");
const types_1 = require("../types");
class AirtelService {
    baseUrl;
    accessToken = null;
    tokenExpiry = null;
    constructor() {
        this.baseUrl = config_1.default.airtel.environment === 'production'
            ? 'https://openapi.airtel.africa'
            : 'https://openapi.airtel.africa'; // Sandbox uses same URL
    }
    // Get OAuth token
    async getAccessToken() {
        // Return cached token if still valid
        if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
            return this.accessToken;
        }
        const payload = {
            client_id: config_1.default.airtel.clientId,
            client_secret: config_1.default.airtel.clientSecret,
            grant_type: 'client_credentials',
        };
        try {
            const response = await fetch(`${this.baseUrl}/auth/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                throw new Error(`Failed to get Airtel access token: ${response.statusText}`);
            }
            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000) - 60000);
            return this.accessToken;
        }
        catch (error) {
            logger_1.logger.error('Airtel token error:', error);
            throw new types_1.AppError('Failed to authenticate with Airtel Money', 500);
        }
    }
    // Format phone number for Airtel
    formatPhoneNumber(phone) {
        let cleaned = phone.replace(/\D/g, '');
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
    // Generate reference number
    generateReference() {
        return `AIR${Date.now()}${crypto_1.default.randomBytes(4).toString('hex').toUpperCase()}`;
    }
    // Initiate C2B payment (Collection - Customer to Business)
    async initiatePayment(request) {
        const accessToken = await this.getAccessToken();
        const formattedPhone = this.formatPhoneNumber(request.phoneNumber);
        const reference = request.reference || this.generateReference();
        // Validate phone number format
        if (!/^254[17]\d{8}$/.test(formattedPhone)) {
            throw new types_1.PaymentError('Invalid phone number format');
        }
        const payload = {
            reference: reference,
            subscriber: {
                country: 'KE',
                msisdn: formattedPhone,
            },
            transaction: {
                amount: request.amount,
                country: 'KE',
                currency: 'KES',
                description: request.description || `Payment for ISP Services`,
            },
            payment: {
                type: 'MOBILE_MONEY',
            },
        };
        logger_1.logger.info('Initiating Airtel Money payment:', {
            phone: formattedPhone,
            amount: request.amount,
            reference,
        });
        try {
            const response = await fetch(`${this.baseUrl}/merchant/v1/payments/`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-country': 'KE',
                    'X-currency': 'KES',
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (data.data.transaction.status !== 'PENDING') {
                logger_1.logger.error('Airtel payment initiation failed:', data);
                throw new types_1.PaymentError('Failed to initiate Airtel payment');
            }
            logger_1.logger.info('Airtel payment initiated:', {
                transactionId: data.data.transaction.id,
                reference: data.data.transaction.reference,
            });
            return data;
        }
        catch (error) {
            if (error instanceof types_1.PaymentError) {
                throw error;
            }
            logger_1.logger.error('Airtel payment error:', error);
            throw new types_1.PaymentError('Failed to initiate payment');
        }
    }
    // Check transaction status
    async checkTransactionStatus(transactionId) {
        const accessToken = await this.getAccessToken();
        try {
            const response = await fetch(`${this.baseUrl}/transaction/v3/transactions/${transactionId}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-country': 'KE',
                    'X-currency': 'KES',
                },
            });
            const data = await response.json();
            logger_1.logger.info('Airtel transaction status check:', data);
            return data;
        }
        catch (error) {
            logger_1.logger.error('Airtel status check error:', error);
            throw new types_1.AppError('Failed to check transaction status', 500);
        }
    }
    // Process callback
    async processCallback(callback) {
        const { transaction } = callback;
        logger_1.logger.info('Airtel callback received:', {
            transactionId: transaction.id,
            reference: transaction.reference,
            status: transaction.status,
        });
        // Use transaction to prevent race conditions
        await database_1.prisma.$transaction(async (tx) => {
            // Find the payment record
            const payment = await tx.payment.findFirst({
                where: {
                    reference: transaction.reference,
                },
                include: {
                    customer: true,
                    subscription: true,
                },
            });
            if (!payment) {
                logger_1.logger.error('Payment not found for callback:', {
                    reference: transaction.reference,
                });
                return;
            }
            // If payment already processed, skip
            if (payment.status === 'COMPLETED' || payment.status === 'FAILED') {
                logger_1.logger.warn(`Payment ${payment.id} already processed with status ${payment.status}`);
                return;
            }
            // Update payment based on status
            const updateData = {
                metadata: {
                    ...(payment.metadata || {}),
                    airtelTransactionId: transaction.id,
                    airtelStatus: transaction.status,
                },
            };
            if (transaction.status === 'SUCCESS') {
                updateData.status = 'COMPLETED';
                updateData.processedAt = new Date();
                await tx.payment.update({
                    where: { id: payment.id },
                    data: updateData,
                });
                // Process successful payment within same transaction
                await this.handleSuccessfulPaymentWithinTransaction(tx, payment);
            }
            else if (transaction.status === 'FAILED') {
                updateData.status = 'FAILED';
                updateData.resultDesc = transaction.status;
                await tx.payment.update({
                    where: { id: payment.id },
                    data: updateData,
                });
                logger_1.logger.warn('Airtel payment failed:', {
                    paymentId: payment.id,
                    status: transaction.status,
                });
                // Notify customer
                await tx.notification.create({
                    data: {
                        userId: payment.customer.userId,
                        type: 'PAYMENT_FAILED',
                        title: 'Payment Failed',
                        message: `Your Airtel Money payment of KES ${payment.amount} failed.`,
                        channel: 'in_app',
                    },
                });
            }
        });
    }
    // Handle successful payment (within transaction)
    async handleSuccessfulPaymentWithinTransaction(tx, payment) {
        // Update customer balance
        await tx.customer.update({
            where: { id: payment.customerId },
            data: {
                balance: {
                    increment: payment.amount,
                },
            },
        });
        // Update invoice if exists
        if (payment.invoiceId) {
            await tx.invoice.update({
                where: { id: payment.invoiceId },
                data: {
                    status: 'PAID',
                    paidAt: new Date(),
                },
            });
        }
        // Activate or renew subscription if exists
        if (payment.subscriptionId) {
            const subscription = await tx.subscription.findUnique({
                where: { id: payment.subscriptionId },
                include: { plan: true },
            });
            if (subscription) {
                const plan = subscription.plan;
                const now = new Date();
                let newEndDate = new Date(now);
                // If subscription already active, extend from existing end date
                if (subscription.status === 'ACTIVE' && subscription.endDate > now) {
                    newEndDate = new Date(subscription.endDate);
                    newEndDate.setDate(newEndDate.getDate() + plan.validityDays);
                }
                else {
                    newEndDate.setDate(newEndDate.getDate() + plan.validityDays);
                }
                const updateData = {
                    status: 'ACTIVE',
                    endDate: newEndDate,
                };
                // Only reset usage if subscription was not active
                if (subscription.status !== 'ACTIVE') {
                    updateData.startDate = now;
                    updateData.dataUsed = 0;
                    updateData.dataRemaining = plan.dataAllowance;
                }
                await tx.subscription.update({
                    where: { id: subscription.id },
                    data: updateData,
                });
                await tx.notification.create({
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
        // Create notification
        await tx.notification.create({
            data: {
                userId: payment.customer.userId,
                type: 'PAYMENT_RECEIVED',
                title: 'Payment Received',
                message: `Your Airtel Money payment of KES ${payment.amount} has been received.`,
                channel: 'in_app',
            },
        });
        logger_1.logger.info('Airtel payment processed successfully:', { paymentId: payment.id });
    }
    // Handle successful payment (non-transaction wrapper for external calls)
    async handleSuccessfulPayment(payment) {
        try {
            await this.handleSuccessfulPaymentWithinTransaction(database_1.prisma, payment);
        }
        catch (error) {
            logger_1.logger.error('Error processing Airtel payment:', error);
        }
    }
}
exports.airtelService = new AirtelService();
exports.default = exports.airtelService;
//# sourceMappingURL=airtel.service.js.map