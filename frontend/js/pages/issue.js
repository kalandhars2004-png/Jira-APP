import { auth } from '../core/auth.js';
import { api } from '../core/api.js';
import { initSidebar } from '../components/sidebar.js';
import { initTopnav } from '../components/navbar.js';
import { notify } from '../components/toast.js';
import { formatDate, formatDateShort, formatDateTime, formatTime, initials, timeAgo } from '../utils/formatters.js';
import { liveStatus, toLocalISO } from '../utils/deadline.js';
import { createDateTimePicker } from '../components/dateTimePicker.js';
import { onClockTick } from '../utils/clock.js';

const user = auth.requireAuth();
initSidebar('board');
initTopnav({ title: 'Issue', subtitle: '' });
const topAvatar = document.getElementById('topnavAvatar');
if (topAvatar) { topAvatar.textContent = initials(user.name); }

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const issueId = params.get('id') || params.get('issueId');
if (!issueId) { notify.error('No issue id'); }

let currentIssue = null;
let currentProject = null;
let workflow = [];
let canEdit = false;
let duePicker = null;

const refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };

const checkCanEdit = (issue) => {
  if (!issue) return false;
  if (user.role === 'ADMIN') return true;
  if (String(issue.assigneeId) === String(user.id)) return true;
  // PROJECT_MANAGER can edit any in project (extensible)
  if (user.role === 'PROJECT_MANAGER') return true;
  return false;
};

const loadIssue = async () => {
  try {
    const data = await api.get(`/api/issues/${issueId}`);
    currentIssue = data;
    // fetch project for workflow
    if (data.projectId) {
      try {
        currentProject = await api.get(`/api/projects/${data.projectId}`);
        workflow = currentProject.workflow && Array.isArray(currentProject.workflow) ? currentProject.workflow : ['TODO','IN_PROGRESS','IN_REVIEW','DONE'];
      } catch { workflow = ['TODO','IN_PROGRESS','IN_REVIEW','DONE']; }
    }
    // permission: only assignee or ADMIN can edit (others view-only)
    canEdit = checkCanEdit(data);
    renderIssue(data);
    await Promise.all([loadComments(), loadActivity(), loadSubtasks(), loadLinks(), loadWatchers(), loadAttachments()]);
    refreshIcons();
  } catch (e) { notify.error(e.message); }
};

