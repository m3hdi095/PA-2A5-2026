// annonces particuliers


const PAGE_SIZE = 9;
let filtreActif = { recherche: '', type: '', categorie: '', tri: 'recent' };
let pageActuelle = 1;
let annoncesData = [];
let viewMode = 'all'; // 'all' | 'mine'

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

  document.getElementById('btn-mes-annonces')?.addEventListener('click', basculerMesAnnonces);
  document.getElementById('btn-messages')?.addEventListener('click', basculerMessages);
  document.getElementById('conv-form-msg')?.addEventListener('submit', envoyerMsgConv);

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

async function basculerMesAnnonces() {
  const btn = document.getElementById('btn-mes-annonces');
  if (viewMode === 'mine') {
    setViewMode('all');
    if (btn) { btn.classList.remove('btn-primary'); btn.classList.add('btn-outline'); btn.innerHTML = '<i class="fa-solid fa-list" aria-hidden="true"></i> Mes annonces'; }
    renderAnnonces();
    return;
  }
  setViewMode('mine');
  if (btn) { btn.classList.remove('btn-outline'); btn.classList.add('btn-primary'); btn.innerHTML = '<i class="fa-solid fa-list" aria-hidden="true"></i> Toutes les annonces'; }
  await chargerMesAnnonces();
}

async function chargerMesAnnonces() {
  const container = document.getElementById('annonces-container');
  const totalEl = document.getElementById('total-annonces');
  if (container) container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:32px;grid-column:1/-1">Chargement...</p>`;
  document.getElementById('pagination-wrap').innerHTML = '';

  let mes = [];
  try {
    const res = await apiFetch('/annonces/mes-annonces');
    if (res?.ok) { const d = await res.json(); if (Array.isArray(d)) mes = d; }
  } catch {}

  if (totalEl) totalEl.textContent = `${mes.length} annonce${mes.length !== 1 ? 's' : ''}`;

  if (!mes.length) {
    if (container) container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fa-solid fa-bullhorn"></i><p>Vous n'avez pas encore publié d'annonce.</p></div>`;
    return;
  }

  const now = new Date();
  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  const statutLabel = { en_attente: 'En attente', validee: 'Active', refusee: 'Refusée', desactivee: 'Désactivée', brouillon: 'Brouillon' };
  const statutColor = { en_attente: 'var(--warning,#f59e0b)', validee: 'var(--success,#10b981)', refusee: 'var(--danger,#ef4444)', desactivee: 'var(--text-muted)', brouillon: 'var(--text-muted)' };

  if (container) container.innerHTML = mes.map((a, i) => {
    const typeBadge = a.type_annonce === 'don'
      ? `<span class="badge badge-don"><i class="fa-solid fa-hand-holding-heart" aria-hidden="true"></i> ${t('annonce_type_don')}</span>`
      : `<span class="badge badge-vente"><i class="fa-solid fa-tag" aria-hidden="true"></i> ${t('annonce_type_vente')}</span>`;
    const prix = a.prix > 0 ? `${a.prix.toFixed(2)} €` : t('annonce_gratuit');

    const statutHtml = `<span style="font-size:11px;font-weight:600;color:${statutColor[a.statut] || 'var(--text-muted)'}">● ${statutLabel[a.statut] || a.statut}</span>`;

    let expirationHtml = '';
    let renouvelerBtn = '';
    if (a.statut === 'validee' && a.date_expiration) {
      const exp = new Date(a.date_expiration);
      const diffDays = Math.ceil((exp - now) / 86400000);
      if (diffDays < 0) {
        expirationHtml = `<span style="font-size:11px;color:var(--danger,#ef4444);font-weight:600"><i class="fa-solid fa-clock-rotate-left"></i> Expirée</span>`;
        renouvelerBtn = `<button class="btn btn-primary btn-sm" onclick="renouvelerAnnonce(${a.id})" style="padding:4px 12px;font-size:12px">Renouveler</button>`;
      } else if (diffDays <= 7) {
        expirationHtml = `<span style="font-size:11px;color:var(--warning,#f59e0b);font-weight:600"><i class="fa-solid fa-triangle-exclamation"></i> Expire dans ${diffDays}j</span>`;
        renouvelerBtn = `<button class="btn btn-outline btn-sm" onclick="renouvelerAnnonce(${a.id})" style="padding:4px 12px;font-size:12px">Renouveler</button>`;
      } else {
        expirationHtml = `<span style="font-size:11px;color:var(--text-muted)">Expire le ${exp.toLocaleDateString(locale, { day:'2-digit', month:'short', year:'numeric' })}</span>`;
      }
    }

    return `
      <div class="annonce-card animate-in" style="animation-delay:${i * .05}s">
        <div class="annonce-header">
          ${typeBadge}
          ${statutHtml}
        </div>
        <div class="annonce-titre">${esc(a.titre)}</div>
        <div class="annonce-desc">${esc(a.description || '')}</div>
        <div class="annonce-footer" style="flex-wrap:wrap;gap:8px">
          <span class="annonce-prix">${prix}</span>
          ${expirationHtml}
          ${renouvelerBtn}
        </div>
      </div>`;
  }).join('');
}

