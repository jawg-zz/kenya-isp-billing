'use client';

import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Hook to connect to the SSE notification stream.
 * Receives real-time notifications and shows toast + optional callback.
 */
export function useNotificationSSE(
  onNotification?: (notification: Record<string, unknown>) => void
) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    const tokens = (() => {
      try {
        const raw = localStorage.getItem('isp_tokens');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    if (!tokens?.accessToken) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_BASE_URL}/api/v1/notifications/stream/subscribe`;
    // EventSource doesn't support custom headers, so pass token as query param
    const es = new EventSource(`${url}?token=${encodeURIComponent(tokens.accessToken)}`);

    es.addEventListener('notification', (event) => {
      try {
        const notification = JSON.parse(event.data);
        toast(notification.title || 'Notification', {
          description: notification.message,
        });
        onNotification?.(notification);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('heartbeat', () => {
      // keep-alive, no action needed
    });

    es.onerror = () => {
      es.close();
      // Reconnect after 10 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 10000);
    };

    eventSourceRef.current = es;
  }, [onNotification]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);
}
