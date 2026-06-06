// Base de l'API Go, penser à changer si on déploie ailleurs
const apiBase = 'http://localhost:8080/api';

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
}

function getAdminUser() {
  try { return JSON.parse(localStorage.getItem('uc_admin_user')); } catch { return null; }
}

// wrapper fetch avec le Bearer token, a utiliser au lieu de fetch() direct
async function apiFetch(chemin, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
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
let _lang = localStorage.getItem('uc_lang') || 'fr';

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
  <div class="sidebar-brand">
    <img src="../brand_assets/upcycleconnect_logo_font_blanc.png" alt="UpcycleConnect" class="sidebar-logo" onerror="this.style.display='none'"/>
  </div>

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
  prestations:   'Événements',
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
    <a href="validations.html" class="topbar-btn" title="${t('nav_validations')}" id="topbar-notif-btn">
      <i class="fa-solid fa-bell" aria-hidden="true"></i>
      <span class="dot" id="topbar-notif-dot" style="display:none"></span>
    </a>
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

// badge du nombre de validations en attente, pour le menu latéral
async function chargerBadgeValidations() {
  try {
    const res = await apiFetch('/admin/stats');
    if (!res || !res.ok) return;
    const stats = await res.json();
    const nb = stats.annonces_en_attente || 0;

    const badge = document.getElementById('badge-validations');
    if (badge && nb > 0) {
      badge.textContent = nb;
      badge.style.display = 'inline-block';
    }
    // Allumer le point rouge sur la cloche topbar
    const dot = document.getElementById('topbar-notif-dot');
    if (dot && nb > 0) dot.style.display = 'block';
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
    const stored = JSON.parse(localStorage.getItem('uc_user') || '{}');
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
