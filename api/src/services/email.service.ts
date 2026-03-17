import nodemailer from 'nodemailer';
import config from '../config';
import { logger } from '../config/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private from: string;

  constructor() {
    this.from = config.email.from;

    if (config.email.host && config.email.port) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: config.email.user && config.email.pass
          ? { user: config.email.user, pass: config.email.pass }
          : undefined,
      });

      // Verify connection on startup (non-blocking)
      this.transporter.verify()
        .then(() => logger.info('Email service connected'))
        .catch((err) => logger.warn('Email service not available:', err.message));
    } else {
      logger.warn('Email service not configured — emails will be logged only');
    }
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    const { to, subject, html, text } = options;

    if (!this.transporter) {
      logger.info(`[EMAIL STUB] To: ${Array.isArray(to) ? to.join(', ') : to} | Subject: ${subject}`);
      return { success: true };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: text || subject,
      });

      logger.info(`Email sent: ${subject} → ${Array.isArray(to) ? to[0] : to}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Email send error:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // Send verification email
  async sendVerificationEmail(email: string, token: string, userName: string): Promise<EmailResult> {
    const verifyUrl = `${config.frontendUrl}/verify-email?token=${token}`;
    return this.send({
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>Hello ${userName},</p>
          <p>Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Verify Email
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 14px;">${verifyUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">This link expires in 24 hours.</p>
        </div>
      `,
    });
  }

  // Send password reset email
  async sendPasswordResetEmail(email: string, token: string, userName: string): Promise<EmailResult> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
    return this.send({
      to: email,
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>Hello ${userName},</p>
          <p>We received a request to reset your password. Click the button below to set a new one:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 14px;">${resetUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
  }

  // Send invoice email
  async sendInvoiceEmail(
    email: string,
    userName: string,
    invoiceNumber: string,
    amount: number,
    dueDate: string,
    invoiceId: string
  ): Promise<EmailResult> {
    const invoiceUrl = `${config.frontendUrl}/invoices/${invoiceId}`;
    return this.send({
      to: email,
      subject: `Invoice ${invoiceNumber} — KES ${amount.toLocaleString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Invoice</h2>
          <p>Hello ${userName},</p>
          <p>A new invoice has been generated for your account.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Invoice:</strong> ${invoiceNumber}</p>
            <p><strong>Amount:</strong> KES ${amount.toLocaleString()}</p>
            <p><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invoiceUrl}" style="background: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; display: inline-block;">
              View Invoice
            </a>
          </div>
        </div>
      `,
    });
  }

  // Send payment receipt email
  async sendPaymentReceiptEmail(
    email: string,
    userName: string,
    amount: number,
    paymentMethod: string,
    reference: string
  ): Promise<EmailResult> {
    return this.send({
      to: email,
      subject: `Payment Received — KES ${amount.toLocaleString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Received</h2>
          <p>Hello ${userName},</p>
          <p>We've received your payment. Thank you!</p>
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0;">
            <p><strong>Amount:</strong> KES ${amount.toLocaleString()}</p>
            <p><strong>Method:</strong> ${paymentMethod}</p>
            <p><strong>Reference:</strong> ${reference}</p>
          </div>
          <p style="color: #666; font-size: 14px;">Your account balance has been updated.</p>
        </div>
      `,
    });
  }
}

export const emailService = new EmailService();
export default emailService;
