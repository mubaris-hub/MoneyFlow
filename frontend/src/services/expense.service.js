import api from './api';

export const expenseService = {
  async getCategories() {
    const response = await api.get('/expenses/categories/');
    return response.data.categories;
  },

  async getExpenses(params = {}) {
    const response = await api.get('/expenses/', { params });
    return response.data.expenses;
  },

  async getExpense(id) {
    const response = await api.get(`/expenses/${id}/`);
    return response.data.expense;
  },

  async createExpense(expenseData) {
    const response = await api.post('/expenses/', expenseData);
    return response.data.expense;
  },

  async updateExpense(id, expenseData) {
    const response = await api.put(`/expenses/${id}/`, expenseData);
    return response.data.expense;
  },

  async deleteExpense(id) {
    const response = await api.delete(`/expenses/${id}/`);
    return response.data;
  },

  async getDirectPayments(params = {}) {
    const response = await api.get('/expenses/direct-payments/', { params });
    return response.data.direct_payments;
  },

  async createDirectPayment(paymentData) {
    const response = await api.post('/expenses/direct-payments/', paymentData);
    return response.data.direct_payment;
  }
};

export default expenseService;
