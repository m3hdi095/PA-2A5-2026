// point d'entree de l'espace particuliers
// On appelle l'API Go sur le port 8080, penser à changer si on déploie ailleurs.
const API_BASE = 'http://localhost:8080';

// TODO: ajouter un sélecteur de langue dans le header (EN, FR)
let t = {};

async function loadI18n() {
  // On charge les traductions depuis le fichier JSON, zero texte hardcodé en HTML
  const res = await fetch('./i18n/fr.json');
  t = await res.json();
}

// raccourci pour les traductions, evite d'ecrire t[cle] partout
function _(cle) {
  return t[cle] || cle;
}

/*  AUTH (token JWT dans localStorage)  */

function getToken() {
  return localStorage.getItem('uc_token');
}

function setToken(token) {
  localStorage.setItem('uc_token', token);
}

function clearToken() {
  localStorage.removeItem('uc_token');
  localStorage.removeItem('uc_user');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('uc_user'));
  } catch {
    // Ici le JSON est peut-être corrompu, on retourne null proprement
    return null;
  }
}

function setUser(utilisateur) {
  localStorage.setItem('uc_user', JSON.stringify(utilisateur));
}

/*  APPELS API  */

// tous les appels API passent par ici, ca ajoute le token Bearer automatiquement
async function apiFetch(chemin, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${chemin}`, { ...options, headers });

  // FIXME: améliorer la gestion des codes 401 (rediriger vers login directement)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function apiLogin(email, motDePasse) {
  const data = await apiFetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: motDePasse }),
  });
  setToken(data.token);
}

async function apiRegister(payload) {
  // On force le rôle "particulier", les pros s'inscrivent ailleurs
  return apiFetch('/api/register', {
    method: 'POST',
    body: JSON.stringify({ ...payload, role: 'particulier' }),
  });
}

async function apiMe() {
  const utilisateur = await apiFetch('/api/users/me');
  setUser(utilisateur);
  return utilisateur;
}

async function apiListAnnonces(page = 1) {
  return apiFetch(`/api/annonces?page=${page}`);
}

async function apiCreateAnnonce(payload) {
  return apiFetch('/api/annonces', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function apiListEvenements(page = 1) {
  return apiFetch(`/api/evenements?page=${page}`);
}

// TODO: implémenter apiGetScore() quand l'endpoint /api/users/score sera disponible

/*  TOAST  */

const elToast = document.getElementById('toast');
let timerToast;

function showToast(msg, type = 'success') {
  elToast.textContent = msg;
  elToast.className = `toast${type === 'error' ? ' error' : ''} visible`;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => elToast.classList.remove('visible'), 3500);
}

/*  NAVIGATION*/

function showSection(nom) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.navbar-nav li a').forEach(a => a.classList.remove('active'));
  const section = document.getElementById(`section-${nom}`);
  if (section) section.classList.add('active');
  const lien = document.querySelector(`[data-nav="${nom}"]`);
  if (lien) lien.classList.add('active');
}

/*  AUTH PANEL  */

function showAuthPage() {
  document.getElementById('auth-page').style.display = 'flex';
  document.getElementById('app').classList.remove('visible');
}

function showApp() {
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('app').classList.add('visible');
}

function toggleAuthMode(mode) {
  const formLogin    = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const titre        = document.getElementById('auth-title');
  if (mode === 'register') {
    formLogin.style.display    = 'none';
    formRegister.style.display = 'block';
    titre.textContent          = _('auth_register_title');
  } else {
    formLogin.style.display    = 'block';
    formRegister.style.display = 'none';
    titre.textContent          = _('auth_login_title');
  }
  clearAuthError();
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.add('visible');
}

function clearAuthError() {
  document.getElementById('auth-error').classList.remove('visible');
}

/*  DASHBOARD  */

async function loadDashboard() {
  const utilisateur = getUser();
  if (utilisateur) {
    const prenom = utilisateur.prenom || utilisateur.nom || '';
    document.getElementById('welcome-name').textContent = `${_('dashboard_welcome')}, ${prenom}`;
    document.getElementById('welcome-name-title').textContent = `${_('dashboard_welcome')}, ${prenom} !`;
  }
  await Promise.all([loadAnnoncesPreview(), loadPlanningPreview()]);
}

async function loadAnnoncesPreview() {
  const container = document.getElementById('dashboard-annonces');
  container.innerHTML = `<p class="loading">${_('loading')}</p>`;
  try {
    const listeAnnonces = await apiListAnnonces(1);
    const annonces = listeAnnonces || [];

    // On met à jour le compteur dans la stat card
    const elCount = document.getElementById('stat-annonces-count');
    if (elCount) elCount.textContent = annonces.length;

    renderAnnoncesCards(container, annonces.slice(0, 4));
  } catch {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
      <span>${_('error_network')}</span>
    </div>`;
  }
}

