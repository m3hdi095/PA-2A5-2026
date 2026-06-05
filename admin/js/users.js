// liste des utilisateurs, filtres, edition et suspension

const MOCK_USERS = [
  { id:1,  nom:'Marie Dupont',   prenom:'Marie',   email:'marie@mail.fr',     role:'particulier',   statut:'actif',    score:120, date:'2025-03-12', telephone:'0612345678', adresse:'Paris 11e' },
  { id:2,  nom:'Lévy',          prenom:'Jean-Paul',email:'jpl@artisan.fr',    role:'professionnel', statut:'actif',    score:340, date:'2025-04-01', telephone:'0623456789', adresse:'Paris 10e' },
  { id:3,  nom:'Martin',        prenom:'Sophie',   email:'sophie@edu.fr',     role:'salarie',       statut:'actif',    score:200, date:'2025-01-20', telephone:'', adresse:'' },
  { id:4,  nom:'Roux',          prenom:'Kevin',    email:'kevin@perso.com',   role:'particulier',   statut:'inactif',  score:40,  date:'2025-05-08', telephone:'', adresse:'' },
  { id:5,  nom:'Noel',          prenom:'Clara',    email:'clara@design.fr',   role:'professionnel', statut:'actif',    score:510, date:'2025-02-15', telephone:'0634567890', adresse:'Paris 13e' },
  { id:6,  nom:'Leclerc',       prenom:'Marc',     email:'marc@pro.fr',       role:'professionnel', statut:'suspendu', score:80,  date:'2024-12-01', telephone:'', adresse:'' },
  { id:7,  nom:'Diallo',        prenom:'Amina',    email:'amina@mail.com',    role:'particulier',   statut:'actif',    score:60,  date:'2025-06-03', telephone:'', adresse:'Montreuil' },
  { id:8,  nom:'Bernard',       prenom:'Thomas',   email:'thomas@upcycle.fr', role:'admin',         statut:'actif',    score:0,   date:'2024-09-01', telephone:'0645678901', adresse:'Paris 10e' },
];

let users    = [];
let filtered = [];
let page     = 1;
const perPage = 8;

function roleLabel(role) {
  const keys = { particulier:'users_role_particulier', professionnel:'users_role_professionnel', salarie:'users_role_salarie', admin:'users_role_admin' };
  return t(keys[role] || 'users_role_particulier');
}

function statusLabel(statut) {
  const keys = { actif:'user_actif', inactif:'users_status_inactif', suspendu:'user_suspendu' };
  return t(keys[statut] || 'users_status_inactif');
}
const ROLE_COLORS  = { particulier:'badge-green', professionnel:'badge-blue', salarie:'badge-gray', admin:'badge-orange' };
const STATUS_COLORS = { actif:'badge-green', inactif:'badge-gray', suspendu:'badge-red' };

function getInitials(nom, prenom) {
  const n = prenom ? prenom.charAt(0) : '';
  const s = nom    ? nom.charAt(0)    : '';
  return (n + s).toUpperCase() || 'UC';
}

function mapStatut(statut) {
  if (statut === 1 || statut === true)  return 'actif';
  if (statut === 0 || statut === false) return 'inactif';
  return statut || 'inactif';
}

async function fetchUsers() {
  try {
    const res = await apiFetch('/admin/users');
    if (!res || !res.ok) throw new Error('API error');
    const data = await res.json();
    users = (data || []).map(u => ({
      id:        u.id,
      nom:       u.nom || '',
      prenom:    u.prenom || '',
      email:     u.email,
      role:      u.role,
      statut:    mapStatut(u.actif),
      score:     u.upcycling_score || 0,
      date:      u.date_inscription || new Date().toISOString().slice(0, 10),
      telephone: u.telephone || '',
      adresse:   u.adresse || '',
    }));
    filtered = [...users];
    renderTable();
  } catch (err) {
    console.warn('API indisponible, utilisation des données mockées', err);
    users    = [...MOCK_USERS];
    filtered = [...users];
    renderTable();
  }
}

