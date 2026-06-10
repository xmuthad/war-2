import React, { useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';

export type NotificationType = 'info' | 'warning' | 'danger' | 'success' | 'special';

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  danger: '🔴',
  success: '✅',
  special: '💜',
};

const AUTO_DISMISS_MS = 5000;

export const GameNotificationSystem: React.FC = () => {
  const notifications = useGameStore(s => s.notifications);
  const removeNotification = useGameStore(s => s.removeNotification);

  const handleDismiss = useCallback((id: string) => {
    removeNotification(id);
  }, [removeNotification]);

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (notifications.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = Date.now();
    for (const n of notifications) {
      const elapsed = now - n.timestamp;
      const remaining = AUTO_DISMISS_MS - elapsed;
      if (remaining > 0) {
        timers.push(setTimeout(() => {
          removeNotification(n.id);
        }, remaining));
      }
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [notifications, removeNotification]);

  if (notifications.length === 0) return null;

  return (
    <div className="game-notification-container">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`game-notification game-notification-${notification.type}`}
        >
          <span className="game-notification-icon">
            {NOTIFICATION_ICONS[notification.type as NotificationType] || 'ℹ️'}
          </span>
          <span className="game-notification-message">{notification.message}</span>
          <button
            className="game-notification-close"
            onClick={() => handleDismiss(notification.id)}
            aria-label="关闭通知"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