async function loadPlanningPreview() {
  const container = document.getElementById('planning-list');
  container.innerHTML = `<p class="loading">${_('loading')}</p>`;
  try {
    const evenements = await apiListEvenements(1);
    renderPlanning(container, (evenements || []).slice(0, 5));
  } catch {
    // Fallback sur des événements mockés si l'API ne répond pas
    renderPlanning(container, getEvenementsMock());
  }
}

// Quelques événements de démonstration pour ne pas avoir un planning vide
function getEvenementsMock() {
  return [
    { titre: 'Atelier palettes', lieu: 'Paris 11e',  date_debut: '2026-05-03T10:00:00Z' },
    { titre: 'Collecte vêtements', lieu: 'Montreuil', date_debut: '2026-05-10T09:00:00Z' },
    { titre: 'Formation upcycling textile', lieu: 'Paris 20e', date_debut: '2026-05-17T14:00:00Z' },
  ];
}

/*  ANNONCES  */

function renderAnnoncesCards(container, annonces) {
  if (!annonces || annonces.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-box-open" aria-hidden="true"></i>
      <span>${_('dashboard_no_annonces')}</span>
    </div>`;
    return;
  }
  container.innerHTML = annonces.map(a => `
    <div class="annonce-card">
      ${buildBadge(a.type_annonce)}
      <div class="annonce-titre">${escHtml(a.titre)}</div>
      <div class="annonce-desc">${escHtml(a.description || '')}</div>
      <div class="annonce-prix">${a.prix > 0 ? `${a.prix.toFixed(2)} €` : _('annonce_gratuit')}</div>
    </div>
  `).join('');
}

// badge coloré selon le type d'annonce (don, vente...)
function buildBadge(type) {
  const badges = {
    don:   { cls: 'badge-don',   icone: 'fa-hand-holding-heart', label: _('annonce_type_don') },
    vente: { cls: 'badge-vente', icone: 'fa-tag',                label: _('annonce_type_vente') },
  };
  const b = badges[type] || { cls: 'badge-don', icone: 'fa-circle', label: type || '' };
  return `<span class="annonce-badge ${b.cls}">
    <i class="fa-solid ${b.icone}" aria-hidden="true"></i>${b.label}
  </span>`;
}

async function loadAllAnnonces() {
  const container = document.getElementById('annonces-grid');
  container.innerHTML = `<p class="loading">${_('loading')}</p>`;
  try {
    const listeAnnonces = await apiListAnnonces(1);
    renderAnnoncesCards(container, listeAnnonces || []);
  } catch {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
      <span>${_('error_network')}</span>
    </div>`;
  }
}

/*  PLANNING  */

