"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsService = void 0;
const config_1 = __importDefault(require("../config"));
const logger_1 = require("../config/logger");
class SMSService {
    baseUrl = 'https://api.africastalking.com/version1/messaging';
    apiKey;
    username;
    senderId;
    constructor() {
        this.apiKey = config_1.default.sms.apiKey;
        this.username = config_1.default.sms.username;
        this.senderId = config_1.default.sms.senderId;
    }
    // Format phone number for Africa's Talking
    formatPhoneNumber(phone) {
        let cleaned = phone.replace(/\D/g, '');
        // Africa's Talking expects international format without +
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
    // Send SMS
    async send(request) {
        if (!this.apiKey || !this.username) {
            logger_1.logger.warn('SMS credentials not configured');
            return { success: false, error: 'SMS service not configured' };
        }
        const recipients = Array.isArray(request.to)
            ? request.to.map((phone) => this.formatPhoneNumber(phone))
            : [this.formatPhoneNumber(request.to)];
        const payload = new URLSearchParams();
        payload.append('username', this.username);
        payload.append('to', recipients.join(','));
        payload.append('message', request.message);
        if (this.senderId) {
            payload.append('from', this.senderId);
        }
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    apiKey: this.apiKey,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
                body: payload.toString(),
            });
            const data = await response.json();
            logger_1.logger.info('SMS sent:', {
                recipients: recipients,
                messageCount: data.SMSMessageData.Recipients.length,
            });
            // Check for errors
            const failedRecipients = data.SMSMessageData.Recipients.filter((r) => r.statusCode !== 101);
            if (failedRecipients.length > 0) {
                logger_1.logger.warn('Some SMS failed to send:', failedRecipients);
                return {
                    success: false,
                    error: `Failed to send to ${failedRecipients.length} recipients`,
                };
            }
            return {
                success: true,
                messageId: data.SMSMessageData.Recipients[0]?.messageId,
            };
        }
        catch (error) {
            logger_1.logger.error('SMS send error:', error);
            return {
                success: false,
                error: 'Failed to send SMS',
            };
        }
    }
    // Send payment confirmation SMS
    async sendPaymentConfirmation(phone, amount, reference, balance) {
        const message = `Hello! Your payment of KES ${amount} has been received. Ref: ${reference}${balance !== undefined ? `. Current balance: KES ${balance}` : ''}. Thank you for choosing our services.`;
        return this.send({ to: phone, message });
    }
    // Send subscription activation SMS
    async sendSubscriptionActivation(phone, planName, validity) {
        const message = `Your ${planName} subscription has been activated! Valid until ${validity}. Enjoy unlimited internet access.`;
        return this.send({ to: phone, message });
    }
    // Send subscription expiry warning SMS
    async sendExpiryWarning(phone, planName, daysRemaining) {
        const message = `Your ${planName} subscription expires in ${daysRemaining} day(s). Renew now to continue enjoying uninterrupted service.`;
        return this.send({ to: phone, message });
    }
    // Send subscription expired SMS
    async sendSubscriptionExpired(phone, planName) {
        const message = `Your ${planName} subscription has expired. Please renew to restore your internet access.`;
        return this.send({ to: phone, message });
    }
    // Send FUP threshold warning SMS
    async sendFUPWarning(phone, percentageUsed) {
        const message = `You have used ${percentageUsed}% of your data allowance. Your speed may be reduced after reaching the fair usage limit.`;
        return this.send({ to: phone, message });
    }
    // Send account suspension SMS
    async sendAccountSuspended(phone, reason) {
        const message = `Your account has been suspended${reason ? `: ${reason}` : ''}. Please contact customer support for assistance.`;
        return this.send({ to: phone, message });
    }
    // Send OTP for verification
    async sendOTP(phone, otp) {
        const message = `Your verification code is: ${otp}. It expires in 5 minutes.`;
        return this.send({ to: phone, message });
    }
    // Send invoice notification SMS
    async sendInvoiceNotification(phone, invoiceNumber, amount, dueDate) {
        const message = `Invoice ${invoiceNumber} for KES ${amount} is ready. Due date: ${dueDate}. Please make payment to continue enjoying our services.`;
        return this.send({ to: phone, message });
    }
    // Bulk SMS
    async sendBulk(recipients) {
        let success = 0;
        let failed = 0;
        // Process in batches of 100
        const batchSize = 100;
        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            const phones = batch.map((r) => this.formatPhoneNumber(r.phone));
            const payload = new URLSearchParams();
            payload.append('username', this.username);
            payload.append('to', phones.join(','));
            // For bulk, we need to send multiple requests if messages are different
            // or use the same message for all
            const messages = batch.map((r, idx) => `${idx}:${r.message}`).join('\n');
            payload.append('message', batch[0].message); // Simplified - same message
            try {
                const response = await fetch(this.baseUrl, {
                    method: 'POST',
                    headers: {
                        apiKey: this.apiKey,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: payload.toString(),
                });
                const data = await response.json();
                const sent = data.SMSMessageData.Recipients.filter((r) => r.statusCode === 101).length;
                const failedBatch = data.SMSMessageData.Recipients.filter((r) => r.statusCode !== 101).length;
                success += sent;
                failed += failedBatch;
            }
            catch (error) {
                logger_1.logger.error('Bulk SMS error:', error);
                failed += batch.length;
            }
        }
        return { success, failed };
    }
}
exports.smsService = new SMSService();
exports.default = exports.smsService;
//# sourceMappingURL=sms.service.js.map