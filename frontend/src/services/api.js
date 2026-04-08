// frontend/src/services/api.js
// Centralized API client — all HTTP calls go through here

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// ── Token management ──────────────────────────────────────────────────────────
export const getToken = ()  => localStorage.getItem('ehr_token');
export const setToken = (t) => localStorage.setItem('ehr_token', t);
export const clearToken = () => localStorage.removeItem('ehr_token');

// ── Base fetch with auth ──────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (body)   => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login:    (body)   => apiFetch('/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
  me:       ()       => apiFetch('/auth/me'),
  getPatients: ()    => apiFetch('/auth/patients'),
};

// ── EHR ───────────────────────────────────────────────────────────────────────
export const ehrAPI = {
  upload: (formData) => {
    const token = getToken();
    return fetch(`${BASE_URL}/ehr/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,  // multipart — don't set Content-Type manually
    }).then(async r => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      return d;
    });
  },
  getById:           (ehrId)     => apiFetch(`/ehr/${ehrId}`),
  download:          (ehrId)     => `${BASE_URL}/ehr/${ehrId}/download?token=${getToken()}`,
  getPatientRecords: (patientId) => apiFetch(`/ehr/patient/${patientId}`),
  delete:            (ehrId)     => apiFetch(`/ehr/${ehrId}`, { method: 'DELETE' }),
};

// ── Access ────────────────────────────────────────────────────────────────────
export const accessAPI = {
  grant:  (body) => apiFetch('/access/grant',  { method: 'POST', body: JSON.stringify(body) }),
  revoke: (body) => apiFetch('/access/revoke', { method: 'POST', body: JSON.stringify(body) }),
  check:  (ehrId, requesterId) => apiFetch(`/access/check?ehrId=${ehrId}&requesterId=${requesterId}`),
};

// ── Audit ─────────────────────────────────────────────────────────────────────
export const auditAPI = {
  getHistory: (ehrId) => apiFetch(`/audit/${ehrId}`),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiAPI = {
  chat: (ehrId, question) => apiFetch(`/ai/chat`, { method: 'POST', body: JSON.stringify({ ehrId, question }) }),
};
