import { auth } from '../core/auth.js';
import { api } from '../core/api.js';
import { initSidebar } from '../components/sidebar.js';
import { initTopnav } from '../components/navbar.js';
import { notify } from '../components/toast.js';
import { timeAgo } from '../utils/formatters.js';

const user = auth.requireAuth();
initSidebar('reports');
initTopnav({ title: 'Reports', subtitle: '' });

const $ = (s) => document.querySelector(s);

const load = async () => {
  try {
    const data = await api.get('/api/dashboard', { params: { userId: user.id } });

    // status report via template
    const statusEl = $('#statusReport');
    statusEl.textContent = '';
    const total = data.statusDistribution.reduce((a, c) => a + c.count, 0) || 1;
    const tpl = document.getElementById('statusRowTemplate');
    data.statusDistribution.forEach((s) => {
      const clone = tpl.content.cloneNode(true);
      clone.querySelector('.status-name').textContent = s.status;
      clone.querySelector('.status-count').textContent = `${s.count} • ${s.percentage}%`;
      clone.querySelector('.status-count').style.fontSize = '12px';
      clone.querySelector('.status-count').style.fontWeight = '700';
      clone.querySelector('.status-count').style.color = '#64748b';
      const fill = clone.querySelector('.chart-fill');
      fill.style.width = `${s.percentage}%`;
      fill.style.background = ({ TODO: '#94a3b8', IN_PROGRESS: '#f59e0b', IN_REVIEW: '#8b5cf6', DONE: '#10b981' }[s.status] || '#4f46e5');
      fill.style.height = '10px';
      const row = clone.querySelector('.status-report-row');
      row.style.marginBottom = '12px';
      const head = clone.querySelector('.status-report-head');
      head.style.display = 'flex';
      head.style.justifyContent = 'space-between';
      head.style.fontSize = '13px';
      head.style.fontWeight = '600';
      const bar = clone.querySelector('.chart-bar');
      bar.style.marginTop = '6px';
      bar.style.height = '10px';
      statusEl.appendChild(clone);
    });
    {
      const summary = document.createElement('div');
      summary.style.cssText = 'margin-top:12px;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px';
      const b = document.createElement('b');
      b.textContent = `${data.completed}/${data.totalIssues}`;
      summary.append('Completion: ', b, ` • ${data.totalIssues ? Math.round((data.completed * 100) / data.totalIssues) : 0}% done`);
      statusEl.appendChild(summary);
    }

    // priority
    const priEl = $('#priorityReport');
    priEl.textContent = '';
    const priTpl = document.getElementById('priorityRowTemplate');
    data.priorityDistribution.forEach((p) => {
      const clone = priTpl.content.cloneNode(true);
      const badge = clone.querySelector('.priority-badge');
      badge.textContent = p.priority;
      badge.className = `priority-badge pri-${p.priority}`;
      badge.style.minWidth = '90px';
      badge.style.justifyContent = 'center';
      const fill = clone.querySelector('.chart-fill');
      fill.style.width = `${Math.min(100, (p.count / (data.totalIssues || 1)) * 100)}%`;
      fill.style.background = ({ LOW: '#64748b', MEDIUM: '#eab308', HIGH: '#f97316', CRITICAL: '#dc2626' }[p.priority] || '#64748b');
      fill.style.height = '10px';
      clone.querySelector('.priority-count').textContent = p.count;
      clone.querySelector('.priority-count').style.fontWeight = '700';
      clone.querySelector('.priority-count').style.fontSize = '13px';
      const row = clone.querySelector('.priority-report-row');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '10px';
      row.style.marginBottom = '10px';
      const bar = clone.querySelector('.chart-bar');
      bar.style.flex = '1';
      bar.style.height = '10px';
      priEl.appendChild(clone);
    });

    // deadline
    const { overdue, dueToday, upcoming, completed } = data;
    const sum = overdue + dueToday + upcoming + completed || 1;
    const deadlineEl = $('#deadlineReport');
    deadlineEl.textContent = '';
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(4,1fr)';
    grid.style.gap = '12px';
    [
      { label: 'Overdue', v: overdue, color: '#dc2626', bg: '#fef2f2' },
      { label: 'Due Today', v: dueToday, color: '#d97706', bg: '#fffbeb' },
      { label: 'Upcoming', v: upcoming, color: '#64748b', bg: '#f1f5f9' },
      { label: 'Completed', v: completed, color: '#059669', bg: '#ecfdf5' },
    ].forEach(({ label, v, color, bg }) => {
      const card = document.createElement('div');
      card.style.cssText = `background:${bg};border:1px solid #e2e8f0;border-radius:12px;padding:14px;text-align:center`;
      const lbl = document.createElement('div');
      lbl.textContent = label;
      lbl.style.cssText = `font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${color}`;
      const val = document.createElement('div');
      val.textContent = v;
      val.style.cssText = 'font-size:24px;font-weight:800;margin-top:6px';
      const pct = document.createElement('div');
      pct.textContent = `${Math.round((v * 100) / sum)}% of all`;
      pct.style.cssText = 'font-size:11px;color:#64748b';
      card.append(lbl, val, pct);
      grid.appendChild(card);
    });
    deadlineEl.appendChild(grid);

    const barWrap = document.createElement('div');
    barWrap.style.cssText = 'margin-top:16px;display:flex;gap:4px;height:12px;border-radius:99px;overflow:hidden;border:1px solid #e2e8f0';
    [
      { v: overdue, color: '#dc2626' },
      { v: dueToday, color: '#d97706' },
      { v: upcoming, color: '#64748b' },
      { v: completed, color: '#059669' },
    ].forEach(({ v, color }) => {
      const seg = document.createElement('div');
      seg.style.width = `${(v * 100) / sum}%`;
      seg.style.background = color;
      barWrap.appendChild(seg);
    });
    deadlineEl.appendChild(barWrap);

    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;gap:12px;margin-top:8px;font-size:11px;color:#64748b;flex-wrap:wrap';
    [
      { label: 'Overdue', color: '#dc2626' },
      { label: 'Due Today', color: '#d97706' },
      { label: 'Upcoming', color: '#64748b' },
      { label: 'Completed', color: '#059669' },
    ].forEach(({ label, color }) => {
      const item = document.createElement('span');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '4px';
      const dot = document.createElement('span');
      dot.style.cssText = `width:10px;height:10px;background:${color};border-radius:2px;display:inline-block`;
      item.append(dot, document.createTextNode(label));
      legend.appendChild(item);
    });
    deadlineEl.appendChild(legend);

    // activity
    const actEl = $('#activityReport');
    actEl.textContent = '';
    if (!data.recentActivity?.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No activity';
      empty.style.color = '#94a3b8';
      empty.style.fontSize = '13px';
      actEl.appendChild(empty);
    } else {
      const tplAct = document.getElementById('activityTemplate');
      data.recentActivity.forEach((a) => {
        const clone = tplAct.content.cloneNode(true);
        clone.querySelector('.activity-details').textContent = a.details;
        clone.querySelector('.activity-time').textContent = `${a.userName} • ${timeAgo(a.createdAt)}`;
        actEl.appendChild(clone);
      });
    }
  } catch (e) { notify.error(e.message); }
};

load();
