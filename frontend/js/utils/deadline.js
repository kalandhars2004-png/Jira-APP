// Deadline utils — ES6+ arrow functions, fully dynamic (no hardcoding)
export const calculateDeadlineStatus = (dueDateStr, status, now = new Date()) => {
  if (status === 'DONE') return 'COMPLETED';
  if (!dueDateStr) return 'UPCOMING';
  const due = new Date(dueDateStr); due.setHours(0,0,0,0);
  const cur = new Date(now); cur.setHours(0,0,0,0);
  if (cur < due) return 'UPCOMING';
  if (cur.getTime() === due.getTime()) return 'DUE_TODAY';
  return 'OVERDUE';
};

export const isCompletedOnTime = (dueDateStr, completedDateStr) => {
  if (!dueDateStr || !completedDateStr) return true;
  const due = new Date(dueDateStr); due.setHours(0,0,0,0);
  const comp = new Date(completedDateStr); comp.setHours(0,0,0,0);
  return comp <= due;
};

export const deadlineLabel = (issue) => {
  const s = issue?.deadlineStatus ?? calculateDeadlineStatus(issue?.dueDate, issue?.status);
  if (s === 'COMPLETED') return isCompletedOnTime(issue?.dueDate, issue?.completedDate) ? 'Completed on time' : 'Completed late';
  if (s === 'OVERDUE') return 'OVERDUE';
  if (s === 'DUE_TODAY') return 'DUE TODAY';
  return 'UPCOMING';
};

export const deadlineClass = (status) => `deadline-${status}`;
export const isOverdue = (issue) => calculateDeadlineStatus(issue?.dueDate, issue?.status) === 'OVERDUE';
export const isDueToday = (issue) => calculateDeadlineStatus(issue?.dueDate, issue?.status) === 'DUE_TODAY';
