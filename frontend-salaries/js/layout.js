const _isLocal   = ['localhost','127.0.0.1'].includes(window.location.hostname);
const apiBase    = _isLocal ? 'http://localhost:8080/api' : window.location.origin + '/api';
const serverBase = _isLocal ? 'http://localhost:8080'     : window.location.origin;

function getToken()    { return localStorage.getItem('uc_sal_token'); }
function setToken(t)   { localStorage.setItem('uc_sal_token', t); }
function clearToken()  { localStorage.removeItem('uc_sal_token'); localStorage.removeItem('uc_sal_user'); localStorage.removeItem('uc_sal_csrf'); }
function getCsrfToken()  { return localStorage.getItem('uc_sal_csrf'); }
function setCsrfToken(t) { localStorage.setItem('uc_sal_csrf', t); }
function getSalUser()  { try { return JSON.parse(localStorage.getItem('uc_sal_user')); } catch { return null; } }

async function apiFetch(chemin, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const csrf = getCsrfToken();
  if (csrf) headers['X-CSRF-Token'] = csrf;
  try {
    const res = await fetch(`${apiBase}${chemin}`, { ...options, headers });
    if (res.status === 401) { clearToken(); window.location.href = 'index.html'; return null; }
    return res;
  } catch { return null; }
}

// i18n
let _tr = {};
let _lang = localStorage.getItem('uc_lang') || 'fr';

async function chargerTraductions() {
  try {
    const res = await fetch(`./i18n/${_lang}.json`).catch(() => fetch(`../frontend-salaries/i18n/${_lang}.json`));
    if (res && res.ok) _tr = await res.json();
  } catch {}
}

function t(cle) { return _tr[cle] || cle; }

window.setLang = function(code) {
  localStorage.setItem('uc_lang', code);
  location.reload();
};

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const txt = t(el.getAttribute('data-i18n'));
    if (txt !== el.getAttribute('data-i18n')) el.textContent = txt;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const txt = t(el.getAttribute('data-i18n-placeholder'));
    if (txt !== el.getAttribute('data-i18n-placeholder')) el.placeholder = txt;
  });
  document.documentElement.lang = _lang;
}

// sidebar et topbar
const PAGE_NOMS_SAL = {
  dashboard:   { fr: 'Tableau de bord',          en: 'Dashboard' },
  formations:  { fr: 'Gestion des formations',    en: 'Session management' },
  planning:    { fr: 'Mon planning',              en: 'My schedule' },
  conseils:    { fr: 'Gestion des conseils',      en: 'Article management' },
  moderation:  { fr: 'Modération des forums',     en: 'Forum moderation' },
  profil:      { fr: 'Mon profil',                en: 'My profile' },
};

function buildSidebarHTML() {
  return `
<aside class="sidebar" id="sidebar">
  <div class="sidebar-brand">
    <img src="../brand_assets/upcycleconnect_logo_font_blanc.png"
         alt="UpcycleConnect" class="sidebar-logo"
         onerror="this.style.display='none'"/>
    <span class="sidebar-brand-text">${_lang === 'en' ? 'Staff<br>Space' : 'Espace<br>Salariés'}</span>
  </div>

  <nav class="sidebar-nav" aria-label="${_lang === 'en' ? 'Staff navigation' : 'Navigation salariés'}">
    <div class="nav-section">
      <span class="nav-section-label">${_lang === 'en' ? 'Main' : 'Principal'}</span>
      <a href="dashboard.html" class="nav-link" data-page="dashboard">
        <i class="fa-solid fa-house" aria-hidden="true"></i>
        ${t('nav_dashboard')}
      </a>
    </div>
    <div class="nav-section">
      <span class="nav-section-label">${_lang === 'en' ? 'Management' : 'Gestion'}</span>
      <a href="formations.html" class="nav-link" data-page="formations">
        <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
        ${t('nav_formations')}
      </a>
      <a href="planning.html" class="nav-link" data-page="planning">
        <i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
        ${t('nav_planning')}
      </a>
      <a href="conseils.html" class="nav-link" data-page="conseils">
        <i class="fa-solid fa-lightbulb" aria-hidden="true"></i>
        ${t('nav_conseils')}
      </a>
      <a href="moderation.html" class="nav-link" data-page="moderation">
        <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
        ${t('nav_moderation')}
        <span class="nav-badge" id="badge-moderation"></span>
      </a>
    </div>
    <div class="nav-section">
      <span class="nav-section-label">${_lang === 'en' ? 'My account' : 'Mon compte'}</span>
      <a href="profil.html" class="nav-link" data-page="profil">
        <i class="fa-solid fa-user" aria-hidden="true"></i>
        ${t('nav_profil')}
      </a>
    </div>
  </nav>

  <div class="sidebar-footer">
    <div class="user-avatar" id="sidebar-user-avatar">S</div>
    <div class="user-meta">
      <div class="user-name" id="sidebar-user-name">${_lang === 'en' ? 'Employee' : 'Salarié'}</div>
      <div class="user-role" id="sidebar-user-role">Again²</div>
    </div>
    <button class="btn-logout" id="logout" title="${t('nav_logout')}" aria-label="${t('nav_logout')}">
      <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
    </button>
  </div>
</aside>`;
}

