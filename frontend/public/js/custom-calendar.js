/**
 * Custom Calendar Component - Replaces FullCalendar
 * Implements TimeGrid (Day), WeekGrid (Week), and MonthGrid (Month) views
 */

class CustomCalendar {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Calendar container #${containerId} not found`);
    }

    // Configuration
    this.timeZone = options.timeZone || 'Asia/Manila';
    this.slotDuration = options.slotDuration || 30; // minutes
    this.slotMinTime = options.slotMinTime || '01:00:00';
    this.slotMaxTime = options.slotMaxTime || '24:00:00';
    this.currentView = options.initialView || 'timeGridDay';
    this.currentDate = options.initialDate || new Date();
    this.viewOnly = options.viewOnly || false; // View-only mode (for faculty)

    // State
    this.events = [];
    this.selectedDate = new Date(this.currentDate);

    // Initialize
    this.init();
  }

  init() {
    this.render();
    this.attachEventListeners();
  }

  /**
   * Main render method - switches between views
   */
  render() {
    this.container.innerHTML = '';

    // Create header toolbar
    const toolbar = this.createToolbar();
    this.container.appendChild(toolbar);

    // Create view container
    const viewContainer = document.createElement('div');
    viewContainer.className = 'custom-calendar-view';
    viewContainer.id = 'calendarViewContainer';
    this.container.appendChild(viewContainer);

    // Render current view
    switch (this.currentView) {
      case 'timeGridDay':
        this.renderTimeGridDay(viewContainer);
        break;
      case 'timeGridWeek':
        this.renderTimeGridWeek(viewContainer);
        break;
      case 'dayGridMonth':
        this.renderDayGridMonth(viewContainer);
        break;
      default:
        this.renderTimeGridDay(viewContainer);
    }
  }

  /**
   * Create toolbar with navigation and view buttons
   */
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'custom-calendar-toolbar';

    // Left side: Add Event button and Google Calendar sync
    const leftSection = document.createElement('div');
    leftSection.className = 'toolbar-left';
    if (!this.viewOnly) {
      const addEventBtn = document.createElement('button');
      addEventBtn.className = 'btn btn-primary';
      addEventBtn.textContent = 'Add Event';
      addEventBtn.onclick = () => {
        if (window.openModal) {window.openModal();}
      };
      leftSection.appendChild(addEventBtn);
    }

    // Google Calendar sync button
    const isGoogleCalendarConnected = window.calendarConnected === true;
    const googleCalendarBtn = document.createElement('button');
    googleCalendarBtn.className = 'btn btn-secondary btn-google-calendar';
    googleCalendarBtn.title = isGoogleCalendarConnected ? 'Google Calendar (Connected)' : 'Sync Google Calendar';
    const iconImg = document.createElement('img');
    iconImg.src = '/images/google-calendar.png';
    iconImg.alt = 'Google Calendar';
    iconImg.className = 'google-calendar-icon';
    googleCalendarBtn.appendChild(iconImg);
    googleCalendarBtn.onclick = async () => {
      if (isGoogleCalendarConnected) {
        // Disconnect
        const confirmed = await window.showConfirmModal(
          'Disconnect Google Calendar? Your events will still be saved in Memofy.',
          'Disconnect Google Calendar'
        );
        if (!confirmed) {return;}
        try {
          const res = await fetch('/calendar/disconnect', { method: 'DELETE', credentials: 'same-origin' });
          if (res.ok) {
            await window.showAlertModal('Google Calendar disconnected. Your Memofy events are still saved.', 'Disconnected');
            window.location.reload();
          } else {
            throw new Error('Failed to disconnect');
          }
        } catch (err) {
          await window.showAlertModal('Failed to disconnect Google Calendar', 'Error');
        }
      } else {
        // Connect
        const confirmed = await window.showConfirmModal(
          'Connect Google Calendar to sync your Memofy events with Google Calendar?\n\nYou can still use Memofy calendar without connecting.',
          'Connect Google Calendar'
        );
        if (confirmed) {
          window.location.href = '/calendar/auth';
        }
      }
    };
    leftSection.appendChild(googleCalendarBtn);
    toolbar.appendChild(leftSection);

    // Center: Title and navigation
    const centerSection = document.createElement('div');
    centerSection.className = 'toolbar-center';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-icon';
    prevBtn.innerHTML = '&#8249;';
    prevBtn.onclick = () => this.navigate(-1);

    const title = document.createElement('span');
    title.className = 'toolbar-title';
    title.id = 'calendarTitle';
    this.updateTitle(title);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-icon';
    nextBtn.innerHTML = '&#8250;';
    nextBtn.onclick = () => this.navigate(1);

    centerSection.appendChild(prevBtn);
    centerSection.appendChild(title);
    centerSection.appendChild(nextBtn);
    toolbar.appendChild(centerSection);

    // Right side: Today button and View buttons
    const rightSection = document.createElement('div');
    rightSection.className = 'toolbar-right';

    const todayBtn = document.createElement('button');
    todayBtn.className = 'btn btn-secondary';
    todayBtn.textContent = 'Today';
    todayBtn.onclick = () => this.goToToday();

    const weekBtn = document.createElement('button');
    weekBtn.className = `btn btn-view ${this.currentView === 'timeGridWeek' ? 'active' : ''}`;
    weekBtn.textContent = 'Week';
    weekBtn.onclick = () => this.changeView('timeGridWeek');

    const monthBtn = document.createElement('button');
    monthBtn.className = `btn btn-view ${this.currentView === 'dayGridMonth' ? 'active' : ''}`;
    monthBtn.textContent = 'Month';
    monthBtn.onclick = () => this.changeView('dayGridMonth');

    rightSection.appendChild(todayBtn);
    rightSection.appendChild(weekBtn);
    rightSection.appendChild(monthBtn);
    toolbar.appendChild(rightSection);

    return toolbar;
  }

  /**
   * Update toolbar title based on current view and date
   */
  updateTitle(titleElement) {
    const date = this.selectedDate;
    let titleText = '';

    switch (this.currentView) {
      case 'timeGridDay':
        titleText = date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        break;
      case 'timeGridWeek':
        const weekStart = this.getWeekStart(date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
        const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
        const startDay = weekStart.getDate();
        const endDay = weekEnd.getDate();
        const year = weekEnd.getFullYear();
        if (startMonth === endMonth) {
          titleText = `${startMonth} ${startDay} - ${endDay}, ${year}`;
        } else {
          titleText = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
        }
        break;
      case 'dayGridMonth':
        titleText = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        break;
    }

    if (titleElement) {
      titleElement.textContent = titleText;
    }
  }

  /**
   * Render TimeGrid Day View
   */
  renderTimeGridDay(container) {
    container.innerHTML = '';
    container.className = 'custom-calendar-view timegrid-day-view';

    const date = this.selectedDate;
    const timeSlots = this.generateTimeSlots();

    // Create time grid
    const grid = document.createElement('div');
    grid.className = 'timegrid-day-grid';

    // All-day section
    const allDaySection = document.createElement('div');
    allDaySection.className = 'timegrid-allday';
    const allDayLabel = document.createElement('div');
    allDayLabel.className = 'timegrid-allday-label';
    allDayLabel.textContent = 'All Day';
    allDaySection.appendChild(allDayLabel);

    const allDayEvents = document.createElement('div');
    allDayEvents.className = 'timegrid-allday-events';
    const dayEvents = this.getEventsForDate(date).filter(e => e.allDay);
    dayEvents.forEach(event => {
      allDayEvents.appendChild(this.createEventElement(event));
    });
    allDaySection.appendChild(allDayEvents);
    grid.appendChild(allDaySection);

    // Time slots section
    const timeSlotsContainer = document.createElement('div');
    timeSlotsContainer.className = 'timegrid-slots';
    timeSlotsContainer.style.position = 'relative';

    // Get all timed events for this date
    const timedEvents = this.getEventsForDate(date).filter(e => !e.allDay);

    timeSlots.forEach(slot => {
      const slotRow = document.createElement('div');
      slotRow.className = 'timegrid-slot-row';

      const timeLabel = document.createElement('div');
      timeLabel.className = 'timegrid-time-label';
      timeLabel.textContent = slot.label;
      slotRow.appendChild(timeLabel);

      const slotCell = document.createElement('div');
      slotCell.className = 'timegrid-slot-cell';
      slotCell.dataset.time = slot.time;
      slotCell.onclick = (e) => this.handleSlotClick(e, slot.time, date);

      slotRow.appendChild(slotCell);
      timeSlotsContainer.appendChild(slotRow);
    });

    // Add events as absolutely positioned elements spanning multiple slots
    timedEvents.forEach(event => {
      const eventEl = this.createEventElement(event, true);
      timeSlotsContainer.appendChild(eventEl);
    });

    grid.appendChild(timeSlotsContainer);
    container.appendChild(grid);
  }

  /**
   * Render TimeGrid Week View
   */
  renderTimeGridWeek(container) {
    container.innerHTML = '';
    container.className = 'custom-calendar-view timegrid-week-view';

    const weekStart = this.getWeekStart(this.selectedDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      days.push(day);
    }

    const grid = document.createElement('div');
    grid.className = 'timegrid-week-grid';

    // Header with day names
    const header = document.createElement('div');
    header.className = 'timegrid-week-header';

    const timeLabelHeader = document.createElement('div');
    timeLabelHeader.className = 'timegrid-week-time-col';
    header.appendChild(timeLabelHeader);

    days.forEach(day => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'timegrid-week-day-header';
      const isSelected = this.formatDateForData(day) === this.formatDateForData(this.selectedDate);
      dayHeader.innerHTML = `
        <div class="day-name">${day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
        <div class="day-number ${this.isToday(day) ? 'today' : ''} ${isSelected ? 'selected' : ''}">${day.getDate()}</div>
      `;
      dayHeader.onclick = () => {
        // Update selected date but stay in Week view
        this.selectedDate = new Date(day);
        const titleElement = document.getElementById('calendarTitle');
        if (titleElement) {
          this.updateTitle(titleElement);
        }
        this.render();
      };
      header.appendChild(dayHeader);
    });

    grid.appendChild(header);

    // All-day section
    const allDaySection = document.createElement('div');
    allDaySection.className = 'timegrid-week-allday';
    const allDayLabel = document.createElement('div');
    allDayLabel.className = 'timegrid-week-time-col';
    allDayLabel.textContent = 'All Day';
    allDaySection.appendChild(allDayLabel);

    days.forEach(day => {
      const allDayCell = document.createElement('div');
      allDayCell.className = 'timegrid-week-day-cell allday';
      const dayEvents = this.getEventsForDate(day).filter(e => e.allDay);
      dayEvents.forEach(event => {
        allDayCell.appendChild(this.createEventElement(event));
      });
      allDaySection.appendChild(allDayCell);
    });

    grid.appendChild(allDaySection);

    // Time slots
    const timeSlots = this.generateTimeSlots();
    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'timegrid-week-slots';
    slotsContainer.style.position = 'relative';

    // Get all timed events for all days in the week
    const allWeekEvents = [];
    days.forEach(day => {
      const dayEvents = this.getEventsForDate(day).filter(e => !e.allDay);
      dayEvents.forEach(event => {
        allWeekEvents.push({ event, day });
      });
    });

    timeSlots.forEach(slot => {
      const slotRow = document.createElement('div');
      slotRow.className = 'timegrid-week-slot-row';

      const timeLabel = document.createElement('div');
      timeLabel.className = 'timegrid-week-time-col';
      timeLabel.textContent = slot.label;
      slotRow.appendChild(timeLabel);

      days.forEach(day => {
        const slotCell = document.createElement('div');
        slotCell.className = 'timegrid-week-day-cell';
        slotCell.dataset.time = slot.time;
        slotCell.dataset.date = this.formatDateForData(day);
        slotCell.onclick = (e) => this.handleSlotClick(e, slot.time, day);

        slotRow.appendChild(slotCell);
      });

      slotsContainer.appendChild(slotRow);
    });

    // Add events as absolutely positioned elements spanning multiple slots
    allWeekEvents.forEach(({ event, day }) => {
      const eventEl = this.createEventElement(event, true);
      const dayIndex = days.findIndex(d => this.formatDateForData(d) === this.formatDateForData(day));
      const dayWidth = `calc((100% - 90px) / 7)`;
      const leftOffset = `calc(90px + ${dayIndex} * ${dayWidth})`;
      eventEl.style.left = leftOffset;
      eventEl.style.width = dayWidth;
      eventEl.style.marginLeft = '4px';
      eventEl.style.marginRight = '4px';
      eventEl.style.marginTop = '2px';
      eventEl.style.marginBottom = '0';
      eventEl.style.right = 'auto';
      slotsContainer.appendChild(eventEl);
    });

    grid.appendChild(slotsContainer);
    container.appendChild(grid);
  }

  /**
   * Render DayGrid Month View
   */
  renderDayGridMonth(container) {
    container.innerHTML = '';
    container.className = 'custom-calendar-view daygrid-month-view';

    const date = this.selectedDate;
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

    const grid = document.createElement('div');
    grid.className = 'daygrid-month-grid';

    // Day headers
    const header = document.createElement('div');
    header.className = 'daygrid-month-header';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(name => {
      const headerCell = document.createElement('div');
      headerCell.className = 'daygrid-month-header-cell';
      headerCell.textContent = name;
      header.appendChild(headerCell);
    });
    grid.appendChild(header);

    // Calendar days
    const daysContainer = document.createElement('div');
    daysContainer.className = 'daygrid-month-days';

    // Calculate how many weeks we need
    // Start from the first Sunday before or on the 1st of the month
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0); // Last day of month
    const lastDayOfMonth = endDate.getDate();
    const lastDayOfMonthDate = new Date(date.getFullYear(), date.getMonth(), lastDayOfMonth);
    const lastDayOfWeek = lastDayOfMonthDate.getDay(); // 0 = Sunday, 6 = Saturday

    // Calculate total days needed: from startDate to end of month + remaining days to complete last week
    const daysFromStart = Math.ceil((lastDayOfMonthDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const totalWeeks = Math.ceil(daysFromStart / 7);
    const weeksToShow = Math.max(6, totalWeeks); // Always show at least 6 weeks

    const currentDate = new Date(startDate);
    for (let week = 0; week < weeksToShow; week++) {
      const weekRow = document.createElement('div');
      weekRow.className = 'daygrid-month-week';

      for (let day = 0; day < 7; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'daygrid-month-day';

        const isCurrentMonth = currentDate.getMonth() === date.getMonth();
        if (!isCurrentMonth) {
          dayCell.classList.add('other-month');
        }

        if (this.isToday(currentDate)) {
          dayCell.classList.add('today');
        }

        const dayNumber = document.createElement('div');
        dayNumber.className = 'daygrid-month-day-number';
        dayNumber.textContent = currentDate.getDate();
        dayCell.appendChild(dayNumber);

        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'daygrid-month-day-events';
        const dayEvents = this.getEventsForDate(currentDate);
        dayEvents.slice(0, 3).forEach(event => {
          eventsContainer.appendChild(this.createEventElement(event, false, true));
        });
        if (dayEvents.length > 3) {
          const moreEl = document.createElement('div');
          moreEl.className = 'daygrid-month-more';
          moreEl.textContent = `+${dayEvents.length - 3} more`;
          eventsContainer.appendChild(moreEl);
        }
        dayCell.appendChild(eventsContainer);

        dayCell.onclick = () => {
          this.selectedDate = new Date(currentDate);
          this.changeView('timeGridDay');
        };

        weekRow.appendChild(dayCell);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      daysContainer.appendChild(weekRow);
    }

    grid.appendChild(daysContainer);
    container.appendChild(grid);
  }

  /**
   * Create event element
   */
  createEventElement(event, isTimed = false, isCompact = false) {
    const eventEl = document.createElement('div');
    const category = event.extendedProps?.category || event.category || 'standard';
    eventEl.className = `custom-calendar-event ${category}`;
    if (event.extendedProps?.isHoliday) {
      eventEl.classList.add('holiday');
    }

    // Apply colors directly from event object to ensure they display correctly
    if (event.backgroundColor) {
      eventEl.style.backgroundColor = event.backgroundColor;
    }
    if (event.borderColor) {
      eventEl.style.borderLeftColor = event.borderColor;
      eventEl.style.borderLeftWidth = '3px';
      eventEl.style.borderLeftStyle = 'solid';
    }
    if (event.textColor) {
      eventEl.style.color = event.textColor;
    }

    if (isTimed) {
      const startTime = new Date(event.start);
      const endTime = new Date(event.end);
      const top = this.calculateEventPosition(startTime);
      const height = this.calculateEventHeight(startTime, endTime);
      eventEl.style.position = 'absolute';
      eventEl.style.top = `${top}px`;
      eventEl.style.height = `${height}px`;
      eventEl.style.left = '90px'; // Start after time label column
      eventEl.style.right = '4px';
      eventEl.style.marginLeft = '4px';
      eventEl.style.marginRight = '0';
      eventEl.style.marginTop = '2px';
      eventEl.style.marginBottom = '0';
      eventEl.style.zIndex = '5';
      eventEl.style.borderRadius = '6px';
    }

    const title = document.createElement('div');
    title.className = 'event-title';
    title.textContent = isCompact ? event.title.substring(0, 20) : event.title;
    eventEl.appendChild(title);

    if (isTimed && !isCompact) {
      const time = document.createElement('div');
      time.className = 'event-time';
      const startStr = new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const endStr = new Date(event.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      time.textContent = `${startStr} - ${endStr}`;
      eventEl.appendChild(time);
    }

    eventEl.onclick = (e) => {
      e.stopPropagation();
      this.handleEventClick(event);
    };

    return eventEl;
  }

  /**
   * Generate time slots for day/week views
   */
  generateTimeSlots() {
    const slots = [];
    const [minHour, minMin] = this.slotMinTime.split(':').map(Number);
    const [maxHour] = this.slotMaxTime.split(':').map(Number);

    for (let hour = minHour; hour < maxHour; hour++) {
      for (let min = 0; min < 60; min += this.slotDuration) {
        const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        const label = this.formatTimeLabel(hour, min);
        slots.push({ time, label });
      }
    }

    return slots;
  }

  /**
   * Format time label (e.g., "9:00 AM", "9:30 AM")
   */
  formatTimeLabel(hour, minute) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return minute === 0
      ? `${displayHour}:00 ${period}`
      : `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
  }

  /**
   * Get events for a specific date
   */
  getEventsForDate(date) {
    const dateStr = this.formatDateForData(date);
    return this.events.filter(event => {
      const eventStart = new Date(event.start);
      const eventDateStr = this.formatDateForData(eventStart);
      return eventDateStr === dateStr;
    });
  }

  /**
   * Format date for comparison (YYYY-MM-DD)
   */
  formatDateForData(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get week start (Sunday)
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  }

  /**
   * Check if date is today (using Manila timezone)
   */
  isToday(date) {
    const now = new Date();
    const todayYear = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric' }));
    const todayMonth = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit' })) - 1;
    const todayDay = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', day: '2-digit' }));
    const today = new Date(todayYear, todayMonth, todayDay);

    const dateYear = date.getFullYear();
    const dateMonth = date.getMonth();
    const dateDay = date.getDate();

    return dateYear === todayYear && dateMonth === todayMonth && dateDay === todayDay;
  }

  /**
   * Calculate event position in time grid (pixels from top)
   */
  calculateEventPosition(startTime) {
    const minutes = this.getMinutesFromMidnight(startTime);
    const slotHeight = 60; // Height of each time slot in pixels
    const slotsPerHour = 60 / this.slotDuration; // 2 slots per hour for 30-minute intervals
    const pixelsPerMinute = (slotHeight * slotsPerHour) / 60; // Pixels per minute

    // Account for slotMinTime (1 AM = 60 minutes)
    const minTimeMinutes = this.timeToMinutes(this.slotMinTime);
    const adjustedMinutes = minutes - minTimeMinutes;

    return Math.max(0, adjustedMinutes * pixelsPerMinute);
  }

  /**
   * Calculate event height (pixels)
   */
  calculateEventHeight(startTime, endTime) {
    const startMinutes = this.getMinutesFromMidnight(startTime);
    const endMinutes = this.getMinutesFromMidnight(endTime);
    const duration = endMinutes - startMinutes; // Duration in minutes
    const slotHeight = 60; // Height of each time slot in pixels
    const slotsPerHour = 60 / this.slotDuration; // 2 slots per hour for 30-minute intervals
    const pixelsPerMinute = (slotHeight * slotsPerHour) / 60; // Pixels per minute
    return duration * pixelsPerMinute;
  }

  /**
   * Get minutes from midnight for a date
   */
  getMinutesFromMidnight(date) {
    const d = new Date(date);
    return d.getHours() * 60 + d.getMinutes();
  }

  /**
   * Convert time string to minutes
   */
  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Navigation methods
   */
  navigate(direction) {
    switch (this.currentView) {
      case 'timeGridDay':
        this.selectedDate.setDate(this.selectedDate.getDate() + direction);
        break;
      case 'timeGridWeek':
        this.selectedDate.setDate(this.selectedDate.getDate() + (direction * 7));
        break;
      case 'dayGridMonth':
        this.selectedDate.setMonth(this.selectedDate.getMonth() + direction);
        break;
    }
    const titleElement = document.getElementById('calendarTitle');
    if (titleElement) {
      this.updateTitle(titleElement);
    }
    this.render();
  }

  goToToday() {
    // Get today's date in Manila timezone
    const now = new Date();
    const year = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric' }));
    const month = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit' })) - 1;
    const day = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', day: '2-digit' }));
    this.selectedDate = new Date(year, month, day, 0, 0, 0, 0);

    // Switch to Day view when clicking Today button
    this.currentView = 'timeGridDay';

    const titleElement = document.getElementById('calendarTitle');
    if (titleElement) {
      this.updateTitle(titleElement);
    }
    this.render();
  }

  changeView(view) {
    this.currentView = view;
    const titleElement = document.getElementById('calendarTitle');
    if (titleElement) {
      this.updateTitle(titleElement);
    }
    this.render();
  }

  /**
   * Event handlers
   */
  handleSlotClick(e, time, date) {
    e.stopPropagation();
    if (this.viewOnly) {
      // View-only mode: show message instead of opening modal
      if (window.showAlertModal) {
        window.showAlertModal('Faculty can view calendar events but cannot create or edit them.', 'View Only');
      } else {
        Swal.fire({
          icon: 'info',
          title: 'View Only',
          text: 'Faculty can view calendar events but cannot create or edit them.'
        });
      }
      return;
    }
    if (window.openModal) {
      // Open modal with pre-filled date and time
      const [hours, minutes] = time.split(':').map(Number);
      const eventDate = new Date(date);
      eventDate.setHours(hours, minutes, 0, 0);
      window.openModal(eventDate);
    }
  }

  handleEventClick(event) {
    // View-only mode: show event details instead of edit modal
    if (this.viewOnly) {
      const title = event.title || 'Event';
      const description = event.extendedProps?.description || 'No description';
      const category = event.extendedProps?.category || 'standard';
      const start = event.start ? new Date(event.start).toLocaleString() : '';
      const end = event.end ? new Date(event.end).toLocaleString() : '';

      let message = `<strong>${title}</strong><br/>`;
      message += `Category: ${category}<br/>`;
      message += `Start: ${start}<br/>`;
      message += `End: ${end}<br/>`;
      if (description) {
        message += `<br/>${description}`;
      }

      if (window.showAlertModal) {
        window.showAlertModal(message, 'Event Details');
      } else {
        Swal.fire({
          icon: 'info',
          title: 'Event Details',
          html: message
        });
      }
      return;
    }

    // Check if this is a backend event (can be edited)
    const eventSource = event.extendedProps?.source || '';
    const eventId = event.id.startsWith('gcal_') ? event.id.replace('gcal_', '') : event.id;

    // Only allow editing of backend events (not Google Calendar events)
    if (eventSource === 'backend' && eventId && window.openEventModalForEdit) {
      // Use the new edit function that fetches full event data from API
      window.openEventModalForEdit(eventId);
    } else {
      // For Google Calendar events or events without proper ID, show read-only info
      const title = event.title || 'Event';
      const description = event.extendedProps?.description || 'No description';
      const category = event.extendedProps?.category || 'standard';
      const start = event.start ? new Date(event.start).toLocaleString() : '';
      const end = event.end ? new Date(event.end).toLocaleString() : '';

      let message = `<strong>${title}</strong><br/>`;
      message += `Category: ${category}<br/>`;
      message += `Start: ${start}<br/>`;
      message += `End: ${end}<br/>`;
      if (description) {
        message += `<br/>${description}`;
      }

      if (window.showAlertModal) {
        window.showAlertModal(message, 'Event Details (Read Only)');
      } else {
        Swal.fire({
          icon: 'info',
          title: 'Event Details (Read Only)',
          html: message
        });
      }
    }
  }

  formatDateForInput(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatTimeForInput(date) {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  attachEventListeners() {
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {this.navigate(-1);}
      if (e.key === 'ArrowRight') {this.navigate(1);}
    });
  }

  /**
   * Public API methods
   */
  addEvent(event) {
    this.events.push(event);
    this.render();
  }

  removeEvent(eventId) {
    this.events = this.events.filter(e => e.id !== eventId);
    this.render();
  }

  updateEvent(event) {
    const index = this.events.findIndex(e => e.id === event.id);
    if (index !== -1) {
      this.events[index] = event;
      this.render();
    }
  }

  setEvents(events) {
    this.events = events;
    this.render();
  }

  gotoDate(date) {
    this.selectedDate = new Date(date);
    this.currentDate = new Date(date);
    this.render();
  }

  /**
   * Navigate to a specific date and load events
   * This is used by mini calendar to update the main view
   */
  navigateToDate(date) {
    const targetDate = new Date(date);
    this.gotoDate(targetDate);
    this.changeView('timeGridDay');

    // Trigger event loading with the target date so events are fetched for that date range
    if (typeof window.loadEvents === 'function') {
      window.loadEvents(targetDate);
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CustomCalendar;
}


