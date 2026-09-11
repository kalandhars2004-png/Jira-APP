import { auth } from '../core/auth.js';
import { api } from '../core/api.js';
import { initSidebar } from '../components/sidebar.js';
import { initTopnav } from '../components/navbar.js';
import { notify } from '../components/toast.js';
import { formatDate, formatDateShort, formatDateTime, formatTime, timeAgo } from '../utils/formatters.js';
import { calculateDeadlineStatus, liveStatus } from '../utils/deadline.js';

const isReviewStatus = (s) => {
  if (!s) return false;
  const u = String(s).toUpperCase();
  return u === 'REVIEW' || u === 'IN_REVIEW' || u.includes('REVIEW');
};
const isReviewOrDoneStatus = (s) => {
  if (!s) return false;
  const u = String(s).toUpperCase();
  return isReviewStatus(s) || u === 'DONE' || u === 'COMPLETED';
};

const user = auth.requireAuth();
initSidebar('review');
initTopnav({ title: 'Review', subtitle: '' });

const $ = (s) => document.querySelector(s);
const projectSelect = $('#projectSelect');
const reviewList = $('#reviewList');
const reviewDetail = $('#reviewDetail');
const leftPane = $('#leftPane');
const rightPane = $('#rightPane');
const reviewCount = $('#reviewCount');

let allIssues = [];
let filteredIssues = [];
let activeProjectId = localStorage.getItem('activeProjectId');
let selectedId = null;
let activeReviewView = localStorage.getItem('reviewView') || 'my'; // my = reporter is current user (auto-trigger)

