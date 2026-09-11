// Production navbar — ES6+ arrow functions, DOM APIs only, Lucide icons
import { storage } from '../core/storage.js';

const getBreadcrumbs = () => {
  const path = location.pathname;
  const crumbs = [{ label: 'Home', href: '/pages/dashboard.html' }];
  if (path.includes('board')) crumbs.push({ label: 'Board', href: '/pages/board.html' });
  else if (path.includes('mytasks')) crumbs.push({ label: 'My Tasks', href: '/pages/mytasks.html' });
  else if (path.includes('projects')) crumbs.push({ label: 'Projects', href: '/pages/projects.html' });
  else if (path.includes('assign')) crumbs.push({ label: 'Assign', href: '/pages/assign.html' });
  else if (path.includes('review')) crumbs.push({ label: 'Review', href: '/pages/review.html' });
  else if (path.includes('dashboard')) crumbs.push({ label: 'Dashboard', href: '/pages/dashboard.html' });
  else if (path.includes('issue')) crumbs.push({ label: 'Issue', href: '#' });
  return crumbs;
};

const ensureTopnavStructure = () => {
  const topnav = document.getElementById('topnav');
  if (!topnav) return null;
  // If already enhanced, skip
  if (topnav.dataset.enhanced === '1') return topnav;
  topnav.dataset.enhanced = '1';
  topnav.textContent = '';

  const left = document.createElement('div');
  left.className = 'topnav-left';
  const toggle = document.createElement('button');
  toggle.id = 'mobileMenuBtn';
  toggle.className = 'btn btn-ghost btn-icon';
  toggle.setAttribute('aria-label', 'Toggle sidebar');
  const menuIcon = document.createElement('i');
  menuIcon.setAttribute('data-lucide', 'menu');
  menuIcon.style.width = '18px'; menuIcon.style.height = '18px';
  toggle.appendChild(menuIcon);

  const brand = document.createElement('div');
  brand.style.display = 'flex';
  brand.style.alignItems = 'center';
  brand.style.gap = '10px';
  const logo = document.createElement('div');
  logo.style.width = '28px'; logo.style.height = '28px'; logo.style.background = '#4f46e5'; logo.style.color = 'white'; logo.style.display = 'grid'; logo.style.placeItems = 'center'; logo.style.borderRadius = '8px'; logo.style.fontWeight = '800'; logo.style.fontSize = '14px';
  logo.textContent = '◆';
  const brandText = document.createElement('div');
  brandText.style.fontWeight = '800';
  brandText.style.letterSpacing = '-.02em';
  brandText.textContent = 'jiraLite';
  brand.append(logo, brandText);

  const breadcrumb = document.createElement('nav');
  breadcrumb.className = 'breadcrumb';
  breadcrumb.style.marginLeft = '6px';
  getBreadcrumbs().forEach((c, idx) => {
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '/';
      breadcrumb.appendChild(sep);
    }
    const a = document.createElement('a');
    a.href = c.href;
    a.textContent = c.label;
    breadcrumb.appendChild(a);
  });

  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.flexDirection = 'column';
  titleWrap.style.minWidth = '0';
  const titleEl = document.createElement('h1');
  titleEl.id = 'topnavTitle';
  titleEl.style.fontSize = '14px';
  titleEl.style.fontWeight = '700';
  titleEl.style.whiteSpace = 'nowrap';
  titleEl.style.overflow = 'hidden';
  titleEl.style.textOverflow = 'ellipsis';
  const subEl = document.createElement('p');
  subEl.id = 'topnavSubtitle';
  subEl.style.fontSize = '11px';
  subEl.style.color = '#64748b';
  subEl.style.whiteSpace = 'nowrap';
  subEl.style.overflow = 'hidden';
  subEl.style.textOverflow = 'ellipsis';
  titleWrap.append(titleEl, subEl);

  left.append(toggle, brand, breadcrumb, titleWrap);

  const center = document.createElement('div');
  center.className = 'topnav-center';
  const searchWrap = document.createElement('div');
  searchWrap.className = 'topnav-search';
  const searchIcon = document.createElement('i');
  searchIcon.setAttribute('data-lucide', 'search');
  searchIcon.className = 'icon';
  searchIcon.style.width = '16px'; searchIcon.style.height = '16px';
  const searchInput = document.createElement('input');
  searchInput.id = 'globalSearchInput';
  searchInput.placeholder = 'Search issues, projects...';
  const kbd = document.createElement('span');
  kbd.className = 'kbd';
  kbd.textContent = '⌘K';
  searchWrap.append(searchIcon, searchInput, kbd);
  center.appendChild(searchWrap);

  const right = document.createElement('div');
  right.className = 'topnav-right';
  const notifBtn = document.createElement('button');
  notifBtn.className = 'notification-btn';
  notifBtn.setAttribute('aria-label', 'Notifications');
  const bellIcon = document.createElement('i');
  bellIcon.setAttribute('data-lucide', 'bell');
  bellIcon.style.width = '18px'; bellIcon.style.height = '18px';
  notifBtn.appendChild(bellIcon);
  const badge = document.createElement('span');
  badge.className = 'notification-badge';
  badge.textContent = '3';
  badge.style.display = 'none'; // hidden unless unread
  notifBtn.appendChild(badge);

  const userMenu = document.createElement('div');
  userMenu.className = 'user-menu';
  const avatarBtn = document.createElement('div');
  avatarBtn.id = 'topnavAvatar';
  avatarBtn.className = 'user-avatar-btn';
  avatarBtn.textContent = '?';
  const dropdown = document.createElement('div');
  dropdown.className = 'user-dropdown';
  dropdown.id = 'userDropdown';
  const header = document.createElement('div');
  header.className = 'user-dropdown-header';
  const ddAvatar = document.createElement('div');
  ddAvatar.className = 'user-avatar';
  ddAvatar.id = 'dropdownAvatar';
  ddAvatar.textContent = '?';
  ddAvatar.style.width = '32px'; ddAvatar.style.height = '32px';
  const ddInfo = document.createElement('div');
  ddInfo.style.flex = '1';
  const ddName = document.createElement('div');
  ddName.id = 'dropdownName';
  ddName.style.fontWeight = '700'; ddName.style.fontSize = '13px';
  const ddEmail = document.createElement('div');
  ddEmail.id = 'dropdownEmail';
  ddEmail.style.fontSize = '12px'; ddEmail.style.color = '#64748b';
  ddInfo.append(ddName, ddEmail);
  header.append(ddAvatar, ddInfo);

  const profileItem = document.createElement('div');
  profileItem.className = 'user-dropdown-item';
  profileItem.innerHTML = '<i data-lucide="user-circle" style="width:16px;height:16px"></i> Profile';
  const settingsItem = document.createElement('div');
  settingsItem.className = 'user-dropdown-item';
  settingsItem.innerHTML = '<i data-lucide="settings" style="width:16px;height:16px"></i> Settings';
  const logoutItem = document.createElement('div');
  logoutItem.className = 'user-dropdown-item danger';
  logoutItem.innerHTML = '<i data-lucide="log-out" style="width:16px;height:16px"></i> Logout';
  logoutItem.onclick = () => { storage.clearUser(); location.href = '/index.html'; };
  settingsItem.onclick = () => { import('./toast.js').then(({notify})=> notify.info('Settings coming soon')); dropdown.classList.remove('open'); };
  profileItem.onclick = () => { location.href = '/pages/mytasks.html'; };

  dropdown.append(header, profileItem, settingsItem, logoutItem);
  userMenu.append(avatarBtn, dropdown);

  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click', () => dropdown.classList.remove('open'));

  right.append(notifBtn, userMenu);

  topnav.append(left, center, right);

  // Search handling
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) location.href = `/pages/board.html?search=${encodeURIComponent(q)}`;
    }
  });
  // Ctrl K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // Notification click
  notifBtn.addEventListener('click', () => {
    import('./toast.js').then(({notify})=> notify.info('No new notifications'));
  });

  return topnav;
};