window.renouvelerAnnonce = async (id) => {
  try {
    const res = await apiFetch(`/annonces/${id}/renouveler`, { method: 'POST' });
    if (res?.ok) {
      showToast('Annonce renouvelée pour 30 jours', 'success');
      await chargerMesAnnonces();
    } else {
      const d = res ? await res.json().catch(() => ({})) : {};
      showToast(d.error || 'Erreur lors du renouvellement', 'error');
    }
  } catch { showToast('Service indisponible.', 'error'); }
};

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

window.ouvrirDetail = async (id) => {
  const a = annoncesData.find(x => x.id === id);
  if (!a) return;
  const modal = document.getElementById('modal-detail');
  if (!modal) return;
  document.getElementById('detail-titre').textContent = a.titre;
  const prix = a.prix > 0 ? `${a.prix.toFixed(2)} €` : t('annonce_gratuit');


  // charger les photos
  let photosHtml = '';
  try {
    const pr = await apiFetch(`/annonces/${id}/photos`);
    if (pr?.ok) {
      const photos = await pr.json();
      if (Array.isArray(photos) && photos.length) {
        const imgs = photos.map(u =>
          `<img src="${serverBase}${u}" style="width:100%;height:180px;object-fit:cover;border-radius:10px">`
        ).join('');
        photosHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:16px">${imgs}</div>`;
      }
    }
  } catch {}

  document.getElementById('detail-body').innerHTML = `
    ${photosHtml}
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
        <span style="font-size:13.5px"><i class="fa-solid fa-user" style="color:var(--teal-500)"></i> ${esc(a.auteur || '-')}</span>
      </div>
    </div>
    <p style="font-size:13.5px;line-height:1.7;color:var(--text-soft);margin-bottom:16px">${esc(a.description || '')}</p>
    <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="contacterAuteur(${a.id})">
      <i class="fa-solid fa-envelope" aria-hidden="true"></i> Contacter le déposant
    </button>`;
  modal.classList.add('open');
};

// prévisualisation photos avant envoi
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('a-photos')?.addEventListener('change', function() {
    const preview = document.getElementById('a-photos-preview');
    preview.innerHTML = '';
    const files = Array.from(this.files).slice(0, 10);
    files.forEach(f => {
      if (!f.type.startsWith('image/')) return;
      const url = URL.createObjectURL(f);
      preview.insertAdjacentHTML('beforeend',
        `<img src="${url}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:2px solid var(--border)">`);
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-detail')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-detail')) document.getElementById('modal-detail').classList.remove('open');
  });
  document.getElementById('modal-detail-close')?.addEventListener('click', () => {
    document.getElementById('modal-detail').classList.remove('open');
  });
});

