import api from './api';

export const groupService = {
  async getGroups() {
    const response = await api.get('/groups/');
    return response.data.groups;
  },

  async getGroup(id) {
    const response = await api.get(`/groups/${id}/`);
    return response.data.group;
  },

  async createGroup(groupData) {
    const response = await api.post('/groups/', groupData);
    return response.data.group;
  },

  async updateGroup(id, groupData) {
    const response = await api.put(`/groups/${id}/`, groupData);
    return response.data.group;
  },

  async deleteGroup(id) {
    const response = await api.delete(`/groups/${id}/`);
    return response.data;
  },

  async getMembers(groupId) {
    const response = await api.get(`/groups/${groupId}/members/`);
    return response.data.members;
  },

  async addMember(groupId, identifier, role = 'MEMBER') {
    const response = await api.post(`/groups/${groupId}/members/`, {
      identifier,
      role
    });
    return response.data;
  },

  async removeMember(groupId, userId) {
    const response = await api.delete(`/groups/${groupId}/members/${userId}/`);
    return response.data;
  },

  async joinGroupByCode(inviteCode) {
    const response = await api.post('/groups/join/', { invite_code: inviteCode });
    return response.data;
  }
};

export default groupService;
