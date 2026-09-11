import { auth } from '../core/auth.js';
import { api } from '../core/api.js';
import { initSidebar } from '../components/sidebar.js';
import { initTopnav } from '../components/navbar.js';
import { createIssueCard } from '../components/issueCard.js';
import { openModal, closeModal, bindModalClose } from '../components/modal.js';
import { notify } from '../components/toast.js';
import { formatDate, formatDateTime, formatTime, timeAgo, initials } from '../utils/formatters.js';
import { calculateDeadlineStatus, deadlineSnapshot, toLocalISO, liveStatus } from '../utils/deadline.js';
import { onClockTick } from '../utils/clock.js';
import { createDateTimePicker } from '../components/dateTimePicker.js';

const user = auth.requireAuth();
initSidebar('board');
initTopnav({ title: 'Board', subtitle: '' });
const topAvatar = document.getElementById('topnavAvatar');
if (topAvatar) { topAvatar.textContent = initials(user.name); topAvatar.title = `${user.name} • ${user.email}`; }

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const projectSelect = $('#projectSelect');
const boardSearch = $('#boardSearch');
const priorityFilter = $('#priorityFilter');
const typeFilter = $('#typeFilter');
const boardWrap = $('#boardWrap');

let allIssues = [];
let allProjects = [];
let activeProjectId = new URLSearchParams(location.search).get('projectId') || localStorage.getItem('activeProjectId');
let activeDeadlineFilter = 'all';
let activeBoardView = localStorage.getItem('boardView') || 'my'; // default My Issues per spec
let dragged = null;
let selectedIssue = null;
let currentWorkflow = ['TODO','IN_PROGRESS','IN_REVIEW','DONE'];

const refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };
const modalProjectSelect = () => document.getElementById('modalProjectSelect');

