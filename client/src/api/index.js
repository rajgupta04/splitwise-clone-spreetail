import client from './client';

export const authApi = {
  register: (data) => client.post('/auth/register', data),
  login: (data) => client.post('/auth/login', data),
  getProfile: () => client.get('/auth/me'),
};

export const groupsApi = {
  create: (data) => client.post('/groups', data),
  list: () => client.get('/groups'),
  getById: (id) => client.get(`/groups/${id}`),
  update: (id, data) => client.put(`/groups/${id}`, data),
  archive: (id) => client.delete(`/groups/${id}`),
};

export const membershipsApi = {
  addMember: (groupId, email) => client.post(`/groups/${groupId}/members`, { email }),
  removeMember: (groupId, userId) => client.delete(`/groups/${groupId}/members/${userId}`),
  getActiveMembers: (groupId) => client.get(`/groups/${groupId}/members`),
  getMembershipHistory: (groupId) => client.get(`/groups/${groupId}/members/history`),
};

export const expensesApi = {
  create: (groupId, data) => client.post(`/groups/${groupId}/expenses`, data),
  list: (groupId, params) => client.get(`/groups/${groupId}/expenses`, { params }),
  getById: (id) => client.get(`/expenses/${id}`),
  update: (id, data) => client.put(`/expenses/${id}`, data),
  remove: (id) => client.delete(`/expenses/${id}`),
};

export const balancesApi = {
  getGroupBalances: (groupId) => client.get(`/groups/${groupId}/balances`),
  getUserSummary: () => client.get('/balances/me'),
};

export const settlementsApi = {
  create: (groupId, data) => client.post(`/groups/${groupId}/settlements`, data),
  list: (groupId) => client.get(`/groups/${groupId}/settlements`),
};

export const importsApi = {
  upload: (groupId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post(`/groups/${groupId}/imports`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: (groupId) => client.get(`/groups/${groupId}/imports`),
  getById: (id) => client.get(`/imports/${id}`),
  getItems: (id, params) => client.get(`/imports/${id}/items`, { params }),
  decideItem: (importId, itemId, data) =>
    client.post(`/imports/${importId}/items/${itemId}/decide`, data),
  finalize: (id) => client.post(`/imports/${id}/finalize`),
  getReport: (id) => client.get(`/imports/${id}/report`),
  getDecisions: (id) => client.get(`/imports/${id}/decisions`),
};
