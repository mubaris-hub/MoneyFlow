import api from './api';

export const settlementService = {
  async getGroupBalances(groupId) {
    const response = await api.get(`/groups/${groupId}/balances/`);
    return response.data;
  },

  async getGroupBalancesSummary(groupId) {
    const response = await api.get(`/groups/${groupId}/balances/summary/`);
    return response.data;
  },

  async getGroupSettlements(groupId, params = {}) {
    const response = await api.get(`/groups/${groupId}/settlements/`, { params });
    return response.data.settlements;
  },

  async createSettlement(groupId, settlementData) {
    const response = await api.post(`/groups/${groupId}/settlements/`, settlementData);
    return response.data.settlement;
  },

  async updateSettlementStatus(id, statusData) {
    const response = await api.put(`/expenses/settlements/${id}/`, statusData);
    return response.data.settlement;
  },

  async cancelSettlement(id) {
    const response = await api.delete(`/expenses/settlements/${id}/`);
    return response.data;
  }
};

export default settlementService;
