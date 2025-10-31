/* global FullCalendar */
(function () {
  const calendarEl = document.getElementById('calendar');
  const mini = document.getElementById('miniCalendar');
  const miniMonthEl = document.getElementById('miniCalMonth');
  const miniPrev = document.getElementById('miniPrev');
  const miniNext = document.getElementById('miniNext');
  const viewButtons = document.querySelectorAll('.view-toggle button');
  const addBtn = document.getElementById('addMemoBtn');

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const todayBtn = document.getElementById('todayBtn');

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
  const editingSourceInput = document.getElementById('memoEditingSource');
  const editingIdInput = document.getElementById('memoEditingId');

  function openModal(preset) {
    if (preset) {
      titleInput.value = preset.title || '';
      dateInput.value = preset.date || '';
      startInput.value = preset.start || '';
      endInput.value = preset.end || '';
    }
    if (preset && preset.edit) {
      editingSourceInput.value = preset.source || '';
      editingIdInput.value = preset.id || '';
    } else {
      editingSourceInput.value = '';
      editingIdInput.value = '';
    }
    modal.style.display = 'grid';
  }
  function closeModal() {
    modal.style.display = 'none';
    form.reset();
  }

  function categoryColor(category) {
    switch (category) {
      case 'today': return '#22c55e';
      case 'urgent': return '#ef4444';
      default: return '#3b82f6';
    }
  }

  // No Google Calendar integration

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: false,
    selectable: true,
    editable: true,
    nowIndicator: true,
    dateClick(info) {
      openModal({ date: info.dateStr });
    },
    select(info) {
      const start = info.startStr.substring(11, 16) || '08:00';
      const end = info.endStr.substring(11, 16) || '09:00';
      openModal({ date: info.startStr.substring(0, 10), start, end });
    },
    eventClick(info) {
      const e = info.event;
      openModal({
        title: e.title,
        date: e.startStr.substring(0, 10),
        start: e.startStr.substring(11, 16),
        end: e.endStr ? e.endStr.substring(11, 16) : '',
        edit: true,
        id: e.id,
        source: 'backend'
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
        const res = await fetch(`/api/calendar/events?${qs.toString()}`, { credentials: 'same-origin' });
        if (!res.ok) { throw new Error('Failed to load events'); }
        const data = await res.json();
        const localEvents = data.map(e => ({
          id: e._id,
          title: e.title,
          start: e.start,
          end: e.end,
          backgroundColor: categoryColor(e.category),
          borderColor: categoryColor(e.category)
        }));

        // Try to append Google Calendar events if connected; failures are ignored
        let googleEvents = [];
        try {
          const r2 = await fetch(`/calendar/events?timeMin=${encodeURIComponent(fetchInfo.startStr)}&timeMax=${encodeURIComponent(fetchInfo.endStr)}`, { credentials: 'same-origin' });
          if (r2.ok) {
            const gItems = await r2.json();
            googleEvents = (gItems || []).map(ev => ({
              id: 'gcal_' + ev.id,
              title: ev.summary || '(no title)',
              start: ev.start && (ev.start.dateTime || ev.start.date),
              end: ev.end && (ev.end.dateTime || ev.end.date),
              backgroundColor: '#16a34a',
              borderColor: '#16a34a'
            }));
          }
        } catch {
          // ignore calendar fetch failure
        }

        const formatted = [...localEvents, ...googleEvents];
        success(formatted);
      } catch (err) {
        // swallow to avoid noisy console in production
        failure(err);
      }
    }
  });
  calendar.render();
  renderMiniCalendar();

  // Mini calendar rendering (simple month grid)
  const miniCursor = new Date();
  miniCursor.setDate(1);

  function formatMonthTitle(d) {
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
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
    const iter = new Date(miniCursor);
    while (iter.getMonth() === month) {
      const el = document.createElement('div');
      el.className = 'mini-day';
      el.textContent = String(iter.getDate());
      const today = new Date();
      if (today.toDateString() === iter.toDateString()) { el.classList.add('mini-today'); }
      el.addEventListener('click', () => {
        mini.querySelectorAll('.mini-selected').forEach(n => n.classList.remove('mini-selected'));
        el.classList.add('mini-selected');
        calendar.gotoDate(new Date(iter));
      });
      mini.appendChild(el);
      iter.setDate(iter.getDate() + 1);
    }
  }

  if (miniPrev) { miniPrev.addEventListener('click', () => { miniCursor.setMonth(miniCursor.getMonth() - 1); renderMiniCalendar(); }); }
  if (miniNext) { miniNext.addEventListener('click', () => { miniCursor.setMonth(miniCursor.getMonth() + 1); renderMiniCalendar(); }); }

  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      viewButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      calendar.changeView(btn.getAttribute('data-view'));
    });
  });

  addBtn.addEventListener('click', () => openModal());
  closeModalBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // No Google connect button

  if (prevBtn) { prevBtn.addEventListener('click', () => calendar.prev()); }
  if (nextBtn) { nextBtn.addEventListener('click', () => calendar.next()); }
  if (todayBtn) { todayBtn.addEventListener('click', () => calendar.today()); }

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

    const startISO = `${date}T${start}:00`;
    const endISO = `${date}T${end}:00`;

    (async () => {
      try {
        const editingSource = editingSourceInput.value;
        const editingId = editingIdInput.value;

        if (editingSource === 'backend' && editingId) {
          const res = await fetch(`/api/calendar/events/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ title, start: startISO, end: endISO, category, description })
          });
          if (!res.ok) { throw new Error('Failed to update'); }
        } else {
          const res = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ title, start: startISO, end: endISO, category, description })
          });
          if (!res.ok) {
            const msg = await res.json().catch(() => ({ message: 'Failed to save' }));
            throw new Error(msg.message || 'Failed to save');
          }
          await res.json();

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
        calendar.refetchEvents();
        alert('Saved');
        closeModal();
      } catch (err) {
        alert(err.message || 'Save failed');
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
        closeModal();
      } catch {
        alert('Delete failed');
      }
    });
  }
})();


