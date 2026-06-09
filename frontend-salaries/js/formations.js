// formations et evenements

const TYPE_COLORS = {
  atelier:   { bg:'var(--green-50)',  txt:'var(--green-700)' },
  formation: { bg:'#fef3e2',          txt:'#e8a020' },
  evenement: { bg:'#e8f5ee',          txt:'#2e8b57' },
};

let formations = [];

async function fetchFormations() {
  try {
    const res = await apiFetch('/evenements/mes-creations');
    if (res?.ok) {
      const data = await res.json();
      formations = Array.isArray(data) ? data : [];
    }
  } catch {}
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
    const tc        = TYPE_COLORS[f.type] || TYPE_COLORS.atelier;
    const places    = f.nb_places    ?? f.places_max    ?? 0;
    const inscrits  = f.nb_inscriptions ?? f.places_prises ?? 0;
    const pct       = places > 0 ? Math.round(inscrits / places * 100) : 0;
    const full      = inscrits >= places && places > 0;
    const dateRaw   = f.date_debut || f.date || '';
    const dateAff   = dateRaw ? new Date(dateRaw).toLocaleDateString(_lang === 'en' ? 'en-GB' : 'fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '—';
    const statBadge = f.statut === 'valide'
      ? `<span class="badge badge-success">${t('sal_badge_ouvert')}</span>`
      : f.statut === 'annule'
        ? `<span class="badge badge-red">${t('sal_badge_annule')}</span>`
        : f.statut === 'cloture'
          ? `<span class="badge badge-gray">${t('opt_cloture') || 'Clôturé'}</span>`
          : `<span class="badge badge-warning">${t('opt_en_attente') || 'En attente'}</span>`;
    return `<tr>
      <td style="font-weight:600">${esc(f.titre)}</td>
      <td><span class="badge" style="background:${tc.bg};color:${tc.txt}">${esc(f.type)}</span></td>
      <td>${dateAff}</td>
      <td>${esc(f.lieu || '')}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;min-width:36px">${inscrits}/${places}</span>
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
  if (badge) badge.textContent = formations.filter(f => f.statut === 'valide').length + ' actives';
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
    document.getElementById('f-date').value         = (f.date_debut || f.date || '').slice(0, 16);
    document.getElementById('f-date-fin').value     = (f.date_fin || '').slice(0, 16);
    document.getElementById('f-lieu').value         = f.lieu || '';
    document.getElementById('f-places').value       = f.nb_places ?? f.places_max ?? '';
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
window.supprimerFormation = async (id) => {
  if (!confirm(t('confirm_action'))) return;
  try {
    const res = await apiFetch(`/evenements/${id}`, { method: 'DELETE' });
    if (res?.ok) {
      formations = formations.filter(f => f.id !== id);
      renderTable();
      showToast(t('sal_toast_formation_deleted'), 'success');
      return;
    }
  } catch {}
  showToast('Erreur lors de la suppression', 'error');
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
      date_debut:  document.getElementById('f-date').value,
      date_fin:    document.getElementById('f-date-fin').value || '',
      lieu:        document.getElementById('f-lieu').value.trim(),
      nb_places:   parseInt(document.getElementById('f-places').value) || 0,
      statut:      document.getElementById('f-statut').value,
      description: document.getElementById('f-description').value.trim(),
    };
    if (!data.titre || !data.date_debut) { showToast('Titre et date obligatoires', 'warning'); return; }

    try {
      const res = await apiFetch(id ? `/evenements/${id}` : '/evenements', {
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

    showToast('Erreur lors de la sauvegarde', 'error');
  });
});
