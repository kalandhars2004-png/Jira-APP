import { auth } from '../core/auth.js';
import { api } from '../core/api.js';
import { initSidebar } from '../components/sidebar.js';
import { initTopnav } from '../components/navbar.js';
import { notify } from '../components/toast.js';
import { formatDate, timeAgo, initials } from '../utils/formatters.js';

// ES6+ arrow functions, const/let, destructuring, template literals, optional chaining
const user = auth.requireAuth();
// Role-based: only ADMIN can access Dashboard
if (user.role !== 'ADMIN' && user.role !== 'PROJECT_MANAGER') {
  // For MEMBER, redirect to My Tasks (or Projects if no tasks)
  location.href = '/pages/mytasks.html';
  throw new Error('Redirecting MEMBER to My Tasks');
}
initSidebar('dashboard');
initTopnav({ title: `Welcome back, ${user.name.split(' ')[0]} 👋`, subtitle: '' });

const $ = (s) => document.querySelector(s);
const topnavAction = $('#topnavAction');
topnavAction?.addEventListener('click', () => location.href = '/pages/board.html');

// hero — production greeting
const todayStr = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
const heroDate = document.getElementById('heroDate');
if (heroDate) heroDate.textContent = todayStr;
const heroGreeting = document.getElementById('heroGreeting');
if (heroGreeting) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  heroGreeting.textContent = `${greet}, ${user.name.split(' ')[0]} 👋`;
}
const heroAvatar = document.getElementById('heroAvatar');
if (heroAvatar) heroAvatar.textContent = initials(user.name);

const loadDashboard = async () => {
  try {
    const data = await api.get('/api/dashboard', { params: { userId: user.id } });
    // hero stats
    const heroProjects = document.getElementById('heroStatProjects');
    if (heroProjects) heroProjects.textContent = `${data.totalProjects} Projects`;
    const heroIssues = document.getElementById('heroStatIssues');
    if (heroIssues) heroIssues.textContent = `${data.totalIssues} Issues`;
    const heroOverdue = document.getElementById('heroStatOverdue');
    if (heroOverdue) heroOverdue.textContent = `${data.overdue} Overdue`;
    const heroDue = document.getElementById('heroStatDueToday');
    if (heroDue) heroDue.textContent = `${data.dueToday} Due Today`;
    const heroAlert = document.getElementById('heroOverdueAlert');
    if (heroAlert) {
      if (data.overdue > 0) {
        heroAlert.textContent = `⚠ ${data.overdue} overdue — action needed`;
        heroAlert.style.background = '#fef2f2';
        heroAlert.style.color = '#dc2626';
        heroAlert.style.border = '1px solid #fecaca';
      } else if (data.dueToday > 0) {
        heroAlert.textContent = `◷ ${data.dueToday} due today`;
        heroAlert.style.background = '#fffbeb';
        heroAlert.style.color = '#b45309';
        heroAlert.style.border = '1px solid #fde68a';
      } else {
        heroAlert.textContent = '● All clear — no overdue';
        heroAlert.style.background = 'white';
        heroAlert.style.color = '#4f46e5';
      }
    }
    renderStats(data);
    renderDeadlineHealth(data);
    renderProjectProgress(data.projectProgress || []);
    renderStatusDist(data.statusDistribution || []);
    renderPriorityDist(data.priorityDistribution || []);
    renderMyIssues(data.myIssues || []);
    renderActivity(data.recentActivity || []);
  } catch (e) {
    notify.error(e.message);
  }
};

