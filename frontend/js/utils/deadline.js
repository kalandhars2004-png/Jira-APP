// Deadline utils — ES6+ arrow functions, MINUTE-LEVEL precision, fully dynamic
// Due value is one real datetime (e.g. "2026-09-11T14:31:00" local wall-clock).
import { toDate, formatTime, formatDayName, formatDate, formatDateShort } from './formatters.js';

const COMPLETED_STATUSES = new Set(['DONE', 'APPROVED', 'PUBLISHED', 'COMPLETED']);
export const isCompletedStatus = (status) => COMPLETED_STATUSES.has((status || '').toUpperCase());

// Compare the FULL datetime (year..second). No day-only rounding.
export const calculateDeadlineStatus = (dueDateTimeStr, status, now = new Date()) => {
  if (isCompletedStatus(status)) return 'COMPLETED';
  const due = toDate(dueDateTimeStr);
  if (!due) return 'UPCOMING';
  const n = new Date(now);
  if (n < due) {
    return due.toDateString() === n.toDateString() ? 'DUE_TODAY' : 'UPCOMING';
  }
  return 'OVERDUE';
};

export const isOverdue = (issue, now) => calculateDeadlineStatus(issue?.dueDate, issue?.status, now) === 'OVERDUE';
export const isDueToday = (issue, now) => calculateDeadlineStatus(issue?.dueDate, issue?.status, now) === 'DUE_TODAY';

// Truth for render decisions during live updates:
// honor the server's COMPLETED classification (covers custom final workflow stages)
// but recompute everything else against the current clock so OVERDUE flips live.
export const liveStatus = (issue, now = new Date()) => {
  if ((issue?.deadlineStatus || '') === 'COMPLETED') return 'COMPLETED';
  return calculateDeadlineStatus(issue?.dueDate, issue?.status, now);
};

export const isCompletedOnTime = (dueDateTimeStr, completedDateStr) => {
  const due = toDate(dueDateTimeStr); const comp = toDate(completedDateStr);
  if (!due || !comp) return true;
  due.setHours(0,0,0,0); comp.setHours(0,0,0,0);
  return comp <= due;
};

export const deadlineLabel = (issue, now) => {
  const s = issue?.deadlineStatus ?? calculateDeadlineStatus(issue?.dueDate, issue?.status, now);
  if (s === 'COMPLETED') return isCompletedOnTime(issue?.dueDate, issue?.completedDate) ? 'Completed on time' : 'Completed late';
  if (s === 'OVERDUE') return 'OVERDUE';
  if (s === 'DUE_TODAY') return 'DUE TODAY';
  return 'UPCOMING';
};

export const deadlineClass = (status) => `deadline-${status}`;

// Human readable "Due in 1 minute / Due in 2 hours / Due tomorrow at 4:30 PM / Due Sep 15 at 4:00 PM"
export const relativeDue = (dueDateTimeStr, now = new Date()) => {
  const due = toDate(dueDateTimeStr);
  if (!due) return '';
  const n = new Date(now);
  const diffMs = due - n;
  if (diffMs <= 0) return 'Overdue';

  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'Due in under a minute';
  if (minutes < 60) return `Due in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && due.toDateString() === n.toDateString()) {
    return `Due in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  const startToday = new Date(n); startToday.setHours(0,0,0,0);
  const dueStart = new Date(due); dueStart.setHours(0,0,0,0);
  const dayDiff = Math.round((dueStart - startToday) / 86400000);
  const time = formatTime(due);
  if (dayDiff === 1) return `Due tomorrow at ${time}`;
  if (dayDiff >= 2 && dayDiff <= 7) return `Due ${formatDayName(due)} at ${time}`;
  return `Due ${formatDate(due)} at ${time}`;
};

// Given an issue, produce the display text used on cards
export const dueDisplayText = (issue, now = new Date()) => {
  const ds = issue?.deadlineStatus ?? calculateDeadlineStatus(issue?.dueDate, issue?.status, now);
  if (!issue?.dueDate) return 'No due date';
  if (ds === 'COMPLETED') return `Due ${formatDateTime(issue.dueDate)}`;
  if (ds === 'OVERDUE') return `Due ${formatDateTime(issue.dueDate)}`;
  return relativeDue(issue.dueDate, now);
};

// For a page that caches the last rendered deadline state: returns Map<issueId, status>
export const deadlineSnapshot = (issues, now = new Date()) => {
  const map = new Map();
  issues.forEach(i => map.set(String(i.id), calculateDeadlineStatus(i.dueDate, i.status, now)));
  return map;
};

const mapEquals = (a, b) => {
  if (!a || !b || a.size !== b.size) return false;
  for (const [k, v] of a) { if (b.get(k) !== v) return false; }
  return true;
};

// Efficient live-checker: only calls onChanged when any issue crossed a deadline boundary.
export const watchDeadlines = (issues, onChanged, now = new Date()) => {
  let last = deadlineSnapshot(issues, now);
  return () => {
    const next = deadlineSnapshot(issues || [], new Date());
    if (!mapEquals(last, next)) { last = next; onChanged(); }
  };
};

// Local datetime -> "YYYY-MM-DDTHH:mm:ss" for API. No timezone conversion.
export const toLocalISO = (d) => {
  if (!d || isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export { formatTime, formatDayName, formatDate, formatDateShort, toDate };