function renderTable() {
  const tbody = document.getElementById('usersBody');
  const start = (page - 1) * perPage;
  const slice = filtered.slice(start, start + perPage);

  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <i class="fa-solid fa-users-slash" style="font-size:32px;color:var(--neutral-300)" aria-hidden="true"></i>
      <p>${t('users_empty')}</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map(u => `
    <tr>
      <td style="color:var(--neutral-400);font-size:12px">#${u.id}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="user-avatar-sm">${getInitials(u.nom, u.prenom)}</div>
          <div>
            <div class="td-primary">${escAdmin(u.prenom ? u.prenom + ' ' + u.nom : u.nom)}</div>
            <div style="font-size:11px;color:var(--neutral-400)">${escAdmin(u.email)}</div>
          </div>
        </div>
      </td>
      <td><span class="badge ${ROLE_COLORS[u.role] || 'badge-gray'}">${roleLabel(u.role)}</span></td>
      <td><span class="badge ${STATUS_COLORS[u.statut] || 'badge-gray'}">${statusLabel(u.statut)}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-weight:600;color:var(--uc-green);font-size:13px">${u.score}</div>
          <div class="progress-bar" style="width:60px">
            <div class="progress-fill" style="width:${Math.min(u.score / 600 * 100, 100).toFixed(0)}%"></div>
          </div>
        </div>
      </td>
      <td style="color:var(--neutral-500);font-size:12px">${new Date(u.date).toLocaleDateString(locale)}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-ghost btn-icon" title="${t('btn_editer')}" onclick="editUser(${u.id})">
            <i class="fa-solid fa-pen" aria-hidden="true"></i>
          </button>
          <button class="btn btn-ghost btn-icon" title="${u.statut === 'actif' ? t('users_tooltip_suspend') : t('users_tooltip_reactivate')}" onclick="toggleStatus(${u.id})" style="color:var(--warning)">
            <i class="fa-solid ${u.statut === 'actif' ? 'fa-ban' : 'fa-check'}" aria-hidden="true"></i>
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
  const info  = document.getElementById('pageInfo');
  const start = (page - 1) * perPage + 1;
  const end   = Math.min(page * perPage, filtered.length);
  if (info) info.textContent = `${start}-${end} ${t('pagination_sur')} ${filtered.length}`;

  pag.querySelectorAll('.page-btn').forEach(b => b.remove());

  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.textContent = '‹';
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
  nextBtn.textContent = '›';
  nextBtn.disabled = page === total || total === 0;
  nextBtn.addEventListener('click', () => { page++; renderTable(); });
  pag.appendChild(nextBtn);
}

function applyFilters() {
  const q      = document.getElementById('searchInput').value.toLowerCase();
  const role   = document.getElementById('roleFilter').value;
  const status = document.getElementById('statusFilter').value;
  filtered = users.filter(u =>
    ((u.nom || '').toLowerCase().includes(q) || (u.prenom || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)) &&
    (role   === '' || u.role   === role) &&
    (status === '' || u.statut === status)
  );
  page = 1;
  renderTable();
}

function openModal()  { document.getElementById('userModal').classList.add('open'); }
function closeModal() { document.getElementById('userModal').classList.remove('open'); }

function escAdmin(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('users');
  fetchUsers();

  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('roleFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);

  document.getElementById('btnAdd').addEventListener('click', () => {
    document.getElementById('userId').value = '';
    document.getElementById('userForm').reset();
    document.getElementById('passGroup').style.display = 'block';
    document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-user-plus" aria-hidden="true"></i> ${t('modal_add_user')}`;
    openModal();
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('userModal').addEventListener('click', e => {
    if (e.target === document.getElementById('userModal')) closeModal();
  });

  document.getElementById('userForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id  = document.getElementById('userId').value;
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = t('btn_saving');

    const data = {
      nom:       document.getElementById('nom').value,
      email:     document.getElementById('email').value,
      role:      document.getElementById('role').value,
      statut:    document.getElementById('statut').value,
      telephone: document.getElementById('telephone').value,
      adresse:   document.getElementById('adresse').value,
    };
    const pwd = document.getElementById('password')?.value;
    if (pwd) data.password = pwd;

    try {
      const res = await apiFetch(id ? `/admin/users/${id}` : '/register', {
        method: id ? 'PUT' : 'POST',
        body:   JSON.stringify(data),
      });
      if (res && res.ok) {
        showToast(id ? t('users_toast_updated') : t('users_toast_created'), 'success');
        closeModal();
        fetchUsers();
      } else {
        const err = res ? await res.json() : {};
        showToast(err.error || t('users_toast_save_error'), 'error');
      }
    } catch {
      // Fallback local si API hors ligne
      if (id) {
        const idx = users.findIndex(u => u.id == id);
        if (idx !== -1) users[idx] = { ...users[idx], ...data };
      } else {
        users.push({ id: Date.now(), ...data, score: 0, date: new Date().toISOString().slice(0,10) });
      }
      filtered = [...users];
      showToast(id ? t('toast_local_updated') : t('toast_local_created'), 'warning');
      closeModal();
      renderTable();
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i> ${t('btn_save')}`;
    }
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const rows = [['ID','Prénom','Nom','Email','Rôle','Statut','Date']];
    users.forEach(u => rows.push([u.id, u.prenom, u.nom, u.email, u.role, u.statut, u.date]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a   = document.createElement('a');
    a.href    = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    a.download = 'utilisateurs.csv';
    a.click();
    showToast(t('users_toast_export'), 'success');
  });
});

window.editUser = id => {
  const u = users.find(u => u.id === id);
  if (!u) return;
  document.getElementById('userId').value    = u.id;
  document.getElementById('nom').value       = u.nom;
  document.getElementById('email').value     = u.email;
  document.getElementById('role').value      = u.role;
  document.getElementById('statut').value    = u.statut;
  document.getElementById('telephone').value = u.telephone || '';
  document.getElementById('adresse').value   = u.adresse || '';
  document.getElementById('passGroup').style.display = 'none';
  document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen" aria-hidden="true"></i> ${t('modal_edit_prefix')} ${escAdmin(u.prenom + ' ' + u.nom)}`;
  openModal();
};

window.toggleStatus = async id => {
  const u = users.find(u => u.id === id);
  if (!u) return;
  const nouvelEtat = u.statut === 'actif' ? false : true;
  try {
    const res = await apiFetch(`/admin/users/${id}/activate`, {
      method: 'PUT',
      body:   JSON.stringify({ user_id: id, actif: nouvelEtat }),
    });
    if (res && res.ok) {
      u.statut  = nouvelEtat ? 'actif' : 'suspendu';
      filtered  = filtered.map(f => f.id === id ? u : f);
      showToast(u.statut === 'actif' ? t('users_toast_reactivated') : t('users_toast_suspended'), u.statut === 'actif' ? 'success' : 'warning');
      renderTable();
    }
  } catch {
    // Mise à jour locale si API hors ligne
    u.statut = nouvelEtat ? 'actif' : 'suspendu';
    filtered  = filtered.map(f => f.id === id ? u : f);
    showToast(`${u.statut === 'actif' ? t('users_toast_reactivated') : t('users_toast_suspended')} ${t('toast_mode_local')}`, 'warning');
    renderTable();
  }
};