function renderPlanning(container, evenements) {
  if (!evenements || evenements.length === 0) {
    container.innerHTML = `<p class="empty-state">
      <i class="fa-solid fa-calendar-xmark" aria-hidden="true"></i>
      <span>${_('planning_no_events')}</span>
    </p>`;
    return;
  }
  const mois = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  container.innerHTML = evenements.map(e => {
    const d = new Date(e.date_debut);
    return `
      <div class="planning-item">
        <div class="planning-date">
          <div class="day">${d.getDate()}</div>
          <div class="month">${mois[d.getMonth()]}</div>
        </div>
        <div class="planning-info">
          <div class="planning-title">${escHtml(e.titre)}</div>
          ${e.lieu ? `<div class="planning-lieu">
            <i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escHtml(e.lieu)}
          </div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function loadPlanningFull() {
  const container = document.getElementById('planning-list-full');
  container.innerHTML = `<p class="loading">${_('loading')}</p>`;
  try {
    const evenements = await apiListEvenements(1);
    renderPlanning(container, evenements || []);
  } catch {
    renderPlanning(container, getEvenementsMock());
  }
}

/*  FORMATIONS & ATELIERS  */

const ICONES_TYPE = {
  formation: 'fa-graduation-cap',
  atelier:   'fa-screwdriver-wrench',
  evenement: 'fa-calendar-days',
};

async function loadFormations(filtre = '') {
  const container = document.getElementById('formations-grid');
  container.innerHTML = `<p class="loading">${_('loading')}</p>`;
  try {
    let evenements = await apiListEvenements(1);
    if (filtre) evenements = (evenements || []).filter(e => e.type === filtre);
    renderFormations(container, evenements || []);
  } catch {
    // Fallback sur mocks si l'API est indisponible
    let mocks = getEvenementsMock().map((e, i) => ({
      ...e, id: i + 1, type: ['formation','atelier','evenement'][i % 3],
      prix: [35, 0, 80][i % 3], places_max: 12, places_prises: [8, 0, 6][i % 3],
    }));
    if (filtre) mocks = mocks.filter(e => e.type === filtre);
    renderFormations(container, mocks);
  }
}

function renderFormations(container, evenements) {
  if (!evenements.length) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
      <span>${_('formation_no_events')}</span>
    </div>`;
    return;
  }
  const typeLabels = { formation: _('formation_type_formation'), atelier: _('formation_type_atelier'), evenement: _('formation_type_evenement') };
  const typeBadges = { formation: 'badge-formation', atelier: 'badge-atelier', evenement: 'badge-evenement' };
  const mois = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  container.innerHTML = evenements.map(e => {
    const d       = e.date_debut ? new Date(e.date_debut) : null;
    const dateStr = d ? `${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}` : '';
    const places  = e.places_max ? e.places_max - (e.places_prises || 0) : null;
    const complet = places !== null && places <= 0;
    const icone   = ICONES_TYPE[e.type] || ICONES_TYPE.evenement;
    const badge   = typeBadges[e.type] || 'badge-evenement';
    return `
      <div class="formation-card">
        <div class="formation-card-header">
          <i class="fa-solid ${icone}" aria-hidden="true"></i>
          <span class="annonce-badge ${badge}" style="position:absolute;top:10px;right:10px">
            ${escHtml(typeLabels[e.type] || e.type)}
          </span>
        </div>
        <div class="formation-card-body">
          <div class="formation-titre">${escHtml(e.titre)}</div>
          <div class="formation-meta">
            ${dateStr ? `<span><i class="fa-solid fa-calendar-days" aria-hidden="true"></i>${dateStr}</span>` : ''}
            ${e.lieu  ? `<span><i class="fa-solid fa-location-dot" aria-hidden="true"></i>${escHtml(e.lieu)}</span>` : ''}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="formation-prix">${e.prix ? e.prix + ' €' : _('formation_gratuit')}</div>
            ${places !== null
              ? `<div class="formation-places${complet ? ' complet' : ''}">
                   ${complet ? _('formation_complet') : places + ' ' + _('formation_places_restantes')}
                 </div>`
              : ''}
          </div>
          <button class="btn btn-primary btn-sm" style="width:100%;justify-content:center"
            onclick="inscrireFormation(${e.id})" ${complet ? 'disabled' : ''}>
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            ${_('formation_btn_inscrire')}
          </button>
        </div>
      </div>`;
  }).join('');
}

window.inscrireFormation = _id => {
  // TODO: appel POST /api/evenements/{_id}/inscription quand l'endpoint sera dispo
  showToast(_('formation_inscription_ok'));
};

/*  DÉPÔT EN CONTENEUR  */

let annonceDepotSelectionnee = null;

async function loadDepot() {
  const container = document.getElementById('depot-annonces-list');
  container.innerHTML = `<p class="loading">${_('loading')}</p>`;
  try {
    const listeAnnonces = await apiListAnnonces(1);
    // On filtre uniquement les annonces validées
    const validees = (listeAnnonces || []).filter(a => a.statut === 'validee' || a.statut === 'publiee' || a.statut === 'validée');
    renderDepotAnnonces(container, validees);
  } catch {
    // Fallback : montrer un état vide clair
    renderDepotAnnonces(container, []);
  }
}

function renderDepotAnnonces(container, annonces) {
  if (!annonces.length) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-box-open" aria-hidden="true"></i>
      <span>${_('depot_no_annonces')}</span>
    </div>`;
    return;
  }
  container.innerHTML = annonces.map(a => `
    <div class="depot-item">
      <div class="depot-item-info">
        <div class="depot-item-titre">${escHtml(a.titre)}</div>
        <div class="depot-item-meta">
          <span class="annonce-badge ${a.type_annonce === 'don' ? 'badge-don' : 'badge-vente'}">
            ${escHtml(a.type_annonce || '')}
          </span>
          <span class="annonce-badge" style="background:var(--color-success-bg);color:var(--color-success-text)">
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            ${_('depot_statut_valide')}
          </span>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="ouvrirModalDepot(${a.id}, '${escHtml(a.titre)}')">
        <i class="fa-solid fa-box-archive" aria-hidden="true"></i>
        ${_('depot_btn_demander')}
      </button>
    </div>
  `).join('');
}

window.ouvrirModalDepot = (id, titre) => {
  annonceDepotSelectionnee = id;
  document.getElementById('depot-annonce-name').textContent = titre;
  document.getElementById('modal-depot').classList.add('visible');
};

function fermerModalDepot() {
  document.getElementById('modal-depot').classList.remove('visible');
  annonceDepotSelectionnee = null;
}

async function confirmerDepot() {
  if (!annonceDepotSelectionnee) return;
  try {
    // TODO: appel POST /api/conteneurs/demande quand l'endpoint sera disponible
    // await apiFetch('/api/conteneurs/demande', { method: 'POST', body: JSON.stringify({ annonce_id: annonceDepotSelectionnee }) });
    showToast(_('depot_succes'));
  } catch (err) {
    showToast(_('error_network'), 'error');
  } finally {
    fermerModalDepot();
  }
}

/*  PROFIL  */

function loadProfil() {
  const utilisateur = getUser();
  if (!utilisateur) return;
  document.getElementById('profil-prenom').value    = utilisateur.prenom || '';
  document.getElementById('profil-nom').value       = utilisateur.nom    || '';
  document.getElementById('profil-email').value     = utilisateur.email  || '';
  document.getElementById('profil-telephone').value = utilisateur.telephone || '';
  document.getElementById('profil-adresse').value   = utilisateur.adresse   || '';

  // Initiales dans l'avatar
  const initiales = ((utilisateur.prenom || '').charAt(0) + (utilisateur.nom || '').charAt(0)).toUpperCase() || 'UC';
  document.getElementById('profil-avatar-initiales').textContent = initiales;

  hideMsgProfil();
}

function showMsgProfil(msg, type) {
  const el = document.getElementById('profil-msg');
  el.textContent = msg;
  el.className = `profil-msg ${type}`;
}

function hideMsgProfil() {
  document.getElementById('profil-msg').className = 'profil-msg';
}

async function submitProfil(e) {
  e.preventDefault();
  const payload = {
    prenom:    document.getElementById('profil-prenom').value.trim(),
    nom:       document.getElementById('profil-nom').value.trim(),
    telephone: document.getElementById('profil-telephone').value.trim(),
    adresse:   document.getElementById('profil-adresse').value.trim(),
  };
  try {
    const utilisateur = getUser();
    // TODO: appel PUT /api/users/me quand l'endpoint sera disponible
    // await apiFetch('/api/users/me', { method: 'PUT', body: JSON.stringify(payload) });
    // Pour l'instant on met à jour le localStorage directement
    setUser({ ...utilisateur, ...payload });
    const initiales = (payload.prenom.charAt(0) + payload.nom.charAt(0)).toUpperCase() || 'UC';
    document.getElementById('profil-avatar-initiales').textContent = initiales;
    document.getElementById('welcome-name').textContent = `${_('dashboard_welcome')}, ${payload.prenom}`;
    showMsgProfil(_('profil_save_ok'), 'success');
  } catch {
    showMsgProfil(_('profil_save_error'), 'error');
  }
}

/*  MODAL NOUVELLE ANNONCE  */

function openModalAnnonce() {
  document.getElementById('modal-annonce').classList.add('visible');
}

function closeModalAnnonce() {
  document.getElementById('modal-annonce').classList.remove('visible');
  document.getElementById('form-annonce').reset();
}

async function submitAnnonce(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    titre:        form.titre.value.trim(),
    description:  form.description.value.trim(),
    type_annonce: form.type_annonce.value,
    prix:         parseFloat(form.prix.value) || 0,
  };
  // Validation minimale côté client avant d'envoyer
  if (!payload.titre) {
    showToast(_('annonce_error_titre'), 'error');
    return;
  }
  try {
    await apiCreateAnnonce(payload);
    closeModalAnnonce();
    showToast(_('annonce_success'));
    // Si on est déjà sur la page annonces, on recharge la liste
    if (document.getElementById('section-annonces').classList.contains('active')) {
      loadAllAnnonces();
    }
  } catch (err) {
    // FIXME: afficher le message d'erreur renvoyé par l'API
    showToast(_('annonce_error'), 'error');
    console.log('Erreur lors de la création de l\'annonce:', err.message);
  }
}

