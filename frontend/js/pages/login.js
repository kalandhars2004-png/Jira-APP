import { auth } from '../core/auth.js';
import { api } from '../core/api.js';
import { notify } from '../components/toast.js';

const $ = (s) => document.querySelector(s);

const tabLogin = $('#tabLogin');
const tabRegister = $('#tabRegister');
const loginForm = $('#loginForm');
const registerForm = $('#registerForm');
const authError = $('#authError');

const showError = (msg) => {
  authError.textContent = msg;
  authError.style.display = 'block';
};
const hideError = () => { authError.style.display = 'none'; authError.textContent=''; };

// redirect if already logged and onboarding done — BOARD is default landing per spec
const existingUser = auth.getUser();
const onboardingDone = localStorage.getItem('onboardingComplete') === '1';
if (existingUser && onboardingDone) location.href = '/pages/board.html';
if (existingUser && !onboardingDone) {
  setTimeout(() => showWizard(), 300);
}

const switchTab = (mode) => {
  const isLogin = mode === 'login';
  tabLogin.classList.toggle('active', isLogin);
  tabRegister.classList.toggle('active', !isLogin);
  loginForm.style.display = isLogin ? 'flex' : 'none';
  registerForm.style.display = isLogin ? 'none' : 'flex';
  const loginHeader = $('#loginHeader');
  const registerHeader = $('#registerHeader');
  if (loginHeader) loginHeader.style.display = isLogin ? 'block' : 'none';
  if (registerHeader) registerHeader.style.display = isLogin ? 'none' : 'block';
  hideError();
  if (window.lucide) lucide.createIcons();
};

tabLogin?.addEventListener('click', () => switchTab('login'));
tabRegister?.addEventListener('click', () => switchTab('register'));
$('#toRegister')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('register'); });
$('#toLogin')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('login'); });
$('#forgotLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  notify.info('Password reset link would be sent to your email (demo).');
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  const btn = $('#loginBtn');
  const orig = btn.textContent;
  btn.textContent = 'Signing in...'; btn.disabled = true;
  try {
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value;
    if (!email || !password) throw new Error('Email and password required');
    await auth.login({ email, password });
    notify.success('Welcome back!');
    // Check if onboarding needed
    const done = localStorage.getItem('onboardingComplete') === '1';
    // also check if user has any projects — if none, force onboarding
    let hasProjects = true;
    try {
      const projects = await api.get('/api/projects');
      hasProjects = projects.length > 0;
    } catch {}
    if (!done && !hasProjects) {
      showWizard();
    } else if (!done) {
      // still show wizard for first login even if projects exist, but allow skip
      showWizard();
    } else {
      setTimeout(() => location.href = '/pages/board.html', 400);
    }
  } catch (err) {
    showError(err.message || 'Login failed');
    notify.error(err.message);
  } finally {
    btn.textContent = orig; btn.disabled = false;
  }
});

registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  const btn = $('#registerBtn');
  const orig = btn.textContent;
  btn.textContent = 'Creating...'; btn.disabled = true;
  try {
    const name = $('#regName').value.trim();
    const email = $('#regEmail').value.trim();
    const password = $('#regPassword').value;
    const confirmEl = $('#regConfirmPassword');
    const confirm = confirmEl ? confirmEl.value : password;
    if (!name || !email || !password) throw new Error('All fields required');
    if (password.length < 4) throw new Error('Password must be at least 4 characters');
    if (confirm && password !== confirm) throw new Error('Passwords do not match');
    await auth.register({ name, email, password });
    notify.success('Account created! Let’s set up your workspace.');
    showWizard();
  } catch (err) {
    showError(err.message || 'Registration failed');
    notify.error(err.message);
  } finally {
    btn.textContent = orig; btn.disabled = false;
  }
});

// Onboarding wizard
const wizard = $('#onboardingWizard');
const body = $('#wizardBody');
const nextBtn = $('#wizardNext');
const backBtn = $('#wizardBack');
const skipBtn = $('#wizardSkip');

let step = 1;
let selectedTeam = null;
let selectedWorkflowTemplate = null;
let customStatuses = ['TODO','IN_PROGRESS','IN_REVIEW','DONE'];

const teamOptions = [
  { id: 'Software Team', title: 'Software Team', desc: 'Build and manage software projects', icon: 'code-2' },
  { id: 'Product Team', title: 'Product Team', desc: 'Plan and manage product work', icon: 'package' },
  { id: 'Marketing Team', title: 'Marketing Team', desc: 'Manage campaigns and tasks', icon: 'megaphone' },
  { id: 'Personal Projects', title: 'Personal Projects', desc: 'Track your own work', icon: 'user' },
  { id: 'Custom', title: 'Custom', desc: 'Create my own workflow', icon: 'settings' },
];

