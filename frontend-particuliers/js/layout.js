// API Go, changer si déployé ailleurs
const apiBase = 'http://localhost:8080/api';

// jwt
function getToken()      { return localStorage.getItem('uc_part_token'); }
function setToken(t)     { localStorage.setItem('uc_part_token', t); }
function clearToken()    { localStorage.removeItem('uc_part_token'); localStorage.removeItem('uc_part_user'); }
function getPartUser()   { try { return JSON.parse(localStorage.getItem('uc_part_user')); } catch { return null; } }

async function apiFetch(chemin, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
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
    const res = await fetch(`./i18n/${_lang}.json`).catch(() => fetch(`../frontend-particuliers/i18n/${_lang}.json`));
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
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const txt = t(el.getAttribute('data-i18n-title'));
    if (txt !== el.getAttribute('data-i18n-title')) el.title = txt;
  });
  document.documentElement.lang = _lang;
}

// noms de pages
const PAGE_NOMS = {
  dashboard:  'Tableau de bord',
  annonces:   'Annonces',
  formations: 'Formations & Ateliers',
  planning:   'Planning',
  depot:      'Dépôt en conteneur',
  conseils:   'Espace conseil',
  profil:     'Mon profil',
};

// sidebar
function buildSidebarHTML() {
  return `
<aside class="sidebar" id="sidebar">
  <div class="sidebar-brand">
    <img src="../brand_assets/upcycleconnect_logo_font_blanc.png"
         alt="UpcycleConnect" class="sidebar-logo"
         onerror="this.style.display='none'"/>
    <span class="sidebar-brand-text">Espace<br>Particuliers</span>
  </div>

  <nav class="sidebar-nav" aria-label="Navigation particuliers">
    <div class="nav-section">
      <span class="nav-section-label">Principal</span>
      <a href="dashboard.html" class="nav-link" data-page="dashboard">
        <i class="fa-solid fa-house" aria-hidden="true"></i>
        ${t('nav_dashboard')}
      </a>
    </div>
    <div class="nav-section">
      <span class="nav-section-label">${_lang === 'en' ? 'Activity' : 'Activité'}</span>
      <a href="annonces.html" class="nav-link" data-page="annonces">
        <i class="fa-solid fa-bullhorn" aria-hidden="true"></i>
        ${t('nav_annonces')}
        <span class="nav-badge" id="badge-annonces"></span>
      </a>
      <a href="formations.html" class="nav-link" data-page="formations">
        <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
        ${t('nav_formations')}
      </a>
      <a href="planning.html" class="nav-link" data-page="planning">
        <i class="fa-solid fa-calendar-days" aria-hidden="true"></i>
        ${t('nav_planning')}
      </a>
      <a href="depot.html" class="nav-link" data-page="depot">
        <i class="fa-solid fa-box-archive" aria-hidden="true"></i>
        ${t('nav_depot')}
      </a>
    </div>
    <div class="nav-section">
      <span class="nav-section-label">${_lang === 'en' ? 'Community' : 'Communauté'}</span>
      <a href="conseils.html" class="nav-link" data-page="conseils">
        <i class="fa-solid fa-lightbulb" aria-hidden="true"></i>
        ${_lang === 'en' ? 'Tips & advice' : 'Espace conseil'}
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
    <div class="user-avatar" id="sidebar-user-avatar">P</div>
    <div class="user-meta">
      <div class="user-name" id="sidebar-user-name">Particulier</div>
      <div class="user-score" id="sidebar-user-score">Score : —</div>
    </div>
    <button class="btn-logout" id="logout" data-i18n-title="nav_logout" title="${t('nav_logout')}" aria-label="${t('nav_logout')}">
      <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
    </button>
  </div>
</aside>`;
}

