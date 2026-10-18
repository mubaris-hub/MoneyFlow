import api from './api';

export const authService = {
  async register(userData) {
    const response = await api.post('/auth/register/', userData);
    if (response.data.tokens) {
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  async login(credentials) {
    const response = await api.post('/auth/login/', credentials);
    if (response.data.tokens) {
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me/');
    if (response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data.user;
  },

  async refreshToken(refreshToken) {
    const response = await api.post('/auth/token/refresh/', { refresh: refreshToken });
    if (response.data.access) {
      localStorage.setItem('access_token', response.data.access);
    }
    if (response.data.refresh) {
      localStorage.setItem('refresh_token', response.data.refresh);
    }
    return response.data;
  },

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },

  getStoredUser() {
    const userStr = localStorage.getItem('user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },

  async requestPasswordReset(email) {
    const response = await api.post('/auth/password-reset/', { email });
    return response.data;
  },

  async confirmPasswordReset(data) {
    const response = await api.post('/auth/password-reset-confirm/', data);
    return response.data;
  },

  async updateProfile(profileData) {
    const response = await api.patch('/auth/me/', profileData);
    if (response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  async changePassword(passwordData) {
    const response = await api.post('/auth/change-password/', passwordData);
    return response.data;
  },

  async deactivateAccount(confirmationData) {
    const response = await api.post('/auth/deactivate/', confirmationData);
    return response.data;
  }
};

export default authService;
