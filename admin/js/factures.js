function escAdmin(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let allFactures = [];
let filtered    = [];
let page        = 1;
const perPage   = 7;

const STAT_COLORS = { payee: 'badge-green', en_attente: 'badge-orange', annulee: 'badge-red' };

function typeLabel(type) {
  const keys = { abonnement: 'factures_type_abo', transaction: 'factures_type_comm', evenement: 'factures_type_form' };
  return t(keys[type] || type);
}

function statusLabel(statut) {
  const keys = { payee: 'factures_statut_paye', en_attente: 'factures_statut_attente', annulee: 'factures_statut_impaye' };
  return t(keys[statut] || statut);
}

function fmt(n) { return Number(n || 0).toFixed(2).replace('.', ',') + ' €'; }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

async function fetchFactures() {
  try {
    const res = await apiFetch('/admin/factures');
    if (!res || !res.ok) throw new Error('API Error');
    const data = await res.json();
    
    allFactures = data.factures || [];
    
    if (data.stats) {
      document.getElementById('stat-total').textContent = fmt(data.stats.total_mois);
      document.getElementById('stat-abo').textContent = fmt(data.stats.abonnements);
      document.getElementById('stat-form').textContent = fmt(data.stats.formations);
      document.getElementById('stat-impayees').textContent = fmt(data.stats.impayees);
      
      const nbEl = document.getElementById('stat-nb-impayees');
      if (nbEl && data.stats.nb_impayees > 0) {
        nbEl.textContent = data.stats.nb_impayees + ' factures';
      } else if (nbEl) {
        nbEl.textContent = '';
      }
    }

    filtered = [...allFactures];
    renderTable();
  } catch (err) {
    console.error("Erreur de chargement de l'API factures:", err);
    allFactures = [];
    filtered = [];
    renderTable();
  }
}

function renderTable() {
  const tbody = document.getElementById('facturesBody');
  if (!tbody) return;

  const start = (page - 1) * perPage;
  const slice = filtered.slice(start, start + perPage);
  const locale = typeof _lang !== 'undefined' && _lang === 'en' ? 'en-GB' : 'fr-FR';

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--neutral-400)">Aucune facture trouvée</td></tr>`;
    return;
  }

  tbody.innerHTML = slice.map(f => {
    const tvaMontant = ((20 * Number(f.ht || 0)) / 100).toFixed(2).replace('.', ',') + ' €';
    
    const pdfButton = `<button class="btn btn-ghost btn-icon" onclick="downloadPdf(${f.id})" title="Télécharger PDF"><i class="fa-solid fa-file-pdf"></i></button>`;

    const dateStr = f.date || '';
    const dateAffichage = dateStr.includes('-') ? new Date(dateStr).toLocaleDateString(locale) : dateStr;

    return `
      <tr>
        <td><span style="font-family:Poppins,sans-serif;font-weight:600;font-size:13px;color:var(--neutral-900)">${escAdmin(f.num)}</span></td>
        <td class="td-primary">${escAdmin(f.client)}</td>
        <td><span class="badge badge-gray">${typeLabel(f.type)}</span></td>
        <td style="color:var(--neutral-600)">${fmt(f.ht)}</td>
        <td style="color:var(--neutral-400)">${tvaMontant}</td>
        <td style="font-weight:700;color:var(--uc-green)">${fmt(f.ttc)}</td>
        <td style="color:var(--neutral-500);font-size:12px">${dateAffichage || '—'}</td>
        <td><span class="badge ${STAT_COLORS[f.statut] || 'badge-gray'}">${statusLabel(f.statut)}</span></td>
        <td><div class="cell-actions">${pdfButton}</div></td>
      </tr>
    `;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filtered.length / perPage);
  const pag   = document.getElementById('pagination');
  const info  = document.getElementById('pageInfo');
  const start = (page - 1) * perPage + 1;
  const end   = Math.min(page * perPage, filtered.length);
  
  if (info && filtered.length) {
    info.textContent = `${start}-${end} sur ${filtered.length}`;
  }

  pag.querySelectorAll('.page-btn').forEach(b => b.remove());

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i === page ? ' active' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => { page = i; renderTable(); });
    pag.appendChild(btn);
  }
}

function applyFilters() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const type = document.getElementById('typeFilter').value;
  const stat = document.getElementById('statusFilter').value;

  filtered = allFactures.filter(f =>
    (esc(f.client).toLowerCase().includes(q) || esc(f.num).toLowerCase().includes(q)) &&
    (type === '' || f.type === type) &&
    (stat === '' || f.statut === stat)
  );
  page = 1;
  renderTable();
}

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('factures');
  fetchFactures();

  document.getElementById('searchInput').addEventListener('input', applyFilters);
  document.getElementById('typeFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);

  document.getElementById('montantHt').addEventListener('input', () => {
    const ht = parseFloat(document.getElementById('montantHt').value) || 0;
    document.getElementById('tvaCalc').value = (ht * 0.20).toFixed(2) + ' €';
    document.getElementById('ttcCalc').value = (ht * 1.20).toFixed(2) + ' €';
  });

  const openModal  = () => document.getElementById('factureModal').classList.add('open');
  const closeModal = () => document.getElementById('factureModal').classList.remove('open');
  document.getElementById('btnAdd').addEventListener('click', openModal);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);

  document.getElementById('factureForm').addEventListener('submit', e => {
    e.preventDefault();
    closeModal();
    showToast('Les factures sont générées automatiquement lors des paiements Stripe.', 'info');
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const rows = [['N°', 'Client', 'Type', 'HT', 'TVA', 'TTC', 'Date', 'Statut']];
    filtered.forEach(f => rows.push([f.num, f.client, f.type, f.ht, (0.2 * f.ht).toFixed(2), f.ttc, f.date, f.statut]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a   = document.createElement('a');
    a.href     = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    a.download = 'factures.csv';
    a.click();
  });
});