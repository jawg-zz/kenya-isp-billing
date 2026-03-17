import { prisma } from '../config/database';
import { cache } from '../config/redis';

interface NotificationData {
  userId: string;
  type: string;
  title: string;
  message: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification in the database and push to Redis for SSE delivery.
 */
export async function createNotification(data: NotificationData): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      channel: data.channel || 'in_app',
      metadata: data.metadata || undefined,
    },
  });

  // Push to Redis for real-time SSE delivery (expires after 30s)
  await cache.set(`newNotification:${data.userId}`, notification, 30);
}

export default createNotification;
