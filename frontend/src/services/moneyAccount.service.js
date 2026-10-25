import api, { resolveApiUrl } from './api';

export const moneyAccountService = {
  // Account CRUD & details
  listAccounts: async () => {
    const response = await api.get('/money-accounts/');
    return response.data;
  },

  getAccount: async (id) => {
    const response = await api.get(`/money-accounts/${id}/`);
    return response.data;
  },

  createAccount: async (data) => {
    const response = await api.post('/money-accounts/', data);
    return response.data;
  },

  updateAccount: async (id, data) => {
    const response = await api.patch(`/money-accounts/${id}/`, data);
    return response.data;
  },

  deleteAccount: async (id) => {
    const response = await api.delete(`/money-accounts/${id}/`);
    return response.data;
  },

  // Transactions
  listTransactions: async (accountId, params = {}) => {
    const response = await api.get(`/money-accounts/${accountId}/transactions/`, { params });
    return response.data;
  },

  createTransaction: async (accountId, data) => {
    let payload = data;
    let headers = {};

    if (data.receipt_image instanceof File) {
      const formData = new FormData();
      Object.keys(data).forEach((key) => {
        if (data[key] !== undefined && data[key] !== null) {
          formData.append(key, data[key]);
        }
      });
      payload = formData;
      headers = { 'Content-Type': 'multipart/form-data' };
    }

    const response = await api.post(`/money-accounts/${accountId}/transactions/`, payload, { headers });
    return response.data;
  },

  voidTransaction: async (accountId, txId, data) => {
    const response = await api.post(`/money-accounts/${accountId}/transactions/${txId}/void/`, data);
    return response.data;
  },

  // Receipts
  getReceiptBlob: async (accountId, txId) => {
    const response = await api.get(`/money-accounts/${accountId}/transactions/${txId}/receipt/`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getReceiptDirectUrl: (accountId, txId) => {
    const token = localStorage.getItem('access_token');
    const directPath = `/money-accounts/${accountId}/transactions/${txId}/receipt/`;
    const resolved = resolveApiUrl(directPath);
    return token ? `${resolved}?token=${encodeURIComponent(token)}` : resolved;
  },

  replaceReceipt: async (accountId, txId, file) => {
    const formData = new FormData();
    formData.append('receipt_image', file);
    const response = await api.post(`/money-accounts/${accountId}/transactions/${txId}/receipt/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  removeReceipt: async (accountId, txId) => {
    const response = await api.delete(`/money-accounts/${accountId}/transactions/${txId}/receipt/`);
    return response.data;
  },

  // Invitation & Lifecycle
  inviteOwner: async (accountId, data = {}) => {
    const response = await api.post(`/money-accounts/${accountId}/invite/`, data);
    return response.data;
  },

  getInvitationDetails: async (token) => {
    const response = await api.get(`/money-accounts/invitations/${token}/`);
    return response.data;
  },

  getPendingInvitation: async (accountId) => {
    const response = await api.get(`/money-accounts/${accountId}/invitation/`);
    return response.data;
  },

  respondInvitation: async (token, data) => {
    const response = await api.post(`/money-accounts/invitations/${token}/respond/`, data);
    return response.data;
  },

  closeAccount: async (accountId) => {
    const response = await api.post(`/money-accounts/${accountId}/close/`);
    return response.data;
  },

  exportLedger: async (accountId, params = {}) => {
    const response = await api.get(`/money-accounts/${accountId}/export/`, {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `money_account_${accountId}_export.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default moneyAccountService;
