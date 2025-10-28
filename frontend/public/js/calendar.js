/* global FullCalendar */
(function () {
  const calendarEl = document.getElementById('calendar');
  const mini = document.getElementById('miniCalendar');
  const viewButtons = document.querySelectorAll('.view-toggle button');
  const addBtn = document.getElementById('addMemoBtn');

  const modal = document.getElementById('memoModal');
  const closeModalBtn = document.getElementById('closeMemoModal');
  const cancelBtn = document.getElementById('cancelMemo');
  const form = document.getElementById('memoForm');
  const titleInput = document.getElementById('memoTitle');
  const dateInput = document.getElementById('memoDate');
  const startInput = document.getElementById('memoStart');
  const endInput = document.getElementById('memoEnd');
  const categorySelect = document.getElementById('memoCategory');
  const descInput = document.getElementById('memoDesc');

  function openModal(preset) {
    if (preset) {
      titleInput.value = preset.title || '';
      dateInput.value = preset.date || '';
      startInput.value = preset.start || '';
      endInput.value = preset.end || '';
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
        end: e.endStr ? e.endStr.substring(11, 16) : ''
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
        if (!res.ok) throw new Error('Failed to update schedule');
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
        if (!res.ok) throw new Error('Failed to update schedule');
      } catch (err) {
        info.revert();
        alert(err.message || 'Update failed');
      }
    },
    events: async function(fetchInfo, success, failure) {
      try {
        const qs = new URLSearchParams({ start: fetchInfo.startStr, end: fetchInfo.endStr });
        const res = await fetch(`/api/calendar/events?${qs.toString()}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to load events');
        const data = await res.json();
        const formatted = data.map(e => ({
          id: e._id,
          title: e.title,
          start: e.start,
          end: e.end,
          backgroundColor: categoryColor(e.category),
          borderColor: categoryColor(e.category)
        }));
        success(formatted);
      } catch (err) {
        console.error(err);
        failure(err);
      }
    }
  });
  calendar.render();

  // Today highlight handled by FC; jump via mini date input
  mini.addEventListener('change', function () {
    if (mini.value) calendar.gotoDate(mini.value);
  });

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

  form.addEventListener('submit', function (e) {
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
        calendar.refetchEvents();
        alert('Memo schedule saved successfully');
        closeModal();
      } catch (err) {
        alert(err.message || 'Save failed');
      }
    })();
  });
})();