const init = async () => {
  try {
    const projects = await api.get('/api/projects');
    projectSelect.textContent = '';
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = 'All Projects';
    projectSelect.appendChild(allOpt);
    projects.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.key} — ${p.name}`;
      if (String(p.id) === String(activeProjectId)) opt.selected = true;
      projectSelect.appendChild(opt);
    });
    if (activeProjectId) { projectSelect.value = activeProjectId; localStorage.setItem('activeProjectId', activeProjectId); }
    else { projectSelect.value = ''; }
    await load();
  } catch (e) { notify.error(e.message); }
};

projectSelect?.addEventListener('change', async () => {
  activeProjectId = projectSelect.value;
  if (activeProjectId) localStorage.setItem('activeProjectId', activeProjectId);
  else localStorage.removeItem('activeProjectId');
  await load();
});

// Review view toggle: My Reviews (reporter is me) vs All
const reviewViewBtns = document.querySelectorAll('#reviewViewToggle .view-btn');
const updateReviewViewUI = () => {
  reviewViewBtns.forEach(b => b.classList.toggle('active', b.dataset.view === activeReviewView));
  if (window.lucide) window.lucide.createIcons();
};
reviewViewBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    activeReviewView = btn.dataset.view;
    localStorage.setItem('reviewView', activeReviewView);
    updateReviewViewUI();
    await load();
  });
});
updateReviewViewUI();

const getFilteredForView = () => {
  if (activeReviewView === 'my') {
    // My Reviews: issues I CREATED that are now in REVIEW (creator-aware per spec)
    // WHERE status contains REVIEW AND reporterId === currentUser.id
    return allIssues.filter(i => String(i.reporterId) === String(user.id));
  }
  return allIssues;
};

const renderFiltered = () => {
  filteredIssues = getFilteredForView();
  renderList(filteredIssues);
  if (filteredIssues[0] && !selectedId) selectIssue(filteredIssues[0].id);
  else if (selectedId && filteredIssues.find(i=> String(i.id)===String(selectedId))) selectIssue(selectedId);
  else if (filteredIssues[0]) selectIssue(filteredIssues[0].id);
  else { selectedId = null; document.getElementById('reviewDetail')?.classList.add('hidden'); }
};

const load = async () => {
  try {
    if (activeReviewView === 'my') {
      // Creator-aware backend query: WHERE status is review-like/DONE AND reporterId = currentUser
      // Covers: when jira moved to DONE or REVIEW, creator's review shows it
      try {
        const params = activeProjectId ? { projectId: activeProjectId } : {};
        allIssues = await api.get('/api/issues/review', { params });
      } catch {
        // fallback to client-side filtering if endpoint unavailable
        const issues = activeProjectId ? await api.get(`/api/projects/${activeProjectId}/issues`) : await api.get('/api/issues');
        allIssues = issues.filter(i => isReviewOrDoneStatus(i.status) && String(i.reporterId) === String(user.id));
      }
    } else {
      const issues = activeProjectId ? await api.get(`/api/projects/${activeProjectId}/issues`) : await api.get('/api/issues');
      allIssues = issues.filter(i => isReviewOrDoneStatus(i.status));
    }
    renderFiltered();
  } catch (e) { notify.error(e.message); }
};

const renderList = (issues) => {
  const has = issues.length;
  reviewCount.textContent = has ? `REVIEW REQUESTS · ${has}` : 'No issues awaiting review';
  reviewCount.classList.toggle('has-pending', has>0);
  reviewList.textContent = '';
  const queueHint = $('#queueHint');
  if (queueHint) queueHint.textContent = has ? `${has} in queue` : '—';
  if (!issues.length) {
    $('#emptyReview')?.classList.remove('hidden');
    reviewDetail?.classList.add('hidden');
    return;
  }
  $('#emptyReview')?.classList.add('hidden');
  const tpl = document.getElementById('reviewCardTemplate');
  issues.forEach((issue) => {
    const clone = tpl.content.cloneNode(true);
    const card = clone.querySelector('.review-card');
    card.dataset.id = issue.id;
    card.setAttribute('aria-selected', String(issue.id)===String(selectedId));
    if (String(issue.id) === String(selectedId)) card.classList.add('active');
    clone.querySelector('.review-issue-key').textContent = issue.issueKey;
    clone.querySelector('.review-card-title').textContent = issue.title;
    const pri = clone.querySelector('.priority-badge');
    pri.textContent = issue.priority;
    pri.className = `priority-badge pri-${issue.priority}`;
    const typeBadge = clone.querySelector('.issue-type-badge');
    if (typeBadge) { typeBadge.textContent = issue.issueType; typeBadge.className = `issue-type-badge type-${issue.issueType}`; }
    // Creator-aware display per spec
    const isCreator = String(issue.reporterId) === String(user.id);
    const createdByEl = clone.querySelector('.review-reporter');
    if (createdByEl) createdByEl.textContent = isCreator ? 'You' : (issue.reporterName || '-');
    // Assignee still useful
    const assigneeEl = clone.querySelector('.review-assignee');
    if (assigneeEl) assigneeEl.textContent = issue.assigneeName || 'Unassigned';
    // Moved to Review by
    const movedByEl = clone.querySelector('.review-moved-by');
    if (movedByEl) movedByEl.textContent = issue.movedToReviewByName || (issue.movedToReviewBy ? `User ${issue.movedToReviewBy}` : '—');
    const movedAtEl = clone.querySelector('.review-moved-at');
    if (movedAtEl) movedAtEl.textContent = issue.movedToReviewAt ? formatDateTime(issue.movedToReviewAt) : (issue.movedToReviewAt === null && isReviewStatus(issue.status) ? '—' : formatDate(issue.updatedAt));
    const dueEl = clone.querySelector('.review-due');
    const ds = liveStatus(issue, new Date());
    const dueText = formatDateShort(issue.dueDate);
    dueEl.textContent = dueText;
    dueEl.classList.remove('overdue','soon','ok');
    if (ds === 'OVERDUE') { dueEl.classList.add('overdue'); dueEl.textContent = `${dueText} • Overdue`; }
    else if (ds === 'DUE_TODAY') { dueEl.classList.add('soon'); dueEl.textContent = `${dueText} • Due today`; }
    else dueEl.classList.add('ok');
    const statusEl = clone.querySelector('.review-status');
    if (statusEl) statusEl.textContent = issue.status;
    // 2-min timer for approved — only when approved then show
    const timerEl = clone.querySelector('.clear-timer');
    const timerBar = clone.querySelector('.timer-bar');
    if (timerEl && timerBar) {
      const isDone = String(issue.status).toUpperCase() === 'DONE' || String(issue.status).toUpperCase() === 'COMPLETED' || issue.deadlineStatus === 'COMPLETED';
      if (isDone && issue.updatedAt) {
        const approvedAt = new Date(issue.updatedAt);
        const remaining = 120000 - (new Date() - approvedAt);
        if (remaining > 0 && remaining <= 120000) {
          timerEl.classList.remove('hidden');
          timerEl.style.display = 'flex';
          timerBar.classList.remove('hidden');
          timerBar.style.display = 'block';
          const timerText = timerEl.querySelector('.timer-text');
          if (timerText) {
            const sec = Math.ceil(remaining / 1000);
            timerText.textContent = `Clearing in ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
          }
          const timerFill = timerBar.querySelector('.timer-fill');
          if (timerFill) timerFill.style.width = `${(remaining / 120000 * 100).toFixed(1)}%`;
          card.dataset.approvedAt = approvedAt.toISOString();
        } else {
          timerEl.classList.add('hidden');
          timerBar.classList.add('hidden');
        }
      } else {
        timerEl.classList.add('hidden');
        timerBar.classList.add('hidden');
      }
    }

    const onSelect = () => selectIssue(issue.id);
    card.addEventListener('click', onSelect);
    card.addEventListener('keydown', (e) => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); onSelect(); } });
    reviewList.appendChild(clone);
  });
};