const renderStats = ({ totalProjects, totalIssues, openIssues, inProgress, completed, criticalIssues, overdue, dueToday }) => {
  const grid = $('#statsGrid');
  grid.textContent = '';
  const cards = [
    { label: 'Total Projects', value: totalProjects, sub: 'Across workspace', bg: '#eef2ff', icon: '▣' },
    { label: 'Open Issues', value: openIssues, sub: `${totalIssues} total`, bg: '#eff6ff', icon: '○' },
    { label: 'In Progress', value: inProgress, sub: 'Active now', bg: '#fefce8', icon: '◷' },
    { label: 'Completed', value: completed, sub: 'Done & dusted', bg: '#ecfdf5', icon: '✓' },
    { label: 'Critical', value: criticalIssues, sub: 'Needs attention', bg: '#fef2f2', icon: '⚠' },
    { label: 'Overdue', value: overdue, sub: 'Past due', bg: '#fef2f2', icon: '⚠' },
    { label: 'Due Today', value: dueToday, sub: 'Due today', bg: '#fffbeb', icon: '◷' },
    { label: 'Total Issues', value: totalIssues, sub: 'All statuses', bg: '#f1f5f9', icon: '☷' },
  ];
  const tpl = document.getElementById('statCardTemplate');
  cards.forEach(({ label, value, sub, bg, icon }) => {
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.stat-label').textContent = label;
    clone.querySelector('.stat-value').textContent = value ?? 0;
    clone.querySelector('.stat-sub').textContent = sub;
    const iconEl = clone.querySelector('.stat-icon');
    iconEl.textContent = icon;
    iconEl.style.background = bg;
    grid.appendChild(clone);
  });
};

const renderDeadlineHealth = ({ upcoming = 0, dueToday = 0, overdue = 0, completed = 0 }) => {
  const el = $('#deadlineHealth');
  el.textContent = '';
  const total = upcoming + dueToday + overdue + completed || 1;
  const items = [
    { label: 'On Track', value: upcoming, color: '#64748b', bg: '#f1f5f9' },
    { label: 'Due Today', value: dueToday, color: '#d97706', bg: '#fffbeb' },
    { label: 'Overdue', value: overdue, color: '#dc2626', bg: '#fef2f2' },
    { label: 'Completed', value: completed, color: '#059669', bg: '#ecfdf5' },
  ];
  const tpl = document.getElementById('deadlineHealthTemplate');
  items.forEach(({ label, value, color, bg }) => {
    const clone = tpl.content.cloneNode(true);
    const card = clone.querySelector('.deadline-health-card');
    card.style.background = bg;
    card.style.border = '1px solid #e2e8f0';
    card.style.borderRadius = '10px';
    card.style.padding = '12px';
    card.style.textAlign = 'center';
    clone.querySelector('.deadline-health-label').textContent = label;
    clone.querySelector('.deadline-health-label').style.cssText = `font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${color}`;
    const valEl = clone.querySelector('.deadline-health-value');
    valEl.textContent = value;
    valEl.style.cssText = 'font-size:22px;font-weight:800;margin-top:4px';
    const fill = clone.querySelector('.chart-fill');
    fill.style.width = `${Math.round((value * 100) / total)}%`;
    fill.style.background = color;
    fill.style.height = '4px';
    fill.style.borderRadius = '99px';
    const bar = clone.querySelector('.chart-bar');
    bar.style.marginTop = '6px';
    bar.style.height = '4px';
    bar.style.background = 'white';
    bar.style.borderRadius = '99px';
    bar.style.overflow = 'hidden';
    el.appendChild(clone);
  });
};

const renderProjectProgress = (list) => {
  const el = $('#projectProgress');
  el.textContent = '';
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const txt = document.createElement('div');
    txt.textContent = 'No projects yet';
    const btn = document.createElement('a');
    btn.href = '/pages/projects.html';
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = 'Create Project';
    btn.style.marginTop = '8px';
    empty.append(txt, btn);
    el.appendChild(empty);
    return;
  }
  const tpl = document.getElementById('projectProgressTemplate');
  list.forEach((p) => {
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.project-key').textContent = p.projectKey;
    clone.querySelector('.project-name').textContent = p.projectName;
    clone.querySelector('.progress-pct').textContent = `${p.progress}%`;
    clone.querySelector('.progress-count').textContent = `${p.completed} / ${p.total} done`;
    const fill = clone.querySelector('.chart-fill');
    fill.style.width = `${p.progress}%`;
    fill.style.background = '#4f46e5';
    const link = clone.querySelector('.progress-link');
    link.style.color = '#4f46e5';
    link.style.cursor = 'pointer';
    link.addEventListener('click', () => {
      localStorage.setItem('activeProjectId', String(p.projectId));
      location.href = `/pages/board.html?projectId=${p.projectId}`;
    });
    el.appendChild(clone);
  });
};

