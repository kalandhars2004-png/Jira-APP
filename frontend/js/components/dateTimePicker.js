// DateTimePicker — reusable scheduling component (calendar + time picker + relative hint).
// - No browser-native date/time inputs.
// - Date and time form ONE datetime value.
// - Past dates disabled; today only exposes future times (minute precision via full timestamp).
// - Live relative hint ("Due in 1 minute", "Due tomorrow at 4:30 PM") via centralized clock.
// Usage:
//   const picker = createDateTimePicker({ container, value, onChange });
//   picker.getValue(); picker.setValue(dateOrStr); picker.clear(); picker.destroy();
import { onClockTick } from '../utils/clock.js';
import { relativeDue, toDate } from '../utils/deadline.js';
import { formatTime, formatDate } from '../utils/formatters.js';

const DAY_MS = 86400000;

const pad = (n) => String(n).padStart(2, '0');
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const icon = (name) => {
  const i = el('i');
  i.setAttribute('data-lucide', name);
  i.style.width = '16px';
  i.style.height = '16px';
  return i;
};
const refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const MON_OFFSET = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const weekdayFormat = (d) => d.toLocaleDateString('en-US', { weekday: 'short' });

const parseTimeInput = (txt) => {
  const t = (txt || '').trim().toUpperCase();
  const m = t.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/);
  if (!m) return null;
  let h = +m[1]; const mi = +m[2]; const s = +(m[3] || 0);
  const ap = m[4];
  if (mi > 59 || s > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
  } else if (h > 23) return null;
  const ms = ((h * 3600) + (mi * 60) + s) * 1000;
  return { ms, text: formatTime(new Date(2020, 0, 1, h, mi)) };
};