const selectIssue = async (id) => {
  selectedId = id;
  document.querySelectorAll('.review-card').forEach(c => {
    const isActive = String(c.dataset.id)===String(id);
    c.classList.toggle('active', isActive);
    c.setAttribute('aria-selected', isActive);
  });
  const issue = allIssues.find(i => String(i.id)===String(id));
  if (!issue) {
    try { const fresh = await api.get(`/api/issues/${id}`); renderDetail(fresh); } catch { return; }
    return;
  }
  renderDetail(issue);
  try {
    const full = await api.get(`/api/issues/${id}`);
    renderDetail(full);
    const [activity, comments] = await Promise.all([
      api.get(`/api/issues/${id}/activity`).catch(()=>[]),
      api.get(`/api/issues/${id}/comments`).catch(()=>[])
    ]);
    renderChanges(activity, comments, full);
  } catch (e) { notify.error(e.message); }
};

const renderDetail = (issue) => {
  reviewDetail.classList.remove('hidden');
  const keyEl = $('#detailKey');
  if (keyEl) keyEl.textContent = issue.issueKey;
  const titleEl = $('#detailTitle');
  if (titleEl) titleEl.textContent = issue.title;

  const ds = issue.deadlineStatus || calculateDeadlineStatus(issue.dueDate, issue.status);
  const dlBadge = $('#detailDeadline');
  if (dlBadge) {
    dlBadge.textContent = ds === 'COMPLETED' ? (issue.completionLabel || 'COMPLETED') : ds;
    dlBadge.className = `deadline-badge deadline-${ds}`;
    dlBadge.classList.remove('hidden');
    // due-date styling
    if (ds === 'OVERDUE') { dlBadge.style.background='#fef2f2'; dlBadge.style.color='#991b1b'; dlBadge.style.borderColor='#fecaca'; }
    else if (ds === 'DUE_TODAY') { dlBadge.style.background='#fffbeb'; dlBadge.style.color='#92400e'; dlBadge.style.borderColor='#fde68a'; }
  }
  const priBadge = $('#detailPriority');
  if (priBadge) { priBadge.textContent = issue.priority; priBadge.className = `priority-badge pri-${issue.priority}`; priBadge.classList.remove('hidden'); }
  const typeBadge = $('#detailType');
  if (typeBadge) { typeBadge.textContent = issue.issueType; typeBadge.className = `issue-type-badge type-${issue.issueType}`; typeBadge.classList.remove('hidden'); }

  // status progress
  const steps = ['TODO','IN_PROGRESS','DONE','IN_REVIEW','APPROVED'];
  const currentIdx = steps.indexOf(issue.status) !== -1 ? steps.indexOf(issue.status) : 3;
  document.querySelectorAll('.status-step').forEach((el, idx) => {
    el.classList.remove('active','done');
    if (idx < currentIdx) el.classList.add('done');
    if (idx === currentIdx) el.classList.add('active');
  });

  // grid — creator-aware per spec
  leftPane.textContent = '';
  const isCreatorDetail = String(issue.reporterId) === String(user.id);
  const gridData = [
    { label: 'Type', value: issue.issueType },
    { label: 'Priority', value: issue.priority, isBadge: true },
    { label: 'Status', value: issue.status },
    { label: 'Assignee', value: issue.assigneeName || 'Unassigned' },
    { label: 'Created by', value: isCreatorDetail ? 'You' : (issue.reporterName || '-') },
    { label: 'Moved to Review by', value: issue.movedToReviewByName || (issue.movedToReviewBy ? `User ${issue.movedToReviewBy}` : '—') },
    { label: 'Moved on', value: issue.movedToReviewAt ? formatDateTime(issue.movedToReviewAt) : '—' },
    { label: 'Project', value: `${issue.projectKey || ''} ${issue.projectName || ''}`.trim() || '-' },
    { label: 'Due Date & Time', value: `${formatDateTime(issue.dueDate)} • ${ds}` },
    { label: 'Created', value: formatDate(issue.createdAt) },
  ];
  gridData.forEach(({label,value,isBadge}) => {
    const wrap = document.createElement('div');
    wrap.className = 'detail-field';
    const lbl = document.createElement('div');
    lbl.className = 'detail-label';
    lbl.textContent = label;
    const val = document.createElement('div');
    val.className = 'detail-value';
    if (isBadge && label==='Priority') {
      val.className = `priority-badge pri-${value}`;
      val.textContent = value;
      val.style.display='inline-flex';
      val.style.width='fit-content';
    } else {
      val.textContent = value;
    }
    wrap.append(lbl, val);
    leftPane.appendChild(wrap);
  });

  const descEl = $('#detailDesc');
  if (descEl) descEl.textContent = issue.description || 'No description provided.';

  rightPane.textContent = '';
  const loading = document.createElement('div');
  loading.textContent = 'Loading changes…';
  loading.style.color='#94a3b8';
  loading.style.fontSize='12px';
  loading.style.padding='10px';
  rightPane.appendChild(loading);

  // Creator-only approve/reject UI per spec — hide for non-creator (view only)
  const actionsEl = document.querySelector('.review-actions');
  if (actionsEl) {
    const canApprove = isCreatorDetail || user.role === 'ADMIN';
    actionsEl.style.display = canApprove ? '' : 'none';
    let roNote = document.getElementById('reviewReadOnlyNote');
    if (!canApprove) {
      if (!roNote) {
        roNote = document.createElement('div');
        roNote.id = 'reviewReadOnlyNote';
        roNote.style.background='#f1f5f9'; roNote.style.border='1px solid #e2e8f0'; roNote.style.color='#475569'; roNote.style.padding='8px 12px'; roNote.style.borderRadius='8px'; roNote.style.fontSize='12px'; roNote.style.fontWeight='600'; roNote.style.display='flex'; roNote.style.alignItems='center'; roNote.style.gap='8px'; roNote.style.marginTop='10px';
        roNote.innerHTML = '<i data-lucide="eye" style="width:14px;height:14px"></i> View only — only the creator can approve or reassign';
        actionsEl.after(roNote);
        if (window.lucide) window.lucide.createIcons();
      } else roNote.style.display = 'flex';
    } else if (roNote) roNote.style.display = 'none';
  }
};