function buildTopbarHTML(nomPage) {
  const noms = PAGE_NOMS_SAL[nomPage];
  const titre = noms ? noms[_lang] || noms.fr : nomPage;
  return `
<header class="topbar" id="topbar">
  <button class="topbar-hamburger" id="sidebar-toggle" aria-label="Menu">
    <span></span><span></span><span></span>
  </button>
  <nav class="topbar-breadcrumb" aria-label="${_lang === 'en' ? 'Breadcrumb' : 'Fil d\'ariane'}">
    <a href="dashboard.html" class="breadcrumb-home" title="${t('nav_dashboard')}">
      <i class="fa-solid fa-house" aria-hidden="true"></i>
    </a>
    <span class="breadcrumb-sep"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
    <span class="breadcrumb-current">${titre}</span>
  </nav>
  <div class="topbar-right">
    <div class="lang-toggle" aria-label="Language selector">
      <button class="lang-btn${_lang === 'fr' ? ' active' : ''}" onclick="setLang('fr')" aria-label="Français">FR</button>
      <button class="lang-btn${_lang === 'en' ? ' active' : ''}" onclick="setLang('en')" aria-label="English">EN</button>
    </div>
    <div class="topbar-search">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input type="text" placeholder="${_lang === 'en' ? 'Search...' : 'Rechercher...'}" aria-label="${_lang === 'en' ? 'Search' : 'Recherche'}"/>
    </div>
    <div class="notif-bell-wrap" id="notif-bell-wrap">
      <button class="topbar-btn notif-bell-btn" id="notif-bell-btn" aria-label="Notifications">
        <i class="fa-solid fa-bell"></i>
        <span class="notif-badge" id="notif-badge" style="display:none">0</span>
      </button>
      <div class="notif-dropdown" id="notif-dropdown">
        <div class="notif-dropdown-header">
          <span>Notifications</span>
          <button class="notif-mark-all-btn" id="notif-mark-all">${_lang === 'en' ? 'Mark all read' : 'Tout marquer lu'}</button>
        </div>
        <div id="notif-list"><p class="notif-empty">${_lang === 'en' ? 'No notifications' : 'Aucune notification'}</p></div>
      </div>
    </div>
    <a href="profil.html" class="topbar-user" title="${t('nav_profil')}">
      <div class="topbar-user-avatar" id="topbar-avatar">S</div>
      <span class="topbar-user-name" id="topbar-user-name">Moi</span>
    </a>
  </div>
</header>`;
}

function injecterMiseEnPage(nomPage) {
  document.body.classList.add('sal-layout');

  const sbEl = document.createElement('div');
  sbEl.innerHTML = buildSidebarHTML().trim();
  document.body.insertBefore(sbEl.firstElementChild, document.body.firstChild);

  const mainContent = document.createElement('main');
  mainContent.className = 'main-content';

  const tbEl = document.createElement('div');
  tbEl.innerHTML = buildTopbarHTML(nomPage).trim();
  mainContent.appendChild(tbEl.firstElementChild);

  const pageBody = document.createElement('div');
  pageBody.className = 'page-body';

  Array.from(document.body.children)
    .filter(el => !el.classList.contains('sidebar') && !el.classList.contains('main-content'))
    .forEach(el => pageBody.appendChild(el));

  mainContent.appendChild(pageBody);
  document.body.appendChild(mainContent);

  document.querySelector(`.nav-link[data-page="${nomPage}"]`)?.classList.add('active');

  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
}

async function verifierAuth() {
  const token = getToken();
  if (!token) { window.location.href = 'index.html'; return null; }
  const res = await apiFetch('/users/me');
  if (res && res.ok) {
    const user = await res.json();
    if (user.role !== 'salarie' && user.role !== 'admin') { clearToken(); window.location.href = 'index.html'; return null; }
    localStorage.setItem('uc_sal_user', JSON.stringify(user));
    return user;
  }
  const stored = getSalUser();
  if (stored && (stored.role === 'salarie' || stored.role === 'admin')) return stored;
  clearToken(); window.location.href = 'index.html'; return null;
}

