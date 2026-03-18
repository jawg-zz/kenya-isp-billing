import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { cache } from '../config/redis';
import { authenticate } from '../middleware/auth';
import config from '../config';
import { AuthenticatedRequest, TokenPayload } from '../types';

const router = Router();

// SSE endpoint for real-time notifications
// Token must be passed via Authorization header (prevents token leakage in logs/history)
router.get('/subscribe', async (req, res) => {
  try {
    // Authenticate via Authorization header only
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided. Use Authorization: Bearer <token>' });
      return;
    }

    let userId: string | null = null;
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], config.jwt.secret) as TokenPayload;
      userId = decoded.id;
    } catch {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Authentication failed' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send heartbeat every 30s
    const heartbeat = setInterval(() => {
      res.write('event: heartbeat\ndata: {}\n\n');
    }, 30000);

    // Poll Redis for new notifications every 5s
    const pollInterval = setInterval(async () => {
      try {
        const newNotification = await cache.get(`newNotification:${userId}`);
        if (newNotification) {
          res.write(`event: notification\ndata: ${JSON.stringify(newNotification)}\n\n`);
          await cache.del(`newNotification:${userId}`);
        }
      } catch {
        // Silently handle cache errors
      }
    }, 5000);

    req.on('close', () => {
      clearInterval(heartbeat);
      clearInterval(pollInterval);
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