const renderIssue = (issue) => {
  // Show read-only banner if not editable
  let roBanner = document.getElementById('readOnlyBanner');
  if (!canEdit) {
    if (!roBanner) {
      roBanner = document.createElement('div');
      roBanner.id = 'readOnlyBanner';
      roBanner.style.background = '#f1f5f9';
      roBanner.style.border = '1px solid #e2e8f0';
      roBanner.style.color = '#475569';
      roBanner.style.padding = '8px 12px';
      roBanner.style.borderRadius = '8px';
      roBanner.style.fontSize = '12px';
      roBanner.style.fontWeight = '600';
      roBanner.style.display = 'flex';
      roBanner.style.alignItems = 'center';
      roBanner.style.gap = '8px';
      roBanner.innerHTML = '<i data-lucide="eye" style="width:14px;height:14px"></i> View only — you are not the assignee. Only assignee or admin can edit.';
      const header = document.querySelector('.issue-header');
      header?.after(roBanner);
      if (window.lucide) window.lucide.createIcons();
    }
    roBanner.style.display = 'flex';
  } else if (roBanner) roBanner.style.display = 'none';

  $('#issueKey').textContent = issue.issueKey;
  $('#projectName').textContent = issue.projectName || '';
  const parentLink = $('#parentLink');
  if (issue.parentId && issue.parentKey) {
    parentLink.style.display = 'inline';
    parentLink.textContent = `Parent: ${issue.parentKey}`;
    parentLink.style.cursor = 'pointer';
    parentLink.onclick = () => location.href = `/pages/issue.html?id=${issue.parentId}`;
  } else parentLink.style.display = 'none';

  const titleEl = $('#issueTitle');
  titleEl.textContent = issue.title;
  titleEl.style.display = 'block';
  $('#issueTitleInput').classList.add('hidden');
  $('#titleSaveBtn').classList.add('hidden');
  $('#titleCancelBtn').classList.add('hidden');

  // status dropdown
  const statusSel = $('#statusSelect');
  statusSel.textContent = '';
  workflow.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    if (s === issue.status) opt.selected = true;
    statusSel.appendChild(opt);
  });
  if (!workflow.includes(issue.status)) {
    const opt = document.createElement('option');
    opt.value = issue.status;
    opt.textContent = issue.status;
    opt.selected = true;
    statusSel.appendChild(opt);
  }
  statusSel.disabled = !canEdit;
  statusSel.onchange = async () => {
    try { await api.patch(`/api/issues/${issue.id}/status`, { status: statusSel.value, userId: user.id }); notify.success(`Status → ${statusSel.value}`); await loadIssue(); } catch (e) { notify.error(e.message); }
  };

  // priority
  const priSel = $('#prioritySelectDetail');
  priSel.textContent = '';
  ['Lowest','Low','Medium','High','Highest'].forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.toUpperCase();
    opt.textContent = p;
    if (p.toUpperCase() === issue.priority) opt.selected = true;
    priSel.appendChild(opt);
  });
  // also support LOW etc.
  ['LOW','MEDIUM','HIGH','CRITICAL'].forEach(p => {
    if (!Array.from(priSel.options).some(o=>o.value===p)) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      if (p===issue.priority) opt.selected = true;
      priSel.appendChild(opt);
    }
  });
  priSel.disabled = !canEdit;
  priSel.onchange = async () => {
    try { await api.patch(`/api/issues/${issue.id}/priority`, { priority: priSel.value, userId: user.id }); notify.success('Priority updated'); await loadIssue(); } catch (e) { notify.error(e.message); }
  };

  // assignee pill
  const assigneePill = $('#assigneePill');
  if (issue.assigneeName) {
    assigneePill.textContent = issue.assigneeName;
    assigneePill.classList.remove('hidden');
  } else assigneePill.classList.add('hidden');

  // description
  const descEl = $('#issueDescription');
  descEl.textContent = issue.description || 'Click to add description...';
  descEl.style.cursor = canEdit ? 'pointer' : 'default';
  descEl.onclick = () => { if (canEdit) startEditDesc(); };

  // details sidebar
  const assigneeName = $('#detailAssigneeName');
  if (assigneeName) assigneeName.textContent = issue.assigneeName || 'Unassigned';
  const assigneeAvatar = $('#detailAssigneeAvatar');
  if (assigneeAvatar) assigneeAvatar.textContent = initials(issue.assigneeName || '?');
  const reporterEl = $('#detailReporter');
  if (reporterEl) reporterEl.textContent = issue.reporterName || '-';
  const projectEl = $('#projectValue');
  if (projectEl) projectEl.textContent = issue.projectName || '-';
  const createdEl = $('#createdValue');
  if (createdEl) createdEl.textContent = formatDate(issue.createdAt);
  const updatedEl = $('#updatedValue');
  if (updatedEl) updatedEl.textContent = timeAgo(issue.updatedAt);

  // labels
  renderLabels(issue.labels);
  // sprint
  $('#sprintValue').textContent = issue.sprint || '—';
  $('#sprintInput').value = issue.sprint || '';
  // due date & time
  const dueEl = $('#dueDateValue');
  const ds = liveStatus(issue, new Date());
  let dueText = issue.dueDate ? formatDateTime(issue.dueDate) : '—';
  if (issue.dueDate) {
    if (ds === 'OVERDUE') dueText += ' • Overdue';
    else if (ds === 'DUE_TODAY') dueText += ` • Due today at ${formatTime(issue.dueDate)}`;
    else if (ds === 'COMPLETED' && issue.completionLabel) dueText += ` • ${issue.completionLabel}`;
  }
  dueEl.textContent = dueText;
  dueEl.className = 'detail-value';
  if (ds === 'OVERDUE') dueEl.classList.add('due-overdue');
  else if (ds === 'DUE_TODAY') dueEl.classList.add('due-soon');
  // init / sync picker
  const host = document.getElementById('duePickerHost');
  if (host) {
    if (!duePicker) {
      duePicker = createDateTimePicker({ container: host, value: issue.dueDate || null });
      if (!canEdit) {
        const btns = host.querySelectorAll('button');
        btns.forEach(b => b.disabled = true);
      }
    } else {
      duePicker.setValue(issue.dueDate || null);
    }
    if (canEdit) host.style.opacity = '1'; else host.style.opacity = '0.7';
    host.style.pointerEvents = canEdit ? 'auto' : 'none';
  }

  // topnav title
  const topTitle = document.getElementById('topnavTitle');
  if (topTitle) topTitle.textContent = issue.issueKey;
  const topSub = document.getElementById('topnavSubtitle');
  if (topSub) topSub.textContent = issue.title;

  // more actions menu
  $('#deleteIssueBtn').onclick = async () => {
    if (!confirm('Delete this issue?')) return;
    try { await api.del(`/api/issues/${issue.id}`); notify.success('Deleted'); location.href = '/pages/board.html'; } catch (e) { notify.error(e.message); }
  };
  $('#duplicateIssueBtn').onclick = async () => {
    try {
      const payload = { projectId: issue.projectId, title: issue.title + ' (copy)', description: issue.description, issueType: issue.issueType, priority: issue.priority, status: issue.status, assigneeId: issue.assigneeId, reporterId: user.id, dueDate: issue.dueDate, labels: issue.labels, storyPoints: issue.storyPoints, sprint: issue.sprint };
      const created = await api.post('/api/issues', payload);
      notify.success(`Duplicated as ${created.issueKey}`);
      location.href = `/pages/issue.html?id=${created.id}`;
    } catch (e) { notify.error(e.message); }
  };

  // watchers
  // will be loaded separately

  // Hide/disable editing controls for view-only
  const editBtns = ['editDescBtn','createSubtaskBtn','linkIssueBtn','addAttachmentBtn','assigneeEditBtn','labelAddBtn','sprintSaveBtn','sprintRemoveBtn','dueDateSaveBtn','dueDateRemoveBtn','titleSaveBtn','titleCancelBtn','descSaveBtn','descCancelBtn','moreActionsBtn'];
  editBtns.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = canEdit ? '' : 'none';
  });
  // Disable title click
  const titleEl2 = document.getElementById('issueTitle');
  if (titleEl2) titleEl2.style.cursor = canEdit ? 'pointer' : 'default';
  // Disable status/priority already handled
  if (!canEdit) {
    const descEl = document.getElementById('issueDescription');
    if (descEl) descEl.style.cursor = 'default';
  }
};