const renderChanges = (activity, comments) => {
  rightPane.textContent = '';
  const all = [
    ...activity.map(a => ({ kind:'activity', details:a.details, time:a.createdAt, user:a.userName, action:a.action })),
    ...comments.map(c => ({ kind:'comment', details:`${c.userName}: ${c.content}`, time:c.createdAt, user:c.userName }))
  ].sort((a,b) => new Date(b.time) - new Date(a.time));

  if (!all.length) {
    const empty = document.createElement('div');
    empty.textContent = 'No changes yet';
    empty.style.color='#94a3b8';
    empty.style.fontSize='12px';
    empty.style.padding='10px';
    empty.style.border='1px dashed #e2e8f0';
    empty.style.borderRadius='8px';
    empty.style.textAlign='center';
    rightPane.appendChild(empty);
    return;
  }

  const sent = activity.find(a => {
    const d = (a.details || '').toUpperCase();
    return d.includes('REVIEW') || d.includes('IN_REVIEW');
  });
  if (sent) {
    const who = document.createElement('div');
    who.style.background='#fffbeb';
    who.style.border='1px solid #fde68a';
    who.style.padding='8px 10px';
    who.style.borderRadius='8px';
    who.style.fontSize='12px';
    who.style.fontWeight='700';
    who.textContent = `Sent for review: ${sent.details}`;
    rightPane.appendChild(who);
  }

  const tpl = document.getElementById('changeItemTemplate');
  all.slice(0, 30).forEach((item) => {
    const clone = tpl.content.cloneNode(true);
    const itemEl = clone.querySelector('.timeline-item');
    if (item.kind==='comment') itemEl.classList.add('comment');
    else if (item.details?.includes('→') || item.details?.includes('moved')) itemEl.classList.add('moved');
    else if (item.details?.toLowerCase().includes('completed')) itemEl.classList.add('approved');
    clone.querySelector('.change-details').textContent = item.details;
    clone.querySelector('.change-time').textContent = `${item.user || 'System'} • ${timeAgo(item.time)} • ${formatDate(item.time)}`;
    rightPane.appendChild(clone);
  });
};

