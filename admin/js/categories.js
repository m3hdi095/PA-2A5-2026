/**
 * UpcycleConnect — Admin Categories JS
 */
const apiBase = 'http://localhost:8000'; // ou ''

let MOCK_CATS = [
  { id:1,  nom:'Mobilier',        description:'Meubles, rangements...',    parent_id:null, icone:'🪑', nb_objets:34 },
  { id:2,  nom:'Textile',         description:'Vêtements, tissus...',       parent_id:null, icone:'🧵', nb_objets:58 },
  { id:3,  nom:'Électronique',    description:'Appareils électroniques...',  parent_id:null, icone:'💡', nb_objets:21 },
  { id:4,  nom:'Jardin',          description:'Plantes, outils jardin...',   parent_id:null, icone:'🌿', nb_objets:15 },
  { id:5,  nom:'Vaisselle',       description:'Bocaux, céramiques...',       parent_id:null, icone:'🍶', nb_objets:29 },
  { id:6,  nom:'Chaise',          description:'Chaises recyclables',         parent_id:1,    icone:'🪑', nb_objets:12 },
  { id:7,  nom:'Table',           description:'Tables en bois...',           parent_id:1,    icone:'🪵', nb_objets:8 },
  { id:8,  nom:'Coton',           description:'Chutes coton naturel',        parent_id:2,    icone:'🧶', nb_objets:22 },
  { id:9,  nom:'Cuir',            description:'Chutes cuir tannage végétal', parent_id:2,    icone:'👜', nb_objets:14 },
  { id:10, nom:'Palettes bois',   description:'Palettes de toutes tailles',  parent_id:1,    icone:'📦', nb_objets:18 },
];

let filtered = [...MOCK_CATS];
let page = 1;
const perPage = 8;

function getParentName(parent_id) {
  if (!parent_id) return '—';
  const p = MOCK_CATS.find(c => c.id === parent_id);
  return p ? `${p.icone} ${p.nom}` : '—';
}

function renderTable() {
  const tbody = document.getElementById('categoriesBody');
  const start = (page-1)*perPage;
  const slice = filtered.slice(start, start+perPage);

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><svg viewBox="0 0 24 24"><path d="M12 2l-5.5 9h11z M17.5 13c-2.49 0-4.5 2.01-4.5 4.5S15.01 22 17.5 22s4.5-2.01 4.5-4.5S19.99 13 17.5 13zm-10 1H2v8h5.5v-8z"/></svg><p>Aucune catégorie</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map(c => `
    <tr>
      <td style="color:var(--neutral-400);font-size:12px">#${c.id}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:var(--uc-teal-pale);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">${c.icone}</div>
          <div>
            <div class="td-primary">${c.nom}</div>
            <div style="font-size:11px;color:var(--neutral-400)">${c.description || ''}</div>
          </div>
        </div>
      </td>
      <td>
        ${c.parent_id
          ? `<span class="badge badge-gray">${getParentName(c.parent_id)}</span>`
          : `<span class="badge badge-green">Racine</span>`}
      </td>
      <td style="font-weight:600;color:var(--uc-green)">${c.nb_objets}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-ghost btn-icon" title="Modifier" onclick="editCat(${c.id})">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon" title="Supprimer" onclick="deleteCat(${c.id})" style="color:var(--danger)">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  renderPagination();
}

function renderPagination() {
  const total  = Math.ceil(filtered.length / perPage);
  const pag    = document.getElementById('pagination');
  document.getElementById('pageInfo').textContent = `${Math.min((page-1)*perPage+1,filtered.length)}–${Math.min(page*perPage,filtered.length)} sur ${filtered.length}`;
  pag.querySelectorAll('.page-btn').forEach(b => b.remove());
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i===page?' active':'');
    btn.textContent = i;
    btn.addEventListener('click', () => { page=i; renderTable(); });
    pag.appendChild(btn);
  }
}

function renderTree() {
  const roots = MOCK_CATS.filter(c => !c.parent_id);
  const tree  = document.getElementById('treeView');
  tree.innerHTML = roots.map(r => {
    const children = MOCK_CATS.filter(c => c.parent_id === r.id);
    return `<div style="margin-bottom:8px">
      <div style="font-weight:600;color:var(--neutral-900);display:flex;align-items:center;gap:6px">
        <span>${r.icone}</span> ${r.nom}
        <span style="font-size:11px;color:var(--neutral-400);font-weight:400">(${r.nb_objets})</span>
      </div>
      ${children.map(ch => `
        <div style="padding-left:20px;color:var(--neutral-600);display:flex;align-items:center;gap:6px;margin-top:4px">
          <svg viewBox="0 0 24 24" style="width:10px;height:10px;fill:var(--neutral-300)"><path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>
          ${ch.icone} ${ch.nom}
          <span style="font-size:11px;color:var(--neutral-300)">(${ch.nb_objets})</span>
        </div>
      `).join('')}
    </div>`;
  }).join('');
}

function fillParentSelect(selected = null) {
  const sel = document.getElementById('parent_id');
  sel.innerHTML = '<option value="">Aucune (catégorie racine)</option>';
  MOCK_CATS.forEach(c => {
    if (c.parent_id) return; // only roots as parents
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.icone} ${c.nom}`;
    if (selected && selected == c.id) opt.selected = true;
    sel.appendChild(opt);
  });
}

