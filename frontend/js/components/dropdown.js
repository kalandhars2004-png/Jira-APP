// Premium custom dropdown — ES6+ arrow functions, DOM APIs only (no HTML strings)
// Reusable across entire app: project, priority, issue type, status, assignee, etc.
import { initials } from '../utils/formatters.js';

const priorityMeta = {
  LOW: { dot: '#475569', bg: '#f1f5f9', label: 'Low priority' },
  MEDIUM: { dot: '#a16207', bg: '#fefce8', label: 'Medium priority' },
  HIGH: { dot: '#c2410c', bg: '#fff7ed', label: 'High priority' },
  CRITICAL: { dot: '#dc2626', bg: '#fef2f2', label: 'Critical' }
};

const typeMeta = {
  TASK: { icon: 'check-square', bg: '#eff6ff', color: '#2563eb' },
  BUG: { icon: 'bug', bg: '#fef2f2', color: '#dc2626' },
  STORY: { icon: 'book-open', bg: '#f0fdf4', color: '#059669' },
  IMPROVEMENT: { icon: 'trending-up', bg: '#fefce8', color: '#a16207' },
  EPIC: { icon: 'zap', bg: '#f5f3ff', color: '#7c3aed' }
};

const getOptionMeta = (select, option) => {
  const val = option.value;
  const text = option.textContent.trim();
  const id = (select.id || '').toLowerCase();
  const placeholder = option.disabled && !val ? text : '';

  if (id.includes('assignee') || id.includes('member') || id.includes('user')) {
    if (!val) return { icon: 'user', iconBg: '#f1f5f9', iconColor: '#94a3b8', title: text || 'Unassigned', sub: 'No assignee', isAvatar: false };
    const name = text.split('•')[0].trim() || text;
    const sub = text.includes('•') ? text.split('•')[1]?.trim() : option.dataset.email || '';
    return {
      icon: initials(name),
      iconBg: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
      iconColor: 'white',
      isAvatar: true,
      title: name,
      sub: sub || text
    };
  }
  if (id.includes('project')) {
    // Text like "ECOM — E-Commerce Platform"
    const parts = text.split('—');
    const key = parts[0]?.trim() || text.slice(0,4);
    const name = parts[1]?.trim() || text;
    return {
      icon: key.slice(0,2).toUpperCase(),
      iconBg: '#eef2ff',
      iconColor: '#4f46e5',
      title: key,
      sub: name,
      fullTitle: text
    };
  }
  if (id.includes('priority')) {
    const meta = priorityMeta[val] || { dot: '#64748b', bg: '#f1f5f9', label: val };
    return {
      icon: '●',
      iconBg: meta.bg,
      iconColor: meta.dot,
      title: text,
      sub: meta.label
    };
  }
  if (id.includes('type') || id.includes('issue')) {
    const meta = typeMeta[val] || { icon: 'circle-dot', bg: '#f1f5f9', color: '#475569' };
    return {
      icon: meta.icon,
      iconBg: meta.bg,
      iconColor: meta.color,
      title: text,
      sub: val,
      isLucide: true
    };
  }
  if (id.includes('status') || id.includes('workflow')) {
    return {
      icon: 'circle',
      iconBg: '#f1f5f9',
      iconColor: '#64748b',
      title: text,
      sub: val
    };
  }
  return {
    icon: text.slice(0,1).toUpperCase() || '•',
    iconBg: '#f1f5f9',
    iconColor: '#475569',
    title: text,
    sub: ''
  };
};

const createEl = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

