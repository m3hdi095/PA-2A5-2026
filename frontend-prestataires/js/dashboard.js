// Dashboard espace professionnel

document.addEventListener('DOMContentLoaded', async () => {
  const utilisateur = await initLayout('dashboard');
  if (!utilisateur) return;

  afficherDate();
  chargerStats(utilisateur);
  chargerAnnoncesRecentes();
  chargerMesProjets(utilisateur);
  chargerAlertes();
});

function afficherDate() {
  const el = document.getElementById('date-now');
  if (!el) return;
  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  el.textContent = new Date().toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

async function chargerStats(utilisateur) {
  let nbAnnonces = 0, nbProjets = 0;

  try {
    const res = await apiFetch('/annonces?statut=validee');
    if (res?.ok) {
      const data = await res.json();
      nbAnnonces = Array.isArray(data) ? data.length : 0;
    }
  } catch {}

  try {
    const res = await apiFetch('/projets/mes-projets');
    if (res?.ok) {
      const data = await res.json();
      nbProjets = Array.isArray(data) ? data.filter(p => p.statut === 'en_cours').length : 0;
    }
  } catch {}

  setStatValue('stat-annonces',      nbAnnonces);
  setStatValue('stat-recuperations', 0);
  setStatValue('stat-projets',       nbProjets);
  setStatValue('stat-impact',        0);
  initGrapheActivite({ recuperations_mois: 0 });
}

function setStatValue(id, valeur) {
  const el = document.getElementById(id);
  if (el) el.textContent = valeur ?? '—';
}

function initGrapheActivite(stats) {
  const ctx = document.getElementById('chart-activite');
  if (!ctx || !window.Chart) return;

  const mois   = ['Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr'];
  const base   = stats.recuperations_mois || 7;
  const donnees = [
    Math.max(1, base - 4),
    Math.max(1, base - 2),
    Math.max(1, base + 1),
    Math.max(1, base + 3),
    Math.max(1, base + 5),
    base,
  ];

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: mois,
      datasets: [{
        label: 'Récupérations',
        data: donnees,
        backgroundColor: 'rgba(45,102,79,0.15)',
        borderColor:     '#2D664F',
        borderWidth:     2,
        borderRadius:    6,
        borderSkipped:   false,
        hoverBackgroundColor: 'rgba(45,102,79,0.3)',
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2D664F',
          titleColor: '#B2DEC3',
          bodyColor: '#fff',
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6BA870', font: { size: 12, family: 'Montserrat' } } },
        y: { grid: { color: 'rgba(45,102,79,0.06)' }, ticks: { color: '#6BA870', font: { size: 12, family: 'Montserrat' } } },
      },
    },
  });
}

const CAT_ICONES = {
  textiles:     'fa-shirt',
  bois:         'fa-tree',
  metal:        'fa-wrench',
  plastique:    'fa-recycle',
  electronique: 'fa-microchip',
  autre:        'fa-box',
};

async function chargerAnnoncesRecentes() {
  const container = document.getElementById('annonces-recentes');
  if (!container) return;

  let items = [];
  try {
    const res = await apiFetch('/annonces?statut=validee&limit=3');
    if (res?.ok) {
      const data = await res.json();
      items = Array.isArray(data) ? data.slice(0, 3) : [];
    }
  } catch {}
  renderAnnoncesRecentes(container, items);
}

function renderAnnoncesRecentes(container, annonces) {
  if (!annonces.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:20px 0">Aucune annonce disponible.</p>';
    return;
  }
  container.innerHTML = annonces.map((a, i) => {
    const icone = CAT_ICONES[a.categorie] || 'fa-box';
    const prixLabel = a.prix === 0 ? 'Gratuit' : `${a.prix} €`;
    const badge = a.type === 'don'
      ? '<span class="badge badge-don">Don</span>'
      : '<span class="badge badge-vente">Vente</span>';
    return `
      <div class="activity-item animate-in" style="animation-delay:${i * 60}ms">
        <div class="activity-icon" style="background:var(--green-50)">
          <i class="fa-solid ${icone}" aria-hidden="true"></i>
        </div>
        <div class="activity-text">
          <div class="activity-title">${escPro(a.titre)}</div>
          <div class="activity-sub">${badge} &nbsp;${escPro(a.localisation || '')} &nbsp;·&nbsp; <strong>${prixLabel}</strong></div>
        </div>
        <a href="annonces.html" class="btn btn-outline btn-sm" style="font-size:11px">Voir</a>
      </div>`;
  }).join('');
}

async function chargerMesProjets(utilisateur) {
  const container = document.getElementById('mes-projets');
  if (!container) return;

  let projets = [];
  try {
    const res = await apiFetch('/projets/mes-projets');
    if (res?.ok) {
      const data = await res.json();
      projets = Array.isArray(data) ? data.slice(0, 2) : [];
    }
  } catch {}
  renderProjetsDash(container, projets);
}

const STATUT_BADGE = {
  en_cours:  '<span class="badge badge-teal">En cours</span>',
  attente:   '<span class="badge badge-orange">En attente</span>',
  termine:   '<span class="badge badge-green">Terminé</span>',
  publie:    '<span class="badge badge-green">Publié</span>',
};

function renderProjetsDash(container, projets) {
  if (!projets.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:20px 0">Aucun projet en cours.</p>';
    return;
  }
  container.innerHTML = projets.map((p, i) => `
    <div class="activity-item animate-in" style="animation-delay:${i * 70}ms">
      <div class="activity-icon" style="background:var(--green-100)">
        <i class="fa-solid fa-diagram-project" aria-hidden="true"></i>
      </div>
      <div class="activity-text">
        <div class="activity-title">${escPro(p.titre)}</div>
        <div class="activity-sub">${STATUT_BADGE[p.statut] || ''} &nbsp; ${p.avancement}% avancé</div>
      </div>
    </div>
  `).join('');
}

async function chargerAlertes() {
  const container = document.getElementById('alertes-list');
  if (!container) return;

  let notifs = [];
  try {
    const res = await apiFetch('/notifications');
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data)) notifs = data.slice(0, 3);
    }
  } catch {}

  if (!notifs.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:20px 0">Aucune alerte pour le moment.</p>';
    return;
  }

  container.innerHTML = notifs.map(n => `
    <div class="alerte-item">
      <div class="alerte-dot ${n.statut === 'non_lu' ? 'priority' : ''}"></div>
      <div class="alerte-content">
        <div class="alerte-titre">${escPro(n.titre || n.type || '')}</div>
        <div class="alerte-desc">${escPro(n.message || '')}</div>
      </div>
    </div>
  `).join('');
}

function escPro(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
