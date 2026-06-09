// liste et reservation des annonces de materiaux

const CAT_ICONES_MAP = {
  textiles:     'fa-shirt',
  bois:         'fa-tree',
  metal:        'fa-wrench',
  plastique:    'fa-recycle',
  electronique: 'fa-microchip',
  autre:        'fa-box-open',
};


let donneesSource  = [];
let donneesFilrees = [];
let pageCourante = 1;
const parPage = 9;

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('annonces');
  chargerCategories();
  chargerAnnonces();

  document.getElementById('search-input')?.addEventListener('input', appliquerFiltres);
  document.getElementById('type-filter')?.addEventListener('change', appliquerFiltres);
  document.getElementById('cat-filter')?.addEventListener('change', appliquerFiltres);
  document.getElementById('sort-filter')?.addEventListener('change', appliquerFiltres);

  document.getElementById('modal-detail-close')?.addEventListener('click', fermerModalDetail);
  document.getElementById('modal-detail')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-detail')) fermerModalDetail();
  });
});

async function chargerCategories() {
  try {
    const res = await apiFetch(`/categories?lang=${_lang}`);
    if (!res?.ok) return;
    const cats = await res.json();
    if (!Array.isArray(cats)) return;
    const sel = document.getElementById('cat-filter');
    if (!sel) return;
    sel.innerHTML = `<option value="">${sel.options[0]?.text || 'Toutes les catégories'}</option>`;
    cats.forEach(c => sel.insertAdjacentHTML('beforeend', `<option value="${escPro(c.nom)}">${escPro(c.nom)}</option>`));
  } catch {}
}

async function chargerAnnonces() {
  const container = document.getElementById('annonces-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="skeleton" style="height:280px;border-radius:12px"></div>
    <div class="skeleton" style="height:280px;border-radius:12px"></div>
    <div class="skeleton" style="height:280px;border-radius:12px"></div>
  `;

  try {
    const res = await apiFetch(`/annonces?statut=validee&lang=${_lang}`);
    if (res?.ok) {
      const data = await res.json();
      donneesSource = Array.isArray(data) ? data : [];
    }
  } catch {
    donneesSource = [];
  }

  appliquerFiltres();
}

function appliquerFiltres() {
  const q    = (document.getElementById('search-input')?.value || '').toLowerCase();
  const type = document.getElementById('type-filter')?.value || '';
  const cat  = document.getElementById('cat-filter')?.value  || '';
  const sort = document.getElementById('sort-filter')?.value || 'recent';

  donneesFilrees = donneesSource.filter(a =>
    (a.titre.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q)) &&
    (type === '' || a.type_annonce === type) &&
    (cat  === '' || a.categorie === cat)
  );

  if (sort === 'recent') donneesFilrees.sort((a,b) => new Date(b.date_publication) - new Date(a.date_publication));
  else if (sort === 'prix_asc')  donneesFilrees.sort((a,b) => a.prix - b.prix);
  else if (sort === 'prix_desc') donneesFilrees.sort((a,b) => b.prix - a.prix);

  pageCourante = 1;
  renderGrid();
}

function renderGrid() {
  const container = document.getElementById('annonces-grid');
  const compteur  = document.getElementById('annonces-count');
  if (!container) return;

  if (compteur) compteur.textContent = `${donneesFilrees.length} annonce${donneesFilrees.length !== 1 ? 's' : ''}`;

  const debut = (pageCourante - 1) * parPage;
  const page  = donneesFilrees.slice(debut, debut + parPage);

  if (!page.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <i class="fa-solid fa-box-open" aria-hidden="true"></i>
        <p>Aucune annonce ne correspond à vos critères</p>
        <button class="btn btn-outline" onclick="resetFiltres()">Effacer les filtres</button>
      </div>`;
    renderPagination();
    return;
  }

  container.innerHTML = page.map((a, i) => {
    const icone     = CAT_ICONES_MAP[a.categorie] || 'fa-box-open';
    const typeBadge = a.type_annonce === 'don'
      ? `<span class="badge badge-don">${t('annonce_type_don')}</span>`
      : `<span class="badge badge-vente">${t('annonce_type_vente')}</span>`;
    const prixAff   = a.prix === 0 ? t('annonce_gratuit') : `${a.prix} €`;
    const locale    = _lang === 'en' ? 'en-GB' : 'fr-FR';
    const dateRaw   = a.date_publication || '';
    const dateAff   = dateRaw ? new Date(dateRaw).toLocaleDateString(locale, { day:'2-digit', month:'short' }) : '—';

    return `
      <div class="annonce-card animate-in" style="animation-delay:${i * 50}ms">
        <div class="annonce-card-img">
          <i class="fa-solid ${icone}" aria-hidden="true"></i>
          ${typeBadge}
        </div>
        <div class="annonce-card-body">
          <div class="annonce-titre">${escPro(a.titre)}</div>
          <div class="annonce-desc">${escPro(a.description || '')}</div>
          <div class="annonce-meta">
            <span class="annonce-meta-item">
              <i class="fa-regular fa-calendar" aria-hidden="true"></i>
              ${dateAff}
            </span>
            ${a.categorie ? `<span class="annonce-meta-item"><i class="fa-solid fa-tag" aria-hidden="true"></i> ${escPro(a.categorie)}</span>` : ''}
          </div>
          <div class="annonce-prix">${prixAff}</div>
        </div>
        <div class="annonce-card-footer">
          <button class="btn btn-outline btn-sm" onclick="ouvrirDetail(${a.id})" style="flex:1">
            <i class="fa-solid fa-eye" aria-hidden="true"></i>
            Détail
          </button>
          <button class="btn btn-primary btn-sm" onclick="reserverAnnonce(${a.id})" style="flex:1">
            <i class="fa-solid fa-hand-holding" aria-hidden="true"></i>
            Réserver
          </button>
        </div>
      </div>`;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const total  = Math.ceil(donneesFilrees.length / parPage);
  const pag    = document.getElementById('pagination');
  if (!pag) return;

  const info   = document.getElementById('page-info');
  const debut  = (pageCourante - 1) * parPage;
  if (info) info.textContent = `${debut + 1}-${Math.min(pageCourante * parPage, donneesFilrees.length)} sur ${donneesFilrees.length}`;

  pag.querySelectorAll('.page-btn').forEach(b => b.remove());
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i === pageCourante ? ' active' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => { pageCourante = i; renderGrid(); window.scrollTo(0,0); });
    pag.appendChild(btn);
  }
}

