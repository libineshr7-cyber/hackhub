/* ==========================================================================
   HackHub — Main Application Router & State Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Block browser back/forward from bypassing authentication
window.addEventListener('popstate', () => {
  // On every back/forward, re-enforce auth gate
  App.checkAuthentication();
  // Push a new state so back button can't escape the SPA
  history.pushState({ spa: true }, '', window.location.pathname);
});

const App = {
  currentView: 'home',

  init() {
    window.alert = (msg) => this.alert(msg);
    this.setupEventListeners();
    this.checkAuthentication();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (typeof Admin !== 'undefined' && Admin.stopLiveAutoRefresh) {
          Admin.stopLiveAutoRefresh();
        }
      } else if (this.currentView === 'admin') {
        if (typeof Admin !== 'undefined' && Admin.startLiveAutoRefresh) {
          Admin.startLiveAutoRefresh();
          Admin.pollLiveData();
        }
      }
    });
  },

  checkAuthentication() {
    const user = API.getUser();
    const token = API.getToken();

    // Push a history state so the back button stays within the SPA
    history.pushState({ spa: true }, '', window.location.pathname);

    if (!token || !user) {
      // Not logged in — hide all views, reset user UI, and show login modal
      document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
      const userRegElement = document.getElementById('header-user-reg');
      if (userRegElement) userRegElement.textContent = '🔒 Login';
      const bottomProfileAvatar = document.getElementById('bottom-profile-avatar');
      if (bottomProfileAvatar) bottomProfileAvatar.textContent = '🎓';
      Auth.showLoginModal();
    } else if (user.firstLogin) {
      // Logged in but must change password first — block navigation to home
      document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');
      this.updateUserUI(user);
      Auth.showFirstLoginModal();
    } else {
      this.updateUserUI(user);
      this.navigateTo('home');
      if (typeof Notifications !== 'undefined') Notifications.init();
    }
  },

  updateUserUI(user) {
    const userRegElement = document.getElementById('header-user-reg');
    const navAdmin = document.getElementById('nav-admin-link');
    const bottomNavAdmin = document.getElementById('bottom-admin-item');
    const bottomProfileAvatar = document.getElementById('bottom-profile-avatar');

    if (userRegElement) {
      userRegElement.textContent = `Reg No: ${user.registrationNumber}`;
    }

    // Update mobile bottom nav profile avatar with user initials
    if (bottomProfileAvatar) {
      const reg = user.registrationNumber || '';
      // Show last 3 chars of reg no (e.g. "018" from "CS018")
      const initials = reg.replace(/[^0-9]/g, '').slice(-3) || reg.slice(-2) || '?';
      bottomProfileAvatar.textContent = initials;
    }

    if (user.role === 'ROLE_ADMIN' || user.role === 'ROLE_SUBADMIN') {
      if (navAdmin) navAdmin.style.display = 'inline-block';
      if (bottomNavAdmin) bottomNavAdmin.style.display = 'flex';
    } else {
      if (navAdmin) navAdmin.style.display = 'none';
      if (bottomNavAdmin) bottomNavAdmin.style.display = 'none';
    }
  },

  setupEventListeners() {
    // Navigation Listeners
    document.querySelectorAll('[data-view]').forEach(elem => {
      elem.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = elem.getAttribute('data-view');
        this.navigateTo(targetView);
      });
    });

    // PROTECTED MODALS: login is always protected; first-login is protected ONLY if user.firstLogin === true
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          const user = API.getUser();
          if (modal.id === 'modal-login') return;
          if (modal.id === 'modal-first-login' && user && user.firstLogin) return;
          this.closeModal(modal.id);
        }
      });
    });

    // Modal close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        const user = API.getUser();
        if (modal) {
          if (modal.id === 'modal-login') return;
          if (modal.id === 'modal-first-login' && user && user.firstLogin) return;
          this.closeModal(modal.id);
        }
      });
    });
  },

  navigateTo(viewName) {
    const token = API.getToken();
    const user = API.getUser();

    if (!token || !user) {
      Auth.showLoginModal();
      return;
    }

    if (user.firstLogin) {
      Auth.showFirstLoginModal();
      return;
    }

    this.currentView = viewName;

    // Update Desktop Nav Active state
    document.querySelectorAll('.nav-item').forEach(nav => {
      if (nav.getAttribute('data-view') === viewName) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    // Update Bottom Nav Active state
    document.querySelectorAll('.bottom-nav-item').forEach(nav => {
      if (nav.getAttribute('data-view') === viewName) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });

    // Update Mobile Tab Pill Active state
    document.querySelectorAll('.mobile-tab-pill').forEach(pill => {
      if (pill.getAttribute('data-view') === viewName) {
        pill.classList.add('active');
        try {
          pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        } catch (e) {}
      } else {
        pill.classList.remove('active');
      }
    });

    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.style.display = 'none';
    });

    // Show selected view
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.style.display = 'block';
    }

    // Trigger View Loader Callbacks
    switch (viewName) {
      case 'home':
        Events.loadHomeDashboard();
        break;
      case 'latest':
        Events.loadLatestEvents();
        break;
      case 'upcoming':
        Events.loadUpcomingEvents();
        break;
      case 'deadline-soon':
        Events.loadDeadlineSoonEvents();
        break;
      case 'ended':
        Events.loadEndedEvents();
        break;
      case 'saved':
        Events.loadSavedEvents();
        break;
      case 'teams':
        Teams.loadTeamsView();
        break;
      case 'profile':
        Auth.loadProfile();
        break;
      case 'admin':
        Admin.loadDashboard();
        if (typeof Admin !== 'undefined' && Admin.startLiveAutoRefresh) {
          Admin.startLiveAutoRefresh();
        }
        break;
      default:
        if (typeof Admin !== 'undefined' && Admin.stopLiveAutoRefresh) {
          Admin.stopLiveAutoRefresh();
        }
        break;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  openModal(modalId) {
    if (modalId !== 'modal-login' && modalId !== 'modal-forgot-password') {
      const token = API.getToken();
      const user = API.getUser();
      if (!token || !user) {
        Auth.showLoginModal();
        return;
      }
      if (user.firstLogin && modalId !== 'modal-first-login') {
        Auth.showFirstLoginModal();
        return;
      }
    }
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  },

  /**
   * submitGuard — prevents double-submission on any form button.
   * Usage: const done = App.submitGuard(btn); ... await api call ... done();
   * @param {HTMLElement} btn - the submit button to lock
   * @param {string} loadingText - optional label while submitting
   * @returns {Function} call done() to re-enable button
   */
  submitGuard(btn, loadingText = 'Please wait...') {
    if (!btn || btn.disabled) return null; // Already submitting — block
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span style="opacity:0.7">${loadingText}</span>`;
    return () => {
      btn.disabled = false;
      btn.innerHTML = originalText;
    };
  },

  playNotificationSound() {
    // Sound completely removed from web application per user request
  },

  /**
   * Advanced HackHub Toast Notification with Maroon & White Theme, Animated Logo & Progress Bar
   */
  showToast(message, type = 'info', options = {}) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const duration = options.duration || 4500;
    const title = options.title || (type === 'danger' ? 'Error Alert' : type === 'success' ? 'Success' : type === 'warning' ? 'Notice' : 'Notification');
    const icon = options.icon || (type === 'danger' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '🔔');

    const toast = document.createElement('div');
    toast.className = `hackhub-toast hackhub-toast-${type}`;

    let actionBtnHtml = '';
    if (options.actionText && typeof options.onAction === 'function') {
      actionBtnHtml = `<div class="hackhub-toast-actions"><button type="button" class="hackhub-toast-btn">${options.actionText}</button></div>`;
    }

    const escape = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    toast.innerHTML = `
      <div class="hackhub-toast-header">
        <div class="hackhub-toast-brand">
          <div class="hackhub-toast-logo-wrap">
            <img src="/logo.png" class="hackhub-toast-logo" alt="HackHub">
          </div>
          <span class="hackhub-toast-badge">HACKHUB</span>
          <span class="hackhub-toast-status-tag" style="background:${type==='danger'?'rgba(220,38,38,0.12)':type==='success'?'rgba(5,150,105,0.12)':'rgba(128,0,32,0.1)'}; color:${type==='danger'?'#dc2626':type==='success'?'#059669':'#800020'};">${escape(title)}</span>
        </div>
        <span class="hackhub-toast-time">Just now</span>
        <button type="button" class="hackhub-toast-close" title="Dismiss">&times;</button>
      </div>
      <div class="hackhub-toast-body">
        <div class="hackhub-toast-icon-circle">${icon}</div>
        <div class="hackhub-toast-text">
          <div class="hackhub-toast-msg">${message}</div>
          ${actionBtnHtml}
        </div>
      </div>
      <div class="hackhub-toast-progress-track">
        <div class="hackhub-toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
      </div>
    `;

    const closeBtn = toast.querySelector('.hackhub-toast-close');
    const dismiss = () => {
      if (toast._dismissed) return;
      toast._dismissed = true;
      toast.classList.add('closing');
      setTimeout(() => toast.remove(), 350);
    };

    closeBtn.addEventListener('click', dismiss);

    if (options.actionText && typeof options.onAction === 'function') {
      const actBtn = toast.querySelector('.hackhub-toast-btn');
      if (actBtn) {
        actBtn.addEventListener('click', () => {
          options.onAction();
          dismiss();
        });
      }
    }

    container.appendChild(toast);
    setTimeout(dismiss, duration);
  },

  /**
   * Prominent incoming notification alert popup
   */
  showNotificationPopup(options = {}) {
    this.showToast(options.message || 'You have a new alert', options.type || 'info', {
      title: options.title || 'New Notification',
      icon: options.icon || '🔔',
      actionText: options.actionText || 'Open Notifications',
      onAction: options.onAction,
      duration: options.duration || 6500,
      sound: false
    });
  },

  /**
   * Advanced HackHub Dialog Box (Replaces browser confirm() with Maroon & White theme & logo)
   */
  confirm(message, options = {}) {
    return new Promise((resolve) => {
      const existing = document.getElementById('hackhub-custom-dialog');
      if (existing) existing.remove();

      const title = options.title || 'Confirm Action';
      const icon = options.icon || (options.danger ? '⚠️' : '❓');
      const confirmText = options.confirmText || 'Confirm & Proceed';
      const cancelText = options.cancelText || 'Cancel';
      const isDanger = options.danger !== false;

      const overlay = document.createElement('div');
      overlay.id = 'hackhub-custom-dialog';
      overlay.className = 'hackhub-dialog-overlay';

      overlay.innerHTML = `
        <div class="hackhub-dialog-card">
          <div class="hackhub-dialog-topbar"></div>
          <div class="hackhub-dialog-header">
            <div class="hackhub-dialog-brand">
              <div class="hackhub-dialog-logo-frame">
                <img src="/logo.png" alt="HackHub">
              </div>
              <div>
                <span class="hackhub-dialog-pill">HACKHUB</span>
                <div class="hackhub-dialog-header-title">Notification Dialog</div>
              </div>
            </div>
            <button type="button" class="hackhub-dialog-close" title="Close">&times;</button>
          </div>
          <div class="hackhub-dialog-body">
            <div class="hackhub-dialog-hero-icon">${icon}</div>
            <div class="hackhub-dialog-content">
              <h3 class="hackhub-dialog-title">${title}</h3>
              <p class="hackhub-dialog-message">${message}</p>
            </div>
          </div>
          <div class="hackhub-dialog-footer">
            <button type="button" class="hackhub-dialog-btn-cancel">${cancelText}</button>
            <button type="button" class="hackhub-dialog-btn-confirm ${isDanger ? 'danger' : ''}">${confirmText}</button>
          </div>
        </div>
      `;

      const close = (result) => {
        overlay.style.animation = 'hackhubModalBackdropFade 0.2s reverse forwards';
        const card = overlay.querySelector('.hackhub-dialog-card');
        if (card) card.style.animation = 'hackhubModalBoxPop 0.2s reverse forwards';
        setTimeout(() => {
          overlay.remove();
          resolve(result);
        }, 180);
      };

      overlay.querySelector('.hackhub-dialog-close').addEventListener('click', () => close(false));
      overlay.querySelector('.hackhub-dialog-btn-cancel').addEventListener('click', () => close(false));
      overlay.querySelector('.hackhub-dialog-btn-confirm').addEventListener('click', () => close(true));

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
      });

      document.body.appendChild(overlay);
      const confirmBtn = overlay.querySelector('.hackhub-dialog-btn-confirm');
      if (confirmBtn) confirmBtn.focus();
    });
  },

  /**
   * Advanced HackHub Alert Dialog (Replaces browser alert() with Maroon & White theme & logo)
   */
  alert(message, options = {}) {
    return new Promise((resolve) => {
      const existing = document.getElementById('hackhub-custom-dialog');
      if (existing) existing.remove();

      const title = options.title || 'HackHub Notice';
      const icon = options.icon || 'ℹ️';
      const okText = options.okText || 'OK';

      const overlay = document.createElement('div');
      overlay.id = 'hackhub-custom-dialog';
      overlay.className = 'hackhub-dialog-overlay';

      overlay.innerHTML = `
        <div class="hackhub-dialog-card">
          <div class="hackhub-dialog-topbar"></div>
          <div class="hackhub-dialog-header">
            <div class="hackhub-dialog-brand">
              <div class="hackhub-dialog-logo-frame">
                <img src="/logo.png" alt="HackHub">
              </div>
              <div>
                <span class="hackhub-dialog-pill">HACKHUB</span>
                <div class="hackhub-dialog-header-title">Alert Notification</div>
              </div>
            </div>
            <button type="button" class="hackhub-dialog-close" title="Close">&times;</button>
          </div>
          <div class="hackhub-dialog-body">
            <div class="hackhub-dialog-hero-icon">${icon}</div>
            <div class="hackhub-dialog-content">
              <h3 class="hackhub-dialog-title">${title}</h3>
              <p class="hackhub-dialog-message">${message}</p>
            </div>
          </div>
          <div class="hackhub-dialog-footer">
            <button type="button" class="hackhub-dialog-btn-confirm">${okText}</button>
          </div>
        </div>
      `;

      const close = () => {
        overlay.style.animation = 'hackhubModalBackdropFade 0.2s reverse forwards';
        const card = overlay.querySelector('.hackhub-dialog-card');
        if (card) card.style.animation = 'hackhubModalBoxPop 0.2s reverse forwards';
        setTimeout(() => {
          overlay.remove();
          resolve();
        }, 180);
      };

      overlay.querySelector('.hackhub-dialog-close').addEventListener('click', close);
      overlay.querySelector('.hackhub-dialog-btn-confirm').addEventListener('click', close);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });

      document.body.appendChild(overlay);
      const confirmBtn = overlay.querySelector('.hackhub-dialog-btn-confirm');
      if (confirmBtn) confirmBtn.focus();
    });
  }
};