/*  I18N  */

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = _(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = _(el.dataset.i18nPlaceholder);
  });
}

/*  UTILS  */

// Échappe les caractères spéciaux HTML pour éviter les injections XSS
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/*  INITIALISATION  */

async function init() {
  await loadI18n();
  applyI18n();

  // Si un token existe déjà, on vérifie qu'il est toujours valide
  const token = getToken();
  if (token) {
    try {
      await apiMe();
      showApp();
      showSection('dashboard');
      loadDashboard();
    } catch {
      // Token expiré ou invalide, on repart de zéro
      clearToken();
      showAuthPage();
    }
  } else {
    showAuthPage();
  }

  // Formulaire de connexion
  document.getElementById('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    clearAuthError();
    const email      = document.getElementById('login-email').value.trim();
    const motDePasse = document.getElementById('login-password').value;
    if (!email || !motDePasse) {
      showAuthError(_('auth_error_fields'));
      return;
    }
    try {
      await apiLogin(email, motDePasse);
      await apiMe();
      showApp();
      showSection('dashboard');
      loadDashboard();
    } catch {
      showAuthError(_('auth_error_invalid'));
    }
  });

  // Formulaire d'inscription
  document.getElementById('form-register').addEventListener('submit', async e => {
    e.preventDefault();
    clearAuthError();
    const payload = {
      email:    document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      nom:      document.getElementById('reg-nom').value.trim(),
      prenom:   document.getElementById('reg-prenom').value.trim(),
    };
    if (!payload.email || !payload.password || !payload.nom || !payload.prenom) {
      showAuthError(_('auth_error_fields'));
      return;
    }
    try {
      await apiRegister(payload);
      // On connecte directement après l'inscription pour éviter une étape
      await apiLogin(payload.email, payload.password);
      await apiMe();
      showApp();
      showSection('dashboard');
      loadDashboard();
    } catch (err) {
      showAuthError(err.message || _('auth_error_invalid'));
    }
  });

  // Liens de navigation
  document.querySelectorAll('[data-nav]').forEach(lien => {
    lien.addEventListener('click', e => {
      e.preventDefault();
      const nom = lien.dataset.nav;
      showSection(nom);
      if (nom === 'annonces')   loadAllAnnonces();
      if (nom === 'planning')   loadPlanningFull();
      if (nom === 'dashboard')  loadDashboard();
      if (nom === 'formations') loadFormations();
      if (nom === 'depot')      loadDepot();
      if (nom === 'profil')     loadProfil();
    });
  });

  // Filtre formations
  document.getElementById('filter-type-formation').addEventListener('change', e => {
    loadFormations(e.target.value);
  });

  // Modal dépôt
  document.getElementById('modal-close-depot').addEventListener('click', fermerModalDepot);
  document.getElementById('modal-cancel-depot').addEventListener('click', fermerModalDepot);
  document.getElementById('modal-confirm-depot').addEventListener('click', confirmerDepot);
  document.getElementById('modal-depot').addEventListener('click', e => {
    if (e.target === e.currentTarget) fermerModalDepot();
  });

  // Formulaire profil
  document.getElementById('form-profil').addEventListener('submit', submitProfil);

  // Déconnexion, on efface tout en local
  document.getElementById('btn-logout').addEventListener('click', () => {
    clearToken();
    showAuthPage();
    toggleAuthMode('login');
  });

  // Bascule entre login et register
  document.getElementById('switch-to-register').addEventListener('click', () => toggleAuthMode('register'));
  document.getElementById('switch-to-login').addEventListener('click', () => toggleAuthMode('login'));

  // Modal nouvelle annonce
  document.getElementById('btn-new-annonce').addEventListener('click', openModalAnnonce);
  document.getElementById('modal-close-annonce').addEventListener('click', closeModalAnnonce);
  document.getElementById('modal-cancel-annonce').addEventListener('click', closeModalAnnonce);
  document.getElementById('form-annonce').addEventListener('submit', submitAnnonce);

  // Fermer le modal en cliquant sur l'overlay
  document.getElementById('modal-annonce').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModalAnnonce();
  });
}

document.addEventListener('DOMContentLoaded', init);
