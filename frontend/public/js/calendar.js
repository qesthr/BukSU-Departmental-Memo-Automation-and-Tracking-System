/* global FullCalendar */
(function () {
  // Wait for DOM to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendar);
  } else {
    initCalendar();
  }

  // Custom Modal Functions
  function showConfirmModal(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const titleEl = document.getElementById('confirmModalTitle');
      const messageEl = document.getElementById('confirmModalMessage');
      const okBtn = document.getElementById('confirmModalOk');
      const cancelBtn = document.getElementById('confirmModalCancel');
      const closeBtn = document.getElementById('confirmModalClose');

      if (!modal) {
        // Fallback to browser confirm if modal doesn't exist
        resolve(confirm(message));
        return;
      }

      titleEl.textContent = title;
      messageEl.textContent = message;
      modal.style.display = 'flex';

      const cleanup = () => {
        modal.style.display = 'none';
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        closeBtn.onclick = null;
      };

      okBtn.onclick = () => {
        cleanup();
        resolve(true);
      };

      cancelBtn.onclick = () => {
        cleanup();
        resolve(false);
      };

      closeBtn.onclick = () => {
        cleanup();
        resolve(false);
      };

      // Close on overlay click
      const overlay = modal.querySelector('.custom-modal-overlay');
      overlay.onclick = () => {
        cleanup();
        resolve(false);
      };
    });
  }

  function showAlertModal(message, title = 'Notice') {
    return new Promise((resolve) => {
      const modal = document.getElementById('alertModal');
      const titleEl = document.getElementById('alertModalTitle');
      const messageEl = document.getElementById('alertModalMessage');
      const okBtn = document.getElementById('alertModalOk');
      const closeBtn = document.getElementById('alertModalClose');

      if (!modal) {
        // Fallback to browser alert if modal doesn't exist
        alert(message);
        resolve();
        return;
      }

      titleEl.textContent = title;
      messageEl.textContent = message;
      modal.style.display = 'flex';

      const cleanup = () => {
        modal.style.display = 'none';
        okBtn.onclick = null;
        closeBtn.onclick = null;
      };

      okBtn.onclick = () => {
        cleanup();
        resolve();
      };

      closeBtn.onclick = () => {
        cleanup();
        resolve();
      };

      // Close on overlay click
      const overlay = modal.querySelector('.custom-modal-overlay');
      overlay.onclick = () => {
        cleanup();
        resolve();
      };
    });
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
  const allDayCheckbox = document.getElementById('allDayCheckbox');
  const timeInputs = document.getElementById('timeInputs');

  // Participants data structure
  let participantsData = {
    departments: [],
    emails: []
  };
  let registeredUsers = [];
  let departmentsList = [];

  function normalizeDate(dateValue) {
    if (!dateValue) {return '';}
    // If it's already in yyyy-MM-dd format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    // Otherwise, try to extract just the date part
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {return '';}
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
      if (preset.description !== undefined) {descInput.value = preset.description || '';}
      if (preset.category) {categorySelect.value = preset.category;}
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
      if (descInput) {descInput.value = '';}
      if (categorySelect) {categorySelect.value = 'standard';}
      if (participantEmailInput) {participantEmailInput.value = '';}
    }
    renderParticipantsChips();
    renderDepartmentDropdown();

      if (preset && preset.edit) {
        editingSourceInput.value = preset.source || '';
        editingIdInput.value = preset.id || '';
        // Only show delete button if user is creator (backend events only)
        if (deleteBtn) {deleteBtn.style.display = (preset.source === 'backend' && preset.edit === true) ? 'block' : 'none';}

        // Disable all form fields if user is NOT the creator (read-only mode)
        const isReadOnly = preset.edit === false;
        if (isReadOnly) {
          if (titleInput) {titleInput.disabled = true;}
          if (dateInput) {dateInput.disabled = true;}
          if (startInput) {startInput.disabled = true;}
          if (endInput) {endInput.disabled = true;}
          if (categorySelect) {categorySelect.disabled = true;}
          if (descInput) {descInput.disabled = true;}
          if (allDayCheckbox) {allDayCheckbox.disabled = true;}
          if (participantEmailInput) {participantEmailInput.disabled = true;}
          if (selectDepartmentBtn) {selectDepartmentBtn.disabled = true;}
          // Hide form submit button or make it read-only
          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) {submitBtn.style.display = 'none';}
        } else {
          // Enable all fields if user is creator
          if (titleInput) {titleInput.disabled = false;}
          if (dateInput) {dateInput.disabled = false;}
          if (startInput) {startInput.disabled = false;}
          if (endInput) {endInput.disabled = false;}
          if (categorySelect) {categorySelect.disabled = false;}
          if (descInput) {descInput.disabled = false;}
          if (allDayCheckbox) {allDayCheckbox.disabled = false;}
          if (participantEmailInput) {participantEmailInput.disabled = false;}
          if (selectDepartmentBtn) {selectDepartmentBtn.disabled = false;}
          const submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) {submitBtn.style.display = 'block';}
        }
      } else {
        editingSourceInput.value = '';
        editingIdInput.value = '';
        if (deleteBtn) {deleteBtn.style.display = 'none';}
        // Enable all fields for new events
        if (titleInput) {titleInput.disabled = false;}
        if (dateInput) {dateInput.disabled = false;}
        if (startInput) {startInput.disabled = false;}
        if (endInput) {endInput.disabled = false;}
        if (categorySelect) {categorySelect.disabled = false;}
        if (descInput) {descInput.disabled = false;}
        if (allDayCheckbox) {allDayCheckbox.disabled = false;}
        if (participantEmailInput) {participantEmailInput.disabled = false;}
        if (selectDepartmentBtn) {selectDepartmentBtn.disabled = false;}
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {submitBtn.style.display = 'block';}
      }
      modal.style.display = 'grid';
  }
  function closeModal() {
    modal.style.display = 'none';
    form.reset();
  }

  function categoryColor(category) {
    switch (category) {
      case 'today': return '#fed7aa'; // Light orange
      case 'urgent': return '#fee2e2'; // Light red
      case 'standard': return '#d1fae5'; // Light green
      default: return '#d1fae5'; // Default to light green
    }
  }

  function formatEventTime(dateStr) {
    if (!dateStr) {return '';}
    const date = new Date(dateStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  }

  // Get calendar connection status (Google Calendar is optional)
  const isGoogleCalendarConnected = window.calendarConnected === true;

  // Define custom buttons
  const customButtons = {};
  let leftButtons = 'title';
  // Add view toggle buttons in order: Today, Week, Month
  // No Day view needed since Today button navigates to day view
  // FullCalendar will automatically capitalize the button labels
  const rightButtons = 'today timeGridWeek dayGridMonth';

  // ALWAYS show Add Event button - database calendar works without Google Calendar
  customButtons.addEventBtn = {
    text: 'Add Event',
    click: function() {
      openModal();
    }
  };
  leftButtons = 'addEventBtn ' + leftButtons;

  // Google Calendar connection is optional - show as secondary button
  if (isGoogleCalendarConnected) {
    customButtons.googleCalendarBtn = {
      text: '🔗 Google Calendar',
      click: async function() {
        const confirmed = await showConfirmModal(
          'Disconnect Google Calendar? Your events will still be saved in Memofy.',
          'Disconnect Google Calendar'
        );
        if (!confirmed) { return; }
        try {
          const res = await fetch('/calendar/disconnect', { method: 'DELETE', credentials: 'same-origin' });
          if (res.ok) {
            await showAlertModal('Google Calendar disconnected. Your Memofy events are still saved.', 'Disconnected');
            window.location.reload();
          } else {
            throw new Error('Failed to disconnect');
          }
        } catch (err) {
          await showAlertModal('Failed to disconnect Google Calendar', 'Error');
        }
      }
    };
    leftButtons = leftButtons + ' googleCalendarBtn';
  } else {
    // Optional: Show small connect button (less prominent)
    customButtons.googleCalendarBtn = {
      text: '🔗 Sync Google Calendar',
      click: async function() {
        const confirmed = await showConfirmModal(
          'Connect Google Calendar to sync your Memofy events with Google Calendar?\n\nYou can still use Memofy calendar without connecting.',
          'Connect Google Calendar'
        );
        if (confirmed) {
          window.location.href = '/calendar/auth';
        }
      }
    };
    leftButtons = leftButtons + ' googleCalendarBtn';
  }

  // Helper function to get current time in HH:MM:SS format (Manila timezone)
  function getCurrentTime() {
    const now = new Date();
    // Get time in Manila timezone
    const hours = now.toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false });
    const minutes = now.toLocaleString('en-US', { timeZone: 'Asia/Manila', minute: '2-digit' });
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
  }


  // Helper function to format dates in Manila timezone
  const formatDateManila = (d) => {
    const dateObj = new Date(d);
    const year = dateObj.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric' });
    const month = dateObj.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit' });
    const day = dateObj.toLocaleString('en-US', { timeZone: 'Asia/Manila', day: '2-digit' });
    return `${year}-${month}-${day}`;
  };

  // Helper function to get today's date in Manila timezone as a Date object
  const getTodayInManila = () => {
    const now = new Date();
    // Get date components in Manila timezone
    const year = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric' }));
    const month = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit' })) - 1; // Month is 0-indexed
    const day = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', day: '2-digit' }));
    // Create date at midnight in local timezone (will be interpreted correctly by FullCalendar with timeZone setting)
    return new Date(year, month, day, 0, 0, 0, 0);
  };

  // Mini calendar variables - declare early so they're available in calendar callbacks
  const today = getTodayInManila(); // Use Manila timezone for today
  const miniCursor = new Date(today.getFullYear(), today.getMonth(), 1);
  let miniCalendarEvents = []; // Store events for mini calendar indicators
  let selectedDate = new Date(today); // Track the currently selected date (default to today in Manila timezone)

    const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridDay',
    initialDate: today, // Start with today (in Manila timezone)
    timeZone: 'Asia/Manila', // Explicitly set to Philippines timezone (GMT+8)
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
    allDaySlot: true, // Enable all-day section to show holidays and all-day events
    slotDuration: '00:30:00', // 30-minute slots
    slotMinTime: '01:00:00', // Start from 1 AM (matching Google Calendar default)
    slotMaxTime: '24:00:00', // Show full 24 hours
    slotLabelInterval: '00:30:00', // Show time labels every 30 minutes (9:00, 9:30, 10:00, 10:30, etc.)
    slotLabelFormat: {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    },
    scrollTime: getCurrentTime(), // Scroll to current time initially (makes it visible first)
    // Configure views with custom button labels
    views: {
      timeGridDay: {
        titleFormat: { year: 'numeric', month: 'long', day: 'numeric' },
        buttonText: 'Day'
      },
      timeGridWeek: {
        titleFormat: { year: 'numeric', month: 'long', day: 'numeric' },
        slotDuration: '00:30:00',
        slotMinTime: '01:00:00', // Start from 1 AM (matching Google Calendar default)
        slotMaxTime: '24:00:00',
        slotLabelInterval: '00:30:00', // Show time labels every 30 minutes
        slotLabelFormat: {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        },
        allDaySlot: true, // Enable all-day slot for week view to show events properly
        buttonText: 'Week'
      },
      dayGridMonth: {
        titleFormat: { year: 'numeric', month: 'long' },
        buttonText: 'Month'
      }
    },
    // Customize Today button text
    buttonText: {
      today: 'Today'
    },
    eventDidMount: function(info) {
      console.log('🎨 Event rendered in calendar:', {
        id: info.event.id,
        title: info.event.title,
        start: info.event.start,
        end: info.event.end,
        allDay: info.event.allDay,
        element: info.el
      });
    },
    eventWillUnmount: function(info) {
      console.log('🗑️ Event removed from calendar:', info.event.title);
    },
    datesSet: function(dateInfo) {
      // Update selected date based on main calendar view
      const viewDate = dateInfo.start;
      selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate());

      // Update mini calendar when main calendar view changes
      renderMiniCalendar();

      // Log view change for debugging
      const currentViewType = dateInfo.view.type;
      console.log(`📅 View changed to: ${currentViewType}`, {
        start: dateInfo.start.toISOString(),
        end: dateInfo.end.toISOString(),
        startStr: dateInfo.startStr,
        endStr: dateInfo.endStr
      });

      // Force refresh events when switching to week view to ensure they display
      if (currentViewType === 'timeGridWeek') {
        console.log('🔄 Week view detected - ensuring events are loaded...');
        setTimeout(() => {
          calendar.refetchEvents();
          calendar.render();
        }, 100);
      }

      // Auto-scroll to current time or first event
      setTimeout(() => {
        // Compare dates in Manila timezone
        const isToday = (date) => {
          const today = new Date();
          const todayStr = formatDateManila(today);
          const dateStr = formatDateManila(date);
          return todayStr === dateStr;
        };

        if (isToday(viewDate)) {
          // For today, scroll to current time so it's visible
          setTimeout(() => {
            const currentTime = getCurrentTime();
            console.log('📅 Scrolling to current time:', currentTime);
            calendar.scrollToTime(currentTime);

            // Also ensure the calendar renders after scrolling
            setTimeout(() => {
              calendar.render();
            }, 50);
          }, 300);
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
      // FullCalendar with timeZone: 'Asia/Manila' provides info.dateStr in the configured timezone
      // Extract time from dateStr which is already in Asia/Manila timezone
      let timeStr = '08:00'; // Default time

      if (info.dateStr && info.dateStr.includes('T')) {
        // Extract HH:mm from dateStr (format: YYYY-MM-DDTHH:mm:ss[+/-]HH:mm)
        const timeMatch = info.dateStr.match(/T(\d{2}):(\d{2})/);
        if (timeMatch) {
          timeStr = `${timeMatch[1]}:${timeMatch[2]}`;
        } else {
          // Alternative: try substring method
          const timePart = info.dateStr.substring(11, 16);
          if (timePart && /^\d{2}:\d{2}$/.test(timePart)) {
            timeStr = timePart;
          }
        }
      } else {
        // Fallback: convert Date to Asia/Manila timezone and extract hours/minutes
        const phTimeStr = clickedDate.toLocaleString('en-US', {
          timeZone: 'Asia/Manila',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: undefined
        });
        // Parse HH:mm from locale string (e.g., "16:00" or "4:00 PM")
        const timeMatch = phTimeStr.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const hours = String(timeMatch[1]).padStart(2, '0');
          const minutes = timeMatch[2];
          timeStr = `${hours}:${minutes}`;
        }
      }

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

      // Ensure calendar is in timeGridDay view and navigate to clicked date
      // This ensures events for that date are visible
      if (calendar.view.type !== 'timeGridDay') {
        calendar.changeView('timeGridDay', clickedDate);
      } else {
        // If already in day view, navigate to the clicked date
        calendar.gotoDate(clickedDate);
      }

      // Force refresh events for the clicked date to ensure newly created events are visible
      setTimeout(() => {
        console.log('🔄 Refreshing events after date click:', clickedDate.toISOString());
        calendar.refetchEvents();
        calendar.render();
      }, 100);

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
      console.log('🖱️ Event clicked:', {
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        startStr: e.startStr,
        endStr: e.endStr
      });

      // Get original title if available (from extendedProps)
      const originalTitle = e.extendedProps?.originalTitle || e.title.split(' at ')[0];
      const source = e.id.startsWith('gcal_') ? 'google' : 'backend';
      const isAllDay = e.allDay || e.extendedProps?.allDay || false;
      const isCreator = e.extendedProps?.isCreator !== false; // Default to true if not set (for Google events)

      // If user is NOT the creator and it's a backend event, open read-only modal (no redirect)
      // We will fetch full event details below and pass edit: false

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
      // Extract date and time in Asia/Manila timezone for accurate display
      const eventStartDate = new Date(e.start);
      const eventEndDate = e.end ? new Date(e.end) : null;

      // Get date string in YYYY-MM-DD format (using Asia/Manila timezone)
      const dateStr = eventStartDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // en-CA gives YYYY-MM-DD format

      let startTime = '';
      let endTime = '';

      if (!isAllDay) {
        // Extract time in HH:mm format from Asia/Manila timezone
        const startTimeStr = eventStartDate.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Manila',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit'
        });
        startTime = startTimeStr.match(/(\d{2}:\d{2})/)?.[1] || '';

        if (eventEndDate) {
          const endTimeStr = eventEndDate.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Manila',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });
          endTime = endTimeStr.match(/(\d{2}:\d{2})/)?.[1] || '';
        }
      }

      console.log('📋 Opening modal with event data:', {
        title: originalTitle,
        date: dateStr,
        start: startTime,
        end: endTime,
        category: category,
        isCreator: isCreator,
        source: source
      });

        openModal({
        title: originalTitle,
        date: dateStr,
        start: startTime,
        end: endTime,
        allDay: isAllDay,
          edit: isCreator, // Non-creators get read-only modal
        id: e.id,
        source: source,
        participants: participants,
        description: description,
        category: category
      });
    },
    async eventDrop(info) {
      try {
        // Format dates with Manila timezone (+08:00)
        const formatDateTimeManila = (date) => {
          const d = new Date(date);
          const year = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric' });
          const month = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit' });
          const day = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', day: '2-digit' });
          const hours = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false });
          const minutes = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', minute: '2-digit' });
          const seconds = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', second: '2-digit' });
          return `${year}-${month}-${day}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}+08:00`;
        };

        const res = await fetch(`/api/calendar/events/${info.event.id}/time`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            start: formatDateTimeManila(info.event.start),
            end: formatDateTimeManila(info.event.end || info.event.start)
          })
        });
        if (!res.ok) { throw new Error('Failed to update schedule'); }
      } catch (err) {
        info.revert();
        await showAlertModal(err.message || 'Update failed', 'Error');
      }
    },
    async eventResize(info) {
      try {
        // Format dates with Manila timezone (+08:00)
        const formatDateTimeManila = (date) => {
          const d = new Date(date);
          const year = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric' });
          const month = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit' });
          const day = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', day: '2-digit' });
          const hours = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false });
          const minutes = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', minute: '2-digit' });
          const seconds = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', second: '2-digit' });
          return `${year}-${month}-${day}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}+08:00`;
        };

        const res = await fetch(`/api/calendar/events/${info.event.id}/time`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            start: formatDateTimeManila(info.event.start),
            end: formatDateTimeManila(info.event.end)
          })
        });
        if (!res.ok) { throw new Error('Failed to update schedule'); }
      } catch (err) {
        info.revert();
        await showAlertModal(err.message || 'Update failed', 'Error');
      }
    },
      events: async function(fetchInfo, success, failure) {
      try {
          // Remove onlyCreatedByMe filter to show all events user should see (created + participant)
          const qs = new URLSearchParams({ start: fetchInfo.startStr, end: fetchInfo.endStr });
        console.log('🔍 Fetching events for date range:', fetchInfo.startStr, 'to', fetchInfo.endStr);
        // Note: Cannot access calendar.view here as calendar is not yet initialized
        // View type will be available after calendar is created
        console.log('📅 View date range:', {
          start: fetchInfo.start ? new Date(fetchInfo.start).toISOString() : 'N/A',
          end: fetchInfo.end ? new Date(fetchInfo.end).toISOString() : 'N/A',
          startStr: fetchInfo.startStr,
          endStr: fetchInfo.endStr
        });
        const res = await fetch(`/api/calendar/events?${qs.toString()}`, { credentials: 'same-origin' });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('❌ Failed to load events:', res.status, res.statusText, errorText);
          throw new Error('Failed to load events');
        }
        const data = await res.json();
        console.log('📅 Events received from server:', data.length, 'events');
        console.log('📅 Event details:', data);
        console.log('📅 Date range requested:', fetchInfo.startStr, 'to', fetchInfo.endStr);
        console.log('📅 Date range (parsed):', new Date(fetchInfo.start), 'to', new Date(fetchInfo.end));

        // If no events, check if we should warn about date range
        if (data.length === 0) {
          console.warn('⚠️ No events returned. This could mean:');
          console.warn('   1. No events exist in this date range');
          console.warn('   2. Events exist but are filtered out');
          console.warn('   3. Date range mismatch');
          console.warn('   Check server logs for filtering details');
        }

        // Log raw event data structure
        if (data.length > 0) {
          console.log('📋 First event raw data:', {
            title: data[0].title,
            start: data[0].start,
            startType: typeof data[0].start,
            end: data[0].end,
            endType: typeof data[0].end,
            allDay: data[0].allDay,
            category: data[0].category,
            fullEvent: data[0]
          });
        } else {
          console.warn('⚠️ No events returned from API for this date range');
        }

        // Log if events exist - use fetchInfo.start to check the requested date range
        if (data.length > 0) {
          const firstEventDate = new Date(data[0].start);
          const requestedStartDate = new Date(fetchInfo.start);
          const eventDateStr = formatDateManila(firstEventDate);
          const requestedDateStr = formatDateManila(requestedStartDate);
          if (eventDateStr !== requestedDateStr) {
            console.log(`⚠️ Event exists on ${eventDateStr} but calendar requested ${requestedDateStr}`);
            console.log(`💡 Navigate to ${eventDateStr} to see the event`);
          }
        }

        console.log(`🔄 Processing ${data.length} events from API...`);
        const localEvents = data.map((e, index) => {
          try {
            console.log(`   Processing event ${index + 1}/${data.length}: "${e.title || 'NO TITLE'}"`);
            const timeStr = formatEventTime(e.start);
            const eventTitle = timeStr ? `${e.title} at ${timeStr}` : e.title;

            // Handle all-day events
            const isAllDay = e.allDay || false;
            // For all-day events, use just the date part (no time)
            let startDate = e.start;
            let endDate = e.end;

            // Convert date strings to Date objects for FullCalendar
            // FullCalendar expects Date objects, not strings
            // When MongoDB dates are serialized via JSON, they become ISO strings
            if (typeof e.start === 'string') {
              // Parse ISO string to Date object
              startDate = new Date(e.start);
              // Validate the parsed date
              if (isNaN(startDate.getTime())) {
                console.error(`❌ Failed to parse start date string "${e.start}"`);
                return null;
              }
            } else if (e.start instanceof Date) {
              startDate = e.start;
            } else if (e.start && typeof e.start === 'object') {
              // Handle MongoDB Date objects or other date-like objects
              if (e.start.toDate && typeof e.start.toDate === 'function') {
                startDate = e.start.toDate();
              } else if (e.start.$date) {
                // Handle MongoDB extended JSON format
                startDate = new Date(e.start.$date);
              } else {
                // Try to convert to Date
                startDate = new Date(e.start);
              }
            } else {
              console.error(`❌ Unexpected start date type for event "${e.title}":`, typeof e.start, e.start);
              return null;
            }

            if (typeof e.end === 'string') {
              // Parse ISO string to Date object
              endDate = new Date(e.end);
              // Validate the parsed date
              if (isNaN(endDate.getTime())) {
                console.error(`❌ Failed to parse end date string "${e.end}"`);
                return null;
              }
            } else if (e.end instanceof Date) {
              endDate = e.end;
            } else if (e.end && typeof e.end === 'object') {
              // Handle MongoDB Date objects or other date-like objects
              if (e.end.toDate && typeof e.end.toDate === 'function') {
                endDate = e.end.toDate();
              } else if (e.end.$date) {
                // Handle MongoDB extended JSON format
                endDate = new Date(e.end.$date);
              } else {
                // Try to convert to Date
                endDate = new Date(e.end);
              }
            } else {
              console.error(`❌ Unexpected end date type for event "${e.title}":`, typeof e.end, e.end);
              return null;
            }

            // Validate dates
            if (!startDate || isNaN(startDate.getTime())) {
              console.error(`❌ Invalid start date for event "${e.title}":`, e.start);
              return null;
            }
            if (!endDate || isNaN(endDate.getTime())) {
              console.error(`❌ Invalid end date for event "${e.title}":`, e.end);
              return null;
            }

            if (isAllDay) {
              // Convert to date-only format for all-day events
              const start = new Date(startDate);
              start.setHours(0, 0, 0, 0);
              startDate = start;

              const end = new Date(endDate);
              end.setHours(23, 59, 59, 999);
              endDate = end;
            }

            // Ensure dates are proper Date objects (not strings) for FullCalendar
            // FullCalendar with timeZone works best with Date objects
            const finalStartDate = startDate instanceof Date ? startDate : new Date(startDate);
            const finalEndDate = endDate instanceof Date ? endDate : new Date(endDate);

            // Validate the dates one more time
            if (isNaN(finalStartDate.getTime()) || isNaN(finalEndDate.getTime())) {
              console.error(`❌ Invalid date conversion for event "${e.title}":`, {
                startDate: startDate,
                endDate: endDate,
                finalStartDate: finalStartDate,
                finalEndDate: finalEndDate
              });
              return null;
            }

            // For FullCalendar with timeZone, ensure dates are properly formatted
            // FullCalendar with timeZone expects Date objects that represent the correct moment in time
            // IMPORTANT: For month view, we need to ensure the date represents the correct day in Manila timezone
            // to prevent events from appearing on the wrong day due to timezone conversion

            // Get the date in Manila timezone (same logic as mini calendar uses)
            const eventDateInManila = formatDateManila(finalStartDate);
            const [year, month, day] = eventDateInManila.split('-').map(Number);

            // For month view, FullCalendar determines which day cell to use based on the date component
            // We need to ensure the Date object represents the correct day when FullCalendar converts it
            // Create a date that represents the correct day in Manila timezone
            // This ensures month view shows events on the same day as mini calendar
            let dateForDisplay = finalStartDate;

            if (!isAllDay) {
              // For timed events, we need to ensure the date component is correct for month view
              // Extract date components in Manila timezone (same as mini calendar logic)
              const manilaYear = parseInt(finalStartDate.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric' }));
              const manilaMonth = parseInt(finalStartDate.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit' })) - 1; // 0-indexed
              const manilaDay = parseInt(finalStartDate.toLocaleString('en-US', { timeZone: 'Asia/Manila', day: '2-digit' }));
              const manilaHours = parseInt(finalStartDate.toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }));
              const manilaMinutes = parseInt(finalStartDate.toLocaleString('en-US', { timeZone: 'Asia/Manila', minute: '2-digit' }));

              // Create a new date with the correct date components in local timezone
              // This ensures FullCalendar's month view places the event on the correct day
              // We use the local timezone constructor but with Manila timezone values
              // FullCalendar will then convert this correctly with its timeZone setting
              dateForDisplay = new Date(manilaYear, manilaMonth, manilaDay, manilaHours, manilaMinutes, 0);

              // Verify the date is still correct
              const verifiedDate = formatDateManila(dateForDisplay);
              if (verifiedDate !== eventDateInManila) {
                console.warn(`⚠️ Date correction issue for event "${e.title}": Expected ${eventDateInManila}, got ${verifiedDate}. Using original date.`);
                dateForDisplay = finalStartDate; // Fallback to original
              }
            }

            // Log the date for debugging month view issues
            console.log(`📅 Event "${e.title}" - Date in Manila timezone: ${eventDateInManila}`, {
              originalStart: e.start,
              parsedStart: finalStartDate.toISOString(),
              displayDate: dateForDisplay.toISOString(),
              manilaDate: eventDateInManila,
              verified: formatDateManila(dateForDisplay)
            });

            const eventObj = {
              id: String(e._id), // Ensure ID is a string
              title: isAllDay ? e.title : eventTitle, // Don't add time for all-day events
              // Use the corrected date for display to ensure month view shows correct day
              start: dateForDisplay instanceof Date ? dateForDisplay : new Date(dateForDisplay),
              end: finalEndDate instanceof Date ? finalEndDate : new Date(finalEndDate),
              allDay: isAllDay,
              backgroundColor: categoryColor(e.category),
              borderColor: categoryColor(e.category),
              textColor: e.category === 'urgent' ? '#991b1b' : e.category === 'today' ? '#9a3412' : '#065f46',
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

            // Additional validation: ensure dates are valid and not NaN
            if (isNaN(eventObj.start.getTime()) || isNaN(eventObj.end.getTime())) {
              console.error(`❌ Event "${e.title}" has invalid dates after final conversion:`, {
                start: eventObj.start,
                end: eventObj.end,
                startISO: eventObj.start.toISOString(),
                endISO: eventObj.end.toISOString()
              });
              return null;
            }

            // Final validation - ensure the event object is valid
            if (!eventObj.id || !eventObj.title || !eventObj.start || !eventObj.end) {
              console.error(`❌ Event object missing required fields:`, eventObj);
              return null;
            }

            // Check if event is within the requested date range
            const requestedStart = new Date(fetchInfo.start);
            const requestedEnd = new Date(fetchInfo.end);
            const eventStart = finalStartDate;
            const eventEnd = finalEndDate;

            // FullCalendar shows events that overlap with the date range
            // Event is visible if: eventStart < requestedEnd AND eventEnd > requestedStart
            const isInRange = eventStart < requestedEnd && eventEnd > requestedStart;

            // Note: This warning is informational - FullCalendar will still render events
            // that are slightly outside the range if they're close enough
            // The warning helps debug why events might not appear
            // IMPORTANT: We don't filter events here - let FullCalendar handle rendering
            // FullCalendar will automatically show/hide events based on the view's date range
            if (!isInRange) {
              const eventDateStr = formatDateManila(eventStart);
              const requestedDateStr = formatDateManila(requestedStart);
              console.warn(`⚠️ Event "${e.title}" date (${eventDateStr}) is outside requested range (${requestedDateStr})`);
              console.warn('   This is normal if you navigate to a different date. FullCalendar will fetch events when you navigate.');
            }

            // Enhanced logging with date information
            const startInManila = finalStartDate.toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'long' });
            const endInManila = finalEndDate.toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'long' });
            const startDateOnly = finalStartDate.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
            console.log(`📌 Event "${e.title}":`, {
              id: e._id,
              start: finalStartDate,
              end: finalEndDate,
              startInManila: startInManila,
              endInManila: endInManila,
              startDateOnly: startDateOnly,
              category: e.category,
              isCreator: e.isCreator,
              isInRange: isInRange,
              startDateType: typeof finalStartDate,
              endDateType: typeof finalEndDate,
              rawStart: e.start,
              rawEnd: e.end
            });

            console.log(`   ✅ Successfully processed event "${e.title}"`);
            return eventObj;
          } catch (err) {
            console.error(`❌ Error processing event "${e.title || 'UNNAMED'}":`, err);
            console.error('   Event data:', e);
            return null;
          }
        }).filter(event => event !== null); // Remove any null events (invalid dates)

        console.log(`📊 Processed ${localEvents.length} valid events out of ${data.length} total`);
        if (localEvents.length < data.length) {
          console.warn(`⚠️ ${data.length - localEvents.length} events were filtered out during processing`);
        }

        // Try to append Google Calendar events if connected; failures are ignored
        let googleEvents = [];
        // Only fetch Google Calendar events if user has connected their calendar
        if (window.calendarConnected) {
          try {
            // Ensure dates are formatted with timezone for Google Calendar API (RFC3339 format)
            // FullCalendar's startStr and endStr might not include timezone when timeZone is set
            const formatForGoogleAPI = (dateStr) => {
              if (!dateStr) {return dateStr;}
              // If already has timezone, return as is
              if (/[+-]\d{2}:\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) {
                return dateStr;
              }
              // If has time but no timezone, add Philippines timezone
              if (dateStr.includes('T')) {
                return `${dateStr}+08:00`;
              }
              // If date only, add time and timezone
              return `${dateStr}T00:00:00+08:00`;
            };

            const timeMin = formatForGoogleAPI(fetchInfo.startStr);
            const timeMax = formatForGoogleAPI(fetchInfo.endStr);

            console.log('📅 Google Calendar API request:', { timeMin, timeMax });

            const r2 = await fetch(`/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { credentials: 'same-origin' });
            if (r2.ok) {
              const gItems = await r2.json();
              console.log(`📅 Received ${gItems.length} Google Calendar events`);
              googleEvents = (gItems || []).map(ev => {
                // Google Calendar API returns RFC3339 strings, FullCalendar can parse them
                // Ensure allDay is explicitly set
                const isGoogleAllDay = ev.start.date ? true : false;
                const isHoliday = ev.isHoliday === true;

                // Style holidays differently - use gold color for holidays
                const backgroundColor = isHoliday ? '#FFD700' : '#4285F4'; // Gold for holidays, blue for regular events
                const borderColor = isHoliday ? '#FFC107' : '#4285F4';
                const textColor = isHoliday ? '#000000' : '#ffffff'; // Black text on gold for better readability

                // For all-day events, Google Calendar uses exclusive end dates
                // FullCalendar expects inclusive end dates, so we need to adjust
                let eventStart = isGoogleAllDay ? ev.start.date : ev.start.dateTime;
                let eventEnd = isGoogleAllDay ? ev.end.date : ev.end.dateTime;

                // For all-day events, convert date strings to Date objects for proper month view display
                if (isGoogleAllDay) {
                  // Adjust end date (Google uses exclusive, FullCalendar uses inclusive)
                  if (eventEnd) {
                    const endDate = new Date(eventEnd);
                    endDate.setDate(endDate.getDate() - 1); // Subtract one day
                    eventEnd = endDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                  }

                  // Convert start date string to Date object for month view compatibility
                  // Use midnight in local timezone to ensure correct day display
                  if (eventStart && typeof eventStart === 'string') {
                    const [year, month, day] = eventStart.split('-').map(Number);
                    eventStart = new Date(year, month - 1, day, 0, 0, 0, 0); // Create Date in local timezone
                  }

                  // Convert end date string to Date object
                  if (eventEnd && typeof eventEnd === 'string') {
                    const [year, month, day] = eventEnd.split('-').map(Number);
                    eventEnd = new Date(year, month - 1, day, 23, 59, 59, 999); // End of day
                  }
                }

                if (isHoliday) {
                  console.log(`🎉 Processing holiday: "${ev.summary}"`, {
                    start: eventStart,
                    end: eventEnd,
                    allDay: isGoogleAllDay,
                    originalStart: ev.start.date,
                    originalEnd: ev.end.date
                  });
                }

                return {
                  id: 'gcal_' + ev.id,
                  title: isHoliday ? `🎉 ${ev.summary || '(no title)'}` : (ev.summary || '(no title)'),
                  start: eventStart,
                  end: eventEnd,
                  allDay: isGoogleAllDay,
                  backgroundColor: backgroundColor,
                  borderColor: borderColor,
                  textColor: textColor,
                  classNames: isHoliday ? ['fc-event-google', 'fc-event-holiday'] : ['fc-event-google'],
                  editable: false, // Google Calendar events are not editable in Memofy
                  extendedProps: {
                    source: 'google',
                    isHoliday: isHoliday,
                    htmlLink: ev.htmlLink,
                    description: ev.description
                  }
                };
              });
            }
          } catch (err) {
            console.error('❌ Error fetching or processing Google Calendar events:', err);
            googleEvents = []; // Ensure it's an empty array on error
          }
        } else {
          console.log('ℹ️ Google Calendar not connected for this user. Skipping Google Calendar events.');
        }

          const formatted = [...localEvents, ...googleEvents];

          console.log(`✅ Successfully formatted ${formatted.length} events for FullCalendar`);
          console.log(`   📊 Database events: ${localEvents.length}`);
          console.log(`   📊 Google Calendar events: ${googleEvents.length}`);

          // Summary of what should be displayed
          if (formatted.length > 0) {
            console.log(`\n🎨 Events will be displayed as colored blocks:`);
            formatted.forEach((evt, idx) => {
              const color = evt.backgroundColor || categoryColor(evt.extendedProps?.category);
              const category = evt.extendedProps?.category || 'standard';
              console.log(`   ${idx + 1}. "${evt.title}" - ${category} category (${color})`);
            });
          }

          console.log(`   📊 Formatted events array:`, formatted);

          // Log details of each formatted event before validation
          if (formatted.length > 0) {
            console.log('📋 Formatted events details:');
            formatted.forEach((evt, idx) => {
              console.log(`   ${idx + 1}. "${evt?.title || 'NO TITLE'}"`, {
                id: evt?.id,
                start: evt?.start,
                end: evt?.end,
                startType: typeof evt?.start,
                endType: typeof evt?.end,
                isDateStart: evt?.start instanceof Date,
                isDateEnd: evt?.end instanceof Date
              });
            });
          } else {
            console.warn('⚠️ No events in formatted array! Check if localEvents or googleEvents have data.');
            console.log('   localEvents:', localEvents);
            console.log('   googleEvents:', googleEvents);
          }

          formatted.forEach((evt, idx) => {
            const startDate = new Date(evt.start);
            const endDate = new Date(evt.end);
            const startInManila = startDate.toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'long' });
            const endInManila = endDate.toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'long' });
            const startDateOnly = startDate.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
            const source = evt.id.startsWith('gcal_') ? 'Google Calendar' : 'Database';
            console.log(`  ${idx + 1}. "${evt.title}" (${source})`);
            console.log(`     ID: ${evt.id}`);
            console.log(`     Start: ${evt.start} (${startInManila})`);
            console.log(`     End: ${evt.end} (${endInManila})`);
            console.log(`     Start Date (Manila): ${startDateOnly}`);
            console.log(`     AllDay: ${evt.allDay}`);
            console.log(`     Category: ${evt.extendedProps?.category || 'standard'}`);
            console.log(`     Full event object:`, evt);
          });

          // Log the date range being requested
          const rangeStartManila = new Date(fetchInfo.startStr).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });
          const rangeEndManila = new Date(fetchInfo.endStr).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });
          console.log(`📅 Date range requested (Manila time): ${rangeStartManila} to ${rangeEndManila}`);
          console.log(`📅 Date range requested (raw): ${fetchInfo.startStr} to ${fetchInfo.endStr}`);

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

          // Verify events are valid before passing to FullCalendar
          const validEvents = formatted.filter(evt => {
            if (!evt) {
              console.error('❌ Event is null or undefined');
              return false;
            }
            if (!evt.start || !evt.end) {
              console.error('❌ Event missing start/end:', evt);
              return false;
            }
            // Check if dates are valid Date objects
            const startDate = evt.start instanceof Date ? evt.start : new Date(evt.start);
            const endDate = evt.end instanceof Date ? evt.end : new Date(evt.end);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              console.error('❌ Event has invalid dates:', {
                event: evt,
                start: evt.start,
                end: evt.end,
                startDate: startDate,
                endDate: endDate
              });
              return false;
            }
            return true;
          });

          if (validEvents.length !== formatted.length) {
            console.warn(`⚠️ Filtered out ${formatted.length - validEvents.length} invalid events out of ${formatted.length} total`);
            console.log('📋 Invalid events that were filtered:', formatted.filter(evt => {
              if (!evt || !evt.start || !evt.end) {
                return true;
              }
              const startDate = evt.start instanceof Date ? evt.start : new Date(evt.start);
              const endDate = evt.end instanceof Date ? evt.end : new Date(evt.end);
              return isNaN(startDate.getTime()) || isNaN(endDate.getTime());
            }));
          }

          console.log(`✅ Passing ${validEvents.length} valid events to FullCalendar`);
          console.log('📋 Events being passed:', validEvents);

          // Log each event's key properties before passing
          validEvents.forEach((evt, idx) => {
            console.log(`   Event ${idx + 1}: "${evt.title}"`, {
              id: evt.id,
              start: evt.start,
              end: evt.end,
              startISO: evt.start.toISOString(),
              endISO: evt.end.toISOString(),
              allDay: evt.allDay,
              backgroundColor: evt.backgroundColor
            });
          });

          console.log(`🚀 Calling success() with ${validEvents.length} events`);

          // Pass valid events to FullCalendar
          // Note: FullCalendar will replace all events with the new array, so we don't need to manually clear
          success(validEvents);

          // Force a render after passing events to ensure they're displayed
          setTimeout(() => {
            try {
              calendar.render();
              console.log('🔄 Forced calendar render after passing events');
            } catch (err) {
              console.warn('⚠️ Could not force render:', err);
            }
          }, 100);

          // IMPORTANT: If we passed 0 events but FullCalendar still has events, clear them manually
          // This handles the case where FullCalendar doesn't properly clear on empty array
          if (validEvents.length === 0) {
            setTimeout(() => {
              try {
                const currentEvents = calendar.getEvents();
                if (currentEvents.length > 0) {
                  console.log(`🧹 Clearing ${currentEvents.length} stale event(s) from FullCalendar`);
                  currentEvents.forEach(evt => {
                    evt.remove();
                  });
                }
              } catch (err) {
                console.warn('⚠️ Could not clear stale events (calendar not ready):', err);
              }
            }, 100);
          }

          // After a short delay, check if events were actually rendered
          setTimeout(() => {
            const renderedEvents = calendar.getEvents();
            console.log(`🔍 FullCalendar reports ${renderedEvents.length} rendered events`);
            if (renderedEvents.length !== validEvents.length) {
              console.warn(`⚠️ Mismatch! Passed ${validEvents.length} events but FullCalendar has ${renderedEvents.length} rendered`);
              if (renderedEvents.length > 0) {
                console.log('📋 Rendered events:');
                renderedEvents.forEach(evt => {
                  console.log(`   - "${evt.title}" (${evt.id}) - Start: ${evt.start}, End: ${evt.end}`);
                });
              }
              if (validEvents.length > 0) {
                console.log('📋 Events that should have been rendered:');
                validEvents.forEach(evt => {
                  console.log(`   - "${evt.title}" (${evt.id}) - Start: ${evt.start}, End: ${evt.end}`);
                });

                // Try to manually add events if they weren't rendered
                console.log('🔄 Attempting to manually add events to FullCalendar...');
                validEvents.forEach(evt => {
                  try {
                    const existing = calendar.getEventById(evt.id);
                    if (!existing) {
                      // Ensure event dates are valid Date objects and properly formatted
                      const startDate = evt.start instanceof Date ? evt.start : new Date(evt.start);
                      const endDate = evt.end instanceof Date ? evt.end : new Date(evt.end);

                      // Validate dates before adding
                      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                        console.error(`   ❌ Event "${evt.title}" has invalid dates, skipping manual add`);
                        return;
                      }

                      const eventToAdd = {
                        ...evt,
                        start: startDate,
                        end: endDate
                      };

                      // Use addEvent with proper date objects
                      const addedEvent = calendar.addEvent(eventToAdd);
                      if (addedEvent) {
                        console.log(`   ✅ Manually added event: "${evt.title}" at ${startDate.toISOString()}`);
                      } else {
                        console.warn(`   ⚠️ addEvent returned null for "${evt.title}"`);
                      }
                    } else {
                      console.log(`   ℹ️ Event "${evt.title}" already exists in calendar`);
                    }
                  } catch (err) {
                    console.error(`   ❌ Failed to manually add event "${evt.title}":`, err);
                    console.error('   Event data:', {
                      id: evt.id,
                      title: evt.title,
                      start: evt.start,
                      end: evt.end,
                      startType: typeof evt.start,
                      endType: typeof evt.end
                    });
                  }
                });

                // Force render after manually adding events
                setTimeout(() => {
                  try {
                    calendar.render();
                    console.log('🔄 Forced render after manually adding events');
                  } catch (err) {
                    console.warn('⚠️ Could not force render after manual add:', err);
                  }
                }, 200);
              }
            } else {
              console.log(`✅ Success! All ${validEvents.length} events were rendered correctly`);
            }

            // Final check - verify events are visible in the DOM
            setTimeout(() => {
              const eventElements = document.querySelectorAll('.fc-event');
              const timeGridEvents = document.querySelectorAll('.fc-timegrid-event');
              console.log(`🎨 DOM check: Found ${eventElements.length} .fc-event elements`);
              console.log(`🎨 DOM check: Found ${timeGridEvents.length} .fc-timegrid-event elements`);

              if (eventElements.length === 0 && timeGridEvents.length === 0 && validEvents.length > 0) {
                console.error('❌ CRITICAL: Events were passed to FullCalendar but no DOM elements found!');
                console.error('   This suggests FullCalendar is not rendering events properly.');
                console.error('   Possible causes:');
                console.error('   1. Events are outside the visible date range');
                console.error('   2. CSS is hiding events');
                console.error('   3. FullCalendar view type mismatch');
                console.error('   4. Timezone conversion issue');

                // Check if events are in the current view's date range
                // Note: calendar.view is available here as this runs after calendar is initialized
                let currentView = null;
                let viewStart = null;
                let viewEnd = null;
                try {
                  currentView = calendar.view;
                  viewStart = currentView.activeStart;
                  viewEnd = currentView.activeEnd;
                  console.error('   Current view date range:', {
                    start: viewStart.toISOString(),
                    end: viewEnd.toISOString(),
                    viewType: currentView.type
                  });
                } catch (err) {
                  // Calendar might not be fully initialized yet
                  console.warn('⚠️ Calendar view not available yet:', err);
                }

                if (viewStart && viewEnd) {
                  validEvents.forEach(evt => {
                    const evtStart = evt.start instanceof Date ? evt.start : new Date(evt.start);
                    const evtEnd = evt.end instanceof Date ? evt.end : new Date(evt.end);
                    const isInView = evtStart < viewEnd && evtEnd > viewStart;
                    console.error(`   Event "${evt.title}":`, {
                      start: evtStart.toISOString(),
                      end: evtEnd.toISOString(),
                      isInView: isInView,
                      viewStart: viewStart.toISOString(),
                      viewEnd: viewEnd.toISOString()
                    });
                  });
                } else {
                  console.warn('⚠️ Cannot check event date range - calendar view not available');
                }
              } else if (eventElements.length > 0 || timeGridEvents.length > 0) {
                console.log(`✅ DOM check passed: ${eventElements.length + timeGridEvents.length} event elements found`);
              }
            }, 500);
          }, 500);
      } catch (err) {
        // swallow to avoid noisy console in production
        failure(err);
      }
    }
  });
  calendar.render();

    // Fallback: if dateClick is blocked by browser/CSS, enable clicking on time slots to add event
    calendarEl.addEventListener('click', (evt) => {
      // Ignore clicks on existing events
      if (evt.target.closest('.fc-event')) { return; }
      const slot = evt.target.closest('.fc-timegrid-slot');
      if (!slot) { return; }
      try {
        const currentDay = calendar.view.currentStart;
        const dateStr = formatDateManila(currentDay);
        const slotTime = (slot.getAttribute('data-time') || slot.dataset?.time || '').slice(0,5) || '08:00';
        openModal({ date: dateStr, start: slotTime });
      } catch { /* ignore */ }
    }, true);

    // If URL has ?openEvent=<id>, open that event in a modal (read-only for non-creators)
    (async function handleOpenEventParam() {
      try {
        const params = new URLSearchParams(window.location.search);
        const openEventId = params.get('openEvent');
        if (!openEventId) { return; }

        const res = await fetch(`/api/calendar/events/${openEventId}`, { credentials: 'same-origin' });
        if (!res.ok) { return; }
        const eventData = await res.json();

        // Navigate to the event's date in day view
        const startDate = new Date(eventData.start);
        calendar.changeView('timeGridDay', startDate);
        calendar.gotoDate(startDate);

        // Helper to format HH:MM in Manila timezone
        const toTime = (dStr) => {
          if (!dStr) {return '';}
          const d = new Date(dStr);
          const h = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false });
          const m = d.toLocaleString('en-US', { timeZone: 'Asia/Manila', minute: '2-digit' });
          return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        };

        // Open the modal with event data
        setTimeout(() => {
          openModal({
            title: eventData.title,
            date: formatDateManila(startDate),
            start: eventData.allDay ? '' : toTime(eventData.start),
            end: eventData.allDay ? '' : toTime(eventData.end),
            allDay: !!eventData.allDay,
            edit: !!eventData.isCreator,
            id: eventData._id,
            source: 'backend',
            participants: eventData.participants,
            description: eventData.description,
            category: eventData.category
          });
          // Scroll to event time if available
          if (!eventData.allDay && eventData.start) {
            const t = toTime(eventData.start);
            if (t) { calendar.scrollToTime(`${t}:00`); }
          }
        }, 300);

        // Clean the URL to avoid repeat opening
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        // ignore
      }
    })();

  // Mini calendar rendering (simple month grid)
  // Note: miniCursor and miniCalendarEvents are declared above before calendar initialization

  function formatMonthTitle(d) {
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }

  function getEventsForDate(date) {
    if (!miniCalendarEvents || miniCalendarEvents.length === 0) {return [];}
    const now = new Date();
    // Compare dates in Asia/Manila timezone to avoid timezone conversion issues
    const dateStr = formatDateManila(date);
    return miniCalendarEvents.filter(event => {
      // Filter out past events - only show events that haven't ended yet
      const eventEnd = new Date(event.end);
      if (eventEnd < now) {
        return false;
      }
      // Match events for the specific date
      const eventDateStr = formatDateManila(event.start);
      return eventDateStr === dateStr;
    });
  }

  function getCategoryColor(category) {
    switch (category) {
      case 'urgent': return '#fee2e2'; // Light red
      case 'today': return '#fed7aa'; // Light orange
      case 'holiday': return '#FEF3C7'; // Light gold/yellow for holidays
      case 'standard': return '#d1fae5'; // Light green
      default: return '#d1fae5'; // Default to light green
    }
  }

  function getHighestPriorityCategory(events) {
    // Priority: urgent > holiday > today > standard
    if (events.some(e => e.category === 'urgent' || e.extendedProps?.category === 'urgent')) {
      return 'urgent';
    }
    if (events.some(e => e.category === 'holiday' || e.extendedProps?.category === 'holiday' || e.extendedProps?.isHoliday)) {
      return 'holiday';
    }
    if (events.some(e => e.category === 'today' || e.extendedProps?.category === 'today')) {
      return 'today';
    }
    return 'standard';
  }

  // Function to scroll to first event time
  function scrollToFirstEventTime(date, events) {
    if (!events || events.length === 0) {return;}

    // Get the earliest event time for the date
    // Format date as YYYY-MM-DD in Manila timezone
    const dateStr = formatDateManila(date);
    const sameDayEvents = events.filter(e => {
      const eventDateStr = formatDateManila(e.start);
      return eventDateStr === dateStr;
    });

    if (sameDayEvents.length > 0) {
      // Sort by start time and get the first one
      sameDayEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      const firstEvent = sameDayEvents[0];
      const eventTime = new Date(firstEvent.start);

      // Get time in Manila timezone
      const hours = eventTime.toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false });
      const minutes = eventTime.toLocaleString('en-US', { timeZone: 'Asia/Manila', minute: '2-digit' });
      const scrollTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;

      calendar.scrollToTime(scrollTime);
    }
  }

  // Function to scroll to first event after loading
  function scrollToFirstEvent(date) {
    // Wait for events to load, then scroll
    setTimeout(() => {
      const allEvents = calendar.getEvents();

      const dateStr = formatDateManila(date);
      const sameDayEvents = Array.from(allEvents).filter(e => {
        const eventDateStr = formatDateManila(e.start);
        return eventDateStr === dateStr && !e.allDay;
      });

      if (sameDayEvents.length > 0) {
        sameDayEvents.sort((a, b) => a.start - b.start);
        const firstEvent = sameDayEvents[0];
        const eventTime = new Date(firstEvent.start);

        // Get time in Manila timezone
        const hours = eventTime.toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false });
        const minutes = eventTime.toLocaleString('en-US', { timeZone: 'Asia/Manila', minute: '2-digit' });
        calendar.scrollToTime(`${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`);
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

      // Format dates with Manila timezone offset (+08:00)
      const formatForAPI = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`;
      };

      const startStr = formatForAPI(firstDay);
      const endStr = formatForAPI(lastDay);

      // Fetch database events
      const qs = new URLSearchParams({ start: startStr, end: endStr });
      const res = await fetch(`/api/calendar/events?${qs.toString()}`, { credentials: 'same-origin' });

      let allEvents = [];

      if (res.ok) {
        const data = await res.json();
        // Convert database events to mini calendar format
        const dbEvents = data.map(e => ({
          id: e._id,
          start: e.start,
          end: e.end,
          category: e.category || 'standard',
          extendedProps: {
            category: e.category || 'standard'
          }
        }));
        allEvents = [...allEvents, ...dbEvents];
      }

      // Also fetch Google Calendar events (including holidays) - same as main calendar
      if (window.calendarConnected) {
        try {
          // Format dates for Google Calendar API (RFC3339 with timezone)
          const formatForGoogleAPI = (dateStr) => {
            if (!dateStr) return dateStr;
            if (/[+-]\d{2}:\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) {
              return dateStr;
            }
            if (dateStr.includes('T')) {
              return `${dateStr}+08:00`;
            }
            return `${dateStr}T00:00:00+08:00`;
          };

          const timeMin = formatForGoogleAPI(startStr);
          const timeMax = formatForGoogleAPI(endStr);

          const r2 = await fetch(`/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { credentials: 'same-origin' });
          if (r2.ok) {
            const gItems = await r2.json();
            console.log(`📅 Mini calendar: Received ${gItems.length} Google Calendar events (including holidays)`);

            // Convert Google Calendar events (including holidays) to mini calendar format
            const googleEvents = gItems.map(ev => {
              const isGoogleAllDay = ev.start.date ? true : false;
              const isHoliday = ev.isHoliday === true;

              // For all-day events, adjust end date (Google uses exclusive, we need inclusive)
              let eventStart = isGoogleAllDay ? ev.start.date : ev.start.dateTime;
              let eventEnd = isGoogleAllDay ? ev.end.date : ev.end.dateTime;

              if (isGoogleAllDay && eventEnd) {
                const endDate = new Date(eventEnd);
                endDate.setDate(endDate.getDate() - 1);
                eventEnd = endDate.toISOString().split('T')[0];
              }

              return {
                id: 'gcal_' + ev.id,
                start: eventStart,
                end: eventEnd,
                category: isHoliday ? 'holiday' : 'standard',
                extendedProps: {
                  category: isHoliday ? 'holiday' : 'standard',
                  isHoliday: isHoliday,
                  source: 'google'
                }
              };
            });

            allEvents = [...allEvents, ...googleEvents];
          }
        } catch (err) {
          console.warn('⚠️ Error fetching Google Calendar events for mini calendar:', err);
        }
      }

      const now = new Date();

      // Filter out past events and convert to mini calendar format
      miniCalendarEvents = allEvents
        .filter(e => {
          // Only include events that haven't ended yet
          const eventEnd = new Date(e.end);
          return eventEnd >= now;
        });

      console.log(`📅 Mini calendar: Loaded ${miniCalendarEvents.length} total events (${allEvents.length - miniCalendarEvents.length} past events filtered)`);

      // Re-render mini calendar with event indicators
      renderMiniCalendar();
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

      // Check if this day is today in Manila timezone
      const todayInManila = getTodayInManila();
      const iterDateStr = formatDateManila(iter);
      const todayDateStr = formatDateManila(todayInManila);
      if (iterDateStr === todayDateStr) { el.classList.add('mini-today'); }

      // Highlight selected date (default to today)
      const iterDate = new Date(iter.getFullYear(), iter.getMonth(), iter.getDate());
      const selectedDateNormalized = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      if (iterDate.getTime() === selectedDateNormalized.getTime()) {
        el.classList.add('mini-selected');
      }

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
        // Capture events for this day at click time
        const clickedDayEvents = getEventsForDate(iter);

        // Update selected date
        selectedDate = new Date(year, month, dayNumber);

        // Re-render to update highlights
        renderMiniCalendar();

        // Create date object that represents the clicked day
        const clickedYear = year;
        const clickedMonth = month; // JavaScript month is 0-indexed
        const clickedDay = dayNumber;

        // Create date string in YYYY-MM-DD format
        const dateString = `${clickedYear}-${String(clickedMonth + 1).padStart(2, '0')}-${String(clickedDay).padStart(2, '0')}`;

        // Create Date object for the clicked date
        let clickedDate;
        try {
          // Use date string - FullCalendar interprets it in Asia/Manila timezone
          calendar.gotoDate(dateString);
          clickedDate = new Date(clickedYear, clickedMonth, clickedDay, 0, 0, 0, 0);
        } catch (e) {
          // Fallback: create date in Manila timezone
          clickedDate = new Date(clickedYear, clickedMonth, clickedDay, 0, 0, 0, 0);
          calendar.gotoDate(clickedDate);
        }

        console.log('📅 Mini calendar clicked:', {
          day: clickedDay,
          month: clickedMonth + 1,
          year: clickedYear,
          dateString: dateString,
          eventsOnThisDay: clickedDayEvents.length
        });

        // Ensure view is set correctly
        if (calendar.view.type !== 'timeGridDay') {
          calendar.changeView('timeGridDay', clickedDate);
        }

        // Force a render to ensure the date is displayed correctly
        calendar.render();

        // Function to scroll to event time (with retry mechanism)
        const scrollToEventTime = (retryCount = 0) => {
          // Get events from the calendar (after they've been loaded)
          const allEvents = calendar.getEvents();
          const dateStr = formatDateManila(clickedDate);
          const sameDayEvents = Array.from(allEvents).filter(e => {
            const eventDateStr = formatDateManila(e.start);
            return eventDateStr === dateStr && !e.allDay;
          });

          console.log(`📊 Scroll attempt ${retryCount + 1}: Found ${sameDayEvents.length} events for ${dateStr}`);

          // If we have events from mini calendar but not from main calendar yet, retry
          if (clickedDayEvents.length > 0 && sameDayEvents.length === 0 && retryCount < 5) {
            console.log(`⏳ Events not loaded yet, retrying in 300ms... (attempt ${retryCount + 1}/5)`);
            setTimeout(() => scrollToEventTime(retryCount + 1), 300);
            return;
          }

          // Check if clicked date is today
          const isToday = (date) => {
            const today = new Date();
            const todayStr = formatDateManila(today);
            const dateStr = formatDateManila(date);
            return todayStr === dateStr;
          };

          let scrollTime = null;
          let scrollReason = '';

          if (sameDayEvents.length > 0) {
            // Scroll to first event time if date has events
            sameDayEvents.sort((a, b) => a.start - b.start);
            const firstEvent = sameDayEvents[0];
            const eventTime = new Date(firstEvent.start);

            // Get time in Manila timezone
            const hours = eventTime.toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false });
            const minutes = eventTime.toLocaleString('en-US', { timeZone: 'Asia/Manila', minute: '2-digit' });
            scrollTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
            scrollReason = `first event: "${firstEvent.title}"`;
          } else if (clickedDayEvents.length > 0) {
            // Fallback: use mini calendar events if main calendar events aren't loaded yet
            clickedDayEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
            const firstEvent = clickedDayEvents[0];
            const eventTime = new Date(firstEvent.start);

            // Get time in Manila timezone
            const hours = eventTime.toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false });
            const minutes = eventTime.toLocaleString('en-US', { timeZone: 'Asia/Manila', minute: '2-digit' });
            scrollTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
            scrollReason = 'first event (from mini calendar data)';
          } else if (isToday(clickedDate)) {
            // Scroll to current time for today if no events
            scrollTime = getCurrentTime();
            scrollReason = 'current time (today, no events)';
          } else {
            // Scroll to a reasonable default time (8am) if no events
            scrollTime = '08:00:00';
            scrollReason = 'default time (8am, no events)';
          }

          if (scrollTime) {
            console.log(`📅 Scrolling to ${scrollTime} - ${scrollReason}`);
            try {
              calendar.scrollToTime(scrollTime);
              // Force render after scroll to ensure it's visible
              setTimeout(() => {
                calendar.render();
              }, 100);
            } catch (err) {
              console.error('❌ Error scrolling to time:', err);
            }
          }
        };

        // Force refresh events for the selected date, then scroll
        setTimeout(() => {
          console.log('🔄 Refreshing events after mini calendar date click:', dateString);
          calendar.refetchEvents();
          calendar.render();

          // Start scrolling after events have time to load
          setTimeout(() => scrollToEventTime(), 600);
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
    // Get today's date in Manila timezone
    const currentToday = getTodayInManila();

    // Get date string in Manila timezone for comparison
    const todayDateStr = formatDateManila(currentToday);
    console.log('📅 Initializing calendar with today (Manila timezone):', todayDateStr);

    // Set selected date to today
    selectedDate = new Date(currentToday.getFullYear(), currentToday.getMonth(), currentToday.getDate());

    // Ensure mini calendar shows current month
    const currentMonth = currentToday.getMonth();
    const currentYear = currentToday.getFullYear();

    if (miniCursor.getMonth() !== currentMonth || miniCursor.getFullYear() !== currentYear) {
      miniCursor.setMonth(currentMonth);
      miniCursor.setFullYear(currentYear);
      miniCursor.setDate(1);
    }

    // Re-render with today highlighted
    renderMiniCalendar();

    // Ensure main calendar shows today's date in day view
    // Use date string format to ensure FullCalendar interprets it correctly in Manila timezone
    const todayDateString = `${currentToday.getFullYear()}-${String(currentToday.getMonth() + 1).padStart(2, '0')}-${String(currentToday.getDate()).padStart(2, '0')}`;
    calendar.gotoDate(todayDateString);
    if (calendar.view.type !== 'timeGridDay') {
      calendar.changeView('timeGridDay', todayDateString);
    }
    calendar.render();

    // Scroll to current time after calendar is initialized
    setTimeout(() => {
      const currentTime = getCurrentTime();
      console.log('📅 Initial load: Scrolling to current time:', currentTime);
      calendar.scrollToTime(currentTime);
    }, 500);
  }, 100);

  if (miniPrev) {
    miniPrev.addEventListener('click', () => {
      miniCursor.setMonth(miniCursor.getMonth() - 1);
      miniCursor.setDate(1); // Reset to first day of month
      loadEventsForMiniCalendar(); // This will render after loading events
      // Selected date persists - renderMiniCalendar will highlight it if it's in the visible month
    });
  }
  if (miniNext) {
    miniNext.addEventListener('click', () => {
      miniCursor.setMonth(miniCursor.getMonth() + 1);
      miniCursor.setDate(1); // Reset to first day of month
      loadEventsForMiniCalendar(); // This will render after loading events
      // Selected date persists - renderMiniCalendar will highlight it if it's in the visible month
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
    if (!departmentList) {return;}
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
    participantEmailInput.addEventListener('keydown', async (e) => {
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
            await showAlertModal('Email not found. Please select from registered users.', 'Invalid Email');
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
    if (!participantsChipsContainer) {return;}
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

  // Auto-refresh mini calendar every 60s to remove past events
  setInterval(() => {
    try {
      loadEventsForMiniCalendar();
    } catch (e) {
      console.error('Error refreshing mini calendar:', e);
    }
  }, 60000);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      await showAlertModal('Please add a title before saving', 'Required Field');
      return;
    }

    const date = dateInput.value;
    const start = startInput.value;
    const end = endInput.value;
    const category = categorySelect.value;
    const description = descInput.value;

    // Validate required fields
    if (!date) {
      await showAlertModal('Please select a date', 'Required Field');
      return;
    }
    if (!start) {
      await showAlertModal('Please select a start time', 'Required Field');
      return;
    }
    // End time is optional; if empty, default to +1 hour from start

    // Get participants data (departments and emails)
    const participants = participantsHiddenInput ? participantsHiddenInput.value : JSON.stringify(participantsData);

    // Format ISO date-time strings with Philippines timezone (GMT+8)
    // Explicitly use Asia/Manila timezone to prevent date shifts
    const formatDateTime = (dateStr, timeStr) => {
      // Create date in Philippines timezone (GMT+8)
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);

      // Create date object assuming Philippines timezone (GMT+8)
      // Format: YYYY-MM-DDTHH:mm:ss+08:00
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+08:00`;
    };

    const startISO = formatDateTime(date, start);
    let endISO;
    if (end) {
      endISO = formatDateTime(date, end);
    } else {
      // Default to 1 hour after start
      const [sh, sm] = start.split(':').map(Number);
      const [year, month, day] = date.split('-').map(Number);
      const startDateObj = new Date(year, month - 1, day, sh, sm, 0);
      const endDateObj = new Date(startDateObj.getTime() + 60 * 60 * 1000);
      const endHours = endDateObj.getHours();
      const endMinutes = endDateObj.getMinutes();
      endISO = formatDateTime(date, `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`);
    }

    console.log('Form data:', { date, start, end, startISO, endISO });

    // Show loading modal
    const successModal = document.getElementById('eventSuccessModal');
    const successLoader = document.getElementById('successLoader');
    const successCheck = document.getElementById('successCheck');
    const successMessage = document.getElementById('successMessage');

    function showSuccessModal(message, type = 'loading') {
      if (!successModal) {return;}
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
          console.log('📅 New event details:', {
            id: savedEvent._id,
            title: savedEvent.title,
            start: savedEvent.start,
            end: savedEvent.end,
            date: new Date(savedEvent.start).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' })
          });

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

          // Show success state
          showSuccessModal('Event saved successfully!', 'success');

          // Navigate to the event's date and ensure it's visible
          const eventDate = new Date(startISO);
          const eventDateStr = formatDateManila(eventDate);

          console.log('📅 Event created, navigating to date:', eventDateStr);

          // Always navigate to the event's date and ensure timeGridDay view
          calendar.gotoDate(eventDate);
          if (calendar.view.type !== 'timeGridDay') {
            calendar.changeView('timeGridDay', eventDate);
          }

          // Wait for navigation to complete, then refresh events
          setTimeout(() => {
            console.log('🔄 First refresh after navigation...');
            calendar.refetchEvents();
            calendar.render();
          }, 200);

          // Refresh calendar - wait for backend to process, then refetch and render
          // Use multiple refresh attempts to ensure the event appears
          setTimeout(() => {
            console.log('🔄 Second refresh after event creation...');
            calendar.refetchEvents();
            calendar.render();

            // Double-check after a short delay
            setTimeout(() => {
              const allEvents = calendar.getEvents();
              console.log(`📊 Calendar now has ${allEvents.length} events after refresh`);

              // Check if our new event is there by ID (if we have it) or by title and date
              let newEvent = null;
              if (savedEvent && savedEvent._id) {
                newEvent = allEvents.find(evt => String(evt.id) === String(savedEvent._id));
              }

              if (!newEvent) {
                // Fallback: find by title and date
                newEvent = allEvents.find(evt => {
                  const evtDate = formatDateManila(evt.start);
                  return evtDate === eventDateStr && (evt.title.includes(title) || evt.extendedProps?.originalTitle === title);
                });
              }

              if (newEvent) {
                console.log('✅ New event found in calendar:', newEvent.title);
                // Scroll to event time
                if (start) {
                  const [hours, minutes] = start.split(':');
                  const scrollTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
                  console.log('📅 Scrolling to event time:', scrollTime);
                  calendar.scrollToTime(scrollTime);
                }
                calendar.render();
              } else {
                console.warn('⚠️ New event not found in calendar after refresh');
                console.log('   Event details:', { title, date: eventDateStr, id: savedEvent._id });
                console.log('   Available events:', allEvents.map(e => ({
                  id: e.id,
                  title: e.title,
                  date: formatDateManila(e.start),
                  originalTitle: e.extendedProps?.originalTitle
                })));

                // Try one more refresh after a longer delay
                setTimeout(() => {
                  console.log('🔄 Final refresh attempt...');
                  calendar.refetchEvents();
                  calendar.render();
                }, 1000);
              }
            }, 800);

            console.log('✅ Calendar refresh initiated');
          }, 1000); // Increased delay to ensure backend has fully processed and committed the event
        }

        // Update mini calendar events after adding new event
        setTimeout(() => {
          loadEventsForMiniCalendar();
        }, 200);

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
      const confirmed = await showConfirmModal('Delete this event?', 'Delete Event');
      if (!confirmed) { return; }
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
        await showAlertModal('Delete failed', 'Error');
      }
    });
  }

  } // End of initCalendar function
})();


