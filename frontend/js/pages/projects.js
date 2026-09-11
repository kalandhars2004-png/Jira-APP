import { auth } from '../core/auth.js';
import { api } from '../core/api.js';
import { initSidebar } from '../components/sidebar.js';
import { initTopnav } from '../components/navbar.js';
import { openModal, closeModal, bindModalClose } from '../components/modal.js';
import { notify } from '../components/toast.js';

const user = auth.requireAuth();
initSidebar('projects');
initTopnav({ title: 'Projects', subtitle: 'Create and manage projects — each gets its own workflow and board.' });

const $ = (s) => document.querySelector(s);
const grid = $('#projectGrid');
const empty = $('#emptyProjects');
const searchInput = $('#projectSearch');

let allProjects = [];
let customWorkflow = ['TODO','IN_PROGRESS','IN_REVIEW','DONE'];

const workflowTemplates = {
  basic: ['TODO','IN_PROGRESS','DONE'],
  software: ['BACKLOG','TODO','IN_PROGRESS','IN_REVIEW','DONE'],
  agile: ['BACKLOG','SELECTED','IN_PROGRESS','REVIEW','DONE']
};

const fetchProjects = async () => {
  try {
    allProjects = await api.get('/api/projects');
    render(allProjects);
  } catch (e) { notify.error(e.message); }
};

const render = (list) => {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = q ? list.filter(p => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)) : list;

  grid.textContent = '';

  if (!filtered.length) {
    empty.classList.remove('hidden');
    const title = empty.querySelector('.empty-title');
    const desc = empty.querySelector('.empty-desc');
    if (q) {
      title.textContent = `No results for "${q}"`;
      desc.textContent = 'Try a different search term.';
    } else {
      title.textContent = 'No projects yet';
      desc.textContent = 'Create your first project to start tracking work.';
    }
    return;
  }

  empty.classList.add('hidden');
  const tpl = document.getElementById('projectCardTemplate');

  filtered.forEach((p) => {
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.project-key').textContent = p.key;
    const statusEl = clone.querySelector('.project-status');
    statusEl.textContent = p.status;
    statusEl.style.cssText = `font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:99px;background:${p.status === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9'};color:${p.status === 'ACTIVE' ? '#059669' : '#64748b'}`;
    clone.querySelector('.project-name').textContent = p.name;
    clone.querySelector('.project-desc').textContent = p.description || 'No description';
    // workflow preview
    const wfWrap = clone.querySelector('.workflow-preview');
    const wf = p.workflow && Array.isArray(p.workflow) ? p.workflow : ['TODO','IN_PROGRESS','DONE'];
    wfWrap.textContent = '';
    wf.forEach((s, idx) => {
      const step = document.createElement('span');
      step.textContent = s.replace(/_/g,' ');
      step.style.background = '#f1f5f9';
      step.style.border = '1px solid #e2e8f0';
      step.style.padding = '2px 6px';
      step.style.borderRadius = '99px';
      step.style.fontSize = '10px';
      step.style.fontWeight = '600';
      wfWrap.appendChild(step);
      if (idx < wf.length-1) {
        const arrow = document.createElement('span');
        arrow.textContent = '→';
        arrow.style.color = '#94a3b8';
        arrow.style.fontSize = '10px';
        wfWrap.appendChild(arrow);
      }
    });
    const fill = clone.querySelector('.progress-fill');
    fill.style.width = `${p.progress}%`;
    clone.querySelector('.progress-text').textContent = `${p.progress}%`;
    clone.querySelector('.meta-members').textContent = `${p.memberCount} members`;
    clone.querySelector('.meta-issues').textContent = `${p.issueCount} issues`;
    clone.querySelector('.meta-done').textContent = `${p.completedCount} done`;
    clone.querySelector('.meta-done').style.color = '#059669';

    const boardBtn = clone.querySelector('.board-btn');
    boardBtn.addEventListener('click', () => {
      localStorage.setItem('activeProjectId', String(p.id));
      location.href = `/pages/board.html?projectId=${p.id}`;
    });
    const detailsBtn = clone.querySelector('.details-btn');
    detailsBtn.addEventListener('click', () => {
      localStorage.setItem('activeProjectId', String(p.id));
      location.href = `/pages/board.html?projectId=${p.id}`;
    });
    const editBtn = clone.querySelector('.edit-proj-btn');
    editBtn?.addEventListener('click', () => openEditProject(p));

    grid.appendChild(clone);
  });
  if (window.lucide) lucide.createIcons();
};

let editingProjectId = null;
const openEditProject = (project) => {
  editingProjectId = project.id;
  $('#editProjName').value = project.name;
  $('#editProjKey').value = project.key;
  $('#editProjDesc').value = project.description || '';
  openModal('editProjectModal');
  if (window.lucide) lucide.createIcons();
};

searchInput?.addEventListener('input', () => render(allProjects));

bindModalClose('projectModal');
$('#createProjectBtn')?.addEventListener('click', () => openModal('projectModal'));
$('#emptyCreateBtn')?.addEventListener('click', () => openModal('projectModal'));
$('#projKey')?.addEventListener('input', (e) => e.target.value = e.target.value.toUpperCase());

// Workflow template handling
const workflowSelect = $('#projWorkflow');
const customEditor = $('#customWorkflowEditor');
const customList = $('#customWorkflowList');

