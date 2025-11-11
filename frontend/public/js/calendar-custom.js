/**
 * Custom Calendar Integration - Replaces FullCalendar
 * Complete integration with all existing features
 */

(function() {
  'use strict';

  let customCalendar = null;
  let miniCalendarEvents = [];
  let selectedDate = new Date();
  let miniCursor = new Date();

  // DOM elements
  const mini = document.getElementById('miniCalendar');
  const miniMonthEl = document.getElementById('miniCalMonth');
  const miniPrev = document.getElementById('miniPrev');
  const miniNext = document.getElementById('miniNext');

  // Form elements
  const form = document.getElementById('memoForm');
  const titleInput = document.getElementById('memoTitle');
  const dateInput = document.getElementById('memoDate');
  const startInput = document.getElementById('memoStart');
  const endInput = document.getElementById('memoEnd');
  const categorySelect = document.getElementById('memoCategory');
  const descInput = document.getElementById('memoDesc');
  const editingSourceInput = document.getElementById('memoEditingSource');
  const editingIdInput = document.getElementById('memoEditingId');
  const participantsChipsContainer = document.getElementById('participantsChips');
  const participantEmailInput = document.getElementById('participantEmailInput');
  const emailSuggestions = document.getElementById('emailSuggestions');
  const selectDepartmentBtn = document.getElementById('selectDepartmentBtn');
  const departmentDropdown = document.getElementById('departmentDropdown');
  const departmentList = document.getElementById('departmentList');
  const closeDepartmentDropdown = document.getElementById('closeDepartmentDropdown');
  const participantsHiddenInput = document.getElementById('memoParticipants');
  const closeModalBtn = document.getElementById('closeMemoModal');
  const cancelBtn = document.getElementById('cancelMemo');
  const saveBtn = form ? form.querySelector('button[type="submit"]') : null;
  const deleteBtn = document.getElementById('deleteMemo');

  // Data
  let departmentsList = [];
  let registeredUsers = [];
  let participantsData = { departments: [], emails: [] };

  // Modal functions (from original calendar.js)
  function showConfirmModal(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      if (!modal) {
        resolve(confirm(message));
        return;
      }
      const titleEl = document.getElementById('confirmModalTitle');
      const messageEl = document.getElementById('confirmModalMessage');
      const okBtn = document.getElementById('confirmModalOk');
      const cancelBtn = document.getElementById('confirmModalCancel');
      const closeBtn = document.getElementById('confirmModalClose');
      titleEl.textContent = title;
      messageEl.textContent = message;
      modal.style.display = 'flex';
      const cleanup = () => {
        modal.style.display = 'none';
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        closeBtn.onclick = null;
      };
      okBtn.onclick = () => { cleanup(); resolve(true); };
      cancelBtn.onclick = () => { cleanup(); resolve(false); };
      closeBtn.onclick = () => { cleanup(); resolve(false); };
      const overlay = modal.querySelector('.custom-modal-overlay');
      overlay.onclick = () => { cleanup(); resolve(false); };
    });
  }

  function showAlertModal(message, title = 'Notice') {
    return new Promise((resolve) => {
      const modal = document.getElementById('alertModal');
      if (!modal) {
        alert(message);
        resolve();
        return;
      }
      const titleEl = document.getElementById('alertModalTitle');
      const messageEl = document.getElementById('alertModalMessage');
      const okBtn = document.getElementById('alertModalOk');
      const closeBtn = document.getElementById('alertModalClose');
      titleEl.textContent = title;
      messageEl.textContent = message;
      modal.style.display = 'flex';
      const cleanup = () => {
        modal.style.display = 'none';
        okBtn.onclick = null;
        closeBtn.onclick = null;
      };
      okBtn.onclick = () => { cleanup(); resolve(); };
      closeBtn.onclick = () => { cleanup(); resolve(); };
      const overlay = modal.querySelector('.custom-modal-overlay');
      overlay.onclick = () => { cleanup(); resolve(); };
    });
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Initialize custom calendar
    const today = getTodayInManila();
    selectedDate = new Date(today);
    miniCursor = new Date(today.getFullYear(), today.getMonth(), 1);

    customCalendar = new CustomCalendar('calendar', {
      timeZone: 'Asia/Manila',
      slotDuration: 30,
      slotMinTime: '01:00:00',
      slotMaxTime: '24:00:00',
      initialView: 'timeGridDay',
      initialDate: today
    });

    // Load events
    loadEvents();

    // Initialize mini calendar
    initMiniCalendar();

    // Set up event handlers
    setupEventHandlers();

    // Load departments and users
    loadDepartments();
    loadRegisteredUsers();

    // Expose global functions
    window.openModal = openEventModal;
    window.openEventModal = openEventModal;
    window.showConfirmModal = showConfirmModal;
    window.showAlertModal = showAlertModal;
    window.customCalendar = customCalendar;
    window.participantsData = participantsData;
    window.renderParticipantsChips = renderParticipantsChips;
    window.loadParticipantsForEdit = loadParticipantsForEdit;
  }

  /**
   * Load participants when editing an event
   */
  function loadParticipantsForEdit(participants) {
    console.log('🔄 Loading participants for edit:', JSON.stringify(participants));

    if (!participants) {
      participantsData = { departments: [], emails: [] };
      renderParticipantsChips();
      if (participantsHiddenInput) {
        participantsHiddenInput.value = JSON.stringify(participantsData);
      }
      console.log('⚠️ No participants found, reset to empty');
      return;
    }

    // Handle both old format (array) and new format (object)
    if (Array.isArray(participants)) {
      // Old format: array of emails (strings)
      // Try to match with registered users to get full user data
      const emailsWithUserData = participants.map(email => {
        if (typeof email === 'string') {
          const user = registeredUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
          if (user) {
            return {
              email: user.email,
              profilePicture: user.profilePicture || '/images/memofy-logo.png',
              firstName: user.firstName || '',
              lastName: user.lastName || ''
            };
          }
          return email; // Keep as string if no match found
        }
        return email; // Already an object
      });
      participantsData = {
        departments: [],
        emails: emailsWithUserData
      };
      console.log('📋 Loaded participants (old format - array):', participants);
    } else if (typeof participants === 'object') {
      // New format: { departments: [], emails: [] }
      // Try to match emails with registered users to get full user data
      const emailsWithUserData = (Array.isArray(participants.emails) ? participants.emails : []).map(emailOrUser => {
        if (typeof emailOrUser === 'string') {
          const user = registeredUsers.find(u => u.email?.toLowerCase() === emailOrUser.toLowerCase());
          if (user) {
            return {
              email: user.email,
              profilePicture: user.profilePicture || '/images/memofy-logo.png',
              firstName: user.firstName || '',
              lastName: user.lastName || ''
            };
          }
          return emailOrUser; // Keep as string if no match found
        }
        // Already an object, ensure it has profilePicture
        return {
          ...emailOrUser,
          profilePicture: emailOrUser.profilePicture || '/images/memofy-logo.png'
        };
      });
      participantsData = {
        departments: Array.isArray(participants.departments) ? participants.departments : [],
        emails: emailsWithUserData
      };
      console.log('📋 Loaded participants (new format - object):', participantsData);
    } else {
      participantsData = { departments: [], emails: [] };
      console.log('⚠️ Invalid participants format, reset to empty');
    }

    renderParticipantsChips();
    renderDepartmentDropdown();

    // Ensure hidden input is updated
    if (participantsHiddenInput) {
      participantsHiddenInput.value = JSON.stringify(participantsData);
      console.log('✅ Hidden input updated with:', participantsHiddenInput.value);
    }

    console.log('✅ Participants loaded for editing. Total:', participantsData.emails.length, 'emails,', participantsData.departments.length, 'departments');
  }

  /**
   * Load events from backend
   */
  async function loadEvents() {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

      const startStr = formatDateForAPI(start);
      const endStr = formatDateForAPI(end);

      // Fetch database events
      const qs = new URLSearchParams({ start: startStr, end: endStr });
      const res = await fetch(`/api/calendar/events?${qs.toString()}`, { credentials: 'same-origin' });

      let allEvents = [];

      if (res.ok) {
        const data = await res.json();
        const dbEvents = data.map(e => formatEventForCalendar(e, 'database'));
        allEvents = [...allEvents, ...dbEvents];
      }

      // Fetch Google Calendar events (including holidays)
      if (window.calendarConnected) {
        try {
          const formatForGoogleAPI = (dateStr) => {
            if (!dateStr) {return dateStr;}
            if (/[+-]\d{2}:\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) {return dateStr;}
            if (dateStr.includes('T')) {return `${dateStr}+08:00`;}
            return `${dateStr}T00:00:00+08:00`;
          };

          const timeMin = formatForGoogleAPI(startStr);
          const timeMax = formatForGoogleAPI(endStr);

          const r2 = await fetch(`/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { credentials: 'same-origin' });
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
      // Reuse 'now' variable declared at the start of the function
      const activeEvents = allEvents.filter(e => {
        const eventEnd = new Date(e.end);
        return eventEnd >= now;
      });

      // Update calendar with only active (non-past) events
      customCalendar.setEvents(activeEvents);

      // Update mini calendar events (already filtered above)
      miniCalendarEvents = activeEvents;
      renderMiniCalendar();

    } catch (err) {
      console.error('Error loading events:', err);
    }
  }

  /**
   * Format database event for calendar
   */
  function formatEventForCalendar(e, source) {
    const isAllDay = e.allDay || false;
    const eventDescription = e.description || '';
    const eventParticipants = e.participants || {};
    console.log('📋 Formatting event:', e.title);
    console.log('   Description:', eventDescription || '(none)');
    console.log('   Participants:', JSON.stringify(eventParticipants));
    return {
      id: String(e._id),
      title: e.title,
      start: new Date(e.start),
      end: new Date(e.end),
      allDay: isAllDay,
      backgroundColor: getCategoryColor(e.category),
      borderColor: getCategoryColor(e.category),
      textColor: getCategoryTextColor(e.category),
      extendedProps: {
        category: e.category || 'standard',
        source: source,
        isCreator: e.isCreator !== false,
        participants: eventParticipants,
        description: eventDescription
      }
    };
  }

  /**
   * Format Google Calendar event (including holidays)
   */
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
      backgroundColor: isHoliday ? '#FFD700' : '#4285F4',
      borderColor: isHoliday ? '#FFC107' : '#4285F4',
      textColor: isHoliday ? '#000000' : '#ffffff',
      extendedProps: {
        category: isHoliday ? 'holiday' : 'standard',
        source: 'google',
        isHoliday: isHoliday,
        htmlLink: ev.htmlLink,
        description: ev.description
      }
    };
  }

  /**
   * Get category color
   */
  function getCategoryColor(category) {
    switch (category) {
      case 'urgent': return '#fee2e2'; // Light red
      case 'high': return '#fed7aa'; // Light orange
      case 'meeting': return '#e9d5ff'; // Light purple
      case 'deadline': return '#fecaca'; // Light red-pink
      case 'reminder': return '#fef3c7'; // Light yellow
      case 'low': return '#dbeafe'; // Light blue
      case 'holiday': return '#FEF3C7'; // Light gold/yellow for holidays
      case 'standard':
      default: return '#d1fae5'; // Light green
    }
  }

  /**
   * Get category text color
   */
  function getCategoryTextColor(category) {
    switch (category) {
      case 'urgent': return '#991b1b'; // Dark red
      case 'high': return '#9a3412'; // Dark orange
      case 'meeting': return '#6b21a8'; // Dark purple
      case 'deadline': return '#be123c'; // Dark red-pink
      case 'reminder': return '#92400e'; // Dark yellow/brown
      case 'low': return '#1e40af'; // Dark blue
      case 'holiday': return '#92400e'; // Dark gold/brown
      case 'standard':
      default: return '#065f46'; // Dark green
    }
  }

  /**
   * Format date for API
   */
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

  /**
   * Get today in Manila timezone
   */
  function getTodayInManila() {
    const now = new Date();
    const year = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric' }));
    const month = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit' })) - 1;
    const day = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Manila', day: '2-digit' }));
    return new Date(year, month, day, 0, 0, 0, 0);
  }

  /**
   * Format date for Manila timezone (YYYY-MM-DD)
   */
  function formatDateManila(date) {
    const d = new Date(date);
    const year = parseInt(d.toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric' }));
    const month = parseInt(d.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit' }));
    const day = parseInt(d.toLocaleString('en-US', { timeZone: 'Asia/Manila', day: '2-digit' }));
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Initialize mini calendar
   */
  function initMiniCalendar() {
    if (!mini) {return;}
    loadEventsForMiniCalendar();

    if (miniPrev) {
      miniPrev.addEventListener('click', () => {
        miniCursor.setMonth(miniCursor.getMonth() - 1);
        miniCursor.setDate(1);
        loadEventsForMiniCalendar();
      });
    }

    if (miniNext) {
      miniNext.addEventListener('click', () => {
        miniCursor.setMonth(miniCursor.getMonth() + 1);
        miniCursor.setDate(1);
        loadEventsForMiniCalendar();
      });
    }
  }

  /**
   * Load events for mini calendar
   */
  async function loadEventsForMiniCalendar() {
    try {
      const firstDay = new Date(miniCursor.getFullYear(), miniCursor.getMonth(), 1);
      const lastDay = new Date(miniCursor.getFullYear(), miniCursor.getMonth() + 1, 0);
      lastDay.setHours(23, 59, 59, 999);

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

      const qs = new URLSearchParams({ start: startStr, end: endStr });
      const res = await fetch(`/api/calendar/events?${qs.toString()}`, { credentials: 'same-origin' });

      let allEvents = [];

      if (res.ok) {
        const data = await res.json();
        const dbEvents = data.map(e => ({
          id: e._id,
          start: e.start,
          end: e.end,
          category: e.category || 'standard',
          extendedProps: { category: e.category || 'standard' }
        }));
        allEvents = [...allEvents, ...dbEvents];
      }

      if (window.calendarConnected) {
        try {
          const formatForGoogleAPI = (dateStr) => {
            if (!dateStr) {return dateStr;}
            if (/[+-]\d{2}:\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) {return dateStr;}
            if (dateStr.includes('T')) {return `${dateStr}+08:00`;}
            return `${dateStr}T00:00:00+08:00`;
          };

          const timeMin = formatForGoogleAPI(startStr);
          const timeMax = formatForGoogleAPI(endStr);

          const r2 = await fetch(`/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, { credentials: 'same-origin' });
          if (r2.ok) {
            const gItems = await r2.json();
            const googleEvents = gItems.map(ev => {
              const isGoogleAllDay = ev.start.date ? true : false;
              const isHoliday = ev.isHoliday === true;
              const eventStart = isGoogleAllDay ? ev.start.date : ev.start.dateTime;
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
          console.warn('Error fetching Google Calendar events for mini calendar:', err);
        }
      }

      const now = new Date();
      miniCalendarEvents = allEvents.filter(e => {
        const eventEnd = new Date(e.end);
        return eventEnd >= now;
      });

      renderMiniCalendar();
    } catch (err) {
      console.error('Error loading events for mini calendar:', err);
    }
  }

  /**
   * Render mini calendar
   */
  function renderMiniCalendar() {
    if (!mini) {return;}
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
      const dayNumber = iter.getDate();
      el.textContent = String(dayNumber);

      const todayInManila = getTodayInManila();
      const iterDateStr = formatDateManila(iter);
      const todayDateStr = formatDateManila(todayInManila);
      if (iterDateStr === todayDateStr) {
        el.classList.add('mini-today');
      }

      const iterDate = new Date(iter.getFullYear(), iter.getMonth(), iter.getDate());
      const selectedDateNormalized = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      if (iterDate.getTime() === selectedDateNormalized.getTime()) {
        el.classList.add('mini-selected');
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
        dot.title = `${dayEvents.length} event(s)`;
        indicatorContainer.appendChild(dot);
        el.appendChild(indicatorContainer);
      }

      el.addEventListener('click', () => {
        selectedDate = new Date(year, month, dayNumber);
        renderMiniCalendar();
        customCalendar.gotoDate(selectedDate);
        customCalendar.changeView('timeGridDay');
        loadEvents();
      });

      mini.appendChild(el);
      iter.setDate(iter.getDate() + 1);
    }
  }

  /**
   * Get events for date
   */
  function getEventsForDate(date) {
    if (!miniCalendarEvents || miniCalendarEvents.length === 0) {return [];}
    const now = new Date();
    const dateStr = formatDateManila(date);
    return miniCalendarEvents.filter(event => {
      const eventEnd = new Date(event.end);
      if (eventEnd < now) {return false;}
      const eventDateStr = formatDateManila(new Date(event.start));
      return eventDateStr === dateStr;
    });
  }

  /**
   * Get highest priority category
   */
  function getHighestPriorityCategory(events) {
    // Priority order: urgent > high > holiday > meeting > deadline > reminder > standard > low
    if (events.some(e => e.category === 'urgent' || e.extendedProps?.category === 'urgent')) {return 'urgent';}
    if (events.some(e => e.category === 'high' || e.extendedProps?.category === 'high')) {return 'high';}
    if (events.some(e => e.category === 'holiday' || e.extendedProps?.category === 'holiday' || e.extendedProps?.isHoliday)) {return 'holiday';}
    if (events.some(e => e.category === 'meeting' || e.extendedProps?.category === 'meeting')) {return 'meeting';}
    if (events.some(e => e.category === 'deadline' || e.extendedProps?.category === 'deadline')) {return 'deadline';}
    if (events.some(e => e.category === 'reminder' || e.extendedProps?.category === 'reminder')) {return 'reminder';}
    if (events.some(e => e.category === 'standard' || e.extendedProps?.category === 'standard')) {return 'standard';}
    if (events.some(e => e.category === 'low' || e.extendedProps?.category === 'low')) {return 'low';}
    return 'standard';
  }

  /**
   * Open event modal
   */
  function openEventModal(prefilledDate = null) {
    const modal = document.getElementById('memoModal');
    if (!modal) {return;}

    document.getElementById('memoModalTitle').textContent = 'Add Event';
    if (form) {
      form.reset();
      // Explicitly clear description field
      if (descInput) {
        descInput.value = '';
        console.log('✅ Description field cleared for new event');
      }
    }

    if (editingSourceInput) {editingSourceInput.value = '';}
    if (editingIdInput) {editingIdInput.value = '';}
    if (deleteBtn) {deleteBtn.style.display = 'none';}

    // Reset participants
    participantsData = { departments: [], emails: [] };
    renderParticipantsChips();

    if (prefilledDate) {
      const date = new Date(prefilledDate);
      if (dateInput) {dateInput.value = formatDateForInput(date);}
      if (startInput) {startInput.value = formatTimeForInput(date);}
    }

    modal.style.display = 'block';

    // Re-initialize autocomplete when modal opens (in case elements weren't ready before)
    setTimeout(() => {
      initializeAutocomplete();
    }, 100);
  }

  /**
   * Format date for input
   */
  function formatDateForInput(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format time for input
   */
  function formatTimeForInput(date) {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Initialize autocomplete for participant input
   */
  function initializeAutocomplete() {
    // Get elements fresh each time (in case modal wasn't ready before)
    const input = document.getElementById('participantEmailInput');
    const suggestions = document.getElementById('emailSuggestions');

    if (!input) {
      console.warn('⚠️ Participant input element not found');
      return;
    }

    if (!suggestions) {
      console.warn('⚠️ Email suggestions element not found');
      return;
    }

    console.log('✅ Initializing autocomplete for participant input');

    const oldInput = input;
    const oldSuggestions = suggestions;

    const newInput = oldInput.cloneNode(true);
    oldInput.parentNode.replaceChild(newInput, oldInput);
    const newSuggestions = oldSuggestions.cloneNode(true);
    if (!oldSuggestions.parentNode.classList.contains('participant-input-wrapper')) {
      oldSuggestions.parentNode.replaceChild(newSuggestions, oldSuggestions);
    } else {
      oldSuggestions.parentNode.removeChild(oldSuggestions);
      document.body.appendChild(newSuggestions);
    }

    const participantEmailInput = newInput;
    const emailSuggestions = newSuggestions;
    emailSuggestions.id = 'emailSuggestions';
    emailSuggestions.style.position = 'fixed';
    emailSuggestions.style.zIndex = '20010';
    emailSuggestions.style.display = 'none';

    let suggestionTimeout;
    let selectedIndex = -1;
    let currentMatches = [];

    function positionSuggestions(){
      const rect = participantEmailInput.getBoundingClientRect();
      emailSuggestions.style.left = rect.left + 'px';
      emailSuggestions.style.width = rect.width + 'px';
      emailSuggestions.style.top = (rect.bottom + 4) + 'px';
    }

    participantEmailInput.addEventListener('focus', () => {
      positionSuggestions();
      const q = (participantEmailInput.value || '').trim();
      if (registeredUsers.length > 0) {
        showSuggestions(q);
      } else {
        loadRegisteredUsers().then(() => {
          positionSuggestions();
          if (registeredUsers.length > 0) {
            showSuggestions(q);
          }
        }).catch(() => {/* ignore */});
      }
    });

    participantEmailInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      selectedIndex = -1;
      positionSuggestions();

      if (registeredUsers.length === 0) {
        loadRegisteredUsers().then(() => {
          positionSuggestions();
          showSuggestions(query);
        });
        return;
      }

      showSuggestions(query);
    });

    window.addEventListener('resize', positionSuggestions);
    window.addEventListener('scroll', positionSuggestions, true);

    function showSuggestions(query) {
      if (!registeredUsers || registeredUsers.length === 0) {
        return;
      }

      const queryLower = (query || '').toLowerCase();
      const isSecretary = (window.currentUser && window.currentUser.role === 'secretary');
      const myDept = (window.currentUser && (window.currentUser.department || '')).toLowerCase();

      let matches;
      const inDept = (u) => String(u.department || '').toLowerCase() === myDept && !!myDept;
      const nameOrEmailIncludes = (u) => {
        const email = (u.email || '').toLowerCase();
        const firstName = (u.firstName || '').toLowerCase();
        const lastName = (u.lastName || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        return !queryLower || email.includes(queryLower) || firstName.includes(queryLower) || lastName.includes(queryLower) || fullName.includes(queryLower);
      };

      if (isSecretary) {
        const deptUsers = registeredUsers.filter(u => inDept(u) && nameOrEmailIncludes(u));
        if (!queryLower) {
          // On empty query, suggest department users only
          matches = deptUsers.slice(0, 8);
        } else {
          // When searching, show department users first, then others
          const otherUsers = registeredUsers.filter(u => !inDept(u) && nameOrEmailIncludes(u));
          matches = [...deptUsers, ...otherUsers].slice(0, 8);
        }
      } else {
        // Admin/Faculty: normal behavior
        if (!queryLower) {
          matches = [...registeredUsers].slice(0, 8);
        } else {
          matches = registeredUsers.filter(nameOrEmailIncludes).slice(0, 8);
        }
      }

      currentMatches = matches;

      if (currentMatches.length === 0) {
        emailSuggestions.style.display = 'none';
        return;
      }

      emailSuggestions.innerHTML = '';
      currentMatches.forEach((user, index) => {
        const li = document.createElement('li');
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No name';
        const avatarUrl = user.profilePicture || '/images/memofy-logo.png';
        li.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <img src="${avatarUrl}" alt="${fullName}" class="suggestion-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid #e5e7eb; flex-shrink: 0;">
            <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;">
              <span class="suggestion-name" style="font-weight: 500; color: #1f2937;">${fullName}</span>
              <span class="suggestion-email" style="font-size: 0.75rem; color: #6b7280;">${user.email}</span>
            </div>
          </div>
        `;
        li.dataset.index = index;
        li.onclick = async () => {
          await addParticipant(user);
          participantEmailInput.value = '';
          emailSuggestions.style.display = 'none';
          currentMatches = [];
          selectedIndex = -1;
        };
        li.onmouseenter = () => {
          emailSuggestions.querySelectorAll('li').forEach(item => { item.style.background = ''; });
          li.style.background = '#f3f4f6';
          selectedIndex = index;
        };
        emailSuggestions.appendChild(li);
      });
      emailSuggestions.style.display = 'block';
    }

    // Keyboard navigation
    participantEmailInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        e.stopPropagation();
        const email = participantEmailInput.value.trim();

        console.log('Enter pressed, email:', email, 'Suggestions showing:', emailSuggestions.style.display === 'block');

        if (emailSuggestions.style.display === 'block' && currentMatches.length > 0 && selectedIndex >= 0) {
          const items = emailSuggestions.querySelectorAll('li');
          if (items[selectedIndex]) {
            console.log('Selecting suggestion at index', selectedIndex);
            const selectedUser = currentMatches[selectedIndex];
            await addParticipant(selectedUser);
            participantEmailInput.value = '';
            emailSuggestions.style.display = 'none';
            currentMatches = [];
            selectedIndex = -1;
            return;
          }
        }

        if (email) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(email.trim())) {
            const isRegistered = registeredUsers.some(u => u.email?.toLowerCase() === email.toLowerCase());
            if (isRegistered) {
              console.log('Adding email manually:', email);
              await addParticipant(email);
              participantEmailInput.value = '';
              emailSuggestions.style.display = 'none';
              currentMatches = [];
              selectedIndex = -1;
            } else {
              await showAlertModal(
                `"${email}" is not a registered user.\n\nPlease select a user from the suggestions list above.`,
                'User Not Registered'
              );
              emailSuggestions.style.display = 'block';
            }
          } else {
            await showAlertModal('Please enter a valid email address.\n\nExample: user@example.com', 'Invalid Email Format');
            console.warn('Invalid email format:', email);
          }
        }
        return false;
      }

      if (emailSuggestions.style.display !== 'block' || currentMatches.length === 0) {
        return;
      }

      const items = emailSuggestions.querySelectorAll('li');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
        items.forEach((item, idx) => {
          item.style.background = idx === selectedIndex ? '#f3f4f6' : '';
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        if (selectedIndex >= 0) {
          items[selectedIndex].scrollIntoView({ block: 'nearest' });
          items.forEach((item, idx) => {
            item.style.background = idx === selectedIndex ? '#f3f4f6' : '';
          });
        } else {
          items.forEach(item => item.style.background = '');
        }
      } else if (e.key === 'Escape') {
        emailSuggestions.style.display = 'none';
        selectedIndex = -1;
      }
    });

    const clickHandler = (e) => {
      if (!participantEmailInput.contains(e.target) && !emailSuggestions.contains(e.target)) {
        emailSuggestions.style.display = 'none';
        selectedIndex = -1;
      }
    };
    document.addEventListener('click', clickHandler);
  }

  /**
   * Setup event handlers
   */
  function setupEventHandlers() {
    if (form) {
      form.addEventListener('submit', handleFormSubmit);

      // Prevent form submission when Enter is pressed in participant input
      form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.id === 'participantEmailInput') {
          e.preventDefault();
          e.stopPropagation();
          // Let the autocomplete handler deal with it
          return false;
        }
      });
    }

    if (closeModalBtn) {
      closeModalBtn.onclick = () => {
        document.getElementById('memoModal').style.display = 'none';
      };
    }

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        document.getElementById('memoModal').style.display = 'none';
      };
    }

    if (deleteBtn) {
      deleteBtn.onclick = handleDeleteEvent;
    }

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
      closeDepartmentDropdown.onclick = () => {
        departmentDropdown.style.display = 'none';
      };
    }

    // Initialize autocomplete (will be called on setup and when modal opens)
    initializeAutocomplete();

    // Auto-refresh
    setInterval(() => {
      try {
        loadEvents();
        loadEventsForMiniCalendar();
      } catch (e) {
        console.error('Error refreshing calendar:', e);
      }
    }, 60000);
  }

  /**
   * Handle form submission
   */
  async function handleFormSubmit(e) {
    e.preventDefault();

    // Disable save button and show loading state
    if (saveBtn) {
      saveBtn.disabled = true;
      const originalText = saveBtn.textContent;
      saveBtn.innerHTML = '<span style="display: inline-block; width: 16px; height: 16px; border: 2px solid #ffffff; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px; vertical-align: middle;"></span>Saving...';
      saveBtn.style.opacity = '0.7';
      saveBtn.style.cursor = 'not-allowed';

      // Store original text for restoration
      saveBtn.dataset.originalText = originalText;
    }

    // Helper function to restore button state
    const restoreButtonState = () => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = saveBtn.dataset.originalText || 'Save';
        saveBtn.style.opacity = '1';
        saveBtn.style.cursor = 'pointer';
        saveBtn.style.background = '';
        saveBtn.style.color = '';
      }
    };

    // Validate title
    const title = titleInput.value.trim();
    if (!title) {
      restoreButtonState();
      await showAlertModal('Please enter a title for the event.', 'Title Required');
      titleInput.focus();
      return;
    }

    if (title.length > 200) {
      restoreButtonState();
      await showAlertModal('Title is too long. Please keep it under 200 characters.', 'Title Too Long');
      titleInput.focus();
      return;
    }

    // Validate date
    const date = dateInput.value;
    if (!date) {
      restoreButtonState();
      await showAlertModal('Please select a date for the event.', 'Date Required');
      dateInput.focus();
      return;
    }

    // Validate start time
    const start = startInput.value;
    if (!start) {
      restoreButtonState();
      await showAlertModal('Please select a start time for the event.', 'Start Time Required');
      startInput.focus();
      return;
    }

    // Validate end time
    const end = endInput.value;
    if (!end) {
      restoreButtonState();
      await showAlertModal('Please select an end time for the event.', 'End Time Required');
      endInput.focus();
      return;
    }

    // Validate time logic
    const startTime = new Date(`${date}T${start}`);
    const endTime = new Date(`${date}T${end}`);
    if (endTime <= startTime) {
      restoreButtonState();
      await showAlertModal('End time must be after start time.', 'Invalid Time Range');
      endInput.focus();
      return;
    }

    const category = categorySelect.value;
    const description = descInput ? descInput.value.trim() : '';

    // Validate description length if provided
    if (description && description.length > 2000) {
      restoreButtonState();
      await showAlertModal('Description is too long. Please keep it under 2000 characters.', 'Description Too Long');
      if (descInput) {descInput.focus();}
      return;
    }

    const formatDateTime = (dateStr, timeStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+08:00`;
    };

    const startISO = formatDateTime(date, start);
    const endISO = end ? formatDateTime(date, end) : formatDateTime(date, start.split(':').map((v, i) => i === 0 ? String((parseInt(v) + 1) % 24).padStart(2, '0') : v).join(':'));

    const participants = participantsHiddenInput ? participantsHiddenInput.value : JSON.stringify(participantsData);

    try {
      const editingSource = editingSourceInput.value;
      const editingId = editingIdInput.value;

      let participantsObj;
      try {
        participantsObj = JSON.parse(participants);
        // Normalize emails: extract email string from user objects for saving
        if (participantsObj.emails && Array.isArray(participantsObj.emails)) {
          participantsObj.emails = participantsObj.emails.map(emailOrUser => {
            if (typeof emailOrUser === 'string') {
              return emailOrUser;
            } else if (emailOrUser && emailOrUser.email) {
              // Extract just the email for saving (backend will handle user lookup)
              return emailOrUser.email;
            }
            return emailOrUser;
          });
        }
      } catch {
        participantsObj = { departments: [], emails: [] };
      }

      console.log('💾 Saving event - Description:', description || '(empty)', 'Length:', description?.length || 0);
      console.log('👥 Saving participants:', JSON.stringify(participantsObj));

      if (editingSource === 'backend' && editingId) {
        const updateData = { title, start: startISO, end: endISO, category, description: description || '', participants: participantsObj };
        console.log('📝 Updating event with data:', updateData);
        const res = await fetch(`/api/calendar/events/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(updateData)
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('❌ Failed to update event:', errorText);
          let errorMessage = 'Failed to update event.';
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch {
            // If not JSON, use the text as is
            if (errorText) {errorMessage = errorText;}
          }
          restoreButtonState();
          await showAlertModal(errorMessage, 'Update Failed');
          throw new Error('Failed to update');
        }
        const updatedEvent = await res.json();
        console.log('✅ Event updated. Description saved:', updatedEvent.description || '(none)');
        console.log('✅ Event participants updated:', JSON.stringify(updatedEvent.participants || {}));

        // Show success state
        if (saveBtn) {
          saveBtn.innerHTML = '✓ Saved!';
          saveBtn.style.background = '#10b981';
          saveBtn.style.color = '#ffffff';
        }
      } else {
        const createData = { title, start: startISO, end: endISO, category, description: description || '', participants: participantsObj };
        console.log('📝 Creating event with data:', createData);
        const res = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(createData)
        });
        if (!res.ok) {
          const errorText = await res.text();
          console.error('❌ Failed to save event:', errorText);
          let errorMessage = 'Failed to save event.';
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch {
            // If not JSON, use the text as is
            if (errorText) {errorMessage = errorText;}
          }
          restoreButtonState();
          await showAlertModal(errorMessage, 'Save Failed');
          throw new Error('Failed to save');
        }
        const createdEvent = await res.json();
        console.log('✅ Event created. Description saved:', createdEvent.description || '(none)');
        console.log('✅ Event participants saved:', JSON.stringify(createdEvent.participants || {}));

        // Show success state
        if (saveBtn) {
          saveBtn.innerHTML = '✓ Saved!';
          saveBtn.style.background = '#10b981';
          saveBtn.style.color = '#ffffff';
        }

        // Try to sync to Google Calendar
        if (window.calendarConnected) {
          try {
            await fetch('/calendar/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ title, description, startISO, endISO, category })
            });
          } catch {}
        }
      }

      await loadEvents();

      // Wait a moment to show success state, then close modal
      setTimeout(() => {
        const modal = document.getElementById('memoModal');
        if (modal) {
          modal.style.display = 'none';
        }

        // Reset button state after modal closes
        restoreButtonState();
      }, 1000); // 1 second delay to show success

      const eventDate = new Date(startISO);
      customCalendar.gotoDate(eventDate);
      customCalendar.changeView('timeGridDay');

    } catch (err) {
      console.error('Error saving event:', err);
      const errorMessage = err.message || 'An unexpected error occurred while saving the event. Please try again.';
      restoreButtonState();
      await showAlertModal(errorMessage, 'Error');
    }
  }

  /**
   * Handle delete event
   */
  async function handleDeleteEvent() {
    const editingId = editingIdInput.value;
    const editingSource = editingSourceInput.value;

    if (!editingId) {return;}

    const confirmed = await showConfirmModal('Are you sure you want to delete this event?', 'Delete Event');
    if (!confirmed) {return;}

    try {
      if (editingSource === 'backend') {
        await fetch(`/api/calendar/events/${editingId}`, {
          method: 'DELETE',
          credentials: 'same-origin'
        });
      }

      await loadEvents();
      document.getElementById('memoModal').style.display = 'none';
    } catch (err) {
      console.error('Error deleting event:', err);
      await showAlertModal('Failed to delete event', 'Error');
    }
  }

  /**
   * Load departments
   */
  async function loadDepartments() {
    try {
      const res = await fetch('/api/users/departments', { credentials: 'same-origin' });
      if (!res.ok) {throw new Error('Failed to load departments');}
      const data = await res.json();
      departmentsList = data.departments || [];
      renderDepartmentDropdown();
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  }

  /**
   * Render department dropdown
   */
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

  /**
   * Load registered users
   */
  async function loadRegisteredUsers() {
    try {
      console.log('🔄 Loading registered users from database...');
      const res = await fetch('/api/users/emails', { credentials: 'same-origin' });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Failed to load users. Status:', res.status, 'Response:', errorText);
        throw new Error(`Failed to load users: ${res.status}`);
      }
      registeredUsers = await res.json();
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('👥 USER DATABASE STATISTICS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ Total Active Users: ${registeredUsers.length}`);
      if (registeredUsers.length > 0) {
        // Count by role
        const byRole = registeredUsers.reduce((acc, u) => {
          acc[u.role] = (acc[u.role] || 0) + 1;
          return acc;
        }, {});
        console.log('📊 Users by Role:');
        Object.entries(byRole).forEach(([role, count]) => {
          console.log(`   ${role}: ${count}`);
        });
        console.log('📋 Sample Users:');
        registeredUsers.slice(0, 5).forEach((u, idx) => {
          console.log(`   ${idx + 1}. ${u.firstName} ${u.lastName} (${u.email}) - ${u.role}`);
        });
        if (registeredUsers.length > 5) {
          console.log(`   ... and ${registeredUsers.length - 5} more users`);
        }
      } else {
        console.warn('⚠️ No users found in database. Make sure users are registered and active.');
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (err) {
      console.error('❌ Error loading registered users:', err);
      registeredUsers = [];
    }
  }

  /**
   * Add participant (user object or email string)
   */
  async function addParticipant(userOrEmail) {
    let email, userData;

    // Revert: no hard restriction on departments here; validation focuses on format and registration

    if (typeof userOrEmail === 'string') {
      // Legacy: just email string
      email = userOrEmail.trim();
      if (!email) {
        await showAlertModal('Please enter an email address.', 'Empty Email');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await showAlertModal('Please enter a valid email address.\n\nExample: user@example.com', 'Invalid Email Format');
        return;
      }

      // Try to find user in registered users for full data
      const foundUser = registeredUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (foundUser) {
        userData = {
          email: foundUser.email,
          profilePicture: foundUser.profilePicture || '/images/memofy-logo.png',
          firstName: foundUser.firstName || '',
          lastName: foundUser.lastName || ''
        };
      } else {
        // User not found in registered users - prevent adding
        await showAlertModal(
          `"${email}" is not a registered user in the system.\n\nPlease select a registered user.`,
          'User Not Found'
        );
        console.warn('Attempted to add non-registered user:', email);
        return;
      }
    } else {
      // New: user object from database
      email = userOrEmail.email?.trim();
      if (!email) {
        await showAlertModal('User data is missing email address.', 'Invalid User Data');
        console.warn('User object missing email');
        return;
      }
      userData = {
        email,
        profilePicture: userOrEmail.profilePicture || '/images/memofy-logo.png',
        firstName: userOrEmail.firstName || '',
        lastName: userOrEmail.lastName || ''
      };
    }

    const trimmedEmail = email.toLowerCase();

    // Check if already added
    const isDuplicate = participantsData.emails.some(e => {
      const existingEmail = typeof e === 'string' ? e.toLowerCase() : e.email?.toLowerCase();
      return existingEmail === trimmedEmail;
    });

    if (isDuplicate) {
      const displayName = userData.firstName && userData.lastName
        ? `${userData.firstName} ${userData.lastName}`
        : email;
      await showAlertModal(`"${displayName}" is already added as a participant.`, 'Duplicate Participant');
      console.log('Email already added:', trimmedEmail);
      return;
    }

    // Store user data object instead of just email string
    participantsData.emails.push(userData);
    renderParticipantsChips();
    console.log('Participant added:', email, 'Total participants:', participantsData.emails.length);
  }

  /**
   * Add email to participants (legacy function for backward compatibility)
   */
  function addEmail(email) {
    addParticipant(email);
  }

  /**
   * Remove email from participants
   */
  function removeEmail(emailToRemove) {
    const emailLower = emailToRemove.toLowerCase();
    participantsData.emails = participantsData.emails.filter(e => {
      if (typeof e === 'string') {
        return e.toLowerCase() !== emailLower;
      } else {
        return (e.email || '').toLowerCase() !== emailLower;
      }
    });
    renderParticipantsChips();
  }

  /**
   * Remove department from participants
   */
  function removeDepartment(dept) {
    participantsData.departments = participantsData.departments.filter(d => d !== dept);
    renderParticipantsChips();
    renderDepartmentDropdown();
  }

  /**
   * Render participant chips
   */
  function renderParticipantsChips() {
    if (!participantsChipsContainer) {return;}
    participantsChipsContainer.innerHTML = '';

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

    participantsData.emails.forEach((emailOrUser) => {
      const chip = document.createElement('div');
      chip.className = 'participant-chip';

      // Handle both old format (string) and new format (object)
      let email, displayName, avatarUrl;
      if (typeof emailOrUser === 'string') {
        email = emailOrUser;
        displayName = email;
        avatarUrl = '/images/memofy-logo.png';
      } else {
        email = emailOrUser.email || '';
        displayName = emailOrUser.firstName && emailOrUser.lastName
          ? `${emailOrUser.firstName} ${emailOrUser.lastName}`
          : email;
        avatarUrl = emailOrUser.profilePicture || '/images/memofy-logo.png';
      }

      chip.innerHTML = `
        <img src="${avatarUrl}" alt="${displayName}" class="chip-avatar" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover; border: 1px solid #cbd5e1; flex-shrink: 0;">
        <span class="chip-label">${displayName}</span>
        <button type="button" class="chip-remove" aria-label="Remove ${email}">&times;</button>
      `;
      chip.querySelector('.chip-remove').addEventListener('click', () => removeEmail(email));
      participantsChipsContainer.appendChild(chip);
    });

    if (participantsHiddenInput) {
      participantsHiddenInput.value = JSON.stringify(participantsData);
    }
  }

})();
