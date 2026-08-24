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

  async request(endpoint, options = {}, retries = 3) {
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
      headers,
      cache: 'no-store'
    };

    const isGet = !options.method || options.method === 'GET';

    for (let attempt = 1; attempt <= retries; attempt++) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const url = isGet ? `${API_BASE}${endpoint}${separator}_t=${Date.now()}` : `${API_BASE}${endpoint}`;

      try {
        const response = await fetch(url, config);

        // Server cold start / Gateway booting (502, 503, 504) — retry automatically
        if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < retries) {
          console.warn(`⏳ Server booting (Status ${response.status}). Retrying attempt ${attempt}/${retries}...`);
          await new Promise(r => setTimeout(r, attempt * 1500));
          continue;
        }

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
        if (attempt < retries && (err.name === 'TypeError' || err.message.includes('fetch') || err.message.includes('NetworkError'))) {
          console.warn(`⏳ Connection retry [${endpoint}] attempt ${attempt}/${retries}...`);
          await new Promise(r => setTimeout(r, attempt * 1500));
          continue;
        }
        console.error(`API Error [${endpoint}]:`, err);
        throw err;
      }
    }
  }
};