const renderCustomWorkflow = () => {
  customList.textContent = '';
  customWorkflow.forEach((s, idx) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.background = 'white';
    row.style.border = '1px solid #e2e8f0';
    row.style.borderRadius = '8px';
    row.style.padding = '8px 10px';
    const input = document.createElement('input');
    input.className = 'form-input';
    input.value = s;
    input.style.flex = '1';
    input.style.border = 'none';
    input.style.padding = '4px';
    input.style.fontWeight = '600';
    input.addEventListener('input', () => { customWorkflow[idx] = input.value.toUpperCase().replace(/\s+/g,'_'); });
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'btn btn-ghost btn-sm';
    up.textContent = '↑';
    up.disabled = idx===0;
    up.addEventListener('click', () => {
      if (idx>0) { const tmp=customWorkflow[idx-1]; customWorkflow[idx-1]=customWorkflow[idx]; customWorkflow[idx]=tmp; renderCustomWorkflow(); }
    });
    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'btn btn-ghost btn-sm';
    down.textContent = '↓';
    down.disabled = idx===customWorkflow.length-1;
    down.addEventListener('click', () => {
      if (idx<customWorkflow.length-1) { const tmp=customWorkflow[idx+1]; customWorkflow[idx+1]=customWorkflow[idx]; customWorkflow[idx]=tmp; renderCustomWorkflow(); }
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-ghost btn-sm';
    del.textContent = '✕';
    del.style.color = '#dc2626';
    del.disabled = customWorkflow.length<=2;
    del.addEventListener('click', () => { customWorkflow.splice(idx,1); renderCustomWorkflow(); });
    row.append(input, up, down, del);
    customList.appendChild(row);
  });
};

workflowSelect?.addEventListener('change', () => {
  if (workflowSelect.value === 'custom') {
    customEditor.classList.remove('hidden');
    renderCustomWorkflow();
  } else {
    customEditor.classList.add('hidden');
  }
});

const addStatusModal = $('#addStatusModal');
const addStatusInput = $('#addStatusInput');
const addStatusError = $('#addStatusError');
const addStatusConfirm = $('#addStatusConfirm');
const addStatusCancel = $('#addStatusCancel');

const openAddStatusModal = () => {
  if (!addStatusModal) return;
  addStatusInput.value = '';
  addStatusError.style.display = 'none';
  addStatusInput.style.borderColor = '#e2e8f0';
  addStatusModal.classList.add('open');
  setTimeout(() => addStatusInput.focus(), 50);
  if (window.lucide) lucide.createIcons();
};
const closeAddStatusModal = () => {
  if (!addStatusModal) return;
  addStatusModal.classList.remove('open');
};

const submitAddStatus = () => {
  const raw = addStatusInput.value.trim();
  if (!raw) {
    addStatusError.style.display = 'block';
    addStatusInput.style.borderColor = '#dc2626';
    addStatusInput.focus();
    return;
  }
  addStatusError.style.display = 'none';
  const name = raw.toUpperCase().replace(/\s+/g,'_');
  customWorkflow.push(name);
  renderCustomWorkflow();
  closeAddStatusModal();
};

$('#addWorkflowStatusBtn')?.addEventListener('click', openAddStatusModal);
addStatusCancel?.addEventListener('click', closeAddStatusModal);
addStatusConfirm?.addEventListener('click', submitAddStatus);
addStatusInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitAddStatus(); }
  if (e.key === 'Escape') closeAddStatusModal();
});
addStatusModal?.addEventListener('click', (e) => { if (e.target === addStatusModal) closeAddStatusModal(); });
addStatusModal?.querySelector('[data-close]')?.addEventListener('click', closeAddStatusModal);
bindModalClose('addStatusModal');

$('#projectForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#projSubmitBtn');
  const orig = btn.textContent;
  btn.textContent = 'Creating...';
  btn.disabled = true;
  try {
    const name = $('#projName').value.trim();
    const key = $('#projKey').value.trim().toUpperCase();
    const description = $('#projDesc').value.trim();
    if (!name || !key) throw new Error('Name and key are required');
    if (key.length < 2) throw new Error('Key must be at least 2 characters');
    let workflow = null;
    let teamType = null;
    const sel = workflowSelect.value;
    if (sel === 'custom') {
      workflow = customWorkflow.filter(s=> s.trim()).map(s=> s.toUpperCase().replace(/\s+/g,'_'));
      teamType = 'Custom';
    } else {
      workflow = workflowTemplates[sel];
      teamType = sel === 'basic' ? 'Personal Projects' : sel === 'software' ? 'Software Team' : sel === 'agile' ? 'Product Team' : 'Custom';
    }
    await api.post('/api/projects', { name, key, description, createdBy: user.id, workflow, teamType });
    notify.success('Project created successfully');
    closeModal('projectModal');
    e.target.reset();
    customWorkflow = ['TODO','IN_PROGRESS','IN_REVIEW','DONE'];
    customEditor.classList.add('hidden');
    workflowSelect.value = 'software';
    await fetchProjects();
  } catch (err) { notify.error(err.message); }
  finally { btn.textContent = orig; btn.disabled = false; }
});

bindModalClose('editProjectModal');
$('#editProjectForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!editingProjectId) return;
  const btn = $('#editProjSubmitBtn');
  const orig = btn.textContent;
  btn.textContent = 'Saving...';
  btn.disabled = true;
  try {
    const name = $('#editProjName').value.trim();
    const description = $('#editProjDesc').value.trim();
    if (!name) throw new Error('Project name required');
    // Jira-like flow: only name/description editable, key immutable
    await api.put(`/api/projects/${editingProjectId}`, { name, key: $('#editProjKey').value.trim(), description, createdBy: user.id });
    notify.success('Project updated — flow like Jira');
    closeModal('editProjectModal');
    await fetchProjects();
    // If active project was edited, update localStorage and board title
    if (String(localStorage.getItem('activeProjectId')) === String(editingProjectId)) {
      localStorage.setItem('activeProjectName', name);
    }
  } catch (err) { notify.error(err.message); }
  finally { btn.textContent = orig; btn.disabled = false; }
});

fetchProjects();