const populateProjectSelects = () => {
  const selects = [projectSelect, modalProjectSelect()].filter(Boolean);
  selects.forEach(sel => {
    const current = sel.value || activeProjectId;
    sel.textContent = '';
    allProjects.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.key} — ${p.name}`;
      if (String(p.id) === String(current)) opt.selected = true;
      sel.appendChild(opt);
    });
  });
  refreshIcons();
};

const getWorkflowForProject = async (projectId) => {
  if (!projectId) return ['TODO','IN_PROGRESS','IN_REVIEW','DONE'];
  try {
    const proj = await api.get(`/api/projects/${projectId}`);
    if (proj.workflow && Array.isArray(proj.workflow) && proj.workflow.length) return proj.workflow;
    // fallback parse if workflow is string
    if (typeof proj.workflow === 'string') {
      try { const parsed = JSON.parse(proj.workflow); if (Array.isArray(parsed)) return parsed; } catch {}
    }
  } catch {}
  return ['TODO','IN_PROGRESS','IN_REVIEW','DONE'];
};

const renderBoardColumns = (workflow) => {
  currentWorkflow = workflow;
  boardWrap.textContent = '';
  if (!workflow.length) {
    $('#emptyBoard')?.classList.remove('hidden');
    return;
  }
  $('#emptyBoard')?.classList.add('hidden');
  const tpl = document.getElementById('boardColumnTemplate');
  workflow.forEach((status) => {
    const clone = tpl.content.cloneNode(true);
    const col = clone.querySelector('.board-column');
    col.dataset.status = status;
    const nameEl = clone.querySelector('.column-name');
    nameEl.textContent = status.replace(/_/g,' ');
    const countEl = clone.querySelector('.column-count');
    countEl.dataset.count = status;
    const body = clone.querySelector('.column-body');
    body.dataset.col = status;
    boardWrap.appendChild(clone);
  });
  // populate status dropdowns
  const issueStatusSel = document.getElementById('issueStatus');
  if (issueStatusSel) {
    issueStatusSel.textContent = '';
    workflow.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      issueStatusSel.appendChild(opt);
    });
  }
  refreshIcons();
  // re-bind drag for new columns
  bindBoardDrag();
};

const bindBoardDrag = () => {
  $$('.column-body').forEach((col) => {
    if (col.dataset.bound) return;
    col.dataset.bound = 'true';
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault(); col.classList.remove('drag-over');
      if (!dragged) return;
      const issueId = Number(dragged.dataset.issueId);
      const newStatus = col.dataset.col;
      const oldStatus = dragged.dataset.status;
      if (newStatus === oldStatus) return;
      try {
        await api.patch(`/api/issues/${issueId}/status`, { status: newStatus, userId: user.id });
        notify.success(`Moved to ${newStatus.replace(/_/g,' ')}`);
        await loadIssues();
      } catch (err) { notify.error(err.message); }
    });
  });
};

bindModalClose('issueModal');
bindModalClose('detailModal');
$('#createIssueBtn')?.addEventListener('click', () => prepareCreate());

// ---------- Due Date & Time picker (create issue) ----------
let duePicker = null;
const initDuePicker = () => {
  const host = document.getElementById('dueDateTimePicker');
  if (!host) return;
  if (duePicker) { duePicker.destroy(); duePicker = null; }
  duePicker = createDateTimePicker({
    container: host,
    onChange: () => {
      const de = document.getElementById('dueDateError');
      const pe = document.getElementById('duePastError');
      if (de) de.classList.add('hidden');
      if (pe) pe.classList.add('hidden');
      const titleInput = $('#issueTitle');
      if (window.lucide) window.lucide.createIcons();
    }
  });
};

const clearDueErrors = () => {
  document.getElementById('dueDateError')?.classList.add('hidden');
  document.getElementById('duePastError')?.classList.add('hidden');
};

const init = async () => {
  try {
    allProjects = await api.get('/api/projects');
    if (!allProjects.length) {
      projectSelect.textContent = '';
      const opt = document.createElement('option');
      opt.textContent = 'No projects — create one';
      opt.disabled = true;
      opt.selected = true;
      projectSelect.appendChild(opt);
      if (modalProjectSelect()) {
        modalProjectSelect().textContent = '';
        const mOpt = document.createElement('option');
        mOpt.textContent = 'No projects';
        mOpt.disabled = true;
        mOpt.selected = true;
        modalProjectSelect().appendChild(mOpt);
      }
      renderBoardColumns([]);
      return;
    }
    const exists = allProjects.some(p => String(p.id)===String(activeProjectId));
    if (!activeProjectId || !exists) activeProjectId = String(allProjects[0].id);
    populateProjectSelects();
    if (activeProjectId) { projectSelect.value = activeProjectId; if (modalProjectSelect()) modalProjectSelect().value = activeProjectId; localStorage.setItem('activeProjectId', activeProjectId); }
    // load workflow and render columns
    const wf = await getWorkflowForProject(activeProjectId);
    renderBoardColumns(wf);
    await Promise.all([loadMembers(), loadIssues()]);
    initDuePicker();
    watchLiveOverdue();
    startBoardClearTimer();
    modalProjectSelect()?.addEventListener('change', async () => {
      await loadMembersForProject(Number(modalProjectSelect().value));
      // also update status dropdown for that project's workflow
      const w = await getWorkflowForProject(modalProjectSelect().value);
      const sel = document.getElementById('issueStatus');
      if (sel) {
        sel.textContent = '';
        w.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s;
          opt.textContent = s;
          sel.appendChild(opt);
        });
      }
    });
  } catch (e) { notify.error(e.message); }
};

projectSelect?.addEventListener('change', async () => {
  activeProjectId = projectSelect.value;
  localStorage.setItem('activeProjectId', activeProjectId);
  const modalSel = modalProjectSelect();
  if (modalSel) modalSel.value = activeProjectId;
  const wf = await getWorkflowForProject(activeProjectId);
  renderBoardColumns(wf);
  await Promise.all([loadMembers(), loadIssues()]);
});

boardSearch?.addEventListener('input', () => { updateClearFiltersVisibility(); renderBoard(); });
priorityFilter?.addEventListener('change', () => { updateClearFiltersVisibility(); renderBoard(); });
typeFilter?.addEventListener('change', () => { updateClearFiltersVisibility(); renderBoard(); });

const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const updateClearFiltersVisibility = () => {
  const hasActive = boardSearch.value.trim() || priorityFilter.value || typeFilter.value || activeDeadlineFilter !== 'all';
  if (clearFiltersBtn) clearFiltersBtn.style.display = hasActive ? 'flex' : 'none';
};
clearFiltersBtn?.addEventListener('click', () => {
  boardSearch.value = '';
  priorityFilter.value = '';
  typeFilter.value = '';
  $$('.filter-chip').forEach(c => c.classList.remove('active'));
  document.querySelector('.filter-chip[data-filter="all"]')?.classList.add('active');
  activeDeadlineFilter = 'all';
  updateClearFiltersVisibility();
  renderBoard();
});

$$('.filter-chip').forEach((chip) => chip.addEventListener('click', () => {
  $$('.filter-chip').forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
  activeDeadlineFilter = chip.dataset.filter;
  renderBoard();
}));

// Board view toggle: My Issues vs All Issues (default My Issues)
const boardViewBtns = document.querySelectorAll('#boardViewToggle .view-btn');
const updateBoardViewUI = () => {
  boardViewBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view === activeBoardView));
  const detail = document.getElementById('boardSubtitleDetail');
  if (detail) detail.textContent = activeBoardView === 'my' ? 'My assigned work' : 'All authorized issues';
  if (window.lucide) window.lucide.createIcons();
};
boardViewBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    activeBoardView = btn.dataset.view;
    localStorage.setItem('boardView', activeBoardView);
    updateBoardViewUI();
    await loadIssues();
  });
});
updateBoardViewUI();

const urlSearch = new URLSearchParams(location.search).get('search');
if (urlSearch && boardSearch) boardSearch.value = urlSearch;

const loadMembersForProject = async (projectId) => {
  const sel = $('#issueAssignee');
  if (!sel) return;
  sel.textContent = '';
  const def = document.createElement('option');
  def.value = '';
  def.textContent = 'Unassigned';
  sel.appendChild(def);
  if (!projectId) return;
  try {
    // Generic: any registered user available for assignment (per spec)
    const users = await api.get('/api/auth/users');
    users.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.name} • ${u.email}`;
      sel.appendChild(opt);
    });
  } catch (e) { console.warn(e); }
};

