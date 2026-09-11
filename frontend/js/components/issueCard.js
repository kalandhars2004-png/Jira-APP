import { formatDateShort, initials, formatDateTime, formatTime } from '../utils/formatters.js';
import { liveStatus, dueDisplayText } from '../utils/deadline.js';

// ES6+ — arrow functions, destructuring, optional chaining
const getBadgeIcon = (ds) => {
  if (ds === 'OVERDUE') return '⚠';
  if (ds === 'DUE_TODAY') return '◷';
  if (ds === 'COMPLETED') return '✓';
  return '○';
};

const isOnTime = (issue) => {
  if (!issue?.dueDate || !issue?.completedDate) return true;
  return new Date(issue.completedDate) <= new Date(issue.dueDate);
};

const buildCard = (issue, tpl) => {
  const ds = liveStatus(issue, new Date());
  const cardClass = ds === 'OVERDUE' ? 'overdue' : ds === 'DUE_TODAY' ? 'due-today' : ds === 'COMPLETED' ? 'completed' : 'upcoming';

  if (tpl) {
    const clone = tpl.content.cloneNode(true);
    const card = clone.querySelector('.issue-card');
    card.classList.add(cardClass);
    card.dataset.issueId = issue.id;
    card.dataset.status = issue.status;
    card.draggable = true;
    clone.querySelector('.issue-key').textContent = issue.issueKey || `ISSUE-${issue.id}`;
    const typeBadge = clone.querySelector('.issue-type-badge');
    typeBadge.textContent = issue.issueType || 'TASK';
    typeBadge.className = `issue-type-badge type-${issue.issueType || 'TASK'}`;
    clone.querySelector('.issue-title').textContent = issue.title;
    const priBadge = clone.querySelector('.priority-badge');
    priBadge.textContent = issue.priority || 'MEDIUM';
    priBadge.className = `priority-badge pri-${issue.priority || 'MEDIUM'}`;
    const commentEl = clone.querySelector('.comment-count');
    if (issue.commentCount) { commentEl.textContent = `💬 ${issue.commentCount}`; } else { commentEl.textContent = ''; }
    clone.querySelector('.avatar-sm').textContent = initials(issue.assigneeName || 'Unassigned');
    clone.querySelector('.assignee-name').textContent = issue.assigneeName || 'Unassigned';

    const dueDateEl = clone.querySelector('.due-date');
    const dueLabelEl = clone.querySelector('.due-label');
    if (issue.dueDate) {
      if (ds === 'OVERDUE') {
        dueLabelEl.textContent = 'Overdue';
        dueDateEl.textContent = `${formatDateTime(issue.dueDate)}`;
      } else if (ds === 'DUE_TODAY') {
        dueLabelEl.textContent = 'Due';
        dueDateEl.textContent = dueDisplayText(issue, new Date());
      } else {
        dueLabelEl.textContent = 'Due';
        dueDateEl.textContent = dueDisplayText(issue, new Date());
      }
    } else {
      dueLabelEl.textContent = '';
      dueDateEl.textContent = 'No due date';
    }

    const badge = clone.querySelector('.deadline-badge');
    badge.textContent = `${getBadgeIcon(ds)} ${ds === 'COMPLETED' ? (issue.completionLabel ? issue.completionLabel.toUpperCase() : 'COMPLETED') : ds}`;
    badge.className = `deadline-badge deadline-${ds}`;
    const completedBox = clone.querySelector('.completed-box');
    if (ds === 'COMPLETED' && issue.completedDate) {
      completedBox.style.display = 'flex';
      completedBox.querySelector('.completed-text').textContent = `✓ ${issue.completionLabel || (isOnTime(issue) ? 'Completed on time' : 'Completed late')}`;
      completedBox.querySelector('.completed-meta').textContent = `Due ${formatDateShort(issue.dueDate)} • Done ${formatDateShort(issue.completedDate)}`;
    } else {
      completedBox.style.display = 'none';
    }
    const wrapper = document.createElement('div');
    wrapper.appendChild(clone);
    return wrapper.firstElementChild;
  }

  // Fallback — pure DOM APIs without innerHTML
  const card = document.createElement('div');
  card.className = `issue-card ${cardClass}`;
  card.dataset.issueId = issue.id;
  card.dataset.status = issue.status;
  card.draggable = true;

  const header = document.createElement('div');
  header.className = 'issue-card-header';
  const keyEl = document.createElement('span');
  keyEl.className = 'issue-key';
  keyEl.textContent = issue.issueKey || `ISSUE-${issue.id}`;
  const typeEl = document.createElement('span');
  typeEl.className = `issue-type-badge type-${issue.issueType || 'TASK'}`;
  typeEl.textContent = issue.issueType || 'TASK';
  header.append(keyEl, typeEl);

  const titleEl = document.createElement('div');
  titleEl.className = 'issue-title';
  titleEl.textContent = issue.title;

  const meta = document.createElement('div');
  meta.className = 'issue-meta';
  const priEl = document.createElement('span');
  priEl.className = `priority-badge pri-${issue.priority || 'MEDIUM'}`;
  priEl.textContent = issue.priority || 'MEDIUM';
  const commentSpan = document.createElement('span');
  commentSpan.className = 'comment-count';
  commentSpan.style.fontSize = '11px';
  commentSpan.style.color = '#64748b';
  if (issue.commentCount) commentSpan.textContent = `💬 ${issue.commentCount}`;
  meta.append(priEl, commentSpan);

  const footer = document.createElement('div');
  footer.className = 'issue-footer';
  const assignee = document.createElement('div');
  assignee.className = 'assignee';
  const avatar = document.createElement('div');
  avatar.className = 'avatar-sm';
  avatar.textContent = initials(issue.assigneeName || 'Unassigned');
  const assigneeName = document.createElement('span');
  assigneeName.textContent = issue.assigneeName || 'Unassigned';
  assigneeName.className = 'assignee-name';
  assignee.append(avatar, assigneeName);
  const dueSection = document.createElement('div');
  dueSection.className = 'due-section';
  const dueLabel = document.createElement('div');
  dueLabel.className = 'due-label';
  const dueDate = document.createElement('div');
  dueDate.className = 'due-date';
  if (issue.dueDate) {
    dueLabel.textContent = ds === 'OVERDUE' ? 'Overdue' : ds === 'DUE_TODAY' ? 'Due today' : 'Due';
    dueDate.textContent = ds === 'OVERDUE' ? formatDateTime(issue.dueDate)
      : ds === 'DUE_TODAY' ? `at ${formatTime(issue.dueDate)}`
      : dueDisplayText(issue, new Date());
  } else {
    dueLabel.textContent = '';
    dueDate.textContent = 'No due date';
  }
  dueSection.append(dueLabel, dueDate);
  footer.append(assignee, dueSection);

  const badge = document.createElement('div');
  badge.className = `deadline-badge deadline-${ds}`;
  badge.textContent = `${getBadgeIcon(ds)} ${ds}`;

  card.append(header, titleEl, meta, footer, badge);
  return card;
};

// Returns HTMLElement (no HTML strings) — clones template if available, else builds via DOM APIs
export const createIssueCard = (issue) => {
  const tpl = document.getElementById('issueCardTemplate');
  return buildCard(issue, tpl);
};

// Backward compat for callers expecting string — now returns element; provide helper to append
export const renderIssueCard = (issue) => {
  const el = createIssueCard(issue);
  return el.outerHTML;
};

export const appendIssueCard = (container, issue) => {
  const el = createIssueCard(issue);
  container.appendChild(el);
  return el;
};