// Confirm dialogs — HTML only, JS handles open/close without changing API
const approveConfirm = $('#approveConfirm');
const rejectConfirm = $('#rejectConfirm');
const openConfirm = (el) => el?.classList.add('open');
const closeConfirm = (el) => el?.classList.remove('open');

$('#approveBtn')?.addEventListener('click', () => {
  if (!selectedId) return;
  openConfirm(approveConfirm);
});
$('#rejectBtn')?.addEventListener('click', () => {
  if (!selectedId) return;
  const comment = $('#reviewComment').value.trim();
  if (!comment) { notify.error('Add a comment for reject'); $('#reviewComment').focus(); return; }
  openConfirm(rejectConfirm);
});

$('#approveCancel')?.addEventListener('click', () => closeConfirm(approveConfirm));
$('#rejectCancel')?.addEventListener('click', () => closeConfirm(rejectConfirm));
approveConfirm?.addEventListener('click', (e) => { if (e.target===approveConfirm) closeConfirm(approveConfirm); });
rejectConfirm?.addEventListener('click', (e) => { if (e.target===rejectConfirm) closeConfirm(rejectConfirm); });

$('#approveConfirmBtn')?.addEventListener('click', async () => {
  if (!selectedId) return;
  const issueForCheck = allIssues.find(i=> String(i.id)===String(selectedId));
  if (issueForCheck && String(issueForCheck.reporterId) !== String(user.id) && user.role !== 'ADMIN') {
    notify.error('Only the creator can approve this issue');
    return;
  }
  closeConfirm(approveConfirm);
  const comment = $('#reviewComment').value.trim();
  const btn = $('#approveBtn');
  const orig = btn.textContent;
  btn.textContent = 'Approving…'; btn.disabled=true;
  try {
    if (comment) await api.post(`/api/issues/${selectedId}/comments`, { content: comment, userId: user.id });
    let target = 'DONE';
    try {
      const issue = allIssues.find(i=> String(i.id)===String(selectedId));
      if (issue) {
        const proj = await api.get(`/api/projects/${issue.projectId}`);
        const wf = proj.workflow && Array.isArray(proj.workflow) ? proj.workflow : (typeof proj.workflow === 'string' ? JSON.parse(proj.workflow) : []);
        if (wf.length) target = wf[wf.length - 1];
      }
    } catch {}
    await api.patch(`/api/issues/${selectedId}/status`, { status: target, userId: user.id });
    notify.success(`Approved → moved to ${target}`);
    $('#reviewComment').value = '';
    await load();
  } catch (e) { notify.error(e.message); }
  finally { btn.textContent=orig; btn.disabled=false; }
});

