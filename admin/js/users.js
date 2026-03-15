/**
 * UpcycleConnect — Admin Users JS
 */
const apiBase = 'http://localhost:8000'; // ou ''

const MOCK_USERS = [
  { id:1,  nom:'Marie Dupont',    email:'marie@mail.fr',      role:'particulier',   statut:'actif',    score:120, date:'2025-03-12', telephone:'0612345678', adresse:'Paris 11e' },
  { id:2,  nom:'Jean-Paul Lévy',  email:'jpl@artisan.fr',     role:'professionnel', statut:'actif',    score:340, date:'2025-04-01', telephone:'0623456789', adresse:'Paris 10e' },
  { id:3,  nom:'Sophie Martin',   email:'sophie@edu.fr',      role:'salarie',       statut:'actif',    score:200, date:'2025-01-20', telephone:'', adresse:'' },
  { id:4,  nom:'Kevin Roux',      email:'kevin@perso.com',    role:'particulier',   statut:'inactif',  score:40,  date:'2025-05-08', telephone:'', adresse:'' },
  { id:5,  nom:'Clara Noel',      email:'clara@design.fr',    role:'professionnel', statut:'actif',    score:510, date:'2025-02-15', telephone:'0634567890', adresse:'Paris 13e' },
  { id:6,  nom:'Marc Leclerc',    email:'marc@pro.fr',        role:'professionnel', statut:'suspendu', score:80,  date:'2024-12-01', telephone:'', adresse:'' },
  { id:7,  nom:'Amina Diallo',    email:'amina@mail.com',     role:'particulier',   statut:'actif',    score:60,  date:'2025-06-03', telephone:'', adresse:'Montreuil' },
  { id:8,  nom:'Thomas Bernard',  email:'thomas@upcycle.fr',  role:'admin',         statut:'actif',    score:0,   date:'2024-09-01', telephone:'0645678901', adresse:'Paris 10e' },
  { id:9,  nom:'Lucie Moreau',    email:'lucie@free.fr',      role:'particulier',   statut:'actif',    score:90,  date:'2025-07-11', telephone:'', adresse:'' },
  { id:10, nom:'Henri Petit',     email:'henri@artisan.net',  role:'professionnel', statut:'actif',    score:290, date:'2025-03-28', telephone:'', adresse:'Ivry' },
  { id:11, nom:'Nadia Fontaine',  email:'nadia@create.fr',    role:'salarie',       statut:'actif',    score:150, date:'2025-08-15', telephone:'', adresse:'' },
  { id:12, nom:'Paul Gauthier',   email:'paul@eco.fr',        role:'particulier',   statut:'inactif',  score:20,  date:'2025-09-01', telephone:'', adresse:'' },
];

const ROLE_LABELS = { particulier:'Particulier', professionnel:'Professionnel', salarie:'Salarié', admin:'Admin' };
const ROLE_COLORS = { particulier:'badge-green', professionnel:'badge-blue', salarie:'badge-gray', admin:'badge-orange' };
const STATUS_COLORS = { actif:'badge-green', inactif:'badge-gray', suspendu:'badge-red' };

let filtered  = [...MOCK_USERS];
let page      = 1;
const perPage = 8;

function getInitials(nom) {
  return nom.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
}

