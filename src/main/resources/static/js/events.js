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

  async loadDeadlineSoonEvents() {
    try {
      const events = await API.request('/events/deadline-soon');
      this.renderEventsGrid('deadline-soon-grid', events);
    } catch (err) {
      App.showToast('Failed to load deadline soon events', 'danger');
    }
  },

  async loadLatestEvents() {
    try {
      const events = await API.request('/events/latest');
      this.renderEventsGrid('latest-grid', events);
    } catch (err) {
      App.showToast('Failed to load latest events', 'danger');
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
      else if (App.currentView === 'latest') gridId = 'latest-grid';
      else if (App.currentView === 'ended') gridId = 'ended-grid';
      else if (App.currentView === 'deadline-soon') gridId = 'deadline-soon-grid';
      else if (App.currentView === 'saved') gridId = 'saved-grid';

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
    this.startGlobalCountdownTicker();
  },

  activeTimerInterval: null,

  parseDeadlineDate(deadlineStr) {
    if (!deadlineStr) return null;
    if (deadlineStr.includes('T')) {
      return new Date(deadlineStr);
    }
    const parts = deadlineStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day, 23, 59, 59);
    }
    return new Date(deadlineStr);
  },

  calculateCountdown(deadlineStr, createdAtStr = null) {
    if (!deadlineStr) return { closed: true, text: '🛑 Registration Closed', percentRemaining: 0 };

    const targetDate = this.parseDeadlineDate(deadlineStr);
    if (!targetDate || isNaN(targetDate.getTime())) {
      return { closed: true, text: '🛑 Registration Closed', percentRemaining: 0 };
    }

    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();

    if (diff <= 0) {
      return { closed: true, text: '🛑 Registration Closed', percentRemaining: 0 };
    }

    let percentRemaining = 100;
    if (createdAtStr) {
      const createdDate = new Date(createdAtStr);
      if (createdDate && !isNaN(createdDate.getTime())) {
        const totalDuration = targetDate.getTime() - createdDate.getTime();
        if (totalDuration > 0) {
          percentRemaining = Math.max(0, Math.min(100, (diff / totalDuration) * 100));
        }
      }
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    const pad = (n) => String(n).padStart(2, '0');

    let formatted = '';
    if (days > 0) {
      formatted = `⏳ ${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s remaining`;
    } else {
      formatted = `🔥 ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s left!`;
    }

    return { closed: false, text: formatted, days, hours, minutes, seconds, percentRemaining };
  },

  startGlobalCountdownTicker() {
    if (this.activeTimerInterval) {
      clearInterval(this.activeTimerInterval);
    }

    const updateAllTimers = () => {
      // 1. Card badge countdown tickers
      document.querySelectorAll('[data-deadline-timer]').forEach(elem => {
        const deadline = elem.getAttribute('data-deadline-timer');
        const createdAt = elem.getAttribute('data-created-at');
        const res = this.calculateCountdown(deadline, createdAt);
        
        const textElem = elem.querySelector('.timer-text') || elem;
        textElem.textContent = res.text;

        if (res.closed) {
          elem.style.background = 'rgba(100,116,139,0.15)';
          elem.style.color = 'var(--text-muted)';
          elem.style.borderColor = 'transparent';
        } else {
          elem.style.background = 'rgba(220, 38, 38, 0.08)';
          elem.style.color = 'var(--status-deadline)';
          elem.style.borderColor = 'rgba(220, 38, 38, 0.25)';
        }
      });

      // 2. Event details modal countdown banner & progress bar
      const modalTimerElem = document.getElementById('modal-details-countdown-timer');
      const modalBarElem = document.getElementById('modal-details-countdown-bar');
      if (modalTimerElem && modalTimerElem.hasAttribute('data-modal-deadline')) {
        const deadline = modalTimerElem.getAttribute('data-modal-deadline');
        const createdAt = modalTimerElem.getAttribute('data-modal-created-at');
        const res = this.calculateCountdown(deadline, createdAt);
        modalTimerElem.textContent = res.text;
        
        if (modalBarElem) {
          modalBarElem.style.width = `${res.percentRemaining}%`;
        }

        if (res.closed) {
          modalTimerElem.style.color = 'var(--status-danger)';
        } else {
          modalTimerElem.style.color = 'var(--accent-maroon)';
        }
      }
    };

    updateAllTimers();
    this.activeTimerInterval = setInterval(updateAllTimers, 1000);
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
    const isUnstop = (event.registrationLink && event.registrationLink.toLowerCase().includes('unstop.com')) || 
                     (event.skills && event.skills.toLowerCase().includes('unstop')) ||
                     (event.venue && event.venue.toLowerCase().includes('unstop'));

    return `
      <div class="event-card">
        <div class="poster-wrapper">
          ${posterSrc
            ? `<img src="${posterSrc}" alt="${this.escapeHtml(event.title)}" class="poster-img" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${gradientBg};gap:8px;\\'><span style=\\'font-size:2.5rem;\\'>${typeEmoji}</span><span style=\\'color:rgba(255,255,255,0.85);font-weight:700;font-size:0.85rem;letter-spacing:1px;text-transform:uppercase;\\'>${this.escapeHtml(event.eventType)}</span></div>'+document.querySelector('.status-badge-tmp')?.outerHTML">`
            : `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${gradientBg};gap:8px;"><span style="font-size:2.5rem;">${typeEmoji}</span><span style="color:rgba(255,255,255,0.85);font-weight:700;font-size:0.85rem;letter-spacing:1px;text-transform:uppercase;">${this.escapeHtml(event.eventType)}</span></div>`
          }
          <span class="status-badge ${statusBadgeClass}">${statusText}</span>
          ${isUnstop ? `<span class="mode-badge" style="background:#0284c7; right:85px;">🌐 Unstop</span>` : ''}
          <span class="mode-badge">${event.mode}</span>
        </div>
        <div class="event-card-body">
          <h3 class="event-title">${this.escapeHtml(event.title)}</h3>
          <p class="event-description">${this.escapeHtml(event.description)}</p>
          
          <div class="event-meta">
            <span class="meta-item">👥 Team: ${event.teamSizeMin}–${event.teamSizeMax}</span>
            <span class="meta-item">📅 ${event.startDate} to ${event.endDate}</span>
          </div>

          <div class="live-countdown-badge" data-deadline-timer="${event.registrationDeadline}" data-created-at="${event.createdAt || ''}">
            <span class="timer-text">⏳ Calculating countdown...</span>
          </div>

          ${skillsList ? `<div class="skills-tags" style="margin-top:8px;">${skillsList}</div>` : ''}
        </div>
        <div class="event-card-footer">
          <button class="btn ${saveBtnClass} btn-sm" onclick="Events.toggleSave(${event.id}, ${isSaved})">
            ${saveBtnText}
          </button>
          <button class="btn btn-secondary btn-sm" onclick="Teams.openFindTeamModal(${event.id}, '${this.escapeHtml(event.title)}')">
            🤝 Find Team
          </button>
          <button class="btn btn-outline btn-sm" onclick="Events.openShareModal(${event.id}, '${this.escapeHtml(event.title)}', '${event.registrationLink || ''}', '${event.registrationDeadline || ''}')">
            📤 Share
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
      } else if (App.currentView === 'latest') {
        this.loadLatestEvents();
      } else if (App.currentView === 'upcoming') {
        this.loadUpcomingEvents();
      } else if (App.currentView === 'deadline-soon') {
        this.loadDeadlineSoonEvents();
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
      
      const countdownTimer = document.getElementById('modal-details-countdown-timer');
      if (countdownTimer) {
        countdownTimer.setAttribute('data-modal-deadline', event.registrationDeadline);
        const res = this.calculateCountdown(event.registrationDeadline);
        countdownTimer.textContent = res.text;
      }

      const regLinkElem = document.getElementById('modal-details-reglink');
      const resCount = this.calculateCountdown(event.registrationDeadline);

      if (event.registrationLink) {
        regLinkElem.href = event.registrationLink;
        regLinkElem.style.display = 'inline-flex';
        if (resCount.closed) {
          regLinkElem.style.opacity = '0.5';
          regLinkElem.style.pointerEvents = 'none';
          regLinkElem.textContent = '🛑 Registration Closed';
        } else {
          regLinkElem.style.opacity = '1';
          regLinkElem.style.pointerEvents = 'auto';
          regLinkElem.textContent = '🔗 Apply / Register Now';
        }
      } else {
        regLinkElem.style.display = 'none';
      }

      document.getElementById('modal-details-findteam').onclick = () => {
        App.closeModal('modal-event-details');
        Teams.openFindTeamModal(event.id, event.title);
      };

      const shareBtn = document.getElementById('modal-details-share');
      if (shareBtn) {
        shareBtn.onclick = () => {
          this.openShareModal(event.id, event.title, event.registrationLink || '', event.registrationDeadline || '');
        };
      }

      document.getElementById('modal-details-report').onclick = () => {
        this.openReportModal(event.id, event.title);
      };

      App.openModal('modal-event-details');
      this.startGlobalCountdownTicker();
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
  },

  currentShareData: null,

  openShareModal(id, title, link, deadline) {
    this.currentShareData = { id, title, link, deadline };
    const titleEl = document.getElementById('share-modal-title');
    if (titleEl) titleEl.textContent = title;

    const nativeBtn = document.getElementById('share-btn-native');
    if (nativeBtn) {
      nativeBtn.style.display = (navigator.share) ? 'flex' : 'none';
    }

    App.openModal('modal-share-event');
  },

  execShare(type) {
    if (!this.currentShareData) return;
    const { title, link, deadline } = this.currentShareData;
    const eventUrl = link || window.location.href;
    const shareText = `🚀 Join me for "${title}" on HackHub!\n⏰ Registration Deadline: ${deadline || 'Closing Soon'}\n👉 Register here: ${eventUrl}`;

    if (type === 'whatsapp') {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
      window.open(waUrl, '_blank');
      App.closeModal('modal-share-event');
    } else if (type === 'copy') {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(eventUrl).then(() => {
          App.showToast('🔗 Hackathon link copied to clipboard!', 'success');
        }).catch(() => {
          this.fallbackCopy(eventUrl);
        });
      } else {
        this.fallbackCopy(eventUrl);
      }
      App.closeModal('modal-share-event');
    } else if (type === 'native') {
      if (navigator.share) {
        navigator.share({
          title: title,
          text: `Check out ${title} on HackHub!`,
          url: eventUrl
        }).catch(err => console.log('Share cancelled', err));
      }
      App.closeModal('modal-share-event');
    }
  },

  fallbackCopy(text) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    App.showToast('🔗 Hackathon link copied to clipboard!', 'success');
  }
};