const renderLabels = (labelsStr) => {
  const container = $('#labelsValue');
  container.textContent = '';
  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '4px';
  if (!labelsStr) {
    const empty = document.createElement('span');
    empty.textContent = '—';
    empty.style.color = '#94a3b8';
    empty.style.fontSize = '12px';
    container.appendChild(empty);
    return;
  }
  labelsStr.split(',').map(s=>s.trim()).filter(Boolean).forEach(label => {
    const pill = document.createElement('span');
    pill.className = 'label-pill';
    pill.textContent = label;
    const btn = document.createElement('button');
    btn.textContent = '×';
    btn.title = 'Remove';
    btn.onclick = async () => {
      if (!canEdit) return notify.error('No permission');
      const newLabels = labelsStr.split(',').map(s=>s.trim()).filter(s=> s!==label).join(',');
      try { await api.put(`/api/issues/${currentIssue.id}`, { labels: newLabels }, { params: { userId: user.id } }); notify.success('Label removed'); await loadIssue(); } catch (e) { notify.error(e.message); }
    };
    if (canEdit) pill.appendChild(btn);
    container.appendChild(pill);
  });
};

// Title edit
$('#issueTitle').addEventListener('click', () => { if (!canEdit) return; startEditTitle(); });
$('#issueTitle').addEventListener('keydown', (e) => { if (e.key==='Enter' && canEdit) startEditTitle(); });
const startEditTitle = () => {
  const titleEl = $('#issueTitle');
  const input = $('#issueTitleInput');
  const save = $('#titleSaveBtn');
  const cancel = $('#titleCancelBtn');
  titleEl.classList.add('hidden');
  input.classList.remove('hidden');
  save.classList.remove('hidden');
  cancel.classList.remove('hidden');
  input.value = currentIssue.title;
  input.focus();
};
const cancelEditTitle = () => {
  $('#issueTitle').classList.remove('hidden');
  $('#issueTitleInput').classList.add('hidden');
  $('#titleSaveBtn').classList.add('hidden');
  $('#titleCancelBtn').classList.add('hidden');
};
$('#titleCancelBtn').addEventListener('click', cancelEditTitle);
$('#titleSaveBtn').addEventListener('click', async () => {
  const newTitle = $('#issueTitleInput').value.trim();
  if (!newTitle) return notify.error('Title required');
  try { await api.put(`/api/issues/${currentIssue.id}`, { title: newTitle }, { params: { userId: user.id } }); notify.success('Title updated'); await loadIssue(); } catch (e) { notify.error(e.message); }
});