export const enhanceSelect = (select) => {
  if (!select || select.dataset.enhanced === '1') return;
  if (select.closest('template')) return;
  if (select.hasAttribute('data-no-enhance')) return;

  select.style.display = 'none';
  select.dataset.enhanced = '1';

  const wrapper = createEl('div', 'custom-dropdown');
  wrapper.dataset.for = select.id || '';
  if (select.disabled) wrapper.classList.add('disabled');

  const trigger = createEl('button', 'dropdown-trigger');
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  if (select.disabled) trigger.disabled = true;

  const triggerLeft = createEl('span', '');
  triggerLeft.style.display = 'flex';
  triggerLeft.style.alignItems = 'center';
  triggerLeft.style.gap = '10px';
  triggerLeft.style.flex = '1';
  triggerLeft.style.minWidth = '0';
  triggerLeft.style.overflow = 'hidden';

  const triggerIcon = createEl('span', 'item-icon');
  triggerIcon.style.width = '28px';
  triggerIcon.style.height = '28px';
  triggerIcon.style.borderRadius = '8px';
  triggerIcon.style.display = 'grid';
  triggerIcon.style.placeItems = 'center';
  triggerIcon.style.flexShrink = '0';
  triggerIcon.style.fontSize = '11px';
  triggerIcon.style.fontWeight = '700';

  const triggerTextWrap = createEl('span', '');
  triggerTextWrap.style.flex = '1';
  triggerTextWrap.style.minWidth = '0';
  triggerTextWrap.style.display = 'flex';
  triggerTextWrap.style.flexDirection = 'column';
  triggerTextWrap.style.alignItems = 'flex-start';
  triggerTextWrap.style.overflow = 'hidden';

  const triggerTitle = createEl('span', '');
  triggerTitle.style.fontWeight = '600';
  triggerTitle.style.fontSize = '13px';
  triggerTitle.style.whiteSpace = 'nowrap';
  triggerTitle.style.overflow = 'hidden';
  triggerTitle.style.textOverflow = 'ellipsis';
  triggerTitle.style.width = '100%';

  const triggerSub = createEl('span', '');
  triggerSub.style.fontSize = '11px';
  triggerSub.style.color = '#64748b';
  triggerSub.style.whiteSpace = 'nowrap';
  triggerSub.style.overflow = 'hidden';
  triggerSub.style.textOverflow = 'ellipsis';
  triggerSub.style.width = '100%';
  triggerSub.style.display = 'none';

  triggerTextWrap.append(triggerTitle, triggerSub);
  triggerLeft.append(triggerIcon, triggerTextWrap);

  const arrow = createEl('span', 'arrow');
  arrow.style.display = 'grid';
  arrow.style.placeItems = 'center';
  arrow.style.color = '#94a3b8';
  arrow.style.transition = 'transform .18s';
  const arrowIcon = document.createElement('i');
  arrowIcon.setAttribute('data-lucide', 'chevron-down');
  arrowIcon.style.width = '16px';
  arrowIcon.style.height = '16px';
  arrow.appendChild(arrowIcon);

  trigger.append(triggerLeft, arrow);

  const menu = createEl('div', 'dropdown-menu');
  menu.setAttribute('role', 'listbox');

  // Search
  const needsSearch = select.options.length > 4 || ['project','assignee','member','user'].some(k => (select.id||'').toLowerCase().includes(k));
  let searchInput = null;
  let searchWrap = null;
  if (needsSearch) {
    searchWrap = createEl('div', '');
    searchWrap.style.padding = '8px';
    searchWrap.style.borderBottom = '1px solid #f1f5f9';
    searchWrap.style.position = 'sticky';
    searchWrap.style.top = '0';
    searchWrap.style.background = 'white';
    searchWrap.style.zIndex = '1';
    const searchBox = createEl('div', '');
    searchBox.style.position = 'relative';
    searchBox.style.display = 'flex';
    searchBox.style.alignItems = 'center';
    const searchIcon = document.createElement('i');
    searchIcon.setAttribute('data-lucide', 'search');
    searchIcon.style.position = 'absolute';
    searchIcon.style.left = '10px';
    searchIcon.style.width = '14px';
    searchIcon.style.height = '14px';
    searchIcon.style.color = '#94a3b8';
    searchInput = createEl('input', 'dropdown-search');
    searchInput.type = 'text';
    const isProject = (select.id||'').toLowerCase().includes('project');
    searchInput.placeholder = isProject ? 'Search projects...' : 'Search...';
    searchInput.style.paddingLeft = '32px';
    searchInput.addEventListener('input', () => filterItems());
    searchInput.addEventListener('keydown', (e) => {
      if (['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)) {
        e.stopPropagation();
        handleKey(e);
      } else e.stopPropagation();
    });
    searchBox.append(searchIcon, searchInput);
    searchWrap.appendChild(searchBox);
    menu.appendChild(searchWrap);
  }

  const listWrap = createEl('div', '');
  listWrap.style.maxHeight = '300px';
  listWrap.style.overflow = 'auto';
  listWrap.style.padding = '6px';
  menu.appendChild(listWrap);

  let focusedIndex = -1;

  const updateTrigger = () => {
    const opt = select.options[select.selectedIndex];
    const isProject = (select.id||'').toLowerCase().includes('project');
    const isAssignee = (select.id||'').toLowerCase().includes('assignee');
    if (!opt || !opt.value) {
      const placeholder = isProject ? 'Search or select project...' : isAssignee ? 'Search users...' : (select.getAttribute('data-placeholder') || opt?.textContent || 'Select...');
      triggerTitle.textContent = placeholder;
      triggerTitle.style.color = '#94a3b8';
      triggerTitle.style.fontWeight = '500';
      triggerSub.style.display = 'none';
      triggerIcon.textContent = isProject ? '▣' : isAssignee ? '○' : placeholder.slice(0,1).toUpperCase();
      triggerIcon.style.background = isProject ? '#eef2ff' : isAssignee ? '#f1f5f9' : '#f1f5f9';
      triggerIcon.style.color = isProject ? '#4f46e5' : '#94a3b8';
      if (window.lucide) window.lucide.createIcons();
      return;
    }
    const meta = getOptionMeta(select, opt);
    triggerTitle.style.color = '#0f172a';
    triggerTitle.style.fontWeight = '600';
    // For project, show key — name in trigger
    if ((select.id||'').toLowerCase().includes('project') && meta.sub) {
      triggerTitle.textContent = `${meta.title} — ${meta.sub}`;
      triggerSub.style.display = 'none';
    } else {
      triggerTitle.textContent = meta.title;
      if (meta.sub && meta.sub !== meta.title) {
        triggerSub.textContent = meta.sub;
        triggerSub.style.display = 'block';
      } else triggerSub.style.display = 'none';
    }
    // icon
    if (meta.isLucide) {
      triggerIcon.textContent = '';
      const i = document.createElement('i');
      i.setAttribute('data-lucide', meta.icon);
      i.style.width = '14px'; i.style.height = '14px';
      triggerIcon.appendChild(i);
      triggerIcon.style.background = meta.iconBg;
      triggerIcon.style.color = meta.iconColor;
    } else {
      triggerIcon.textContent = meta.icon;
      triggerIcon.style.background = meta.iconBg;
      triggerIcon.style.color = meta.iconColor;
    }
    triggerIcon.style.borderRadius = meta.isAvatar ? '50%' : '8px';
    if (window.lucide) window.lucide.createIcons();
  };

  const renderItems = () => {
    listWrap.textContent = '';
    const q = (searchInput?.value || '').toLowerCase().trim();
    let visible = 0;
    focusedIndex = -1;
    Array.from(select.options).forEach((opt) => {
      if (opt.disabled && !opt.value) return; // skip placeholder disabled
      const meta = getOptionMeta(select, opt);
      const hay = `${meta.title} ${meta.sub} ${meta.fullTitle||''} ${opt.value}`.toLowerCase();
      if (q && !hay.includes(q)) return;
      visible++;
      const item = createEl('div', 'dropdown-item');
      item.setAttribute('role', 'option');
      item.dataset.value = opt.value;
      item.tabIndex = -1;
      if (opt.value === select.value) item.classList.add('active');

      const icon = createEl('span', 'item-icon');
      if (meta.isLucide) {
        const i = document.createElement('i');
        i.setAttribute('data-lucide', meta.icon);
        i.style.width = '14px'; i.style.height = '14px';
        icon.appendChild(i);
      } else {
        icon.textContent = meta.icon;
      }
      icon.style.background = meta.iconBg;
      icon.style.color = meta.iconColor;
      icon.style.width = '28px'; icon.style.height = '28px';
      if (meta.isAvatar) icon.style.borderRadius = '50%';
      const metaWrap = createEl('div', 'item-meta');
      const title = createEl('div', 'item-title', meta.title);
      // For project, title is key, sub is name
      if ((select.id||'').toLowerCase().includes('project') && meta.sub) {
        title.textContent = meta.title;
        const sub = createEl('div', 'item-sub', meta.sub);
        metaWrap.append(title, sub);
      } else {
        metaWrap.append(title);
        if (meta.sub && meta.sub !== meta.title) {
          const sub = createEl('div', 'item-sub', meta.sub);
          metaWrap.append(sub);
        }
      }
      const check = createEl('span', '');
      check.style.marginLeft = 'auto';
      check.style.display = 'grid';
      check.style.placeItems = 'center';
      check.style.width = '20px'; check.style.height = '20px';
      check.style.borderRadius = '50%';
      if (opt.value === select.value) {
        check.style.background = '#4f46e5';
        check.style.color = 'white';
        const ck = document.createElement('i');
        ck.setAttribute('data-lucide', 'check');
        ck.style.width = '12px'; ck.style.height = '12px';
        check.appendChild(ck);
      }

      item.append(icon, metaWrap, check);
      item.addEventListener('click', () => {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));
        updateTrigger();
        closeMenu();
        trigger.focus();
      });
      item.addEventListener('mouseenter', () => {
        listWrap.querySelectorAll('.dropdown-item.focused').forEach(el=> el.classList.remove('focused'));
        item.classList.add('focused');
        focusedIndex = Array.from(listWrap.children).indexOf(item);
      });
      listWrap.appendChild(item);
    });
    if (!visible) {
      const empty = createEl('div', 'dropdown-empty');
      empty.style.padding = '20px';
      empty.style.textAlign = 'center';
      empty.style.color = '#94a3b8';
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', 'search-x');
      icon.style.width = '20px'; icon.style.height = '20px'; icon.style.margin = '0 auto 6px'; icon.style.display = 'block';
      const text = createEl('div', '', q ? `No results for "${q}"` : 'No options');
      text.style.fontSize = '13px';
      empty.append(icon, text);
      listWrap.appendChild(empty);
    }
    if (window.lucide) window.lucide.createIcons();
    // reset focus
    focusedIndex = visible ? Array.from(listWrap.children).findIndex(el=> el.classList.contains('active')) : -1;
    if (focusedIndex >=0) listWrap.children[focusedIndex]?.classList.add('focused');
  };

  const filterItems = () => renderItems();

  const handleKey = (e) => {
    const items = Array.from(listWrap.querySelectorAll('.dropdown-item'));
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex+1, items.length-1);
      updateFocus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex-1, 0);
      updateFocus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >=0 && items[focusedIndex]) items[focusedIndex].click();
    } else if (e.key === 'Escape') {
      closeMenu();
      trigger.focus();
    }
  };

  const updateFocus = () => {
    listWrap.querySelectorAll('.dropdown-item').forEach((el,i)=> el.classList.toggle('focused', i===focusedIndex));
    const el = listWrap.children[focusedIndex];
    if (el) el.scrollIntoView({ block:'nearest' });
  };

  const openMenu = () => {
    if (select.disabled) return;
    trigger.classList.add('open');
    menu.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    arrow.style.transform = 'rotate(180deg)';
    renderItems();
    if (searchInput) { searchInput.value = ''; searchInput.focus(); }
    // positioning: ensure not overflow viewport
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) {
        menu.style.left = 'auto';
        menu.style.right = '0';
      }
      if (rect.bottom > window.innerHeight - 8) {
        menu.style.top = 'auto';
        menu.style.bottom = 'calc(100% + 6px)';
        menu.style.maxHeight = '300px';
      }
    });
  };
  const closeMenu = () => {
    trigger.classList.remove('open');
    menu.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    arrow.style.transform = 'rotate(0deg)';
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.contains('open');
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.dropdown-trigger.open').forEach(t => { t.classList.remove('open'); t.querySelector('.arrow').style.transform='rotate(0deg)'; });
    if (isOpen) closeMenu(); else openMenu();
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!menu.classList.contains('open')) openMenu();
      else handleKey(e);
    } else if (e.key === 'Escape') closeMenu();
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
  });

  select.addEventListener('change', updateTrigger);

  const observer = new MutationObserver(() => {
    renderItems();
    updateTrigger();
  });
  observer.observe(select, { childList: true, attributes: true, attributeFilter: ['disabled'] });

  wrapper.append(trigger, menu);
  select.after(wrapper);
  updateTrigger();
};

export const enhanceAllDropdowns = () => {
  document.querySelectorAll('select.form-select').forEach((sel) => enhanceSelect(sel));
};

let moInit = false;
const initDropdownObservers = () => {
  if (moInit) return; moInit = true;
  enhanceAllDropdowns();
  const mo = new MutationObserver(() => enhanceAllDropdowns());
  mo.observe(document.body, { childList: true, subtree: true });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDropdownObservers);
} else {
  initDropdownObservers();
}
