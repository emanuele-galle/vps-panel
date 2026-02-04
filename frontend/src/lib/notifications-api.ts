import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/notifications`,
  withCredentials: true,
});

export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    api.get('/', { params }),

  getUnreadCount: () =>
    api.get('/unread-count'),

  markAsRead: (id: string) =>
    api.patch(`/${id}/read`),

  markAllAsRead: () =>
    api.patch('/read-all'),

  delete: (id: string) =>
    api.delete(`/${id}`),

  clearAll: () =>
    api.delete('/clear'),
};