// Description edit
const startEditDesc = () => {
  if (!canEdit) return;
  $('#issueDescription').classList.add('hidden');
  $('#descEditArea').classList.remove('hidden');
  $('#descInput').value = currentIssue.description || '';
  $('#descInput').focus();
};
$('#editDescBtn').addEventListener('click', startEditDesc);
$('#descCancelBtn').addEventListener('click', () => {
  $('#descEditArea').classList.add('hidden');
  $('#issueDescription').classList.remove('hidden');
});
$('#descSaveBtn').addEventListener('click', async () => {
  const newDesc = $('#descInput').value;
  try { await api.put(`/api/issues/${currentIssue.id}`, { description: newDesc }, { params: { userId: user.id } }); notify.success('Description updated'); $('#descEditArea').classList.add('hidden'); $('#issueDescription').classList.remove('hidden'); await loadIssue(); } catch (e) { notify.error(e.message); }
});

// Assignee
$('#assigneeEditBtn').addEventListener('click', async () => {
  const picker = $('#assigneePicker');
  picker.classList.toggle('hidden');
  if (!picker.classList.contains('hidden')) {
    const search = $('#assigneeSearch');
    search.value = '';
    search.focus();
    await loadAssigneeOptions('');
    search.oninput = async () => await loadAssigneeOptions(search.value);
  }
});
const loadAssigneeOptions = async (q) => {
  const container = $('#assigneeOptions');
  container.textContent = '';
  try {
    const users = await api.get('/api/auth/users');
    const filtered = q ? users.filter(u => u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())) : users;
    filtered.slice(0,8).forEach(u => {
      const row = document.createElement('div');
      row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px'; row.style.padding='6px 8px'; row.style.borderRadius='8px'; row.style.cursor='pointer';
      row.onmouseenter = () => row.style.background='#f8fafc';
      row.onmouseleave = () => row.style.background='transparent';
      const av = document.createElement('div');
      av.className='avatar';
      av.textContent=initials(u.name);
      av.style.width='24px'; av.style.height='24px'; av.style.fontSize='11px';
      const info = document.createElement('div');
      info.style.flex='1';
      const name = document.createElement('div');
      name.textContent=u.name;
      name.style.fontSize='13px'; name.style.fontWeight='600';
      const email = document.createElement('div');
      email.textContent=u.email;
      email.style.fontSize='11px'; email.style.color='#64748b';
      info.append(name,email);
      row.append(av,info);
      row.addEventListener('click', async () => {
        try { await api.patch(`/api/issues/${currentIssue.id}/assignee`, { assigneeId: u.id, userId: user.id }); notify.success(`Assigned to ${u.name}`); $('#assigneePicker').classList.add('hidden'); await loadIssue(); } catch (e) { notify.error(e.message); }
      });
      container.appendChild(row);
    });
  } catch (e) { notify.error(e.message); }
};
$('#assignToMeBtn').addEventListener('click', async () => {
  try { await api.patch(`/api/issues/${currentIssue.id}/assignee`, { assigneeId: user.id, userId: user.id }); notify.success('Assigned to me'); $('#assigneePicker').classList.add('hidden'); await loadIssue(); } catch (e) { notify.error(e.message); }
});
$('#unassignBtn').addEventListener('click', async () => {
  try { await api.patch(`/api/issues/${currentIssue.id}/assignee`, { assigneeId: null, userId: user.id }); notify.success('Unassigned'); $('#assigneePicker').classList.add('hidden'); await loadIssue(); } catch (e) { notify.error(e.message); }
});

// Labels
$('#labelAddBtn').addEventListener('click', async () => {
  if (!canEdit) return notify.error('No permission');
  const input = $('#labelInput');
  const val = input.value.trim();
  if (!val) return;
  const current = currentIssue.labels ? currentIssue.labels.split(',').map(s=>s.trim()).filter(Boolean) : [];
  if (current.includes(val)) return notify.error('Label already exists');
  const newLabels = [...current, val].join(',');
  try { await api.put(`/api/issues/${currentIssue.id}`, { labels: newLabels }, { params: { userId: user.id } }); input.value=''; await loadIssue(); } catch (e) { notify.error(e.message); }
});

// Sprint
$('#sprintSaveBtn').addEventListener('click', async () => {
  if (!canEdit) return;
  const val = $('#sprintInput').value.trim();
  try { await api.put(`/api/issues/${currentIssue.id}`, { sprint: val || null }, { params: { userId: user.id } }); notify.success('Sprint updated'); await loadIssue(); } catch (e) { notify.error(e.message); }
});
$('#sprintRemoveBtn').addEventListener('click', async () => {
  try { await api.put(`/api/issues/${currentIssue.id}`, { sprint: null }, { params: { userId: user.id } }); $('#sprintInput').value=''; await loadIssue(); } catch (e) { notify.error(e.message); }
});

