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
    // Poll unread notification count every 30 seconds when tab is active
    this.pollTimer = setInterval(() => {
      if (API.getToken() && !document.hidden) {
        this.checkNewNotifications();
      }
    }, 30000);
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
        const diff = newCount - this.unreadCount;
        App.showNotificationPopup({
          title: 'New Notification Received!',
          message: `You have ${diff} new teammate alert/notification waiting for you!`,
          icon: '🔔',
          actionText: 'View Alerts',
          onAction: () => Notifications.toggleModal(),
          duration: 6500
        });
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

    const unreadBg = n.isRead ? '#ffffff' : 'rgba(128, 0, 32, 0.05)';
    const borderLeft = n.isRead ? '1px solid var(--border-color)' : '3.5px solid var(--accent-maroon)';

    return `
      <div class="notification-item" style="display:flex; gap:12px; padding:12px 14px; margin-bottom:10px; border-radius:12px; background:${unreadBg}; border:${borderLeft}; box-shadow: 0 2px 8px rgba(0,0,0,0.04); align-items:flex-start; transition: transform 0.2s;">
        <span style="font-size:1.4rem; line-height:1; padding-top:2px;">${icon}</span>
        <div style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <h4 style="font-size:0.92rem; font-weight:700; color:var(--text-main); margin:0;">${this.escapeHtml(n.title)}</h4>
            <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">${n.createdAt || ''}</span>
          </div>
          <p style="font-size:0.85rem; color:var(--text-muted); margin:4px 0 8px 0; line-height:1.4;">${this.escapeHtml(n.message)}</p>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
            ${(n.type === 'TEAM_INVITE' || n.type === 'TEAM_REQUEST')
              ? `<button class="btn btn-sm" onclick="Notifications.goToTeamsView()" style="font-size:0.78rem; padding:4px 14px; background:linear-gradient(135deg, #800020, #9e1b32); color:#fff; border-radius:6px; box-shadow: 0 2px 8px rgba(128,0,32,0.25);">👥 Open Teammates &amp; Respond</button>`
              : '<span></span>'
            }
            <button class="btn btn-outline btn-sm" onclick="Notifications.deleteSingle(${n.id})" title="Delete message" style="font-size:0.75rem; padding:2px 8px; color:var(--status-danger); border-color:rgba(220,38,38,0.25); border-radius:6px;">🗑️ Delete</button>
          </div>
        </div>
      </div>`;
  },

  goToTeamsView() {
    App.closeModal('modal-notifications');
    App.navigateTo('teams');
  },

  async deleteSingle(id) {
    const confirmed = await App.confirm('Permanently delete this notification message?', {
      title: 'Delete Notification?',
      icon: '🗑️',
      confirmText: 'Delete Message',
      cancelText: 'Cancel',
      danger: true
    });
    if (!confirmed) return;

    try {
      await API.request(`/notifications/${id}`, { method: 'DELETE' });
      App.showToast('Notification deleted', 'success', {
        title: 'Deleted',
        icon: '🗑️'
      });
      this.fetchNotificationsList();
      this.fetchUnreadCount();
    } catch (err) {
      App.showToast(err.message || 'Failed to delete notification', 'danger');
    }
  },

  async clearAll() {
    const confirmed = await App.confirm('Are you sure you want to clear all your notification history? This cannot be undone.', {
      title: 'Clear Notification History?',
      icon: '🗑️',
      confirmText: 'Yes, Clear All',
      cancelText: 'Cancel',
      danger: true
    });
    if (!confirmed) return;

    try {
      await API.request('/notifications/clear', { method: 'DELETE' });
      App.showToast('All notifications have been cleared successfully.', 'success', {
        title: 'Cleared',
        icon: '🧹'
      });
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
