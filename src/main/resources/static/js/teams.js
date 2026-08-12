/* ==========================================================================
   HackHub — Find Team & Skill Matching Controller
   ========================================================================== */

const Teams = {
  currentEventId: null,

  async loadTeamsView() {
    this.loadIncomingRequests();
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
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-color); display: flex; gap: 8px;">
          <input type="text" id="invite-input-${team.id}" class="form-input" placeholder="Enter Name or Reg No (e.g. CS005, CS012)" style="font-size: 0.8rem; padding: 6px 10px;">
          <button class="btn btn-primary btn-sm" onclick="Teams.handleInviteTeammate(${team.id})">➕ Send Request</button>
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

  async handleInviteTeammate(teamId) {
    const input = document.getElementById(`invite-input-${teamId}`);
    const regNoOrName = input ? input.value.trim() : '';

    if (!regNoOrName) {
      App.showToast('Please enter a student Name or Registration Number (e.g. CS005).', 'danger');
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

  async handleCreateTeam(event) {
    event.preventDefault();
    const eventId = document.getElementById('form-create-team-event-id').value;
    const teamName = document.getElementById('team-name-input').value.trim();
    const maxMembers = parseInt(document.getElementById('team-max-input').value) || 4;

    try {
      await API.request('/teams', {
        method: 'POST',
        body: JSON.stringify({ eventId, teamName, maxMembers })
      });

      App.closeModal('modal-create-team');
      document.getElementById('team-name-input').value = '';
      App.showToast('🎉 Team created successfully! You are the team leader.', 'success');
      this.fetchAndRenderTeams(eventId);
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
    const container = document.getElementById('incoming-requests-list');
    if (!container) return;

    try {
      const requests = await API.request('/teams/requests/incoming');
      if (!requests || requests.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">No pending join requests for your teams.</p>`;
        return;
      }

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
        container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); padding: 8px;">No students found matching "${this.escapeHtml(query)}". Try e.g. CS001, CS027.</div>`;
        return;
      }

      container.innerHTML = students.map(s => `
        <div style="background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">🎓 ${this.escapeHtml(s.name)} (<span style="color: var(--accent-maroon);">${this.escapeHtml(s.registrationNumber)}</span>)</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">Skills: ${this.escapeHtml(s.skills || 'None listed')}</div>
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