const renderStatusDist = (list) => {
  const el = $('#statusDist');
  el.textContent = '';
  const colors = { TODO: '#94a3b8', IN_PROGRESS: '#f59e0b', IN_REVIEW: '#8b5cf6', DONE: '#10b981' };
  const tpl = document.getElementById('statusDistTemplate');
  list.forEach((s) => {
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.status-name').textContent = s.status;
    clone.querySelector('.status-name').style.minWidth = '90px';
    clone.querySelector('.status-name').style.fontSize = '12px';
    clone.querySelector('.status-name').style.fontWeight = '700';
    const fill = clone.querySelector('.chart-fill');
    fill.style.width = `${s.percentage}%`;
    fill.style.background = colors[s.status] || '#4f46e5';
    clone.querySelector('.status-count').textContent = `${s.count} • ${s.percentage}%`;
    clone.querySelector('.status-count').style.fontSize = '12px';
    clone.querySelector('.status-count').style.fontWeight = '700';
    clone.querySelector('.status-count').style.color = '#64748b';
    clone.querySelector('.status-count').style.minWidth = '40px';
    clone.querySelector('.status-count').style.textAlign = 'right';
    const row = clone.querySelector('.status-dist-row');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    const bar = clone.querySelector('.chart-bar');
    bar.style.flex = '1';
    el.appendChild(clone);
  });
};

const renderPriorityDist = (list) => {
  const el = $('#priorityDist');
  el.textContent = '';
  const colors = { LOW: '#64748b', MEDIUM: '#eab308', HIGH: '#f97316', CRITICAL: '#dc2626' };
  const tpl = document.getElementById('priorityDistTemplate');
  list.forEach((p) => {
    const clone = tpl.content.cloneNode(true);
    const badge = clone.querySelector('.priority-badge');
    badge.textContent = p.priority;
    badge.className = `priority-badge pri-${p.priority}`;
    badge.style.minWidth = '90px';
    badge.style.justifyContent = 'center';
    const fill = clone.querySelector('.chart-fill');
    fill.style.width = `${Math.min(100, (p.count / 5) * 20)}%`;
    fill.style.background = colors[p.priority] || '#64748b';
    clone.querySelector('.priority-count').textContent = p.count;
    const row = clone.querySelector('.priority-dist-row');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    const bar = clone.querySelector('.chart-bar');
    bar.style.flex = '1';
    el.appendChild(clone);
  });
};

const renderMyIssues = (issues) => {
  const el = $('#myIssues');
  el.textContent = '';
  if (!issues.length) {
    const empty = document.createElement('div');
    empty.style.textAlign = 'center';
    empty.style.padding = '18px';
    empty.style.color = '#64748b';
    empty.style.fontSize = '13px';
    empty.textContent = 'No issues assigned to you yet. Create one from the Board.';
    el.appendChild(empty);
    return;
  }
  const tpl = document.getElementById('myIssueTemplate');
  issues.slice(0, 5).forEach((i) => {
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.issue-key').textContent = i.issueKey;
    clone.querySelector('.my-issue-title').textContent = i.title;
    clone.querySelector('.my-issue-sub').textContent = `${i.status} • Due ${i.dueDate ? formatDate(i.dueDate) : '-'}`;
    const badge = clone.querySelector('.priority-badge');
    badge.textContent = i.priority;
    badge.className = `priority-badge pri-${i.priority}`;
    const row = clone.querySelector('.my-issue-row');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    row.style.padding = '10px';
    row.style.border = '1px solid #e2e8f0';
    row.style.borderRadius = '10px';
    row.style.marginBottom = '8px';
    row.style.background = 'white';
    el.appendChild(clone);
  });
};

const renderActivity = (activities) => {
  const el = $('#activityFeed');
  el.textContent = '';
  if (!activities.length) {
    const empty = document.createElement('div');
    empty.style.color = '#64748b';
    empty.style.fontSize = '13px';
    empty.style.textAlign = 'center';
    empty.style.padding = '12px';
    empty.textContent = 'No recent activity';
    el.appendChild(empty);
    return;
  }
  const tpl = document.getElementById('activityTemplate');
  activities.forEach((a) => {
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.activity-details').textContent = a.details || a.action;
    clone.querySelector('.activity-time').textContent = `${a.userName || 'System'} • ${timeAgo(a.createdAt)} • ${formatDate(a.createdAt)}`;
    el.appendChild(clone);
  });
};

loadDashboard();
