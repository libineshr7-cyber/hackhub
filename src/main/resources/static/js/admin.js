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

      const user = API.getUser();
      // Sub-admin management tab: only visible to ROLE_ADMIN
      const subAdminTab = document.getElementById('admin-subtab-subadmins');
      const subAdminSection = document.getElementById('admin-sec-subadmins');
      const subAdminCreateBtn = document.getElementById('admin-create-subadmin-btn');
      if (user && user.role === 'ROLE_ADMIN') {
        if (subAdminTab) subAdminTab.style.display = 'inline-flex';
        if (subAdminCreateBtn) subAdminCreateBtn.style.display = 'inline-flex';
      } else {
        if (subAdminTab) subAdminTab.style.display = 'none';
        if (subAdminSection) subAdminSection.style.display = 'none';
        if (subAdminCreateBtn) subAdminCreateBtn.style.display = 'none';
      }

      await this.loadPostingHistory();
      await this.loadUserLogs();
      await this.loadStudents();
      await this.loadEvents();
      await this.loadReports();
      if (user && user.role === 'ROLE_ADMIN') {
        await this.loadSubAdmins();
      }
    } catch (err) {
      App.showToast('Failed to load Admin Dashboard', 'danger');
    }
  },

  formatDateTime(dtStr) {
    if (!dtStr) return '<span style="color:var(--text-muted);">N/A</span>';
    try {
      const d = new Date(dtStr);
      if (isNaN(d.getTime())) return dtStr;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dtStr;
    }
  },

  switchSubTab(tabName) {
    document.querySelectorAll('.admin-subtab-btn').forEach(btn => {
      if (btn.getAttribute('data-subtab') === tabName) {
        btn.classList.add('active', 'btn-primary');
        btn.classList.remove('btn-outline');
      } else {
        btn.classList.remove('active', 'btn-primary');
        btn.classList.add('btn-outline');
      }
    });

    const sections = {
      'posting-history': document.getElementById('admin-sec-posting-history'),
      'userlogs': document.getElementById('admin-sec-userlogs'),
      'students': document.getElementById('admin-sec-students'),
      'events': document.getElementById('admin-sec-events'),
      'reports': document.getElementById('admin-sec-reports'),
      'database': document.getElementById('admin-sec-database'),
      'subadmins': document.getElementById('admin-sec-subadmins')
    };

    const user = API.getUser();
    const isAdmin = user && user.role === 'ROLE_ADMIN';

    // Hide logs, database, and subadmin tabs for non-full admins
    const dbTabBtn = document.querySelector('.admin-tab-btn[data-tab="database"]');
    const subadminTabBtn = document.querySelector('.admin-tab-btn[data-tab="subadmins"]');
    const logsTabBtn = document.querySelector('.admin-tab-btn[data-tab="userlogs"]');
    const historyTabBtn = document.querySelector('.admin-tab-btn[data-tab="posting-history"]');
    if (dbTabBtn) dbTabBtn.style.display = isAdmin ? 'inline-block' : 'none';
    if (subadminTabBtn) subadminTabBtn.style.display = isAdmin ? 'inline-block' : 'none';
    if (logsTabBtn) logsTabBtn.style.display = isAdmin ? 'inline-block' : 'none';
    if (historyTabBtn) historyTabBtn.style.display = isAdmin ? 'inline-block' : 'none';

    if (tabName === 'all') {
      Object.keys(sections).forEach(key => {
        if (!sections[key]) return;
        if (key === 'database' || key === 'userlogs' || key === 'posting-history' || key === 'subadmins') {
          sections[key].style.display = isAdmin ? (key === 'database' ? 'none' : 'block') : 'none';
          return;
        }
        sections[key].style.display = 'block';
      });
    } else {
      if (!isAdmin && (tabName === 'database' || tabName === 'userlogs' || tabName === 'posting-history' || tabName === 'subadmins')) {
        tabName = 'students';
      }
      Object.keys(sections).forEach(key => {
        if (sections[key]) {
          sections[key].style.display = (key === tabName) ? 'block' : 'none';
        }
      });
      if (tabName === 'database' && isAdmin) {
        this.loadDbTable('users');
      }
    }
  },

  async loadDbTable(tableName) {
    const headersEl = document.getElementById('db-table-headers');
    const rowsEl = document.getElementById('db-table-rows');
    if (!headersEl || !rowsEl) return;

    try {
      rowsEl.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px;">Loading database records...</td></tr>';
      
      let data = [];
      if (tableName === 'users') {
        data = await API.request('/admin/users/log');
        headersEl.innerHTML = '<th>ID</th><th>Reg No</th><th>Name</th><th>Role</th><th>Dept</th><th>Status</th><th>First Login</th>';
        rowsEl.innerHTML = data.map(u => `
          <tr>
            <td>#${u.id}</td>
            <td><strong>${this.escapeHtml(u.registrationNumber)}</strong></td>
            <td>${this.escapeHtml(u.name)}</td>
            <td><code>${u.role}</code></td>
            <td><span style="font-size:0.75rem; color:var(--accent-cyan);">${this.escapeHtml(u.department || 'CS')}</span></td>
            <td><span class="badge ${u.status === 'ACTIVE' ? 'badge-upcoming' : 'badge-ended'}">${u.status}</span></td>
            <td>${u.firstLogin ? 'YES' : 'NO'}</td>
          </tr>`).join('');
      } else if (tableName === 'events') {
        data = await API.request('/admin/events');
        headersEl.innerHTML = '<th>ID</th><th>Title</th><th>Type</th><th>Mode</th><th>Deadline</th><th>Status</th>';
        rowsEl.innerHTML = data.map(e => `
          <tr>
            <td>#${e.id}</td>
            <td><strong>${this.escapeHtml(e.title)}</strong></td>
            <td>${e.eventType}</td>
            <td>${e.mode}</td>
            <td>${e.registrationDeadline}</td>
            <td><span class="badge ${e.status === 'UPCOMING' ? 'badge-upcoming' : (e.status === 'ENDED' ? 'badge-ended' : 'badge-deadline')}">${e.status}</span></td>
          </tr>`).join('');
      } else if (tableName === 'reports') {
        data = await API.request('/admin/reports');
        headersEl.innerHTML = '<th>ID</th><th>Reported Event</th><th>Reporter Reg No</th><th>Reason</th><th>Status</th>';
        rowsEl.innerHTML = data.map(r => `
          <tr>
            <td>#${r.id}</td>
            <td><strong>${this.escapeHtml(r.eventTitle)}</strong></td>
            <td>${this.escapeHtml(r.reporterRegNo)}</td>
            <td>${this.escapeHtml(r.reason)}</td>
            <td><span class="badge ${r.status === 'RESOLVED' ? 'badge-upcoming' : 'badge-deadline'}">${r.status}</span></td>
          </tr>`).join('');
      }
    } catch (err) {
      rowsEl.innerHTML = `<tr><td colspan="10" style="color:var(--status-danger); text-align:center; padding:20px;">Failed to load database table: ${err.message}</td></tr>`;
    }
  },

  async loadPostingHistory(query = '') {
    try {
      const events = await API.request('/admin/events');
      const tbody = document.getElementById('admin-history-tbody');
      if (!tbody) return;

      if (!events || events.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding:20px;">No hackathon posting logs available.</td></tr>`;
        return;
      }

      let filtered = events;
      if (query && query.trim()) {
        const q = query.trim().toLowerCase();
        filtered = events.filter(e =>
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.createdByRegNo && e.createdByRegNo.toLowerCase().includes(q)) ||
          (e.createdByName && e.createdByName.toLowerCase().includes(q)) ||
          (e.eventType && e.eventType.toLowerCase().includes(q))
        );
      }

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding:20px;">No matching posting logs found.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map(e => {
        const posterReg = e.createdByRegNo || 'N/A';
        const posterName = e.createdByName || 'Unknown';
        const formattedDate = this.formatDateTime(e.createdAt);

        return `
          <tr>
            <td><strong>#${e.id}</strong></td>
            <td><strong>${this.escapeHtml(e.title)}</strong></td>
            <td><span style="font-size:0.75rem; background: var(--accent-maroon-tint); color: var(--accent-maroon); font-weight:700; padding:3px 8px; border-radius:4px;">${this.escapeHtml(e.eventType || 'HACKATHON')}</span></td>
            <td>
              <div style="display:flex; flex-direction:column;">
                <span style="font-weight:700; color:var(--accent-cyan); font-size:0.82rem;">🆔 ${this.escapeHtml(posterReg)}</span>
                <span style="font-size:0.78rem; color:var(--text-main);">${this.escapeHtml(posterName)}</span>
              </div>
            </td>
            <td><span style="font-size:0.8rem; font-weight:600; color:var(--accent-maroon);">🕒 ${formattedDate}</span></td>
            <td><span style="font-size:0.78rem;">${e.startDate} to ${e.endDate}</span></td>
            <td><span style="font-size:0.78rem;">${e.mode}</span></td>
            <td>
              <div style="display:flex; gap:4px;">
                <button class="btn btn-primary btn-sm" onclick="Admin.openEditEventModal(${e.id})">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="Admin.deleteEvent(${e.id}, '${this.escapeHtml(e.title)}')">🗑️ Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load posting history:', err);
    }
  },

  handleSearchPostingHistory() {
    const q = document.getElementById('admin-history-search-input').value;
    this.loadPostingHistory(q);
  },

  async loadUserLogs(query = '') {
    try {
      const users = await API.request(`/admin/users/log${query ? '?search=' + encodeURIComponent(query) : ''}`);
      const tbody = document.getElementById('admin-userlogs-tbody');
      if (!tbody) return;

      if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--text-muted); padding:20px;">No user account logs found.</td></tr>`;
        return;
      }

      tbody.innerHTML = users.map(u => {
        const isStatusActive = u.status === 'ACTIVE';
        const statusBadge = isStatusActive ?
          `<span style="background: rgba(16,185,129,0.15); color: var(--status-upcoming); padding: 3px 8px; border-radius: 12px; font-weight:600; font-size: 0.75rem;">ACTIVE</span>` :
          `<span style="background: rgba(239,68,68,0.15); color: var(--status-danger); padding: 3px 8px; border-radius: 12px; font-weight:600; font-size: 0.75rem;">DISABLED</span>`;

        const newStatusTarget = isStatusActive ? 'DISABLED' : 'ACTIVE';
        const toggleBtnText = isStatusActive ? 'Disable' : 'Enable';
        const formattedCreated = this.formatDateTime(u.createdAt);
        const roleBadge = u.role === 'ROLE_ADMIN' ?
          `<span style="background:var(--accent-maroon); color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">ADMIN</span>` :
          u.role === 'ROLE_SUBADMIN' ?
          `<span style="background:#7c3aed; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:700;">SUB-ADMIN</span>` :
          `<span style="background:rgba(59,130,246,0.15); color:#3b82f6; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:600;">STUDENT</span>`;

        return `
          <tr>
            <td><strong style="color:var(--accent-cyan); font-size:0.8rem;">#${u.id}</strong></td>
            <td><strong style="color:var(--accent-cyan);">🆔 ${this.escapeHtml(u.registrationNumber)}</strong></td>
            <td><strong>${this.escapeHtml(u.name)}</strong></td>
            <td><span style="font-size:0.8rem;">${this.escapeHtml(u.email)}</span></td>
            <td>${roleBadge}</td>
            <td><span style="font-size:0.75rem; color:var(--accent-cyan);">${this.escapeHtml(u.department || 'CS')}</span></td>
            <td><span style="font-size:0.8rem; font-weight:600;">📅 ${formattedCreated}</span></td>
            <td><span style="font-weight:700; color:var(--accent-maroon);">${u.postedEventsCount || 0} events</span></td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex; gap:4px;">
                ${u.role !== 'ROLE_ADMIN' ? `<button class="btn btn-outline btn-sm" onclick="Admin.toggleStudentStatus(${u.id}, '${newStatusTarget}')">${toggleBtnText}</button>` : ''}
                <button class="btn btn-secondary btn-sm" onclick="Admin.resetStudentPassword(${u.id}, '${u.registrationNumber}')">Reset Pass</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load user logs:', err);
    }
  },

  handleSearchUserLogs() {
    const q = document.getElementById('admin-userlog-search-input').value;
    this.loadUserLogs(q);
  },

  async loadStudents(searchQuery = '') {
    try {
      const students = await API.request(`/admin/students?search=${encodeURIComponent(searchQuery)}`);
      const tbody = document.getElementById('admin-students-tbody');

      if (!tbody) return;

      if (!students || students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding:20px;">No student accounts found for your assigned department/year.</td></tr>`;
        return;
      }

      const currentUser = API.getUser();
      const isAdmin = currentUser && currentUser.role === 'ROLE_ADMIN';

      tbody.innerHTML = students.map(s => {
        const isStatusActive = s.status === 'ACTIVE';
        const statusBadge = isStatusActive ? 
          `<span style="background: rgba(16,185,129,0.15); color: var(--status-upcoming); padding: 3px 8px; border-radius: 12px; font-weight:600; font-size: 0.75rem;">ACTIVE</span>` : 
          `<span style="background: rgba(239,68,68,0.15); color: var(--status-danger); padding: 3px 8px; border-radius: 12px; font-weight:600; font-size: 0.75rem;">DISABLED</span>`;

        const newStatusTarget = isStatusActive ? 'DISABLED' : 'ACTIVE';
        const toggleBtnText = isStatusActive ? 'Disable' : 'Enable';

        const deleteBtnHtml = isAdmin ? `
          <button class="btn btn-outline btn-sm" style="color:var(--status-danger); border-color:rgba(220,38,38,0.3);" onclick="Admin.deleteStudent(${s.id}, '${this.escapeHtml(s.registrationNumber)}')">🗑️</button>
        ` : '';

        return `
          <tr>
            <td><strong style="color:var(--accent-cyan); font-size:0.85rem;">#${s.id}</strong></td>
            <td><strong>${this.escapeHtml(s.registrationNumber)}</strong></td>
            <td>${this.escapeHtml(s.name)}</td>
            <td>${this.escapeHtml(s.email)}</td>
            <td><span style="font-size:0.75rem; background:rgba(14,165,233,0.1); color:var(--accent-cyan); padding:2px 6px; border-radius:4px;">${this.escapeHtml(s.department || 'CS')}</span></td>
            <td><span style="font-size:0.75rem; color: var(--accent-cyan);">${this.escapeHtml(s.skills || 'N/A')}</span></td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex; gap: 6px; flex-wrap:wrap;">
                <button class="btn btn-outline btn-sm" onclick="Admin.toggleStudentStatus(${s.id}, '${newStatusTarget}')">${toggleBtnText}</button>
                <button class="btn btn-secondary btn-sm" onclick="Admin.resetStudentPassword(${s.id}, '${s.registrationNumber}')">🔑 Reset Pass</button>
                ${deleteBtnHtml}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async deleteStudent(studentId, regNo) {
    if (!confirm(`Are you sure you want to permanently delete student '${regNo}'? This cannot be undone.`)) return;
    try {
      const res = await API.request(`/admin/students/${studentId}`, { method: 'DELETE' });
      App.showToast(res.message || 'Student account deleted.', 'success');
      this.loadStudents();
    } catch (err) {
      App.showToast(err.message || 'Failed to delete student account', 'danger');
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
      regNo = 'CS' + regNo.padStart(4, '0');
    }
    const name = document.getElementById('admin-create-name').value.trim();
    const email = document.getElementById('admin-create-email').value.trim();
    const skills = document.getElementById('admin-create-skills').value.trim();
    const department = document.getElementById('admin-create-dept').value.trim().toUpperCase() || 'CS';

    try {
      const res = await API.request('/admin/students/create', {
        method: 'POST',
        body: JSON.stringify({ registrationNumber: regNo, name, email, skills, department })
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
      App.showToast(err.message || 'Failed to update student status', 'danger');
    }
  },

  async resetStudentPassword(studentId, regNo) {
    if (!confirm(`Reset password for '${regNo}' to default '123'?`)) return;
    try {
      const res = await API.request(`/admin/students/${studentId}/reset-password`, { method: 'POST' });
      App.showToast(res.message || `Password for ${regNo} reset to '123'.`, 'success');
    } catch (err) {
      App.showToast(err.message || 'Password reset failed', 'danger');
    }
  },

  // =====================================================================
  // SUB-ADMIN MANAGEMENT (Admin Only)
  // =====================================================================

  async loadSubAdmins() {
    try {
      const subAdmins = await API.request('/admin/subadmins');
      const tbody = document.getElementById('admin-subadmins-tbody');
      if (!tbody) return;

      if (!subAdmins || subAdmins.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding:20px;">No sub-admin accounts created yet. Click "Create Sub-Admin" to add one.</td></tr>`;
        return;
      }

      tbody.innerHTML = subAdmins.map(sa => {
        const isStatusActive = sa.status === 'ACTIVE';
        const statusBadge = isStatusActive ?
          `<span style="background: rgba(16,185,129,0.15); color: var(--status-upcoming); padding: 3px 8px; border-radius: 12px; font-weight:600; font-size: 0.75rem;">ACTIVE</span>` :
          `<span style="background: rgba(239,68,68,0.15); color: var(--status-danger); padding: 3px 8px; border-radius: 12px; font-weight:600; font-size: 0.75rem;">DISABLED</span>`;
        const newStatus = isStatusActive ? 'DISABLED' : 'ACTIVE';
        const toggleText = isStatusActive ? 'Disable' : 'Enable';

        const yearLabel = sa.assignedYear === '2' ? '2nd Year (CS2xxx)' : 
                          sa.assignedYear === '3' ? '3rd Year (CS3xxx)' : 
                          sa.assignedYear === '4' ? '4th Year' : 'All Years';

        return `
          <tr>
            <td><strong style="color:var(--accent-cyan);">#${sa.id}</strong></td>
            <td><strong style="color:#7c3aed;">🛡️ ${this.escapeHtml(sa.registrationNumber)}</strong></td>
            <td>${this.escapeHtml(sa.name)}</td>
            <td><span style="font-size:0.8rem;">${this.escapeHtml(sa.email)}</span></td>
            <td>
              <span style="background:rgba(124,58,237,0.12); color:#7c3aed; font-weight:700; padding:3px 8px; border-radius:6px; font-size:0.75rem;">
                ${this.escapeHtml(sa.department || 'N/A')}
              </span>
              <span style="background:rgba(14,165,233,0.1); color:var(--accent-cyan); font-weight:600; padding:3px 6px; border-radius:6px; font-size:0.72rem; margin-left:4px;">
                ${yearLabel}
              </span>
            </td>
            <td>${statusBadge}</td>
            <td>
              <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <button class="btn btn-outline btn-sm" onclick="Admin.openEditSubAdminModal(${sa.id}, '${this.escapeHtml(sa.name)}', '${this.escapeHtml(sa.email)}', '${this.escapeHtml(sa.department || '')}', '${this.escapeHtml(sa.assignedYear || 'ALL')}')">✏️ Edit</button>
                <button class="btn btn-outline btn-sm" onclick="Admin.toggleSubAdminStatus(${sa.id}, '${newStatus}')">${toggleText}</button>
                <button class="btn btn-secondary btn-sm" onclick="Admin.resetSubAdminPassword(${sa.id}, '${sa.registrationNumber}')">🔑 Reset Pass</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load sub-admins:', err);
    }
  },

  async handleCreateSubAdminSubmit(event) {
    event.preventDefault();
    const regNo = document.getElementById('sa-create-reg-no').value.trim().toUpperCase();
    const name = document.getElementById('sa-create-name').value.trim();
    const email = document.getElementById('sa-create-email').value.trim();
    const department = document.getElementById('sa-create-dept').value.trim().toUpperCase();
    const assignedYear = document.getElementById('sa-create-year').value;

    if (!regNo || !department) {
      App.showToast('Registration number and department are required.', 'danger');
      return;
    }

    try {
      const res = await API.request('/admin/subadmins/create', {
        method: 'POST',
        body: JSON.stringify({ registrationNumber: regNo, name, email, department, assignedYear })
      });

      App.closeModal('modal-create-subadmin');
      document.getElementById('form-create-subadmin').reset();
      App.showToast(`🛡️ Sub-Admin '${res.registrationNumber}' created for Dept ${res.department} (Year: ${assignedYear})! Temp pass: '123'.`, 'success');
      this.loadSubAdmins();
    } catch (err) {
      App.showToast(err.message || 'Failed to create sub-admin', 'danger');
    }
  },

  openEditSubAdminModal(id, name, email, department, assignedYear = 'ALL') {
    document.getElementById('sa-edit-id').value = id;
    document.getElementById('sa-edit-name').value = name;
    document.getElementById('sa-edit-email').value = email;
    document.getElementById('sa-edit-dept').value = department;
    const yearSelect = document.getElementById('sa-edit-year');
    if (yearSelect) yearSelect.value = assignedYear || 'ALL';
    App.openModal('modal-edit-subadmin');
  },

  async handleEditSubAdminSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('sa-edit-id').value;
    const name = document.getElementById('sa-edit-name').value.trim();
    const email = document.getElementById('sa-edit-email').value.trim();
    const department = document.getElementById('sa-edit-dept').value.trim().toUpperCase();
    const assignedYear = document.getElementById('sa-edit-year') ? document.getElementById('sa-edit-year').value : 'ALL';

    try {
      const res = await API.request(`/admin/subadmins/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, email, department, assignedYear })
      });

      App.closeModal('modal-edit-subadmin');
      App.showToast(res.message, 'success');
      this.loadSubAdmins();
    } catch (err) {
      App.showToast(err.message || 'Failed to update sub-admin', 'danger');
    }
  },

  async toggleSubAdminStatus(id, targetStatus) {
    try {
      const res = await API.request(`/admin/subadmins/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: targetStatus })
      });
      App.showToast(res.message, 'success');
      this.loadSubAdmins();
    } catch (err) {
      App.showToast(err.message || 'Status toggle failed', 'danger');
    }
  },

  async resetSubAdminPassword(id, regNo) {
    if (!confirm(`Reset password for Sub-Admin ${regNo} to '123'?`)) return;
    try {
      const res = await API.request(`/admin/subadmins/${id}/reset-password`, { method: 'POST' });
      App.showToast(res.message, 'success');
    } catch (err) {
      App.showToast(err.message || 'Password reset failed', 'danger');
    }
  },

  // =====================================================================
  // REPORTS
  // =====================================================================

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

  // =====================================================================
  // EVENTS
  // =====================================================================

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
    const typeSelect = document.getElementById('admin-edit-type');
    typeSelect.value = event.eventType || 'HACKATHON';
    if (!typeSelect.value || typeSelect.value !== (event.eventType || 'HACKATHON')) {
      typeSelect.value = 'HACKATHON';
    }
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
    const form = document.getElementById('form-admin-edit-event');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const done = App.submitGuard(submitBtn, '⏳ Saving...');
    if (!done) return;

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
    } catch (err) {
      done();
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
    } catch (err) {
      App.showToast(err.message || 'Failed to delete event', 'danger');
    }
  },

  async syncUnstopEvents() {
    try {
      App.showToast('⏳ Syncing live hackathons from Unstop...', 'info');
      const res = await API.request('/events/sync-unstop', { method: 'POST' });
      App.showToast(res.message || 'Successfully synced Unstop hackathons!', 'success');
      if (typeof Events !== 'undefined' && Events.loadHomeDashboard) Events.loadHomeDashboard();
      this.loadDashboard();
    } catch (err) {
      App.showToast(err.message || 'Failed to sync Unstop hackathons', 'danger');
    }
  },

  async clearUnstopEvents() {
    if (!confirm('Are you sure you want to remove all synced Unstop hackathons from the website database?')) {
      return;
    }
    try {
      const res = await API.request('/events/clear-unstop', { method: 'DELETE' });
      App.showToast(res.message || 'Cleared Unstop events', 'info');
      if (typeof Events !== 'undefined' && Events.loadHomeDashboard) Events.loadHomeDashboard();
      this.loadDashboard();
    } catch (err) {
      App.showToast(err.message || 'Failed to clear Unstop hackathons', 'danger');
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};
