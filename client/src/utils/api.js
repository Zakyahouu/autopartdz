const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export function getToken() {
  return localStorage.getItem('autopartdz_token');
}

export function setToken(t) {
  if (t) localStorage.setItem('autopartdz_token', t);
  else localStorage.removeItem('autopartdz_token');
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Upload a file via multipart form to the given path.
 * fieldName defaults to 'file'.
 */
export async function apiUpload(path, file, fieldName = 'file') {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Fetch a file and return a local object URL suitable for <img src>.
 * Caller is responsible for revoking the URL when done.
 */
export async function fetchFileUrl(fileId) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/files/${fileId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