document.addEventListener('click', e => {
  if (e.target.closest('#logout')) { e.preventDefault(); clearToken(); window.location.href = 'index.html'; }
});

function showToast(message, type = 'success') {
  let toast = document.getElementById('toast-sal');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-sal';
    toast.className = 'toast-notif';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  const icones = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  toast.className = `toast-notif toast-${type} visible`;
  toast.innerHTML = `<i class="fa-solid ${icones[type] || icones.success}" aria-hidden="true"></i> ${message}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('visible'), 3500);
}

async function initLayout(nomPage) {
  await chargerTraductions();
  const utilisateur = await verifierAuth();
  if (!utilisateur) return null;
  injecterMiseEnPage(nomPage);
  applyTranslations();

  const prenom  = utilisateur.prenom || '';
  const nom     = utilisateur.nom || '';
  const nomAff  = prenom ? `${prenom} ${nom}`.trim() : nom || (t('nav_profil') === 'My profile' ? 'Employee' : 'Salarié');
  const initial = (prenom || nom || 'S').charAt(0).toUpperCase();

  const nomEl    = document.getElementById('sidebar-user-name');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  const tbAvatar = document.getElementById('topbar-avatar');
  const tbNom    = document.getElementById('topbar-user-name');
  if (nomEl)    nomEl.textContent    = nomAff;
  if (avatarEl) avatarEl.textContent = initial;
  if (tbAvatar) tbAvatar.textContent = initial;
  if (tbNom)    tbNom.textContent    = prenom || nomAff.split(' ')[0] || 'Moi';

  initNotifBell();
  return utilisateur;
}

function initNotifBell() {
  const btn      = document.getElementById('notif-bell-btn');
  const dropdown = document.getElementById('notif-dropdown');
  const badge    = document.getElementById('notif-badge');
  const list     = document.getElementById('notif-list');
  const markAll  = document.getElementById('notif-mark-all');
  if (!btn || !dropdown) return;

  let notifs = [];

  async function charger() {
    try {
      const res = await apiFetch('/notifications');
      if (res?.ok) {
        const data = await res.json();
        notifs = Array.isArray(data) ? data : [];
        const nonLues = notifs.filter(n => !n.lu).length;
        badge.textContent = nonLues > 9 ? '9+' : nonLues;
        badge.style.display = nonLues > 0 ? 'flex' : 'none';
        if (dropdown.classList.contains('open')) renderNotifs();
      }
    } catch {}
  }

  function renderNotifs() {
    if (!notifs.length) {
      list.innerHTML = `<p class="notif-empty">${_lang === 'en' ? 'No notifications' : 'Aucune notification'}</p>`;
      return;
    }
    const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
    list.innerHTML = notifs.slice(0, 8).map(n => `
      <div class="notif-item${n.lu ? '' : ' notif-unread'}" data-id="${n.id}">
        <div class="notif-item-icon"><i class="fa-solid fa-bell"></i></div>
        <div class="notif-item-body">
          <div class="notif-item-titre">${escNotif(n.titre)}</div>
          <div class="notif-item-msg">${escNotif(n.contenu)}</div>
          <div class="notif-item-date">${n.date_envoi ? new Date(n.date_envoi).toLocaleDateString(locale,{day:'2-digit',month:'short'}) : ''}</div>
        </div>
      </div>`).join('');
    list.querySelectorAll('.notif-item.notif-unread').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
        const n = notifs.find(n => String(n.id) === id);
        if (n) n.lu = true;
        el.classList.remove('notif-unread');
        const nonLues = notifs.filter(n => !n.lu).length;
        badge.textContent = nonLues > 9 ? '9+' : nonLues;
        badge.style.display = nonLues > 0 ? 'flex' : 'none';
      }, { once: true });
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.classList.toggle('open');
    if (open) charger();
  });

  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  markAll?.addEventListener('click', async () => {
    await apiFetch('/notifications/read-all', { method: 'PUT' });
    notifs.forEach(n => n.lu = true);
    badge.style.display = 'none';
    renderNotifs();
  });

  charger();
  setInterval(charger, 30000);
}

function escNotif(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

(function() {
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const lien = document.createElement('link');
    lien.rel = 'stylesheet';
    lien.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(lien);
  }
})();
