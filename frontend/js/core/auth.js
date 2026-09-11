import { api } from './api.js';
import { storage } from './storage.js';

export const auth = {
  async register({ name, email, password, role }) {
    const data = await api.post('/api/auth/register', { name, email, password, role });
    storage.setUser(data);
    return data;
  },
  async login({ email, password }) {
    const data = await api.post('/api/auth/login', { email, password });
    storage.setUser(data);
    return data;
  },
  logout() {
    storage.clearUser();
    location.href = '/index.html';
  },
  requireAuth() {
    const u = storage.getUser();
    if (!u) {
      location.href = '/index.html';
      throw new Error('Not authenticated');
    }
    return u;
  },
  getUser() { return storage.getUser(); },
  isLoggedIn() { return !!storage.getUser(); }
};
