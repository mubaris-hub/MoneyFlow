import api from './api';

export const transactionService = {
  /**
   * Fetches paginated unified transactions across groups, expenses, transfers, settlements, and ledgers.
   */
  async getTransactions(params = {}) {
    const response = await api.get('/transactions/', { params });
    return response.data;
  },

  /**
   * Fetches full detail for a single transaction by ID.
   */
  async getTransactionDetail(transactionId) {
    const response = await api.get(`/transactions/${transactionId}/`);
    return response.data.transaction;
  }
};

export default transactionService;
