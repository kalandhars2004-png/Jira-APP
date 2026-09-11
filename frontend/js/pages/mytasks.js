import { auth } from '../core/auth.js';
import { api } from '../core/api.js';
import { initSidebar } from '../components/sidebar.js';
import { initTopnav } from '../components/navbar.js';
import { createIssueCard } from '../components/issueCard.js';
import { notify } from '../components/toast.js';
import { liveStatus, deadlineSnapshot, dueDisplayText } from '../utils/deadline.js';
import { formatDate, formatDateShort, formatDateTime, formatTime } from '../utils/formatters.js';
import { onClockTick } from '../utils/clock.js';

const user = auth.requireAuth();
initSidebar('mytasks');
initTopnav({ title: '', subtitle: '' }); // hide duplicate topnav title, use page header

const $ = (s) => document.querySelector(s);
document.getElementById('topnavAction')?.addEventListener('click', () => location.href = '/pages/board.html');
const headerSearch = $('#headerSearch');
const searchInput = $('#searchInput');
const syncSearch = (val) => { if (headerSearch) headerSearch.value = val; if (searchInput) searchInput.value = val; };
headerSearch?.addEventListener('input', () => { syncSearch(headerSearch.value); render(); });
searchInput?.addEventListener('input', () => { syncSearch(searchInput.value); render(); });

let all = [];
let projects = [];
let viewMode = localStorage.getItem('mytasksView') || 'board';

const priorityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

const init = async () => {
  try {
    // Project filter: only projects user has access to (member or created)
    const allProjects = await api.get('/api/projects');
    // Filter to those where user is member or creator — for demo, show all where user is member
    // We fetch members for each project and filter
    const accessible = [];
    for (const p of allProjects) {
      try {
        const members = await api.get(`/api/projects/${p.id}/members`);
        const isMember = members.some(m => String(m.userId) === String(user.id));
        const isCreator = String(p.createdBy) === String(user.id);
        const isAdmin = user.role === 'ADMIN';
        if (isAdmin || isMember || isCreator) accessible.push(p);
      } catch { accessible.push(p); }
    }
    projects = accessible.length ? accessible : allProjects;
    const sel = $('#projectFilter');
    sel.textContent = '';
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All Projects';
    sel.appendChild(allOpt);
    projects.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewMode);
    });
    await load();
    if (window.lucide) lucide.createIcons();
  } catch (e) { notify.error(e.message); }
};

const load = async () => {
  try {
    const pid = $('#projectFilter').value;
    const params = {};
    if (pid) params.projectId = pid;
    // Explicitly send userId as param + header for backend robustness (ID-based, not name)
    params.userId = user.id;
    let issues = [];
    try {
      issues = await api.get('/api/issues/my', { params });
      // Enforce personal filter client-side as defense — ensures assigneeId === currentUser.id
      // Handles cases where backend returns unfiltered or ID type mismatches
      issues = issues.filter(i => String(i.assigneeId) === String(user.id));
    } catch (e) {
      console.warn('My Tasks primary fetch failed, falling back to client filter', e);
      let allIssues = [];
      if (pid) {
        try { allIssues = await api.get(`/api/projects/${pid}/issues`); } catch { allIssues = await api.get('/api/issues', { params: { projectId: pid } }); }
      } else {
        allIssues = await api.get('/api/issues');
      }
      // Strict ID comparison per spec: assigneeId === currentUser.id
      issues = allIssues.filter(i => String(i.assigneeId) === String(user.id));
    }
    all = issues;
    render();
  } catch (e) { notify.error(e.message); }
};

$('#projectFilter')?.addEventListener('change', load);
$('#priorityFilter')?.addEventListener('change', render);
$('#sortBy')?.addEventListener('change', render);

document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    viewMode = btn.dataset.view;
    localStorage.setItem('mytasksView', viewMode);
    document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b===btn));
    render();
    if (window.lucide) lucide.createIcons();
  });
});

