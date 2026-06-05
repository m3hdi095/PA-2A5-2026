// CRUD categories, les appels vont vers l'API Go

let MOCK_CATS = [
  { id:1, nom:'Textiles',      description:'Vêtements, tissus, chutes...',    parent_id:null, nb_objets:58 },
  { id:2, nom:'Bois',          description:'Palettes, planches, mobilier...', parent_id:null, nb_objets:34 },
  { id:3, nom:'Métal',         description:'Ferraille, profilés, câbles...',  parent_id:null, nb_objets:21 },
  { id:4, nom:'Plastique',     description:'Bouteilles, bacs, films...',      parent_id:null, nb_objets:15 },
  { id:5, nom:'Électronique',  description:'Composants, appareils...',        parent_id:null, nb_objets:29 },
  { id:6, nom:'Autre',         description:'Divers non classé',             parent_id:null, nb_objets:12 },
];

let categories = [];
let filtered   = [];
let page       = 1;
const perPage  = 8;

function getParentName(parentId) {
  if (!parentId) return '—';
  const p = categories.find(c => c.id === parentId);
  return p ? p.nom : '—';
}

function renderTable() {
  const tbody = document.getElementById('categoriesBody');
  const start = (page - 1) * perPage;
  const slice = filtered.slice(start, start + perPage);

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
      <i class="fa-solid fa-tags" style="font-size:32px;color:var(--neutral-300)" aria-hidden="true"></i>
      <p>${t('cat_empty')}</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map(c => `
    <tr>
      <td style="color:var(--neutral-400);font-size:12px">#${c.id}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="cat-icon-badge">
            <i class="fa-solid fa-tag" aria-hidden="true"></i>
          </div>
          <div>
            <div class="td-primary">${escAdmin(c.nom)}</div>
            <div style="font-size:11px;color:var(--neutral-400)">${escAdmin(c.description || '')}</div>
          </div>
        </div>
      </td>
      <td>
        ${c.parent_id
          ? `<span class="badge badge-gray">${escAdmin(getParentName(c.parent_id))}</span>`
          : `<span class="badge badge-green">${t('label_racine')}</span>`}
      </td>
      <td style="font-weight:600;color:var(--uc-green)">${c.nb_objets || 0}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-ghost btn-icon" title="Modifier" onclick="editCat(${c.id})">
            <i class="fa-solid fa-pen" aria-hidden="true"></i>
          </button>
          <button class="btn btn-ghost btn-icon" title="Supprimer" onclick="deleteCat(${c.id})" style="color:var(--danger)">
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filtered.length / perPage);
  const pag   = document.getElementById('pagination');
  document.getElementById('pageInfo').textContent =
    `${Math.min((page-1)*perPage+1, filtered.length)}-${Math.min(page*perPage, filtered.length)} ${t('pagination_sur')} ${filtered.length}`;
  pag.querySelectorAll('.page-btn').forEach(b => b.remove());
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i === page ? ' active' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => { page = i; renderTable(); });
    pag.appendChild(btn);
  }
}

function renderTree() {
  const roots = categories.filter(c => !c.parent_id);
  const tree  = document.getElementById('treeView');
  if (!tree) return;
  tree.innerHTML = roots.map(r => {
    const children = categories.filter(c => c.parent_id === r.id);
    return `<div style="margin-bottom:12px">
      <div style="font-weight:600;color:var(--neutral-900);display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-folder" style="color:var(--uc-teal)" aria-hidden="true"></i>
        ${escAdmin(r.nom)}
        <span style="font-size:11px;color:var(--neutral-400);font-weight:400">(${r.nb_objets} objets)</span>
      </div>
      ${children.map(ch => `
        <div style="padding-left:24px;color:var(--neutral-600);display:flex;align-items:center;gap:8px;margin-top:6px">
          <i class="fa-solid fa-folder-open" style="color:var(--neutral-300);font-size:12px" aria-hidden="true"></i>
          ${escAdmin(ch.nom)}
          <span style="font-size:11px;color:var(--neutral-300)">(${ch.nb_objets})</span>
        </div>
      `).join('')}
    </div>`;
  }).join('');
}

function fillParentSelect(selected = null) {
  const sel = document.getElementById('parent_id');
  sel.innerHTML = `<option value="">${t('form_none_parent')}</option>`;
  categories.filter(c => !c.parent_id).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nom;
    if (selected && selected == c.id) opt.selected = true;
    sel.appendChild(opt);
  });
}

function openModal()  { document.getElementById('catModal').classList.add('open'); }
function closeModal() { document.getElementById('catModal').classList.remove('open'); }

function escAdmin(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function fetchCategories() {
  try {
    const res = await apiFetch('/categories');
    if (!res || !res.ok) throw new Error('API error');
    categories = await res.json();
    filtered = [...categories];
    renderTable();
    renderTree();
  } catch (err) {
    console.warn('API indisponible, utilisation des mocks', err);
    categories = [...MOCK_CATS];
    filtered   = [...categories];
    renderTable();
    renderTree();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('categories');
  fetchCategories();

  document.getElementById('searchInput').addEventListener('input', () => {
    const q  = document.getElementById('searchInput').value.toLowerCase();
    const pf = document.getElementById('parentFilter').value;
    filtered = categories.filter(c => {
      const matchQ = c.nom.toLowerCase().includes(q);
      const matchP = pf === '' ? true : pf === 'root' ? !c.parent_id : !!c.parent_id;
      return matchQ && matchP;
    });
    page = 1;
    renderTable();
  });

  document.getElementById('parentFilter').addEventListener('change', () => {
    document.getElementById('searchInput').dispatchEvent(new Event('input'));
  });

  document.getElementById('btnAdd').addEventListener('click', () => {
    document.getElementById('catId').value = '';
    document.getElementById('catForm').reset();
    fillParentSelect();
    document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-plus" aria-hidden="true"></i> ${t('cat_modal_add')}`;
    openModal();
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('catModal').addEventListener('click', e => {
    if (e.target === document.getElementById('catModal')) closeModal();
  });

  document.getElementById('catForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('catId').value;
    const data = {
      nom:         document.getElementById('nom').value,
      description: document.getElementById('description').value,
      parent_id:   document.getElementById('parent_id').value ? parseInt(document.getElementById('parent_id').value) : null,
    };

    try {
      const res = await apiFetch(id ? `/categories/${id}` : '/categories', {
        method: id ? 'PUT' : 'POST',
        body:   JSON.stringify(data),
      });
      if (res && res.ok) {
        showToast(id ? t('cat_toast_updated') : t('cat_toast_created'), 'success');
        closeModal();
        fetchCategories();
        return;
      }
    } catch { /* fallback local */ }

    // Fallback local si API hors ligne
    if (id) {
      const index = categories.findIndex(c => c.id == id);
      if (index !== -1) categories[index] = { ...categories[index], ...data };
    } else {
      const newId = Math.max(0, ...categories.map(c => c.id)) + 1;
      categories.push({ id: newId, ...data, nb_objets: 0 });
    }
    filtered = [...categories];
    renderTable();
    renderTree();
    showToast(id ? t('toast_local_updated') : t('toast_local_created'), 'warning');
    closeModal();
  });
});

window.editCat = id => {
  const c = categories.find(c => c.id === id);
  if (!c) return;
  document.getElementById('catId').value          = c.id;
  document.getElementById('nom').value            = c.nom;
  document.getElementById('description').value    = c.description || '';
  fillParentSelect(c.parent_id);
  document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen" aria-hidden="true"></i> ${t('modal_edit_prefix')} ${escAdmin(c.nom)}`;
  openModal();
};

window.deleteCat = async id => {
  const c = categories.find(c => c.id === id);
  if (!c || !confirm(t('confirm_action'))) return;
  try {
    const res = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
    if (res && (res.ok || res.status === 204)) {
      showToast(t('cat_toast_deleted'), 'error');
      fetchCategories();
      return;
    }
  } catch { /* fallback local */ }
  // Fallback local
  categories = categories.filter(c => c.id !== id && c.parent_id !== id);
  filtered   = [...categories];
  renderTable();
  renderTree();
  showToast(t('cat_toast_local_deleted'), 'warning');
};
