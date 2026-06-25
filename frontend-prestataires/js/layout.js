const apiBase    = window.location.origin + '/api';
const serverBase = window.location.origin;

// jwt helpers
function getToken()        { return localStorage.getItem('uc_pro_token'); }
function setToken(token)   { localStorage.setItem('uc_pro_token', token); }
function clearToken()      {
  localStorage.removeItem('uc_pro_token');
  localStorage.removeItem('uc_pro_user');
  localStorage.removeItem('uc_pro_csrf');
}
function getCsrfToken()  { return localStorage.getItem('uc_pro_csrf'); }
function setCsrfToken(t) { localStorage.setItem('uc_pro_csrf', t); }
function getProUser() {
  try { return JSON.parse(localStorage.getItem('uc_pro_user')); } catch { return null; }
}

// Fetch authentifié, à utiliser partout
async function apiFetch(chemin, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const csrf = getCsrfToken();
  if (csrf) headers['X-CSRF-Token'] = csrf;
  try {
    const res = await fetch(`${apiBase}${chemin}`, { ...options, headers });
    if (res.status === 401) {
      clearToken();
      window.location.href = 'index.html';
      return null;
    }
    return res;
  } catch {
    return null;
  }
}

// i18n
let _translations = {};
let _lang = localStorage.getItem('uc_lang') || 'fr';

async function chargerTraductions() {
  try {
    const res = await fetch(`./i18n/${_lang}.json`).catch(() =>
      fetch(`../frontend-prestataires/i18n/${_lang}.json`)
    );
    if (res && res.ok) _translations = await res.json();
  } catch {}
}

function t(cle) { return _translations[cle] || cle; }

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

// gabarit sidebar
const PAGE_NOMS = {
  dashboard:    'Tableau de bord',
  annonces:     'Annonces matériaux',
  conteneurs:   'Conteneurs',
  projets:      'Mes projets',
  alertes:      'Alertes matériaux',
  stats:        'Statistiques & rapports',
  abonnement:   'Mon abonnement',
  profil:       'Mon profil',
};

function buildSidebarHTML() {
  return `
<aside class="sidebar" id="sidebar">
  <div class="sidebar-brand">
    <img src="../brand_assets/upcycleconnect_logo_font_blanc.png"
         alt="UpcycleConnect" class="sidebar-logo"
         onerror="this.style.display='none'"/>
    <span class="sidebar-brand-text">Espace<br>Professionnel</span>
  </div>

  <nav class="sidebar-nav" aria-label="Navigation professionnels">
    <div class="nav-section">
      <span class="nav-section-label">${t('nav_section_principal')}</span>
      <a href="dashboard.html" class="nav-link" data-page="dashboard">
        <i class="fa-solid fa-table-columns" aria-hidden="true"></i>
        ${t('nav_dashboard')}
      </a>
    </div>

    <div class="nav-section">
      <span class="nav-section-label">${t('nav_section_gestion')}</span>
      <a href="annonces.html" class="nav-link" data-page="annonces">
        <i class="fa-solid fa-box-open" aria-hidden="true"></i>
        ${t('nav_annonces')}
        <span class="nav-badge" id="badge-annonces"></span>
      </a>
      <a href="conteneurs.html" class="nav-link" data-page="conteneurs">
        <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
        ${t('nav_conteneurs')}
      </a>
      <a href="projets.html" class="nav-link" data-page="projets">
        <i class="fa-solid fa-diagram-project" aria-hidden="true"></i>
        ${t('nav_projets')}
      </a>
      <a href="alertes.html" class="nav-link" data-page="alertes">
        <i class="fa-solid fa-bell" aria-hidden="true"></i>
        ${t('nav_alertes')}
        <span class="nav-badge" id="badge-alertes"></span>
      </a>
    </div>

    <div class="nav-section">
      <span class="nav-section-label">${t('nav_section_compte')}</span>
      <a href="stats.html" class="nav-link" data-page="stats">
        <i class="fa-solid fa-chart-line" aria-hidden="true"></i>
        ${_lang === 'en' ? 'Statistics' : 'Statistiques'}
      </a>
      <a href="abonnement.html" class="nav-link" data-page="abonnement">
        <i class="fa-solid fa-crown" aria-hidden="true"></i>
        ${t('nav_abonnement')}
      </a>
      <a href="profil.html" class="nav-link" data-page="profil">
        <i class="fa-solid fa-user-tie" aria-hidden="true"></i>
        ${t('nav_profil')}
      </a>
    </div>
  </nav>

  <div class="sidebar-footer">
    <div class="user-avatar" id="sidebar-user-avatar">P</div>
    <div class="user-meta">
      <div class="user-name" id="sidebar-user-name">Professionnel</div>
      <div class="user-plan" id="sidebar-user-plan">${_lang === 'en' ? 'Free plan' : 'Plan Gratuit'}</div>
    </div>
    <button class="btn-logout" id="logout" title="${t('btn_deconnexion')}" aria-label="${t('btn_deconnexion')}">
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
      <input type="text" placeholder="${_lang === 'en' ? 'Search...' : 'Rechercher...'}" aria-label="${_lang === 'en' ? 'Search' : 'Recherche'}"/>
    </div>
    <a href="alertes.html" class="topbar-btn" title="${t('nav_alertes')}">
      <i class="fa-solid fa-sliders" aria-hidden="true"></i>
      <span class="dot" id="topbar-alert-dot" style="display:none"></span>
    </a>
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
      <div class="topbar-user-avatar" id="topbar-avatar">P</div>
      <span class="topbar-user-name" id="topbar-user-name">Pro</span>
    </a>
  </div>
</header>`;
}

