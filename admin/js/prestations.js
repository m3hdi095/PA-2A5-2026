/**
 * UpcycleConnect — Admin Prestations JS
 */
const apiBase = 'http://localhost:8000'; // ou ''

let MOCK_PREST = [
  { id:1, titre:'Upcycling du bois',          type:'atelier',    statut:'publie',    prix:45,  places_max:12, places_prises:10, lieu:'Paris 10e', date_debut:'2026-04-05T14:00', date_fin:'2026-04-05T17:00', categorie_id:1, emoji:'🪵', description:'Découvrez comment transformer des palettes en mobilier.' },
  { id:2, titre:'Couture zéro déchet',         type:'formation',  statut:'complet',   prix:35,  places_max:8,  places_prises:8,  lieu:'Paris 11e', date_debut:'2026-04-12T10:00', date_fin:'2026-04-12T13:00', categorie_id:2, emoji:'🧵', description:'Apprenez les bases de la couture upcycling.' },
  { id:3, titre:'IoT & collecte intelligente', type:'formation',  statut:'publie',    prix:80,  places_max:15, places_prises:6,  lieu:'En ligne',  date_debut:'2026-04-20T18:00', date_fin:'2026-04-20T20:00', categorie_id:3, emoji:'🤖', description:'Découvrez les capteurs IoT appliqués à la collecte.' },
  { id:4, titre:'Poterie recyclée',            type:'atelier',    statut:'publie',    prix:55,  places_max:10, places_prises:4,  lieu:'Montreuil', date_debut:'2026-05-03T09:00', date_fin:'2026-05-03T12:00', categorie_id:5, emoji:'🏺', description:'Créer avec de la céramique récupérée.' },
  { id:5, titre:'Forum upcycling Paris 2026',  type:'evenement',  statut:'publie',    prix:0,   places_max:200,places_prises:120,lieu:'Paris 13e', date_debut:'2026-05-15T09:00', date_fin:'2026-05-15T18:00', categorie_id:null, emoji:'🌿', description:'Grand forum annuel de l\'upcycling en Île-de-France.' },
  { id:6, titre:'Initiation sérigraphie',      type:'atelier',    statut:'brouillon', prix:30,  places_max:8,  places_prises:0,  lieu:'Paris 16e', date_debut:'2026-06-01T14:00', date_fin:'2026-06-01T17:00', categorie_id:2, emoji:'🎨', description:'Découverte de la sérigraphie sur textile recyclé.' },
];

const CATS = [
  { id:1, nom:'Mobilier', icone:'🪑' }, { id:2, nom:'Textile', icone:'🧵' },
  { id:3, nom:'Électronique', icone:'💡' }, { id:4, nom:'Jardin', icone:'🌿' }, { id:5, nom:'Vaisselle', icone:'🍶' },
];

const TYPE_LABELS  = { formation:'Formation', atelier:'Atelier', evenement:'Événement' };
const TYPE_COLORS  = { formation:'badge-blue', atelier:'badge-green', evenement:'badge-orange' };
const STAT_COLORS  = { publie:'badge-green', brouillon:'badge-gray', annule:'badge-red', complet:'badge-orange' };

let filtered = [...MOCK_PREST];
let page = 1;
const perPage = 6;
let viewMode = 'grid';

function pct(p) { return Math.round(p.places_prises/p.places_max*100); }

