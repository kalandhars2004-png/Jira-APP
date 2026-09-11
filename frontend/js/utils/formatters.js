// ES6+ utils — arrow functions, const/let, template literals, optional chaining
export const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

export const formatDate = (dateStr) => {
  const d = toDate(dateStr);
  if (!d) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateShort = (dateStr) => {
  const d = toDate(dateStr);
  if (!d) return '-';
  const today = new Date(); today.setHours(0,0,0,0);
  const dd = new Date(d); dd.setHours(0,0,0,0);
  if (dd.getTime() === today.getTime()) return 'Today';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatTime = (v) => {
  const d = toDate(v);
  if (!d) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

export const formatDayName = (v) => {
  const d = toDate(v);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
};

export const formatDateTime = (v) => {
  const d = toDate(v);
  if (!d) return '';
  return `${formatDate(d)} at ${formatTime(d)}`;
};

export const initials = (name) => {
  if (!name) return '?';
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?';
};

export const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatDate(dateStr);
};

export const formatCurrency = (n) => new Intl.NumberFormat('en-US').format(n ?? 0);
export const truncate = (str, len = 60) => str?.length > len ? `${str.slice(0, len)}...` : str ?? '';