$('#rejectConfirmBtn')?.addEventListener('click', async () => {
  if (!selectedId) return;
  const issueForCheck2 = allIssues.find(i=> String(i.id)===String(selectedId));
  if (issueForCheck2 && String(issueForCheck2.reporterId) !== String(user.id) && user.role !== 'ADMIN') {
    notify.error('Only the creator can reject this issue');
    return;
  }
  closeConfirm(rejectConfirm);
  const comment = $('#reviewComment').value.trim();
  if (!comment) { notify.error('Add a comment for reject'); return; }
  const btn = $('#rejectBtn');
  const orig = btn.textContent;
  btn.textContent = 'Rejecting…'; btn.disabled=true;
  try {
    const issue = allIssues.find(i=> String(i.id)===String(selectedId)) || await api.get(`/api/issues/${selectedId}`);
    await api.post(`/api/issues/${selectedId}/comments`, { content: `Rejected: ${comment}`, userId: user.id });
    // Pick appropriate previous state: prefer IN_PROGRESS, else previous workflow step before REVIEW, else TODO
    let target = 'IN_PROGRESS';
    try {
      const proj = await api.get(`/api/projects/${issue.projectId}`);
      const wf = proj.workflow && Array.isArray(proj.workflow) ? proj.workflow : (typeof proj.workflow === 'string' ? JSON.parse(proj.workflow) : []);
      if (!wf.includes(target)) {
        const reviewIdx = wf.findIndex(s => isReviewStatus(s));
        if (reviewIdx > 0) target = wf[reviewIdx - 1];
        else if (wf.length) target = wf[0];
      }
    } catch {}
    await api.patch(`/api/issues/${selectedId}/status`, { status: target, userId: user.id });
    if (issue.assigneeId) {
      await api.patch(`/api/issues/${selectedId}/assignee`, { assigneeId: issue.assigneeId, userId: user.id }).catch(()=>{});
    }
    notify.success(`Rejected & reassigned to ${issue.assigneeName || 'assignee'} for rework`);
    $('#reviewComment').value = '';
    await load();
  } catch (e) { notify.error(e.message); }
  finally { btn.textContent=orig; btn.disabled=false; }
});

let reviewClearTimer = null;
const startReviewClearTimer = () => {
  if (reviewClearTimer) clearInterval(reviewClearTimer);
  reviewClearTimer = setInterval(() => {
    const now = new Date();
    document.querySelectorAll('.review-card').forEach(card => {
      const approvedAtStr = card.dataset.approvedAt;
      if (!approvedAtStr) return;
      const approvedAt = new Date(approvedAtStr);
      const remaining = 120000 - (now - approvedAt);
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
        if (timerFill) timerFill.style.width = `${(remaining / 120000 * 100).toFixed(1)}%`;
      }
    });
  }, 1000);
};
init().then(() => startReviewClearTimer());
