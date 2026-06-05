// Dashboard admin - stats, activité récente, graphiques Chart.js

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('dashboard');
  chargerStats();
  chargerActiviteRecente();
  afficherDate();
});

function afficherDate() {
  const el = document.getElementById('dateNow');
  if (!el) return;
  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  el.textContent = new Date().toLocaleDateString(locale, { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

async function chargerStats() {
  try {
    const res = await apiFetch('/admin/stats');
    if (!res || !res.ok) throw new Error('Erreur stats');
    const stats = await res.json();

    setStatValue('stat-users',       stats.total_utilisateurs);
    setStatValue('stat-prestations', stats.total_evenements);
    setStatValue('stat-categories',  stats.total_categories);
    setStatValue('stat-factures',    stats.total_annonces);
    setStatValue('stat-annonces',    stats.total_annonces);
    setStatValue('stat-en-attente',  stats.annonces_en_attente);

    initGrapheInscriptions(stats);
    initGrapheRoles(stats);
  } catch (err) {
    console.warn('Stats indisponibles, utilisation des mocks:', err.message);
    // TODO: afficher un badge d'erreur visible sur les cartes
    const mockStats = {
      total_utilisateurs: 124,
      total_evenements:   18,
      total_categories:   6,
      total_annonces:     87,
      annonces_en_attente: 9,
    };
    setStatValue('stat-users',       mockStats.total_utilisateurs);
    setStatValue('stat-prestations', mockStats.total_evenements);
    setStatValue('stat-categories',  mockStats.total_categories);
    setStatValue('stat-factures',    mockStats.total_annonces);

    initGrapheInscriptions(mockStats);
    initGrapheRoles(mockStats);
  }
}

function setStatValue(id, valeur) {
  const el = document.getElementById(id);
  if (el) el.textContent = valeur ?? '—';
}

// graphique inscriptions sur 6 mois, les données sont mockées pour l'instant
function initGrapheInscriptions(stats) {
  const ctx = document.getElementById('chartInscriptions');
  if (!ctx || !window.Chart) return;

  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  const now = new Date();
  const mois = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    mois.push(d.toLocaleDateString(locale, { month: 'short' }));
  }
  // chiffres plausibles à partir du total réel, pas du vrai historique
  const base   = Math.max(10, Math.floor((stats.total_utilisateurs || 100) / 8));
  const donnees = [base, base + 4, base + 7, base + 12, base + 18, base + 23];

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: mois,
      datasets: [{
        label: t('dashboard_chart_new_regs'),
        data:  donnees,
        borderColor:     '#2D4A3E',
        backgroundColor: 'rgba(45,74,62,0.08)',
        borderWidth: 2.5,
        pointBackgroundColor: '#2D4A3E',
        pointRadius: 4,
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#2D4A3E',
          titleColor: '#A3BFB3',
          bodyColor: '#fff',
          padding: 10,
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7A7570', font: { size: 12 } } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#7A7570', font: { size: 12 } } },
      },
    },
  });
}

// camembert répartition des roles, aussi mocké
function initGrapheRoles(stats) {
  const ctx = document.getElementById('chartRoles');
  if (!ctx || !window.Chart) return;

  const total = stats.total_utilisateurs || 100;
  // approximation grossière, pas d'endpoint par role pour l'instant
  const particuliers    = Math.round(total * 0.55);
  const professionnels  = Math.round(total * 0.30);
  const salaries        = Math.round(total * 0.12);
  const admins          = total - particuliers - professionnels - salaries;

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [t('role_particuliers'), t('role_professionnels'), t('role_salaries'), t('role_admins')],
      datasets: [{
        data: [particuliers, professionnels, salaries, admins],
        backgroundColor: ['#2D4A3E', '#5C7C6E', '#A3BFB3', '#BCB3A6'],
        borderColor: '#fff',
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#4A4845', font: { size: 12 }, padding: 12 },
        },
        tooltip: {
          backgroundColor: '#2D4A3E',
          titleColor: '#A3BFB3',
          bodyColor: '#fff',
          padding: 10,
        },
      },
    },
  });
}

// 5 derniers inscrits via l'API
async function chargerActiviteRecente() {
  const container = document.getElementById('recentActivity');
  if (!container) return;

  try {
    const res = await apiFetch('/admin/users');
    if (!res || !res.ok) throw new Error('API users indisponible');
    const users = await res.json();
    // tri par date_inscription desc, on prend les 5 premiers
    const recents = (users || [])
      .sort((a, b) => new Date(b.date_inscription || 0) - new Date(a.date_inscription || 0))
      .slice(0, 5);
    renderActivite(container, recents);
  } catch {
    // FIXME: retirer les données mockées et afficher une erreur si l'API est critique
    renderActivite(container, MOCK_ACTIVITE);
  }
}

const MOCK_ACTIVITE = [
  { prenom: 'Marie',    nom: 'Dupont',  role: 'particulier',   date_inscription: '2026-04-17' },
  { prenom: 'Jean-Paul',nom: 'Lévy',   role: 'professionnel', date_inscription: '2026-04-16' },
  { prenom: 'Sophie',   nom: 'Martin', role: 'salarie',       date_inscription: '2026-04-15' },
  { prenom: 'Clara',    nom: 'Noël',   role: 'professionnel', date_inscription: '2026-04-14' },
  { prenom: 'Kevin',    nom: 'Roux',   role: 'particulier',   date_inscription: '2026-04-12' },
];

function roleLabel(role) {
  const keys = { particulier:'users_role_particulier', professionnel:'users_role_professionnel', salarie:'users_role_salarie', admin:'users_role_admin' };
  return t(keys[role] || 'users_role_particulier');
}

function renderActivite(container, users) {
  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  if (!users.length) {
    container.innerHTML = `<p style="text-align:center;color:var(--neutral-300);padding:20px">${t('dashboard_no_activity')}</p>`;
    return;
  }
  container.innerHTML = users.map(u => {
    const prenom   = u.prenom || '';
    const nom      = u.nom    || '';
    const initials = (prenom.charAt(0) + nom.charAt(0)).toUpperCase() || 'UC';
    const date     = u.date_inscription
      ? new Date(u.date_inscription).toLocaleDateString(locale, { day:'2-digit', month:'short' })
      : '—';
    return `
      <div class="activity-item">
        <div class="activity-avatar">${initials}</div>
        <div class="activity-text">
          <strong>${escAdmin(prenom + ' ' + nom)}</strong>
          ${t('dashboard_activity_text')} ${escAdmin(roleLabel(u.role))}
        </div>
        <div class="activity-time">${date}</div>
      </div>`;
  }).join('');
}

function escAdmin(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
