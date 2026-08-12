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

    try {
      const events = await API.request('/events/calendar');
      
      const firstDayIndex = new Date(year, month, 1).getDay();
      const totalDays = new Date(year, month + 1, 0).getDate();

      let gridHtml = '';

      // Blank slots before start of month
      for (let i = 0; i < firstDayIndex; i++) {
        gridHtml += `<div class="calendar-day" style="opacity: 0.2; background: transparent; border: none;"></div>`;
      }

      const todayStr = new Date().toISOString().split('T')[0];

      // Days of the month
      for (let day = 1; day <= totalDays; day++) {
        const dayFormatted = String(day).padStart(2, '0');
        const monthFormatted = String(month + 1).padStart(2, '0');
        const dateStr = `${year}-${monthFormatted}-${dayFormatted}`;

        const isToday = dateStr === todayStr;
        const todayClass = isToday ? 'today' : '';

        // Match events occurring or having registration deadlines on this day
        const dayEvents = events.filter(e => e.startDate === dateStr || e.endDate === dateStr || e.registrationDeadline === dateStr);

        let eventBadgesHtml = dayEvents.map(e => `
          <div class="cal-event-dot" onclick="Events.openEventDetailsModal(${e.id})">
            ${e.startDate === dateStr ? '🚀 ' : ''}${e.registrationDeadline === dateStr ? '⏰ ' : ''}${Events.escapeHtml(e.title)}
          </div>
        `).join('');

        gridHtml += `
          <div class="calendar-day ${todayClass}">
            <span class="day-number">${day}</span>
            <div style="display:flex; flex-direction:column; gap:2px; margin-top:2px;">
              ${eventBadgesHtml}
            </div>
          </div>
        `;
      }

      calendarGrid.innerHTML = gridHtml;
    } catch (err) {
      console.error('Failed to render calendar:', err);
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