// Due date & time
$('#dueDateSaveBtn').addEventListener('click', async () => {
  if (!canEdit) return;
  const val = duePicker ? duePicker.getValue() : null;
  const err = document.getElementById('dueEditError');
  if (err) { err.classList.add('hidden'); err.textContent=''; }
  if (!val) { if(err){err.textContent='⚠ Please select a due date and time'; err.classList.remove('hidden');} return; }
  if (val <= new Date()) { if(err){err.textContent='⚠ Due date and time must be in the future'; err.classList.remove('hidden');} return; }
  try { await api.put(`/api/issues/${currentIssue.id}`, { dueDate: toLocalISO(val) }, { params: { userId: user.id } }); notify.success('Due date updated'); await loadIssue(); } catch (e) { notify.error(e.message); }
});
$('#dueDateRemoveBtn').addEventListener('click', async () => {
  // Allow removing due date? But spec says due date required, so we just notify
  notify.info('Due date is required for every issue');
});

// Comments
const loadComments = async () => {
  const list = $('#commentList');
  const count = $('#commentCount');
  list.textContent = '';
  try {
    const comments = await api.get(`/api/issues/${issueId}/comments`);
    count.textContent = `${comments.length}`;
    if (!comments.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No comments yet';
      empty.style.color='#94a3b8'; empty.style.fontSize='13px'; empty.style.textAlign='center'; empty.style.padding='12px';
      list.appendChild(empty);
      return;
    }
    comments.forEach(c => {
      const item = document.createElement('div');
      item.className = 'comment-item';
      const head = document.createElement('div');
      head.className = 'comment-head';
      const av = document.createElement('div');
      av.className = 'avatar';
      av.textContent = initials(c.userName);
      const author = document.createElement('span');
      author.className = 'comment-author';
      author.textContent = c.userName;
      const time = document.createElement('span');
      time.className = 'comment-time';
      time.textContent = timeAgo(c.createdAt);
      const actions = document.createElement('div');
      actions.className = 'comment-actions';
      if (c.userId === user.id || user.role === 'ADMIN') {
        const edit = document.createElement('button');
        edit.textContent = 'Edit';
        edit.onclick = async () => {
          const newContent = prompt('Edit comment:', c.content);
          if (newContent !== null && newContent.trim() !== c.content) {
            try { await api.put(`/api/comments/${c.id}`, { content: newContent.trim(), userId: user.id }); await loadComments(); await loadActivity(); } catch (e) { notify.error(e.message); }
          }
        };
        const del = document.createElement('button');
        del.textContent = 'Delete';
        del.style.color = '#dc2626';
        del.onclick = async () => {
          if (!confirm('Delete comment?')) return;
          try { await api.del(`/api/comments/${c.id}`, { params: { userId: user.id } }); await loadComments(); await loadActivity(); } catch (e) { notify.error(e.message); }
        };
        actions.append(edit, del);
      }
      head.append(av, author, time, actions);
      const body = document.createElement('div');
      body.className = 'comment-body';
      // simple @mention highlight
      body.textContent = c.content;
      body.innerHTML = body.textContent.replace(/@(\w+)/g, '<span style="background:#eef2ff;color:#4f46e5;padding:1px 4px;border-radius:4px;font-weight:600">@$1</span>');
      item.append(head, body);
      list.appendChild(item);
    });
  } catch (e) {
    const err = document.createElement('div');
    err.textContent = e.message;
    err.style.color='#dc2626';
    list.appendChild(err);
  }
};

$('#commentAddBtn').addEventListener('click', async () => {
  const input = $('#commentInput');
  const content = input.value.trim();
  if (!content) return;
  try { await api.post(`/api/issues/${issueId}/comments`, { content, userId: user.id }); input.value=''; await loadComments(); await loadActivity(); } catch (e) { notify.error(e.message); }
});
$('#commentInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#commentAddBtn').click(); }
});