function injecterMiseEnPage() {
  const chemin = window.location.pathname;
  const estLogin = chemin.endsWith('index.html')
    || chemin.endsWith('/frontend-prestataires/')
    || chemin.endsWith('/frontend-prestataires');
  if (estLogin) return;

  document.body.classList.add('pro-layout');

  // Sidebar
  const sbEl = document.createElement('div');
  sbEl.innerHTML = buildSidebarHTML().trim();
  document.body.insertBefore(sbEl.firstElementChild, document.body.firstChild);

  // Main content wrapper
  const nomPage = chemin.split('/').pop().replace('.html', '') || 'dashboard';
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

  // Lien actif
  const lienActif = document.querySelector(`.nav-link[data-page="${nomPage}"]`);
  if (lienActif) lienActif.classList.add('active');

  // Toggle sidebar mobile
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
}

async function chargerBadgeAnnonces() {
  try {
    const res = await apiFetch('/annonces?statut=validee&limit=1');
    if (!res || !res.ok) return;
    const data = await res.json();
    const nb = Array.isArray(data) ? data.length : 0;
    const badge = document.getElementById('badge-annonces');
    if (badge && nb > 0) {
      badge.textContent = nb > 99 ? '99+' : nb;
      badge.style.display = 'inline-block';
    }
  } catch {}
}

async function verifierAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = 'index.html';
    return false;
  }
  const res = await apiFetch('/users/me');
  if (res && res.ok) {
    const utilisateur = await res.json();
    if (utilisateur.role !== 'professionnel' && utilisateur.role !== 'admin') {
      clearToken();
      window.location.href = 'index.html';
      return false;
    }
    localStorage.setItem('uc_pro_user', JSON.stringify(utilisateur));
    return utilisateur;
  }

  // API hors ligne, fallback localStorage (mode démo)
  const stored = getProUser();
  if (stored && (stored.role === 'professionnel' || stored.role === 'admin')) return stored;
  clearToken();
  window.location.href = 'index.html';
  return false;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#logout')) {
    e.preventDefault();
    clearToken();
    window.location.href = 'index.html';
  }
});

// toast
function showToast(message, type = 'success') {
  let toast = document.getElementById('toast-pro');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-pro';
    toast.className = 'toast-notif';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  const icones = {
    success: 'fa-circle-check',
    error:   'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info:    'fa-circle-info',
  };
  toast.className = `toast-notif toast-${type} visible`;
  toast.innerHTML = `<i class="fa-solid ${icones[type] || icones.success}" aria-hidden="true"></i> ${message}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('visible'), 3500);
}

// point d'entree de chaque page prestataire, vérifie le token et charge l'identite
async function initLayout(nomPage) {
  const chemin = window.location.pathname;
  const estLogin = chemin.endsWith('index.html')
    || chemin.endsWith('/frontend-prestataires/')
    || chemin.endsWith('/frontend-prestataires');
  if (estLogin) return null;

  await chargerTraductions();

  const utilisateur = await verifierAuth();
  if (!utilisateur) return null;

  injecterMiseEnPage();
  applyTranslations();

  // Remplir identité sidebar
  const prenom   = utilisateur.prenom || '';
  const nom      = utilisateur.nom    || '';
  const nomAff   = prenom ? `${prenom} ${nom}`.trim() : nom || 'Professionnel';
  const initiale = (prenom || nom || 'P').charAt(0).toUpperCase();
  const plan     = utilisateur.plan || utilisateur.abonnement || 'gratuit';

  const nomEl    = document.getElementById('sidebar-user-name');
  const planEl   = document.getElementById('sidebar-user-plan');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (nomEl)    nomEl.textContent    = nomAff;
  if (planEl)   planEl.textContent   = plan === 'premium' ? 'Plan Premium' : 'Plan Gratuit';
  if (avatarEl) avatarEl.textContent = initiale;

  const tbAvatar = document.getElementById('topbar-avatar');
  const tbNom    = document.getElementById('topbar-user-name');
  if (tbAvatar) tbAvatar.textContent = initiale;
  if (tbNom)    tbNom.textContent    = prenom || nomAff.split(' ')[0] || 'Pro';

  chargerBadgeAnnonces();
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

// injecter Font Awesome si pas déjà là
(function() {
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const lien = document.createElement('link');
    lien.rel  = 'stylesheet';
    lien.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(lien);
  }
})();