const workflowTemplates = [
  { id: 'basic', title: 'Basic', desc: 'To Do → In Progress → Done', steps: ['TODO','IN_PROGRESS','DONE'] },
  { id: 'software', title: 'Software Development', desc: 'Backlog → To Do → In Progress → In Review → Done', steps: ['BACKLOG','TODO','IN_PROGRESS','IN_REVIEW','DONE'] },
  { id: 'agile', title: 'Agile', desc: 'Backlog → Selected → In Progress → Review → Done', steps: ['BACKLOG','SELECTED','IN_PROGRESS','REVIEW','DONE'] },
  { id: 'custom', title: 'Custom Workflow', desc: 'Create your own stages', steps: null },
];

const showWizard = () => {
  wizard.classList.add('open');
  step = 1;
  renderTeamCards();
  renderWorkflowCards();
  renderCustomEditor();
  updateWizardUI();
  if (window.lucide) lucide.createIcons();
};

const hideWizard = () => {
  wizard.classList.remove('open');
  localStorage.setItem('onboardingComplete', '1');
  setTimeout(() => location.href = '/pages/board.html', 300);
};

const renderTeamCards = () => {
  const container = $('#teamCards');
  container.textContent = '';
  teamOptions.forEach((opt) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'wizard-card';
    if (selectedTeam === opt.id) card.classList.add('selected');
    const icon = document.createElement('div');
    icon.className = 'wizard-card-icon';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', opt.icon);
    i.style.width='18px'; i.style.height='18px';
    icon.appendChild(i);
    const title = document.createElement('div');
    title.className = 'wizard-card-title';
    title.textContent = opt.title;
    const desc = document.createElement('div');
    desc.className = 'wizard-card-desc';
    desc.textContent = opt.desc;
    card.append(icon, title, desc);
    card.addEventListener('click', () => {
      selectedTeam = opt.id;
      renderTeamCards();
      updateWizardUI();
      if (window.lucide) lucide.createIcons();
    });
    container.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
};

const renderWorkflowCards = () => {
  const container = $('#workflowCards');
  container.textContent = '';
  workflowTemplates.forEach((wf) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'wizard-card';
    if (selectedWorkflowTemplate === wf.id) card.classList.add('selected');
    const title = document.createElement('div');
    title.className = 'wizard-card-title';
    title.textContent = wf.title;
    const desc = document.createElement('div');
    desc.className = 'wizard-card-desc';
    desc.textContent = wf.desc;
    card.append(title, desc);
    if (wf.steps) {
      const preview = document.createElement('div');
      preview.className = 'workflow-preview';
      wf.steps.forEach((s, idx) => {
        const stepEl = document.createElement('span');
        stepEl.className = 'workflow-step';
        stepEl.textContent = s;
        preview.appendChild(stepEl);
        if (idx < wf.steps.length -1) {
          const arrow = document.createElement('span');
          arrow.className = 'workflow-arrow';
          arrow.textContent = '→';
          preview.appendChild(arrow);
        }
      });
      card.appendChild(preview);
    }
    card.addEventListener('click', () => {
      selectedWorkflowTemplate = wf.id;
      if (wf.id === 'custom') {
        $('#customWorkflowEditor').classList.remove('hidden');
        // init custom statuses from last non-custom or default
        if (customStatuses.length === 4 && customStatuses.join(',') === 'TODO,IN_PROGRESS,IN_REVIEW,DONE') {
          // keep default
        }
        renderCustomEditor();
      } else {
        $('#customWorkflowEditor').classList.add('hidden');
        customStatuses = [...wf.steps];
      }
      renderWorkflowCards();
      updateWizardUI();
    });
    container.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
};

const renderCustomEditor = () => {
  const list = $('#customStatusList');
  list.textContent = '';
  customStatuses.forEach((s, idx) => {
    const item = document.createElement('div');
    item.className = 'custom-status-item';
    const input = document.createElement('input');
    input.value = s;
    input.placeholder = 'Status name';
    input.addEventListener('input', () => { customStatuses[idx] = input.value.toUpperCase().replace(/\s+/g,'_'); updateWizardUI(); });
    const up = document.createElement('button');
    up.type = 'button';
    up.innerHTML = '↑';
    up.title = 'Move up';
    up.disabled = idx===0;
    up.addEventListener('click', () => {
      if (idx>0) { const tmp = customStatuses[idx-1]; customStatuses[idx-1]=customStatuses[idx]; customStatuses[idx]=tmp; renderCustomEditor(); }
    });
    const down = document.createElement('button');
    down.type = 'button';
    down.innerHTML = '↓';
    down.title = 'Move down';
    down.disabled = idx===customStatuses.length-1;
    down.addEventListener('click', () => {
      if (idx<customStatuses.length-1) { const tmp = customStatuses[idx+1]; customStatuses[idx+1]=customStatuses[idx]; customStatuses[idx]=tmp; renderCustomEditor(); }
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.innerHTML = '✕';
    del.title = 'Delete';
    del.disabled = customStatuses.length <= 2;
    del.addEventListener('click', () => {
      customStatuses.splice(idx,1);
      renderCustomEditor();
      updateWizardUI();
    });
    item.append(input, up, down, del);
    list.appendChild(item);
  });
  if (window.lucide) lucide.createIcons();
};

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
  customStatuses.push(name);
  renderCustomEditor();
  updateWizardUI();
  closeAddStatusModal();
};

$('#addStatusBtn')?.addEventListener('click', openAddStatusModal);
addStatusCancel?.addEventListener('click', closeAddStatusModal);
addStatusConfirm?.addEventListener('click', submitAddStatus);
addStatusInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitAddStatus(); }
  if (e.key === 'Escape') closeAddStatusModal();
});
addStatusModal?.addEventListener('click', (e) => { if (e.target === addStatusModal) closeAddStatusModal(); });
addStatusModal?.querySelector('[data-close]')?.addEventListener('click', closeAddStatusModal);