// Activity
const loadActivity = async () => {
  const list = $('#activityList');
  list.textContent = '';
  try {
    const acts = await api.get(`/api/issues/${issueId}/activity`);
    if (!acts.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No activity yet';
      empty.style.color='#94a3b8'; empty.style.fontSize='13px';
      list.appendChild(empty);
      return;
    }
    acts.forEach(a => {
      const item = document.createElement('div');
      item.className = 'activity-item';
      const dot = document.createElement('div');
      dot.className = 'activity-dot';
      dot.textContent = '•';
      const content = document.createElement('div');
      content.style.flex='1';
      const details = document.createElement('div');
      details.textContent = a.details;
      details.style.fontWeight='600';
      details.style.fontSize='12px';
      const meta = document.createElement('div');
      meta.textContent = `${a.userName || 'System'} • ${timeAgo(a.createdAt)}`;
      meta.style.fontSize='11px';
      meta.style.color='#94a3b8';
      content.append(details, meta);
      item.append(dot, content);
      list.appendChild(item);
    });
  } catch (e) {
    const err = document.createElement('div');
    err.textContent = e.message;
    list.appendChild(err);
  }
};

// Subtasks
const loadSubtasks = async () => {
  const list = $('#subtaskList');
  const count = $('#subtaskCount');
  list.textContent = '';
  try {
    const subtasks = await api.get(`/api/issues/${issueId}/subtasks`);
    count.textContent = `${subtasks.length}`;
    if (!subtasks.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No subtasks';
      empty.style.color='#94a3b8'; empty.style.fontSize='13px'; empty.style.padding='8px'; empty.style.textAlign='center';
      list.appendChild(empty);
      return;
    }
    subtasks.forEach(st => {
      const item = document.createElement('div');
      item.className = 'subtask-item';
      const cb = document.createElement('input');
      cb.type='checkbox';
      cb.checked = st.status === 'DONE' || st.status === currentProject?.workflow?.slice(-1)[0];
      cb.onchange = async () => {
        const newStatus = cb.checked ? (currentProject?.workflow?.slice(-1)[0] || 'DONE') : 'TODO';
        try { await api.patch(`/api/issues/${st.id}/status`, { status: newStatus, userId: user.id }); await loadSubtasks(); } catch (e) { notify.error(e.message); cb.checked = !cb.checked; }
      };
      const key = document.createElement('span');
      key.textContent = st.issueKey;
      key.style.fontFamily='JetBrains Mono'; key.style.fontSize='11px'; key.style.fontWeight='700'; key.style.color='#64748b';
      const title = document.createElement('span');
      title.textContent = st.title;
      title.style.flex='1'; title.style.fontSize='13px'; title.style.fontWeight='600'; title.style.cursor='pointer';
      title.onclick = () => location.href = `/pages/issue.html?id=${st.id}`;
      if (cb.checked) title.style.textDecoration='line-through'; title.style.opacity='.6';
      item.append(cb, key, title);
      list.appendChild(item);
    });
  } catch (e) {
    const err = document.createElement('div');
    err.textContent = e.message;
    err.style.color='#dc2626';
    list.appendChild(err);
  }
};

$('#createSubtaskBtn').addEventListener('click', () => {
  if (!canEdit) return notify.error('No permission');
  $('#subtaskCreateArea').classList.remove('hidden');
  $('#subtaskTitleInput').focus();
});
$('#subtaskCancelBtn').addEventListener('click', () => {
  $('#subtaskCreateArea').classList.add('hidden');
  $('#subtaskTitleInput').value='';
});
$('#subtaskCreateBtn').addEventListener('click', async () => {
  const title = $('#subtaskTitleInput').value.trim();
  if (!title) return notify.error('Title required');
  try {
    await api.post('/api/issues', { projectId: currentIssue.projectId, title, description: '', issueType: 'TASK', priority: 'MEDIUM', status: 'TODO', assigneeId: null, reporterId: user.id, dueDate: currentIssue.dueDate, parentId: currentIssue.id });
    notify.success('Subtask created');
    $('#subtaskTitleInput').value='';
    $('#subtaskCreateArea').classList.add('hidden');
    await loadSubtasks();
  } catch (e) { notify.error(e.message); }
});

