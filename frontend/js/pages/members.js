import { auth } from '../core/auth.js';
import { api } from '../core/api.js';
import { initSidebar } from '../components/sidebar.js';
import { initTopnav } from '../components/navbar.js';
import { notify } from '../components/toast.js';
import { initials } from '../utils/formatters.js';

const user = auth.requireAuth();
initSidebar('members');
initTopnav({ title: 'Members', subtitle: 'Manage project members and roles. Members dynamically load for assignment.' });

const $ = (s) => document.querySelector(s);
let projects = [];
let allUsers = [];
let activeProjectId = localStorage.getItem('activeProjectId');

const init = async () => {
  try {
    [projects, allUsers] = await Promise.all([api.get('/api/projects'), api.get('/api/auth/users')]);
    const sel = $('#projectSelect');
    sel.textContent = '';
    projects.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.key} — ${p.name}`;
      if (String(p.id) === String(activeProjectId)) opt.selected = true;
      sel.appendChild(opt);
    });
    if (!activeProjectId && projects[0]) activeProjectId = String(projects[0].id);
    if (activeProjectId) { sel.value = activeProjectId; localStorage.setItem('activeProjectId', activeProjectId); }
    await load();
  } catch (e) { notify.error(e.message); }
};

$('#projectSelect')?.addEventListener('change', async () => { activeProjectId = $('#projectSelect').value; localStorage.setItem('activeProjectId', activeProjectId); await load(); });

const load = async () => {
  if (!activeProjectId) return;
  try {
    const members = await api.get(`/api/projects/${activeProjectId}/members`);
    renderMembers(members);
    renderAvailable(members);
  } catch (e) { notify.error(e.message); }
};

const renderMembers = (members) => {
  const grid = $('#memberGrid');
  grid.textContent = '';
  if (!members.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.style.gridColumn = '1/-1';
    empty.textContent = 'No members yet';
    grid.appendChild(empty);
    return;
  }
  const tpl = document.getElementById('memberCardTemplate');
  members.forEach((m) => {
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.member-avatar').textContent = initials(m.name);
    clone.querySelector('.member-name').textContent = m.name;
    clone.querySelector('.member-email').textContent = m.email;
    const roleEl = clone.querySelector('.member-role');
    roleEl.textContent = m.role;
    roleEl.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:#eef2ff;color:#4f46e5;padding:4px 8px;border-radius:99px';
    clone.querySelector('.member-assigned').textContent = `Assigned: ${m.assignedIssues} issues`;
    clone.querySelector('.member-joined').textContent = `Joined ${new Date(m.joinedAt).toLocaleDateString()}`;
    clone.querySelector('.member-joined').style.fontSize = '12px';
    clone.querySelector('.member-joined').style.color = '#64748b';
    clone.querySelector('.member-assigned').style.fontSize = '12px';
    clone.querySelector('.member-assigned').style.color = '#64748b';
    const card = clone.querySelector('.member-card');
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '10px';
    const head = clone.querySelector('.member-head');
    head.style.display = 'flex';
    head.style.alignItems = 'center';
    head.style.gap = '10px';
    const foot = clone.querySelector('.member-foot');
    foot.style.display = 'flex';
    foot.style.justifyContent = 'space-between';
    const btn = clone.querySelector('.remove-btn');
    btn.style.color = '#dc2626';
    btn.style.borderColor = '#fecaca';
    btn.addEventListener('click', async () => {
      if (!confirm('Remove member?')) return;
      try { await api.del(`/api/projects/${activeProjectId}/members/${m.userId}`); notify.success('Member removed'); await load(); } catch (e) { notify.error(e.message); }
    });
    grid.appendChild(clone);
  });
};

const renderAvailable = (members) => {
  const memberIds = new Set(members.map((m) => String(m.userId)));
  const available = allUsers.filter((u) => !memberIds.has(String(u.id)));
  const el = $('#availableUsers');
  el.textContent = '';
  if (!available.length) {
    const empty = document.createElement('div');
    empty.textContent = 'All users are members';
    empty.style.cssText = 'color:#64748b;font-size:13px;padding:10px;text-align:center';
    el.appendChild(empty);
    return;
  }
  const tpl = document.getElementById('availableUserTemplate');
  available.forEach((u) => {
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.avatar-sm').textContent = initials(u.name);
    clone.querySelector('.available-name').textContent = u.name;
    clone.querySelector('.available-name').style.fontWeight = '600';
    clone.querySelector('.available-name').style.fontSize = '13px';
    clone.querySelector('.available-sub').textContent = `${u.email} • ${u.role}`;
    clone.querySelector('.available-sub').style.fontSize = '12px';
    clone.querySelector('.available-sub').style.color = '#64748b';
    const row = clone.querySelector('.member-row');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '10px 12px';
    row.style.border = '1px solid #e2e8f0';
    row.style.borderRadius = '10px';
    row.style.background = 'white';
    const left = clone.querySelector('.available-left');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '10px';
    const actions = clone.querySelector('.available-actions');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.alignItems = 'center';
    const sel = clone.querySelector('.role-select');
    sel.style.padding = '6px 8px';
    sel.style.fontSize = '13px';
    const btn = clone.querySelector('.add-btn');
    btn.dataset.add = u.id;
    btn.addEventListener('click', async () => {
      const role = sel.value;
      try { await api.post(`/api/projects/${activeProjectId}/members`, { userId: u.id, role }); notify.success('Member added'); await load(); } catch (e) { notify.error(e.message); }
    });
    el.appendChild(clone);
  });
};

$('#addMemberBtn')?.addEventListener('click', () => document.getElementById('availableUsers').scrollIntoView({ behavior: 'smooth' }));

init();
