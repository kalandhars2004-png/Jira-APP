import { storage } from '../core/storage.js';

const getActiveId = () => {
  const { pathname } = location;
  if (pathname.includes('board')) return 'board';
  if (pathname.includes('mytasks') || pathname.includes('my-tasks') || pathname.includes('assigned')) return 'mytasks';
  if (pathname.includes('projects')) return 'projects';
  if (pathname.includes('members')) return 'members';
  if (pathname.includes('review')) return 'review';
  if (pathname.includes('reports')) return 'reports';
  if (pathname.includes('dashboard')) return 'dashboard';
  return 'board';
};

const getInitials = (name) => name?.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() ?? '?';

const ensureOverlay = () => {
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }
  return overlay;
};

const isMobile = () => window.matchMedia('(max-width: 860px)').matches;

const toggleSidebarSmooth = () => {
  const shell = document.querySelector('.app-shell');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (isMobile()) {
    const isOpen = sidebar?.classList.contains('open');
    if (isOpen) { sidebar.classList.remove('open'); overlay?.classList.remove('open'); }
    else { sidebar.classList.add('open'); overlay?.classList.add('open'); }
  } else {
    const isCollapsed = shell?.classList.contains('sidebar-collapsed');
    if (isCollapsed) { shell.classList.remove('sidebar-collapsed'); localStorage.removeItem('sidebarCollapsed'); }
    else { shell.classList.add('sidebar-collapsed'); localStorage.setItem('sidebarCollapsed', '1'); }
  }
};

export const initSidebar = (activeId) => {
  const sidebar = document.getElementById('sidebar');
  const navContainer = document.querySelector('.sidebar-nav');
  const active = activeId || getActiveId();
  const user = storage.getUser();
  const role = user?.role || 'MEMBER';
  const isAdmin = role === 'ADMIN';

  // Build new hierarchy if not already built
  if (navContainer && !navContainer.dataset.restructured) {
    navContainer.dataset.restructured = '1';
    navContainer.textContent = '';

    const createLabel = (text) => {
      const el = document.createElement('div');
      el.className = 'nav-section-label';
      el.textContent = text;
      return el;
    };
    const createItem = (nav, href, icon, label, adminOnly=false) => {
      const a = document.createElement('a');
      a.className = 'nav-item';
      a.dataset.nav = nav;
      a.href = href;
      if (adminOnly) a.dataset.role = 'admin';
      const i = document.createElement('i');
      i.setAttribute('data-lucide', icon);
      i.className = 'nav-icon';
      a.append(i, document.createTextNode(` ${label}`));
      // tooltip for collapsed
      a.title = label;
      return a;
    };

    // WORKSPACE
    navContainer.appendChild(createLabel('WORKSPACE'));
    navContainer.appendChild(createItem('board', '/pages/board.html', 'layout-grid', 'Board'));
    navContainer.appendChild(createItem('mytasks', '/pages/mytasks.html', 'check-square', 'My Tasks'));
    navContainer.appendChild(createItem('projects', '/pages/projects.html', 'folder-kanban', 'Projects'));
    navContainer.appendChild(createItem('members', '/pages/members.html', 'users', 'Members'));

    // MANAGEMENT
    const mgmtLabel = createLabel('MANAGEMENT');
    mgmtLabel.style.marginTop = '18px';
    navContainer.appendChild(mgmtLabel);
    navContainer.appendChild(createItem('review', '/pages/review.html', 'clipboard-check', 'Review'));
    navContainer.appendChild(createItem('reports', '/pages/reports.html', 'bar-chart-3', 'Reports', true));

    // SYSTEM
    const sysLabel = createLabel('SYSTEM');
    sysLabel.style.marginTop = '18px';
    navContainer.appendChild(sysLabel);
    const settings = createItem('settings', '#', 'settings', 'Settings');
    settings.id = 'settingsLink';
    navContainer.appendChild(settings);
  }

  // Active state
  document.querySelectorAll('[data-nav]').forEach(el => {
    const isActive = el.dataset.nav === active;
    el.classList.toggle('active', isActive);
  });

  // Role-based: hide admin-only for non-admin
  document.querySelectorAll('[data-nav]').forEach(el => {
    const adminOnly = el.dataset.role === 'admin';
    if (adminOnly && !isAdmin) el.style.display = 'none';
    else el.style.display = '';
  });

  // User profile
  const avatar = document.getElementById('userAvatar');
  const nameEl = document.getElementById('userName');
  const emailEl = document.getElementById('userEmail');
  const logoutBtn = document.getElementById('logoutBtn');
  if (user) {
    if (avatar) avatar.textContent = getInitials(user.name);
    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
  } else {
    if (nameEl) nameEl.textContent = 'Not signed in';
    if (emailEl) emailEl.textContent = '';
    if (avatar) avatar.textContent = '?';
  }
  logoutBtn?.addEventListener('click', () => { storage.clearUser(); location.href = '/index.html'; });
  document.getElementById('settingsLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    import('./toast.js').then(({ notify }) => notify.info('Settings coming soon'));
  });

  // Collapsed default: BOARD is primary, sidebar collapsed when entering any page
  const shell = document.querySelector('.app-shell');
  const overlay = ensureOverlay();
  const collapsedPref = localStorage.getItem('sidebarCollapsed');
  if (!isMobile()) {
    if (collapsedPref === null || collapsedPref === '1') {
      shell?.classList.add('sidebar-collapsed');
      if (collapsedPref === null) localStorage.setItem('sidebarCollapsed', '1');
    } else {
      shell?.classList.remove('sidebar-collapsed');
    }
  }

  // Brand toggle
  const brand = document.querySelector('.sidebar-brand');
  if (brand && !brand.querySelector('.sidebar-toggle')) {
    const toggle = document.createElement('button');
    toggle.className = 'sidebar-toggle';
    toggle.setAttribute('aria-label', 'Toggle sidebar');
    toggle.setAttribute('title', 'Collapse sidebar');
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'panel-left-close');
    icon.style.width = '16px'; icon.style.height = '16px';
    toggle.appendChild(icon);
    toggle.style.marginLeft = 'auto';
    toggle.addEventListener('click', toggleSidebarSmooth);
    brand.appendChild(toggle);
  }

  // Update toggle icon based on collapsed
  const updateToggleIcon = () => {
    const toggle = document.querySelector('.sidebar-toggle i');
    if (!toggle) return;
    const isCollapsed = document.querySelector('.app-shell')?.classList.contains('sidebar-collapsed');
    toggle.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
    if (window.lucide) window.lucide.createIcons();
  };
  updateToggleIcon();
  document.querySelector('.sidebar-toggle')?.addEventListener('click', () => setTimeout(updateToggleIcon, 320));

  // Mobile auto-close on nav click
  document.querySelectorAll('.nav-item[data-nav]').forEach(item => {
    item.addEventListener('click', () => {
      if (isMobile()) {
        setTimeout(() => {
          document.getElementById('sidebar')?.classList.remove('open');
          overlay?.classList.remove('open');
        }, 120);
      }
    });
  });
  overlay?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
    overlay.classList.remove('open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('sidebar')?.classList.remove('open');
      overlay?.classList.remove('open');
    }
  });

  if (window.lucide) window.lucide.createIcons();
};

export const renderSidebar = initSidebar;
export { toggleSidebarSmooth };