export const createDateTimePicker = ({ container, value = null, onChange = null } = {}) => {
  if (!container) throw new Error('DateTimePicker requires a container');
  container.classList.add('dtp');

  const root = container;
  const state = {
    dateVal: null,      // Date at local midnight of chosen day
    timeMs: null,       // milliseconds-of-day (number) or null
    viewDate: new Date(),
    show: '',           // '' | 'calendar' | 'time'
    highlight: null,    // Date (day cell) for keyboard nav
    timeQuery: '',
    timeCursor: -1,
    hintTimer: null,
  };

  // ---------- DOM ----------
  const fields = el('div', 'dtp-fields');

  const dateTrigger = el('button', 'dtp-trigger dtp-date');
  dateTrigger.type = 'button';
  dateTrigger.appendChild(icon('calendar'));
  const dateText = el('span', 'dtp-date-text', 'Select due date');
  const dateChevron = el('span', 'dtp-chevron', '');
  dateChevron.appendChild(icon('chevron-down'));
  dateTrigger.append(dateText, dateChevron);

  const timeTrigger = el('button', 'dtp-trigger dtp-time');
  timeTrigger.type = 'button';
  timeTrigger.appendChild(icon('clock'));
  const timeText = el('span', 'dtp-time-text', 'Select time');
  const timeChevron = el('span', 'dtp-chevron', '');
  timeChevron.appendChild(icon('chevron-down'));
  timeTrigger.append(timeText, timeChevron);

  fields.append(dateTrigger, timeTrigger);

  const hint = el('div', 'dtp-hint');

  // Calendar popover
  const calPop = el('div', 'dtp-popover dtp-calendar');
  calPop.tabIndex = -1;
  const calHead = el('div', 'dtp-cal-head');
  const prevBtn = el('button', 'dtp-nav', ''); prevBtn.type = 'button'; prevBtn.appendChild(icon('chevron-left'));
  const monthLabel = el('div', 'dtp-month-label', '');
  const nextBtn = el('button', 'dtp-nav', ''); nextBtn.type = 'button'; nextBtn.appendChild(icon('chevron-right'));
  calHead.append(prevBtn, monthLabel, nextBtn);

  const weekRow = el('div', 'dtp-weekdays');
  MON_OFFSET.forEach(d => weekRow.appendChild(el('div', 'dtp-wd', d)));

  const grid = el('div', 'dtp-grid');

  const quick = el('div', 'dtp-quick');
  const quickBtn = (label, fn) => {
    const b = el('button', 'dtp-quick-btn', label);
    b.type = 'button';
    b.addEventListener('click', () => { fn(); });
    return b;
  };
  quick.append(
    quickBtn('Today', () => pickDate(startOfDay(new Date()), true)),
    quickBtn('Tomorrow', () => pickDate(new Date(startOfDay(new Date()).getTime() + DAY_MS))),
    quickBtn('Next Monday', () => {
      const d = new Date();
      const add = (8 - d.getDay()) % 7; // +1..7
      pickDate(startOfDay(new Date(d.getTime() + add * DAY_MS)));
    }),
    quickBtn('+1 Hour', () => commit(new Date(Date.now() + 3600000))),
    quickBtn('+4 Hours', () => commit(new Date(Date.now() + 4 * 3600000)))
  );

  const calFoot = el('div', 'dtp-cal-foot');
  const todayBtn = el('button', 'dtp-foot-btn', 'Today'); todayBtn.type = 'button';
  todayBtn.addEventListener('click', () => pickDate(startOfDay(new Date()), true));
  const clearBtn = el('button', 'dtp-foot-btn dtp-foot-btn-danger', 'Clear'); clearBtn.type = 'button';
  clearBtn.addEventListener('click', (e) => { e.stopPropagation(); clear(); });
  calFoot.append(todayBtn, el('div', 'dtp-foot-spacer'), clearBtn);

  calPop.append(calHead, weekRow, grid, quick, calFoot);

  // Time popover
  const timePop = el('div', 'dtp-popover dtp-timepop');
  timePop.tabIndex = -1;
  const timeHead = el('div', 'dtp-time-head', 'Select time');
  const searchWrap = el('div', 'dtp-time-search');
  const searchBox = el('input', 'dtp-time-input');
  searchBox.type = 'text';
  searchBox.placeholder = 'Search / type time (e.g. 2:31 PM)';
  searchBox.addEventListener('keydown', onSearchKeydown);
  searchWrap.appendChild(searchBox);
  const listWrap = el('div', 'dtp-time-list');
  const footNote = el('div', 'dtp-time-note', '');
  timePop.append(timeHead, searchWrap, listWrap, footNote);

  root.append(fields, hint, calPop, timePop);

  // ---------- helpers ----------
  const combine = () => {
    if (!state.dateVal || state.timeMs === null) return null;
    const d = new Date(state.dateVal); d.setTime(d.getTime() + state.timeMs);
    return d;
  };
  const now = () => new Date();

  const setTimeMs = (ms) => {
    state.timeMs = ms;
    syncTriggers();
    syncHint();
    if (onChange) onChange(combine());
    refreshIcons();
  };

  const pickDate = (day, openTime = false) => {
    state.dateVal = startOfDay(day);
    const full = combine(); // may already have a time
    if (full && full <= now()) {
      // chosen date is today (or earlier) with past time -> must re-pick time
      state.timeMs = null;
    }
    syncTriggers();
    syncHint();
    close('calendar');
    if (state.timeMs === null || openTime) open('time');
    else { if (onChange) onChange(combine()); }
    refreshIcons();
  };

  const commit = (d) => {
    const dv = startOfDay(d);
    state.dateVal = dv;
    state.timeMs = d - dv;
    close('calendar'); close('time');
    syncTriggers(); syncHint();
    if (onChange) onChange(combine());
    refreshIcons();
  };

  const clear = () => {
    state.dateVal = null;
    state.timeMs = null;
    syncTriggers(); syncHint();
    if (onChange) onChange(null);
    refreshIcons();
  };

  const syncTriggers = () => {
    const full = combine();
    if (state.dateVal) {
      dateText.textContent = formatDate(state.dateVal);
      dateTrigger.classList.add('has-value');
    } else {
      dateText.textContent = 'Select due date';
      dateTrigger.classList.remove('has-value');
    }
    if (state.timeMs !== null) {
      timeText.textContent = formatTime(new Date(state.dateVal ? state.dateVal.getTime() + state.timeMs : state.timeMs));
      timeTrigger.classList.add('has-value');
    } else {
      timeText.textContent = 'Select time';
      timeTrigger.classList.remove('has-value');
    }
    syncHint();
  };

  const syncHint = () => {
    const full = combine();
    hint.textContent = '';
    hint.className = 'dtp-hint';
    if (!full) { return; }
    if (full <= now()) {
      hint.textContent = `⚠ Overdue — ${formatTime(full)}`;
      hint.classList.add('dtp-hint-overdue');
    } else {
      hint.textContent = relativeDue(full, now());
      hint.classList.add('dtp-hint-future');
    }
  };

  // live relative hint while this picker is mounted
  const unsubscribeClock = onClockTick(() => { syncHint(); });

  // ---------- calendar render ----------
  const renderCalendar = () => {
    const viewY = state.viewDate.getFullYear();
    const viewM = state.viewDate.getMonth();
    monthLabel.textContent = `${MONTHS[viewM]} ${viewY}`;
    const first = new Date(viewY, viewM, 1);
    const gridStart = new Date(first); gridStart.setDate(1 - ((first.getDay() + 6) % 7)); // Monday-first
    const today = startOfDay(new Date());
    grid.textContent = '';
    state.highlight = null;

    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      const inMonth = d.getMonth() === viewM;
      const isToday = d.getTime() === today.getTime();
      const disabled = d < today;
      const selected = state.dateVal && d.getTime() === state.dateVal.getTime();
      const cell = el('button', 'dtp-day', String(d.getDate()));
      cell.type = 'button';
      cell.dataset.iso = toLocalISOKey(d);
      if (!inMonth) cell.classList.add('dtp-day-out');
      if (isToday) cell.classList.add('dtp-day-today');
      if (disabled) cell.classList.add('dtp-day-disabled');
      if (selected) cell.classList.add('dtp-day-selected');
      cell.disabled = disabled;
      cell.addEventListener('click', () => { if (!disabled) pickDate(d); });

      if (!disabled && !state.highlight) state.highlight = d;
      if (selected) state.highlight = d;
      grid.appendChild(cell);
    }
    if (!state.highlight) state.highlight = today;
  };

  const toLocalISOKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // ---------- time render ----------
  const renderTimeList = () => {
    listWrap.textContent = '';
    const today0 = startOfDay(now());
    const isToday = state.dateVal && state.dateVal.getTime() === today0.getTime();
    const nowT = now();
    let added = 0;
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 15, 30, 45]) {
        const dt = new Date(today0); dt.setHours(h, m, 0, 0);
        const ms = dt.getTime() - today0.getTime();
        const label = formatTime(dt);
        const isPast = isToday && (state.dateVal.getTime() + ms) <= nowT.getTime();
        const matches = !state.timeQuery.trim() || label.toLowerCase().includes(state.timeQuery.trim().toLowerCase());
        if (!matches) continue;
        const cell = el('button', 'dtp-time-slot', label);
        cell.type = 'button';
        cell.dataset.ms = ms;
        if (isPast) cell.classList.add('dtp-time-disabled');
        if (state.timeMs !== null && state.timeMs === ms) cell.classList.add('dtp-time-selected');
        cell.addEventListener('click', () => {
          if (isPast) return;
          setTimeMs(ms);
          close('time');
        });
        listWrap.appendChild(cell);
        if (state.timeCursor === -1 && !isPast && state.timeMs !== null && state.timeMs <= ms) state.timeCursor = added;
        added++;
      }
    }
    if (!added) {
      const empty = el('div', 'dtp-time-empty', 'No matching times');
      listWrap.appendChild(empty);
    }
    footNote.textContent = isToday ? 'Only future times are available today' : '';
    if (state.timeCursor === -1) state.timeCursor = 0;
    listWrap.querySelectorAll('.dtp-time-slot')[state.timeCursor]?.classList.add('dtp-time-focus');
  };

  // ---------- open/close/position ----------
  const close = (which) => {
    if (!which) { state.show = ''; calPop.classList.remove('open'); timePop.classList.remove('open'); return; }
    if (which === 'calendar') calPop.classList.remove('open');
    if (which === 'time') timePop.classList.remove('open');
    if (state.show === which) state.show = '';
  };

  const position = (pop, anchor) => {
    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth || 320;
    let left = r.left;
    if (left + pw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - pw - 8);
    let top = r.bottom + 6;
    const ph = pop.offsetHeight || 400;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  };

  const open = (which) => {
    const prev = state.show;
    calPop.classList.remove('open');
    timePop.classList.remove('open');
    state.show = which;
    if (which === 'calendar') {
      renderCalendar();
      calPop.classList.add('open');
      position(calPop, dateTrigger);
      calPop.focus({ preventScroll: true });
    } else if (which === 'time') {
      if (!state.dateVal) { if (onChange) onChange(null); return; } // need a date first
      state.timeCursor = -1;
      renderTimeList();
      timePop.classList.add('open');
      position(timePop, timeTrigger);
      timePop.focus({ preventScroll: true });
    }
    window.addEventListener('scroll', onWindowMove, true);
    window.addEventListener('resize', onWindowMove);
  };
  const onWindowMove = () => { if (state.show) close(); };

  const isInside = (target) => root.contains(target);
  document.addEventListener('click', (e) => {
    if (!isInside(e.target)) close();
  });

  dateTrigger.addEventListener('click', (e) => { e.stopPropagation(); if (state.show === 'calendar') close('calendar'); else open('calendar'); });
  timeTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.dateVal) {
      open('calendar'); // need a date before time
      return;
    }
    if (state.show === 'time') close('time'); else open('time');
  });

  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() - 1, 1); renderCalendar(); });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1); renderCalendar(); });

  // keyboard navigation (calendar)
  calPop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close('calendar'); return; }
    if (!state.highlight) return;
    const move = (step) => { state.highlight = new Date(state.highlight.getFullYear(), state.highlight.getMonth(), state.highlight.getDate() + step); };
    let handled = true;
    if (e.key === 'ArrowLeft') move(-1);
    else if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowUp') move(-7);
    else if (e.key === 'ArrowDown') move(7);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (state.highlight >= startOfDay(new Date())) pickDate(state.highlight);
      handled = true;
    } else handled = false;
    if (handled) {
      e.preventDefault();
      renderCalendar();
      // re-highlight the moved cell
      const iso = toLocalISOKey(state.highlight);
      const cell = grid.querySelector(`[data-iso="${iso}"]`);
      if (cell && !cell.disabled) { cell.classList.add('dtp-day-focus'); }
    }
  });

  // keyboard navigation (time)
  const onSearchKeydown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      state.timeQuery = searchBox.value;
      state.timeCursor = -1;
      renderTimeList();
      const slots = listWrap.querySelectorAll('.dtp-time-slot:not(.dtp-time-disabled)');
      if (!slots.length) return;
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      let idx = state.timeCursor;
      idx = (idx + dir + slots.length) % slots.length;
      state.timeCursor = idx;
      slots.forEach((s, i) => s.classList.toggle('dtp-time-focus', i === idx));
      slots[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      applyManualTime(searchBox.value);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      close('time');
    }
  };

  searchBox.addEventListener('input', () => {
    state.timeQuery = searchBox.value;
    state.timeCursor = -1;
    renderTimeList();
  });

  const applyManualTime = (raw) => {
    const parsed = parseTimeInput(raw);
    if (!parsed) {
      footNote.textContent = 'Enter a valid time, e.g. "2:31 PM" or "14:31"';
      footNote.style.color = '#ef4444';
      return;
    }
    if (raw.trim()) footNote.style.color = '';
    const full = state.dateVal.getTime() + parsed.ms;
    if (full <= now().getTime()) {
      footNote.textContent = 'Time must be in the future';
      footNote.style.color = '#ef4444';
      return;
    }
    footNote.textContent = '';
    footNote.style.color = '';
    searchBox.value = '';
    state.timeQuery = '';
    setTimeMs(parsed.ms);
    close('time');
  };

  listWrap.addEventListener('click', (e) => { if (window.lucide) window.lucide.createIcons(); });

  // ---------- public api ----------
  const getValue = () => combine();

  const setValue = (v) => {
    const d = toDate(v);
    if (!d) { clear(); return; }
    const dv = startOfDay(d);
    state.dateVal = dv;
    state.timeMs = d - dv;
    state.viewDate = new Date(dv.getFullYear(), dv.getMonth(), 1);
    syncTriggers(); syncHint();
    if (onChange) onChange(combine());
    refreshIcons();
  };

  const destroy = () => {
    unsubscribeClock();
    document.removeEventListener('scroll', onWindowMove, true);
    document.removeEventListener('resize', onWindowMove);
    root.textContent = '';
  };

  if (value) setValue(value);
  else syncTriggers();
  refreshIcons();

  return { getValue, setValue, clear, destroy, root };
};