// Gestion des projets upcycling

const STATUT_CONFIG = {
  en_cours:  { label: 'En cours',          badge: 'badge-teal',   accent: '#2D664F' },
  attente:   { label: 'En attente',         badge: 'badge-orange', accent: '#c67c28' },
  termine:   { label: 'Terminé',            badge: 'badge-green',  accent: '#6BA870' },
  publie:    { label: 'Publié',             badge: 'badge-green',  accent: '#2D664F' },
  brouillon: { label: 'Brouillon',          badge: 'badge-gray',   accent: '#BCB3A6' },
};

const STATUT_AVANCEMENT = { brouillon: 0, en_cours: 33, attente: 50, termine: 100, publie: 100 };

const CAT_PROJETS = ['Mobilier', 'Textile', 'Décoration', 'Luminaire', 'Jardin', 'Autre'];

let projetsData = [];


let filtreActif = 'tous';

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('projets');
  await Promise.all([chargerProjets(), chargerGalerie()]);
  bindActions();
});

async function chargerProjets() {
  try {
    const res = await apiFetch('/projets/mes-projets');
    if (res?.ok) {
      const data = await res.json();
      projetsData = Array.isArray(data) ? data : [];
    }
  } catch {}
  renderProjets();
}

function bindActions() {
  document.getElementById('btn-nouveau-projet')?.addEventListener('click', ouvrirModalNouveauProjet);
  document.getElementById('modal-projet-close')?.addEventListener('click', fermerModal);
  document.getElementById('modal-projet')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-projet')) fermerModal();
  });
  document.getElementById('form-projet')?.addEventListener('submit', soumettreProjet);

  document.querySelectorAll('.filtre-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filtre-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filtreActif = tab.dataset.filtre || 'tous';
      renderProjets();
    });
  });
}

function renderProjets() {
  const container = document.getElementById('projets-container');
  if (!container) return;

  const projets = filtreActif === 'tous'
    ? projetsData
    : projetsData.filter(p => p.statut === filtreActif);

  updateCompteurs();

  if (!projets.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <i class="fa-solid fa-diagram-project" aria-hidden="true"></i>
        <p>Aucun projet dans cette catégorie</p>
        <button class="btn btn-primary" onclick="ouvrirModalNouveauProjet()">
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
          Créer un projet
        </button>
      </div>`;
    return;
  }

  container.innerHTML = projets.map((p, i) => {
    const cfg       = STATUT_CONFIG[p.statut] || STATUT_CONFIG.brouillon;
    const avancement = STATUT_AVANCEMENT[p.statut] ?? 0;
    const locale     = _lang === 'en' ? 'en-GB' : 'fr-FR';
    const dateAff    = new Date(p.date_debut || p.date_fin).toLocaleDateString(locale, { day:'2-digit', month:'short', year:'numeric' });

    const btnsStatut = Object.entries(STATUT_CONFIG)
      .filter(([k]) => k !== p.statut && k !== 'brouillon')
      .map(([k, v]) => `<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="changerStatut(${p.id},'${k}')">${v.label}</button>`)
      .join('');

    return `
      <div class="projet-card animate-in" style="animation-delay:${i * 70}ms;--accent-projet:${cfg.accent}">
        <div class="projet-header">
          <div class="projet-titre">${escPro(p.titre)}</div>
          <span class="badge ${cfg.badge}">${cfg.label}</span>
        </div>
        <div class="projet-desc">${escPro(p.description)}</div>
        <div class="projet-progress">
          <div class="progress-label">
            <span>Avancement</span>
            <span>${avancement}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width:${avancement}%"></div>
          </div>
        </div>
        <div class="projet-materiaux">
          ${(p.materiaux || []).map(m => `<span class="badge badge-teal">${escPro(m)}</span>`).join('')}
        </div>
        <div class="projet-footer">
          <span style="font-size:11.5px;color:var(--text-muted)">
            <i class="fa-regular fa-calendar" aria-hidden="true"></i>
            ${dateAff}
          </span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
            <button class="btn btn-ghost btn-sm" onclick="ouvrirDetailProjet(${p.id})">
              <i class="fa-solid fa-eye" aria-hidden="true"></i>
              Voir
            </button>
            ${btnsStatut}
          </div>
        </div>
      </div>`;
  }).join('');
}

function updateCompteurs() {
  const counts = { tous: projetsData.length, en_cours: 0, attente: 0, termine: 0, publie: 0 };
  projetsData.forEach(p => { if (counts[p.statut] !== undefined) counts[p.statut]++; });

  document.querySelectorAll('.filtre-tab').forEach(tab => {
    const filtre = tab.dataset.filtre;
    const badge  = tab.querySelector('.tab-count');
    if (badge && counts[filtre] !== undefined) badge.textContent = counts[filtre];
  });
}

window.ouvrirModalNouveauProjet = () => {
  document.getElementById('modal-projet')?.classList.add('open');
};

window.fermerModal = () => {
  document.getElementById('modal-projet')?.classList.remove('open');
};

window.ouvrirDetailProjet = (id) => {
  const p = projetsData.find(x => x.id === id);
  if (!p) return;

  const modal = document.getElementById('modal-detail-projet');
  if (!modal) return;

  const cfg = STATUT_CONFIG[p.statut] || STATUT_CONFIG.brouillon;

  document.getElementById('detail-projet-title').innerHTML = `
    <i class="fa-solid fa-diagram-project" aria-hidden="true"></i>
    ${escPro(p.titre)}
  `;

  document.getElementById('detail-projet-body').innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <span class="badge ${cfg.badge}">${cfg.label}</span>
      <span class="badge badge-gray">${escPro(p.categorie)}</span>
    </div>
    <p style="font-size:13.5px;color:var(--text-soft);line-height:1.65;margin-bottom:20px">${escPro(p.description)}</p>
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:10px">Étapes</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${(p.etapes || []).map((etape, i) => {
          const fait = i < p.etape_courante;
          const actif = i === p.etape_courante - 1;
          return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${fait ? 'var(--green-50)' : actif ? 'var(--warning-bg)' : 'var(--green-25)'};border-radius:8px">
              <i class="fa-solid ${fait ? 'fa-circle-check' : actif ? 'fa-circle-dot' : 'fa-circle'}"
                 style="color:${fait ? 'var(--success-text)' : actif ? 'var(--warning-text)' : 'var(--green-200)'};font-size:14px"
                 aria-hidden="true"></i>
              <span style="font-size:13px;font-weight:${actif ? '700' : '500'};color:${fait ? 'var(--success-text)' : 'var(--text)'}">${escPro(etape)}</span>
              ${actif ? '<span class="badge badge-orange" style="margin-left:auto">En cours</span>' : ''}
            </div>`;
        }).join('')}
      </div>
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px">Matériaux utilisés</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${(p.materiaux || []).map(m => `<span class="badge badge-teal">${escPro(m)}</span>`).join('')}
      </div>
    </div>
  `;

  modal.classList.add('open');

  document.getElementById('detail-projet-close')?.addEventListener('click', () => modal.classList.remove('open'), { once: true });
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); }, { once: true });
};

window.changerStatut = async (id, statut) => {
  try {
    const res = await apiFetch(`/projets/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ statut }),
    });
    if (res?.ok) {
      const p = projetsData.find(x => x.id === id);
      if (p) p.statut = statut;
      renderProjets();
      showToast('Statut mis à jour', 'success');
    } else {
      const d = res ? await res.json().catch(() => ({})) : {};
      showToast(d.error || 'Erreur lors de la mise à jour', 'error');
    }
  } catch {
    showToast('Service indisponible.', 'error');
  }
};

