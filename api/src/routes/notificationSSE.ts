import { Router } from 'express';
import { cache } from '../config/redis';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

// SSE endpoint for real-time notifications
router.get('/subscribe', authenticate, async (req: AuthenticatedRequest, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const userId = req.user!.id;

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
});

export default router;