const loadMembers = async () => {
  await loadMembersForProject(activeProjectId ? Number(activeProjectId) : null);
};

let allProjectIssues = []; // for banner check

const loadIssues = async () => {
  if (!activeProjectId) { allIssues = []; allProjectIssues = []; renderBoard(); return; }
  try {
    boardSearch.placeholder = 'Loading issues...';
    // Fetch all for project for banner and for All view
    const allForProject = await api.get(`/api/projects/${activeProjectId}/issues`);
    allProjectIssues = allForProject;
    if (activeBoardView === 'my') {
      // Backend must filter for My Issues using authenticated user ID
      try {
        allIssues = await api.get(`/api/issues`, { params: { projectId: activeProjectId, assignee: 'my', userId: user.id } });
      } catch {
        // fallback to client filter if backend fails
        allIssues = allForProject.filter(i => String(i.assigneeId) === String(user.id));
      }
    } else {
      allIssues = allForProject;
    }
    renderBoard();
    // show banner if My Issues empty but All has data
    const banner = document.getElementById('myIssuesBanner');
    if (banner) {
      const showBanner = activeBoardView === 'my' && allIssues.length === 0 && allProjectIssues.length > 0;
      banner.classList.toggle('hidden', !showBanner);
      if (showBanner) {
        banner.querySelector('#switchToAllBtn')?.addEventListener('click', async () => {
          activeBoardView = 'all';
          localStorage.setItem('boardView', 'all');
          document.querySelectorAll('#boardViewToggle .view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === 'all'));
          const detail = document.getElementById('boardSubtitleDetail');
          if (detail) detail.textContent = 'All authorized issues';
          await loadIssues();
          if (window.lucide) window.lucide.createIcons();
        }, { once: true });
      }
      if (window.lucide) window.lucide.createIcons();
    }
  } catch (e) { notify.error(e.message); }
  finally { boardSearch.placeholder = 'Search by key, title, description...'; }
};

const filteredIssues = () => {
  const q = boardSearch.value.trim().toLowerCase();
  const pri = priorityFilter.value;
  const type = typeFilter.value;
  return allIssues.filter((i) => {
    // Board view: My Issues vs All Issues (default My Issues)
    if (activeBoardView === 'my' && String(i.assigneeId) !== String(user.id)) return false;
    if (q && !(i.title.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q) || i.issueKey.toLowerCase().includes(q))) return false;
    if (pri && i.priority !== pri) return false;
    if (type && i.issueType !== type) return false;
    if (activeDeadlineFilter !== 'all') {
      if (activeDeadlineFilter === 'my' && String(i.assigneeId) !== String(user.id)) return false;
      else if (['OVERDUE','DUE_TODAY','UPCOMING','COMPLETED'].includes(activeDeadlineFilter)) {
        const ds = liveStatus(i, new Date());
        if (ds !== activeDeadlineFilter) return false;
      }
    }
    return true;
  });
};

