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
  document.getElementById('modal-msg-close')?.addEventListener('click', () => {
    document.getElementById('modal-msg')?.classList.remove('open');
    _msgAnnonceID = null;
  });
  document.getElementById('modal-msg')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-msg')) {
      document.getElementById('modal-msg').classList.remove('open');
      _msgAnnonceID = null;
    }
  });
  document.getElementById('form-message')?.addEventListener('submit', envoyerMessageParticulier);
});

window.contacterAuteur = (id) => {
  document.getElementById('modal-detail').classList.remove('open');
  ouvrirConversation(id);
};


let _msgAnnonceID = null;

window.ouvrirConversation = async (id) => {
  _msgAnnonceID = id;
  const annonce = annoncesData.find(a => a.id === id);
  const modal = document.getElementById('modal-msg');
  if (!modal) return;
  document.getElementById('msg-annonce-titre').textContent = annonce ? annonce.titre : `Annonce #${id}`;
  document.getElementById('msg-thread').innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px">Chargement…</p>`;
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
    thread.innerHTML = `<div style="text-align:center;padding:32px 16px;color:var(--text-muted)"><i class="fa-regular fa-comment-dots" style="font-size:32px;margin-bottom:12px;display:block"></i>Aucun message pour cette annonce.</div>`;
    return;
  }
  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  thread.innerHTML = msgs.map(m => {
    const date = m.date_envoi ? new Date(m.date_envoi).toLocaleString(locale, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
    return `
      <div class="msg-bubble ${m.is_mine ? 'msg-mine' : 'msg-other'}">
        ${!m.is_mine ? `<div class="msg-author">${esc(m.expediteur?.trim() || '—')}</div>` : ''}
        <div class="msg-text">${esc(m.contenu)}</div>
        <div class="msg-date">${date}</div>
      </div>`;
  }).join('');
  thread.scrollTop = thread.scrollHeight;
}

async function envoyerMessageParticulier(e) {
  e.preventDefault();
  const input = document.getElementById('msg-input');
  const contenu = input?.value.trim();
  if (!contenu || !_msgAnnonceID) return;
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    const res = await apiFetch(`/annonces/${_msgAnnonceID}/messages`, {
      method: 'POST', body: JSON.stringify({ contenu }),
    });
    if (res?.ok) { input.value = ''; await chargerMessages(_msgAnnonceID); }
    else { const d = res ? await res.json().catch(() => ({})) : {}; showToast(d.error || 'Erreur', 'error'); }
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
  };
  if (!payload.titre) { showToast('Le titre est obligatoire', 'warning'); return; }
  try {
    const res = await apiFetch('/annonces', { method: 'POST', body: JSON.stringify(payload) });
    if (res?.ok) {
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
