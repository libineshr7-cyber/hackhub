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
    this.setupEventListeners();
    this.checkAuthentication();
  },

  checkAuthentication() {
    const user = API.getUser();
    const token = API.getToken();

    // Push a history state so the back button stays within the SPA
    history.pushState({ spa: true }, '', window.location.pathname);

    if (!token || !user) {
      // Not logged in — show login modal, do NOT load any view
      Auth.showLoginModal();
    } else if (user.firstLogin) {
      // Logged in but must change password first — block navigation to home
      this.updateUserUI(user);
      Auth.showFirstLoginModal();
      // Do NOT call navigateTo('home') here — keep all views hidden
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

    if (user.role === 'ROLE_ADMIN') {
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
        break;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  openModal(modalId) {
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

  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};
