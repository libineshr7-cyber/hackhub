/* ==========================================================================
   HackHub — Real-Time Notification & Request Alert Module
   ========================================================================== */

const Notifications = {
  unreadCount: 0,
  pollTimer: null,
  lastKnownCount: 0,

  init() {
    this.fetchUnreadCount();
    this.startPolling();
  },

  startPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    // Poll unread notification count every 8 seconds
    this.pollTimer = setInterval(() => {
      if (API.getToken()) {
        this.checkNewNotifications();
      }
    }, 8000);
  },

  async fetchUnreadCount() {
    try {
      if (!API.getToken()) return;
      const res = await API.request('/notifications/unread-count');
      this.unreadCount = res.count || 0;
      this.updateBadgeUI(this.unreadCount);
    } catch (err) {
      console.debug('Unread count fetch skipped:', err.message);
    }
  },

  async checkNewNotifications() {
    try {
      const res = await API.request('/notifications/unread-count');
      const newCount = res.count || 0;

      if (newCount > this.unreadCount) {
        // New request received! Play toast alert
        App.showToast(`🔔 You have ${newCount - this.unreadCount} new request/notification!`, 'info');
        this.fetchNotificationsList();
      }

      this.unreadCount = newCount;
      this.updateBadgeUI(newCount);
    } catch (err) {
      // Quiet fail on network pause
    }
  },

  updateBadgeUI(count) {
    const badge = document.getElementById('notif-badge');
    const mobileBadge = document.getElementById('bottom-notif-badge');

    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (mobileBadge) {
      if (count > 0) {
        mobileBadge.textContent = count > 99 ? '99+' : count;
        mobileBadge.style.display = 'inline-block';
      } else {
        mobileBadge.style.display = 'none';
      }
    }
  },

  toggleModal() {
    App.openModal('modal-notifications');
    this.fetchNotificationsList();
  },

  async fetchNotificationsList() {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    try {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Loading requests & alerts...</div>';
      const list = await API.request('/notifications');

      if (!list || list.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
            <span style="font-size:2.5rem; display:block; margin-bottom:8px;">🔕</span>
            <p style="font-weight:600; font-size:1rem;">No notifications yet</p>
            <p style="font-size:0.85rem; margin-top:4px;">Teammate invitations and join requests from friends will appear here!</p>
          </div>`;
        return;
      }

      container.innerHTML = list.map(n => this.renderNotificationCard(n)).join('');
      
      // Auto-mark as read when modal opens
      API.request('/notifications/read-all', { method: 'POST' }).then(() => {
        this.unreadCount = 0;
        this.updateBadgeUI(0);
      });
    } catch (err) {
      container.innerHTML = `<div style="color:var(--status-danger); padding:20px; text-align:center;">Failed to load notifications: ${err.message}</div>`;
    }
  },

  renderNotificationCard(n) {
    let icon = '🔔';
    if (n.type === 'TEAM_INVITE') icon = '🤝';
    else if (n.type === 'TEAM_REQUEST') icon = '📩';
    else if (n.type === 'REQUEST_ACCEPTED') icon = '🎉';
    else if (n.type === 'REQUEST_REJECTED') icon = '❌';

    const unreadBg = n.isRead ? 'transparent' : 'rgba(14, 165, 233, 0.08)';
    const borderLeft = n.isRead ? '1px solid var(--border-color)' : '3px solid #0284c7';

    return `
      <div class="notification-item" style="display:flex; gap:12px; padding:12px 14px; margin-bottom:8px; border-radius:10px; background:${unreadBg}; border:${borderLeft}; align-items:flex-start;">
        <span style="font-size:1.4rem; line-height:1; padding-top:2px;">${icon}</span>
        <div style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <h4 style="font-size:0.92rem; font-weight:700; color:var(--text-main); margin:0;">${this.escapeHtml(n.title)}</h4>
            <span style="font-size:0.75rem; color:var(--text-muted);">${n.createdAt || ''}</span>
          </div>
          <p style="font-size:0.85rem; color:var(--text-muted); margin:4px 0 8px 0; line-height:1.4;">${this.escapeHtml(n.message)}</p>
          ${(n.type === 'TEAM_INVITE' || n.type === 'TEAM_REQUEST')
            ? `<button class="btn btn-primary btn-sm" onclick="Notifications.goToTeamsView()" style="font-size:0.78rem; padding:4px 12px;">👥 Open Teammates & Respond</button>`
            : ''
          }
        </div>
      </div>`;
  },

  goToTeamsView() {
    App.closeModal('modal-notifications');
    App.navigateTo('teams');
  },

  async clearAll() {
    if (!confirm('Clear all notification history?')) return;
    try {
      await API.request('/notifications/clear', { method: 'DELETE' });
      App.showToast('Cleared notifications', 'info');
      this.fetchNotificationsList();
      this.unreadCount = 0;
      this.updateBadgeUI(0);
    } catch (err) {
      App.showToast(err.message || 'Failed to clear notifications', 'danger');
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};