window.contacterAuteur = async (id) => {
  document.getElementById('modal-detail').classList.remove('open');
  // envoyer un premier message vide ne fait rien, on ouvre juste la section messages sur cette annonce
  await basculerMessages(id);
};

// ────────────────────────────────────────────────────────────
// Section messagerie (deux colonnes style inbox)
// ────────────────────────────────────────────────────────────

let _convAnnonceID = null;

async function basculerMessages(preselectedId) {
  const estDejaMsgs = viewMode === 'messages';
  setViewMode('messages');

  const btnMsg = document.getElementById('btn-messages');
  if (btnMsg) { btnMsg.classList.remove('btn-outline'); btnMsg.classList.add('btn-primary'); }
  document.getElementById('btn-mes-annonces')?.classList.remove('btn-primary');
  document.getElementById('btn-mes-annonces')?.classList.add('btn-outline');

  await chargerConversations();

  if (preselectedId) {
    await ouvrirThreadConv(preselectedId);
  } else if (!estDejaMsgs) {
    // reset le panel droit
    const header = document.getElementById('conv-thread-header');
    if (header) header.innerHTML = '<span style="color:var(--text-muted);font-weight:400;font-size:12px">Sélectionnez une conversation</span>';
    const thread = document.getElementById('conv-thread');
    if (thread) thread.innerHTML = '';
    const inputWrap = document.getElementById('conv-input-wrap');
    if (inputWrap) inputWrap.style.display = 'none';
    _convAnnonceID = null;
  }
}

function setViewMode(mode) {
  viewMode = mode;
  const sections = {
    annonces: [document.getElementById('annonces-container'), document.getElementById('pagination-wrap'), document.querySelector('.card.animate-in')],
    mine:     [document.getElementById('annonces-container'), document.getElementById('pagination-wrap')],
    messages: [],
  };
  const sectionMsg = document.getElementById('section-messages');

  if (mode === 'messages') {
    document.getElementById('annonces-container').style.display = 'none';
    document.getElementById('pagination-wrap').style.display = 'none';
    const filtresCard = document.querySelector('.card.animate-in');
    if (filtresCard) filtresCard.style.display = 'none';
    if (sectionMsg) sectionMsg.style.display = 'block';
  } else {
    document.getElementById('annonces-container').style.display = '';
    document.getElementById('pagination-wrap').style.display = '';
    const filtresCard = document.querySelector('.card.animate-in');
    if (filtresCard) filtresCard.style.display = '';
    if (sectionMsg) sectionMsg.style.display = 'none';
    const btnMsg = document.getElementById('btn-messages');
    if (btnMsg) { btnMsg.classList.add('btn-outline'); btnMsg.classList.remove('btn-primary'); }
  }
}