// Summary cards scroll to column on click
document.querySelectorAll('.summary-card[data-col]').forEach(card => {
  card.addEventListener('click', () => {
    const col = card.dataset.col;
    if (col === 'PROGRESS') return;
    const map = { OVERDUE:'col-overdue', DUE_TODAY:'col-today', UPCOMING:'col-upcoming', COMPLETED:'col-completed' };
    const el = document.getElementById(map[col]);
    if (el) {
      el.scrollIntoView({ behavior:'smooth', block:'start' });
      el.style.outline = '2px solid #c7d2fe';
      setTimeout(()=> el.style.outline='', 1200);
    }
  });
});

const getSorted = (list) => {
  const sortBy = $('#sortBy').value;
  const sorted = [...list];
  if (sortBy === 'dueDate') sorted.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
  else if (sortBy === 'priority') sorted.sort((a,b) => (priorityWeight[b.priority]||0) - (priorityWeight[a.priority]||0));
  else if (sortBy === 'created') sorted.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  return sorted;
};

const render = () => {
  const q = (searchInput?.value || headerSearch?.value || '').trim().toLowerCase();
  const pri = $('#priorityFilter').value;
  let filtered = all;
  if (q) filtered = all.filter((i) => i.title.toLowerCase().includes(q) || i.issueKey.toLowerCase().includes(q) || (i.description||'').toLowerCase().includes(q));
  if (pri) filtered = filtered.filter(i => i.priority === pri);
  filtered = getSorted(filtered);

  const groups = { OVERDUE: [], DUE_TODAY: [], UPCOMING: [], COMPLETED: [] };
  const now = new Date();
  filtered.forEach((i) => {
    const ds = liveStatus(i, now);
    if (groups[ds]) groups[ds].push(i); else groups.UPCOMING.push(i);
  });

  const total = filtered.length;
  const overdue = groups.OVERDUE.length;
  const dueToday = groups.DUE_TODAY.length;
  const upcoming = groups.UPCOMING.length;
  const completed = groups.COMPLETED.length;
  const rate = total ? Math.round((completed*100)/total) : 0;
  $('#heroOverdue').textContent = overdue;
  $('#heroDueToday').textContent = dueToday;
  $('#heroUpcoming').textContent = upcoming;
  $('#heroCompleted').textContent = completed;
  $('#heroRate').textContent = `${rate}%`;

  const renderGroup = (boardId, listId, emptyId, list) => {
    const boardEl = $(boardId);
    const listEl = $(listId);
    const emptyEl = $(emptyId);
    const isBoard = true; // 4-column board is primary; list hidden
    boardEl.style.display = 'flex';
    boardEl.style.flexDirection = 'column';
    listEl.style.display = 'none';
    boardEl.textContent = '';
    listEl.textContent = '';
    const hasTasks = list.length > 0;
    if (emptyEl) emptyEl.classList.toggle('hidden', hasTasks);
    if (!hasTasks) return;
    if (isBoard) {
      list.forEach((issue) => {
        const card = createCompactCard(issue);
        boardEl.appendChild(card);
      });
    } else {
      const tpl = document.getElementById('listRowTemplate');
      list.forEach((issue) => {
        const clone = tpl.content.cloneNode(true);
        clone.querySelector('.issue-key').textContent = issue.issueKey;
        clone.querySelector('.list-title').textContent = issue.title;
        clone.querySelector('.list-sub').textContent = `${issue.issueType} • ${issue.projectName || ''} • ${formatDateTime(issue.dueDate)}`;
        const priBadge = clone.querySelector('.priority-badge');
        priBadge.textContent = issue.priority;
        priBadge.className = `priority-badge pri-${issue.priority}`;
        const ds = liveStatus(issue, new Date());
        const dlBadge = clone.querySelector('.deadline-badge');
        dlBadge.textContent = ds;
        dlBadge.className = `deadline-badge deadline-${ds}`;
        clone.querySelector('.due-date').textContent = dueDisplayText(issue, new Date());
        const row = clone.querySelector('.list-row');
        row.addEventListener('click', () => location.href = `/pages/issue.html?id=${issue.id}`);
        row.style.cursor = 'pointer';
        listEl.appendChild(clone);
      });
    }
  };

  renderGroup('#listOverdue', '#listOverdueList', '#emptyOverdue', groups.OVERDUE);
  renderGroup('#listDueToday', '#listDueTodayList', '#emptyDueToday', groups.DUE_TODAY);
  renderGroup('#listUpcoming', '#listUpcomingList', '#emptyUpcoming', groups.UPCOMING);
  renderGroup('#listCompleted', '#listCompletedList', '#emptyCompleted', groups.COMPLETED);

  $('#countOverdue').textContent = overdue;
  $('#countDueToday').textContent = dueToday;
  $('#countUpcoming').textContent = upcoming;
  $('#countCompleted').textContent = completed;

  const hasAny = total > 0;
  $('#empty').classList.toggle('hidden', hasAny);
  const boardEl = document.getElementById('mytasksBoard');
  if (boardEl) boardEl.style.display = hasAny ? 'grid' : 'none';
  captureSnap();
  if (window.lucide) lucide.createIcons();
};

