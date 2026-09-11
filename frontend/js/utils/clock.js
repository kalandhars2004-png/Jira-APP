// Centralized clock — ONE interval drives every live overdue update.
// - ticks every 30 seconds
// - fires immediately on subscribe
// - fires immediately when the tab becomes visible again
// Pages/subscriptions never create their own timers.

const subscribers = new Set();
let timer = null;
const INTERVAL_MS = 30000;

const emit = () => {
  const t = new Date();
  subscribers.forEach((fn) => {
    try { fn(t); } catch (err) { console.warn('clock subscriber error', err); }
  });
};

const ensureRunning = () => {
  if (timer) return;
  timer = setInterval(emit, INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisibility);
};

const onVisibility = () => {
  if (!document.hidden) emit();
};

const stopIfEmpty = () => {
  if (subscribers.size === 0 && timer) {
    clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisibility);
  }
};

// Subscribe to tick events. Returns an unsubscribe function.
export const onClockTick = (fn) => {
  subscribers.add(fn);
  ensureRunning();
  emit(); // immediate evaluation on subscribe (covers page-open + tab-active)
  return () => {
    subscribers.delete(fn);
    stopIfEmpty();
  };
};

// For components that only want the time when rendered (no subscription ties)
export const getNow = () => new Date();