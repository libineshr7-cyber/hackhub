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
    const isCreator = team.userMember && team.creatorRegistrationNumber === API.getUser()?.registrationNumber;

    const membersListHtml = team.members.map(m => `
      <div style="font-size: 0.8rem; background: var(--bg-dark); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
        <span>👤 <strong>${this.escapeHtml(m.registrationNumber)}</strong> (${this.escapeHtml(m.name)})</span>
        <span style="font-size: 0.72rem; color: var(--accent-cyan);">${m.skills || 'No skills listed'}</span>
      </div>
    `).join('');

    let actionBtnHtml = '';
    if (team.isUserMember) {
      actionBtnHtml = `<span style="font-size:0.8rem; color: var(--status-upcoming); font-weight:600;">✓ You are in this team</span>`;
    } else if (team.hasUserRequested) {
      actionBtnHtml = `<span style="font-size:0.8rem; color: var(--status-deadline); font-weight:600;">⏳ Request Pending</span>`;
    } else if (isFull) {
      actionBtnHtml = `<span style="font-size:0.8rem; color: var(--text-muted); font-weight:600;">Team Full</span>`;
    } else {
      actionBtnHtml = `
        <button class="btn btn-primary btn-sm" onclick="Teams.handleJoinRequest(${team.id})">
          Request to Join
        </button>`;
    }

    return `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <h4 style="font-size: 1rem; color: var(--text-main); font-weight: 700;">${this.escapeHtml(team.teamName)}</h4>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Leader: ${this.escapeHtml(team.creatorName)} (${team.creatorRegistrationNumber})</span>
          </div>
          <div style="text-align: right;">
            <span style="background: rgba(6,182,212,0.15); color: var(--accent-cyan); font-size: 0.75rem; font-weight: 700; padding: 4px 8px; border-radius: 12px;">
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
      </div>
    `;
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

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};