// Linked issues
const loadLinks = async () => {
  const list = $('#linkedList');
  const count = $('#linkedCount');
  list.textContent = '';
  try {
    const links = await api.get(`/api/issues/${issueId}/links`);
    count.textContent = `${links.length}`;
    if (!links.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No linked issues';
      empty.style.color='#94a3b8'; empty.style.fontSize='13px'; empty.style.padding='8px'; empty.style.textAlign='center';
      list.appendChild(empty);
      return;
    }
    links.forEach(l => {
      const item = document.createElement('div');
      item.className = 'linked-item';
      const type = document.createElement('span');
      type.textContent = l.linkType;
      type.style.fontSize='11px'; type.style.fontWeight='700'; type.style.background='#f1f5f9'; type.style.padding='2px 6px'; type.style.borderRadius='6px';
      const key = document.createElement('a');
      key.textContent = l.targetKey || l.sourceKey;
      key.href = `/pages/issue.html?id=${l.targetIssueId === Number(issueId) ? l.sourceIssueId : l.targetIssueId}`;
      key.style.fontWeight='700'; key.style.color='#4f46e5';
      const title = document.createElement('span');
      title.textContent = l.targetTitle || '';
      title.style.flex='1'; title.style.whiteSpace='nowrap'; title.style.overflow='hidden'; title.style.textOverflow='ellipsis';
      const del = document.createElement('button');
      del.textContent = '×';
      del.style.border='none'; del.style.background='transparent'; del.style.cursor='pointer'; del.style.color='#94a3b8';
      del.onclick = async () => {
        if (!confirm('Remove link?')) return;
        try { await api.del(`/api/issues/links/${l.id}`, { params: { userId: user.id } }); await loadLinks(); } catch (e) { notify.error(e.message); }
      };
      item.append(type, key, title, del);
      list.appendChild(item);
    });
  } catch (e) {
    const err = document.createElement('div');
    err.textContent = e.message;
    list.appendChild(err);
  }
};

$('#linkIssueBtn').addEventListener('click', () => {
  if (!canEdit) return notify.error('No permission');
  $('#linkCreateArea').classList.remove('hidden');
});
$('#linkCancelBtn').addEventListener('click', () => {
  $('#linkCreateArea').classList.add('hidden');
});
$('#linkCreateBtn').addEventListener('click', async () => {
  const targetKey = $('#linkTargetInput').value.trim();
  const linkType = $('#linkTypeSelect').value;
  if (!targetKey) return notify.error('Enter issue key');
  try {
    // find target issue by key via search
    const all = await api.get(`/api/issues`, { params: { search: targetKey } });
    const target = all.find(i => i.issueKey === targetKey);
    if (!target) throw new Error('Issue not found');
    await api.post(`/api/issues/${issueId}/links`, { targetIssueId: target.id, linkType, createdBy: user.id });
    notify.success('Linked');
    $('#linkTargetInput').value='';
    $('#linkCreateArea').classList.add('hidden');
    await loadLinks();
  } catch (e) { notify.error(e.message); }
});

// Watchers
const loadWatchers = async () => {
  const list = $('#watcherList');
  const count = $('#watcherCount');
  const count2 = $('#watcherCount2');
  list.textContent = '';
  try {
    const watchers = await api.get(`/api/issues/${issueId}/watchers`);
    count.textContent = `${watchers.length}`;
    if (count2) count2.textContent = `${watchers.length}`;
    const isWatching = await api.get(`/api/issues/${issueId}/watchers/check`, { params: { userId: user.id } }).catch(()=> false);
    const watchText = $('#watchText');
    if (watchText) watchText.textContent = isWatching.data ? 'Unwatch' : 'Watch';
    const watchBtn = $('#watchBtn');
    watchBtn.onclick = async () => {
      const watching = await api.get(`/api/issues/${issueId}/watchers/check`, { params: { userId: user.id } }).then(r=>r.data).catch(()=>false);
      try {
        if (watching) { await api.del(`/api/issues/${issueId}/watchers/${user.id}`); } else { await api.post(`/api/issues/${issueId}/watchers`, null, { params: { userId: user.id } }); }
        await loadWatchers();
      } catch (e) { notify.error(e.message); }
    };
    if (!watchers.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No watchers';
      empty.style.color='#94a3b8'; empty.style.fontSize='12px';
      list.appendChild(empty);
      return;
    }
    watchers.forEach(w => {
      const pill = document.createElement('div');
      pill.className = 'watcher-pill';
      const av = document.createElement('div');
      av.className = 'avatar';
      av.textContent = initials(w.userName);
      av.style.width='20px'; av.style.height='20px'; av.style.fontSize='10px';
      const name = document.createElement('span');
      name.textContent = w.userName;
      name.style.fontSize='12px';
      pill.append(av, name);
      list.appendChild(pill);
    });
  } catch (e) {
    const err = document.createElement('div');
    err.textContent = e.message;
    list.appendChild(err);
  }
};

