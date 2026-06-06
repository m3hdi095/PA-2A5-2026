// annonces particuliers

const MOCK_ANNONCES_FULL = [
  { id:1,  titre:'Palette bois EUR (lot de 4)',      description:'Palettes en bon état, idéales pour mobilier DIY. Dimensions standard 120x80cm.',                          type:'don',   prix:0,   categorie:'bois',        localisation:'Paris 11e',  date:'2026-04-18', statut:'validee', auteur:'Sophie L.',    kg:80  },
  { id:2,  titre:'Chutes tissu lin naturel (3 kg)',  description:'Chutes de couturière, diverses couleurs et motifs. Parfait pour la couture créative et l\'upcycling.',     type:'don',   prix:0,   categorie:'textile',     localisation:'Paris 14e',  date:'2026-04-17', statut:'validee', auteur:'Atelier Fil',  kg:3   },
  { id:3,  titre:'Profilés aluminium 40x40 (2m)',    description:'Lot de profilés en excellent état, légères égratignures superficielles. Idéal menuiserie légère.',         type:'vente', prix:35,  categorie:'metal',       localisation:'Montreuil',  date:'2026-04-16', statut:'validee', auteur:'Jean-Paul M.', kg:12  },
  { id:4,  titre:'Vêtements enfant hiver (sac)',     description:'Sac de vêtements tailles 86-116, très bon état. Marques courantes, propres et repassés.',                  type:'don',   prix:0,   categorie:'textile',     localisation:'Paris 9e',   date:'2026-04-15', statut:'validee', auteur:'Famille D.',   kg:5   },
  { id:5,  titre:'Cartons d\'emballage (50 unités)', description:'Cartons robustes de récupération, différentes tailles, pliés proprement. Idéals pour déménagement.',      type:'don',   prix:0,   categorie:'autre',       localisation:'Vincennes',  date:'2026-04-14', statut:'validee', auteur:'Marc T.',      kg:15  },
  { id:6,  titre:'Câbles électriques chutes (5m)',   description:'Chutes de câble 2,5mm², couleurs assorties. Provenance rénovation appartement. Coupes propres.',           type:'don',   prix:0,   categorie:'electronique',localisation:'Paris 15e',  date:'2026-04-13', statut:'validee', auteur:'Éric V.',      kg:2   },
  { id:7,  titre:'Planches pin maritime (lot)',      description:'10 planches 20x150cm, épaisseur 18mm, légèrement ternies en surface, saines. Parfait pour étagères.',     type:'vente', prix:45,  categorie:'bois',        localisation:'Bagnolet',   date:'2026-04-12', statut:'validee', auteur:'Bois Recup.',  kg:40  },
  { id:8,  titre:'Laine mérinos naturelle (2kg)',    description:'Laine non traitée, teintes naturelles, lavée proprement. Idéale pour feutrage ou tricot épais.',          type:'vente', prix:22,  categorie:'textile',     localisation:'Paris 18e',  date:'2026-04-11', statut:'validee', auteur:'La Filandière',kg:2   },
  { id:9,  titre:'Tuyaux PVC 110mm (lot)',           description:'Segments de 1 à 3m, sans emboîtements, propres. Utilisables pour jardinage ou rangement vertical.',       type:'don',   prix:0,   categorie:'plastique',   localisation:'Saint-Denis',date:'2026-04-10', statut:'validee', auteur:'Réno Express', kg:18  },
  { id:10, titre:'Vieille machine à coudre Singer',  description:'Modèle années 70, mécanique, révisable. Fonctionne, vendue avec accessoires et notice d\'origine.',      type:'vente', prix:60,  categorie:'electronique',localisation:'Paris 12e',  date:'2026-04-09', statut:'validee', auteur:'Marlène C.',   kg:12  },
  { id:11, titre:'Briques pleines (environ 200)',     description:'Briques récupération de démolition, nettoyées. Idéales pour construction muret, décoration jardin.',      type:'don',   prix:0,   categorie:'autre',       localisation:'Aubervilliers',date:'2026-04-08',statut:'validee', auteur:'Chantier vert',kg:400 },
  { id:12, titre:'Bobines fil coton coloré',          description:'Bobines industrielles déstockage, couleurs vives, fil 100% coton peigné. Environ 3000m par bobine.',     type:'vente', prix:8,   categorie:'textile',     localisation:'Paris 3e',   date:'2026-04-07', statut:'validee', auteur:'Fil Ethique',  kg:1   },
];

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
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        annoncesData = data;
        renderAnnonces();
        return;
      }
    }
  } catch {}
  annoncesData = [...MOCK_ANNONCES_FULL];
  renderAnnonces();
}

function getAnnoncesFiltered() {
  let list = [...annoncesData];
  if (filtreActif.recherche)  list = list.filter(a => a.titre.toLowerCase().includes(filtreActif.recherche) || (a.description || '').toLowerCase().includes(filtreActif.recherche));
  if (filtreActif.type)       list = list.filter(a => a.type === filtreActif.type);
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
    const typeBadge = a.type === 'don'
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
        ${a.type === 'don' ? `<span class="badge badge-don"><i class="fa-solid fa-hand-holding-heart"></i> ${t('annonce_type_don')}</span>` : `<span class="badge badge-vente"><i class="fa-solid fa-tag"></i> ${t('annonce_type_vente')}</span>`}
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