window.resetFiltres = () => {
  document.getElementById('search-input').value = '';
  document.getElementById('type-filter').value  = '';
  document.getElementById('cat-filter').value   = '';
  appliquerFiltres();
};

window.ouvrirDetail = (id) => {
  const annonce = donneesSource.find(a => a.id === id);
  if (!annonce) return;

  const icone = CAT_ICONES_MAP[annonce.categorie] || 'fa-box-open';
  const prixLabel = annonce.prix === 0 ? `<span class="badge badge-green">${t('annonce_gratuit')}</span>` : `<strong style="color:var(--green-700);font-family:Poppins,sans-serif;font-size:20px;font-weight:800">${annonce.prix} €</strong>`;
  const locale   = _lang === 'en' ? 'en-GB' : 'fr-FR';
  const dateAff  = annonce.date_publication ? new Date(annonce.date_publication).toLocaleDateString(locale, { day:'2-digit', month:'short', year:'numeric' }) : '—';

  document.getElementById('detail-title').innerHTML = `
    <i class="fa-solid ${icone}" aria-hidden="true"></i>
    ${escPro(annonce.titre)}
  `;

  document.getElementById('detail-body').innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${annonce.type_annonce === 'don' ? `<span class="badge badge-don">${t('annonce_type_don')}</span>` : `<span class="badge badge-vente">${t('annonce_type_vente')}</span>`}
      ${annonce.categorie ? `<span class="badge badge-gray">${escPro(annonce.categorie)}</span>` : ''}
    </div>
    <p style="font-size:14px;color:var(--text-soft);line-height:1.65;margin-bottom:16px">${escPro(annonce.description || '')}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="background:var(--green-25);border-radius:8px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Publiée le</div>
        <div style="font-weight:600;font-size:13px">${dateAff}</div>
      </div>
      <div style="background:var(--green-25);border-radius:8px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Statut</div>
        <div style="font-weight:600;font-size:13px">${escPro(annonce.statut || '—')}</div>
      </div>
    </div>
    <div style="text-align:center;margin-bottom:4px">${prixLabel}</div>
  `;

  document.getElementById('btn-reserver-modal').onclick = () => {
    fermerModalDetail();
    reserverAnnonce(id);
  };

  document.getElementById('modal-detail').classList.add('open');
};

window.fermerModalDetail = () => {
  document.getElementById('modal-detail')?.classList.remove('open');
};

window.reserverAnnonce = (id) => {
  const annonce = donneesSource.find(a => a.id === id);
  if (!annonce) return;
  showToast('La réservation en ligne sera disponible prochainement. Contactez l\'annonceur directement.', 'info');
};

function escPro(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