function buildTopbarHTML(nomPage) {
  const titre = PAGE_NOMS[nomPage] || nomPage;
  return `
<header class="topbar" id="topbar">
  <button class="topbar-hamburger" id="sidebar-toggle" aria-label="Menu">
    <span></span><span></span><span></span>
  </button>
  <nav class="topbar-breadcrumb" aria-label="Fil d'ariane">
    <a href="dashboard.html" class="breadcrumb-home" title="Tableau de bord">
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
      <input type="text" placeholder="${t('loading') === 'Loading...' ? 'Search...' : 'Rechercher...'}" aria-label="${_lang === 'en' ? 'Search' : 'Recherche'}"/>
    </div>
    <a href="profil.html" class="topbar-user" title="${t('nav_profil')}">
      <div class="topbar-user-avatar" id="topbar-avatar">P</div>
      <span class="topbar-user-name" id="topbar-user-name">Moi</span>
    </a>
  </div>
</header>`;
}

function injecterMiseEnPage(nomPage) {
  document.body.classList.add('part-layout');

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

  const lienActif = document.querySelector(`.nav-link[data-page="${nomPage}"]`);
  if (lienActif) lienActif.classList.add('active');

  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar?.classList.contains('open') && !sidebar.contains(e.target) && !document.getElementById('sidebar-toggle')?.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

async function verifierAuth() {
  const token = getToken();
  if (!token) { window.location.href = 'index.html'; return null; }

  // Essayer l'API
  const res = await apiFetch('/users/me');
  if (res && res.ok) {
    const user = await res.json();
    if (user.role !== 'particulier' && user.role !== 'admin') {
      clearToken(); window.location.href = 'index.html'; return null;
    }
    localStorage.setItem('uc_part_user', JSON.stringify(user));
    return user;
  }

  // mode mock, vérifier le user stocké localement
  const stored = getPartUser();
  if (stored && (stored.role === 'particulier' || stored.role === 'admin')) return stored;

  clearToken(); window.location.href = 'index.html'; return null;
}

document.addEventListener('click', e => {
  if (e.target.closest('#logout')) {
    e.preventDefault();
    clearToken();
    window.location.href = 'index.html';
  }
});

// toast
function showToast(message, type = 'success') {
  let toast = document.getElementById('toast-part');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-part';
    toast.className = 'toast-notif';
    document.body.appendChild(toast);
  }
  const icones = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  toast.className = `toast-notif toast-${type} visible`;
  toast.innerHTML = `<i class="fa-solid ${icones[type] || icones.success}" aria-hidden="true"></i> ${message}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('visible'), 3500);
}

// point d'entree
async function initLayout(nomPage) {
  await chargerTraductions();

  const utilisateur = await verifierAuth();
  if (!utilisateur) return null;

  injecterMiseEnPage(nomPage);
  applyTranslations();

  const prenom   = utilisateur.prenom || '';
  const nom      = utilisateur.nom    || '';
  const nomAff   = prenom ? `${prenom} ${nom}`.trim() : nom || 'Particulier';
  const initiale = (prenom || nom || 'P').charAt(0).toUpperCase();
  const score    = utilisateur.upcycling_score || utilisateur.score || 0;

  const nomEl    = document.getElementById('sidebar-user-name');
  const scoreEl  = document.getElementById('sidebar-user-score');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (nomEl)    nomEl.textContent    = nomAff;
  if (scoreEl)  scoreEl.textContent  = `Score : ${score} pts`;
  if (avatarEl) avatarEl.textContent = initiale;

  const tbAvatar = document.getElementById('topbar-avatar');
  const tbNom    = document.getElementById('topbar-user-name');
  if (tbAvatar) tbAvatar.textContent = initiale;
  if (tbNom)    tbNom.textContent    = prenom || nomAff.split(' ')[0] || 'Moi';

  return utilisateur;
}

// injecter Font Awesome si pas déjà là
(function() {
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const lien = document.createElement('link');
    lien.rel  = 'stylesheet';
    lien.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(lien);
  }
})();
