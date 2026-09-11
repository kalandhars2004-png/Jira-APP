import { auth } from '../core/auth.js';
import { api } from '../core/api.js';
import { initSidebar } from '../components/sidebar.js';
import { initTopnav } from '../components/navbar.js';
import { createIssueCard } from '../components/issueCard.js';
import { openModal, closeModal, bindModalClose } from '../components/modal.js';
import { notify } from '../components/toast.js';
import { formatDate, formatDateTime, initials, timeAgo } from '../utils/formatters.js';
import { liveStatus, deadlineSnapshot, toLocalISO } from '../utils/deadline.js';
import { onClockTick } from '../utils/clock.js';
import { createDateTimePicker } from '../components/dateTimePicker.js';

const user = auth.requireAuth();
initSidebar('assign');
initTopnav({ title: 'Assign', subtitle: 'Create unassigned work first, then drag to developers. See who has what.' });

const $ = (s) => document.querySelector(s);
const projectSelect = $('#projectSelect');
const assignSearch = $('#assignSearch');
const priorityFilter = $('#priorityFilter');
const deadlineFilter = $('#deadlineFilter');
const assignBoard = $('#assignBoard');
const assignStats = $('#assignStats');

let allIssues = [];
let allMembers = [];
let allProjects = [];
let activeProjectId = localStorage.getItem('activeProjectId');
let dragged = null;

bindModalClose('unassignedModal');
bindModalClose('userDetailModal');

let uaDuePicker = null;
const initUaDuePicker = () => {
  const host = document.getElementById('uaDuePicker');
  if (!host || uaDuePicker) return;
  uaDuePicker = createDateTimePicker({ container: host, onChange: () => {
    document.getElementById('uaDueError')?.classList.add('hidden');
    document.getElementById('uaDueError').style.display='none';
    document.getElementById('uaPastError')?.classList.add('hidden');
    document.getElementById('uaPastError').style.display='none';
  }});
};

$('#createUnassignedBtn')?.addEventListener('click', () => {
  if (!activeProjectId) { notify.error('Select a project first'); return; }
  if (!uaDuePicker) initUaDuePicker();
  const def = new Date(); def.setDate(def.getDate()+1); def.setHours(9,0,0,0);
  uaDuePicker?.setValue(def);
  document.getElementById('uaDueError')?.classList.add('hidden');
  document.getElementById('uaPastError')?.classList.add('hidden');
  const ue = document.getElementById('uaDueError'); if(ue) ue.style.display='none';
  const pe = document.getElementById('uaPastError'); if(pe) pe.style.display='none';
  $('#uaTitle').value = '';
  $('#uaDesc').value = '';
  openModal('unassignedModal');
  if (window.lucide) window.lucide.createIcons();
});

$('#unassignedForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#uaSubmitBtn'); const orig = btn.textContent; btn.textContent='Creating...'; btn.disabled=true;
  try {
    const dueVal = uaDuePicker ? uaDuePicker.getValue() : null;
    const ue = document.getElementById('uaDueError');
    const pe = document.getElementById('uaPastError');
    if (!dueVal) { if(ue){ ue.classList.remove('hidden'); ue.style.display='block'; } throw new Error('Please select a due date and time'); }
    if (dueVal <= new Date()) { if(pe){ pe.classList.remove('hidden'); pe.style.display='block'; } throw new Error('Due date and time must be in the future'); }
    const payload = {
      projectId: Number(activeProjectId),
      title: $('#uaTitle').value.trim(),
      description: $('#uaDesc').value.trim(),
      issueType: $('#uaType').value,
      priority: $('#uaPriority').value,
      status: 'TODO',
      assigneeId: null,
      reporterId: user.id,
      dueDate: toLocalISO(dueVal)
    };
    if (!payload.title) throw new Error('Title required');
    await api.post('/api/issues', payload);
    notify.success('Unassigned issue created — drag to assign');
    closeModal('unassignedModal');
    const nd = new Date(); nd.setDate(nd.getDate()+1); nd.setHours(9,0,0,0);
    uaDuePicker?.setValue(nd);
    await loadIssues();
  } catch (err) { notify.error(err.message); }
  finally { btn.textContent=orig; btn.disabled=false; }
});

