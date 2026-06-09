// evenements/formations depuis l'API, la création n'est pas encore branchée

const ICONES_TYPE = {
  formation: 'fa-graduation-cap',
  atelier:   'fa-screwdriver-wrench',
  evenement: 'fa-calendar-days',
};


function typeLabel(type) {
  const keys = { formation:'prest_type_formation', atelier:'prest_type_atelier', evenement:'prest_type_evenement' };
  return t(keys[type] || 'prest_type_evenement');
}

function statutLabel(statut) {
  const keys = { en_attente:'prest_statut_brouillon', valide:'prest_statut_publie', annule:'prest_statut_annule', cloture:'prest_statut_complet' };
  return t(keys[statut] || 'prest_statut_brouillon');
}
const TYPE_COLORS = { formation:'badge-blue', atelier:'badge-green', evenement:'badge-orange' };
const STAT_COLORS = { valide:'badge-green', en_attente:'badge-gray', annule:'badge-red', cloture:'badge-orange' };

let prestations = [];
let filtered    = [];
let page        = 1;
const perPage   = 6;
let viewMode    = 'grid';

function pct(p) { return p.places_max ? Math.round(p.places_prises / p.places_max * 100) : 0; }

function escAdmin(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderList() {
  const tbody = document.getElementById('prestationsBody');
  const start = (page - 1) * perPage;
  const slice = filtered.slice(start, start + perPage);

  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--neutral-300)">${t('prest_empty')}</td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map(p => {
    const d = new Date(p.date_debut).toLocaleDateString(locale, { day:'2-digit', month:'short', year:'numeric' });
    return `
    <tr>
      <td style="color:var(--neutral-400);font-size:12px">#${p.id}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="prest-icon-badge">
            <i class="fa-solid ${ICONES_TYPE[p.type] || ICONES_TYPE.evenement}" aria-hidden="true"></i>
          </div>
          <div>
            <div class="td-primary">${escAdmin(p.titre)}</div>
            <div style="font-size:11px;color:var(--neutral-400)">${escAdmin(p.lieu)}</div>
          </div>
        </div>
      </td>
      <td><span class="badge ${TYPE_COLORS[p.type]}">${typeLabel(p.type)}</span></td>
      <td style="font-size:12px;color:var(--neutral-500)">${d}</td>
      <td>
        <div style="font-size:12px;color:var(--neutral-700)">${p.places_prises}/${p.places_max}</div>
        <div class="progress-bar" style="width:70px;margin-top:4px">
          <div class="progress-fill ${pct(p)===100?'orange':''}" style="width:${pct(p)}%"></div>
        </div>
      </td>
      <td style="font-weight:600;color:var(--uc-green)">${p.prix ? p.prix+'€' : `<span style="color:var(--neutral-400)">${t('label_gratuit')}</span>`}</td>
      <td><span class="badge ${STAT_COLORS[p.statut] || 'badge-gray'}">${statutLabel(p.statut)}</span></td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-ghost btn-icon" onclick="editPrest(${p.id})">
            <i class="fa-solid fa-pen" aria-hidden="true"></i>
          </button>
          <button class="btn btn-ghost btn-icon" onclick="deletePrest(${p.id})" style="color:var(--danger)">
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filtered.length / perPage);
  const pag   = document.getElementById('pagination');
  document.getElementById('pageInfo').textContent = `${(page-1)*perPage+1}-${Math.min(page*perPage,filtered.length)} ${t('pagination_sur')} ${filtered.length}`;
  pag.querySelectorAll('.page-btn').forEach(b => b.remove());
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i === page ? ' active' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => { page = i; renderList(); });
    pag.appendChild(btn);
  }
}

function renderGrid() {
  const grid  = document.getElementById('gridView');
  const start = (page - 1) * perPage;
  const slice = filtered.slice(start, start + perPage);
  if (!slice.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <i class="fa-solid fa-calendar-xmark" style="font-size:36px;color:var(--neutral-300)" aria-hidden="true"></i>
      <p>${t('prest_empty')}</p>
    </div>`;
    renderPagination();
    return;
  }
  grid.innerHTML = slice.map(p => `
    <div class="card" style="overflow:visible">
      <div class="prest-card-header">
        <i class="fa-solid ${ICONES_TYPE[p.type] || ICONES_TYPE.evenement}" style="font-size:24px;color:var(--green-100)" aria-hidden="true"></i>
        <span class="badge ${STAT_COLORS[p.statut]}" style="position:absolute;top:10px;right:10px">${statutLabel(p.statut)}</span>
      </div>
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <span class="badge ${TYPE_COLORS[p.type]}">${typeLabel(p.type)}</span>
          <span style="font-size:11px;color:var(--neutral-400)">${escAdmin(p.lieu)}</span>
        </div>
        <div class="td-primary" style="font-size:15px;margin-bottom:6px">${escAdmin(p.titre)}</div>
        <div style="font-size:12px;color:var(--neutral-500);margin-bottom:12px;line-height:1.5">${escAdmin(p.description)}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:12px;color:var(--neutral-500)">${p.places_prises}/${p.places_max} ${t('prest_inscrits')}</div>
          <div style="font-weight:700;color:var(--uc-green)">${p.prix ? p.prix+'€' : t('label_gratuit')}</div>
        </div>
        <div class="progress-bar" style="margin-bottom:12px">
          <div class="progress-fill ${pct(p)===100?'orange':''}" style="width:${pct(p)}%"></div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" style="flex:1;justify-content:center" onclick="editPrest(${p.id})">
            <i class="fa-solid fa-pen" aria-hidden="true"></i> ${t('prest_btn_edit')}
          </button>
          <button class="btn btn-ghost btn-icon" onclick="deletePrest(${p.id})" style="color:var(--danger)">
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
  renderPagination();
}

function render() {
  if (viewMode === 'list') renderList();
  else                     renderGrid();
}

function applyFilters() {
  const q       = document.getElementById('searchInput').value.toLowerCase();
  const typeVal = document.getElementById('typeFilter').value;
  const statVal = document.getElementById('statusFilter').value;
  filtered = prestations.filter(p =>
    p.titre.toLowerCase().includes(q) &&
    (typeVal === '' || p.type   === typeVal) &&
    (statVal === '' || p.statut === statVal)
  );
  page = 1;
  render();
}

async function fetchPrestations() {
  try {
    const res = await apiFetch('/admin/evenements');
    if (!res || !res.ok) throw new Error('API error');
    const data = await res.json();
    prestations = (data || []).map(e => ({
      id:            e.id,
      titre:         e.titre,
      type:          e.type || 'evenement',
      statut:        e.statut || 'en_attente',
      prix:          e.tarif || 0,
      places_max:    e.nb_places    ?? e.places_max    ?? 0,
      places_prises: e.nb_inscriptions ?? e.places_prises ?? 0,
      lieu:          e.lieu || '',
      date_debut:    e.date_debut || '',
      date_fin:      e.date_fin   || '',
      description:   e.description || '',
    }));
    filtered = [...prestations];
    render();
  } catch {
    prestations = [];
    filtered    = [];
    render();
  }
}

function openModal()  { document.getElementById('prestModal').classList.add('open'); }
function closeModal() { document.getElementById('prestModal').classList.remove('open'); }

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('prestations');
  fetchPrestations();

  document.getElementById('btnGrid').addEventListener('click', () => {
    viewMode = 'grid';
    document.getElementById('gridView').style.display = 'grid';
    document.getElementById('listView').style.display = 'none';
    render();
  });
  document.getElementById('btnList').addEventListener('click', () => {
    viewMode = 'list';
    document.getElementById('listView').style.display = 'block';
    document.getElementById('gridView').style.display = 'none';
    render();
  });

  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('typeFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);

  document.getElementById('btnAdd').addEventListener('click', () => {
    document.getElementById('prestId').value = '';
    document.getElementById('prestForm').reset();
    document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-plus" aria-hidden="true"></i> ${t('prest_modal_add')}`;
    openModal();
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('prestModal').addEventListener('click', e => {
    if (e.target === document.getElementById('prestModal')) closeModal();
  });

  document.getElementById('prestForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('prestId').value;
    const data = {
      titre:       document.getElementById('titre').value,
      description: document.getElementById('description').value,
      type:        document.getElementById('type').value,
      statut:      document.getElementById('statut').value,
      tarif:       parseFloat(document.getElementById('prix').value) || 0,
      nb_places:   parseInt(document.getElementById('places_max').value) || 10,
      lieu:        document.getElementById('lieu').value,
      date_debut:  document.getElementById('date_debut').value,
      date_fin:    document.getElementById('date_fin').value,
    };

    try {
      const res = await apiFetch(id ? `/evenements/${id}` : '/evenements', {
        method: id ? 'PUT' : 'POST',
        body:   JSON.stringify(data),
      });
      if (res?.ok) {
        showToast(id ? t('prest_toast_updated') : t('prest_toast_created'), 'success');
        closeModal();
        fetchPrestations();
        return;
      }
      const errData = res ? await res.json().catch(() => ({})) : {};
      showToast(errData.error || t('prest_toast_save_error') || 'Erreur lors de la sauvegarde', 'error');
    } catch (err) {
      showToast(t('prest_toast_save_error') || 'Erreur lors de la sauvegarde', 'error');
    }
  });
});

