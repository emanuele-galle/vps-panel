'use client';

import { create } from 'zustand';
import { notificationsApi } from '@/lib/notifications-api';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  priority?: string;
  source?: string;
  sourceId?: string;
  readAt?: string | null;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  addFromWebSocket: (notification: Notification) => void;
  setUnreadCount: (count: number) => void;
}

function normalizeType(type: string): NotificationType {
  const lower = type.toLowerCase();
  if (lower === 'info' || lower === 'success' || lower === 'warning' || lower === 'error') {
    return lower;
  }
  return 'info';
}

function normalizeNotification(n: any): Notification {
  return {
    ...n,
    type: normalizeType(n.type),
  };
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const res = await notificationsApi.getAll({ limit: 50 });
      const items = (res.data?.data?.notifications || []).map(normalizeNotification);
      set({
        notifications: items,
        unreadCount: items.filter((n: Notification) => !n.read).length,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await notificationsApi.getUnreadCount();
      set({ unreadCount: res.data?.data?.count || 0 });
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  },

  markAsRead: async (id: string) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - (state.notifications.find((n) => n.id === id && !n.read) ? 1 : 0)),
    }));
    try {
      await notificationsApi.markAsRead(id);
    } catch (err) {
      console.error('Failed to mark as read:', err);
      // Revert on error
      get().fetchNotifications();
    }
  },

  markAllAsRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })),
      unreadCount: 0,
    }));
    try {
      await notificationsApi.markAllAsRead();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      get().fetchNotifications();
    }
  },

  removeNotification: async (id: string) => {
    const removed = get().notifications.find((n) => n.id === id);
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: Math.max(0, state.unreadCount - (removed && !removed.read ? 1 : 0)),
    }));
    try {
      await notificationsApi.delete(id);
    } catch (err) {
      console.error('Failed to delete notification:', err);
      get().fetchNotifications();
    }
  },

  clearAll: async () => {
    set({ notifications: [], unreadCount: 0 });
    try {
      await notificationsApi.clearAll();
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
      get().fetchNotifications();
    }
  },

  addFromWebSocket: (notification: Notification) => {
    const normalized = normalizeNotification(notification);
    set((state) => {
      const exists = state.notifications.some((n) => n.id === normalized.id);
      if (exists) return state;
      const notifications = [normalized, ...state.notifications].slice(0, 50);
      return {
        notifications,
        unreadCount: state.unreadCount + (normalized.read ? 0 : 1),
      };
    });
  },

  setUnreadCount: (count: number) => {
    set({ unreadCount: count });
  },
}));
