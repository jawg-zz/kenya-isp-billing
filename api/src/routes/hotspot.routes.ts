import { Router, Request, Response } from 'express';
import { hotspotService } from '../services/hotspot.service';
import { logger } from '../config/logger';
import { AppError } from '../types';

const router = Router();

// GET /api/v1/hotspot/packages — list available packages
router.get('/packages', (req: Request, res: Response) => {
  try {
    const packages = hotspotService.getPackages();
    res.json({ success: true, data: packages });
  } catch (error) {
    logger.error('Get packages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch packages' });
  }
});

// POST /api/v1/hotspot/purchase — initiate purchase (STK push)
router.post('/purchase', async (req: Request, res: Response) => {
  try {
    const { phone, packageId, macAddress, clientIp } = req.body;

    if (!phone || !packageId) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and package are required',
      });
    }

    // Validate Kenyan phone number
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid phone number',
      });
    }

    const result = await hotspotService.initiatePurchase(phone, packageId, macAddress, clientIp);
    res.json(result);
  } catch (error: any) {
    logger.error('Hotspot purchase error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Purchase failed',
    });
  }
});

// GET /api/v1/hotspot/status/:reference — poll purchase status
router.get('/status/:reference', async (req: Request, res: Response) => {
  try {
    const reference = req.params.reference as string;
    const status = await hotspotService.getPurchaseStatus(reference);
    res.json(status);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Status check failed',
    });
  }
});

// POST /api/v1/hotspot/callback — M-Pesa callback for hotspot payments
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const callback = req.body;

    if (callback?.Body?.stkCallback) {
      const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback.Body.stkCallback;

      logger.info(`M-Pesa callback: ${CheckoutRequestID}, result: ${ResultCode}`);

      // Process asynchronously — don't block M-Pesa
      hotspotService.processPaymentCallback(CheckoutRequestID, ResultCode, CallbackMetadata)
        .catch(err => logger.error('Callback processing error:', err));

      // Respond to M-Pesa immediately
      res.json({ ResultCode: 0, ResultDesc: 'Success' });
    } else {
      res.json({ ResultCode: 0, ResultDesc: 'Success' });
    }
  } catch (error) {
    logger.error('M-Pesa callback error:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  }
});

export default router;
