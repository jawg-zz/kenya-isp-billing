import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { mpesaService } from './mpesa.service';
import { radiusService } from './radius.service';
import { logger } from '../config/logger';
import { AppError } from '../types';
import { redactPhone } from '../utils/redact';

interface HotspotPackage {
  id: string;
  name: string;
  price: number;
  speed: number;        // Mbps
  dataAllowance: number; // MB
  durationHours: number;
}

// Available hotspot packages
const PACKAGES: Record<string, HotspotPackage> = {
  hourly: {
    id: 'hourly',
    name: '1 Hour',
    price: 20,
    speed: 2,
    dataAllowance: 500,
    durationHours: 1,
  },
  daily: {
    id: 'daily',
    name: '24 Hours',
    price: 50,
    speed: 3,
    dataAllowance: 2048,
    durationHours: 24,
  },
  weekly: {
    id: 'weekly',
    name: '7 Days',
    price: 250,
    speed: 5,
    dataAllowance: 10240,
    durationHours: 168,
  },
  monthly: {
    id: 'monthly',
    name: '30 Days',
    price: 800,
    speed: 5,
    dataAllowance: 30720,
    durationHours: 720,
  },
};

class HotspotService {
  /**
   * Initiate a hotspot package purchase via M-Pesa STK push
   */
  async initiatePurchase(phone: string, packageId: string, macAddress?: string, clientIp?: string) {
    const pkg = PACKAGES[packageId];
    if (!pkg) {
      throw new AppError('Invalid package selected', 400);
    }

    // Format phone number
    const formattedPhone = this.formatPhone(phone);

    // Generate unique reference for this purchase
    const reference = `HSP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Create pending purchase record
    const purchase = await prisma.hotspotPurchase.create({
      data: {
        reference,
        phone: formattedPhone,
        packageId: pkg.id,
        packageName: pkg.name,
        amount: pkg.price,
        speed: pkg.speed,
        dataAllowance: pkg.dataAllowance,
        durationHours: pkg.durationHours,
        macAddress: macAddress || null,
        clientIp: clientIp || null,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + pkg.durationHours * 60 * 60 * 1000),
      },
    });

    // Initiate M-Pesa STK push
    try {
      const stkResponse = await mpesaService.initiateSTKPush({
        phoneNumber: formattedPhone,
        amount: pkg.price,
        accountReference: reference,
        transactionDesc: `GeorgeISP ${pkg.name} - ${pkg.dataAllowance >= 1024 ? Math.round(pkg.dataAllowance / 1024) + 'GB' : pkg.dataAllowance + 'MB'}`,
      });

      // Update purchase with M-Pesa request IDs
      await prisma.hotspotPurchase.update({
        where: { id: purchase.id },
        data: {
          merchantRequestId: stkResponse.MerchantRequestID,
          checkoutRequestId: stkResponse.CheckoutRequestID,
        },
      });

      logger.info(`Hotspot purchase initiated: ${reference} for ${redactPhone(formattedPhone)}, package: ${pkg.name}`);

      return {
        success: true,
        reference,
        packageName: pkg.name,
        amount: pkg.price,
        message: 'M-Pesa payment request sent to your phone',
      };
    } catch (error) {
      // Mark purchase as failed
      await prisma.hotspotPurchase.update({
        where: { id: purchase.id },
        data: { status: 'FAILED' },
      });

      logger.error('M-Pesa STK push failed:', error);
      throw new AppError('Failed to initiate M-Pesa payment. Try again.', 500);
    }
  }

  /**
   * Process M-Pesa callback for hotspot purchase
   */
  async processPaymentCallback(checkoutRequestId: string, resultCode: number, metadata: any) {
    const purchase = await prisma.hotspotPurchase.findFirst({
      where: { checkoutRequestId },
    });

    if (!purchase) {
      logger.error('Hotspot purchase not found for callback:', checkoutRequestId);
      return;
    }

    if (resultCode !== 0) {
      // Payment failed
      await prisma.hotspotPurchase.update({
        where: { id: purchase.id },
        data: { status: 'FAILED' },
      });
      logger.info(`Hotspot payment failed: ${purchase.reference}, code: ${resultCode}`);
      return;
    }

    // Extract M-Pesa receipt number from metadata
    let mpesaReceipt = '';
    if (metadata?.CallbackMetadata?.Item) {
      const receiptItem = metadata.CallbackMetadata.Item.find(
        (item: any) => item.Name === 'MpesaReceiptNumber'
      );
      mpesaReceipt = receiptItem?.Value || '';
    }

    // Payment successful — generate RADIUS credentials
    const username = `hs_${crypto.randomBytes(4).toString('hex')}`;
    const password = crypto.randomBytes(6).toString('hex');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Calculate expiry
    const expiresAt = new Date(Date.now() + purchase.durationHours * 60 * 60 * 1000);

    // Create RADIUS config for this user
    const radiusConfig = await prisma.radiusConfig.create({
      data: {
        customerId: null, // Hotspot users don't have a customer account
        username,
        password: hashedPassword,
        isActive: true,
      },
    });

    // Sync to FreeRADIUS radcheck table
    await this.syncToRadius(username, password);

    // Update purchase with credentials
    await prisma.hotspotPurchase.update({
      where: { id: purchase.id },
      data: {
        status: 'PAID',
        mpesaReceipt,
        radiusUsername: username,
        radiusPassword: password, // Stored temporarily for display, can be removed later
        paidAt: new Date(),
      },
    });

    logger.info(`Hotspot purchase completed: ${purchase.reference}, user: ${username}`);
  }

  /**
   * Get purchase status (for polling from frontend)
   */
  async getPurchaseStatus(reference: string) {
    const purchase = await prisma.hotspotPurchase.findUnique({
      where: { reference },
    });

    if (!purchase) {
      throw new AppError('Purchase not found', 404);
    }

    const response: any = {
      status: purchase.status.toLowerCase(),
      reference: purchase.reference,
    };

    if (purchase.status === 'PAID') {
      response.username = purchase.radiusUsername;
      response.password = purchase.radiusPassword;
      response.packageName = purchase.packageName;
      response.expiresAt = purchase.expiresAt?.toISOString();
      response.dataAllowance = purchase.dataAllowance;
      response.speed = purchase.speed;
    }

    return response;
  }

  /**
   * Sync username/password to FreeRADIUS radcheck table
   */
  private async syncToRadius(username: string, password: string) {
    try {
      // This uses the same database as FreeRADIUS
      await prisma.$executeRaw`
        DELETE FROM radcheck WHERE username = ${username}
      `;
      await prisma.$executeRaw`
        INSERT INTO radcheck (username, attribute, op, value)
        VALUES (${username}, 'User-Password', ':=', ${password})
      `;
      await prisma.$executeRaw`
        INSERT INTO radcheck (username, attribute, op, value)
        VALUES (${username}, 'Auth-Type', ':=', 'PAP')
      `;
      logger.info(`Radius user ${username} synced to radcheck`);
    } catch (error) {
      logger.error('Failed to sync radius user:', error);
      throw error;
    }
  }

  /**
   * Get all available packages
   */
  getPackages() {
    return Object.values(PACKAGES).map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      speed: `${pkg.speed} Mbps`,
      data: pkg.dataAllowance >= 1024
        ? `${Math.round(pkg.dataAllowance / 1024)} GB`
        : `${pkg.dataAllowance} MB`,
      duration: pkg.durationHours >= 24
        ? `${pkg.durationHours / 24} days`
        : `${pkg.durationHours} hour${pkg.durationHours > 1 ? 's' : ''}`,
    }));
  }

  private formatPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('254')) return cleaned;
    if (cleaned.startsWith('0')) return `254${cleaned.substring(1)}`;
    if (cleaned.startsWith('7') || cleaned.startsWith('1')) return `254${cleaned}`;
    return cleaned;
  }
}

export const hotspotService = new HotspotService();
export default hotspotService;
