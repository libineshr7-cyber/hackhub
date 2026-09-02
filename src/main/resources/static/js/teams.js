/* ==========================================================================
   HackHub — Find Team & Skill Matching Controller
   ========================================================================== */

const Teams = {
  currentEventId: null,
  _allTeamsCache: [],

  async loadTeamsView() {
    this.loadAllTeams();
    this.loadIncomingRequests();
    this.populateEventDropdown();
  },

  async populateEventDropdown() {
    try {
      const events = await API.request('/events');
      const select = document.getElementById('form-create-team-event-id');
      if (!select || !events) return;
      select.innerHTML = '<option value="">-- Select Hackathon --</option>' +
        events.map(e => `<option value="${e.id}">${this.escapeHtml(e.title)}</option>`).join('');
    } catch (err) {
      console.warn('Could not load events for team creation', err);
    }
  },

  openCreateTeamModal() {
    this.populateEventDropdown();
    document.getElementById('team-name-input').value = '';
    document.getElementById('team-max-input').value = '4';
    App.openModal('modal-create-team');
  },

  async loadAllTeams() {
    const container = document.getElementById('all-teams-container');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);">Loading teams...</div>`;
    try {
      const teams = await API.request('/teams/all');
      this._allTeamsCache = teams || [];
      this._renderAllTeams(this._allTeamsCache);
    } catch (err) {
      container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);">Could not load teams. Try refreshing.</div>`;
    }
  },

  _renderAllTeams(teams) {
    const container = document.getElementById('all-teams-container');
    if (!container) return;
    if (!teams || teams.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);">No teams have been created yet. Be the first to create one!</div>`;
      return;
    }
    container.innerHTML = teams.map(t => this.createAllTeamCardHtml(t)).join('');
  },

  filterRenderedTeams() {
    const q = (document.getElementById('teams-filter-search')?.value || '').toLowerCase().trim();
    if (!q) { this._renderAllTeams(this._allTeamsCache); return; }
    const filtered = this._allTeamsCache.filter(t =>
      (t.teamName || '').toLowerCase().includes(q) ||
      (t.eventTitle || '').toLowerCase().includes(q) ||
      (t.creatorName || '').toLowerCase().includes(q)
    );
    this._renderAllTeams(filtered);
  },

  createAllTeamCardHtml(team) {
    const isFull = team.currentMemberCount >= team.maxMembers;
    const slots = team.maxMembers - team.currentMemberCount;
    const matchBadge = team.skillMatchScore != null
      ? `<span style="font-size:0.75rem;background:var(--accent-maroon-tint,#3a0000);color:var(--accent-maroon);padding:3px 8px;border-radius:12px;font-weight:700;">🎯 ${team.skillMatchScore}% match</span>`
      : '';

    let actionBtn = '';
    if (team.isUserMember) {
      actionBtn = `<span style="font-size:0.8rem;color:var(--status-upcoming,#22c55e);font-weight:700;">✓ You are in this team</span>`;
    } else if (team.hasUserRequested) {
      actionBtn = `<span style="font-size:0.8rem;color:var(--status-deadline,#f59e0b);font-weight:700;">⏳ Request Pending</span>`;
    } else if (isFull) {
      actionBtn = `<span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">🔒 Team Full</span>`;
    } else {
      actionBtn = `<button class="btn btn-primary btn-sm" onclick="Teams.handleJoinRequestFromFeed(${team.id})">Request to Join</button>`;
    }

    const memberSkills = [...new Set((team.members || []).flatMap(m => (m.skills || '').split(',').map(s => s.trim()).filter(Boolean)))].join(', ');
    const memberNames = (team.members || []).map(m => `<span style="font-size:0.75rem;background:var(--bg-dark);padding:2px 7px;border-radius:8px;border:1px solid var(--border-color);">${this.escapeHtml(m.name)}</span>`).join(' ');

    // Delete button for own teams
    const user = API.getUser();
    const regNo = user?.registrationNumber || '';
    const deleteBtn = (regNo && team.creatorRegistrationNumber === regNo)
      ? `<button class="btn btn-danger btn-sm" onclick="Teams.deleteMyTeam(${team.id},'${this.escapeHtml(team.teamName)}')" style="margin-left:8px;">🗑 Delete</button>`
      : '';

    return `
      <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-size:1rem;font-weight:700;color:var(--text-main);">🏷 ${this.escapeHtml(team.teamName)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">📌 ${this.escapeHtml(team.eventTitle)} &nbsp;|&nbsp; 👑 ${this.escapeHtml(team.creatorName)} (${this.escapeHtml(team.creatorRegistrationNumber)})</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${matchBadge}
            <span style="font-size:0.82rem;font-weight:700;padding:4px 10px;border-radius:12px;background:${isFull ? 'var(--bg-dark)' : 'rgba(34,197,94,0.12)'};color:${isFull ? 'var(--text-muted)' : 'var(--status-upcoming,#22c55e)'};">
              ${team.currentMemberCount}/${team.maxMembers} ${isFull ? '(Full)' : `(${slots} open)`}
            </span>
          </div>
        </div>
        ${memberNames ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px;">${memberNames}</div>` : ''}
        ${memberSkills ? `<div style="margin-top:6px;font-size:0.75rem;color:var(--accent-cyan,#22d3ee);">🔧 Skills: ${this.escapeHtml(memberSkills)}</div>` : ''}
        <div style="margin-top:10px;display:flex;justify-content:flex-end;align-items:center;gap:8px;">
          ${actionBtn}${deleteBtn}
        </div>
      </div>`;
  },

  async handleJoinRequestFromFeed(teamId) {
    try {
      const res = await API.request('/teams/request', { method: 'POST', body: JSON.stringify({ teamId }) });
      App.showToast(res.message, 'success');
      this.loadAllTeams();
    } catch (err) {
      App.showToast(err.message || 'Join request failed', 'danger');
    }
  },

  async deleteMyTeam(teamId, teamName) {
    if (!confirm(`Delete team "${teamName}"? This cannot be undone.`)) return;
    try {
      const res = await API.request(`/teams/${teamId}`, { method: 'DELETE' });
      App.showToast(res.message, 'success');
      this.loadAllTeams();
    } catch (err) {
      App.showToast(err.message || 'Delete failed', 'danger');
    }
  },

  async openFindTeamModal(eventId, eventTitle) {
    this.currentEventId = eventId;
    document.getElementById('findteam-event-title').textContent = eventTitle;
    document.getElementById('form-create-team-event-id').value = eventId;

    await this.fetchAndRenderTeams(eventId);
    App.openModal('modal-find-team');
  },

  async fetchAndRenderTeams(eventId) {
    try {
      const teams = await API.request(`/teams/event/${eventId}`);
      const container = document.getElementById('findteam-teams-container');

      if (!teams || teams.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding: 24px; color: var(--text-muted);">
            <p>No teams formed yet for this hackathon.</p>
            <p style="font-size:0.85rem; margin-top:4px;">Be the first to create a team!</p>
          </div>`;
        return;
      }

      container.innerHTML = teams.map(team => this.createTeamCardHtml(team)).join('');
    } catch (err) {
      App.showToast('Failed to load teams for event', 'danger');
    }
  },

  createTeamCardHtml(team) {
    const isFull = team.currentMemberCount >= team.maxMembers;

    const membersListHtml = team.members.map(m => `
      <div style="font-size: 0.8rem; background: var(--bg-dark); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
        <span>👤 <strong>${this.escapeHtml(m.registrationNumber)}</strong> (${this.escapeHtml(m.name)})</span>
        <span style="font-size: 0.72rem; color: var(--accent-maroon); font-weight:600;">${m.skills || 'No skills listed'}</span>
      </div>
    `).join('');

    let actionBtnHtml = '';
    if (team.isUserMember) {
      actionBtnHtml = `<span style="font-size:0.8rem; color: var(--status-upcoming); font-weight:700;">✓ You are in this team</span>`;
    } else if (team.hasUserRequested) {
      actionBtnHtml = `<span style="font-size:0.8rem; color: var(--status-deadline); font-weight:700;">⏳ Request Pending</span>`;
    } else if (isFull) {
      actionBtnHtml = `<span style="font-size:0.8rem; color: var(--text-muted); font-weight:600;">Team Full</span>`;
    } else {
      actionBtnHtml = `
        <button class="btn btn-primary btn-sm" onclick="Teams.handleJoinRequest(${team.id})">
          Request to Join
        </button>`;
    }

    let inviteFormHtml = '';
    if (team.isUserMember && !isFull) {
      inviteFormHtml = `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border-color);">
          <!-- Broadcast / Invite Mode Selector -->
          <div style="margin-bottom: 10px;">
            <label style="font-size:0.8rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:6px;">📤 Send Team Invitation To:</label>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-outline btn-sm team-invite-mode-btn active" 
                data-mode="person" data-teamid="${team.id}"
                onclick="Teams.selectInviteMode(${team.id}, 'person', this)" 
                style="font-size:0.75rem; padding:4px 10px;">
                👤 Specific Person
              </button>
              <button class="btn btn-outline btn-sm team-invite-mode-btn" 
                data-mode="class" data-teamid="${team.id}"
                onclick="Teams.selectInviteMode(${team.id}, 'class', this)" 
                style="font-size:0.75rem; padding:4px 10px;">
                🎓 Whole Class
              </button>
              <button class="btn btn-outline btn-sm team-invite-mode-btn" 
                data-mode="department" data-teamid="${team.id}"
                onclick="Teams.selectInviteMode(${team.id}, 'department', this)" 
                style="font-size:0.75rem; padding:4px 10px;">
                🏢 Whole Department
              </button>
            </div>
          </div>

          <!-- Person Invite Panel -->
          <div id="invite-panel-person-${team.id}" style="display:flex; gap:8px;">
            <input type="text" id="invite-input-${team.id}" class="form-input" 
              placeholder="Enter Name or Reg No (e.g. CS2005, CS3012)" 
              style="font-size: 0.8rem; padding: 6px 10px;">
            <button class="btn btn-primary btn-sm" onclick="Teams.handleInviteTeammate(${team.id})">➕ Send</button>
          </div>

          <!-- Class Broadcast Panel -->
          <div id="invite-panel-class-${team.id}" style="display:none; gap:8px;">
            <select id="invite-class-${team.id}" class="form-select" style="font-size:0.8rem; padding:6px 10px;">
              <option value="CS2">CS 2nd Year (CS2001–CS2049)</option>
              <option value="CS3">CS 3rd Year (CS3001–CS3048)</option>
              <option value="IT2">IT 2nd Year (IT2xxx)</option>
              <option value="IT3">IT 3rd Year (IT3xxx)</option>
              <option value="ECE2">ECE 2nd Year</option>
              <option value="ECE3">ECE 3rd Year</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="Teams.handleBroadcastClass(${team.id})" style="white-space:nowrap;">
              📢 Broadcast to Class
            </button>
          </div>

          <!-- Department Broadcast Panel -->
          <div id="invite-panel-department-${team.id}" style="display:none; gap:8px;">
            <select id="invite-dept-${team.id}" class="form-select" style="font-size:0.8rem; padding:6px 10px;">
              <option value="CS">CS Department</option>
              <option value="IT">IT Department</option>
              <option value="ECE">ECE Department</option>
              <option value="MECH">MECH Department</option>
              <option value="EEE">EEE Department</option>
            </select>
            <button class="btn btn-primary btn-sm" onclick="Teams.handleBroadcastDepartment(${team.id})" style="white-space:nowrap;">
              📢 Broadcast to Dept
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <h4 style="font-size: 1rem; color: var(--text-main); font-weight: 700;">${this.escapeHtml(team.teamName)}</h4>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Leader: <strong>${this.escapeHtml(team.creatorName)}</strong> (${team.creatorRegistrationNumber})</span>
          </div>
          <div style="text-align: right;">
            <span style="background: var(--accent-maroon-tint); color: var(--accent-maroon); font-size: 0.75rem; font-weight: 700; padding: 4px 8px; border-radius: 12px; border: 1px solid rgba(128,0,32,0.2);">
              ⚡ ${team.skillMatchScore}% Match
            </span>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              Members: ${team.currentMemberCount} / ${team.maxMembers}
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px; margin: 10px 0;">
          ${membersListHtml}
        </div>

        <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 8px;">
          ${actionBtnHtml}
        </div>
        ${inviteFormHtml}
      </div>
    `;
  },

  selectInviteMode(teamId, mode, clickedBtn) {
    // Update active button styling
    document.querySelectorAll(`.team-invite-mode-btn[data-teamid="${teamId}"]`).forEach(btn => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline');
    });
    clickedBtn.classList.add('btn-primary');
    clickedBtn.classList.remove('btn-outline');

    // Show/hide panels
    const panels = ['person', 'class', 'department'];
    panels.forEach(p => {
      const el = document.getElementById(`invite-panel-${p}-${teamId}`);
      if (el) el.style.display = (p === mode) ? 'flex' : 'none';
    });
  },

  async handleInviteTeammate(teamId) {
    const input = document.getElementById(`invite-input-${teamId}`);
    const regNoOrName = input ? input.value.trim() : '';

    if (!regNoOrName) {
      App.showToast('Please enter a student Name or Registration Number (e.g. CS2005).', 'danger');
      return;
    }

    try {
      const res = await API.request('/teams/invite', {
        method: 'POST',
        body: JSON.stringify({ teamId, regNoOrName })
      });

      App.showToast(res.message, 'success');
      if (input) input.value = '';
      if (this.currentEventId) {
        this.fetchAndRenderTeams(this.currentEventId);
      }
    } catch (err) {
      App.showToast(err.message || 'Invitation failed', 'danger');
    }
  },

  async handleBroadcastClass(teamId) {
    const select = document.getElementById(`invite-class-${teamId}`);
    const classPrefix = select ? select.value : '';

    if (!classPrefix) {
      App.showToast('Please select a class.', 'danger');
      return;
    }

    if (!confirm(`Send team invitation to ALL students in class "${classPrefix}"? This will notify them all.`)) return;

    try {
      const res = await API.request('/teams/broadcast', {
        method: 'POST',
        body: JSON.stringify({ teamId, filterType: 'class', filterValue: classPrefix })
      });

      App.showToast(res.message, 'success');
      if (this.currentEventId) this.fetchAndRenderTeams(this.currentEventId);
    } catch (err) {
      App.showToast(err.message || 'Broadcast failed', 'danger');
    }
  },

  async handleBroadcastDepartment(teamId) {
    const select = document.getElementById(`invite-dept-${teamId}`);
    const dept = select ? select.value : '';

    if (!dept) {
      App.showToast('Please select a department.', 'danger');
      return;
    }

    if (!confirm(`Send team invitation to ALL students in ${dept} Department? This will notify them all.`)) return;

    try {
      const res = await API.request('/teams/broadcast', {
        method: 'POST',
        body: JSON.stringify({ teamId, filterType: 'department', filterValue: dept })
      });

      App.showToast(res.message, 'success');
      if (this.currentEventId) this.fetchAndRenderTeams(this.currentEventId);
    } catch (err) {
      App.showToast(err.message || 'Broadcast failed', 'danger');
    }
  },

  async handleCreateTeam(event) {
    event.preventDefault();
    const eventId = document.getElementById('form-create-team-event-id').value;
    const teamName = document.getElementById('team-name-input').value.trim();
    const maxMembers = parseInt(document.getElementById('team-max-input').value) || 4;

    if (!eventId) { App.showToast('Please select a hackathon/event.', 'danger'); return; }

    try {
      await API.request('/teams', {
        method: 'POST',
        body: JSON.stringify({ eventId: parseInt(eventId), teamName, maxMembers })
      });

      App.closeModal('modal-create-team');
      document.getElementById('team-name-input').value = '';
      App.showToast('🎉 Team created successfully! You are the team leader.', 'success');
      this.loadAllTeams();
      if (this.currentEventId) this.fetchAndRenderTeams(this.currentEventId);
    } catch (err) {
      App.showToast(err.message || 'Failed to create team', 'danger');
    }
  },

  async handleJoinRequest(teamId) {
    try {
      const res = await API.request('/teams/request', {
        method: 'POST',
        body: JSON.stringify({ teamId })
      });

      App.showToast(res.message, 'success');
      if (this.currentEventId) {
        this.fetchAndRenderTeams(this.currentEventId);
      }
    } catch (err) {
      App.showToast(err.message || 'Join request failed', 'danger');
    }
  },

  async loadIncomingRequests() {
    const section = document.getElementById('incoming-requests-section');
    const container = document.getElementById('incoming-requests-list');
    if (!container) return;

    try {
      const requests = await API.request('/teams/requests/incoming');
      if (!requests || requests.length === 0) {
        if (section) section.style.display = 'none';
        container.innerHTML = '';
        return;
      }
      if (section) section.style.display = 'block';

      container.innerHTML = requests.map(req => `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 0.95rem;">${this.escapeHtml(req.requesterName)} (${req.requesterRegistrationNumber})</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Requesting for team: <strong>${this.escapeHtml(req.teamName)}</strong> (${this.escapeHtml(req.eventTitle)})</div>
            <div style="font-size: 0.75rem; color: var(--accent-cyan); margin-top: 2px;">Skills: ${this.escapeHtml(req.requesterSkills || 'None')}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm" onclick="Teams.respondToRequest(${req.id}, 'ACCEPTED')">Accept</button>
            <button class="btn btn-danger btn-sm" onclick="Teams.respondToRequest(${req.id}, 'REJECTED')">Reject</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async respondToRequest(requestId, status) {
    try {
      const res = await API.request(`/teams/request/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });

      App.showToast(res.message, 'success');
      this.loadIncomingRequests();
      if (this.currentEventId) {
        this.fetchAndRenderTeams(this.currentEventId);
      }
    } catch (err) {
      App.showToast(err.message || 'Response failed', 'danger');
    }
  },

  async handleSearchStudentInput() {
    const input = document.getElementById('teams-student-search-input');
    const container = document.getElementById('teams-student-search-results');
    if (!input || !container) return;

    const query = input.value.trim();
    if (!query) {
      container.innerHTML = '';
      return;
    }

    try {
      const students = await API.request(`/teams/search-students?query=${encodeURIComponent(query)}`);
      if (!students || students.length === 0) {
        container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); padding: 8px;">No students found matching "${this.escapeHtml(query)}". Try e.g. CS2001, CS3027.</div>`;
        return;
      }

      container.innerHTML = students.map(s => `
        <div style="background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">🎓 ${this.escapeHtml(s.name)} (<span style="color: var(--accent-maroon);">${this.escapeHtml(s.registrationNumber)}</span>)</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">Skills: ${this.escapeHtml(s.skills || 'None listed')} ${s.department ? '• Dept: <strong>' + this.escapeHtml(s.department) + '</strong>' : ''}</div>
          </div>
          <div>
            <span style="font-size: 0.75rem; background: var(--accent-maroon-tint); color: var(--accent-maroon); font-weight: 700; padding: 4px 8px; border-radius: 6px;">Available Teammate</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};
