const _isLocal   = ['localhost','127.0.0.1'].includes(window.location.hostname);
const apiBase    = _isLocal ? 'http://localhost:8080/api' : window.location.origin + '/api';
const serverBase = _isLocal ? 'http://localhost:8080'     : window.location.origin;

// jwt

function getToken() {
  return localStorage.getItem('uc_admin_token');
}

function setToken(token) {
  localStorage.setItem('uc_admin_token', token);
}

function clearToken() {
  localStorage.removeItem('uc_admin_token');
  localStorage.removeItem('uc_admin_user');
  localStorage.removeItem('uc_admin_csrf');
}

function getCsrfToken() { return localStorage.getItem('uc_admin_csrf'); }
function setCsrfToken(t) { localStorage.setItem('uc_admin_csrf', t); }

function getAdminUser() {
  try { return JSON.parse(localStorage.getItem('uc_admin_user')); } catch { return null; }
}

// wrapper fetch avec le Bearer token, a utiliser au lieu de fetch() direct
async function apiFetch(chemin, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const csrf = getCsrfToken();
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const res = await fetch(`${apiBase}${chemin}`, { ...options, headers });
  if (res.status === 401) {
    // token expiré ou invalide, on deconnecte et on redirige
    clearToken();
    window.location.href = 'index.html';
    return null;
  }
  return res;
}

// i18n
let _tr = {};
let _lang = localStorage.getItem('uc_lang') || (['fr','en'].includes((navigator.language || 'fr').split('-')[0]) ? (navigator.language || 'fr').split('-')[0] : 'fr');