function renderTable() {
  const tbody   = document.getElementById('usersBody');
  const start   = (page - 1) * perPage;
  const slice   = filtered.slice(start, start + perPage);

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
      <p>Aucun utilisateur trouvé</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map(u => `
    <tr>
      <td style="color:var(--neutral-400);font-size:12px">#${u.id}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--uc-forest),var(--uc-teal));display:flex;align-items:center;justify-content:center;font-family:Poppins,sans-serif;font-size:12px;font-weight:700;color:white;flex-shrink:0">${getInitials(u.nom)}</div>
          <div>
            <div class="td-primary">${u.nom}</div>
            <div style="font-size:11px;color:var(--neutral-400)">${u.email}</div>
          </div>
        </div>
      </td>
      <td><span class="badge ${ROLE_COLORS[u.role]}">${ROLE_LABELS[u.role]}</span></td>
      <td><span class="badge ${STATUS_COLORS[u.statut]}">${u.statut.charAt(0).toUpperCase()+u.statut.slice(1)}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-weight:600;color:var(--uc-green);font-size:13px">${u.score}</div>
          <div class="progress-bar" style="width:60px">
            <div class="progress-fill" style="width:${Math.min(u.score/600*100,100).toFixed(0)}%"></div>
          </div>
        </div>
      </td>
      <td style="color:var(--neutral-500);font-size:12px">${new Date(u.date).toLocaleDateString('fr-FR')}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-ghost btn-icon" title="Modifier" onclick="editUser(${u.id})">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon" title="Suspendre" onclick="toggleStatus(${u.id})" style="color:var(--warning)">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          </button>
          <button class="btn btn-ghost btn-icon" title="Supprimer" onclick="deleteUser(${u.id})" style="color:var(--danger)">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  renderPagination();
}

function renderPagination() {
  const total   = Math.ceil(filtered.length / perPage);
  const pag     = document.getElementById('pagination');
  const info    = document.getElementById('pageInfo');
  const start   = (page-1)*perPage+1;
  const end     = Math.min(page*perPage, filtered.length);
  info.textContent = `${start}–${end} sur ${filtered.length}`;

  
  pag.querySelectorAll('.page-btn').forEach(b => b.remove());

  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.innerHTML = '‹';
  prevBtn.disabled = page === 1;
  prevBtn.addEventListener('click', () => { page--; renderTable(); });
  pag.appendChild(prevBtn);

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i === page ? ' active' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => { page = i; renderTable(); });
    pag.appendChild(btn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.innerHTML = '›';
  nextBtn.disabled = page === total;
  nextBtn.addEventListener('click', () => { page++; renderTable(); });
  pag.appendChild(nextBtn);
}

function applyFilters() {
  const q      = document.getElementById('searchInput').value.toLowerCase();
  const role   = document.getElementById('roleFilter').value;
  const status = document.getElementById('statusFilter').value;
  filtered = MOCK_USERS.filter(u =>
    (u.nom.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
    (role   === '' || u.role   === role) &&
    (status === '' || u.statut === status)
  );
  page = 1;
  renderTable();
}

// Modal
function openModal() { document.getElementById('userModal').classList.add('open'); }
function closeModal() { document.getElementById('userModal').classList.remove('open'); }

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  renderTable();

  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('roleFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('btnAdd').addEventListener('click', () => {
    document.getElementById('userId').value = '';
    document.getElementById('userForm').reset();
    document.getElementById('passGroup').style.display = 'block';
    document.getElementById('modalTitle').innerHTML = `<svg viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> Ajouter un utilisateur`;
    openModal();
  });
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('userModal').addEventListener('click', e => {
    if (e.target === document.getElementById('userModal')) closeModal();
  });

  document.getElementById('userForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('userId').value;
    // API call simulation
    showToast(id ? 'Utilisateur mis à jour !' : 'Utilisateur créé !', 'success');
    closeModal();
    renderTable();
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const rows = [['ID','Nom','Email','Rôle','Statut','Date']];
    MOCK_USERS.forEach(u => rows.push([u.id, u.nom, u.email, u.role, u.statut, u.date]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    a.download = 'utilisateurs.csv';
    a.click();
  });
});

window.editUser = (id) => {
  const u = MOCK_USERS.find(u => u.id === id);
  if (!u) return;
  document.getElementById('userId').value = u.id;
  document.getElementById('nom').value = u.nom;
  document.getElementById('email').value = u.email;
  document.getElementById('role').value = u.role;
  document.getElementById('statut').value = u.statut;
  document.getElementById('telephone').value = u.telephone || '';
  document.getElementById('adresse').value = u.adresse || '';
  document.getElementById('passGroup').style.display = 'none';
  document.getElementById('modalTitle').innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg> Modifier — ${u.nom}`;
  openModal();
};

window.toggleStatus = (id) => {
  const u = MOCK_USERS.find(u => u.id === id);
  if (!u) return;
  const newStatus = u.statut === 'actif' ? 'suspendu' : 'actif';
  u.statut = newStatus;
  showToast(`Compte ${newStatus === 'actif' ? 'réactivé' : 'suspendu'}`, newStatus === 'actif' ? 'success' : 'warning');
  renderTable();
};

window.deleteUser = (id) => {
  const u = MOCK_USERS.find(u => u.id === id);
  if (!u || !confirm(`Supprimer ${u.nom} ?`)) return;
  const idx = MOCK_USERS.findIndex(u => u.id === id);
  MOCK_USERS.splice(idx, 1);
  filtered = filtered.filter(u => u.id !== id);
  showToast('Utilisateur supprimé', 'error');
  renderTable();
};

