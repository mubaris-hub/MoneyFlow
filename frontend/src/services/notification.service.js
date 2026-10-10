import api from './api';

const notificationService = {
  /**
   * Fetch current user's notifications.
   * @param {Object} params - Query params (e.g. { unread: true })
   */
  listNotifications: async (params = {}) => {
    const response = await api.get('/notifications/', { params });
    return response.data;
  },

  /**
   * Mark a notification as read by ID.
   * @param {string} id - Notification UUID
   */
  markAsRead: async (id) => {
    const response = await api.post(`/notifications/${id}/read/`);
    return response.data;
  },

  /**
   * Mark all unread notifications for the user as read.
   */
  markAllAsRead: async () => {
    const response = await api.post('/notifications/read-all/');
    return response.data;
  },
};

export default notificationService;
