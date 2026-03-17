'use client';

import { useNotificationSSE } from '@/lib/hooks/useNotificationSSE';

/**
 * App-wide SSE notification listener.
 * Listens for real-time notifications and shows toasts.
 */
export function NotificationListener() {
  useNotificationSSE();
  return null;
}