/* ===== TABLE VIEW ===== */
function renderList() {
  const tbody = document.getElementById('prestationsBody');
  const start = (page-1)*perPage;
  const slice = filtered.slice(start, start+perPage);

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--neutral-300)">Aucune prestation</td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map(p => {
    const cat = CATS.find(c => c.id === p.categorie_id);
    const d   = new Date(p.date_debut).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
    return `
    <tr>
      <td style="color:var(--neutral-400);font-size:12px">#${p.id}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:var(--uc-teal-pale);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px">${p.emoji}</div>
          <div>
            <div class="td-primary">${p.titre}</div>
            <div style="font-size:11px;color:var(--neutral-400)">${p.lieu}</div>
          </div>
        </div>
      </td>
      <td><span class="badge ${TYPE_COLORS[p.type]}">${TYPE_LABELS[p.type]}</span></td>
      <td style="font-size:12px;color:var(--neutral-500)">${d}</td>
      <td>
        <div style="font-size:12px;color:var(--neutral-700)">${p.places_prises}/${p.places_max}</div>
        <div class="progress-bar" style="width:70px;margin-top:4px">
          <div class="progress-fill ${pct(p)===100?'orange':''}" style="width:${pct(p)}%"></div>
        </div>
      </td>
      <td style="font-weight:600;color:var(--uc-green)">${p.prix ? p.prix+'€' : '<span style="color:var(--neutral-400)">Gratuit</span>'}</td>
      <td><span class="badge ${STAT_COLORS[p.statut]}">${p.statut}</span></td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-ghost btn-icon" onclick="editPrest(${p.id})"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg></button>
          <button class="btn btn-ghost btn-icon" onclick="deletePrest(${p.id})" style="color:var(--danger)"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filtered.length/perPage);
  const pag   = document.getElementById('pagination');
  document.getElementById('pageInfo').textContent = `${(page-1)*perPage+1}–${Math.min(page*perPage,filtered.length)} sur ${filtered.length}`;
  pag.querySelectorAll('.page-btn').forEach(b => b.remove());
  for (let i=1; i<=total; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn'+(i===page?' active':'');
    btn.textContent = i;
    btn.addEventListener('click', () => { page=i; renderList(); });
    pag.appendChild(btn);
  }
}

/* ===== GRID VIEW ===== */
function renderGrid() {
  const grid = document.getElementById('gridView');
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg><p>Aucune prestation</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(p => `
    <div class="card" style="overflow:visible">
      <div style="height:70px;background:linear-gradient(135deg,var(--uc-forest),var(--uc-teal));display:flex;align-items:center;justify-content:center;font-size:32px;border-radius:var(--radius-lg) var(--radius-lg) 0 0;position:relative">
        ${p.emoji}
        <span class="badge ${STAT_COLORS[p.statut]}" style="position:absolute;top:10px;right:10px">${p.statut}</span>
      </div>
      <div style="padding:16px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <span class="badge ${TYPE_COLORS[p.type]}">${TYPE_LABELS[p.type]}</span>
          <span style="font-size:11px;color:var(--neutral-400)">${p.lieu}</span>
        </div>
        <div style="font-family:Poppins,sans-serif;font-weight:600;font-size:15px;color:var(--neutral-900);margin-bottom:6px">${p.titre}</div>
        <div style="font-size:12px;color:var(--neutral-500);margin-bottom:12px;line-height:1.5">${p.description}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:12px;color:var(--neutral-500)">${p.places_prises}/${p.places_max} inscrits</div>
          <div style="font-weight:700;color:var(--uc-green)">${p.prix ? p.prix+'€' : 'Gratuit'}</div>
        </div>
        <div class="progress-bar" style="margin-bottom:12px">
          <div class="progress-fill ${pct(p)===100?'orange':''}" style="width:${pct(p)}%"></div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" style="flex:1;justify-content:center" onclick="editPrest(${p.id})">Modifier</button>
          <button class="btn btn-danger btn-icon" onclick="deletePrest(${p.id})"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </div>
      </div>
    </div>
  `).join('');
}

function render() {
  if (viewMode === 'list') { renderList(); }
  else                     { renderGrid(); }
}

function fillCatSelect(selected = null) {
  const sel = document.getElementById('categorie_id');
  sel.innerHTML = '<option value="">— Choisir —</option>';
  CATS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.icone} ${c.nom}`;
    if (selected && selected == c.id) opt.selected = true;
    sel.appendChild(opt);
  });
}

function openModal() { document.getElementById('prestModal').classList.add('open'); }
function closeModal() { document.getElementById('prestModal').classList.remove('open'); }

function applyFilters() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const t = document.getElementById('typeFilter').value;
  const s = document.getElementById('statusFilter').value;
  filtered = MOCK_PREST.filter(p =>
    p.titre.toLowerCase().includes(q) &&
    (t==='' || p.type===t) &&
    (s==='' || p.statut===s)
  );
  page = 1;
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  render();

  // View toggle
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
    fillCatSelect();
    document.getElementById('modalTitle').innerHTML = `<svg viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg> Ajouter une prestation`;
    openModal();
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('prestModal').addEventListener('click', e => {
    if (e.target === document.getElementById('prestModal')) closeModal();
  });

  document.getElementById('prestForm').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('prestId').value;
    const data = {
      titre:        document.getElementById('titre').value,
      description:  document.getElementById('description').value,
      type:         document.getElementById('type').value,
      statut:       document.getElementById('statut').value,
      prix:         parseFloat(document.getElementById('prix').value) || 0,
      places_max:   parseInt(document.getElementById('places_max').value) || 10,
      lieu:         document.getElementById('lieu').value,
      date_debut:   document.getElementById('date_debut').value,
      date_fin:     document.getElementById('date_fin').value,
      categorie_id: document.getElementById('categorie_id').value || null,
      emoji: '📋',
    };
    if (id) {
      Object.assign(MOCK_PREST.find(p => p.id == id), data);
      showToast('Prestation mise à jour !', 'success');
    } else {
      data.id = Math.max(...MOCK_PREST.map(p=>p.id))+1;
      data.places_prises = 0;
      MOCK_PREST.push(data);
      showToast('Prestation créée !', 'success');
    }
    filtered = [...MOCK_PREST];
    render();
    closeModal();
  });
});

window.editPrest = id => {
  const p = MOCK_PREST.find(p => p.id === id);
  if (!p) return;
  document.getElementById('prestId').value = p.id;
  document.getElementById('titre').value = p.titre;
  document.getElementById('description').value = p.description || '';
  document.getElementById('type').value = p.type;
  document.getElementById('statut').value = p.statut;
  document.getElementById('prix').value = p.prix;
  document.getElementById('places_max').value = p.places_max;
  document.getElementById('lieu').value = p.lieu || '';
  document.getElementById('date_debut').value = p.date_debut ? p.date_debut.slice(0,16) : '';
  document.getElementById('date_fin').value = p.date_fin ? p.date_fin.slice(0,16) : '';
  fillCatSelect(p.categorie_id);
  document.getElementById('modalTitle').innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></svg> Modifier — ${p.titre}`;
  openModal();
};

window.deletePrest = id => {
  const p = MOCK_PREST.find(p => p.id === id);
  if (!p || !confirm(`Supprimer "${p.titre}" ?`)) return;
  MOCK_PREST.splice(MOCK_PREST.findIndex(p => p.id===id), 1);
  filtered = filtered.filter(p => p.id !== id);
  render();
  showToast('Prestation supprimée', 'error');
};