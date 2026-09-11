// ES6+ utils — arrow functions, const/let, template literals, optional chaining
export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateShort = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const today = new Date(); today.setHours(0,0,0,0);
  const dd = new Date(d); dd.setHours(0,0,0,0);
  if (dd.getTime() === today.getTime()) return 'Today';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
