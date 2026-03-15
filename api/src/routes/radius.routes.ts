import { Router, Request, Response, NextFunction } from 'express';
import { radiusService } from '../services/radius.service';
import config from '../config';
import { logger } from '../config/logger';

const router = Router();

// RADIUS authentication endpoint
router.post('/auth', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password, nasIpAddress, nasPortId, nasPortType } = req.body;

    // Simple shared secret validation
    const sharedSecret = req.headers['x-radius-secret'];
    if (sharedSecret !== config.radius.secret) {
      logger.warn('RADIUS auth: Invalid shared secret');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await radiusService.handleAccessRequest({
      username,
      password,
      nasIpAddress,
      nasPortId,
      nasPortType,
    });

    res.json(result);
  } catch (error) {
    logger.error('RADIUS auth error:', error);
    res.status(200).json({ accept: false });
  }
});

// RADIUS accounting endpoint
router.post('/accounting', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sharedSecret = req.headers['x-radius-secret'];
    if (sharedSecret !== config.radius.secret) {
      logger.warn('RADIUS accounting: Invalid shared secret');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      sessionId,
      username,
      nasIpAddress,
      nasPortId,
      framedIpAddress,
      inputOctets,
      outputOctets,
      inputPackets,
      outputPackets,
      sessionTime,
      terminateCause,
    } = req.body;

    await radiusService.handleAccountingRequest({
      sessionId,
      username,
      nasIpAddress,
      nasPortId,
      framedIpAddress,
      inputOctets: inputOctets || 0,
      outputOctets: outputOctets || 0,
      inputPackets: inputPackets || 0,
      outputPackets: outputPackets || 0,
      sessionTime: sessionTime || 0,
      terminateCause,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('RADIUS accounting error:', error);
    res.json({ success: true });
  }
});

// RADIUS CoA (Change of Authorization) endpoint
router.post('/coa', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sharedSecret = req.headers['x-radius-secret'];
    if (sharedSecret !== config.radius.secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { username, attributes } = req.body;

    // In production, this would send a CoA request to the NAS
    logger.info(`CoA request for ${username}:`, attributes);

    res.json({ success: true });
  } catch (error) {
    logger.error('RADIUS CoA error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
