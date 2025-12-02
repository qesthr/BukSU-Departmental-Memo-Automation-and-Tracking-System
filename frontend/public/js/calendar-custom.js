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

  // Attachment Modal Functions (similar to log.js)
  let currentAttachments = [];
  let currentAttachmentIndex = 0;

  function createAttachmentModal() {
    // Check if modal already exists
    if (document.getElementById('attachmentViewerModal')) {
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'attachmentViewerModal';
    modal.className = 'modal';
    modal.style.cssText = 'display: none; position: fixed; z-index: 100002; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.9); overflow: auto;';
    modal.innerHTML = `
      <div class="attachment-modal-content" style="position: relative; background-color: #fff; margin: 2% auto; padding: 0; width: 90%; max-width: 1200px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-height: 90vh; display: flex; flex-direction: column;">
        <div class="attachment-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb;">
          <div style="flex: 1;">
            <h3 id="attachmentFileName" style="margin: 0; font-size: 1.125rem; font-weight: 600; color: #111827;"></h3>
            <p id="attachmentFileSize" style="margin: 0.25rem 0 0 0; font-size: 0.875rem; color: #6b7280;"></p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button id="attachmentPrevBtn" class="attachment-nav-btn" style="display: none; padding: 0.5rem; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer;" title="Previous">
              <i data-lucide="chevron-left" style="width: 20px; height: 20px;"></i>
            </button>
            <button id="attachmentNextBtn" class="attachment-nav-btn" style="display: none; padding: 0.5rem; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer;" title="Next">
              <i data-lucide="chevron-right" style="width: 20px; height: 20px;"></i>
            </button>
            <a id="attachmentDownloadBtn" href="#" download style="padding: 0.5rem 1rem; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 500; font-size: 0.875rem;" title="Download">
              <i data-lucide="download" style="width: 18px; height: 18px;"></i>
              <span>Download</span>
            </a>
            <button id="attachmentCloseBtn" style="padding: 0.5rem; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer; font-size: 1.5rem; line-height: 1; color: #6b7280;" title="Close">×</button>
          </div>
        </div>
        <div id="attachmentViewerBody" style="flex: 1; overflow: auto; padding: 1.5rem; display: flex; align-items: center; justify-content: center; min-height: 400px; background: #f9fafb;">
          <div id="attachmentViewerContent" style="width: 100%; text-align: center;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Add event listeners
    const closeBtn = document.getElementById('attachmentCloseBtn');
    const prevBtn = document.getElementById('attachmentPrevBtn');
    const nextBtn = document.getElementById('attachmentNextBtn');

    if (closeBtn) {
      closeBtn.addEventListener('click', closeAttachmentModal);
    }

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAttachmentModal();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modalEl = document.getElementById('attachmentViewerModal');
        if (modalEl && modalEl.style.display !== 'none') {
          closeAttachmentModal();
        }
      }
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', () => showPreviousAttachment());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => showNextAttachment());
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function openAttachmentModal(attachments, index) {
    currentAttachments = attachments;
    currentAttachmentIndex = index;
    createAttachmentModal();
    showAttachment(currentAttachmentIndex);
    const modal = document.getElementById('attachmentViewerModal');
    if (modal) {
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
      modal.style.zIndex = '100002';
    }
  }

  function closeAttachmentModal() {
    const modal = document.getElementById('attachmentViewerModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
    currentAttachments = [];
    currentAttachmentIndex = 0;
  }

  function showAttachment(index) {
    if (!currentAttachments || currentAttachments.length === 0 || index < 0 || index >= currentAttachments.length) {
      return;
    }

    const attachment = currentAttachments[index];
    const attachmentUrl = attachment.url || `/uploads/${attachment.filename}`;
    const isPDF = attachment.mimetype === 'application/pdf';
    const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');

    // Update file info
    const fileNameEl = document.getElementById('attachmentFileName');
    const fileSizeEl = document.getElementById('attachmentFileSize');
    const downloadBtn = document.getElementById('attachmentDownloadBtn');
    const contentEl = document.getElementById('attachmentViewerContent');
    const prevBtn = document.getElementById('attachmentPrevBtn');
    const nextBtn = document.getElementById('attachmentNextBtn');

    if (fileNameEl) {
      fileNameEl.textContent = attachment.filename || 'Attachment';
    }
    if (fileSizeEl) {
      const size = attachment.size || 0;
      const formatSize = size < 1024 ? size + ' B' :
                        size < 1024 * 1024 ? (size / 1024).toFixed(1) + ' KB' :
                        (size / (1024 * 1024)).toFixed(1) + ' MB';
      fileSizeEl.textContent = `${formatSize} • ${index + 1} of ${currentAttachments.length}`;
    }
    if (downloadBtn) {
      downloadBtn.href = attachmentUrl;
      downloadBtn.download = attachment.filename;
    }

    // Show/hide navigation buttons
    if (prevBtn) {
      prevBtn.style.display = currentAttachments.length > 1 ? 'block' : 'none';
    }
    if (nextBtn) {
      nextBtn.style.display = currentAttachments.length > 1 ? 'block' : 'none';
    }

    // Display content
    if (contentEl) {
      if (isImage) {
        contentEl.innerHTML = `<img src="${attachmentUrl}" alt="${attachment.filename}" style="max-width: 100%; max-height: calc(90vh - 200px); height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />`;
      } else if (isPDF) {
        // Intercept print events immediately to prevent print dialog
        const preventPrint = (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          e.stopPropagation();
          return false;
        };

        window.addEventListener('beforeprint', preventPrint, true);
        window.addEventListener('print', preventPrint, true);
        document.addEventListener('beforeprint', preventPrint, true);
        document.addEventListener('print', preventPrint, true);

        // Show loading state first
        contentEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: calc(90vh - 200px); background: #f9fafb;">
            <div style="text-align: center;">
              <div style="width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
              <p style="color: #6b7280; margin: 0;">Loading PDF preview...</p>
            </div>
          </div>
          <style>
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          </style>
        `;

        // Load PDF in iframe after modal is fully visible
        setTimeout(() => {
          const iframe = document.createElement('iframe');
          const pdfUrl = attachmentUrl.includes('#')
            ? attachmentUrl + '&toolbar=1&navpanes=0'
            : attachmentUrl + '#toolbar=1&navpanes=0';
          iframe.src = pdfUrl;
          iframe.style.cssText = 'width: 100%; height: calc(90vh - 200px); border: none; border-radius: 8px; display: block;';
          iframe.title = attachment.filename;
          iframe.setAttribute('allow', 'fullscreen');

          iframe.onload = function() {
            try {
              const iframeWindow = iframe.contentWindow;
              if (iframeWindow) {
                iframeWindow.addEventListener('beforeprint', preventPrint, true);
                iframeWindow.addEventListener('print', preventPrint, true);
              }
            } catch (e) {
              // Cross-origin restrictions - ignore
            }
          };

          contentEl.innerHTML = '';
          contentEl.appendChild(iframe);
        }, 200);
      } else {
        contentEl.innerHTML = `
          <div style="padding: 3rem; text-align: center;">
            <i data-lucide="file" style="width: 64px; height: 64px; color: #9ca3af; margin-bottom: 1rem;"></i>
            <p style="color: #6b7280; margin: 0.5rem 0;">This file type cannot be previewed.</p>
            <a href="${attachmentUrl}" download="${attachment.filename}" style="display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Download File</a>
          </div>
        `;
      }
    }

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function showPreviousAttachment() {
    if (currentAttachmentIndex > 0) {
      currentAttachmentIndex--;
      showAttachment(currentAttachmentIndex);
    }
  }

  function showNextAttachment() {
    if (currentAttachmentIndex < currentAttachments.length - 1) {
      currentAttachmentIndex++;
      showAttachment(currentAttachmentIndex);
    }
  }

  // Expose function globally for use in calendar event modals
  window.openCalendarAttachmentModal = function(attachments, index) {
    openAttachmentModal(attachments, index);
  };

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
  const saveBtn = document.getElementById('saveMemoBtn') || (form ? form.querySelector('button[type="submit"]') : null);
  const deleteBtn = document.getElementById('deleteMemo');
  const archiveBtn = document.getElementById('archiveMemo');
  const readOnlyView = document.getElementById('readOnlyEventView');
  const readOnlyOkBtn = document.getElementById('readOnlyOkBtn');

  // Data
  let departmentsList = [];
  let registeredUsers = [];
  let participantsData = { departments: [], emails: [] };

  // Filter state
  const calendarFilters = {
    mine: false,
    department: false
  };
  let categoryFilter = null; // null = all categories, or 'urgent', 'today', etc.
  let allEventsCache = []; // Cache all events for client-side filtering
  window.allEventsCache = allEventsCache; // Expose globally for search functionality
  let isInitialLoad = true; // Track if this is the first load

  // Modal functions (from original calendar.js)
  function showConfirmModal(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      if (!modal) {
        Swal.fire({
          title: title,
          text: message,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'OK',
          cancelButtonText: 'Cancel'
        }).then((result) => {
          resolve(result.isConfirmed);
        });
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
        // Fallback to SweetAlert2 with professional styling
        Swal.fire({
          icon: 'info',
          title: title,
          html: message,
          width: 520,
          confirmButtonText: 'OK',
          confirmButtonColor: '#1C89E3',
          focusConfirm: true
        }).then(() => {
          resolve();
        });
        return;
      }
      const titleEl = document.getElementById('alertModalTitle');
      const messageEl = document.getElementById('alertModalMessage');
      const okBtn = document.getElementById('alertModalOk');
      const closeBtn = document.getElementById('alertModalClose');
      titleEl.textContent = title;
      messageEl.innerHTML = message; // Use innerHTML to render HTML tags properly
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
    // Check if view-only mode (for faculty)
    const isViewOnly = window.calendarViewOnly === true || (window.currentUser && window.currentUser.role === 'faculty');

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
      initialDate: today,
      viewOnly: isViewOnly // Pass view-only flag to calendar
    });

    // Hide Add Event button if view-only
    if (isViewOnly) {
      setTimeout(() => {
        const addEventBtn = document.querySelector('.btn-primary');
        if (addEventBtn && addEventBtn.textContent.includes('Add Event')) {
          addEventBtn.style.display = 'none';
        }
      }, 100);
    }

    // Initialize filters
    initFilters();

    // Load events
    loadEvents();

    // Initialize mini calendar
    initMiniCalendar();

    // Set up event handlers (only if not view-only)
    if (!isViewOnly) {
      setupEventHandlers();
      // Load departments and users (only needed for creating events)
      loadDepartments();
      loadRegisteredUsers();
    }

    // Override openModal for view-only mode
    if (isViewOnly) {
      window.openModal = () => {
        if (window.showAlertModal) {
          window.showAlertModal('Faculty can view calendar events but cannot create or edit them.', 'View Only');
        } else {
          Swal.fire({
            icon: 'info',
            title: 'View Only',
            text: 'Faculty can view calendar events but cannot create or edit them.'
          });
        }
      };
      window.openEventModal = window.openModal;
    } else {
      // Expose global functions for normal mode
      window.openModal = openEventModal;
      window.openEventModal = openEventModal;
    }

    // Expose global functions
    window.showConfirmModal = showConfirmModal;
    window.showAlertModal = showAlertModal;
    window.customCalendar = customCalendar;
    window.participantsData = participantsData;
    window.renderParticipantsChips = renderParticipantsChips;
    window.loadParticipantsForEdit = loadParticipantsForEdit;
    window.openEventModalForEdit = openEventModalForEdit;
    window.loadEvents = loadEvents; // Expose loadEvents for mini calendar navigation
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
  async function loadEvents(targetDate = null) {
    try {
      // Use targetDate if provided (for navigation), otherwise use current date
      const referenceDate = targetDate || new Date();
      const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
      const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 2, 0);

      const startStr = formatDateForAPI(start);
      const endStr = formatDateForAPI(end);

      // Fetch database events
      const qs = new URLSearchParams({ start: startStr, end: endStr });
      const res = await fetch(`/api/calendar/events?${qs.toString()}`, { credentials: 'same-origin' });

      let allEvents = [];

      if (res.ok) {
        const data = await res.json();
        const dbEvents = data.map(e => formatEventForCalendar(e, 'backend'));
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

      // Filter out archived events - show all events (including past) when navigating to specific dates
      // Only filter past events on initial load
      const now = new Date();
      const activeEvents = allEvents.filter(e => {
        const eventEnd = new Date(e.end);
        const category = e.extendedProps?.category || e.category || 'standard';
        // Exclude archived events
        // If targetDate is provided (navigation), show all events in the range
        // Otherwise (initial load), filter out past events
        if (category === 'archived') {return false;}
        if (targetDate) {return true;} // Show all events when navigating to a specific date
        return eventEnd >= now; // Filter past events only on initial load
      });

      // Cache all active events for filtering
      allEventsCache = activeEvents;
      window.allEventsCache = allEventsCache; // Update global reference for search

      // Apply filters and update calendar
      applyFilters();

      // Mark that initial load is complete
      isInitialLoad = false;

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

    // Create header row for day names (matching secretary/faculty structure)
    const headerRow = document.createElement('div');
    headerRow.className = 'mini-cal-header-row';
    const dow = ['S','M','T','W','T','F','S'];
    dow.forEach(ch => {
      const el = document.createElement('span');
      el.className = 'mini-cal-day-header';
      el.textContent = ch;
      headerRow.appendChild(el);
    });
    mini.appendChild(headerRow);

    // Create days container (matching secretary/faculty structure)
    const daysContainer = document.createElement('div');
    daysContainer.className = 'mini-cal-days';

    const startDay = new Date(miniCursor.getFullYear(), miniCursor.getMonth(), 1);
    const firstDow = startDay.getDay();
    const lastDay = new Date(miniCursor.getFullYear(), miniCursor.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();

    // First day of the calendar grid (may be from previous month)
    const calendarStart = new Date(startDay);
    calendarStart.setDate(startDay.getDate() - firstDow);

    // Generate 42 days (6 weeks) to match secretary/faculty structure
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(calendarStart);
      currentDate.setDate(calendarStart.getDate() + i);

      const el = document.createElement('div');
      el.className = 'mini-cal-day';
      const dayNumber = currentDate.getDate();
      el.textContent = String(dayNumber);

      // Check if this date is from current month
      const isCurrentMonth = currentDate.getMonth() === miniCursor.getMonth();
      if (!isCurrentMonth) {
        el.classList.add('mini-cal-day-other');
      }

      // Check if today
      const todayInManila = getTodayInManila();
      const iterDateStr = formatDateManila(currentDate);
      const todayDateStr = formatDateManila(todayInManila);
      if (iterDateStr === todayDateStr) {
        el.classList.add('mini-cal-day-today');
      }

      // Check if selected
      const iterDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const selectedDateNormalized = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      if (iterDate.getTime() === selectedDateNormalized.getTime()) {
        el.classList.add('mini-cal-day-selected');
      }

      // Check for events
      const dayEvents = getEventsForDate(currentDate);
      if (dayEvents.length > 0) {
        el.classList.add('mini-cal-day-has-events');
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

      // Click handler - use navigateToDate for consistency and proper event loading
      el.addEventListener('click', () => {
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        clickedDate.setHours(0, 0, 0, 0);
        selectedDate = clickedDate;
        renderMiniCalendar();

        // Use navigateToDate if available (same as secretary/faculty)
        if (customCalendar && typeof customCalendar.navigateToDate === 'function') {
          customCalendar.navigateToDate(clickedDate);
        } else {
          // Fallback
          customCalendar.gotoDate(clickedDate);
          customCalendar.changeView('timeGridDay');
          if (typeof loadEvents === 'function') {
            loadEvents(clickedDate);
          }
        }
      });

      daysContainer.appendChild(el);
    }

    mini.appendChild(daysContainer);
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
   * Open event modal (Create Mode)
   */
  function openEventModal(prefilledDate = null) {
    const modal = document.getElementById('memoModal');
    if (!modal) {return;}

    // Hide read-only view, show editable form
    if (readOnlyView) {readOnlyView.style.display = 'none';}
    if (form) {form.style.display = 'block';}

    // Set to Create Mode
    document.getElementById('memoModalTitle').textContent = 'Add Event';
    if (form) {
      form.reset();
      // Explicitly clear description field
      if (descInput) {
        descInput.value = '';
        console.log('✅ Description field cleared for new event');
      }
      // Hide attachments container for new events
      const attachmentsContainer = document.getElementById('eventAttachmentsContainer');
      if (attachmentsContainer) {
        attachmentsContainer.style.display = 'none';
        attachmentsContainer.innerHTML = '';
      }
      // Hide "View/Edit Memo" button for new events
      const viewEditMemoBtn = document.getElementById('viewEditMemoBtn');
      if (viewEditMemoBtn) {
        viewEditMemoBtn.style.display = 'none';
      }
    }

    if (editingSourceInput) {editingSourceInput.value = '';}
    if (editingIdInput) {editingIdInput.value = '';}

    // Hide edit mode buttons, show create mode button
    if (deleteBtn) {deleteBtn.style.display = 'none';}
    if (archiveBtn) {archiveBtn.style.display = 'none';}
    // Reset button text for create mode
    if (saveBtn) {
      const btnText = saveBtn.querySelector('.btn-text');
      if (btnText) {
        btnText.textContent = 'Add';
      } else {
        saveBtn.textContent = 'Add';
      }
    }

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
   * Open event modal - detects CREATOR MODE vs RECIPIENT MODE
   * Fetches full event data from API and shows appropriate view
   */
  async function openEventModalForEdit(eventId) {
    const modal = document.getElementById('memoModal');
    if (!modal || !eventId) {
      console.error('Cannot open edit modal: modal or eventId missing');
      return;
    }

    try {
      // Fetch full event data from API
      const res = await fetch(`/api/calendar/events/${eventId}`, {
        credentials: 'same-origin'
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to fetch event:', errorText);
        await showAlertModal('Failed to load event data. Please try again.', 'Error');
        return;
      }

      const event = await res.json();
      console.log('📝 Loading event:', event);
      console.log('   isCreator flag:', event.isCreator);
      console.log('   createdById:', event.createdById);
      console.log('   currentUser.id:', window.currentUser?.id);
      console.log('   createdBy (raw):', event.createdBy);

      // Determine mode: CREATOR MODE vs RECIPIENT MODE
      // Check multiple ways to determine if user is creator
      let isCreator = false;
      
      // Method 1: Check isCreator flag from backend
      if (event.isCreator === true) {
        isCreator = true;
        console.log('   ✅ Creator check: isCreator flag is true');
      } 
      // Method 2: Compare createdById with current user id
      else if (event.createdById && window.currentUser?.id) {
        const createdByIdStr = String(event.createdById).trim();
        const currentUserIdStr = String(window.currentUser.id).trim();
        if (createdByIdStr === currentUserIdStr) {
          isCreator = true;
          console.log('   ✅ Creator check: createdById matches currentUser.id');
        } else {
          console.log('   ❌ Creator check: IDs do not match', {
            createdById: createdByIdStr,
            currentUserId: currentUserIdStr,
            match: createdByIdStr === currentUserIdStr
          });
        }
      }
      // Method 3: Check createdBy._id if available
      else if (event.createdBy && window.currentUser?.id) {
        const createdById = event.createdBy._id ? String(event.createdBy._id) : String(event.createdBy);
        const currentUserIdStr = String(window.currentUser.id).trim();
        if (createdById === currentUserIdStr) {
          isCreator = true;
          console.log('   ✅ Creator check: createdBy._id matches currentUser.id');
        }
      }

      console.log('   Final Mode:', isCreator ? 'CREATOR MODE (Editable)' : 'RECIPIENT MODE (Read Only)');

      if (isCreator) {
        // CREATOR MODE: Show editable form
        openEventModalCreatorMode(event);
      } else {
        // RECIPIENT MODE: Show read-only view
        openEventModalRecipientMode(event);
      }

    } catch (err) {
      console.error('Error loading event:', err);
      await showAlertModal('An error occurred while loading the event. Please try again.', 'Error');
    }
  }

  /**
   * Open event modal in CREATOR MODE (Editable)
   */
  function openEventModalCreatorMode(event) {
    const modal = document.getElementById('memoModal');

    // Hide read-only view, show editable form
    if (readOnlyView) {readOnlyView.style.display = 'none';}
    if (form) {form.style.display = 'block';}

    // Set modal title
    document.getElementById('memoModalTitle').textContent = 'Edit Event';

    // Populate form fields
    if (titleInput) {titleInput.value = event.title || '';}
    if (categorySelect) {categorySelect.value = event.category || 'standard';}
    if (descInput) {descInput.value = event.description || '';}

    // If event has memoId, fetch and display attachments INSIDE Description/Notes section (read-only)
    const attachmentsContainer = document.getElementById('eventAttachmentsContainer');
    if (event.memoId && attachmentsContainer) {
      fetch(`/api/log/memos/${event.memoId}`, { credentials: 'same-origin' })
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.memo && data.memo.attachments && data.memo.attachments.length > 0) {
            // Show attachments container
            attachmentsContainer.style.display = 'block';

            let htmlContent = '<div style="margin-top: 0.75rem;">';
            htmlContent += '<div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">Attachments (Read-Only)</div>';

            // Store attachments in a data attribute for safe access
            const attachmentsId = 'attachments-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            if (!window.calendarAttachments) {
              window.calendarAttachments = {};
            }
            window.calendarAttachments[attachmentsId] = data.memo.attachments;

            data.memo.attachments.forEach((attachment, attIndex) => {
              const attachmentUrl = attachment.url || `/uploads/${attachment.filename}`;
              const isPDF = attachment.mimetype === 'application/pdf';
              const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');

              if (isImage) {
                htmlContent += `
                  <div style="margin-bottom: 1rem; padding: 0.75rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <img src="${attachmentUrl}" alt="${attachment.filename}"
                         style="max-width: 100%; max-height: 250px; border-radius: 6px; display: block; margin-bottom: 0.5rem; cursor: pointer;"
                         data-attachments-id="${attachmentsId}"
                         data-attachment-index="${attIndex}"
                         class="calendar-attachment-view"
                         title="Click to view in modal" />
                    <div style="font-size: 0.875rem; color: #6b7280; display: flex; align-items: center; gap: 0.5rem;">
                      <span>📷</span>
                      <span>${attachment.filename}</span>
                    </div>
                  </div>
                `;
              } else {
                htmlContent += `
                  <div style="margin-bottom: 0.75rem; padding: 0.75rem; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <a href="#" data-attachments-id="${attachmentsId}" data-attachment-index="${attIndex}" class="calendar-attachment-view"
                       style="color: #2563eb; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; cursor: pointer;">
                      <span>${isPDF ? '📄' : '📎'}</span>
                      <span style="font-weight: 500;">${attachment.filename}</span>
                    </a>
                  </div>
                `;
              }
            });

            htmlContent += '</div>';
            attachmentsContainer.innerHTML = htmlContent;
          } else {
            // Hide attachments container if no attachments
            attachmentsContainer.style.display = 'none';
          }
        })
        .catch(err => {
          console.error('Error fetching memo attachments:', err);
          if (attachmentsContainer) {
            attachmentsContainer.style.display = 'none';
          }
        });
    } else {
      // Hide attachments container if no memoId
      if (attachmentsContainer) {
        attachmentsContainer.style.display = 'none';
      }
    }

    // Format dates for inputs
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const endDateInput = document.getElementById('memoEndDate');
    if (dateInput) {dateInput.value = formatDateForInput(startDate);}
    if (endDateInput) {endDateInput.value = formatDateForInput(endDate);}
    if (startInput) {startInput.value = formatTimeForInput(startDate);}
    if (endInput) {endInput.value = formatTimeForInput(endDate);}

    // Set editing metadata
    if (editingSourceInput) {editingSourceInput.value = 'backend';}
    if (editingIdInput) {editingIdInput.value = event._id || event.id;}

    // Show edit mode buttons, hide create mode button
    if (deleteBtn) {deleteBtn.style.display = 'block';}
    if (archiveBtn) {archiveBtn.style.display = 'block';}
    // Update button text and show loading state capability
    if (saveBtn) {
      const btnText = saveBtn.querySelector('.btn-text');
      if (btnText) {
        btnText.textContent = 'Update';
      } else {
        saveBtn.textContent = 'Update';
      }
    }

    // Load participants
    if (event.participants && window.loadParticipantsForEdit) {
      window.loadParticipantsForEdit(event.participants);
    } else {
      participantsData = { departments: [], emails: [] };
      renderParticipantsChips();
    }

    // Show modal
    modal.style.display = 'block';

    // Re-initialize autocomplete
    setTimeout(() => {
      initializeAutocomplete();
    }, 100);
  }

  /**
   * Open event modal in RECIPIENT MODE (Read-Only)
   */
  function openEventModalRecipientMode(event) {
    const modal = document.getElementById('memoModal');

    // Hide editable form, show read-only view
    if (form) {form.style.display = 'none';}
    if (readOnlyView) {readOnlyView.style.display = 'block';}

    // Set modal title
    document.getElementById('memoModalTitle').textContent = 'Event Details (Read Only)';

    // Populate read-only fields
    const readOnlyTitle = document.getElementById('readOnlyTitle');
    const readOnlyCategory = document.getElementById('readOnlyCategory');
    const readOnlyDate = document.getElementById('readOnlyDate');
    const readOnlyStart = document.getElementById('readOnlyStart');
    const readOnlyEnd = document.getElementById('readOnlyEnd');
    const readOnlyParticipants = document.getElementById('readOnlyParticipants');
    const readOnlyDescription = document.getElementById('readOnlyDescription');

    if (readOnlyTitle) {readOnlyTitle.textContent = event.title || '(No title)';}

    // Format category with emoji
    const categoryLabels = {
      urgent: '🔴 Urgent',
      high: '🟠 High Priority',
      standard: '🟢 Standard',
      meeting: '🟣 Meeting',
      deadline: '⏰ Deadline',
      reminder: '🔔 Reminder',
      low: '🔵 Low Priority',
      archived: '📦 Archived'
    };
    if (readOnlyCategory) {
      readOnlyCategory.textContent = categoryLabels[event.category] || event.category || 'Standard';
    }

    // Format dates
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    if (readOnlyDate) {
      readOnlyDate.textContent = startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    if (readOnlyStart) {
      readOnlyStart.textContent = startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    }
    if (readOnlyEnd) {
      readOnlyEnd.textContent = endDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    }

    // Format participants
    if (readOnlyParticipants) {
      let participantsText = 'None';
      if (event.participants) {
        const parts = [];
        if (event.participants.departments && Array.isArray(event.participants.departments) && event.participants.departments.length > 0) {
          parts.push(`Departments: ${event.participants.departments.join(', ')}`);
        }
        if (event.participants.emails && Array.isArray(event.participants.emails) && event.participants.emails.length > 0) {
          const emailList = event.participants.emails.map(e => typeof e === 'string' ? e : e.email).join(', ');
          parts.push(`Emails: ${emailList}`);
        }
        participantsText = parts.length > 0 ? parts.join('; ') : 'None';
      }
      readOnlyParticipants.textContent = participantsText;
    }

    // Show "View Full Memo" button if event has memoId
    const readOnlyViewMemoBtn = document.getElementById('readOnlyViewMemoBtn');
    if (readOnlyViewMemoBtn && event.memoId) {
      readOnlyViewMemoBtn.style.display = 'block';
      readOnlyViewMemoBtn.onclick = () => {
        // Navigate to memo page
        const userRole = window.currentUser?.role || 'admin';
        const basePath = userRole === 'faculty' ? '/faculty/memos' : '/admin/log';
        window.location.href = `${basePath}?memo=${event.memoId}`;
      };
    } else if (readOnlyViewMemoBtn) {
      readOnlyViewMemoBtn.style.display = 'none';
    }

    // Format description - if event has memoId, fetch full memo with attachments
    if (readOnlyDescription) {
      if (event.memoId) {
        // Fetch full memo to display content and attachments
        fetch(`/api/log/memos/${event.memoId}`, { credentials: 'same-origin' })
          .then(res => res.json())
          .then(data => {
            if (data && data.success && data.memo) {
              const memo = data.memo;
              let htmlContent = '';

              // Display memo content
              if (memo.content && memo.content.trim()) {
                const safeContent = memo.content
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;');
                htmlContent += `<div style="white-space: pre-wrap; margin-bottom: ${memo.attachments && memo.attachments.length > 0 ? '1rem' : '0'}; line-height: 1.6; color: #111827;">${safeContent}</div>`;
              }

              // Display attachments
              if (memo.attachments && memo.attachments.length > 0) {
                htmlContent += '<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">';
                htmlContent += '<strong style="display: block; margin-bottom: 0.5rem; color: #374151;">Attachments:</strong>';

                // Store attachments in a data attribute for safe access
                const attachmentsId = 'attachments-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                if (!window.calendarAttachments) {
                  window.calendarAttachments = {};
                }
                window.calendarAttachments[attachmentsId] = memo.attachments;

                memo.attachments.forEach((attachment, attIndex) => {
                  const attachmentUrl = attachment.url || `/uploads/${attachment.filename}`;
                  const isPDF = attachment.mimetype === 'application/pdf';
                  const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');

                  if (isImage) {
                    // Display image inline
                    htmlContent += `
                      <div style="margin-bottom: 0.75rem;">
                        <img src="${attachmentUrl}" alt="${attachment.filename}"
                             style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer;"
                             data-attachments-id="${attachmentsId}"
                             data-attachment-index="${attIndex}"
                             class="calendar-attachment-view"
                             title="Click to view in modal" />
                        <div style="margin-top: 0.25rem; font-size: 0.875rem; color: #6b7280;">${attachment.filename}</div>
                      </div>
                    `;
                  } else {
                    // Display file link
                    htmlContent += `
                      <div style="margin-bottom: 0.5rem;">
                        <a href="#" data-attachments-id="${attachmentsId}" data-attachment-index="${attIndex}" class="calendar-attachment-view"
                           style="color: #2563eb; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                          <span>${isPDF ? '📄' : '📎'}</span>
                          <span>${attachment.filename}</span>
                        </a>
                      </div>
                    `;
                  }
                });

                htmlContent += '</div>';
              }

              readOnlyDescription.innerHTML = htmlContent || '(No description)';
            } else {
              // Fallback to event description if memo fetch fails
              readOnlyDescription.textContent = event.description || '(No description)';
            }
          })
          .catch(err => {
            console.error('Error fetching memo:', err);
            // Fallback to event description on error
            readOnlyDescription.textContent = event.description || '(No description)';
          });
      } else {
        // No memoId, just show event description
        readOnlyDescription.textContent = event.description || '(No description)';
      }
    }

    // Show modal
    modal.style.display = 'block';
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
    const participantEmailInput = document.getElementById('participantEmailInput');
    const emailSuggestions = document.getElementById('emailSuggestions');

    if (!participantEmailInput) {
      console.warn('⚠️ Participant input element not found');
      return;
    }

    if (!emailSuggestions) {
      console.warn('⚠️ Email suggestions element not found');
      return;
    }

    if (participantEmailInput.dataset.autocompleteInitialized === 'true') {
      // Already wired up; just reposition suggestions for current modal state
      setTimeout(() => {
        const rect = participantEmailInput.getBoundingClientRect();
        emailSuggestions.style.left = rect.left + 'px';
        emailSuggestions.style.width = rect.width + 'px';
        emailSuggestions.style.top = (rect.bottom + 4) + 'px';
      }, 0);
      return;
    }

    participantEmailInput.dataset.autocompleteInitialized = 'true';

    console.log('✅ Initializing autocomplete for participant input');

    // Move suggestions panel to body so it can float above modals
    if (emailSuggestions.parentElement !== document.body) {
      emailSuggestions.parentElement.removeChild(emailSuggestions);
      document.body.appendChild(emailSuggestions);
    }

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
      const myDept = (window.currentUser && window.currentUser.department ? String(window.currentUser.department).toLowerCase() : '');

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

    document.addEventListener('click', (e) => {
      if (!participantEmailInput.contains(e.target) && !emailSuggestions.contains(e.target)) {
        emailSuggestions.style.display = 'none';
        selectedIndex = -1;
      }
    });
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

    if (archiveBtn) {
      archiveBtn.onclick = handleArchiveEvent;
    }

    if (readOnlyOkBtn) {
      readOnlyOkBtn.onclick = () => {
        document.getElementById('memoModal').style.display = 'none';
      };
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

    // Get end date if provided, otherwise use start date
    const endDateInput = document.getElementById('memoEndDate');
    const endDate = endDateInput && endDateInput.value ? endDateInput.value : date;
    
    const startISO = formatDateTime(date, start);
    const endISO = end ? formatDateTime(endDate, end) : formatDateTime(endDate, start.split(':').map((v, i) => i === 0 ? String((parseInt(v) + 1) % 24).padStart(2, '0') : v).join(':'));

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
        console.log('📝 Updating event ID:', editingId);
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
        console.log('✅ Updated event ID:', updatedEvent._id || updatedEvent.id);

        // Clear editing metadata after successful update to prevent accidental duplicates
        if (editingSourceInput) {editingSourceInput.value = '';}
        if (editingIdInput) {editingIdInput.value = '';}

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

        // Reset form and button state after modal closes
        // Ensure editing metadata is cleared to prevent duplicates
        if (editingSourceInput) {editingSourceInput.value = '';}
        if (editingIdInput) {editingIdInput.value = '';}
        if (deleteBtn) {deleteBtn.style.display = 'none';}
        if (archiveBtn) {archiveBtn.style.display = 'none';}
        if (saveBtn) {saveBtn.textContent = 'Add';}
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

    if (!editingId) {
      await showAlertModal('No event selected to delete.', 'Error');
      return;
    }

    const confirmed = await showConfirmModal('Are you sure you want to delete this event? This action cannot be undone.', 'Delete Event');
    if (!confirmed) {return;}

    try {
      if (editingSource === 'backend') {
        const res = await fetch(`/api/calendar/events/${editingId}`, {
          method: 'DELETE',
          credentials: 'same-origin'
        });

        if (!res.ok) {
          const errorText = await res.text();
          let errorMessage = 'Failed to delete event.';
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch {
            if (errorText) {errorMessage = errorText;}
          }
          await showAlertModal(errorMessage, 'Delete Failed');
          return;
        }
      } else {
        await showAlertModal('Only database events can be deleted.', 'Error');
        return;
      }

      // Success - refresh calendar and close modal
      await loadEvents();
      document.getElementById('memoModal').style.display = 'none';

      // Show success message
      await showAlertModal('Event has been deleted successfully.', 'Event Deleted');
    } catch (err) {
      console.error('Error deleting event:', err);
      await showAlertModal('An error occurred while deleting the event. Please try again.', 'Error');
    }
  }

  /**
   * Handle archive event
   */
  async function handleArchiveEvent() {
    const editingId = editingIdInput.value;
    const editingSource = editingSourceInput.value;

    if (!editingId) {
      await showAlertModal('No event selected to archive.', 'Error');
      return;
    }

    if (editingSource !== 'backend') {
      await showAlertModal('Only database events can be archived.', 'Error');
      return;
    }

    const confirmed = await showConfirmModal(
      'Are you sure you want to archive this event? Archived events will be moved to the Archive section.',
      'Archive Event'
    );
    if (!confirmed) {return;}

    try {
      const res = await fetch(`/api/calendar/events/${editingId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to archive event:', errorText);
        let errorMessage = 'Failed to archive event.';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          if (errorText) {errorMessage = errorText;}
        }
        await showAlertModal(errorMessage, 'Archive Failed');
        return;
      }

      const archivedEvent = await res.json();
      console.log('✅ Event archived:', archivedEvent);

      // Refresh calendar and close modal
      await loadEvents();
      document.getElementById('memoModal').style.display = 'none';

      await showAlertModal('Event has been archived successfully.', 'Event Archived');
    } catch (err) {
      console.error('Error archiving event:', err);
      await showAlertModal('An error occurred while archiving the event. Please try again.', 'Error');
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

  /**
   * Apply filters to events and update calendar
   */
  function applyFilters() {
    if (!customCalendar || allEventsCache.length === 0) {
      return;
    }

    let filteredEvents = [...allEventsCache];

    // Filter by calendar type (My Events, Department)
    // Only filter if at least one checkbox is checked
    if (calendarFilters.mine || calendarFilters.department) {
      filteredEvents = filteredEvents.filter(event => {
        const isCreator = event.extendedProps?.isCreator === true;
        const hasDepartmentParticipants = event.extendedProps?.participants?.departments?.length > 0;
        const userDepartment = window.currentUser?.department;
        let matches = false;

        // Show if "My Events" is checked and user is creator
        if (calendarFilters.mine && isCreator) {
          matches = true;
        }

        // Show if "Department" is checked and event has department participants matching user's department
        if (!matches && calendarFilters.department && hasDepartmentParticipants && userDepartment) {
          const eventDepartments = event.extendedProps.participants.departments || [];
          if (eventDepartments.includes(userDepartment)) {
            matches = true;
          }
        }

        return matches;
      });
    } else {
      // If no filters are checked, show all events (no filtering)
      // This means all events from cache will be shown
    }

    // Filter by category
    if (categoryFilter) {
      filteredEvents = filteredEvents.filter(event => {
        const eventCategory = event.extendedProps?.category || event.category || 'standard';

        // Map UI category names to backend category values
        if (categoryFilter === 'today') {
          // For "Today", show events happening today
          const today = new Date();
          const eventStart = new Date(event.start);
          return eventStart.toDateString() === today.toDateString();
        } else if (categoryFilter === 'urgent') {
          return eventCategory === 'urgent' || eventCategory === 'high';
        }
        return eventCategory === categoryFilter;
      });
    }

    // Check if no events match the filter (only show message if we have events but none match)
    // Show when filters are active and result in no events
    const hasActiveFilters = (calendarFilters.mine || calendarFilters.department) || categoryFilter !== null;
    if (!isInitialLoad && filteredEvents.length === 0 && allEventsCache.length > 0 && hasActiveFilters) {
      // Show SweetAlert notification
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'info',
          title: 'No Events Found',
          text: 'No events match the selected filters.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#1C89E3',
          timer: 3000,
          timerProgressBar: true
        });
      } else {
        // Fallback to alert if SweetAlert is not available
        alert('No events match the selected filters.');
      }
    }

    // Update calendar with filtered events
    customCalendar.setEvents(filteredEvents);

    // Update mini calendar events
    miniCalendarEvents = filteredEvents;
    renderMiniCalendar();
  }

  /**
   * Initialize filter UI and event listeners
   */
  function initFilters() {
    // Get filter checkboxes
    const filterMine = document.getElementById('filterMine');
    const filterDepartment = document.getElementById('filterDepartment');

    // Initialize checkbox states
    if (filterMine) {
      filterMine.checked = calendarFilters.mine;
      filterMine.addEventListener('change', (e) => {
        calendarFilters.mine = e.target.checked;
        applyFilters();
      });
    }

    if (filterDepartment) {
      filterDepartment.checked = calendarFilters.department;
      filterDepartment.addEventListener('change', (e) => {
        calendarFilters.department = e.target.checked;
        applyFilters();
      });
    }

    // Initialize category filters
    // Find the Categories section and get its child divs
    const categoriesSection = Array.from(document.querySelectorAll('.sidebar-section')).find(section => {
      const h3 = section.querySelector('h3');
      return h3 && h3.textContent.trim() === 'Categories';
    });
    const categoryItems = categoriesSection ? Array.from(categoriesSection.querySelectorAll('div')).filter(div => {
      // Only get divs that contain category-dot spans (not the h3)
      return div.querySelector('.category-dot');
    }) : [];

    categoryItems.forEach((item, index) => {
      // Make categories clickable
      item.style.cursor = 'pointer';
      item.style.userSelect = 'none';

      // Add active state styling
      if (!item.classList.contains('category-filter')) {
        item.classList.add('category-filter');
      }

      item.addEventListener('click', () => {
        // Remove active state from all categories
        categoryItems.forEach(cat => {
          cat.style.fontWeight = 'normal';
          cat.style.opacity = '1';
        });

        // Set active state for clicked category
        item.style.fontWeight = '600';
        item.style.opacity = '0.8';

        // Determine category filter value
        const text = item.textContent.trim().toLowerCase();
        // Toggle filter: if clicking the same category, clear it; otherwise set it
        if (categoryFilter === 'today' && text === 'today') {
          categoryFilter = null; // Clear filter
          item.style.fontWeight = 'normal';
          item.style.opacity = '1';
        } else if (categoryFilter === 'urgent' && text === 'urgent') {
          categoryFilter = null; // Clear filter
          item.style.fontWeight = 'normal';
          item.style.opacity = '1';
        } else {
          // Set new filter
          if (text === 'today') {
            categoryFilter = 'today';
          } else if (text === 'urgent') {
            categoryFilter = 'urgent';
          } else {
            categoryFilter = null; // Show all
          }
        }

        applyFilters();
      });
    });
  }

  // Add event delegation for calendar attachment clicks
  document.addEventListener('click', (e) => {
    const attachmentElement = e.target.closest('.calendar-attachment-view');
    if (attachmentElement) {
      e.preventDefault();
      const attachmentsId = attachmentElement.getAttribute('data-attachments-id');
      const attachmentIndex = parseInt(attachmentElement.getAttribute('data-attachment-index'), 10);

      if (attachmentsId && window.calendarAttachments && window.calendarAttachments[attachmentsId]) {
        const attachments = window.calendarAttachments[attachmentsId];
        if (attachments && attachments.length > 0 && attachmentIndex >= 0 && attachmentIndex < attachments.length) {
          openAttachmentModal(attachments, attachmentIndex);
        }
      }
    }
  });

})();