function openModal() { document.getElementById('catModal').classList.add('open'); }
function closeModal() { document.getElementById('catModal').classList.remove('open'); }

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  renderTable();
  renderTree();

  document.getElementById('searchInput').addEventListener('input', () => {
    const q = document.getElementById('searchInput').value.toLowerCase();
    const pf = document.getElementById('parentFilter').value;
    filtered = MOCK_CATS.filter(c => {
      const matchQ = c.nom.toLowerCase().includes(q);
      const matchP = pf==='' ? true : pf==='root' ? !c.parent_id : !!c.parent_id;
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
    document.getElementById('modalTitle').innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2l-5.5 9h11z"/></svg> Ajouter une catégorie`;
    openModal();
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('catModal').addEventListener('click', e => {
    if (e.target === document.getElementById('catModal')) closeModal();
  });

  document.getElementById('catForm').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('catId').value;
    if (id) {
      const cat = MOCK_CATS.find(c => c.id == id);
      cat.nom = document.getElementById('nom').value;
      cat.description = document.getElementById('description').value;
      cat.parent_id = document.getElementById('parent_id').value || null;
      cat.icone = document.getElementById('icone').value || '📦';
      showToast('Catégorie mise à jour !', 'success');
    } else {
      MOCK_CATS.push({
        id: Math.max(...MOCK_CATS.map(c=>c.id))+1,
        nom: document.getElementById('nom').value,
        description: document.getElementById('description').value,
        parent_id: document.getElementById('parent_id').value || null,
        icone: document.getElementById('icone').value || '📦',
        nb_objets: 0,
      });
      showToast('Catégorie créée !', 'success');
    }
    filtered = [...MOCK_CATS];
    renderTable();
    renderTree();
    closeModal();
  });
});

window.editCat = id => {
  const c = MOCK_CATS.find(c => c.id === id);
  if (!c) return;
  document.getElementById('catId').value = c.id;
  document.getElementById('nom').value = c.nom;
  document.getElementById('description').value = c.description || '';
  document.getElementById('icone').value = c.icone || '';
  fillParentSelect(c.parent_id);
  document.getElementById('modalTitle').innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></svg> Modifier — ${c.nom}`;
  openModal();
};

window.deleteCat = id => {
  const c = MOCK_CATS.find(c => c.id === id);
  if (!c || !confirm(`Supprimer "${c.nom}" ?`)) return;
  MOCK_CATS = MOCK_CATS.filter(c => c.id !== id && c.parent_id !== id);
  filtered = [...MOCK_CATS];
  renderTable();
  renderTree();
  showToast('Catégorie supprimée', 'error');
};