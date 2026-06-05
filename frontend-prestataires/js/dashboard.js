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
  try {
    const [resAnnonces, resStats] = await Promise.all([
      apiFetch('/annonces?statut=validee'),
      apiFetch('/professionnel/stats'),
    ]);

    let nbAnnonces = 0;
    if (resAnnonces?.ok) {
      const data = await resAnnonces.json();
      nbAnnonces = Array.isArray(data) ? data.length : (data.total || 0);
    }

    let stats = {};
    if (resStats?.ok) stats = await resStats.json();

    setStatValue('stat-annonces',      nbAnnonces);
    setStatValue('stat-recuperations', stats.recuperations_mois || 0);
    setStatValue('stat-projets',       stats.projets_actifs     || 0);
    setStatValue('stat-impact',        stats.kg_co2_economies   || 0);

    initGrapheActivite(stats);

  } catch {
    // Données mockées en fallback - TODO: retirer en prod
    const mock = { recuperations_mois: 7, projets_actifs: 3, kg_co2_economies: 124 };
    setStatValue('stat-annonces',      18);
    setStatValue('stat-recuperations', mock.recuperations_mois);
    setStatValue('stat-projets',       mock.projets_actifs);
    setStatValue('stat-impact',        mock.kg_co2_economies);
    initGrapheActivite(mock);
  }
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

const MOCK_ANNONCES = [
  { id:1, titre:'Chutes de tissu lin naturel', categorie:'textiles', type:'don',   prix:0,   localisation:'Paris 11e', date_creation:'2026-04-18' },
  { id:2, titre:'Lot palettes bois EUR (x8)',  categorie:'bois',     type:'vente', prix:45,  localisation:'Montreuil', date_creation:'2026-04-17' },
  { id:3, titre:'Profilés aluminium 3m',       categorie:'metal',    type:'vente', prix:30,  localisation:'Paris 19e', date_creation:'2026-04-16' },
];

async function chargerAnnoncesRecentes() {
  const container = document.getElementById('annonces-recentes');
  if (!container) return;

  try {
    const res = await apiFetch('/annonces?statut=validee&limit=3');
    if (!res || !res.ok) throw new Error('API indisponible');
    const data  = await res.json();
    const items = Array.isArray(data) ? data.slice(0, 3) : MOCK_ANNONCES;
    renderAnnoncesRecentes(container, items);
  } catch {
    renderAnnoncesRecentes(container, MOCK_ANNONCES);
  }
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

const MOCK_PROJETS = [
  { id:1, titre:'Table basse palettes',   statut:'en_cours', avancement:65, materiaux:['Bois','Métal'] },
  { id:2, titre:'Atelier DIY vêtements',  statut:'publie',   avancement:100, materiaux:['Textiles'] },
];

async function chargerMesProjets(utilisateur) {
  const container = document.getElementById('mes-projets');
  if (!container) return;

  try {
    const res = await apiFetch('/professionnel/projets?limit=2');
    if (!res || !res.ok) throw new Error();
    const data = await res.json();
    renderProjetsDash(container, Array.isArray(data) ? data.slice(0,2) : MOCK_PROJETS);
  } catch {
    renderProjetsDash(container, MOCK_PROJETS);
  }
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

const MOCK_ALERTES = [
  { id:1, titre:'12 kg de textiles disponibles',       desc:'Paris 11e - Don · Disponible maintenant', priorite: true },
  { id:2, titre:'Lot bois - Offre premium détectée',   desc:'Vincennes - 3 palettes EUR à 15 €',       priorite: false },
  { id:3, titre:'Conteneur Bastille presque plein',    desc:'Taux 87% - collecte recommandée',          priorite: false },
];

async function chargerAlertes() {
  const container = document.getElementById('alertes-list');
  if (!container) return;

  let alertes = MOCK_ALERTES;
  try {
    const res = await apiFetch('/professionnel/alertes');
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) alertes = data;
    }
  } catch {}

  container.innerHTML = alertes.map(a => `
    <div class="alerte-item">
      <div class="alerte-dot ${a.priorite ? 'priority' : ''}"></div>
      <div class="alerte-content">
        <div class="alerte-titre">${escPro(a.titre)}</div>
        <div class="alerte-desc">${escPro(a.desc)}</div>
      </div>
    </div>
  `).join('');
}

function escPro(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
