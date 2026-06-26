const _isLocal   = ['localhost','127.0.0.1'].includes(window.location.hostname);
const apiBase    = _isLocal ? 'http://localhost:8080/api' : window.location.origin + '/api';
const serverBase = _isLocal ? 'http://localhost:8080'     : window.location.origin;

// jwt
function getToken()      { return localStorage.getItem('uc_part_token'); }
function setToken(t)     { localStorage.setItem('uc_part_token', t); }
function clearToken()    { localStorage.removeItem('uc_part_token'); localStorage.removeItem('uc_part_user'); localStorage.removeItem('uc_part_csrf'); }
function getCsrfToken()  { return localStorage.getItem('uc_part_csrf'); }
function setCsrfToken(t) { localStorage.setItem('uc_part_csrf', t); }
function getPartUser()   { try { return JSON.parse(localStorage.getItem('uc_part_user')); } catch { return null; } }

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
      <div class="user-score" id="sidebar-user-score">Score : -</div>
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
    <div class="notif-bell-wrap" id="notif-bell-wrap">
      <button class="topbar-btn notif-bell-btn" id="notif-bell-btn" aria-label="Notifications">
        <i class="fa-solid fa-bell"></i>
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

  initNotifBell();
  chargerBadgeMessages();
  initOneSignal(utilisateur.id);

  if (utilisateur.tutoriel_vu === false || utilisateur.tutoriel_vu === 0) {
    lancerTutoriel();
  }

  return utilisateur;
}

async function initOneSignal(userID) {
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
        if (userID) {
          OneSignal.User.addTag('user_id', String(userID));
        }
      });
    };
    document.head.appendChild(s);
  } catch {}
}

function lancerTutoriel() {
  // charge GSAP à la demande, uniquement à la première connexion
  if (!window.gsap) {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
    s.onload = lancerTutoriel;
    document.head.appendChild(s);
    return;
  }

  const etapes = [
    { titre: 'Bienvenue sur UpcycleConnect !',  texte: 'Votre espace particulier vous permet de déposer des objets, créer des projets upcycling et gagner des points.',            icone: 'fa-seedling'   },
    { titre: 'Dépôt en conteneur',               texte: 'Déposez vos objets dans un conteneur UpcycleConnect proche de chez vous et gagnez des points à chaque dépôt.',             icone: 'fa-box-archive' },
    { titre: 'Projets upcycling',                texte: 'Créez et suivez vos projets de transformation. Chaque nouveau projet vous rapporte +15 points.',                            icone: 'fa-hammer'     },
    { titre: 'Score et communauté',              texte: 'Votre score upcycling reflète votre engagement écologique. Publiez vos projets pour inspirer la communauté !',              icone: 'fa-star'       },
  ];

  let etape = 0;

  const overlay = document.createElement('div');
  overlay.id = 'tuto-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0)';

  const card = document.createElement('div');
  card.id = 'tuto-card';
  card.style.cssText = 'background:#fff;border-radius:16px;padding:40px 36px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25);will-change:transform,opacity';
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // fondu d'entrée de l'overlay
  gsap.to(overlay, { background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(3px)', duration: 0.4, ease: 'power2.out' });

  function renderContent() {
    const e = etapes[etape];
    card.innerHTML = `
      <div style="width:64px;height:64px;border-radius:50%;background:#d1fae5;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
        <i class="fa-solid ${e.icone}" style="font-size:28px;color:#15803d"></i>
      </div>
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted,#6b7280);margin-bottom:8px">Étape ${etape + 1} / ${etapes.length}</div>
      <h2 style="font-family:Poppins,sans-serif;font-size:20px;font-weight:700;margin:0 0 12px">${e.titre}</h2>
      <p style="font-size:14px;color:var(--text-soft,#4b5563);line-height:1.65;margin:0 0 28px">${e.texte}</p>
      <div style="display:flex;gap:10px;justify-content:center">
        ${etape > 0 ? `<button id="tuto-prev" class="btn btn-outline" style="min-width:90px">Précédent</button>` : ''}
        <button id="tuto-next" class="btn btn-primary" style="min-width:110px">${etape === etapes.length - 1 ? 'Commencer !' : 'Suivant'}</button>
      </div>
      <div style="display:flex;justify-content:center;gap:6px;margin-top:20px">
        ${etapes.map((_, i) => `<span style="width:8px;height:8px;border-radius:50%;background:${i === etape ? '#16a34a' : '#d1d5db'}"></span>`).join('')}
      </div>`;

    card.querySelector('#tuto-next')?.addEventListener('click', () => {
      if (etape < etapes.length - 1) allerA(etape + 1, 1);
      else fermer();
    });
    card.querySelector('#tuto-prev')?.addEventListener('click', () => allerA(etape - 1, -1));
  }

  function animerEntree(direction) {
    gsap.fromTo(card,
      { opacity: 0, x: direction * 50, scale: 0.95 },
      { opacity: 1, x: 0, scale: 1, duration: 0.38, ease: 'back.out(1.5)' }
    );
  }

  function allerA(nouvelleEtape, direction) {
    gsap.to(card, {
      opacity: 0, x: direction * -40, scale: 0.96, duration: 0.2, ease: 'power2.in',
      onComplete: () => {
        etape = nouvelleEtape;
        renderContent();
        animerEntree(direction);
      },
    });
  }

  async function fermer() {
    gsap.to(card, { opacity: 0, y: -24, scale: 0.94, duration: 0.25, ease: 'power2.in' });
    gsap.to(overlay, {
      opacity: 0, duration: 0.4, delay: 0.15, ease: 'power2.in',
      onComplete: async () => {
        overlay.remove();
        await apiFetch('/users/tutorial', { method: 'POST' });
      },
    });
  }

  renderContent();
  animerEntree(1);
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

async function chargerBadgeMessages() {
  try {
    const res = await apiFetch('/annonces/mes-conversations/count');
    if (!res?.ok) return;
    const data = await res.json();
    const badge = document.getElementById('badge-annonces');
    if (!badge) return;
    if (data.count > 0) {
      badge.textContent = data.count > 9 ? '9+' : data.count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  } catch {}
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
