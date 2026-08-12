/* ==========================================================================
   HackHub — REST API Client Wrapper
   ========================================================================== */

const API_BASE = '/api';

const API = {
  getToken() {
    return localStorage.getItem('hackhub_token');
  },

  setToken(token) {
    localStorage.setItem('hackhub_token', token);
  },

  clearToken() {
    localStorage.removeItem('hackhub_token');
    localStorage.removeItem('hackhub_user');
  },

  getUser() {
    const raw = localStorage.getItem('hackhub_user');
    return raw ? JSON.parse(raw) : null;
  },

  setUser(user) {
    localStorage.setItem('hackhub_user', JSON.stringify(user));
  },

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = this.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : null;

      if (!response.ok) {
        if (response.status === 401 && !endpoint.startsWith('/auth/login')) {
          this.clearToken();
          window.location.reload();
        }
        const errorMsg = data && data.message ? data.message : `Error (${response.status}): ${response.statusText}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }
};
