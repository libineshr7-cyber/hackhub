/* ==========================================================================
   HackHub — Interactive Responsive Calendar Component
   ========================================================================== */

const Calendar = {
  currentDate: new Date(),

  async renderCalendar() {
    const calendarGrid = document.getElementById('calendar-days-grid');
    const monthYearLabel = document.getElementById('calendar-month-year');
    if (!calendarGrid || !monthYearLabel) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthYearLabel.textContent = `${monthNames[month]} ${year}`;

    // Show loading state
    calendarGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:20px;">Loading calendar...</div>`;

    try {
      const events = await API.request('/events/calendar');

      const firstDayIndex = new Date(year, month, 1).getDay();
      const totalDays = new Date(year, month + 1, 0).getDate();

      let gridHtml = '';

      // Blank slots before start of month
      for (let i = 0; i < firstDayIndex; i++) {
        gridHtml += `<div class="calendar-day" style="opacity:0.15; background:transparent; border:none;"></div>`;
      }

      const todayStr = new Date().toISOString().split('T')[0];

      // Days of the month
      for (let day = 1; day <= totalDays; day++) {
        const dayFormatted = String(day).padStart(2, '0');
        const monthFormatted = String(month + 1).padStart(2, '0');
        const dateStr = `${year}-${monthFormatted}-${dayFormatted}`;

        const isToday = dateStr === todayStr;
        const todayClass = isToday ? 'today' : '';

        // Show event ONCE on its START date (green badge)
        const startEvents = events.filter(e => e.startDate === dateStr);

        // Show deadline ONCE on its deadline date (orange), skip if same as startDate to avoid duplicates
        const deadlineEvents = events.filter(e =>
          e.registrationDeadline === dateStr && e.startDate !== dateStr
        );

        let badgesHtml = '';

        startEvents.forEach(e => {
          badgesHtml += `
            <div class="cal-event-dot cal-event-start" onclick="Events.openEventDetailsModal(${e.id})" title="Starts: ${Events.escapeHtml(e.title)}">
              🚀 ${Events.escapeHtml(e.title)}
            </div>`;
        });

        deadlineEvents.forEach(e => {
          badgesHtml += `
            <div class="cal-event-dot cal-event-deadline" onclick="Events.openEventDetailsModal(${e.id})" title="Deadline: ${Events.escapeHtml(e.title)}">
              ⏰ ${Events.escapeHtml(e.title)}
            </div>`;
        });

        gridHtml += `
          <div class="calendar-day ${todayClass}">
            <span class="day-number">${day}</span>
            <div style="display:flex; flex-direction:column; gap:2px; margin-top:2px;">
              ${badgesHtml}
            </div>
          </div>`;
      }

      calendarGrid.innerHTML = gridHtml;

    } catch (err) {
      console.error('Failed to render calendar:', err);
      calendarGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--status-danger); padding:20px;">Failed to load calendar. Please try again.</div>`;
    }
  },

  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.renderCalendar();
  },

  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.renderCalendar();
  }
};
