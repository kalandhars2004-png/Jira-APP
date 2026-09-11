// Simple storage for auth
export const storage = {
  getUser() {
    try { return JSON.parse(localStorage.getItem('currentUser')); } catch { return null; }
  },
  setUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  },
  clearUser() {
    localStorage.removeItem('currentUser');
  },
  getProjectId() {
    return localStorage.getItem('activeProjectId');
  },
  setProjectId(id) {
    if (id) localStorage.setItem('activeProjectId', String(id));
    else localStorage.removeItem('activeProjectId');
  }
};
