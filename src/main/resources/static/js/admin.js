/* ==========================================================================
   HackHub — Admin Dashboard & Student Management Controller
   ========================================================================== */

const Admin = {
  cachedEvents: [],

  async loadDashboard() {
    try {
      const stats = await API.request('/admin/dashboard');
      document.getElementById('stat-total-students').textContent = stats.totalStudents;
      document.getElementById('stat-total-events').textContent = stats.totalEvents;
      document.getElementById('stat-upcoming-events').textContent = stats.upcomingEvents;
      document.getElementById('stat-ended-events').textContent = stats.endedEvents;
      document.getElementById('stat-saved-events').textContent = stats.totalSavedEvents;
      document.getElementById('stat-total-reports').textContent = stats.totalReports;

      await this.loadStudents();
      await this.loadEvents();
      await this.loadReports();
    } catch (err) {
      App.showToast('Failed to load Admin Dashboard', 'danger');
    }
  },

  async loadStudents(searchQuery = '') {
    try {
      const students = await API.request(`/admin/students?search=${encodeURIComponent(searchQuery)}`);
      const tbody = document.getElementById('admin-students-tbody');

      if (!students || students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No student accounts found.</td></tr>`;
        return;
      }

      tbody.innerHTML = students.map(s => {
        const isStatusActive = s.status === 'ACTIVE';
        const statusBadge = isStatusActive ? 
          `<span style="background: rgba(16,185,129,0.15); color: var(--status-upcoming); padding: 3px 8px; border-radius: 12px; font-weight:600; font-size: 0.75rem;">ACTIVE</span>` : 
          `<span style="background: rgba(239,68,68,0.15); color: var(--status-danger); padding: 3px 8px; border-radius: 12px; font-weight:600; font-size: 0.75rem;">DISABLED</span>`;

        const newStatusTarget = isStatusActive ? 'DISABLED' : 'ACTIVE';
        const toggleBtnText = isStatusActive ? 'Disable' : 'Enable';

        return `
          <tr>
            <td><strong>${this.escapeHtml(s.registrationNumber)}</strong></td>
            <td>${this.escapeHtml(s.name)}</td>
            <td>${this.escapeHtml(s.email)}</td>
            <td><span style="font-size:0.75rem; color: var(--accent-cyan);">${this.escapeHtml(s.skills || 'N/A')}</span></td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex; gap: 6px;">
                <button class="btn btn-outline btn-sm" onclick="Admin.toggleStudentStatus(${s.id}, '${newStatusTarget}')">${toggleBtnText}</button>
                <button class="btn btn-secondary btn-sm" onclick="Admin.resetStudentPassword(${s.id}, '${s.registrationNumber}')">Reset Pass</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async handleSearchStudents() {
    const q = document.getElementById('admin-student-search-input').value;
    this.loadStudents(q);
  },

  async handleCreateStudentSubmit(event) {
    event.preventDefault();
    let regNo = document.getElementById('admin-create-reg-no').value.trim().toUpperCase();
    if (/^\d+$/.test(regNo)) {
      regNo = 'CS' + regNo.padStart(3, '0');
    }
    const name = document.getElementById('admin-create-name').value.trim();
    const email = document.getElementById('admin-create-email').value.trim();
    const skills = document.getElementById('admin-create-skills').value.trim();

    try {
      const res = await API.request('/admin/students/create', {
        method: 'POST',
        body: JSON.stringify({ registrationNumber: regNo, name, email, skills })
      });

      App.closeModal('modal-admin-create-student');
      document.getElementById('form-admin-create-student').reset();
      App.showToast(`🎉 Student account '${res.registrationNumber}' created! Temporary password is '123'.`, 'success');
      this.loadDashboard();
    } catch (err) {
      App.showToast(err.message || 'Failed to create student account', 'danger');
    }
  },

  async toggleStudentStatus(studentId, targetStatus) {
    try {
      const res = await API.request(`/admin/students/${studentId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: targetStatus })
      });

      App.showToast(res.message, 'success');
      this.loadStudents();
    } catch (err) {
      App.showToast(err.message || 'Status toggle failed', 'danger');
    }
  },

  async resetStudentPassword(studentId, regNo) {
    if (!confirm(`Are you sure you want to reset password for student ${regNo}? Current password will not be revealed, and password will be reset to temporary password '123'.`)) {
      return;
    }

    try {
      const res = await API.request(`/admin/students/${studentId}/reset-password`, {
        method: 'POST'
      });

      App.showToast(res.message, 'success');
    } catch (err) {
      App.showToast(err.message || 'Password reset failed', 'danger');
    }
  },

  async loadReports() {
    try {
      const reports = await API.request('/admin/reports');
      const tbody = document.getElementById('admin-reports-tbody');

      if (!reports || reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No reports submitted.</td></tr>`;
        return;
      }

      tbody.innerHTML = reports.map(r => `
        <tr>
          <td>#${r.id}</td>
          <td><strong>${this.escapeHtml(r.eventTitle)}</strong></td>
          <td>${this.escapeHtml(r.reportedByRegNo)} (${this.escapeHtml(r.reportedByName)})</td>
          <td><span style="color: var(--status-danger); font-weight:600;">${this.escapeHtml(r.reason)}</span></td>
          <td><span style="font-size:0.75rem;">${r.status}</span></td>
          <td>
            <div style="display:flex; gap:4px;">
              <button class="btn btn-primary btn-sm" onclick="Admin.updateReportStatus(${r.id}, 'RESOLVED')">Resolve</button>
              <button class="btn btn-secondary btn-sm" onclick="Admin.updateReportStatus(${r.id}, 'DISMISSED')">Dismiss</button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async updateReportStatus(reportId, status) {
    try {
      const res = await API.request(`/admin/reports/${reportId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });

      App.showToast(res.message, 'success');
      this.loadReports();
    } catch (err) {
      App.showToast(err.message || 'Report status update failed', 'danger');
    }
  },

  async loadEvents() {
    try {
      const events = await API.request('/admin/events');
      const tbody = document.getElementById('admin-events-tbody');
      if (!tbody) return;

      if (!events || events.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No events posted yet.</td></tr>`;
        return;
      }

      this.cachedEvents = events;
      tbody.innerHTML = events.map(e => `
        <tr>
          <td><strong>${this.escapeHtml(e.title)}</strong></td>
          <td><span style="font-size:0.75rem; background: var(--accent-maroon-tint); color: var(--accent-maroon); font-weight:700; padding:2px 6px; border-radius:4px;">${e.eventType}</span></td>
          <td><span style="font-size:0.75rem;">${e.mode}</span></td>
          <td><span style="font-size:0.78rem;">${e.startDate} to ${e.endDate}</span></td>
          <td><span style="font-size:0.78rem; color: var(--accent-maroon); font-weight:600;">${e.registrationDeadline}</span></td>
          <td>
            <div style="display:flex; gap: 6px;">
              <button class="btn btn-primary btn-sm" onclick="Admin.openEditEventModal(${e.id})">✏️ Modify</button>
              <button class="btn btn-danger btn-sm" onclick="Admin.deleteEvent(${e.id}, '${this.escapeHtml(e.title)}')">🗑️ Delete</button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  openEditEventModal(eventId) {
    const event = (this.cachedEvents || []).find(e => e.id === eventId);
    if (!event) {
      App.showToast('Event details not found.', 'danger');
      return;
    }

    document.getElementById('admin-edit-event-id').value = event.id;
    document.getElementById('admin-edit-title').value = event.title || '';
    document.getElementById('admin-edit-description').value = event.description || '';
    document.getElementById('admin-edit-type').value = event.eventType || 'HACKATHON';
    document.getElementById('admin-edit-mode').value = event.mode || 'HYBRID';
    document.getElementById('admin-edit-min-team').value = event.teamSizeMin || 1;
    document.getElementById('admin-edit-max-team').value = event.teamSizeMax || 4;
    document.getElementById('admin-edit-start-date').value = event.startDate || '';
    document.getElementById('admin-edit-end-date').value = event.endDate || '';
    document.getElementById('admin-edit-deadline').value = event.registrationDeadline || '';
    document.getElementById('admin-edit-venue').value = event.venue || '';
    document.getElementById('admin-edit-link').value = event.registrationLink || '';
    document.getElementById('admin-edit-skills').value = event.skills || '';
    document.getElementById('admin-edit-poster-url').value = event.posterPath || '';
    document.getElementById('admin-edit-poster-file').value = '';

    const previewContainer = document.getElementById('admin-edit-poster-preview');
    if (previewContainer) {
      if (event.posterPath) {
        previewContainer.innerHTML = `<img src="${this.escapeHtml(event.posterPath)}" style="max-height: 100px; border-radius: 6px; border: 1px solid var(--border-color);" alt="Current Poster">`;
      } else {
        previewContainer.innerHTML = `<span style="font-size: 0.78rem; color: var(--text-muted);">No current poster image.</span>`;
      }
    }

    App.openModal('modal-admin-edit-event');
  },

  async handleEditEventSubmit(e) {
    e.preventDefault();
    const eventId = document.getElementById('admin-edit-event-id').value;
    const title = document.getElementById('admin-edit-title').value.trim();
    const description = document.getElementById('admin-edit-description').value.trim();
    const eventType = document.getElementById('admin-edit-type').value;
    const mode = document.getElementById('admin-edit-mode').value;
    const teamSizeMin = parseInt(document.getElementById('admin-edit-min-team').value) || 1;
    const teamSizeMax = parseInt(document.getElementById('admin-edit-max-team').value) || 4;
    const startDate = document.getElementById('admin-edit-start-date').value;
    const endDate = document.getElementById('admin-edit-end-date').value;
    const registrationDeadline = document.getElementById('admin-edit-deadline').value;
    const venue = document.getElementById('admin-edit-venue').value.trim();
    const registrationLink = document.getElementById('admin-edit-link').value.trim();
    const skills = document.getElementById('admin-edit-skills').value.trim();
    const posterPath = document.getElementById('admin-edit-poster-url').value.trim();

    const payload = {
      title, description, eventType, mode, teamSizeMin, teamSizeMax,
      startDate, endDate, registrationDeadline, venue, registrationLink, skills, posterPath
    };

    const formData = new FormData();
    formData.append('event', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

    const fileInput = document.getElementById('admin-edit-poster-file');
    if (fileInput && fileInput.files[0]) {
      formData.append('posterFile', fileInput.files[0]);
    }

    try {
      await API.request(`/admin/events/${eventId}`, {
        method: 'PUT',
        body: formData
      });
      App.closeModal('modal-admin-edit-event');
      App.showToast('🎉 Hackathon details & poster updated successfully!', 'success');
      this.loadDashboard();
      if (typeof Events !== 'undefined' && Events.loadAllEvents) Events.loadAllEvents();
      if (typeof Calendar !== 'undefined' && Calendar.renderCalendar) Calendar.renderCalendar();
    } catch (err) {
      App.showToast(err.message || 'Failed to modify event', 'danger');
    }
  },

  async deleteEvent(eventId, eventTitle) {
    if (!confirm(`Are you sure you want to permanently delete event "${eventTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await API.request(`/admin/events/${eventId}`, { method: 'DELETE' });
      App.showToast(res.message || 'Event deleted successfully', 'success');
      this.loadDashboard();
      if (typeof Events !== 'undefined' && Events.loadAllEvents) Events.loadAllEvents();
      if (typeof Calendar !== 'undefined' && Calendar.renderCalendar) Calendar.renderCalendar();
    } catch (err) {
      App.showToast(err.message || 'Failed to delete event', 'danger');
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};