export const initTopnav = ({ title, subtitle } = {}) => {
  const topnav = ensureTopnavStructure();
  const titleEl = document.getElementById('topnavTitle');
  const subEl = document.getElementById('topnavSubtitle');
  if (titleEl && title) titleEl.textContent = title;
  if (subEl && subtitle) subEl.textContent = subtitle;

  const user = storage.getUser();
  const avatarBtn = document.getElementById('topnavAvatar');
  const ddAvatar = document.getElementById('dropdownAvatar');
  const ddName = document.getElementById('dropdownName');
  const ddEmail = document.getElementById('dropdownEmail');
  const initials = (name) => name?.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase() ?? '?';
  if (user) {
    if (avatarBtn) avatarBtn.textContent = initials(user.name);
    if (ddAvatar) ddAvatar.textContent = initials(user.name);
    if (ddName) ddName.textContent = user.name;
    if (ddEmail) ddEmail.textContent = user.email;
  }

  const btn = document.getElementById('mobileMenuBtn');
  btn?.addEventListener('click', () => {
    const shell = document.querySelector('.app-shell');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const isMobile = window.matchMedia('(max-width: 860px)').matches;
    if (isMobile) {
      const isOpen = sidebar?.classList.contains('open');
      if (isOpen) { sidebar?.classList.remove('open'); overlay?.classList.remove('open'); }
      else { sidebar?.classList.add('open'); overlay?.classList.add('open'); }
    } else {
      const isCollapsed = shell?.classList.contains('sidebar-collapsed');
      if (isCollapsed) { shell?.classList.remove('sidebar-collapsed'); localStorage.removeItem('sidebarCollapsed'); }
      else { shell?.classList.add('sidebar-collapsed'); localStorage.setItem('sidebarCollapsed', '1'); }
    }
  });

  if (window.lucide) window.lucide.createIcons();
};

export const renderTopnav = initTopnav;
