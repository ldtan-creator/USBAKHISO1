// auth-guard.js - Quản lý phiên đăng nhập, phân quyền & tự động đồng bộ Token
(function () {
  const TOKEN_KEY = 'usbak_auth_token';
  const USER_KEY = 'usbak_current_user';

  window.USBAK_AUTH = {
    getToken: function () {
      return localStorage.getItem(TOKEN_KEY) || '';
    },
    getUser: function () {
      try {
        return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
      } catch (e) {
        return null;
      }
    },
    saveSession: function (user, token) {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clearSession: function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    logout: async function () {
      const token = this.getToken();
      if (token) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
          });
        } catch (e) {}
      }
      this.clearSession();
      window.location.href = 'index.html';
    },
    syncSession: async function () {
      const token = this.getToken();
      if (!token) return null;
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (data.ok && data.user) {
          this.saveSession(data.user, token);
          return data.user;
        } else {
          this.clearSession();
          return null;
        }
      } catch (e) {
        return this.getUser();
      }
    },
    apiFetch: async function (url, options) {
      options = options || {};
      options.headers = Object.assign({}, options.headers || {});
      const token = this.getToken();
      if (token) {
        options.headers['Authorization'] = 'Bearer ' + token;
      }
      if (options.body && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
      }
      const res = await fetch(url, options);
      if (res.status === 401 && this.getToken()) {
        this.clearSession();
      }
      return res;
    }
  };

  // Bảo vệ trang Admin ngay lập tức trước khi hiển thị nội dung
  if (window.location.pathname.endsWith('admin.html')) {
    document.documentElement.style.visibility = 'hidden';
    const token = window.USBAK_AUTH.getToken();
    if (!token) {
      window.location.replace('index.html?login=admin');
      return;
    }
    window.USBAK_AUTH.syncSession().then(user => {
      if (!user || user.role !== 'admin') {
        window.USBAK_AUTH.clearSession();
        window.location.replace('index.html?login=admin');
      } else {
        document.documentElement.style.visibility = 'visible';
      }
    });
  }
})();
