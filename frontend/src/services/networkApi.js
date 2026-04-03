// frontend/src/services/networkApi.js
// All /api/network calls

import { getToken } from './api';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res  = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const networkAPI = {
  // Orgs
  registerOrg:     (body)  => apiFetch('/network/orgs', { method: 'POST', body: JSON.stringify(body) }),
  getAllOrgs:       (type)  => apiFetch(`/network/orgs${type ? `?type=${type}` : ''}`),
  getOrg:          (orgId) => apiFetch(`/network/orgs/${orgId}`),
  approveOrg:      (orgId, threshold) => apiFetch(`/network/orgs/${orgId}/approve`, { method: 'POST', body: JSON.stringify({ threshold }) }),
  updateOrgStatus: (orgId, status)    => apiFetch(`/network/orgs/${orgId}/status`,  { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Share requests
  createShareRequest:  (body)      => apiFetch('/network/share-requests', { method: 'POST', body: JSON.stringify(body) }),
  getPendingRequests:  ()          => apiFetch('/network/share-requests/pending'),
  getEHRShareRequests: (ehrId)     => apiFetch(`/network/share-requests/ehr/${ehrId}`),
  approveShareRequest: (requestId) => apiFetch(`/network/share-requests/${requestId}/approve`, { method: 'POST' }),
  rejectShareRequest:  (requestId, reason) => apiFetch(`/network/share-requests/${requestId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  revokeShareRequest:  (requestId) => apiFetch(`/network/share-requests/${requestId}/revoke`, { method: 'POST' }),
};
