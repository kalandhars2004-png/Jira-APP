// ES6+ API client — modules, async/await, spread, arrow functions, optional chaining
const BASE = 'http://localhost:8080';

const getUserId = () => {
  try { return JSON.parse(localStorage.getItem('currentUser'))?.id ?? null; } catch { return null; }
};

const request = async (path, { method='GET', body, params, headers={} } = {}) => {
  let url = `${BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '') qs.append(k, v); });
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const uid = getUserId();
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(uid && { headers: { 'Content-Type': 'application/json', 'X-User-Id': String(uid), ...headers } })
  };
  // ensure X-User-Id always if available
  if (uid && !opts.headers['X-User-Id']) opts.headers['X-User-Id'] = String(uid);
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  if (data && typeof data === 'object' && 'success' in data) {
    if (!data.success) throw new Error(data.message || 'Request failed');
    return data.data !== undefined ? data.data : data;
  }
  return data;
};

export const api = {
  get: (path, opts={}) => request(path, { ...opts, method:'GET' }),
  post: (path, body, opts={}) => request(path, { ...opts, method:'POST', body }),
  put: (path, body, opts={}) => request(path, { ...opts, method:'PUT', body }),
  patch: (path, body, opts={}) => request(path, { ...opts, method:'PATCH', body }),
  del: (path, opts={}) => request(path, { ...opts, method:'DELETE' }),
  BASE
};
