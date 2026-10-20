import api from './api';

export const personalExpenseService = {
  async getCategories(params = {}) {
    const response = await api.get('/personal/categories/', { params });
    return response.data;
  },

  async createCategory(data) {
    const response = await api.post('/personal/categories/', data);
    return response.data;
  },

  async getTransactions(params = {}) {
    const response = await api.get('/personal/transactions/', { params });
    return response.data;
  },

  async getTransaction(id) {
    const response = await api.get(`/personal/transactions/${id}/`);
    return response.data;
  },

  async createTransaction(data) {
    const response = await api.post('/personal/transactions/', data);
    return response.data;
  },

  async updateTransaction(id, data) {
    const response = await api.patch(`/personal/transactions/${id}/`, data);
    return response.data;
  },

  async deleteTransaction(id) {
    const response = await api.delete(`/personal/transactions/${id}/`);
    return response.data;
  },

  async getSummary(params = {}) {
    const response = await api.get('/personal/summary/', { params });
    return response.data;
  },

  async getAnalytics(params = {}) {
    const response = await api.get('/personal/analytics/', { params });
    return response.data;
  },

  async getBudgets(params = {}) {
    const response = await api.get('/personal/budgets/', { params });
    return response.data;
  },

  async saveBudget(data) {
    const response = await api.post('/personal/budgets/', data);
    return response.data;
  },

  async deleteBudget(id) {
    const response = await api.delete(`/personal/budgets/${id}/`);
    return response.data;
  },
};

export default personalExpenseService;