window.editPrest = id => {
  const p = prestations.find(p => p.id === id);
  if (!p) return;
  document.getElementById('prestId').value         = p.id;
  document.getElementById('titre').value           = p.titre;
  document.getElementById('description').value     = p.description || '';
  document.getElementById('type').value            = p.type;
  document.getElementById('statut').value          = p.statut;
  document.getElementById('prix').value            = p.prix;
  document.getElementById('places_max').value      = p.places_max;
  document.getElementById('lieu').value            = p.lieu || '';
  document.getElementById('date_debut').value      = p.date_debut ? p.date_debut.slice(0, 16) : '';
  document.getElementById('date_fin').value        = p.date_fin   ? p.date_fin.slice(0, 16)   : '';
  document.getElementById('modalTitle').innerHTML  = `<i class="fa-solid fa-pen" aria-hidden="true"></i> ${t('modal_edit_prefix')} ${escAdmin(p.titre)}`;
  openModal();
};

window.deletePrest = async id => {
  const p = prestations.find(p => p.id === id);
  if (!p || !confirm(t('confirm_action'))) return;
  try {
    const res = await apiFetch(`/evenements/${id}`, { method: 'DELETE' });
    if (!res?.ok) { showToast(t('toast_error') || 'Erreur lors de la suppression', 'error'); return; }
  } catch { showToast(t('toast_error') || 'Erreur lors de la suppression', 'error'); return; }
  prestations = prestations.filter(p => p.id !== id);
  filtered    = filtered.filter(p => p.id !== id);
  render();
  showToast(t('prest_toast_deleted'), 'success');
};