async function soumettreProjet(e) {
  e.preventDefault();
  const titre       = document.getElementById('proj-titre').value.trim();
  const description = document.getElementById('proj-desc').value.trim();
  const categorie   = document.getElementById('proj-categorie').value;
  const materiaux   = document.getElementById('proj-materiaux').value.trim().split(',').map(m => m.trim()).filter(Boolean);
  const dateFinVal  = document.getElementById('proj-fin')?.value;
  const dateDebut   = new Date().toISOString();
  const dateFin     = dateFinVal ? new Date(dateFinVal).toISOString() : dateDebut;

  if (!titre) { showToast('Le titre est obligatoire', 'error'); return; }

  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Création...';

  try {
    const res = await apiFetch('/projets', {
      method: 'POST',
      body: JSON.stringify({ titre, description, categorie, materiaux, statut: 'en_cours', date_debut: dateDebut, date_fin: dateFin }),
    });

    if (res?.ok) {
      const nouveauProjet = await res.json();
      projetsData.unshift(nouveauProjet);
    } else {
      throw new Error();
    }
  } catch {
    showToast(t('toast_projet_error'), 'error');
    btn.disabled = false;
    btn.textContent = 'Créer le projet';
    return;
  }

  fermerModal();
  renderProjets();
  e.target.reset();
  showToast(t('toast_projet_ok'), 'success');
  btn.disabled = false;
  btn.textContent = 'Créer le projet';
}

function escPro(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function chargerGalerie() {
  const grid = document.getElementById('galerie-grid');
  if (!grid) return;
  try {
    const res = await apiFetch('/projets?partage=1');
    if (!res?.ok) { grid.innerHTML = '<p style="color:var(--text-muted);padding:20px;grid-column:1/-1">Impossible de charger la galerie.</p>'; return; }
    const data = await res.json();
    const projets = Array.isArray(data) ? data.filter(p => p.partage_communaute) : [];
    if (!projets.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);padding:20px;grid-column:1/-1;text-align:center">Aucun projet partagé pour le moment.</p>';
      return;
    }
    grid.innerHTML = projets.map((p, i) => `
      <div class="card animate-in" style="animation-delay:${i*.05}s">
        <div style="height:4px;background:var(--teal-500);border-radius:var(--radius-lg) var(--radius-lg) 0 0"></div>
        <div class="card-body" style="padding:16px">
          <h4 style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px">${escPro(p.titre)}</h4>
          <p style="font-size:12.5px;color:var(--text-soft);line-height:1.55;margin-bottom:12px">${escPro((p.description||'').slice(0,150))}${(p.description||'').length>150?'…':''}</p>
          <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-muted)">
            <span><i class="fa-solid fa-leaf"></i> ${p.score_impact||0} pts</span>
            <span><i class="fa-solid fa-recycle"></i> ${p.kg_dechets_evites||0} kg</span>
            <span class="badge ${p.statut==='termine'?'badge-green':'badge-teal'}">${p.statut||''}</span>
          </div>
        </div>
      </div>`).join('');
  } catch {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:20px;grid-column:1/-1">Galerie indisponible.</p>';
  }
}