// Auto uppercase for project key
$('#onboardProjectKey')?.addEventListener('input', (e) => e.target.value = e.target.value.toUpperCase());

const updateWizardUI = () => {
  // update progress dots
  document.querySelectorAll('.wizard-step-dot').forEach(el => {
    const s = Number(el.dataset.step);
    el.classList.remove('active','done');
    if (s < step) { el.classList.add('done'); el.textContent = '✓'; }
    else if (s === step) { el.classList.add('active'); el.textContent = s; }
    else { el.textContent = s; }
  });
  document.querySelectorAll('.wizard-step-line').forEach(el => {
    const id = el.id;
    const lineStep = id === 'line1' ? 1 : 2;
    el.classList.toggle('fill', step > lineStep);
  });
  document.querySelectorAll('[data-label]').forEach(el => {
    const l = Number(el.dataset.label);
    el.classList.toggle('active', l===step);
  });
  // show correct step
  document.querySelectorAll('[data-wizard-step]').forEach(el => {
    el.classList.toggle('hidden', Number(el.dataset.wizardStep) !== step);
  });
  backBtn.style.display = step===1 ? 'none' : 'block';
  skipBtn.textContent = step===3 ? 'Skip for now' : 'Skip';
  // next enabled logic
  let canNext = false;
  if (step===1) canNext = !!selectedTeam;
  else if (step===2) {
    if (selectedWorkflowTemplate === 'custom') canNext = customStatuses.length>=2 && customStatuses.every(s=> s.trim().length>0);
    else canNext = !!selectedWorkflowTemplate;
  } else if (step===3) canNext = true; // project step skippable, so next always enabled (Create Project button)
  nextBtn.disabled = !canNext;
  if (step===3) nextBtn.textContent = 'Create Project';
  else nextBtn.textContent = 'Next';
  if (window.lucide) lucide.createIcons();
};

backBtn?.addEventListener('click', () => {
  if (step>1) { step--; updateWizardUI(); }
});

skipBtn?.addEventListener('click', () => {
  if (step < 3) {
    // skip just goes to next without requiring selection? For step1/2 skip, set defaults
    if (step===1 && !selectedTeam) selectedTeam = 'Software Team';
    if (step===2 && !selectedWorkflowTemplate) { selectedWorkflowTemplate='software'; customStatuses=['BACKLOG','TODO','IN_PROGRESS','IN_REVIEW','DONE']; }
    step = 3;
    updateWizardUI();
  } else {
    // skip project creation
    hideWizard();
  }
});

nextBtn?.addEventListener('click', async () => {
  if (step < 3) {
    step++;
    updateWizardUI();
    return;
  }
  // step 3 — create project
  const name = $('#onboardProjectName').value.trim();
  const key = $('#onboardProjectKey').value.trim().toUpperCase();
  const desc = $('#onboardProjectDesc').value.trim();
  if (!name || !key) {
    // if skip, just hide
    if (!name && !key) { hideWizard(); return; }
    notify.error('Project name and key required, or Skip for now');
    return;
  }
  if (key.length < 2 || key.length > 10) { notify.error('Key must be 2–10 characters'); return; }
  const workflow = selectedWorkflowTemplate === 'custom' ? customStatuses : (workflowTemplates.find(w=> w.id===selectedWorkflowTemplate)?.steps || ['TODO','IN_PROGRESS','IN_REVIEW','DONE']);
  const btnOrig = nextBtn.textContent;
  nextBtn.textContent = 'Creating...'; nextBtn.disabled=true;
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const createdBy = currentUser?.id;
    await api.post('/api/projects', { name, key, description: desc, createdBy, workflow, teamType: selectedTeam });
    notify.success(`Project ${key} created!`);
    hideWizard();
  } catch (e) {
    notify.error(e.message);
    nextBtn.textContent = btnOrig; nextBtn.disabled=false;
  }
});

// If user already logged and onboarding not done, show wizard on load
if (auth.isLoggedIn() && localStorage.getItem('onboardingComplete') !== '1') {
  // small delay to let page render
  setTimeout(() => {
    // check if user has no projects, or just show anyway first time
    showWizard();
  }, 500);
}