let renderedDeadlineSnapshot = null;
const captureSnapshot = () => { renderedDeadlineSnapshot = deadlineSnapshot(allIssues, new Date()); };

// Centralized ticker: re-render every 30s so both overdue status AND relativeDue ("Due in 1 minute") stay live
const watchLiveOverdue = () => {
  onClockTick(() => {
    renderedDeadlineSnapshot = deadlineSnapshot(allIssues, new Date());
    renderBoard();
  });
};
const APPROVED_GRACE_MS_BOARD = 2 * 60 * 1000;
let boardClearTimer = null;
const startBoardClearTimer = () => {
  if (boardClearTimer) clearInterval(boardClearTimer);
  boardClearTimer = setInterval(() => {
    const now = new Date();
    document.querySelectorAll('.issue-card.completed').forEach(card => {
      const approvedAtStr = card.dataset.approvedAt;
      if (!approvedAtStr) return;
      const approvedAt = new Date(approvedAtStr);
      const remaining = APPROVED_GRACE_MS_BOARD - (now - approvedAt);
      const timerText = card.querySelector('.timer-text');
      const timerFill = card.querySelector('.timer-fill');
      if (remaining <= 0) {
        if (timerText) timerText.textContent = 'Approved';
        if (timerFill) timerFill.style.width = '0%';
      } else {
        if (timerText) {
          const sec = Math.ceil(remaining / 1000);
          timerText.textContent = `Clearing in ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
        }
        if (timerFill) timerFill.style.width = `${(remaining / APPROVED_GRACE_MS_BOARD * 100).toFixed(1)}%`;
      }
    });
  }, 1000);
};

const renderBoard = () => {
  const filtered = filteredIssues();
  // group by workflow statuses
  const byStatus = {};
  currentWorkflow.forEach(s => byStatus[s] = []);
  // also handle any status not in workflow (e.g., old issues)
  filtered.forEach((i) => {
    const s = i.status;
    if (byStatus[s] !== undefined) byStatus[s].push(i);
    else {
      if (!byStatus[s]) byStatus[s] = [];
      byStatus[s].push(i);
      // also create column for unknown status if not in workflow
      if (!currentWorkflow.includes(s)) {
        currentWorkflow.push(s);
        renderBoardColumns(currentWorkflow);
      }
    }
  });

  currentWorkflow.forEach((status) => {
    const col = document.querySelector(`[data-col="${status}"]`);
    const count = document.querySelector(`[data-count="${status}"]`);
    const issues = byStatus[status] || [];
    if (count) count.textContent = issues.length;
    if (!col) return;
    col.textContent = '';
    if (!issues.length) {
      const tpl = document.getElementById('columnEmptyTemplate');
      const clone = tpl.content.cloneNode(true);
      col.appendChild(clone);
    } else {
      issues.forEach((issue) => {
        const card = createIssueCard(issue);
        const isCreator = String(issue.reporterId) === String(user.id);
        const isAssignee = String(issue.assigneeId) === String(user.id);
        const isEditable = user.role === 'ADMIN' || isCreator || isAssignee;
        const canDragStatus = user.role === 'ADMIN' || isCreator || isAssignee;
        const isViewOnly = activeBoardView === 'all' && !isEditable;
        if (isViewOnly) {
          card.style.opacity = '0.9';
          card.style.borderStyle = 'dashed';
          // add VIEW ONLY badge via DOM
          const viewBadge = document.createElement('div');
          viewBadge.textContent = 'VIEW ONLY';
          viewBadge.style.fontSize = '10px';
          viewBadge.style.fontWeight = '700';
          viewBadge.style.letterSpacing = '.06em';
          viewBadge.style.textTransform = 'uppercase';
          viewBadge.style.background = '#f1f5f9';
          viewBadge.style.border = '1px solid #e2e8f0';
          viewBadge.style.color = '#64748b';
          viewBadge.style.padding = '2px 6px';
          viewBadge.style.borderRadius = '6px';
          viewBadge.style.alignSelf = 'flex-start';
          viewBadge.style.marginTop = '6px';
          card.appendChild(viewBadge);
          card.draggable = false;
          card.style.cursor = 'pointer';
        } else {
          card.draggable = true;
          card.addEventListener('dragstart', (e) => { dragged = card; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
          card.addEventListener('dragend', () => { dragged?.classList.remove('dragging'); dragged = null; });
        }
        card.addEventListener('click', () => openDetail(Number(card.dataset.issueId)));
        col.appendChild(card);
      });
    }
  });
  refreshIcons();
  captureSnapshot();
};

const prepareCreate = async () => {
  try {
    if (!allProjects.length) allProjects = await api.get('/api/projects');
    populateProjectSelects();
  } catch {}
  const modalSel = modalProjectSelect();
  const effectiveProjectId = modalSel ? modalSel.value : activeProjectId;
  if (!effectiveProjectId) { notify.error('Create a project first'); return; }
  if (modalSel) {
    modalSel.value = String(activeProjectId || effectiveProjectId);
    await loadMembersForProject(Number(modalSel.value));
    const w = await getWorkflowForProject(modalSel.value);
    const sel = document.getElementById('issueStatus');
    if (sel) {
      sel.textContent = '';
      w.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        sel.appendChild(opt);
      });
    }
  }
  const defaultDue = new Date(); defaultDue.setDate(defaultDue.getDate() + 1);
  defaultDue.setHours(9, 0, 0, 0);
  if (!duePicker) initDuePicker();
  duePicker?.setValue(defaultDue);
  clearDueErrors();
  $('#issueAssignee').value = '';
  const lbl = document.getElementById('issueLabels');
  if (lbl) lbl.value = '';
  const pts = document.getElementById('issuePoints');
  if (pts) pts.value = '';
  const spr = document.getElementById('issueSprint');
  if (spr) spr.value = '';
  openModal('issueModal');
  refreshIcons();
};

$('#issueForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  // Custom validation (no browser-native popup)
  const titleInput = $('#issueTitle');
  const titleError = document.getElementById('titleError');
  const dueError = document.getElementById('dueDateError');
  const duePastError = document.getElementById('duePastError');
  let valid = true;
  if (!titleInput.value.trim()) {
    titleInput.style.borderColor = '#EF4444';
    if (titleError) titleError.classList.remove('hidden');
    valid = false;
  } else {
    titleInput.style.borderColor = '#E2E8F0';
    if (titleError) titleError.classList.add('hidden');
  }
  const dueVal = duePicker ? duePicker.getValue() : null;
  if (!dueVal) {
    if (dueError) dueError.classList.remove('hidden');
    valid = false;
  } else {
    if (dueError) dueError.classList.add('hidden');
    if (duePastError) duePastError.classList.add('hidden');
  }
  if (!valid) return;
  if (dueVal <= new Date()) {
    if (duePastError) duePastError.classList.remove('hidden');
    return;
  }
  // Clear errors on input
  titleInput.addEventListener('input', () => { titleInput.style.borderColor='#E2E8F0'; if(titleError) titleError.classList.add('hidden'); }, { once:true });

  const btn = $('#issueSubmitBtn'); const orig = btn.innerHTML; btn.innerHTML='<i data-lucide="loader-2" style="width:16px;height:16px;animation:spin 1s linear infinite"></i> Creating...'; btn.disabled=true;
  if (window.lucide) window.lucide.createIcons();
  try {
    const modalSel = modalProjectSelect();
    const selectedProjectId = modalSel ? Number(modalSel.value) : Number(activeProjectId);
    if (!selectedProjectId) throw new Error('Select a project');
    const payload = {
      projectId: selectedProjectId,
      title: titleInput.value.trim(),
      description: $('#issueDesc').value.trim(),
      issueType: $('#issueType').value,
      priority: $('#issuePriority').value,
      status: $('#issueStatus').value,
      assigneeId: $('#issueAssignee').value ? Number($('#issueAssignee').value) : null,
      reporterId: user.id,
      dueDate: toLocalISO(dueVal),
      labels: document.getElementById('issueLabels')?.value.trim() || null,
      storyPoints: document.getElementById('issuePoints')?.value ? Number(document.getElementById('issuePoints').value) : null,
      sprint: document.getElementById('issueSprint')?.value.trim() || null,
      components: null
    };
    const created = await api.post('/api/issues', payload);
    notify.success(`Issue ${created.issueKey} created in ${created.projectKey}`);
    closeModal('issueModal');
    e.target.reset();
    const defD = new Date(); defD.setDate(defD.getDate() + 1); defD.setHours(9,0,0,0);
    duePicker?.setValue(defD);
    clearDueErrors();
    if (String(selectedProjectId) !== String(activeProjectId)) {
      activeProjectId = String(selectedProjectId);
      localStorage.setItem('activeProjectId', activeProjectId);
      projectSelect.value = activeProjectId;
      if (modalSel) modalSel.value = activeProjectId;
      const wf = await getWorkflowForProject(activeProjectId);
      renderBoardColumns(wf);
      await Promise.all([loadMembers(), loadIssues()]);
    } else {
      await loadIssues();
    }
  } catch (err) { notify.error(err.message); }
  finally { btn.textContent=orig; btn.disabled=false; }
});

const openDetail = async (issueId) => {
  try {
    const issue = await api.get(`/api/issues/${issueId}`);
    selectedIssue = issue;
    $('#detailTitle').textContent = issue.issueKey;
    $('#detailIssueTitle').textContent = issue.title;
    const descEl = $('#detailDesc');
    descEl.textContent = issue.description || 'No description provided.';
    descEl.style.cssText = 'font-size:14px;color:#334155;line-height:1.6;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:10px;min-height:60px';

    const ds = liveStatus(issue, new Date());
    const badges = $('#detailBadges');
    badges.textContent = '';
    const mkBadge = (text, cls) => {
      const s = document.createElement('span');
      s.textContent = text;
      s.className = cls;
      return s;
    };
    badges.append(mkBadge(issue.issueKey, 'issue-key'), mkBadge(issue.issueType, `issue-type-badge type-${issue.issueType}`), mkBadge(issue.priority, `priority-badge pri-${issue.priority}`), mkBadge(ds, `deadline-badge deadline-${ds}`));
    badges.style.display = 'flex';
    badges.style.gap = '8px';
    badges.style.flexWrap = 'wrap';
    badges.style.alignItems = 'center';

    const actions = $('#detailActions');
    actions.textContent = '';
    actions.style.display = 'flex';
    actions.style.gap = '12px';
    actions.style.flexWrap = 'wrap';
    const wf = await getWorkflowForProject(issue.projectId);
    const isCreator = String(issue.reporterId) === String(user.id) || user.role === 'ADMIN';
    let prioritySel = null, assigneeSel = null, statusSel = null, saveBtn = null, delBtn = null;
    if (isCreator) {
      prioritySel = document.createElement('select'); prioritySel.id='detailPriority'; prioritySel.className='form-select'; prioritySel.style.maxWidth='140px';
      ['LOW','MEDIUM','HIGH','CRITICAL'].forEach(v=> { const o=document.createElement('option'); o.textContent=v; o.value=v; if(v===issue.priority) o.selected=true; prioritySel.appendChild(o);});
      assigneeSel = document.createElement('select'); assigneeSel.id='detailAssignee'; assigneeSel.className='form-select'; assigneeSel.style.maxWidth='160px';
      const defOpt = document.createElement('option'); defOpt.value=''; defOpt.textContent='Unassigned'; assigneeSel.appendChild(defOpt);
      statusSel = document.createElement('select'); statusSel.id='detailStatus'; statusSel.className='form-select'; statusSel.style.maxWidth='160px';
      wf.forEach(v=> { const o=document.createElement('option'); o.textContent=v; o.value=v; if(v===issue.status) o.selected=true; statusSel.appendChild(o);});
      if (!wf.includes(issue.status)) {
        const o=document.createElement('option'); o.textContent=issue.status; o.value=issue.status; o.selected=true; statusSel.appendChild(o);
      }
      saveBtn = document.createElement('button'); saveBtn.id='detailSave'; saveBtn.className='btn btn-ghost btn-sm'; saveBtn.textContent='Update';
      delBtn = document.createElement('button'); delBtn.id='detailDelete'; delBtn.className='btn btn-ghost btn-sm'; delBtn.textContent='Delete'; delBtn.style.color='#dc2626'; delBtn.style.borderColor='#fecaca';
      actions.append(prioritySel, assigneeSel, statusSel, saveBtn, delBtn);
    } else {
      const ro = (label, value) => {
        const wrap = document.createElement('div');
        wrap.style.display='flex'; wrap.style.flexDirection='column'; wrap.style.gap='2px'; wrap.style.minWidth='110px';
        const l = document.createElement('span'); l.textContent=label; l.style.fontSize='10px'; l.style.fontWeight='700'; l.style.letterSpacing='.06em'; l.style.textTransform='uppercase'; l.style.color='#94a3b8';
        const v = document.createElement('span'); v.textContent=value; v.style.fontWeight='600'; v.style.fontSize='13px'; v.style.color='#0f172a';
        wrap.append(l, v); return wrap;
      };
      actions.append(ro('Priority', issue.priority || 'MEDIUM'), ro('Assignee', issue.assigneeName || 'Unassigned'), ro('Status', issue.status || 'TODO'));
    }

    const sidebar = $('#detailSidebar');
    sidebar.textContent = '';
    const addField = (label, value) => {
      const wrap = document.createElement('div'); wrap.className='detail-field';
      const lbl = document.createElement('span'); lbl.className='detail-label'; lbl.textContent=label;
      const val = document.createElement('span'); val.className='detail-value'; val.textContent=value;
      wrap.append(lbl,val); sidebar.appendChild(wrap);
    };
    addField('Assignee', issue.assigneeName || 'Unassigned');
    addField('Reporter', issue.reporterName || user.name);
    addField('Project', `${issue.projectKey} • ${issue.projectName}`);
    if (issue.labels) addField('Labels', issue.labels);
    if (issue.storyPoints) addField('Story Points', String(issue.storyPoints));
    if (issue.sprint) addField('Sprint', issue.sprint);
    {
      const wrap = document.createElement('div'); wrap.className='detail-field';
      const lbl = document.createElement('span'); lbl.className='detail-label'; lbl.textContent='Due Date & Time';
      const valWrap = document.createElement('div'); valWrap.style.display='flex'; valWrap.style.alignItems='center'; valWrap.style.gap='6px';
      const val = document.createElement('span'); val.className='detail-value'; val.textContent=formatDateTime(issue.dueDate);
      const badge = document.createElement('span'); badge.className=`deadline-badge deadline-${ds}`; badge.textContent=ds;
      valWrap.append(val,badge); wrap.append(lbl,valWrap); sidebar.appendChild(wrap);
    }
    if (issue.completedDate) {
      const wrap = document.createElement('div'); wrap.className='detail-field';
      const lbl = document.createElement('span'); lbl.className='detail-label'; lbl.textContent='Completed';
      const val = document.createElement('span'); val.className='detail-value'; val.textContent=`${formatDate(issue.completedDate)} • ${issue.completionLabel}`;
      val.style.color = issue.completionLabel?.includes('late') ? '#dc2626' : '#059669';
      val.style.fontWeight='700';
      wrap.append(lbl,val); sidebar.appendChild(wrap);
    }
    addField('Created', formatDate(issue.createdAt));
    addField('Updated', timeAgo(issue.updatedAt));
    if (ds==='OVERDUE') {
      const warn = document.createElement('div');
      warn.textContent = `Overdue — Due ${formatDateTime(issue.dueDate)}`;
      warn.style.cssText='background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:8px;border-radius:8px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px';
      const icon = document.createElement('i'); icon.setAttribute('data-lucide','alert-triangle'); icon.style.width='14px'; icon.style.height='14px';
      warn.prepend(icon);
      sidebar.appendChild(warn);
    }
    if (ds==='DUE_TODAY') {
      const warn = document.createElement('div');
      warn.textContent = `Due today at ${formatTime(issue.dueDate)}`;
      warn.style.cssText='background:#fffbeb;border:1px solid #fde68a;color:#b45309;padding:8px;border-radius:8px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px';
      const icon = document.createElement('i'); icon.setAttribute('data-lucide','clock-3'); icon.style.width='14px'; icon.style.height='14px';
      warn.prepend(icon);
      sidebar.appendChild(warn);
    }
    refreshIcons();

    if (isCreator) {
      try {
        const users = await api.get(`/api/auth/users`);
        users.forEach((u) => {
          const o = document.createElement('option');
          o.value = u.id;
          o.textContent = `${u.name} • ${u.email}`;
          if (String(u.id)===String(issue.assigneeId)) o.selected=true;
          assigneeSel.appendChild(o);
        });
      } catch {}

      saveBtn.addEventListener('click', async () => {
        try {
          await api.put(`/api/issues/${issue.id}`, {
            priority: prioritySel.value,
            assigneeId: assigneeSel.value ? Number(assigneeSel.value) : null,
            status: statusSel.value,
            title: issue.title,
            description: issue.description,
            issueType: issue.issueType,
            dueDate: issue.dueDate
          }, { params: { userId: user.id } });
          notify.success('Issue updated');
          closeModal('detailModal');
          await loadIssues();
        } catch (err) { notify.error(err.message); }
      });
      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this issue?')) return;
        try { await api.del(`/api/issues/${issue.id}`, { params: { userId: user.id } }); notify.success('Issue deleted'); closeModal('detailModal'); await loadIssues(); } catch (err) { notify.error(err.message); }
      });
    }

    loadComments(issue.id);
    loadActivity(issue.id);
    openModal('detailModal');
  } catch (e) { notify.error(e.message); }
};

const loadComments = async (issueId) => {
  const list = $('#commentList');
  const countEl = $('#commentCount');
  list.textContent = '';
  try {
    const comments = await api.get(`/api/issues/${issueId}/comments`);
    countEl.textContent = `${comments.length} comments`;
    if (!comments.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No comments yet. Be first!';
      empty.style.cssText='color:#94a3b8;font-size:13px;text-align:center;padding:12px';
      list.appendChild(empty);
      return;
    }
    const tpl = document.getElementById('commentTemplate');
    comments.forEach((c) => {
      const clone = tpl.content.cloneNode(true);
      clone.querySelector('.avatar-sm').textContent = initials(c.userName);
      clone.querySelector('.comment-author').textContent = c.userName;
      clone.querySelector('.comment-time').textContent = timeAgo(c.createdAt);
      clone.querySelector('.comment-body').textContent = c.content;
      list.appendChild(clone);
    });
  } catch (e) {
    const err = document.createElement('div');
    err.textContent = e.message;
    err.style.color='#dc2626';
    err.style.fontSize='13px';
    list.appendChild(err);
  }
};

const loadActivity = async (issueId) => {
  const list = $('#activityList');
  list.textContent = '';
  try {
    const acts = await api.get(`/api/issues/${issueId}/activity`);
    if (!acts.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No activity yet';
      empty.style.color='#94a3b8';
      empty.style.fontSize='13px';
      list.appendChild(empty);
      return;
    }
    const tpl = document.getElementById('activityTemplate');
    acts.forEach((a) => {
      const clone = tpl.content.cloneNode(true);
      clone.querySelector('.activity-details').textContent = a.details;
      clone.querySelector('.activity-time').textContent = `${a.userName} • ${timeAgo(a.createdAt)}`;
      list.appendChild(clone);
    });
  } catch (e) {
    const err = document.createElement('div');
    err.textContent = e.message;
    err.style.color='#dc2626';
    list.appendChild(err);
  }
};

$('#commentForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = $('#commentInput').value.trim();
  if (!content || !selectedIssue) return;
  try {
    await api.post(`/api/issues/${selectedIssue.id}/comments`, { content, userId: user.id });
    $('#commentInput').value='';
    notify.success('Comment added');
    await loadComments(selectedIssue.id);
    await loadActivity(selectedIssue.id);
    await loadIssues();
  } catch (err) { notify.error(err.message); }
});

init();
