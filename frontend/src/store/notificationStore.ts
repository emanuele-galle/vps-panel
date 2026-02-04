'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    href: string;
  };
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: crypto.randomUUID(),
          timestamp: new Date(),
          read: false,
        };

        set((state) => {
          // Keep only last 50 notifications
          const notifications = [newNotification, ...state.notifications].slice(0, 50);
          const unreadCount = notifications.filter((n) => !n.read).length;
          return { notifications, unreadCount };
        });
      },

      markAsRead: (id) => {
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          const unreadCount = notifications.filter((n) => !n.read).length;
          return { notifications, unreadCount };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      removeNotification: (id) => {
        set((state) => {
          const notifications = state.notifications.filter((n) => n.id !== id);
          const unreadCount = notifications.filter((n) => !n.read).length;
          return { notifications, unreadCount };
        });
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },
    }),
    {
      name: 'vps-notifications',
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 20), // Persist only last 20
      }),
    }
  )
);

// Helper function to add notifications from anywhere
export const notify = {
  info: (title: string, message: string, action?: Notification['action']) => {
    useNotificationStore.getState().addNotification({ type: 'info', title, message, action });
  },
  success: (title: string, message: string, action?: Notification['action']) => {
    useNotificationStore.getState().addNotification({ type: 'success', title, message, action });
  },
  warning: (title: string, message: string, action?: Notification['action']) => {
    useNotificationStore.getState().addNotification({ type: 'warning', title, message, action });
  },
  error: (title: string, message: string, action?: Notification['action']) => {
    useNotificationStore.getState().addNotification({ type: 'error', title, message, action });
  },
};