async function chargerConversations() {
  const convItems = document.getElementById('conv-items');
  if (!convItems) return;
  convItems.innerHTML = `<p style="padding:20px;color:var(--text-muted);text-align:center;font-size:12px">Chargement...</p>`;

  let convs = [];
  try {
    const res = await apiFetch('/annonces/mes-conversations');
    if (res?.ok) { const d = await res.json(); if (Array.isArray(d)) convs = d; }
  } catch {}

  if (!convs.length) {
    convItems.innerHTML = `<div style="padding:32px 16px;text-align:center;color:var(--text-muted)"><i class="fa-regular fa-comment-dots" style="font-size:28px;margin-bottom:10px;display:block"></i><span style="font-size:12px">Aucune conversation</span></div>`;
    return;
  }

  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  convItems.innerHTML = convs.map(c => {
    const date = c.date_dernier ? new Date(c.date_dernier).toLocaleDateString(locale, { day:'2-digit', month:'short' }) : '';
    const nonLuBadge = c.nb_non_lus > 0 ? `<span style="background:var(--teal-500);color:white;border-radius:99px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:auto;flex-shrink:0">${c.nb_non_lus}</span>` : '';
    const isActive = _convAnnonceID === c.annonce_id ? 'background:var(--teal-25);border-left:3px solid var(--teal-500);' : 'border-left:3px solid transparent;';
    return `
      <div onclick="ouvrirThreadConv(${c.annonce_id})"
           id="conv-item-${c.annonce_id}"
           style="padding:12px 14px;cursor:pointer;border-bottom:1px solid var(--border);${isActive}transition:background .15s"
           onmouseenter="this.style.background='var(--teal-25)'" onmouseleave="this.style.background='${_convAnnonceID === c.annonce_id ? 'var(--teal-25)' : ''}'">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <span style="font-weight:600;font-size:12.5px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.annonce_titre)}</span>
          ${nonLuBadge}
        </div>
        <div style="font-size:11.5px;color:var(--teal-600);margin-bottom:2px;font-weight:500">${esc(c.interloc_nom?.trim() || '-')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px">${esc(c.dernier_msg || '')}</span>
          <span style="font-size:10px;color:var(--text-muted);flex-shrink:0;margin-left:6px">${date}</span>
        </div>
      </div>`;
  }).join('');
}

