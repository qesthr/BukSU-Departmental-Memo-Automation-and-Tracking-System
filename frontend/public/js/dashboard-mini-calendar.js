/**
 * Standalone Mini Calendar for Dashboard
 * Connected to the calendar system - uses same API and formatting as main calendar
 */

(function() {
  'use strict';

  let miniCalendarEvents = [];
  let miniCursor = new Date();

  // DOM elements
  const mini = document.getElementById('dashboardMiniCalendar');
  const miniMonthEl = document.getElementById('dashboardMiniCalMonth');
  const miniPrev = document.getElementById('dashboardMiniPrev');
  const miniNext = document.getElementById('dashboardMiniNext');

  // Helper function to format date for API (same as calendar-custom.js)
  function formatDateForAPI(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`;
  }

  // Helper function to get today's date in Manila timezone (same as calendar-custom.js)
  function getTodayInManila() {
    const now = new Date();
    const year = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric' }));
    const month = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit' })) - 1;
    const day = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', day: '2-digit' }));
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  // Helper function to format date for comparison
  function formatDateManila(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Format database event for calendar (same as calendar-custom.js)
  function formatEventForCalendar(e, source) {
    return {
      id: String(e._id),
      title: e.title,
      start: new Date(e.start),
      end: new Date(e.end),
      allDay: e.allDay || false,
      category: e.category || 'standard',
      extendedProps: {
        category: e.category || 'standard',
        source: source
      }
    };
  }

  // Format Google Calendar event (same as calendar-custom.js)
  function formatGoogleEventForCalendar(ev) {
    const isGoogleAllDay = ev.start.date ? true : false;
    const isHoliday = ev.isHoliday === true;

    let eventStart = isGoogleAllDay ? ev.start.date : ev.start.dateTime;
    let eventEnd = isGoogleAllDay ? ev.end.date : ev.end.dateTime;

    if (isGoogleAllDay) {
      if (eventEnd) {
        const endDate = new Date(eventEnd);
        endDate.setDate(endDate.getDate() - 1);
        eventEnd = endDate.toISOString().split('T')[0];
      }
      if (eventStart && typeof eventStart === 'string') {
        const [year, month, day] = eventStart.split('-').map(Number);
        eventStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      }
      if (eventEnd && typeof eventEnd === 'string') {
        const [year, month, day] = eventEnd.split('-').map(Number);
        eventEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
      }
    } else {
      eventStart = new Date(eventStart);
      eventEnd = new Date(eventEnd);
    }

    return {
      id: 'gcal_' + ev.id,
      title: isHoliday ? `🎉 ${ev.summary || '(no title)'}` : (ev.summary || '(no title)'),
      start: eventStart,
      end: eventEnd,
      allDay: isGoogleAllDay,
      category: isHoliday ? 'holiday' : 'standard',
      extendedProps: {
        category: isHoliday ? 'holiday' : 'standard',
        source: 'google',
        isHoliday: isHoliday
      }
    };
  }

  // Get events for a specific date
  function getEventsForDate(date) {
    const dateStr = formatDateManila(date);
    return miniCalendarEvents.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      const eventStartStr = formatDateManila(eventStart);
      const eventEndStr = formatDateManila(eventEnd);
      return dateStr >= eventStartStr && dateStr <= eventEndStr;
    });
  }

  // Get category color (same as calendar-custom.js)
  function getCategoryColor(category) {
    switch (category) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'meeting': return '#8b5cf6';
      case 'deadline': return '#ec4899';
      case 'reminder': return '#06b6d4';
      case 'low': return '#3b82f6';
      case 'holiday': return '#FFD700';
      case 'standard':
      default: return '#10b981';
    }
  }

  // Get highest priority category from events
  function getHighestPriorityCategory(events) {
    const priorityOrder = ['urgent', 'high', 'meeting', 'deadline', 'reminder', 'standard', 'low', 'holiday'];
    for (const priority of priorityOrder) {
      if (events.some(e => {
        const cat = e.extendedProps?.category || e.category || 'standard';
        return cat === priority;
      })) {
        return priority;
      }
    }
    return 'standard';
  }

  /**
   * Load events for mini calendar (connected to calendar system)
   */
  async function loadEventsForMiniCalendar() {
    try {
      const now = new Date();
      // Load 3 months of events (previous month, current month, next month)
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      const startStr = formatDateForAPI(start);
      const endStr = formatDateForAPI(end);

      let allEvents = [];

      // Fetch database events (same as main calendar)
      const qs = new URLSearchParams({ start: startStr, end: endStr });
      const res = await fetch(`/api/calendar/events?${qs.toString()}`, {
        credentials: 'same-origin'
      });

      if (res.ok) {
        const data = await res.json();
        const dbEvents = data.map(e => formatEventForCalendar(e, 'database'));
        allEvents = [...allEvents, ...dbEvents];
      }

      // Fetch Google Calendar events if connected (same as main calendar)
      if (window.calendarConnected) {
        try {
          const formatForGoogleAPI = (dateStr) => {
            if (!dateStr) return dateStr;
            if (/[+-]\d{2}:\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) return dateStr;
            if (dateStr.includes('T')) return `${dateStr}+08:00`;
            return `${dateStr}T00:00:00+08:00`;
          };

          const timeMin = formatForGoogleAPI(startStr);
          const timeMax = formatForGoogleAPI(endStr);

          const r2 = await fetch(`/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, {
            credentials: 'same-origin'
          });

          if (r2.ok) {
            const gItems = await r2.json();
            const googleEvents = gItems.map(ev => formatGoogleEventForCalendar(ev));
            allEvents = [...allEvents, ...googleEvents];
          }
        } catch (err) {
          console.error('Error fetching Google Calendar events:', err);
        }
      }

      // Filter out past events - only show events that haven't ended yet
      miniCalendarEvents = allEvents.filter(e => {
        const eventEnd = new Date(e.end);
        return eventEnd >= now;
      });

      renderMiniCalendar();
    } catch (err) {
      console.error('Error loading events for mini calendar:', err);
      // Still render calendar even if events fail to load
      renderMiniCalendar();
    }
  }

  /**
   * Render mini calendar
   */
  function renderMiniCalendar() {
    if (!mini) return;
    mini.innerHTML = '';

    if (miniMonthEl) {
      miniMonthEl.textContent = miniCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    const dow = ['S','M','T','W','T','F','S'];
    dow.forEach(ch => {
      const el = document.createElement('div');
      el.className = 'mini-dow';
      el.textContent = ch;
      mini.appendChild(el);
    });

    const startDay = new Date(miniCursor);
    startDay.setDate(1); // Start of month
    const firstDow = startDay.getDay();

    for (let i = 0; i < firstDow; i += 1) {
      const spacer = document.createElement('div');
      spacer.className = 'mini-day';
      mini.appendChild(spacer);
    }

    const month = miniCursor.getMonth();
    const year = miniCursor.getFullYear();
    const iter = new Date(year, month, 1);

    while (iter.getMonth() === month) {
      const el = document.createElement('div');
      el.className = 'mini-day';
      const dayNumber = iter.getDate();
      el.textContent = String(dayNumber);

      const todayInManila = getTodayInManila();
      const iterDateStr = formatDateManila(iter);
      const todayDateStr = formatDateManila(todayInManila);

      if (iterDateStr === todayDateStr) {
        el.classList.add('mini-today');
      }

      const dayEvents = getEventsForDate(iter);
      if (dayEvents.length > 0) {
        const indicatorContainer = document.createElement('div');
        indicatorContainer.className = 'mini-event-indicators';
        const priorityCategory = getHighestPriorityCategory(dayEvents);
        const color = getCategoryColor(priorityCategory);
        const dot = document.createElement('span');
        dot.className = 'mini-event-dot';
        dot.style.backgroundColor = color;
        dot.title = `${dayEvents.length} event(s) - ${dayEvents.map(e => e.title).join(', ')}`;
        indicatorContainer.appendChild(dot);
        el.appendChild(indicatorContainer);
      }

      el.addEventListener('click', () => {
        // Show date details modal when date is clicked
        showDateModal(new Date(year, month, dayNumber));
      });

      mini.appendChild(el);
      iter.setDate(iter.getDate() + 1);
    }
  }

  /**
   * Show date details modal
   */
  function showDateModal(date) {
    const modal = document.getElementById('dashboardDateModal');
    const modalTitle = document.getElementById('dashboardDateModalTitle');
    const modalContent = document.getElementById('dashboardDateModalContent');
    const modalClose = document.getElementById('dashboardDateModalClose');
    const modalCancel = document.getElementById('dashboardDateModalCancel');
    const modalViewCalendar = document.getElementById('dashboardDateModalViewCalendar');

    if (!modal || !modalContent) return;

    // Format date for display
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Get events for this date
    const dayEvents = getEventsForDate(date);

    // Update modal title
    if (modalTitle) {
      modalTitle.textContent = dateStr;
    }

    // Build content
    let contentHTML = `<div style="margin-bottom: 1rem;">`;

    if (dayEvents.length === 0) {
      contentHTML += `
        <p style="color: #6b7280; margin: 0;">No events scheduled for this date.</p>
        <p style="color: #9ca3af; font-size: 0.875rem; margin-top: 0.5rem;">Click "View Full Calendar" to add an event.</p>
      `;
    } else {
      contentHTML += `<p style="color: #374151; font-weight: 500; margin-bottom: 1rem;">${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''} scheduled:</p>`;

      dayEvents.forEach((event, index) => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        const isAllDay = event.allDay || false;
        const category = event.extendedProps?.category || event.category || 'standard';
        const categoryColor = getCategoryColor(category);
        const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
        const description = event.extendedProps?.description || '';
        const source = event.extendedProps?.source || 'database';
        const isGoogleEvent = source === 'google';
        const isHoliday = event.extendedProps?.isHoliday || false;

        let timeStr = '';
        if (isAllDay) {
          timeStr = 'All Day';
        } else {
          const startTime = eventStart.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          const endTime = eventEnd.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          timeStr = `${startTime} - ${endTime}`;
        }

        contentHTML += `
          <div style="
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: ${index < dayEvents.length - 1 ? '0.75rem' : '0'};
            background: #f9fafb;
          ">
            <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
              <div style="
                width: 4px;
                height: 100%;
                background: ${categoryColor};
                border-radius: 2px;
                flex-shrink: 0;
              "></div>
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <h4 style="margin: 0; color: #111827; font-size: 1rem; font-weight: 600;">${event.title}</h4>
                  ${isHoliday ? '<span style="font-size: 0.75rem; color: #6b7280;">🎉 Holiday</span>' : ''}
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.875rem; color: #6b7280;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-weight: 500;">Time:</span>
                    <span>${timeStr}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-weight: 500;">Category:</span>
                    <span style="
                      display: inline-block;
                      padding: 0.125rem 0.5rem;
                      border-radius: 12px;
                      background: ${categoryColor}20;
                      color: ${categoryColor};
                      font-size: 0.75rem;
                      font-weight: 500;
                    ">${categoryName}</span>
                  </div>
                  ${isGoogleEvent ? '<div style="font-size: 0.75rem; color: #9ca3af;">From Google Calendar</div>' : ''}
                  ${description ? `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; color: #374151; font-size: 0.875rem;">${description}</div>` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      });
    }

    contentHTML += `</div>`;
    modalContent.innerHTML = contentHTML;

    // Show modal
    modal.style.display = 'flex';

    // Close handlers
    const closeModal = () => {
      modal.style.display = 'none';
    };

    if (modalClose) {
      modalClose.onclick = closeModal;
    }
    if (modalCancel) {
      modalCancel.onclick = closeModal;
    }
    if (modalViewCalendar) {
      modalViewCalendar.onclick = () => {
        // Check user role to determine calendar route
        const userRole = window.currentUser?.role || '';
        if (userRole === 'faculty') {
          window.location.href = '/faculty/calendar';
        } else if (userRole === 'secretary') {
          window.location.href = '/secretary/calendar';
        } else {
          window.location.href = '/admin/calendar';
        }
      };
    }

    // Close on overlay click
    const overlay = modal.querySelector('.custom-modal-overlay');
    if (overlay) {
      overlay.onclick = closeModal;
    }

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  // Navigation handlers
  if (miniPrev) {
    miniPrev.addEventListener('click', () => {
      miniCursor.setMonth(miniCursor.getMonth() - 1);
      renderMiniCalendar();
    });
  }

  if (miniNext) {
    miniNext.addEventListener('click', () => {
      miniCursor.setMonth(miniCursor.getMonth() + 1);
      renderMiniCalendar();
    });
  }

  // Initialize calendar when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      renderMiniCalendar();
      loadEventsForMiniCalendar();
    });
  } else {
    renderMiniCalendar();
    loadEventsForMiniCalendar();
  }

})();

