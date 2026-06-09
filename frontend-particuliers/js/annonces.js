// annonces particuliers


const PAGE_SIZE = 9;
let filtreActif = { recherche: '', type: '', categorie: '', tri: 'recent' };
let pageActuelle = 1;
let annoncesData = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('annonces');

  const rechEl = document.getElementById('f-recherche');
  const typeEl = document.getElementById('f-type');
  const catEl  = document.getElementById('f-categorie');
  const triEl  = document.getElementById('f-tri');

  rechEl?.addEventListener('input',  e => { filtreActif.recherche = e.target.value.toLowerCase(); pageActuelle = 1; renderAnnonces(); });
  typeEl?.addEventListener('change', e => { filtreActif.type = e.target.value; pageActuelle = 1; renderAnnonces(); });
  catEl?.addEventListener('change',  e => { filtreActif.categorie = e.target.value; pageActuelle = 1; renderAnnonces(); });
  triEl?.addEventListener('change',  e => { filtreActif.tri = e.target.value; renderAnnonces(); });

  document.getElementById('btn-nouvelle-annonce')?.addEventListener('click', () => {
    document.getElementById('modal-annonce').classList.add('open');
  });
  document.getElementById('modal-annonce-close')?.addEventListener('click', fermerModal);
  document.getElementById('modal-annonce')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-annonce')) fermerModal();
  });
  document.getElementById('form-annonce')?.addEventListener('submit', soumettreAnnonce);

  await chargerCategories();
  await chargerAnnonces();
});

async function chargerCategories() {
  try {
    const res = await apiFetch(`/categories?lang=${_lang}`);
    if (!res?.ok) return;
    const cats = await res.json();
    if (!Array.isArray(cats)) return;
    const catFiltreEl = document.getElementById('f-categorie');
    const catFormulaireEl = document.getElementById('a-categorie');
    if (catFiltreEl) {
      catFiltreEl.innerHTML = `<option value="">${catFiltreEl.options[0]?.text || 'Toutes catégories'}</option>`;
      cats.forEach(c => catFiltreEl.insertAdjacentHTML('beforeend', `<option value="${esc(c.nom)}">${esc(c.nom)}</option>`));
    }
    if (catFormulaireEl) {
      catFormulaireEl.innerHTML = '';
      cats.forEach(c => catFormulaireEl.insertAdjacentHTML('beforeend', `<option value="${esc(c.nom)}">${esc(c.nom)}</option>`));
    }
  } catch {}
}

async function chargerAnnonces() {
  try {
    const res = await apiFetch(`/annonces?lang=${_lang}`);
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data)) annoncesData = data;
    }
  } catch {}
  renderAnnonces();
}

function getAnnoncesFiltered() {
  let list = [...annoncesData];
  if (filtreActif.recherche)  list = list.filter(a => a.titre.toLowerCase().includes(filtreActif.recherche) || (a.description || '').toLowerCase().includes(filtreActif.recherche));
  if (filtreActif.type)       list = list.filter(a => a.type_annonce === filtreActif.type);
  if (filtreActif.categorie)  list = list.filter(a => a.categorie === filtreActif.categorie);
  if (filtreActif.tri === 'prix_asc')  list.sort((a, b) => a.prix - b.prix);
  if (filtreActif.tri === 'prix_desc') list.sort((a, b) => b.prix - a.prix);
  return list;
}

function renderAnnonces() {
  const list = getAnnoncesFiltered();
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pageActuelle > pages) pageActuelle = pages;

  const slice = list.slice((pageActuelle - 1) * PAGE_SIZE, pageActuelle * PAGE_SIZE);
  const container = document.getElementById('annonces-container');
  if (!container) return;

  const totalEl = document.getElementById('total-annonces');
  if (totalEl) totalEl.textContent = `${total} annonce${total !== 1 ? 's' : ''}`;

  if (!slice.length) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-box-open" aria-hidden="true"></i><p>Aucune annonce ne correspond à votre recherche</p></div>`;
    document.getElementById('pagination-wrap').innerHTML = '';
    return;
  }

  container.innerHTML = slice.map((a, i) => {
    const typeBadge = a.type_annonce === 'don'
      ? `<span class="badge badge-don"><i class="fa-solid fa-hand-holding-heart" aria-hidden="true"></i> ${t('annonce_type_don')}</span>`
      : `<span class="badge badge-vente"><i class="fa-solid fa-tag" aria-hidden="true"></i> ${t('annonce_type_vente')}</span>`;
    const prix = a.prix > 0 ? `${a.prix.toFixed(2)} €` : t('annonce_gratuit');
    return `
      <div class="annonce-card animate-in" style="animation-delay:${i * .05}s" onclick="ouvrirDetail(${a.id})" tabindex="0">
        <div class="annonce-header">
          ${typeBadge}
          <span style="font-size:11px;color:var(--text-muted)">${esc(a.localisation)}</span>
        </div>
        <div class="annonce-titre">${esc(a.titre)}</div>
        <div class="annonce-desc">${esc(a.description || '')}</div>
        <div class="annonce-footer">
          <span class="annonce-prix">${prix}</span>
          <span class="annonce-meta"><i class="fa-solid fa-user" aria-hidden="true"></i> ${esc(a.auteur || '')}</span>
        </div>
      </div>`;
  }).join('');

  renderPagination(pages);
}