window.ouvrirThreadConv = async (annonceId) => {
  _convAnnonceID = annonceId;

  // mettre en évidence la conv sélectionnée
  document.querySelectorAll('[id^="conv-item-"]').forEach(el => {
    el.style.background = '';
    el.style.borderLeft = '3px solid transparent';
  });
  const activeEl = document.getElementById(`conv-item-${annonceId}`);
  if (activeEl) { activeEl.style.background = 'var(--teal-25)'; activeEl.style.borderLeft = '3px solid var(--teal-500)'; }

  const header = document.getElementById('conv-thread-header');
  const thread = document.getElementById('conv-thread');
  const inputWrap = document.getElementById('conv-input-wrap');

  if (thread) thread.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:40px;font-size:12px">Chargement...</p>`;

  let annonceTitre = `Annonce #${annonceId}`;
  let interlocNom = '';
  try {
    const convItems = document.getElementById('conv-items');
    const itemEl = document.getElementById(`conv-item-${annonceId}`);
    if (itemEl) {
      const spans = itemEl.querySelectorAll('span');
      if (spans[0]) annonceTitre = spans[0].textContent;
      if (spans[1]) interlocNom = spans[1].textContent;
    }
  } catch {}

  if (header) header.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:2px">
      <span style="font-weight:700;font-size:13px;color:var(--text)">${esc(annonceTitre)}</span>
      ${interlocNom ? `<span style="font-size:11px;color:var(--text-muted)">avec ${esc(interlocNom)}</span>` : ''}
    </div>`;

  try {
    const res = await apiFetch(`/annonces/${annonceId}/messages`);
    if (res?.ok) {
      const msgs = await res.json();
      renderThreadConv(Array.isArray(msgs) ? msgs : []);
      if (inputWrap) inputWrap.style.display = 'block';
      // rafraîchir la liste pour effacer les badges non-lus
      await chargerConversations();
    } else {
      if (thread) thread.innerHTML = `<p style="color:var(--danger-text);text-align:center;padding:40px;font-size:12px">Impossible de charger la conversation.</p>`;
    }
  } catch {
    if (thread) thread.innerHTML = `<p style="color:var(--danger-text);text-align:center;padding:40px;font-size:12px">Erreur réseau.</p>`;
  }
};

function renderThreadConv(msgs) {
  const thread = document.getElementById('conv-thread');
  if (!thread) return;
  if (!msgs.length) {
    thread.innerHTML = `<div style="text-align:center;padding:48px 16px;color:var(--text-muted)"><i class="fa-regular fa-comment-dots" style="font-size:32px;margin-bottom:12px;display:block"></i><span style="font-size:12px">Aucun message encore. Envoyez le premier !</span></div>`;
    return;
  }
  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  thread.innerHTML = msgs.map(m => {
    const date = m.date_envoi ? new Date(m.date_envoi).toLocaleString(locale, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
    if (m.is_mine) {
      return `
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
          <div style="background:var(--teal-500);color:white;border-radius:18px 18px 4px 18px;padding:9px 14px;max-width:72%;font-size:13px;line-height:1.5;word-break:break-word">${esc(m.contenu)}</div>
          <span style="font-size:10px;color:var(--text-muted);margin-right:4px">${date}</span>
        </div>`;
    }
    return `
      <div style="display:flex;flex-direction:column;align-items:flex-start;gap:2px">
        <span style="font-size:10.5px;font-weight:600;color:var(--teal-600);margin-left:4px">${esc(m.expediteur?.trim() || '-')}</span>
        <div style="background:white;border:1px solid var(--border);border-radius:18px 18px 18px 4px;padding:9px 14px;max-width:72%;font-size:13px;line-height:1.5;word-break:break-word">${esc(m.contenu)}</div>
        <span style="font-size:10px;color:var(--text-muted);margin-left:4px">${date}</span>
      </div>`;
  }).join('');
  thread.scrollTop = thread.scrollHeight;
}

async function envoyerMsgConv(e) {
  e.preventDefault();
  const input = document.getElementById('conv-msg-input');
  const contenu = input?.value.trim();
  if (!contenu || !_convAnnonceID) return;
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    const res = await apiFetch(`/annonces/${_convAnnonceID}/messages`, {
      method: 'POST', body: JSON.stringify({ contenu }),
    });
    if (res?.ok) {
      input.value = '';
      const r2 = await apiFetch(`/annonces/${_convAnnonceID}/messages`);
      if (r2?.ok) renderThreadConv(await r2.json());
    } else {
      const d = res ? await res.json().catch(() => ({})) : {};
      showToast(d.error || 'Erreur', 'error');
    }
  } catch { showToast('Service indisponible.', 'error'); }
  if (btn) btn.disabled = false;
}

function fermerModal() { document.getElementById('modal-annonce').classList.remove('open'); }

async function soumettreAnnonce(e) {
  e.preventDefault();
  const payload = {
    titre:        document.getElementById('a-titre').value.trim(),
    description:  document.getElementById('a-desc').value.trim(),
    type_annonce: document.getElementById('a-type').value,
    prix:         parseFloat(document.getElementById('a-prix').value) || 0,
    categorie:    document.getElementById('a-categorie').value,
    localisation: document.getElementById('a-localisation')?.value.trim() || '',
  };
  if (!payload.titre) { showToast('Le titre est obligatoire', 'warning'); return; }
  if (!payload.localisation) { showToast('La localisation est obligatoire', 'warning'); return; }
  const photosInput = document.getElementById('a-photos');
  if (!photosInput?.files?.length) { showToast('Au moins une photo est requise', 'warning'); return; }
  try {
    const res = await apiFetch('/annonces', { method: 'POST', body: JSON.stringify(payload) });
    if (res?.ok) {
      const annonce = await res.json();
      // upload des photos si présentes
      const photosInput = document.getElementById('a-photos');
      if (photosInput?.files?.length && annonce?.id) {
        const fd = new FormData();
        Array.from(photosInput.files).slice(0, 10).forEach(f => fd.append('photos', f));
        const token = localStorage.getItem('uc_part_token') || localStorage.getItem('uc_pro_token');
        await fetch(`${apiBase}/annonces/${annonce.id}/photos`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
      }
      showToast('Annonce soumise à validation', 'success');
      fermerModal();
      await chargerAnnonces();
      return;
    }
    showToast('Erreur lors de la soumission', 'error');
  } catch {
    showToast('Service indisponible. Réessayez.', 'error');
  }
  fermerModal();
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