let renderedSnap = null;
const captureSnap = () => { renderedSnap = deadlineSnapshot(all, new Date()); };
const watchLive = () => {
  onClockTick(() => {
    const next = deadlineSnapshot(all, new Date());
    let changed = !renderedSnap || renderedSnap.size !== next.size;
    if (!changed) { for (const [k, v] of next) { if (renderedSnap.get(k) !== v) { changed = true; break; } } }
    if (changed) { renderedSnap = next; render(); }
  });
};

const createCompactCard = (issue) => {
  const tpl = document.getElementById('compactCardTemplate');
  if (tpl) {
    const clone = tpl.content.cloneNode(true);
    const card = clone.querySelector('.task-card-compact');
    clone.querySelector('.issue-key').textContent = issue.issueKey;
    const typeBadge = clone.querySelector('.issue-type-badge');
    typeBadge.textContent = issue.issueType;
    typeBadge.className = `issue-type-badge type-${issue.issueType}`;
    clone.querySelector('.task-card-title').textContent = issue.title;
    const priBadge = clone.querySelector('.priority-badge');
    priBadge.textContent = issue.priority;
    priBadge.className = `priority-badge pri-${issue.priority}`;
    clone.querySelector('.task-status').textContent = issue.status.replace(/_/g,' ');
    const ds = liveStatus(issue, new Date());
    const dueText = clone.querySelector('.due-text');
    let dueLabel = dueDisplayText(issue, new Date());
    let dueClass = 'upcoming';
    let cardAccent = 'upcoming-card';
    if (ds === 'OVERDUE') { dueLabel = `Overdue • ${formatDateTime(issue.dueDate)}`; dueClass = 'overdue'; cardAccent = 'overdue-card'; }
    else if (ds === 'DUE_TODAY') { dueLabel = `Due today at ${formatTime(issue.dueDate)}`; dueClass = 'today'; cardAccent = 'today-card'; }
    else if (ds === 'COMPLETED') { dueLabel = `Completed ${formatDateShort(issue.completedDate || issue.dueDate)}`; dueClass = 'completed'; cardAccent = 'completed-card'; }
    card.classList.add(cardAccent);
    const deadlineEl = clone.querySelector('.deadline');
    deadlineEl.className = `deadline ${dueClass}`;
    dueText.textContent = dueLabel;
    // icon
    const icon = deadlineEl.querySelector('i');
    if (icon) {
      const iconName = ds === 'OVERDUE' ? 'alert-triangle' : ds === 'DUE_TODAY' ? 'clock' : ds === 'COMPLETED' ? 'check-circle-2' : 'calendar';
      icon.setAttribute('data-lucide', iconName);
    }
    clone.querySelector('.project-name').textContent = issue.projectName || '';
    card.addEventListener('click', () => location.href = `/pages/issue.html?id=${issue.id}`);
    card.style.cursor = 'pointer';
    const wrapper = document.createElement('div');
    wrapper.appendChild(clone);
    // need to create icons after append
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 0);
    return wrapper.firstElementChild;
  }
  // fallback to old card
  const card = createIssueCard(issue);
  card.addEventListener('click', () => location.href = `/pages/issue.html?id=${issue.id}`);
  return card;
};

init().then(() => watchLive());
