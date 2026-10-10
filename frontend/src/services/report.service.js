import api from './api';

export const reportService = {
  getDashboardReport: async (params = {}) => {
    const response = await api.get('/reports/dashboard/', { params });
    return response.data;
  },

  getExpenseReport: async (params = {}) => {
    const response = await api.get('/reports/expenses/', { params });
    return response.data;
  },

  getGroupReport: async (groupId, params = {}) => {
    const response = await api.get(`/reports/groups/${groupId}/`, { params });
    return response.data;
  },

  getMoneyAccountReport: async (params = {}) => {
    const response = await api.get('/reports/money-accounts/', { params });
    return response.data;
  },
};

export default reportService;