// Attachments
const loadAttachments = async () => {
  const list = $('#attachmentList');
  const count = $('#attachmentCount');
  list.textContent = '';
  try {
    const atts = await api.get(`/api/issues/${issueId}/attachments`);
    count.textContent = `${atts.length}`;
    if (!atts.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No attachments';
      empty.style.color='#94a3b8'; empty.style.fontSize='12px'; empty.style.padding='8px'; empty.style.textAlign='center';
      list.appendChild(empty);
      return;
    }
    atts.forEach(a => {
      const item = document.createElement('div');
      item.className = 'attachment-item';
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide','file');
      icon.style.width='16px'; icon.style.height='16px'; icon.style.color='#64748b';
      const info = document.createElement('div');
      info.style.flex='1';
      const name = document.createElement('div');
      name.textContent = a.fileName;
      name.style.fontSize='13px'; name.style.fontWeight='600';
      const meta = document.createElement('div');
      meta.textContent = `${a.fileType || ''} • ${(a.fileSize||0)} bytes • by ${a.uploadedByName} • ${timeAgo(a.uploadedAt)}`;
      meta.style.fontSize='11px'; meta.style.color='#94a3b8';
      info.append(name, meta);
      const dl = document.createElement('a');
      dl.textContent = 'Download';
      dl.href = a.fileUrl || '#';
      dl.target = '_blank';
      dl.className = 'btn btn-ghost btn-sm';
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.className = 'btn btn-ghost btn-sm';
      del.style.color='#dc2626';
      del.onclick = async () => {
        if (!confirm('Delete attachment?')) return;
        try { await api.del(`/api/attachments/${a.id}`, { params: { userId: user.id } }); await loadAttachments(); } catch (e) { notify.error(e.message); }
      };
      item.append(icon, info, dl, del);
      list.appendChild(item);
    });
    refreshIcons();
  } catch (e) {
    const err = document.createElement('div');
    err.textContent = e.message;
    list.appendChild(err);
  }
};

$('#addAttachmentBtn').addEventListener('click', () => {
  if (!canEdit) return notify.error('No permission');
  $('#attachmentCreateArea').classList.remove('hidden');
});
$('#attachmentCancelBtn').addEventListener('click', () => {
  $('#attachmentCreateArea').classList.add('hidden');
});
$('#attachmentCreateBtn').addEventListener('click', async () => {
  const name = $('#attachmentNameInput').value.trim();
  const url = $('#attachmentUrlInput').value.trim();
  if (!name) return notify.error('File name required');
  try {
    await api.post(`/api/issues/${issueId}/attachments`, { fileName: name, fileType: name.split('.').pop(), fileSize: 1024, uploadedBy: user.id, fileUrl: url || '#' });
    notify.success('Attachment added');
    $('#attachmentNameInput').value='';
    $('#attachmentUrlInput').value='';
    $('#attachmentCreateArea').classList.add('hidden');
    await loadAttachments();
  } catch (e) { notify.error(e.message); }
});

// More actions menu
const moreBtn = $('#moreActionsBtn');
const moreMenu = $('#moreMenu');
moreBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  moreMenu.style.display = moreMenu.style.display === 'none' || !moreMenu.style.display ? 'block' : 'none';
  const rect = moreBtn.getBoundingClientRect();
  moreMenu.style.top = `${rect.bottom + 6}px`;
  moreMenu.style.right = `${window.innerWidth - rect.right}px`;
  refreshIcons();
});
document.addEventListener('click', () => { if (moreMenu) moreMenu.style.display='none'; });

// Live overdue — refresh due display every 30s / on tab active
onClockTick(() => {
  if (!currentIssue) return;
  const ds = liveStatus(currentIssue, new Date());
  const dueEl = document.getElementById('dueDateValue');
  if (dueEl && currentIssue.dueDate) {
    let t = formatDateTime(currentIssue.dueDate);
    if (ds === 'OVERDUE') t += ' • Overdue';
    else if (ds === 'DUE_TODAY') t += ` • Due today at ${formatTime(currentIssue.dueDate)}`;
    else if (ds === 'COMPLETED' && currentIssue.completionLabel) t += ` • ${currentIssue.completionLabel}`;
    dueEl.textContent = t;
    dueEl.className = 'detail-value';
    if (ds === 'OVERDUE') dueEl.classList.add('due-overdue');
    else if (ds === 'DUE_TODAY') dueEl.classList.add('due-soon');
  }
});

// Close button
$('#closeIssueBtn').addEventListener('click', () => history.back());

loadIssue();
