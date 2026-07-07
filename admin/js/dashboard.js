// Dashboard admin, stats, activité récente, graphiques Chart.js

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('dashboard');
  afficherDate();
  await Promise.all([chargerStats(), chargerUsers(), chargerAlertes()]);
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
    if (!res || !res.ok) throw new Error();
    const stats = await res.json();
    setStatValue('stat-users',       stats.total_utilisateurs);
    setStatValue('stat-prestations', stats.total_evenements);
    setStatValue('stat-categories',  stats.total_categories);
    setStatValue('stat-factures',    stats.total_factures);
  } catch {
    ['stat-users','stat-prestations','stat-categories','stat-factures']
      .forEach(id => setStatValue(id, '—'));
    const statsRow = document.querySelector('.stats-row');
    if (statsRow && !document.getElementById('stats-error-banner')) {
      const banner = document.createElement('p');
      banner.id = 'stats-error-banner';
      banner.style.cssText = 'color:var(--danger,#ef5350);font-size:13px;margin-top:8px;display:flex;align-items:center;gap:8px';
      banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Impossible de charger les statistiques — vérifiez que l\'API est démarrée.';
      statsRow.after(banner);
    }
  }
}

function setStatValue(id, valeur) {
  const el = document.getElementById(id);
  if (el) el.textContent = valeur ?? '-';
}

async function chargerUsers() {
  const container = document.getElementById('recentActivity');
  try {
    const res = await apiFetch('/admin/users');
    if (!res || !res.ok) throw new Error();
    const users = await res.json();
    const liste = Array.isArray(users) ? users : [];

    const tries = liste.slice().sort((a, b) =>
      new Date(b.date_inscription || 0) - new Date(a.date_inscription || 0)
    );

    if (container) renderActivite(container, tries.slice(0, 5));
    initGrapheInscriptions(liste);
    initGrapheRoles(liste);
  } catch {
    if (container) renderActivite(container, []);
    initGrapheInscriptions([]);
    initGrapheRoles([]);
  }
}

function initGrapheInscriptions(users) {
  const ctx = document.getElementById('chartInscriptions');
  if (!ctx || !window.Chart) return;

  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  const now    = new Date();
  const labels = [];
  const counts = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString(locale, { month: 'short' }));
    const annee = d.getFullYear();
    const mois  = d.getMonth();
    counts.push(users.filter(u => {
      if (!u.date_inscription) return false;
      const di = new Date(u.date_inscription);
      return di.getFullYear() === annee && di.getMonth() === mois;
    }).length);
  }

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: t('dashboard_chart_new_regs'),
        data:  counts,
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
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: '#7A7570', font: { size: 12 }, stepSize: 1, precision: 0 },
          beginAtZero: true,
        },
      },
    },
  });
}

function initGrapheRoles(users) {
  const ctx = document.getElementById('chartRoles');
  if (!ctx || !window.Chart) return;

  const counts = { particulier: 0, professionnel: 0, salarie: 0, admin: 0 };
  users.forEach(u => { if (counts[u.role] !== undefined) counts[u.role]++; });

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [t('role_particuliers'), t('role_professionnels'), t('role_salaries'), t('role_admins')],
      datasets: [{
        data: [counts.particulier, counts.professionnel, counts.salarie, counts.admin],
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
      : '-';
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

async function chargerAlertes() {
  const card = document.getElementById('alertes-card');
  const list = document.getElementById('alertes-list');
  const count = document.getElementById('alertes-count');
  if (!card || !list) return;
  try {
    const res = await apiFetch('/admin/alertes');
    if (!res?.ok) return;
    const alertes = await res.json();
    if (!alertes.length) return;

    card.style.display = '';
    count.textContent = alertes.length + ' alerte' + (alertes.length > 1 ? 's' : '');

    const icones = { conteneur: 'fa-box-archive', paiement: 'fa-credit-card' };
    const couleurs = { conteneur: '#c67c28', paiement: '#c0392b' };

    list.innerHTML = alertes.map((a, i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;${i < alertes.length - 1 ? 'border-bottom:1px solid var(--border-color)' : ''}">
        <div style="width:32px;height:32px;border-radius:8px;background:${couleurs[a.type]}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fa-solid ${icones[a.type] || 'fa-bell'}" style="color:${couleurs[a.type]};font-size:13px"></i>
        </div>
        <div style="flex:1;font-size:13px;color:var(--text-primary)">${escAdmin(a.message)}</div>
        ${a.lien ? `<a href="${a.lien}" style="font-size:12px;color:var(--uc-green);font-weight:600;white-space:nowrap">Voir</a>` : ''}
      </div>`).join('');
  } catch {}
}

function escAdmin(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
