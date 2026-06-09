// dashboard particuliers

document.addEventListener('DOMContentLoaded', async () => {
  const utilisateur = await initLayout('dashboard');
  if (!utilisateur) return;

  const prenom = utilisateur.prenom || utilisateur.nom || 'vous';
  const el = document.getElementById('welcome-subtitle');
  if (el) el.textContent = `${t('dashboard_greeting_prefix')} ${prenom}, ${t('dashboard_activity_sub')}`;
  const bannerName = document.getElementById('banner-name');
  if (bannerName) bannerName.textContent = `${t('dashboard_greeting_prefix')}, ${prenom} !`;

  await Promise.all([
    chargerStats(utilisateur),
    chargerAnnoncesRecentes(),
    chargerEvenementsVenir(),
  ]);
});

async function chargerStats(user) {
  let score    = 0;
  let annonces = 0;
  let kg       = 0;
  let events   = 0;

  try {
    const res = await apiFetch('/score');
    if (res?.ok) {
      const data = await res.json();
      score  = data.score_total      ?? 0;
      kg     = Math.round(data.kg_recycles ?? 0);
      events = data.evenements_venir ?? 0;
    }
  } catch {}

  try {
    const resA = await apiFetch('/annonces/mes-annonces');
    if (resA?.ok) {
      const mes = await resA.json();
      if (Array.isArray(mes)) annonces = mes.filter(a => a.statut === 'validee').length;
    }
  } catch {}

  const vals = {
    'stat-score':    score,
    'stat-annonces': annonces,
    'stat-kg':       kg,
    'stat-events':   events,
  };
  Object.entries(vals).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) animerNombre(el, val);
  });
}

function animerNombre(el, valeur) {
  const duration = 900;
  const start    = Date.now();
  const tick = () => {
    const progress = Math.min((Date.now() - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * valeur);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function chargerAnnoncesRecentes() {
  const container = document.getElementById('annonces-recentes');
  if (!container) return;

  let annonces = [];
  try {
    const res = await apiFetch(`/annonces?lang=${_lang}&limit=4`);
    if (res?.ok) { const d = await res.json(); if (Array.isArray(d)) annonces = d; }
  } catch {}

  if (!annonces.length) {
    container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px">${t('annonce_empty') || 'Aucune annonce disponible.'}</p>`;
    return;
  }

  container.innerHTML = annonces.slice(0, 4).map((a, i) => {
    const typeBadge = a.type_annonce === 'don'
      ? `<span class="badge badge-don"><i class="fa-solid fa-hand-holding-heart"></i> ${t('annonce_type_don')}</span>`
      : `<span class="badge badge-vente"><i class="fa-solid fa-tag"></i> ${t('annonce_type_vente')}</span>`;
    const prix = a.prix > 0 ? `<span class="annonce-prix">${a.prix.toFixed(2)} €</span>` : `<span class="annonce-prix">${t('annonce_gratuit')}</span>`;
    return `
      <div class="annonce-card animate-in" style="animation-delay:${i * .07}s">
        <div class="annonce-header">
          ${typeBadge}
          <span style="font-size:11px;color:var(--text-muted)">${esc(a.auteur || '')}</span>
        </div>
        <div class="annonce-titre">${esc(a.titre)}</div>
        <div class="annonce-desc">${esc(a.description || '')}</div>
        <div class="annonce-footer">
          ${prix}
          <a href="annonces.html" class="btn btn-outline btn-sm">${t('annonce_btn_voir')}</a>
        </div>
      </div>`;
  }).join('');
}

async function chargerEvenementsVenir() {
  const container = document.getElementById('events-list');
  if (!container) return;

  let events = [];
  try {
    const res = await apiFetch(`/evenements?limit=3&lang=${_lang}`);
    if (res?.ok) { const d = await res.json(); if (Array.isArray(d)) events = d; }
  } catch {}

  if (!events.length) {
    container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px">${t('aucun_evenement') || 'Aucun événement à venir.'}</p>`;
    return;
  }

  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  const typeIcone = { formation:'fa-graduation-cap', atelier:'fa-screwdriver-wrench', evenement:'fa-calendar-days' };
  container.innerHTML = events.slice(0, 3).map((e, i) => {
    const d = new Date(e.date_debut);
    return `
      <div class="planning-item animate-in" style="animation-delay:${i * .08}s">
        <div class="planning-date">
          <div class="day">${d.getDate()}</div>
          <div class="month">${d.toLocaleDateString(locale, { month: 'short' })}</div>
        </div>
        <div class="planning-sep"></div>
        <div class="planning-info" style="flex:1">
          <div class="planning-title">${esc(e.titre)}</div>
          ${e.lieu ? `<div class="planning-lieu"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${esc(e.lieu)}</div>` : ''}
        </div>
        <span class="badge ${e.type === 'formation' ? 'badge-formation' : e.type === 'atelier' ? 'badge-atelier' : 'badge-evenement'}">
          <i class="fa-solid ${typeIcone[e.type] || 'fa-calendar-days'}" aria-hidden="true"></i>
          ${e.type ? t('formation_type_' + e.type) : ''}
        </span>
      </div>`;
  }).join('');
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