function renderPagination(pages) {
  const wrap = document.getElementById('pagination-wrap');
  if (!wrap || pages <= 1) { if(wrap) wrap.innerHTML = ''; return; }
  let html = `<button class="page-btn" onclick="changerPage(${pageActuelle - 1})" ${pageActuelle === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>`;
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn ${i === pageActuelle ? 'active' : ''}" onclick="changerPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" onclick="changerPage(${pageActuelle + 1})" ${pageActuelle === pages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>`;
  wrap.innerHTML = html;
}

window.changerPage = p => { pageActuelle = p; renderAnnonces(); window.scrollTo(0, 0); };

window.ouvrirDetail = (id) => {
  const a = annoncesData.find(x => x.id === id);
  if (!a) return;
  const modal = document.getElementById('modal-detail');
  if (!modal) return;
  document.getElementById('detail-titre').textContent = a.titre;
  const prix = a.prix > 0 ? `${a.prix.toFixed(2)} €` : t('annonce_gratuit');
  document.getElementById('detail-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Type</span><br>
        ${a.type_annonce === 'don' ? `<span class="badge badge-don"><i class="fa-solid fa-hand-holding-heart"></i> ${t('annonce_type_don')}</span>` : `<span class="badge badge-vente"><i class="fa-solid fa-tag"></i> ${t('annonce_type_vente')}</span>`}
      </div>
      <div><span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Prix</span><br>
        <span style="font-family:Poppins,sans-serif;font-size:18px;font-weight:800;color:var(--teal-700)">${prix}</span>
      </div>
      <div><span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Localisation</span><br>
        <span style="font-size:13.5px"><i class="fa-solid fa-location-dot" style="color:var(--teal-500)"></i> ${esc(a.localisation)}</span>
      </div>
      <div><span style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Proposé par</span><br>
        <span style="font-size:13.5px"><i class="fa-solid fa-user" style="color:var(--teal-500)"></i> ${esc(a.auteur || '—')}</span>
      </div>
    </div>
    <p style="font-size:13.5px;line-height:1.7;color:var(--text-soft);margin-bottom:16px">${esc(a.description || '')}</p>
    <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="contacterAuteur(${a.id})">
      <i class="fa-solid fa-envelope" aria-hidden="true"></i> Contacter le déposant
    </button>`;
  modal.classList.add('open');
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-detail')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-detail')) document.getElementById('modal-detail').classList.remove('open');
  });
  document.getElementById('modal-detail-close')?.addEventListener('click', () => {
    document.getElementById('modal-detail').classList.remove('open');
  });
});

window.contacterAuteur = (id) => {
  document.getElementById('modal-detail').classList.remove('open');
  showToast('Message envoyé au déposant', 'success');
};

function fermerModal() { document.getElementById('modal-annonce').classList.remove('open'); }

async function soumettreAnnonce(e) {
  e.preventDefault();
  const payload = {
    titre:       document.getElementById('a-titre').value.trim(),
    description: document.getElementById('a-desc').value.trim(),
    type:        document.getElementById('a-type').value,
    prix:        parseFloat(document.getElementById('a-prix').value) || 0,
    categorie:   document.getElementById('a-categorie').value,
  };
  if (!payload.titre) { showToast('Le titre est obligatoire', 'warning'); return; }
  try {
    const res = await apiFetch('/annonces', { method: 'POST', body: JSON.stringify(payload) });
    if (res?.ok) { showToast('Annonce publiée avec succès', 'success'); }
    else { throw new Error(); }
  } catch {
    annoncesData.unshift({ id: Date.now(), ...payload, date: new Date().toISOString().split('T')[0], statut: 'en_attente', auteur: 'Vous', localisation: 'À renseigner', kg: 0 });
    showToast('Annonce soumise à validation', 'success');
  }
  fermerModal();
  renderAnnonces();
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
