/* global FullCalendar */
(function () {
  // Wait for DOM to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendar);
  } else {
    initCalendar();
  }

  function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) {
    console.error('Calendar element not found');
    return;
  }

  if (typeof FullCalendar === 'undefined') {
    console.error('FullCalendar library not loaded');
    return;
  }

  const mini = document.getElementById('miniCalendar');
  const miniMonthEl = document.getElementById('miniCalMonth');
  const miniPrev = document.getElementById('miniPrev');
  const miniNext = document.getElementById('miniNext');
  // Navigation and buttons are now handled by FullCalendar header toolbar

  const modal = document.getElementById('memoModal');
  const closeModalBtn = document.getElementById('closeMemoModal');
  const cancelBtn = document.getElementById('cancelMemo');
  const form = document.getElementById('memoForm');
  const deleteBtn = document.getElementById('deleteMemo');
  const titleInput = document.getElementById('memoTitle');
  const dateInput = document.getElementById('memoDate');
  const startInput = document.getElementById('memoStart');
  const endInput = document.getElementById('memoEnd');
  const categorySelect = document.getElementById('memoCategory');
  const descInput = document.getElementById('memoDesc');
  const participantsHiddenInput = document.getElementById('memoParticipants');
  const participantsChipsContainer = document.getElementById('participantsChips');
  const participantEmailInput = document.getElementById('participantEmailInput');
  const emailSuggestions = document.getElementById('emailSuggestions');
  const selectDepartmentBtn = document.getElementById('selectDepartmentBtn');
  const departmentDropdown = document.getElementById('departmentDropdown');
  const departmentList = document.getElementById('departmentList');
  const closeDepartmentDropdown = document.getElementById('closeDepartmentDropdown');
  const editingSourceInput = document.getElementById('memoEditingSource');
  const editingIdInput = document.getElementById('memoEditingId');

  // Participants data structure
  let participantsData = {
    departments: [],
    emails: []
  };
  let registeredUsers = [];
  let departmentsList = [];

  function normalizeDate(dateValue) {
    if (!dateValue) return '';
    // If it's already in yyyy-MM-dd format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    // Otherwise, try to extract just the date part
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      // If it contains a date-like string, try to extract it
      const match = dateValue.match(/^\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : '';
    }
  }

  function openModal(preset) {
    if (preset) {
      titleInput.value = preset.title || '';
      dateInput.value = normalizeDate(preset.date || '');
      startInput.value = preset.start || '';
      endInput.value = preset.end || '';
      if (preset.description !== undefined) descInput.value = preset.description || '';
      if (preset.category) categorySelect.value = preset.category;
      // Set participants if editing
      if (preset.participants) {
        try {
          // Try parsing as JSON first
          const parsed = typeof preset.participants === 'string' ? JSON.parse(preset.participants) : preset.participants;
          if (parsed && typeof parsed === 'object' && (parsed.departments || parsed.emails)) {
            participantsData = {
              departments: Array.isArray(parsed.departments) ? parsed.departments : [],
              emails: Array.isArray(parsed.emails) ? parsed.emails : []
            };
          } else if (Array.isArray(parsed)) {
            // Legacy: if it's just an array, assume they're departments
            participantsData = {
              departments: parsed,
              emails: []
            };
          } else {
            participantsData = { departments: [], emails: [] };
          }
        } catch {
          // If parsing fails, check if it's an array
          if (Array.isArray(preset.participants)) {
            participantsData = {
              departments: preset.participants,
              emails: []
            };
          } else {
            participantsData = { departments: [], emails: [] };
          }
        }
      } else {
        participantsData = { departments: [], emails: [] };
      }
    } else {
      // Clear all fields for new event
      participantsData = { departments: [], emails: [] };
      if (descInput) descInput.value = '';
      if (categorySelect) categorySelect.value = 'standard';
      if (participantEmailInput) participantEmailInput.value = '';
    }
    renderParticipantsChips();
    renderDepartmentDropdown();

      if (preset && preset.edit) {
        editingSourceInput.value = preset.source || '';
        editingIdInput.value = preset.id || '';
        // Only show delete button if user is creator (backend events only)
        if (deleteBtn) deleteBtn.style.display = (preset.source === 'backend' && preset.edit === true) ? 'block' : 'none';

        // Disable all form fields if user is NOT the creator (read-only mode)
        const isReadOnly = preset.edit === false;
        if (isReadOnly) {
          if (titleInput) titleInput.disabled = true;
          if (dateInput) dateInput.disabled = true;
          if (startInput) startInput.disabled = true;
          if (endInput) endInput.disabled = true;
          if (categorySelect) categorySelect.disabled = true;
          if (descInput) descInput.disabled = true;
          if (allDayCheckbox) allDayCheckbox.disabled = true;
          if (participantEmailInput) participantEmailInput.disabled = true;
          if (selectDepartmentBtn) selectDepartmentBtn.disabled = true;
          // Hide form submit button or make it read-only
          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.style.display = 'none';
        } else {
          // Enable all fields if user is creator
          if (titleInput) titleInput.disabled = false;
          if (dateInput) dateInput.disabled = false;
          if (startInput) startInput.disabled = false;
          if (endInput) endInput.disabled = false;
          if (categorySelect) categorySelect.disabled = false;
          if (descInput) descInput.disabled = false;
          if (allDayCheckbox) allDayCheckbox.disabled = false;
          if (participantEmailInput) participantEmailInput.disabled = false;
          if (selectDepartmentBtn) selectDepartmentBtn.disabled = false;
          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.style.display = 'block';
        }
      } else {
        editingSourceInput.value = '';
        editingIdInput.value = '';
        if (deleteBtn) deleteBtn.style.display = 'none';
        // Enable all fields for new events
        if (titleInput) titleInput.disabled = false;
        if (dateInput) dateInput.disabled = false;
        if (startInput) startInput.disabled = false;
        if (endInput) endInput.disabled = false;
        if (categorySelect) categorySelect.disabled = false;
        if (descInput) descInput.disabled = false;
        if (allDayCheckbox) allDayCheckbox.disabled = false;
        if (participantEmailInput) participantEmailInput.disabled = false;
        if (selectDepartmentBtn) selectDepartmentBtn.disabled = false;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.style.display = 'block';
      }
      modal.style.display = 'grid';
  }
  function closeModal() {
    modal.style.display = 'none';
    form.reset();
  }

  function categoryColor(category) {
    switch (category) {
      case 'today': return '#fbbf24'; // Yellow
      case 'urgent': return '#f87171'; // Red
      default: return '#86efac'; // Green
    }
  }

  function formatEventTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  }

  // Get calendar connection status
  const isCalendarConnected = window.calendarConnected === true;

  // Define custom buttons
  const customButtons = {};
  let leftButtons = 'title';
  let rightButtons = ''; // No view toggles - only day view

  if (isCalendarConnected) {
    customButtons.addEventBtn = {
      text: 'Add Event',
      click: function() {
        openModal();
      }
    };
    customButtons.disconnectBtn = {
      text: 'Disconnect',
      click: async function() {
        if (!confirm('Are you sure you want to disconnect Google Calendar?')) { return; }
        try {
          const res = await fetch('/calendar/disconnect', { method: 'DELETE', credentials: 'same-origin' });
          if (res.ok) {
            alert('Google Calendar disconnected successfully');
            window.location.reload();
          } else {
            throw new Error('Failed to disconnect');
          }
        } catch (err) {
          alert('Failed to disconnect Google Calendar');
        }
      }
    };
    leftButtons = 'addEventBtn,disconnectBtn ' + leftButtons;
  } else {
    customButtons.connectBtn = {
      text: 'Connect Google Calendar',
      click: function() {
        window.location.href = '/calendar/auth';
      }
    };
    leftButtons = 'connectBtn ' + leftButtons;
  }

  // Helper function to get current time in HH:MM:SS format
  function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}:00`;
  }


  // Mini calendar variables - declare early so they're available in calendar callbacks
  const today = new Date();
  const miniCursor = new Date(today.getFullYear(), today.getMonth(), 1);
  let miniCalendarEvents = []; // Store events for mini calendar indicators

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridDay',
    initialDate: new Date(), // Start with today
    customButtons: customButtons,
    headerToolbar: {
      left: leftButtons,
      center: '', // Empty center
      right: rightButtons
    },
    height: 'auto',
    contentHeight: 'auto', // Let the view determine its own height
    selectable: true,
    editable: false, // Will be set per-event based on isCreator
    eventStartEditable: false,
    eventDurationEditable: false,
    nowIndicator: true,
    allDaySlot: false, // Hide all-day section in day view
    slotDuration: '00:30:00', // 30-minute slots
    slotMinTime: '00:00:00', // Start from midnight
    slotMaxTime: '24:00:00', // Show full 24 hours
    scrollTime: getCurrentTime(), // Scroll to current time initially (makes it visible first)
    datesSet: function(dateInfo) {
      // Update mini calendar when main calendar view changes
      renderMiniCalendar();

      // Auto-scroll to current time or first event
      setTimeout(() => {
        const viewDate = dateInfo.start;
        const today = new Date();
        const isToday = viewDate.toDateString() === today.toDateString();

        if (isToday) {
          // For today, scroll to current time so it's visible
          setTimeout(() => {
            const currentTime = getCurrentTime();
            calendar.scrollToTime(currentTime);
          }, 100);
        } else {
          // For other dates, try to scroll to first event if available
          setTimeout(() => {
            scrollToFirstEvent(viewDate);
          }, 200);
        }
      }, 200);
    },
    dateClick(info) {
      // Update mini calendar selection when clicking on the main day view
      const clickedDate = new Date(info.date);
      const clickedDayOnly = new Date(clickedDate);
      clickedDayOnly.setHours(0, 0, 0, 0);

      // Extract time from clicked date (HH:MM format)
      const clickedTime = clickedDate;
      const hours = String(clickedTime.getHours()).padStart(2, '0');
      const minutes = String(clickedTime.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      // Update mini calendar month if needed
      if (clickedDayOnly.getMonth() !== miniCursor.getMonth() || clickedDayOnly.getFullYear() !== miniCursor.getFullYear()) {
        miniCursor.setMonth(clickedDayOnly.getMonth());
        miniCursor.setFullYear(clickedDayOnly.getFullYear());
        miniCursor.setDate(1);
        renderMiniCalendar();
      }

      // Highlight the selected date in mini calendar
      setTimeout(() => {
        const clickedDay = clickedDayOnly.getDate();
        mini.querySelectorAll('.mini-selected').forEach(n => n.classList.remove('mini-selected'));
        const miniDays = mini.querySelectorAll('.mini-day');
        miniDays.forEach(day => {
          if (day.textContent.trim() === String(clickedDay)) {
            day.classList.add('mini-selected');
          }
        });
      }, 50);

      // Open modal with date and start time pre-filled (end time left empty for user to set)
      openModal({ date: info.dateStr.substring(0, 10), start: timeStr });
    },
    select(info) {
      const start = info.startStr.substring(11, 16) || '08:00';
      const end = info.endStr.substring(11, 16) || '09:00';
      openModal({ date: info.startStr.substring(0, 10), start, end });
    },
    async eventClick(info) {
      const e = info.event;
      // Get original title if available (from extendedProps)
      const originalTitle = e.extendedProps?.originalTitle || e.title.split(' at ')[0];
      const source = e.id.startsWith('gcal_') ? 'google' : 'backend';
      const isAllDay = e.allDay || e.extendedProps?.allDay || false;
      const isCreator = e.extendedProps?.isCreator !== false; // Default to true if not set (for Google events)

      // If user is NOT the creator and it's a backend event, redirect to view the memo notification
      if (source === 'backend' && !isCreator) {
        try {
          // Find the memo notification for this event
          const res = await fetch(`/api/calendar/events/${e.id}/memo`, { credentials: 'same-origin' });
          if (res.ok) {
            const memo = await res.json();
            // Redirect to view the memo notification in the log page
            const isSecretaryRoute = window.location.pathname.includes('/secretary');
            const logUrl = isSecretaryRoute ? '/secretary/log' : '/admin/log';
            window.location.href = `${logUrl}?memo=${memo._id}`;
            return;
          }
        } catch (err) {
          console.error('Error fetching event memo:', err);
          // If memo not found, show alert and return
          alert('This event was created by another user. Please check your notifications to view the event details.');
          return;
        }
      }

      // Fetch full event details if it's a backend event
      let participants = [];
      let description = '';
      let category = 'standard';

      if (source === 'backend') {
        try {
          const res = await fetch(`/api/calendar/events/${e.id}`, { credentials: 'same-origin' });
          if (res.ok) {
            const eventData = await res.json();
            participants = eventData.participants || [];
            description = eventData.description || '';
            category = eventData.category || 'standard';
          }
        } catch (err) {
          console.error('Error fetching event details:', err);
        }
      }

      // Format date and time for the modal
      const eventDate = new Date(e.start);
      const dateStr = eventDate.toISOString().split('T')[0];
      let startTime = '';
      let endTime = '';

      if (!isAllDay) {
        startTime = e.startStr.substring(11, 16) || '';
        endTime = e.endStr ? e.endStr.substring(11, 16) : '';
      }

      openModal({
        title: originalTitle,
        date: dateStr,
        start: startTime,
        end: endTime,
        allDay: isAllDay,
        edit: isCreator, // Only allow editing if user is creator
        id: e.id,
        source: source,
        participants: participants,
        description: description,
        category: category
      });
    },
    async eventDrop(info) {
      try {
        const res = await fetch(`/api/calendar/events/${info.event.id}/time`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ start: info.event.start.toISOString(), end: info.event.end?.toISOString() || info.event.start.toISOString() })
        });
        if (!res.ok) { throw new Error('Failed to update schedule'); }
      } catch (err) {
        info.revert();
        alert(err.message || 'Update failed');
      }
    },
    async eventResize(info) {
      try {
        const res = await fetch(`/api/calendar/events/${info.event.id}/time`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ start: info.event.start.toISOString(), end: info.event.end?.toISOString() })
        });
        if (!res.ok) { throw new Error('Failed to update schedule'); }
      } catch (err) {
        info.revert();
        alert(err.message || 'Update failed');
      }
    },
    events: async function(fetchInfo, success, failure) {
      try {
        const qs = new URLSearchParams({ start: fetchInfo.startStr, end: fetchInfo.endStr });
        console.log('🔍 Fetching events for date range:', fetchInfo.startStr, 'to', fetchInfo.endStr);
        const res = await fetch(`/api/calendar/events?${qs.toString()}`, { credentials: 'same-origin' });
        if (!res.ok) { throw new Error('Failed to load events'); }
        const data = await res.json();
        console.log('📅 Events received from server:', data.length, 'events');
        console.log('📅 Event details:', data);
        const localEvents = data.map(e => {
          const timeStr = formatEventTime(e.start);
          const eventTitle = timeStr ? `${e.title} at ${timeStr}` : e.title;

          // Handle all-day events
          const isAllDay = e.allDay || false;
          // For all-day events, use just the date part (no time)
          let startDate = e.start;
          let endDate = e.end;

          if (isAllDay) {
            // Convert to date-only format for all-day events
            const start = new Date(e.start);
            start.setHours(0, 0, 0, 0);
            startDate = start;

            const end = new Date(e.end);
            end.setHours(23, 59, 59, 999);
            endDate = end;
          }

          return {
            id: e._id,
            title: isAllDay ? e.title : eventTitle, // Don't add time for all-day events
            start: startDate,
            end: endDate,
            allDay: isAllDay,
            backgroundColor: categoryColor(e.category),
            borderColor: categoryColor(e.category),
            classNames: [`fc-event-${e.category || 'standard'}`],
            editable: e.isCreator !== false, // Only editable if user is creator
            extendedProps: {
              originalTitle: e.title,
              category: e.category,
              allDay: isAllDay,
              participants: e.participants,
              description: e.description,
              isCreator: e.isCreator !== false // Store creator flag
            }
          };
        });

        // Try to append Google Calendar events if connected; failures are ignored
        let googleEvents = [];
        try {
          const r2 = await fetch(`/calendar/events?timeMin=${encodeURIComponent(fetchInfo.startStr)}&timeMax=${encodeURIComponent(fetchInfo.endStr)}`, { credentials: 'same-origin' });
          if (r2.ok) {
            const gItems = await r2.json();
            googleEvents = (gItems || []).map(ev => {
              const startDateTime = ev.start && (ev.start.dateTime || ev.start.date);
              const timeStr = startDateTime ? formatEventTime(startDateTime) : '';
              const eventTitle = timeStr ? `${ev.summary || '(no title)'} at ${timeStr}` : (ev.summary || '(no title)');
              return {
                id: 'gcal_' + ev.id,
                title: eventTitle,
                start: startDateTime,
                end: ev.end && (ev.end.dateTime || ev.end.date),
                backgroundColor: '#16a34a',
                borderColor: '#16a34a',
                classNames: ['fc-event-standard']
              };
            });
          }
        } catch {
          // ignore calendar fetch failure
        }

          const formatted = [...localEvents, ...googleEvents];

          // Update mini calendar events for the current month if they're in range
          const currentMonth = miniCursor.getMonth();
          const currentYear = miniCursor.getFullYear();
          formatted.forEach(event => {
            const eventDate = new Date(event.start);
            if (eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear) {
              // Add to mini calendar events if not already present
              const exists = miniCalendarEvents.some(e => e.id === event.id);
              if (!exists) {
                miniCalendarEvents.push(event);
              }
            }
          });

          // Re-render mini calendar to show updated indicators
          renderMiniCalendar();

          success(formatted);
      } catch (err) {
        // swallow to avoid noisy console in production
        failure(err);
      }
    }
  });
  calendar.render();

  // Mini calendar rendering (simple month grid)
  // Note: miniCursor and miniCalendarEvents are declared above before calendar initialization

  function formatMonthTitle(d) {
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }

  function getEventsForDate(date) {
    if (!miniCalendarEvents || miniCalendarEvents.length === 0) return [];
    const dateStr = date.toISOString().split('T')[0];
    return miniCalendarEvents.filter(event => {
      const eventDate = new Date(event.start);
      const eventDateStr = eventDate.toISOString().split('T')[0];
      return eventDateStr === dateStr;
    });
  }

  function getCategoryColor(category) {
    switch (category) {
      case 'urgent': return '#f87171'; // Red
      case 'today': return '#fbbf24'; // Yellow
      case 'standard': return '#86efac'; // Green
      default: return '#86efac'; // Default to green
    }
  }

  function getHighestPriorityCategory(events) {
    // Priority: urgent > today > standard
    if (events.some(e => e.category === 'urgent' || e.extendedProps?.category === 'urgent')) {
      return 'urgent';
    }
    if (events.some(e => e.category === 'today' || e.extendedProps?.category === 'today')) {
      return 'today';
    }
    return 'standard';
  }

  // Function to scroll to first event time
  function scrollToFirstEventTime(date, events) {
    if (!events || events.length === 0) return;

    // Get the earliest event time for the date
    const dateStr = date.toISOString().split('T')[0];
    const sameDayEvents = events.filter(e => {
      const eventDate = new Date(e.start);
      return eventDate.toISOString().split('T')[0] === dateStr;
    });

    if (sameDayEvents.length > 0) {
      // Sort by start time and get the first one
      sameDayEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      const firstEvent = sameDayEvents[0];
      const eventTime = new Date(firstEvent.start);

      // Format as HH:MM:SS for scrollToTime
      const hours = String(eventTime.getHours()).padStart(2, '0');
      const minutes = String(eventTime.getMinutes()).padStart(2, '0');
      const scrollTime = `${hours}:${minutes}:00`;

      calendar.scrollToTime(scrollTime);
    }
  }

  // Function to scroll to first event after loading
  function scrollToFirstEvent(date) {
    // Wait for events to load, then scroll
    setTimeout(() => {
      const allEvents = calendar.getEvents();
      const dateStr = date.toISOString().split('T')[0];
      const sameDayEvents = Array.from(allEvents).filter(e => {
        const eventDate = new Date(e.start);
        return eventDate.toISOString().split('T')[0] === dateStr && !e.allDay;
      });

      if (sameDayEvents.length > 0) {
        sameDayEvents.sort((a, b) => a.start - b.start);
        const firstEvent = sameDayEvents[0];
        const eventTime = new Date(firstEvent.start);
        const hours = String(eventTime.getHours()).padStart(2, '0');
        const minutes = String(eventTime.getMinutes()).padStart(2, '0');
        calendar.scrollToTime(`${hours}:${minutes}:00`);
      } else {
        // No events, scroll to 8am as default
        calendar.scrollToTime('08:00:00');
      }
    }, 300);
  }

  async function loadEventsForMiniCalendar() {
    try {
      // Get the first and last day of the current mini calendar month
      const firstDay = new Date(miniCursor.getFullYear(), miniCursor.getMonth(), 1);
      const lastDay = new Date(miniCursor.getFullYear(), miniCursor.getMonth() + 1, 0);
      lastDay.setHours(23, 59, 59, 999);

      const startStr = firstDay.toISOString();
      const endStr = lastDay.toISOString();

      const qs = new URLSearchParams({ start: startStr, end: endStr });
      const res = await fetch(`/api/calendar/events?${qs.toString()}`, { credentials: 'same-origin' });

      if (res.ok) {
        const data = await res.json();
        // Convert to FullCalendar format for consistency
        miniCalendarEvents = data.map(e => ({
          id: e._id,
          start: e.start,
          end: e.end,
          category: e.category || 'standard',
          extendedProps: {
            category: e.category || 'standard'
          }
        }));
        // Re-render mini calendar with event indicators
        renderMiniCalendar();
      }
    } catch (err) {
      console.error('Error loading events for mini calendar:', err);
    }
  }

  function renderMiniCalendar() {
    if (!mini) { return; }
    mini.innerHTML = '';
    if (miniMonthEl) { miniMonthEl.textContent = formatMonthTitle(miniCursor); }
    const dow = ['S','M','T','W','T','F','S'];
    dow.forEach(ch => {
      const el = document.createElement('div');
      el.className = 'mini-dow';
      el.textContent = ch;
      mini.appendChild(el);
    });
    const startDay = new Date(miniCursor);
    const firstDow = startDay.getDay();
    for (let i = 0; i < firstDow; i += 1) {
      const spacer = document.createElement('div');
      spacer.className = 'mini-day';
      mini.appendChild(spacer);
    }
    const month = miniCursor.getMonth();
    const year = miniCursor.getFullYear();
    const iter = new Date(miniCursor);
    while (iter.getMonth() === month) {
      const el = document.createElement('div');
      el.className = 'mini-day';

      // Capture the date number at the time of element creation
      const dayNumber = iter.getDate();
      el.textContent = String(dayNumber);

      const today = new Date();
      if (today.toDateString() === iter.toDateString()) { el.classList.add('mini-today'); }

      // Add event indicators based on category
      const dayEvents = getEventsForDate(iter);
      if (dayEvents.length > 0) {
        const indicatorContainer = document.createElement('div');
        indicatorContainer.className = 'mini-event-indicators';

        // Get the highest priority category for this day
        const priorityCategory = getHighestPriorityCategory(dayEvents);
        const color = getCategoryColor(priorityCategory);

        // Create a colored dot indicator
        const dot = document.createElement('span');
        dot.className = 'mini-event-dot';
        dot.style.backgroundColor = color;
        dot.title = `${dayEvents.length} event(s)`;

        indicatorContainer.appendChild(dot);
        el.appendChild(indicatorContainer);
      }

      el.addEventListener('click', () => {
        mini.querySelectorAll('.mini-selected').forEach(n => n.classList.remove('mini-selected'));
        el.classList.add('mini-selected');

        // Create a proper date using captured values
        const clickedDate = new Date(year, month, dayNumber);
        clickedDate.setHours(0, 0, 0, 0);

        console.log('Mini calendar clicked - Setting date to:', clickedDate.toISOString().split('T')[0], 'Day number:', dayNumber, 'Month:', month, 'Year:', year);

        // Always use changeView with the date - this is more reliable
        calendar.changeView('timeGridDay', clickedDate);

        // Force refresh events for the selected date
        setTimeout(() => {
          const currentDate = calendar.view.currentStart;
          const clickedDateStr = clickedDate.toISOString().split('T')[0];
          const currentDateStr = currentDate.toISOString().split('T')[0];

          if (clickedDateStr !== currentDateStr) {
            console.log('Date mismatch, forcing gotoDate. Expected:', clickedDateStr, 'Got:', currentDateStr);
            calendar.gotoDate(clickedDate);
          }

          // Always refetch events to ensure they're displayed
          calendar.refetchEvents();
          calendar.render();

          // Scroll to appropriate time after events load
          setTimeout(() => {
            const today = new Date();
            const isToday = clickedDate.toDateString() === today.toDateString();

            if (isToday) {
              // Scroll to current time for today
              const currentTime = getCurrentTime();
              calendar.scrollToTime(currentTime);
            } else if (dayEvents.length > 0) {
              // Scroll to first event time if date has events
              scrollToFirstEventTime(clickedDate, dayEvents);
            } else {
              // Scroll to a reasonable default time (8am) if no events
              calendar.scrollToTime('08:00:00');
            }
          }, 300);
        }, 100);
      });
      mini.appendChild(el);
      iter.setDate(iter.getDate() + 1);
    }
  }

  // Load events for mini calendar and render
  loadEventsForMiniCalendar();

  // Set initial selected date (today) in mini calendar and sync main calendar
  setTimeout(() => {
    const currentToday = new Date();
    currentToday.setHours(0, 0, 0, 0);
    const todayDate = currentToday.getDate();

    // Ensure mini calendar shows current month
    const currentMonth = currentToday.getMonth();
    const currentYear = currentToday.getFullYear();

    if (miniCursor.getMonth() !== currentMonth || miniCursor.getFullYear() !== currentYear) {
      miniCursor.setMonth(currentMonth);
      miniCursor.setFullYear(currentYear);
      miniCursor.setDate(1);
      renderMiniCalendar();
    }

    // Highlight today in mini calendar
    const miniDays = mini.querySelectorAll('.mini-day');
    miniDays.forEach(day => {
      const dayText = day.textContent.trim();
      if (dayText && !isNaN(dayText) && parseInt(dayText) === todayDate) {
        day.classList.add('mini-selected');
      }
    });

    // Ensure main calendar shows today's date in day view
    calendar.gotoDate(currentToday);
    if (calendar.view.type !== 'timeGridDay') {
      calendar.changeView('timeGridDay', currentToday);
    }
    calendar.render();
  }, 100);

  if (miniPrev) {
    miniPrev.addEventListener('click', () => {
      miniCursor.setMonth(miniCursor.getMonth() - 1);
      miniCursor.setDate(1); // Reset to first day of month
      loadEventsForMiniCalendar(); // This will render after loading events

      // Clear selection when month changes
      mini.querySelectorAll('.mini-selected').forEach(n => n.classList.remove('mini-selected'));
    });
  }
  if (miniNext) {
    miniNext.addEventListener('click', () => {
      miniCursor.setMonth(miniCursor.getMonth() + 1);
      miniCursor.setDate(1); // Reset to first day of month
      loadEventsForMiniCalendar(); // This will render after loading events

      // Clear selection when month changes
      mini.querySelectorAll('.mini-selected').forEach(n => n.classList.remove('mini-selected'));
    });
  }

  // Load departments and registered users
  loadDepartments();
  loadRegisteredUsers();

  // Department dropdown
  if (selectDepartmentBtn && departmentDropdown) {
    selectDepartmentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = selectDepartmentBtn.getBoundingClientRect();
      departmentDropdown.style.display = 'block';
      departmentDropdown.style.position = 'fixed';
      departmentDropdown.style.top = `${rect.bottom + 5}px`;
      departmentDropdown.style.left = `${rect.left}px`;
    });
  }

  if (closeDepartmentDropdown) {
    closeDepartmentDropdown.addEventListener('click', () => {
      departmentDropdown.style.display = 'none';
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (departmentDropdown && !departmentDropdown.contains(e.target) && e.target !== selectDepartmentBtn) {
      departmentDropdown.style.display = 'none';
    }
  });

  async function loadDepartments() {
    try {
      const res = await fetch('/api/users/departments', { credentials: 'same-origin' });
      if (!res.ok) { throw new Error('Failed to load departments'); }
      const data = await res.json();
      departmentsList = data.departments || [];
      renderDepartmentDropdown();
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  }

  function renderDepartmentDropdown() {
    if (!departmentList) return;
    departmentList.innerHTML = '';
    departmentsList.forEach(dept => {
      const item = document.createElement('div');
      item.className = 'department-item';
      const isSelected = participantsData.departments.includes(dept);
      item.innerHTML = `
        <label style="display: flex; align-items: center; cursor: pointer; width: 100%;">
          <input type="checkbox" value="${dept}" ${isSelected ? 'checked' : ''} style="margin-right: 0.5rem;" />
          <span>${dept}</span>
        </label>
      `;
      const checkbox = item.querySelector('input');
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (!participantsData.departments.includes(dept)) {
            participantsData.departments.push(dept);
          }
        } else {
          participantsData.departments = participantsData.departments.filter(d => d !== dept);
        }
        renderParticipantsChips();
      });
      departmentList.appendChild(item);
    });
  }

  async function loadRegisteredUsers() {
    try {
      const res = await fetch('/api/users/emails', { credentials: 'same-origin' });
      if (!res.ok) { throw new Error('Failed to load users'); }
      registeredUsers = await res.json();
    } catch (err) {
      console.error('Error loading registered users:', err);
    }
  }

  // Email autocomplete
  if (participantEmailInput && emailSuggestions) {
    let suggestionTimeout;
    participantEmailInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (!query) {
        emailSuggestions.classList.remove('show');
        return;
      }

      clearTimeout(suggestionTimeout);
      suggestionTimeout = setTimeout(() => {
        const matches = registeredUsers.filter(user => {
          const email = (user.email || '').toLowerCase();
          const name = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
          return email.includes(query) || name.includes(query);
        }).slice(0, 5);

        if (matches.length === 0) {
          emailSuggestions.classList.remove('show');
          return;
        }

        emailSuggestions.innerHTML = '';
        matches.forEach(user => {
          const li = document.createElement('li');
          li.innerHTML = `
            <span class="suggestion-email">${user.email}</span>
            <span class="suggestion-name">${user.firstName || ''} ${user.lastName || ''}</span>
          `;
          li.addEventListener('click', () => {
            addEmail(user.email);
            participantEmailInput.value = '';
            emailSuggestions.classList.remove('show');
          });
          emailSuggestions.appendChild(li);
        });
        emailSuggestions.classList.add('show');
      }, 200);
    });

    // Close suggestions when clicking outside
    const emailInputWrapper = participantEmailInput?.parentElement;
    document.addEventListener('click', (e) => {
      if (emailInputWrapper && emailSuggestions &&
          !emailInputWrapper.contains(e.target) &&
          !emailSuggestions.contains(e.target)) {
        emailSuggestions.classList.remove('show');
      }
    });

    // Handle Enter key
    participantEmailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const email = e.target.value.trim();
        if (email && validateEmail(email)) {
          // Check if email is registered
          const user = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
          if (user) {
            addEmail(email);
            e.target.value = '';
            emailSuggestions.classList.remove('show');
          } else {
            alert('Email not found. Please select from registered users.');
          }
        }
      }
    });
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function addEmail(email) {
    const normalizedEmail = email.toLowerCase().trim();
    if (!participantsData.emails.includes(normalizedEmail)) {
      participantsData.emails.push(normalizedEmail);
      renderParticipantsChips();
    }
  }

  function removeEmail(email) {
    participantsData.emails = participantsData.emails.filter(e => e !== email);
    renderParticipantsChips();
  }

  function removeDepartment(dept) {
    participantsData.departments = participantsData.departments.filter(d => d !== dept);
    renderParticipantsChips();
    renderDepartmentDropdown();
  }

  function renderParticipantsChips() {
    if (!participantsChipsContainer) return;
    participantsChipsContainer.innerHTML = '';

    // Render departments
    participantsData.departments.forEach(dept => {
      const chip = document.createElement('div');
      chip.className = 'participant-chip department';
      chip.innerHTML = `
        <span class="chip-label">${dept}</span>
        <button type="button" class="chip-remove" aria-label="Remove ${dept}">&times;</button>
      `;
      chip.querySelector('.chip-remove').addEventListener('click', () => removeDepartment(dept));
      participantsChipsContainer.appendChild(chip);
    });

    // Render emails
    participantsData.emails.forEach(email => {
      const chip = document.createElement('div');
      chip.className = 'participant-chip';
      chip.innerHTML = `
        <span class="chip-label">${email}</span>
        <button type="button" class="chip-remove" aria-label="Remove ${email}">&times;</button>
      `;
      chip.querySelector('.chip-remove').addEventListener('click', () => removeEmail(email));
      participantsChipsContainer.appendChild(chip);
    });

    // Update hidden input
    if (participantsHiddenInput) {
      participantsHiddenInput.value = JSON.stringify(participantsData);
    }
  }

  closeModalBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Navigation buttons are handled by FullCalendar header toolbar

  // Auto-refresh events every 60s
  setInterval(() => {
    try { calendar.refetchEvents(); } catch (e) { /* ignore */ }
  }, 60000);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      alert('Please add a title before saving');
      return;
    }

    const date = dateInput.value;
    const start = startInput.value;
    const end = endInput.value;
    const category = categorySelect.value;
    const description = descInput.value;

    // Validate required fields
    if (!date) {
      alert('Please select a date');
      return;
    }
    if (!start) {
      alert('Please select a start time');
      return;
    }
    if (!end) {
      alert('Please select an end time');
      return;
    }

    // Get participants data (departments and emails)
    const participants = participantsHiddenInput ? participantsHiddenInput.value : JSON.stringify(participantsData);

    // Format ISO date-time strings (date is YYYY-MM-DD, time is HH:MM)
    // Ensure we have valid timezone format
    const startISO = `${date}T${start}:00`;
    const endISO = `${date}T${end}:00`;

    console.log('Form data:', { date, start, end, startISO, endISO });

    // Show loading modal
    const successModal = document.getElementById('eventSuccessModal');
    const successLoader = document.getElementById('successLoader');
    const successCheck = document.getElementById('successCheck');
    const successMessage = document.getElementById('successMessage');

    function showSuccessModal(message, type = 'loading') {
      if (!successModal) return;
      successModal.style.display = 'flex';
      successLoader.style.display = type === 'loading' ? 'block' : 'none';
      successCheck.style.display = type === 'success' ? 'block' : 'none';
      successMessage.textContent = message;
      successMessage.className = `success-message ${type}`;
    }

    function hideSuccessModal() {
      if (successModal) {
        successModal.style.display = 'none';
      }
    }

    (async () => {
      try {
        // Show loading state
        showSuccessModal('Saving event...', 'loading');

        const editingSource = editingSourceInput.value;
        const editingId = editingIdInput.value;

        // Parse participants JSON
        let participantsObj;
        try {
          participantsObj = JSON.parse(participants);
        } catch {
          participantsObj = { departments: [], emails: [] };
        }

        if (editingSource === 'backend' && editingId) {
          const res = await fetch(`/api/calendar/events/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ title, start: startISO, end: endISO, category, description, participants: participantsObj })
          });
          if (!res.ok) { throw new Error('Failed to update'); }
        } else {
          console.log('Creating new event:', { title, start: startISO, end: endISO, category, description, participants: participantsObj });
          const res = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ title, start: startISO, end: endISO, category, description, participants: participantsObj })
          });
          console.log('Response status:', res.status, res.statusText);
          if (!res.ok) {
            const msg = await res.json().catch(() => ({ message: 'Failed to save' }));
            console.error('Failed to save event:', msg);
            throw new Error(msg.message || 'Failed to save');
          }
          const savedEvent = await res.json();
          console.log('Event saved successfully:', savedEvent);

          // Best-effort insert into Google Calendar if connected
          try {
            await fetch('/calendar/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ title, description, startISO, endISO, category })
            });
          } catch {
            // ignore insert failure
          }
        }

        // Show success state
        showSuccessModal('Event saved successfully!', 'success');

        // Refresh calendar
        calendar.refetchEvents();

        // Update mini calendar events after adding new event
        loadEventsForMiniCalendar();

        // Auto-close Add Event modal and success modal after delay
        setTimeout(() => {
          hideSuccessModal();
          closeModal();
        }, 1500); // 1.5 seconds to show the checkmark

      } catch (err) {
        console.error('Full error details:', err);
        // Show error in modal
        showSuccessModal(`Error: ${err.message || 'Failed to save event'}`, 'error');
        setTimeout(() => {
          hideSuccessModal();
        }, 2500);
      }
    })();
  });

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const editingSource = editingSourceInput.value;
      const editingId = editingIdInput.value;
      if (!editingId) { closeModal(); return; }
      if (!confirm('Delete this event?')) { return; }
      try {
        if (editingSource === 'backend') {
          const r = await fetch(`/api/calendar/events/${editingId}`, { method: 'DELETE', credentials: 'same-origin' });
          if (!r.ok) { throw new Error('Failed'); }
          // Also best-effort delete from Google if it was mirrored
          try { await fetch(`/calendar/events/${editingId}`, { method: 'DELETE', credentials: 'same-origin' }); } catch {
            // ignore delete mirror failure
          }
        }
        calendar.refetchEvents();
        loadEventsForMiniCalendar(); // Update mini calendar after deletion
        closeModal();
      } catch {
        alert('Delete failed');
      }
    });
  }

  } // End of initCalendar function
})();


