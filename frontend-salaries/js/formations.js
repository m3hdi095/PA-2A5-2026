// formations et evenements

const MOCK_FORMATIONS = [
  { id:1, titre:'Atelier création luminaire bois',      type:'atelier',   date:'2026-05-03', lieu:'Paris 11e',  places_max:12, places_prises:9,  statut:'ouvert',  description:'Créez une lampe artisanale à partir de bois de palettes récupérées. Matériel fourni.' },
  { id:2, titre:'Formation upcycling textile avancé',   type:'formation', date:'2026-05-17', lieu:'Paris 20e',  places_max:15, places_prises:7,  statut:'ouvert',  description:'Techniques avancées de couture et transformation de vêtements de seconde main.' },
  { id:3, titre:'Collecte vêtements printemps 2026',    type:'evenement', date:'2026-05-10', lieu:'Montreuil', places_max:50, places_prises:12, statut:'ouvert',  description:'Grande collecte communautaire de vêtements et accessoires de printemps.' },
  { id:4, titre:'Atelier mosaïque verre',               type:'atelier',   date:'2026-05-24', lieu:'Paris 13e', places_max:10, places_prises:10, statut:'complet', description:'Initiation à la mosaïque avec récupération de verre et céramique.' },
  { id:5, titre:'Conférence économie circulaire',       type:'evenement', date:'2026-06-05', lieu:'Siège UC',  places_max:80, places_prises:34, statut:'ouvert',  description:'Intervenants experts sur les enjeux de l\'économie circulaire en 2026.' },
];

const TYPE_COLORS = {
  atelier:   { bg:'var(--green-50)',  txt:'var(--green-700)' },
  formation: { bg:'#fef3e2',          txt:'#e8a020' },
  evenement: { bg:'#e8f5ee',          txt:'#2e8b57' },
};

let formations = [];

async function fetchFormations() {
  try {
    const res = await apiFetch('/salarie/formations');
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) { formations = data; renderTable(); return; }
    }
  } catch {}
  formations = [...MOCK_FORMATIONS];
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('formations-tbody');
  if (!tbody) return;
  if (!formations.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fa-solid fa-graduation-cap" style="font-size:28px;color:var(--green-200);display:block;margin-bottom:10px"></i>${t('sal_formations_empty')}</div></td></tr>`;
    return;
  }
  tbody.innerHTML = formations.map(f => {
    const tc   = TYPE_COLORS[f.type] || TYPE_COLORS.atelier;
    const pct  = f.places_max > 0 ? Math.round(f.places_prises / f.places_max * 100) : 0;
    const full = f.places_prises >= f.places_max;
    const statBadge = f.statut === 'complet'
      ? `<span class="badge badge-warning">${t('sal_badge_complet')}</span>`
      : f.statut === 'annule'
        ? `<span class="badge badge-red">${t('sal_badge_annule')}</span>`
        : `<span class="badge badge-success">${t('sal_badge_ouvert')}</span>`;
    return `<tr>
      <td style="font-weight:600">${esc(f.titre)}</td>
      <td><span class="badge" style="background:${tc.bg};color:${tc.txt}">${esc(f.type)}</span></td>
      <td>${new Date(f.date).toLocaleDateString(_lang === 'en' ? 'en-GB' : 'fr-FR',{day:'numeric',month:'short',year:'numeric'})}</td>
      <td>${esc(f.lieu)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;min-width:36px">${f.places_prises}/${f.places_max}</span>
          <div style="flex:1;height:6px;background:var(--border);border-radius:3px;min-width:50px">
            <div style="width:${pct}%;height:100%;border-radius:3px;background:${full?'#e8a020':'var(--green-500)'}"></div>
          </div>
        </div>
      </td>
      <td>${statBadge}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-outline btn-sm" onclick="ouvrirModal(${f.id})" title="Modifier">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="supprimerFormation(${f.id})" title="Supprimer" style="color:var(--danger)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const badge = document.getElementById('badge-count');
  if (badge) badge.textContent = formations.filter(f => f.statut === 'ouvert').length + ' actives';
}

function ouvrirModal(id) {
  const modal = document.getElementById('modal-formation');
  const form  = document.getElementById('form-formation');
  form.reset();
  document.getElementById('f-id').value = '';

  if (id) {
    const f = formations.find(x => x.id === id);
    if (!f) return;
    document.getElementById('modal-titre-label').innerHTML = '<i class="fa-solid fa-pen"></i> Modifier la formation';
    document.getElementById('f-id').value           = f.id;
    document.getElementById('f-titre').value        = f.titre;
    document.getElementById('f-type').value         = f.type;
    document.getElementById('f-date').value         = f.date;
    document.getElementById('f-lieu').value         = f.lieu;
    document.getElementById('f-places').value       = f.places_max;
    document.getElementById('f-statut').value       = f.statut;
    document.getElementById('f-description').value  = f.description || '';
  } else {
    document.getElementById('modal-titre-label').innerHTML = '<i class="fa-solid fa-plus"></i> Nouvelle formation';
  }
  modal.classList.add('open');
}

function fermerModal() {
  document.getElementById('modal-formation').classList.remove('open');
}

window.ouvrirModal       = ouvrirModal;
window.supprimerFormation = (id) => {
  if (!confirm(t('confirm_action'))) return;
  formations = formations.filter(f => f.id !== id);
  renderTable();
  showToast(t('sal_toast_formation_deleted'), 'warning');
};

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('formations');
  fetchFormations();

  document.getElementById('btn-nouvelle')?.addEventListener('click', () => ouvrirModal(null));
  document.getElementById('modal-close')?.addEventListener('click', fermerModal);
  document.getElementById('modal-cancel')?.addEventListener('click', fermerModal);
  document.getElementById('modal-formation')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-formation')) fermerModal();
  });

  document.getElementById('form-formation')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id  = document.getElementById('f-id').value;
    const data = {
      titre:       document.getElementById('f-titre').value.trim(),
      type:        document.getElementById('f-type').value,
      date:        document.getElementById('f-date').value,
      lieu:        document.getElementById('f-lieu').value.trim(),
      places_max:  parseInt(document.getElementById('f-places').value) || 0,
      statut:      document.getElementById('f-statut').value,
      description: document.getElementById('f-description').value.trim(),
    };
    if (!data.titre || !data.date) { showToast('Titre et date obligatoires', 'warning'); return; }

    try {
      const res = await apiFetch(id ? `/salarie/formations/${id}` : '/salarie/formations', {
        method: id ? 'PUT' : 'POST',
        body:   JSON.stringify(data),
      });
      if (res?.ok) {
        showToast(id ? 'Formation mise à jour' : 'Formation créée', 'success');
        fermerModal();
        fetchFormations();
        return;
      }
    } catch {}

    if (id) {
      const idx = formations.findIndex(f => f.id == id);
      if (idx !== -1) formations[idx] = { ...formations[idx], ...data };
    } else {
      formations.unshift({ id: Date.now(), places_prises: 0, ...data });
    }
    renderTable();
    fermerModal();
    showToast(id ? 'Mise à jour (local)' : 'Formation créée (local)', id ? 'success' : 'info');
  });
});