const init = async () => {
  try {
    allProjects = await api.get('/api/projects');
    projectSelect.textContent = '';
    allProjects.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.key} — ${p.name}`;
      if (String(p.id)===String(activeProjectId)) opt.selected=true;
      projectSelect.appendChild(opt);
    });
    if (!activeProjectId && allProjects[0]) activeProjectId = String(allProjects[0].id);
    if (activeProjectId) { projectSelect.value = activeProjectId; localStorage.setItem('activeProjectId', activeProjectId); }
    await Promise.all([loadMembers(), loadIssues()]);
  } catch (e) { notify.error(e.message); }
};

projectSelect?.addEventListener('change', async () => {
  activeProjectId = projectSelect.value;
  localStorage.setItem('activeProjectId', activeProjectId);
  await Promise.all([loadMembers(), loadIssues()]);
});

[assignSearch, priorityFilter, deadlineFilter].forEach(el => el?.addEventListener('input', renderBoard));
priorityFilter?.addEventListener('change', renderBoard);
deadlineFilter?.addEventListener('change', renderBoard);

const loadMembers = async () => {
  if (!activeProjectId) { allMembers=[]; return; }
  try { allMembers = await api.get(`/api/projects/${activeProjectId}/members`); } catch (e) { allMembers=[]; notify.error(e.message); }
};

const loadIssues = async () => {
  if (!activeProjectId) { allIssues=[]; renderBoard(); return; }
  try {
    allIssues = await api.get(`/api/projects/${activeProjectId}/issues`);
    renderBoard();
    renderTopStats();
  } catch (e) { notify.error(e.message); }
};

const filteredIssues = () => {
  const q = assignSearch.value.trim().toLowerCase();
  const pri = priorityFilter.value;
  const dl = deadlineFilter.value;
  return allIssues.filter((i) => {
    if (q && !(i.title.toLowerCase().includes(q) || i.issueKey.toLowerCase().includes(q) || (i.description||'').toLowerCase().includes(q))) return false;
    if (pri && i.priority !== pri) return false;
    if (dl) {
      const ds = liveStatus(i, new Date());
      if (ds !== dl) return false;
    }
    return true;
  });
};

const renderTopStats = () => {
  const filtered = filteredIssues();
  const total = filtered.length;
  const unassigned = filtered.filter(i => !i.assigneeId).length;
  const overdue = filtered.filter(i => liveStatus(i, new Date())==='OVERDUE').length;
  const dueToday = filtered.filter(i => liveStatus(i, new Date())==='DUE_TODAY').length;
  assignStats.textContent = '';
  [
    { label: `Total ${total}`, bg:'#f1f5f9' },
    { label: `Unassigned ${unassigned}`, bg:'#fffbeb' },
    { label: `Overdue ${overdue}`, bg: overdue ? '#fef2f2':'#f8fafc', color: overdue?'#dc2626':'#64748b' },
    { label: `Due Today ${dueToday}`, bg: dueToday ? '#fffbeb':'#f8fafc', color: dueToday?'#b45309':'#64748b' },
  ].forEach(({label, bg, color}) => {
    const s = document.createElement('span');
    s.textContent = label;
    s.style.background = bg;
    if (color) s.style.color = color;
    assignStats.appendChild(s);
  });
};

const getMemberStats = (memberId) => {
  const issues = filteredIssues().filter(i => String(i.assigneeId)===String(memberId));
  const total = issues.length;
  const todo = issues.filter(i=>i.status==='TODO').length;
  const inprog = issues.filter(i=>i.status==='IN_PROGRESS').length;
  const inrev = issues.filter(i=>i.status==='IN_REVIEW').length;
  const done = issues.filter(i=>i.status==='DONE').length;
  const overdue = issues.filter(i=> liveStatus(i, new Date())==='OVERDUE').length;
  const dueToday = issues.filter(i=> liveStatus(i, new Date())==='DUE_TODAY').length;
  return { total, todo, inprog, inrev, done, overdue, dueToday, issues };
};

const renderBoard = () => {
  renderTopStats();
  const filtered = filteredIssues();
  assignBoard.textContent = '';

  // Unassigned column first
  const unassignedIssues = filtered.filter(i => !i.assigneeId);
  const unassignedCol = createMemberColumn(null, unassignedIssues);
  assignBoard.appendChild(unassignedCol);

  // Member columns
  allMembers.forEach((m) => {
    const issues = filtered.filter(i => String(i.assigneeId)===String(m.userId));
    const col = createMemberColumn(m, issues);
    assignBoard.appendChild(col);
  });

  if (!filtered.length) {
    $('#emptyAssign')?.classList.remove('hidden');
  } else {
    $('#emptyAssign')?.classList.add('hidden');
  }

  bindDragForBoard();
  captureAssignSnap();
};

const createMemberColumn = (member, issues) => {
  const tpl = document.getElementById('memberColTemplate');
  const clone = tpl.content.cloneNode(true);
  const col = clone.querySelector('.member-col');
  const head = clone.querySelector('.member-col-head');
  const body = clone.querySelector('.member-col-body');
  const statsWrap = clone.querySelector('.member-stats');
  const viewBtn = clone.querySelector('.view-btn');

  if (!member) {
    col.classList.add('unassigned-col');
    clone.querySelector('.member-avatar-lg').textContent = '○';
    clone.querySelector('.member-avatar-lg').style.background = '#e2e8f0';
    clone.querySelector('.member-avatar-lg').style.color = '#475569';
    clone.querySelector('.member-name').textContent = 'Unassigned';
    clone.querySelector('.member-role').textContent = `${issues.length} issues`;
    clone.querySelector('.member-role').style.background = '#fffbeb';
    clone.querySelector('.member-role').style.color = '#b45309';
    clone.querySelector('.member-email').textContent = 'Drag to assign →';
    viewBtn.style.display = 'none';
    col.dataset.memberId = '';
    body.dataset.memberId = '';
  } else {
    clone.querySelector('.member-avatar-lg').textContent = initials(member.name);
    clone.querySelector('.member-name').textContent = member.name;
    clone.querySelector('.member-role').textContent = member.role;
    clone.querySelector('.member-email').textContent = member.email;
    col.dataset.memberId = member.userId;
    body.dataset.memberId = member.userId;
    viewBtn.addEventListener('click', () => openUserDetail(member));
  }

  // stats + workload indicator
  const stats = member ? getMemberStats(member.userId) : { total: issues.length, todo: issues.filter(i=>i.status==='TODO').length, inprog: issues.filter(i=>i.status==='IN_PROGRESS').length, done: issues.filter(i=>i.status==='DONE').length, overdue: issues.filter(i=> liveStatus(i, new Date())==='OVERDUE').length };
  const statTpl = document.getElementById('memberStatTemplate');
  const statsToShow = member ? [
    { val: stats.total, label: 'Total' },
    { val: stats.overdue, label: 'Overdue' },
    { val: stats.dueToday, label: 'Due' },
    { val: stats.done, label: 'Done' },
  ] : [
    { val: issues.length, label: 'Total' },
    { val: issues.filter(i=> liveStatus(i, new Date())==='OVERDUE').length, label: 'Overdue' },
  ];
  statsToShow.forEach(({val,label}) => {
    const sClone = statTpl.content.cloneNode(true);
    sClone.querySelector('.member-stat-val').textContent = val;
    sClone.querySelector('.member-stat-label').textContent = label;
    if (label==='Overdue' && val>0) sClone.querySelector('.member-stat-val').style.color='#dc2626';
    if (label==='Due' && val>0) sClone.querySelector('.member-stat-val').style.color='#b45309';
    statsWrap.appendChild(sClone);
  });
  // workload indicator for developers
  if (member) {
    const workload = document.createElement('div');
    workload.style.marginTop = '8px';
    const total = stats.total;
    const max = 8; // configured threshold
    const pct = Math.min(100, Math.round((total / max) * 100));
    let status = 'Available';
    let color = '#10b981';
    if (total >= 7) { status = 'Overloaded'; color = '#ef4444'; }
    else if (total >= 4) { status = 'Busy'; color = '#f59e0b'; }
    const barWrap = document.createElement('div');
    barWrap.style.height = '6px';
    barWrap.style.background = '#f1f5f9';
    barWrap.style.borderRadius = '99px';
    barWrap.style.overflow = 'hidden';
    const barFill = document.createElement('div');
    barFill.style.width = `${pct}%`;
    barFill.style.height = '100%';
    barFill.style.background = color;
    barFill.style.borderRadius = '99px';
    barFill.style.transition = 'width .3s';
    barWrap.appendChild(barFill);
    const statusRow = document.createElement('div');
    statusRow.style.display = 'flex';
    statusRow.style.justifyContent = 'space-between';
    statusRow.style.alignItems = 'center';
    statusRow.style.marginTop = '4px';
    statusRow.style.fontSize = '11px';
    const countText = document.createElement('span');
    countText.textContent = `${total} / ${max} tasks`;
    countText.style.color = '#64748b';
    countText.style.fontWeight = '600';
    const statusText = document.createElement('span');
    statusText.style.display = 'flex';
    statusText.style.alignItems = 'center';
    statusText.style.gap = '4px';
    statusText.style.fontWeight = '700';
    statusText.style.color = color;
    const dot = document.createElement('span');
    dot.style.width = '6px';
    dot.style.height = '6px';
    dot.style.borderRadius = '50%';
    dot.style.background = color;
    statusText.append(dot, document.createTextNode(status));
    if (total >= 7) {
      statusText.title = 'High workload';
      const warn = document.createElement('span');
      warn.textContent = '⚠ High workload';
      warn.style.fontSize = '11px';
      warn.style.color = '#dc2626';
      warn.style.fontWeight = '700';
      warn.style.marginLeft = '6px';
      statusText.appendChild(warn);
    }
    statusRow.append(countText, statusText);
    workload.append(barWrap, statusRow);
    head.appendChild(workload);
    if (window.lucide) window.lucide.createIcons();
  }

  // issues
  if (!issues.length) {
    const empty = document.createElement('div');
    empty.style.cssText='color:#64748b;font-size:13px;text-align:center;padding:16px;background:white;border:1px dashed #e2e8f0;border-radius:10px;display:flex;flex-direction:column;align-items:center;gap:6px';
    const icon = document.createElement('div');
    icon.style.width='32px'; icon.style.height='32px'; icon.style.borderRadius='8px'; icon.style.background='#f8fafc'; icon.style.display='grid'; icon.style.placeItems='center'; icon.style.color='#94a3b8';
    icon.innerHTML = member ? '<i data-lucide="inbox" style="width:16px;height:16px"></i>' : '<i data-lucide="check-circle-2" style="width:16px;height:16px;color:#10b981"></i>';
    const title = document.createElement('div');
    title.style.fontWeight='600'; title.style.fontSize='13px';
    title.textContent = member ? 'No assigned work' : 'All work is assigned';
    const desc = document.createElement('div');
    desc.style.fontSize='12px'; desc.style.color='#94a3b8';
    desc.textContent = member ? 'Drag an issue here to assign it.' : 'No unassigned issues found.';
    empty.append(icon, title, desc);
    body.appendChild(empty);
    if (window.lucide) window.lucide.createIcons();
  } else {
    issues.forEach((issue) => {
      const card = createIssueCard(issue);
      // quick assign menu on hover
      card.style.position = 'relative';
      const quickBtn = document.createElement('button');
      quickBtn.textContent = '⋮';
      quickBtn.style.position = 'absolute';
      quickBtn.style.top = '6px';
      quickBtn.style.right = '6px';
      quickBtn.style.width = '24px'; quickBtn.style.height = '24px';
      quickBtn.style.borderRadius = '6px';
      quickBtn.style.border = '1px solid #e2e8f0';
      quickBtn.style.background = 'white';
      quickBtn.style.display = 'none';
      quickBtn.style.alignItems = 'center';
      quickBtn.style.justifyContent = 'center';
      quickBtn.style.fontSize = '14px';
      quickBtn.style.cursor = 'pointer';
      quickBtn.title = 'Quick assign';
      const menu = document.createElement('div');
      menu.style.position = 'absolute';
      menu.style.top = '30px';
      menu.style.right = '6px';
      menu.style.background = 'white';
      menu.style.border = '1px solid #e2e8f0';
      menu.style.borderRadius = '10px';
      menu.style.boxShadow = '0 8px 24px rgba(15,23,42,.12)';
      menu.style.padding = '6px';
      menu.style.display = 'none';
      menu.style.zIndex = '10';
      menu.style.minWidth = '160px';
      const header = document.createElement('div');
      header.textContent = 'Assign to';
      header.style.fontSize = '11px'; header.style.fontWeight = '700'; header.style.letterSpacing = '.06em'; header.style.textTransform = 'uppercase'; header.style.color = '#94a3b8'; header.style.padding = '4px 8px';
      menu.appendChild(header);
      allMembers.forEach(m => {
        const opt = document.createElement('div');
        opt.textContent = m.name;
        opt.style.padding = '6px 8px';
        opt.style.borderRadius = '6px';
        opt.style.fontSize = '13px';
        opt.style.cursor = 'pointer';
        opt.onmouseenter = () => opt.style.background = '#f8fafc';
        opt.onmouseleave = () => opt.style.background = 'transparent';
        opt.addEventListener('click', async (e) => {
          e.stopPropagation();
          try { await api.patch(`/api/issues/${issue.id}/assignee`, { assigneeId: m.userId, userId: user.id }); notify.success(`Assigned to ${m.name}`); await loadIssues(); } catch (err) { notify.error(err.message); }
          menu.style.display = 'none';
        });
        menu.appendChild(opt);
      });
      const unassignedOpt = document.createElement('div');
      unassignedOpt.textContent = 'Unassigned';
      unassignedOpt.style.padding = '6px 8px';
      unassignedOpt.style.borderRadius = '6px';
      unassignedOpt.style.fontSize = '13px';
      unassignedOpt.style.cursor = 'pointer';
      unassignedOpt.style.color = '#64748b';
      unassignedOpt.onmouseenter = () => unassignedOpt.style.background = '#f8fafc';
      unassignedOpt.onmouseleave = () => unassignedOpt.style.background = 'transparent';
      unassignedOpt.addEventListener('click', async (e) => {
        e.stopPropagation();
        try { await api.patch(`/api/issues/${issue.id}/assignee`, { assigneeId: null, userId: user.id }); notify.success('Moved to Unassigned'); await loadIssues(); } catch (err) { notify.error(err.message); }
        menu.style.display = 'none';
      });
      menu.appendChild(unassignedOpt);
      quickBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
      });
      card.addEventListener('mouseenter', () => quickBtn.style.display = 'flex');
      card.addEventListener('mouseleave', () => { quickBtn.style.display = 'none'; menu.style.display = 'none'; });
      document.addEventListener('click', () => menu.style.display = 'none');
      card.addEventListener('click', () => { // open issue details
        location.href = `/pages/issue.html?id=${issue.id}`;
      });
      card.append(quickBtn, menu);
      body.appendChild(card);
    });
  }

  // click header to view details
  head.style.cursor = member ? 'pointer' : 'default';
  if (member) head.addEventListener('click', (e) => { if (e.target.closest('.view-btn')) return; openUserDetail(member); });

  // body dataset for drop
  body.dataset.drop = 'true';

  const wrapper = document.createElement('div');
  wrapper.appendChild(clone);
  return wrapper.firstElementChild;
};

const bindDragForBoard = () => {
  const cards = assignBoard.querySelectorAll('.issue-card');
  cards.forEach((card) => {
    card.draggable = true;
    card.addEventListener('dragstart', (e) => { dragged = card; card.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
    card.addEventListener('dragend', () => { dragged?.classList.remove('dragging'); dragged=null; });
  });

  const bodies = assignBoard.querySelectorAll('.member-col-body');
  bodies.forEach((body) => {
    if (body.dataset.bound) return;
    body.dataset.bound='true';
    body.addEventListener('dragover', (e) => { e.preventDefault(); body.classList.add('drag-over'); });
    body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
    body.addEventListener('drop', async (e) => {
      e.preventDefault(); body.classList.remove('drag-over');
      if (!dragged) return;
      const issueId = Number(dragged.dataset.issueId);
      const targetMemberId = body.dataset.memberId ? Number(body.dataset.memberId) : null;
      const issue = allIssues.find(i=> i.id===issueId);
      if (!issue) return;
      if (String(issue.assigneeId||'') === String(targetMemberId||'')) return;
      try {
        await api.patch(`/api/issues/${issueId}/assignee`, { assigneeId: targetMemberId, userId: user.id });
        const targetName = targetMemberId ? (allMembers.find(m=> String(m.userId)===String(targetMemberId))?.name || 'user') : 'Unassigned';
        notify.success(targetMemberId ? `Assigned to ${targetName}` : 'Moved to Unassigned');
        await loadIssues();
      } catch (err) { notify.error(err.message); }
    });
  });
};

const openUserDetail = (member) => {
  const stats = getMemberStats(member.userId);
  $('#userDetailTitle').textContent = `${member.name} — Details`;
  const body = $('#userDetailBody');
  body.textContent = '';

  const head = document.createElement('div');
  head.style.display='flex';
  head.style.alignItems='center';
  head.style.gap='12px';
  const av = document.createElement('div');
  av.className='member-avatar-lg';
  av.textContent=initials(member.name);
  av.style.width='48px'; av.style.height='48px'; av.style.fontSize='16px';
  const info = document.createElement('div');
  info.style.flex='1';
  const nameEl = document.createElement('div');
  nameEl.textContent=member.name;
  nameEl.style.fontWeight='800';
  nameEl.style.fontSize='16px';
  const emailEl = document.createElement('div');
  emailEl.textContent=`${member.email} • ${member.role}`;
  emailEl.style.fontSize='12px';
  emailEl.style.color='#64748b';
  info.append(nameEl, emailEl);
  head.append(av, info);
  body.appendChild(head);

  const grid = document.createElement('div');
  grid.className='detail-grid-stats';
  [
    { label:'Total', val:stats.total, color:'#334155' },
    { label:'To Do', val:stats.todo, color:'#64748b' },
    { label:'In Progress', val:stats.inprog, color:'#d97706' },
    { label:'In Review', val:stats.inrev, color:'#7c3aed' },
    { label:'Done', val:stats.done, color:'#059669' },
    { label:'Overdue', val:stats.overdue, color:'#dc2626' },
    { label:'Due Today', val:stats.dueToday, color:'#b45309' },
    { label:'Upcoming', val: stats.total - stats.overdue - stats.dueToday - stats.done, color:'#64748b' },
  ].forEach(({label,val,color}) => {
    const card = document.createElement('div');
    card.className='detail-stat-card';
    const v = document.createElement('div');
    v.textContent=val;
    v.style.fontSize='20px'; v.style.fontWeight='800'; v.style.color=color;
    const l = document.createElement('div');
    l.textContent=label;
    l.style.fontSize='11px'; l.style.fontWeight='700'; l.style.letterSpacing='.06em'; l.style.textTransform='uppercase'; l.style.color='#64748b'; l.style.marginTop='4px';
    card.append(v,l);
    grid.appendChild(card);
  });
  body.appendChild(grid);

  const listTitle = document.createElement('div');
  listTitle.textContent=`Issues assigned to ${member.name.split(' ')[0]} (${stats.total})`;
  listTitle.style.fontSize='13px'; listTitle.style.fontWeight='700'; listTitle.style.marginTop='16px'; listTitle.style.marginBottom='8px';
  body.appendChild(listTitle);

  if (!stats.issues.length) {
    const empty = document.createElement('div');
    empty.textContent='No issues assigned';
    empty.style.cssText='color:#94a3b8;font-size:13px;text-align:center;padding:16px;border:1px dashed #e2e8f0;border-radius:10px';
    body.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='8px'; list.style.maxHeight='260px'; list.style.overflow='auto';
    stats.issues.forEach((issue) => {
      const row = document.createElement('div');
      row.style.display='flex'; row.style.alignItems='center'; row.style.gap='10px'; row.style.padding='8px 10px'; row.style.border='1px solid #e2e8f0'; row.style.borderRadius='10px'; row.style.background='white';
      const key = document.createElement('span');
      key.textContent=issue.issueKey;
      key.className='mono';
      key.style.fontSize='11px'; key.style.fontWeight='700'; key.style.background='#f1f5f9'; key.style.padding='3px 6px'; key.style.borderRadius='6px';
      const title = document.createElement('span');
      title.textContent=issue.title;
      title.style.flex='1'; title.style.fontSize='13px'; title.style.fontWeight='600'; title.style.whiteSpace='nowrap'; title.style.overflow='hidden'; title.style.textOverflow='ellipsis';
      const badge = document.createElement('span');
      const ds = liveStatus(issue, new Date());
      badge.textContent=ds;
      badge.className=`deadline-badge deadline-${ds}`;
      badge.style.fontSize='10px';
      const pri = document.createElement('span');
      pri.textContent=issue.priority;
      pri.className=`priority-badge pri-${issue.priority}`;
      pri.style.fontSize='10px';
      row.append(key, title, badge, pri);
      row.addEventListener('click', () => { closeModal('userDetailModal'); location.href=`/pages/board.html?projectId=${issue.projectId}`; });
      row.style.cursor='pointer';
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  openModal('userDetailModal');
};

let assignSnap = null;
const captureAssignSnap = () => { assignSnap = deadlineSnapshot(allIssues, new Date()); };
const watchAssign = () => {
  onClockTick(() => {
    const next = deadlineSnapshot(allIssues, new Date());
    let changed = !assignSnap || assignSnap.size !== next.size;
    if (!changed) { for (const [k,v] of next) { if (assignSnap.get(k) !== v) { changed = true; break; } } }
    if (changed) { assignSnap = next; renderBoard(); }
  });
};

init().then(() => {
  initUaDuePicker();
  watchAssign();
});
