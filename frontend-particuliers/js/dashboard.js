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
      afficherHistoriqueScore(data.score_total ?? 0, data.historique || []);
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

function afficherHistoriqueScore(total, historique) {
  const label = document.getElementById('score-total-label');
  if (label) label.textContent = `${total} pts`;

  const list = document.getElementById('score-historique-list');
  if (!list) return;

  if (!historique.length) {
    list.innerHTML = '<p style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px">Aucune action enregistrée pour le moment.</p>';
    return;
  }

  const motifs = {
    depot_conteneur:        { label: 'Dépôt en conteneur',                     icon: 'fa-box',              color: '#0d9488' },
    creation_projet:        { label: 'Projet upcycling créé',                  icon: 'fa-screwdriver-wrench',color: '#7c3aed' },
    annonce_validee:        { label: 'Annonce validée',                         icon: 'fa-circle-check',     color: '#16a34a' },
    inscription_evenement:  { label: 'Inscription à un événement',              icon: 'fa-calendar-check',   color: '#0284c7' },
    questionnaire_complete: { label: 'Questionnaire de satisfaction rempli',    icon: 'fa-clipboard-check',  color: '#d97706' },
    projet_partage:         { label: 'Projet partagé avec la communauté',       icon: 'fa-share-nodes',      color: '#db2777' },
  };
  const locale = typeof _lang !== 'undefined' && _lang === 'en' ? 'en-GB' : 'fr-FR';

  list.innerHTML = historique.map((h, i) => {
    const m = motifs[h.motif] || { label: h.motif, icon: 'fa-leaf', color: '#0d9488' };
    const date = h.date_action
      ? new Date(h.date_action).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    const isLast = i === historique.length - 1;
    return `
      <div style="display:flex;align-items:center;gap:14px;padding:13px 20px;${isLast ? '' : 'border-bottom:1px solid var(--border-color)'}">
        <div style="width:36px;height:36px;border-radius:10px;background:${m.color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fa-solid ${m.icon}" style="color:${m.color};font-size:14px"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:600;color:var(--text-primary)">${m.label}</div>
          ${date ? `<div style="font-size:11.5px;color:var(--text-muted);margin-top:2px">${date}</div>` : ''}
        </div>
        <span style="background:var(--teal-50);color:var(--teal-700);font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap">+${h.points} pts</span>
      </div>`;
  }).join('');
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
