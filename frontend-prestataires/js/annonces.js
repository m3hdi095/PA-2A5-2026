// liste, recherche et interaction avec les annonces de matériaux (style LeBonCoin)

const CAT_ICONES_MAP = {
  bois:         'fa-tree',
  textile:      'fa-shirt',
  textiles:     'fa-shirt',
  metal:        'fa-wrench',
  plastique:    'fa-recycle',
  electronique: 'fa-microchip',
  autre:        'fa-box-open',
};

let donneesSource  = [];
let donneesFilrees = [];
let pageCourante = 1;
const parPage = 9;
let favorisIDs = new Set();
let afficherFavorisOnly = false;

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('annonces');
  chargerCategories();
  await chargerFavoris();
  chargerAnnonces();

  document.getElementById('search-input')?.addEventListener('input', appliquerFiltres);
  document.getElementById('type-filter')?.addEventListener('change', appliquerFiltres);
  document.getElementById('cat-filter')?.addEventListener('change', appliquerFiltres);
  document.getElementById('sort-filter')?.addEventListener('change', appliquerFiltres);

  document.getElementById('modal-detail-close')?.addEventListener('click', fermerModalDetail);
  document.getElementById('modal-detail')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-detail')) fermerModalDetail();
  });
  document.getElementById('modal-msg-close')?.addEventListener('click', fermerModalMsg);
  document.getElementById('modal-msg')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-msg')) fermerModalMsg();
  });
  document.getElementById('form-message')?.addEventListener('submit', envoyerMessage);

  // bouton "Mes favoris"
  document.getElementById('btn-favoris')?.addEventListener('click', () => {
    afficherFavorisOnly = !afficherFavorisOnly;
    const btn = document.getElementById('btn-favoris');
    btn.classList.toggle('active', afficherFavorisOnly);
    btn.innerHTML = afficherFavorisOnly
      ? '<i class="fa-solid fa-heart" style="color:#e53e3e"></i> Tous les annonces'
      : '<i class="fa-regular fa-heart"></i> Mes favoris';
    appliquerFiltres();
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

async function chargerFavoris() {
  try {
    const res = await apiFetch('/annonces/favoris');
    if (res?.ok) {
      const data = await res.json();
      favorisIDs = new Set((Array.isArray(data) ? data : []).map(a => a.id));
    }
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
  } catch { donneesSource = []; }
  appliquerFiltres();
}

function appliquerFiltres() {
  const q    = (document.getElementById('search-input')?.value || '').toLowerCase();
  const type = document.getElementById('type-filter')?.value || '';
  const cat  = document.getElementById('cat-filter')?.value  || '';
  const sort = document.getElementById('sort-filter')?.value || 'recent';

  donneesFilrees = donneesSource.filter(a =>
    (!afficherFavorisOnly || favorisIDs.has(a.id)) &&
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
        <p>${afficherFavorisOnly ? 'Aucune annonce en favori' : 'Aucune annonce ne correspond à vos critères'}</p>
        ${afficherFavorisOnly ? '' : '<button class="btn btn-outline" onclick="resetFiltres()">Effacer les filtres</button>'}
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
    const dateAff   = a.date_publication ? new Date(a.date_publication).toLocaleDateString(locale, { day:'2-digit', month:'short' }) : '-';
    const isFavori  = favorisIDs.has(a.id);
    const msgBadge  = a.nb_messages > 0 ? `<span style="font-size:11px;color:var(--text-muted)"><i class="fa-regular fa-comment" aria-hidden="true"></i> ${a.nb_messages}</span>` : '';

    const imgContent = a.photo_principale
      ? `<img src="${serverBase}${a.photo_principale}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid ${icone}\\' aria-hidden=\\'true\\'></i>'">`
      : `<i class="fa-solid ${icone}" aria-hidden="true"></i>`;

    return `
      <div class="annonce-card animate-in" style="animation-delay:${i * 50}ms;position:relative">
        <button class="fav-btn ${isFavori ? 'active' : ''}" onclick="toggleFavori(event,${a.id})" title="${isFavori ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-label="Favori">
          <i class="fa-${isFavori ? 'solid' : 'regular'} fa-heart"></i>
        </button>
        <div class="annonce-card-img" onclick="ouvrirDetail(${a.id})" style="cursor:pointer">
          ${imgContent}
          ${typeBadge}
        </div>
        <div class="annonce-card-body" onclick="ouvrirDetail(${a.id})" style="cursor:pointer">
          <div class="annonce-titre">${escPro(a.titre)}</div>
          <div class="annonce-desc">${escPro(a.description || '')}</div>
          <div class="annonce-meta">
            ${a.localisation ? `<span class="annonce-meta-item"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escPro(a.localisation)}</span>` : ''}
            ${a.auteur ? `<span class="annonce-meta-item"><i class="fa-regular fa-user" aria-hidden="true"></i> ${escPro(a.auteur.trim())}</span>` : ''}
            <span class="annonce-meta-item"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${dateAff}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
            <div class="annonce-prix">${prixAff}</div>
            ${msgBadge}
          </div>
        </div>
        <div class="annonce-card-footer">
          <button class="btn btn-outline btn-sm" onclick="ouvrirDetail(${a.id})" style="flex:1">
            <i class="fa-solid fa-eye" aria-hidden="true"></i> Détail
          </button>
          <button class="btn btn-ghost btn-sm" onclick="ouvrirConversation(${a.id})" style="flex:1;gap:4px" title="Contacter le vendeur">
            <i class="fa-regular fa-envelope" aria-hidden="true"></i> Contacter
          </button>
          <button class="btn btn-primary btn-sm" onclick="reserverAnnonce(${a.id})" style="flex:1">
            <i class="fa-solid fa-hand-holding" aria-hidden="true"></i> Réserver
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
  const prixLabel = annonce.prix === 0
    ? `<span class="badge badge-green">${t('annonce_gratuit')}</span>`
    : `<strong style="color:var(--green-700);font-family:Poppins,sans-serif;font-size:20px;font-weight:800">${annonce.prix} €</strong>`;
  const locale  = _lang === 'en' ? 'en-GB' : 'fr-FR';
  const dateAff = annonce.date_publication ? new Date(annonce.date_publication).toLocaleDateString(locale, { day:'2-digit', month:'short', year:'numeric' }) : '-';
  const isFav   = favorisIDs.has(annonce.id);

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
      <div style="background:var(--green-25,#f0fdf4);border-radius:8px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Proposé par</div>
        <div style="font-weight:600;font-size:13px"><i class="fa-regular fa-user" style="color:var(--green-600)"></i> ${escPro(annonce.auteur?.trim() || '-')}</div>
      </div>
      <div style="background:var(--green-25,#f0fdf4);border-radius:8px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Localisation</div>
        <div style="font-weight:600;font-size:13px"><i class="fa-solid fa-location-dot" style="color:var(--green-600)"></i> ${escPro(annonce.localisation || '-')}</div>
      </div>
      <div style="background:var(--green-25,#f0fdf4);border-radius:8px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Publiée le</div>
        <div style="font-weight:600;font-size:13px">${dateAff}</div>
      </div>
      <div style="background:var(--green-25,#f0fdf4);border-radius:8px;padding:14px;text-align:center">
        ${prixLabel}
      </div>
    </div>
  `;

  const btnFav = document.getElementById('btn-fav-modal');
  if (btnFav) {
    btnFav.innerHTML = isFav
      ? '<i class="fa-solid fa-heart" style="color:#e53e3e"></i> Favori'
      : '<i class="fa-regular fa-heart"></i> Favori';
    btnFav.onclick = () => toggleFavori(null, annonce.id, btnFav);
  }

  document.getElementById('btn-reserver-modal').onclick = () => {
    fermerModalDetail();
    reserverAnnonce(id);
  };
  document.getElementById('btn-contacter-modal').onclick = () => {
    fermerModalDetail();
    ouvrirConversation(id);
  };

  document.getElementById('modal-detail').classList.add('open');
};

window.fermerModalDetail = () => {
  document.getElementById('modal-detail')?.classList.remove('open');
};


window.toggleFavori = async (event, id, btnEl) => {
  if (event) event.stopPropagation();
  try {
    const res = await apiFetch(`/annonces/${id}/favori`, { method: 'POST' });
    if (!res?.ok) return;
    const data = await res.json();
    if (data.favori) {
      favorisIDs.add(id);
      showToast('Ajouté aux favoris', 'success');
    } else {
      favorisIDs.delete(id);
      showToast('Retiré des favoris', 'info');
    }
    // mise à jour du bouton dans la modal si fourni
    if (btnEl) {
      btnEl.innerHTML = data.favori
        ? '<i class="fa-solid fa-heart" style="color:#e53e3e"></i> Favori'
        : '<i class="fa-regular fa-heart"></i> Favori';
    }
    // mise à jour de la card dans la grille
    const card = document.querySelector(`.fav-btn[onclick*="toggleFavori(event,${id})"]`);
    if (card) {
      card.classList.toggle('active', data.favori);
      card.querySelector('i').className = `fa-${data.favori ? 'solid' : 'regular'} fa-heart`;
    }
    if (afficherFavorisOnly) appliquerFiltres();
  } catch {}
};


let _msgAnnonceID = null;

window.ouvrirConversation = async (id) => {
  _msgAnnonceID = id;
  const annonce = donneesSource.find(a => a.id === id);
  const modal = document.getElementById('modal-msg');
  if (!modal) return;

  document.getElementById('msg-annonce-titre').textContent = annonce ? annonce.titre : `Annonce #${id}`;
  document.getElementById('msg-thread').innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px">Chargement...</p>`;
  modal.classList.add('open');

  await chargerMessages(id);
};

async function chargerMessages(id) {
  try {
    const res = await apiFetch(`/annonces/${id}/messages`);
    const msgs = res?.ok ? await res.json() : [];
    renderThread(Array.isArray(msgs) ? msgs : []);
  } catch {
    document.getElementById('msg-thread').innerHTML = `<p style="color:var(--danger-text);text-align:center;padding:20px">Impossible de charger les messages.</p>`;
  }
}

function renderThread(msgs) {
  const thread = document.getElementById('msg-thread');
  if (!msgs.length) {
    thread.innerHTML = `<div style="text-align:center;padding:32px 16px;color:var(--text-muted)"><i class="fa-regular fa-comment-dots" style="font-size:32px;margin-bottom:12px;display:block"></i>Aucun message. Soyez le premier à contacter le vendeur !</div>`;
    return;
  }
  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  thread.innerHTML = msgs.map(m => {
    const date = m.date_envoi ? new Date(m.date_envoi).toLocaleString(locale, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
    return `
      <div class="msg-bubble ${m.is_mine ? 'msg-mine' : 'msg-other'}">
        ${!m.is_mine ? `<div class="msg-author">${escPro(m.expediteur?.trim() || '-')}</div>` : ''}
        <div class="msg-text">${escPro(m.contenu)}</div>
        <div class="msg-date">${date}</div>
      </div>`;
  }).join('');
  thread.scrollTop = thread.scrollHeight;
}

async function envoyerMessage(e) {
  e.preventDefault();
  const input = document.getElementById('msg-input');
  const contenu = input?.value.trim();
  if (!contenu || !_msgAnnonceID) return;

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    const res = await apiFetch(`/annonces/${_msgAnnonceID}/messages`, {
      method: 'POST',
      body: JSON.stringify({ contenu }),
    });
    if (res?.ok) {
      input.value = '';
      await chargerMessages(_msgAnnonceID);
    } else {
      const d = res ? await res.json().catch(() => ({})) : {};
      showToast(d.error || 'Erreur lors de l\'envoi', 'error');
    }
  } catch { showToast('Service indisponible.', 'error'); }

  if (btn) btn.disabled = false;
}

window.fermerModalMsg = () => {
  document.getElementById('modal-msg')?.classList.remove('open');
  _msgAnnonceID = null;
};


window.reserverAnnonce = async (id) => {
  const annonce = donneesSource.find(a => a.id === id);
  if (!annonce) return;
  const label = annonce.type_annonce === 'don' ? 'récupérer ce don' : `acheter "${escPro(annonce.titre)}" pour ${annonce.prix} €`;
  if (!confirm(`Confirmer : ${label} ?`)) return;
  try {
    const res = await apiFetch(`/annonces/${id}/reserver`, { method: 'POST' });
    if (res?.ok) {
      showToast(annonce.type_annonce === 'don' ? 'Don réservé avec succès !' : 'Achat confirmé !', 'success');
      donneesSource = donneesSource.filter(a => a.id !== id);
      appliquerFiltres();
      return;
    }
    const d = res ? await res.json().catch(() => ({})) : {};
    showToast(d.error || 'Réservation impossible', 'error');
  } catch { showToast('Service indisponible.', 'error'); }
};

function escPro(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
