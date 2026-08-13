/* ==========================================================================
   HackHub — Events Controller & Renderer
   ========================================================================== */

const Events = {
  activeSearchQuery: '',
  activeTypeFilter: 'ALL',
  activeModeFilter: 'ALL',

  async loadHomeDashboard() {
    try {
      const upcoming = await API.request('/events/upcoming');
      const deadlineSoon = await API.request('/events/deadline-soon');

      this.renderEventsGrid('home-upcoming-grid', upcoming);
      this.renderEventsGrid('home-deadline-grid', deadlineSoon);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  },

  scrollToHomeEvents() {
    const sec = document.getElementById('home-events-section');
    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
  },

  showAllEvents() {
    this.scrollToHomeEvents();
  },

  async loadUpcomingEvents() {
    try {
      const events = await API.request('/events/upcoming');
      this.renderEventsGrid('upcoming-grid', events);
    } catch (err) {
      App.showToast('Failed to load upcoming events', 'danger');
    }
  },

  async loadEndedEvents() {
    try {
      const events = await API.request('/events/ended');
      this.renderEventsGrid('ended-grid', events);
    } catch (err) {
      App.showToast('Failed to load ended events', 'danger');
    }
  },

  async loadSavedEvents() {
    try {
      const events = await API.request('/saved-events');
      this.renderEventsGrid('saved-grid', events);
    } catch (err) {
      App.showToast('Failed to load saved events', 'danger');
    }
  },

  async handleSearchFilter() {
    const query = document.getElementById('search-input')?.value || '';
    const eventType = document.getElementById('filter-type-select')?.value || 'ALL';
    const mode = document.getElementById('filter-mode-select')?.value || 'ALL';

    try {
      const events = await API.request(`/events/search?query=${encodeURIComponent(query)}&eventType=${eventType}&mode=${mode}`);
      let gridId = 'upcoming-grid';
      if (App.currentView === 'home') gridId = 'home-upcoming-grid';
      else if (App.currentView === 'ended') gridId = 'ended-grid';

      this.renderEventsGrid(gridId, events);
    } catch (err) {
      console.error(err);
    }
  },

  renderEventsGrid(containerId, events) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!events || events.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          <p style="font-size: 1.1rem; font-weight: 600;">No events found</p>
          <p style="font-size: 0.85rem; margin-top: 4px;">Check back later or adjust your search filters.</p>
        </div>`;
      return;
    }

    container.innerHTML = events.map(event => this.createEventCardHtml(event)).join('');
  },

  createEventCardHtml(event) {
    const posterSrc = event.posterPath || '';
    // Event-type specific gradient colors and emojis for placeholder
    const typeColors = {
      'HACKATHON':   'linear-gradient(135deg,#800020,#9e1b32)',
      'WORKSHOP':    'linear-gradient(135deg,#1e40af,#3b82f6)',
      'COMPETITION': 'linear-gradient(135deg,#065f46,#059669)',
      'CTF':         'linear-gradient(135deg,#4c1d95,#7c3aed)',
      'OTHER':       'linear-gradient(135deg,#374151,#6b7280)'
    };
    const typeEmojis = { 'HACKATHON':'💻', 'WORKSHOP':'🔧', 'COMPETITION':'🏆', 'CTF':'🛡️', 'OTHER':'📌' };
    const gradientBg = typeColors[event.eventType] || typeColors['OTHER'];
    const typeEmoji  = typeEmojis[event.eventType] || '📌';

    
    let statusBadgeClass = 'badge-upcoming';
    let statusText = 'UPCOMING';
    if (event.status === 'ENDED') {
      statusBadgeClass = 'badge-ended';
      statusText = 'ENDED';
    } else if (event.status === 'DEADLINE_SOON') {
      statusBadgeClass = 'badge-deadline';
      statusText = `⏰ DEADLINE: ${event.daysToDeadline} DAYS`;
    }

    const skillsList = event.skills ? event.skills.split(',').map(s => `<span class="skill-tag">${s.trim()}</span>`).join('') : '';

    const isSaved = event.saved;
    const saveBtnText = isSaved ? '🔖 Saved' : '🔖 Save';
    const saveBtnClass = isSaved ? 'btn-secondary' : 'btn-outline';

    return `
      <div class="event-card">
        <div class="poster-wrapper">
          ${posterSrc
            ? `<img src="${posterSrc}" alt="${this.escapeHtml(event.title)}" class="poster-img" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${gradientBg};gap:8px;\\'><span style=\\'font-size:2.5rem;\\'>${typeEmoji}</span><span style=\\'color:rgba(255,255,255,0.85);font-weight:700;font-size:0.85rem;letter-spacing:1px;text-transform:uppercase;\\'>${this.escapeHtml(event.eventType)}</span></div>'+document.querySelector('.status-badge-tmp')?.outerHTML">`
            : `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${gradientBg};gap:8px;"><span style="font-size:2.5rem;">${typeEmoji}</span><span style="color:rgba(255,255,255,0.85);font-weight:700;font-size:0.85rem;letter-spacing:1px;text-transform:uppercase;">${this.escapeHtml(event.eventType)}</span></div>`
          }
          <span class="status-badge ${statusBadgeClass}">${statusText}</span>
          <span class="mode-badge">${event.mode}</span>
        </div>
        <div class="event-card-body">
          <h3 class="event-title">${this.escapeHtml(event.title)}</h3>
          <p class="event-description">${this.escapeHtml(event.description)}</p>
          
          <div class="event-meta">
            <span class="meta-item">👥 Team: ${event.teamSizeMin}–${event.teamSizeMax}</span>
            <span class="meta-item">📅 ${event.startDate} to ${event.endDate}</span>
          </div>

          ${skillsList ? `<div class="skills-tags">${skillsList}</div>` : ''}
        </div>
        <div class="event-card-footer">
          <button class="btn ${saveBtnClass} btn-sm" onclick="Events.toggleSave(${event.id}, ${isSaved})">
            ${saveBtnText}
          </button>
          <button class="btn btn-secondary btn-sm" onclick="Teams.openFindTeamModal(${event.id}, '${this.escapeHtml(event.title)}')">
            🤝 Find Team
          </button>
          <button class="btn btn-primary btn-sm" onclick="Events.openEventDetailsModal(${event.id})">
            Details
          </button>
        </div>
      </div>
    `;
  },

  async toggleSave(eventId, currentIsSaved) {
    try {
      if (currentIsSaved) {
        await API.request(`/events/${eventId}/save`, { method: 'DELETE' });
        App.showToast('Event removed from saved list', 'info');
      } else {
        await API.request(`/events/${eventId}/save`, { method: 'POST' });
        App.showToast('Event saved successfully!', 'success');
      }

      if (App.currentView === 'saved') {
        this.loadSavedEvents();
      } else if (App.currentView === 'upcoming') {
        this.loadUpcomingEvents();
      } else {
        this.loadHomeDashboard();
      }
    } catch (err) {
      App.showToast(err.message || 'Failed to update saved event', 'danger');
    }
  },

  async handlePostEventSubmit(event) {
    event.preventDefault();
    const form = document.getElementById('form-post-event');
    const submitBtn = form.querySelector('button[type="submit"]');
    const done = App.submitGuard(submitBtn, '⏳ Publishing...');
    if (!done) return; // Already submitting

    const formData = new FormData(form);

    const eventJsonObj = {
      title: formData.get('title'),
      description: formData.get('description'),
      eventType: formData.get('eventType'),
      teamSizeMin: parseInt(formData.get('teamSizeMin')) || 1,
      teamSizeMax: parseInt(formData.get('teamSizeMax')) || 4,
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      registrationDeadline: formData.get('registrationDeadline'),
      mode: formData.get('mode'),
      venue: formData.get('venue'),
      registrationLink: formData.get('registrationLink'),
      skills: formData.get('skills')
    };

    const multipart = new FormData();
    multipart.append('event', JSON.stringify(eventJsonObj));

    const fileInput = document.getElementById('post-poster-file');
    if (fileInput && fileInput.files[0]) {
      multipart.append('poster', fileInput.files[0]);
    }

    try {
      await API.request('/events', {
        method: 'POST',
        body: multipart
      });

      App.closeModal('modal-post-event');
      form.reset();
      App.showToast('🎉 Hackathon event published immediately!', 'success');
      App.navigateTo('upcoming');
      // Button stays disabled since modal is closed; it resets on next open
    } catch (err) {
      done(); // Re-enable on error so user can retry
      App.showToast(err.message || 'Failed to post event', 'danger');
    }
  },

  async openEventDetailsModal(eventId) {
    try {
      const event = await API.request(`/events/${eventId}`);
      const posterSrc = event.posterPath || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80';

      document.getElementById('modal-details-title').textContent = event.title;
      document.getElementById('modal-details-poster').src = posterSrc;
      document.getElementById('modal-details-description').textContent = event.description;
      document.getElementById('modal-details-type').textContent = event.eventType;
      document.getElementById('modal-details-mode').textContent = event.mode;
      document.getElementById('modal-details-venue').textContent = event.venue || 'N/A';
      document.getElementById('modal-details-team').textContent = `${event.teamSizeMin} – ${event.teamSizeMax} Members`;
      document.getElementById('modal-details-dates').textContent = `${event.startDate} to ${event.endDate}`;
      document.getElementById('modal-details-deadline').textContent = `${event.registrationDeadline} (${event.daysToDeadline} days left)`;
      
      const regLinkElem = document.getElementById('modal-details-reglink');
      if (event.registrationLink) {
        regLinkElem.href = event.registrationLink;
        regLinkElem.style.display = 'inline-flex';
      } else {
        regLinkElem.style.display = 'none';
      }

      document.getElementById('modal-details-findteam').onclick = () => {
        App.closeModal('modal-event-details');
        Teams.openFindTeamModal(event.id, event.title);
      };

      document.getElementById('modal-details-report').onclick = () => {
        this.openReportModal(event.id, event.title);
      };

      App.openModal('modal-event-details');
    } catch (err) {
      App.showToast('Failed to load event details', 'danger');
    }
  },

  openReportModal(eventId, title) {
    document.getElementById('report-event-id').value = eventId;
    document.getElementById('report-event-title').textContent = title;
    App.openModal('modal-report-event');
  },

  async handleReportSubmit(event) {
    event.preventDefault();
    const eventId = document.getElementById('report-event-id').value;
    const reason = document.getElementById('report-reason').value;
    const description = document.getElementById('report-description').value;

    try {
      const res = await API.request(`/events/${eventId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason, description })
      });

      App.closeModal('modal-report-event');
      App.showToast(res.message, 'success');
    } catch (err) {
      App.showToast(err.message || 'Report submission failed', 'danger');
    }
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
};