async function chargerTraductions() {
  try {
    const res = await fetch(`./i18n/${_lang}.json`).catch(() => fetch(`../admin/i18n/${_lang}.json`));
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

// GABARIT SIDEBAR

function buildSidebarHTML() {
  return `
<aside class="sidebar" id="sidebar">
  <a href="../index.html" class="sidebar-brand">
    <img src="../brand_assets/upcycleconnect_logo_font_blanc.png" alt="UpcycleConnect" class="sidebar-logo" onerror="this.style.display='none'"/>
  </a>

  <nav class="sidebar-nav" aria-label="${_lang === 'en' ? 'Admin navigation' : 'Navigation admin'}">
    <div class="nav-section">
      <span class="nav-section-label">${_lang === 'en' ? 'Main' : 'Principal'}</span>
      <a href="dashboard.html" class="nav-link" data-page="dashboard">
        <i class="fa-solid fa-table-columns" aria-hidden="true"></i>
        ${t('nav_dashboard')}
      </a>
    </div>

    <div class="nav-section">
      <span class="nav-section-label">${_lang === 'en' ? 'Management' : 'Gestion'}</span>
      <a href="users.html" class="nav-link" data-page="users">
        <i class="fa-solid fa-users" aria-hidden="true"></i>
        ${t('nav_users')}
      </a>
      <a href="validations.html" class="nav-link" data-page="validations">
        <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
        ${t('nav_validations')}
        <span class="nav-badge" id="badge-validations"></span>
      </a>
      <a href="categories.html" class="nav-link" data-page="categories">
        <i class="fa-solid fa-tags" aria-hidden="true"></i>
        ${t('nav_categories')}
      </a>
      <a href="prestations.html" class="nav-link" data-page="prestations">
        <i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
        ${t('nav_prestations')}
      </a>
      <a href="factures.html" class="nav-link" data-page="factures">
        <i class="fa-solid fa-file-invoice" aria-hidden="true"></i>
        ${t('nav_factures')}
      </a>
      <a href="conteneurs.html" class="nav-link" data-page="conteneurs">
        <i class="fa-solid fa-box-archive" aria-hidden="true"></i>
        ${t('nav_conteneurs')}
      </a>
      <a href="publicite.html" class="nav-link" data-page="publicite">
        <i class="fa-solid fa-rectangle-ad" aria-hidden="true"></i>
        ${t('nav_publicite')}
      </a>
      <a href="contrats.html" class="nav-link" data-page="contrats">
        <i class="fa-solid fa-file-contract" aria-hidden="true"></i>
        Contrats
      </a>
      <a href="tournees.html" class="nav-link" data-page="tournees">
        <i class="fa-solid fa-truck" aria-hidden="true"></i>
        Tournées
      </a>
      <a href="notifications.html" class="nav-link" data-page="notifications">
        <i class="fa-solid fa-bell" aria-hidden="true"></i>
        ${t('nav_notifications')}
      </a>
    </div>

    <div class="nav-section">
      <span class="nav-section-label">${_lang === 'en' ? 'Settings' : 'Paramètres'}</span>
      <a href="parametres.html" class="nav-link" data-page="parametres">
        <i class="fa-solid fa-gear" aria-hidden="true"></i>
        ${t('nav_parametres')}
      </a>
    </div>
  </nav>

  <div class="sidebar-footer">
    <div class="user-avatar" id="sidebar-user-avatar">A</div>
    <div class="user-meta">
      <div class="user-name" id="sidebar-user-name">Admin</div>
      <div class="user-role" id="sidebar-user-role">${_lang === 'en' ? 'Administrator' : 'Administrateur'}</div>
    </div>
    <button class="btn-logout" id="logout" title="${t('nav_logout')}" aria-label="${t('nav_logout')}">
      <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
    </button>
  </div>
</aside>`;
}

// noms des pages pour le breadcrumb
const PAGE_NOMS = {
  dashboard:     'Tableau de bord',
  users:         'Utilisateurs',
  validations:   'Validations',
  categories:    'Catégories',
  prestations:   'Prestations',
  factures:      'Facturation',
  conteneurs:    'Conteneurs',
  notifications: 'Notifications',
  parametres:    'Paramètres',
};

function buildTopbarHTML(nomPage) {
  const titrePages = PAGE_NOMS[nomPage] || nomPage;
  const estDashboard = nomPage === 'dashboard';
  return `
<header class="topbar" id="topbar">
  <button class="topbar-hamburger" id="sidebar-toggle" aria-label="Menu">
    <span></span><span></span><span></span>
  </button>

  <nav class="topbar-breadcrumb" aria-label="Fil d'ariane">
    <a href="dashboard.html" class="breadcrumb-home" title="Tableau de bord">
      <i class="fa-solid fa-house" aria-hidden="true"></i>
    </a>
    ${!estDashboard ? `
    <span class="breadcrumb-sep"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
    <span class="breadcrumb-current">${titrePages}</span>` : `
    <span class="breadcrumb-sep"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
    <span class="breadcrumb-current">Tableau de bord</span>`}
  </nav>

  <div class="topbar-right">
    <div class="lang-toggle" aria-label="Language selector">
      <button class="lang-btn${_lang === 'fr' ? ' active' : ''}" onclick="setLang('fr')" aria-label="Français">FR</button>
      <button class="lang-btn${_lang === 'en' ? ' active' : ''}" onclick="setLang('en')" aria-label="English">EN</button>
    </div>
    <div class="topbar-search">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input type="text" placeholder="${t('users_search')}" aria-label="${_lang === 'en' ? 'Global search' : 'Recherche globale'}"/>
    </div>
    <div class="notif-bell-wrap" id="notif-bell-wrap">
      <button class="notif-bell-btn" id="notif-bell-btn" aria-label="Notifications">
        <i class="fa-solid fa-bell" aria-hidden="true"></i>
        <span class="notif-badge" id="notif-badge" style="display:none">0</span>
      </button>
      <div class="notif-dropdown" id="notif-dropdown">
        <div class="notif-dropdown-header">
          <span>${_lang === 'en' ? 'Notifications' : 'Notifications'}</span>
          <button class="notif-mark-all-btn" id="notif-mark-all">${_lang === 'en' ? 'Mark all read' : 'Tout marquer lu'}</button>
        </div>
        <div id="notif-list"><p class="notif-empty">${_lang === 'en' ? 'No notifications' : 'Aucune notification'}</p></div>
      </div>
    </div>
    <a href="parametres.html" class="topbar-user" title="${t('nav_parametres')}">
      <div class="topbar-user-avatar" id="topbar-avatar">A</div>
      <span id="topbar-user-name">Admin</span>
      <i class="fa-solid fa-chevron-down" style="font-size:10px;color:var(--neutral-300)" aria-hidden="true"></i>
    </a>
  </div>
</header>`;
}

// on injecte la sidebar et la topbar dans toutes les pages admin
function injecterMiseEnPage() {
  const chemin = window.location.pathname;
  const estLoginPage = chemin.endsWith('index.html')
    || chemin.endsWith('/admin/')
    || chemin.endsWith('/admin');
  if (estLoginPage) return;

  document.body.classList.add('admin-layout');

  // Sidebar
  const sidebarEl = document.createElement('div');
  sidebarEl.innerHTML = buildSidebarHTML().trim();
  document.body.insertBefore(sidebarEl.firstElementChild, document.body.firstChild);

  // Main + topbar
  const nomPage = chemin.split('/').pop().replace('.html', '') || 'dashboard';
  const mainContent = document.createElement('main');
  mainContent.className = 'main-content';

  const topbarEl = document.createElement('div');
  topbarEl.innerHTML = buildTopbarHTML(nomPage).trim();
  mainContent.appendChild(topbarEl.firstElementChild);

  const pageBody = document.createElement('div');
  pageBody.className = 'page-body';

  Array.from(document.body.children)
    .filter(el => !el.classList.contains('sidebar') && !el.classList.contains('main-content'))
    .forEach(el => pageBody.appendChild(el));

  mainContent.appendChild(pageBody);
  document.body.appendChild(mainContent);

  // Lien actif selon la page courante
  const lienActif = document.querySelector(`.nav-link[data-page="${nomPage}"]`);
  if (lienActif) lienActif.classList.add('active');

  // Toggle sidebar mobile
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
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
          <div class="notif-item-titre">${escNotifAdmin(n.titre)}</div>
          <div class="notif-item-msg">${escNotifAdmin(n.contenu)}</div>
          <div class="notif-item-date">${n.date_envoi ? new Date(n.date_envoi).toLocaleDateString(locale, {day:'2-digit', month:'short'}) : ''}</div>
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

function escNotifAdmin(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// badge du nombre de validations en attente, pour le menu latéral
async function chargerBadgeValidations() {
  try {
    const res = await apiFetch('/admin/stats');
    if (!res || !res.ok) return;
    const stats = await res.json();
    const nb = (stats.annonces_en_attente || 0) + (stats.depots_en_attente || 0) + (stats.evenements_en_attente || 0);

    const badge = document.getElementById('badge-validations');
    if (badge && nb > 0) {
      badge.textContent = nb;
      badge.style.display = 'inline-block';
    }
  } catch { /* silencieux : API peut être hors ligne */ }
}

// si pas de token ou token invalide, on renvoie vers la page de connexion
async function verifierAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = 'index.html';
    return false;
  }
  const res = await apiFetch('/users/me');
  if (res && res.ok) {
    const utilisateur = await res.json();
    if (utilisateur.role !== 'admin') {
      clearToken();
      window.location.href = 'index.html';
      return false;
    }
    localStorage.setItem('uc_admin_user', JSON.stringify(utilisateur));
    return utilisateur;
  }

  // API hors ligne, fallback localStorage (mode démo)
  try {
    const stored = JSON.parse(localStorage.getItem('uc_admin_user') || '{}');
    if (stored && stored.role === 'admin') return stored;
  } catch {}
  clearToken();
  window.location.href = 'index.html';
  return false;
}

// JWT stateless donc pas de révocation serveur, on vide juste le localStorage
document.addEventListener('click', (e) => {
  if (e.target.closest('#logout')) {
    e.preventDefault();
    clearToken();
    window.location.href = 'index.html';
  }
});

// toast

function showToast(message, type = 'success') {
  let toast = document.getElementById('toast-global');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-global';
    toast.className = 'toast-notif';
    document.body.appendChild(toast);
  }
  const icones = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  toast.className = `toast-notif toast-${type} visible`;
  toast.innerHTML = `<i class="fa-solid ${icones[type] || icones.success}" aria-hidden="true"></i> ${message}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 3500);
}

// point d'entree de chaque page admin, vérifie l'auth et charge le profil
async function initLayout(_nomPage) {
  const chemin = window.location.pathname;
  const estLoginPage = chemin.endsWith('index.html')
    || chemin.endsWith('/admin/')
    || chemin.endsWith('/admin');
  if (estLoginPage) return;

  await chargerTraductions();
  const utilisateur = await verifierAuth();
  if (!utilisateur) return;

  injecterMiseEnPage();
  applyTranslations();

  // Remplir le profil dans la sidebar et la topbar
  const nomAffiche = utilisateur.prenom ? `${utilisateur.prenom} ${utilisateur.nom}` : utilisateur.nom || 'Admin';
  const initiale   = (utilisateur.nom || 'A').charAt(0).toUpperCase();

  const nomEl    = document.getElementById('sidebar-user-name');
  const roleEl   = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (nomEl)    nomEl.textContent    = nomAffiche;
  if (roleEl)   roleEl.textContent   = 'Administrateur';
  if (avatarEl) avatarEl.textContent = initiale;

  // Topbar aussi
  const topbarAvatar = document.getElementById('topbar-avatar');
  const topbarName   = document.getElementById('topbar-user-name');
  if (topbarAvatar) topbarAvatar.textContent = initiale;
  if (topbarName)   topbarName.textContent   = utilisateur.prenom || nomAffiche.split(' ')[0] || 'Admin';

  chargerBadgeValidations();
  initNotifBell();
  initOneSignal(utilisateur.id, utilisateur.role);
}

async function initOneSignal(userID, userRole) {
  try {
    const res = await fetch(`${apiBase}/config`);
    if (!res.ok) return;
    const cfg = await res.json();
    const appId = cfg.onesignal_app_id;
    if (!appId) return;

    window.OneSignalDeferred = window.OneSignalDeferred || [];

    const s = document.createElement('script');
    s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    s.defer = true;
    s.onload = () => {
      OneSignalDeferred.push(async function(OneSignal) {
        await OneSignal.init({ appId, notifyButton: { enable: true } });
        if (userID) OneSignal.User.addTag('user_id', String(userID));
        if (userRole) OneSignal.User.addTag('role', userRole);
      });
    };
    document.head.appendChild(s);
  } catch {}
}

// injecter Font Awesome si pas déjà chargé
(function() {
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const lien = document.createElement('link');
    lien.rel  = 'stylesheet';
    lien.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(lien);
  }
})();
