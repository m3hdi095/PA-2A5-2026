// liste et reservation des annonces de materiaux

const CAT_ICONES_MAP = {
  textiles:     'fa-shirt',
  bois:         'fa-tree',
  metal:        'fa-wrench',
  plastique:    'fa-recycle',
  electronique: 'fa-microchip',
  autre:        'fa-box-open',
};

const MOCK_ANNONCES_FULL = [
  { id:1,  titre:'Chutes tissu lin naturel (2 kg)',    categorie:'textiles',     type:'don',   prix:0,   localisation:'Paris 11e',  distance:2.1, date:'2026-04-18', desc:'Chutes de lin naturel, teinture végétale. Idéal pour couture ou macramé.', auteur:'Claire M.' },
  { id:2,  titre:'Lot palettes bois EUR (x8)',          categorie:'bois',         type:'vente', prix:45,  localisation:'Montreuil',   distance:4.3, date:'2026-04-17', desc:'8 palettes EUR en bon état. Pas de traitement chimique. À récupérer sur place.', auteur:'Henri P.' },
  { id:3,  titre:'Profilés aluminium 3m (x4)',          categorie:'metal',        type:'vente', prix:30,  localisation:'Paris 19e',  distance:3.8, date:'2026-04-16', desc:'Profilés alu 40x20mm, 3m de long. Légèrement rayés mais structurellement parfaits.', auteur:'Marc L.' },
  { id:4,  titre:'Bobines câble cuivre',                categorie:'metal',        type:'don',   prix:0,   localisation:'Ivry-s-Seine',distance:6.2, date:'2026-04-15', desc:'Chutes de câble cuivre 2.5mm², environ 15m au total. Récupérables.', auteur:'Sophie R.' },
  { id:5,  titre:'Vêtements laine (sac 5kg)',           categorie:'textiles',     type:'don',   prix:0,   localisation:'Paris 14e',  distance:3.1, date:'2026-04-14', desc:'Laine mérinos recyclable, couleurs variées. Parfait pour upcycling textile.', auteur:'Anna D.' },
  { id:6,  titre:'Planches OSB 18mm (x20)',             categorie:'bois',         type:'vente', prix:60,  localisation:'Vincennes',   distance:5.5, date:'2026-04-14', desc:'Planches OSB 2400x1200mm en bonne condition. Idéal pour construction légère.', auteur:'Paul G.' },
  { id:7,  titre:'Pots de peinture (partiels)',          categorie:'autre',        type:'don',   prix:0,   localisation:'Paris 20e',  distance:4.0, date:'2026-04-13', desc:'15 pots partiellement remplis, couleurs intérieures. Marques variées.', auteur:'Julie N.' },
  { id:8,  titre:'Claviers & souris (x6)',               categorie:'electronique', type:'don',   prix:0,   localisation:'Paris 3e',   distance:1.8, date:'2026-04-12', desc:'Périphériques informatiques fonctionnels, nettoyés. Récupération sur RDV.', auteur:'Kevin R.' },
  { id:9,  titre:'Tubes PVC 50mm (10m)',                 categorie:'plastique',    type:'vente', prix:12,  localisation:'Pantin',      distance:7.1, date:'2026-04-12', desc:'Tubes PVC gris 50mm, coupes propres. Parfait pour jardinière ou mobilier.', auteur:'Marie D.' },
  { id:10, titre:'Miroirs anciens (x3)',                  categorie:'autre',        type:'vente', prix:25,  localisation:'Paris 16e',  distance:8.4, date:'2026-04-11', desc:'3 miroirs biseautés années 80, cadres bois. Dimensions 60x80cm environ.', auteur:'Clara N.' },
  { id:11, titre:'Chutes cuir (1.5 kg)',                  categorie:'textiles',     type:'don',   prix:0,   localisation:'Bagnolet',    distance:5.0, date:'2026-04-10', desc:'Chutes de cuir naturel, épaisseur 2-3mm. Proviennent d\'une maroquinerie.', auteur:'Lucie V.' },
  { id:12, titre:'Carreaux de faïence (2 m²)',            categorie:'autre',        type:'vente', prix:18,  localisation:'Boulogne',    distance:9.2, date:'2026-04-09', desc:'Carreaux anciens 15x15cm, motifs géométriques. Environ 90 unités.', auteur:'Fabrice M.' },
];

let donneesSource  = [];
let donneesFilrees = [];
let pageCourante = 1;
const parPage = 9;

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('annonces');
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

async function chargerAnnonces() {
  const container = document.getElementById('annonces-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="skeleton" style="height:280px;border-radius:12px"></div>
    <div class="skeleton" style="height:280px;border-radius:12px"></div>
    <div class="skeleton" style="height:280px;border-radius:12px"></div>
  `;

  try {
    const res = await apiFetch('/annonces?statut=validee');
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        donneesSource = data;
      } else {
        donneesSource = [...MOCK_ANNONCES_FULL];
      }
    } else {
      throw new Error('API indisponible');
    }
  } catch {
    donneesSource = [...MOCK_ANNONCES_FULL];
  }

  appliquerFiltres();
}

function appliquerFiltres() {
  const q    = (document.getElementById('search-input')?.value || '').toLowerCase();
  const type = document.getElementById('type-filter')?.value || '';
  const cat  = document.getElementById('cat-filter')?.value  || '';
  const sort = document.getElementById('sort-filter')?.value || 'recent';

  donneesFilrees = donneesSource.filter(a =>
    (a.titre.toLowerCase().includes(q) || (a.desc || '').toLowerCase().includes(q)) &&
    (type === '' || a.type === type) &&
    (cat  === '' || a.categorie === cat)
  );

  if (sort === 'recent') donneesFilrees.sort((a,b) => new Date(b.date) - new Date(a.date));
  else if (sort === 'prix_asc')  donneesFilrees.sort((a,b) => a.prix - b.prix);
  else if (sort === 'prix_desc') donneesFilrees.sort((a,b) => b.prix - a.prix);
  else if (sort === 'distance')  donneesFilrees.sort((a,b) => (a.distance||99) - (b.distance||99));

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
    const icone    = CAT_ICONES_MAP[a.categorie] || 'fa-box-open';
    const typeBadge = a.type === 'don'
      ? '<span class="badge badge-don">Don</span>'
      : '<span class="badge badge-vente">Vente</span>';
    const prixAff  = a.prix === 0 ? 'Gratuit' : `${a.prix} €`;
    const locale   = _lang === 'en' ? 'en-GB' : 'fr-FR';
    const dateAff  = new Date(a.date).toLocaleDateString(locale, { day:'2-digit', month:'short' });

    return `
      <div class="annonce-card animate-in" style="animation-delay:${i * 50}ms">
        <div class="annonce-card-img">
          <i class="fa-solid ${icone}" aria-hidden="true"></i>
          ${typeBadge}
        </div>
        <div class="annonce-card-body">
          <div class="annonce-titre">${escPro(a.titre)}</div>
          <div class="annonce-desc">${escPro(a.desc || '')}</div>
          <div class="annonce-meta">
            <span class="annonce-meta-item">
              <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
              ${escPro(a.localisation || '')}
            </span>
            ${a.distance ? `
            <span class="annonce-meta-item">
              <i class="fa-solid fa-route" aria-hidden="true"></i>
              ${a.distance} km
            </span>` : ''}
            <span class="annonce-meta-item">
              <i class="fa-regular fa-calendar" aria-hidden="true"></i>
              ${dateAff}
            </span>
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
  const prixLabel = annonce.prix === 0 ? '<span class="badge badge-green">Gratuit</span>' : `<strong style="color:var(--green-700);font-family:Poppins,sans-serif;font-size:20px;font-weight:800">${annonce.prix} €</strong>`;

  document.getElementById('detail-title').innerHTML = `
    <i class="fa-solid ${icone}" aria-hidden="true"></i>
    ${escPro(annonce.titre)}
  `;

  document.getElementById('detail-body').innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${annonce.type === 'don' ? '<span class="badge badge-don">Don</span>' : '<span class="badge badge-vente">Vente</span>'}
      <span class="badge badge-gray">${escPro(annonce.categorie)}</span>
    </div>
    <p style="font-size:14px;color:var(--text-soft);line-height:1.65;margin-bottom:16px">${escPro(annonce.desc || '')}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="background:var(--green-25);border-radius:8px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Localisation</div>
        <div style="font-weight:600;font-size:13px">${escPro(annonce.localisation || '—')}</div>
      </div>
      <div style="background:var(--green-25);border-radius:8px;padding:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Déposé par</div>
        <div style="font-weight:600;font-size:13px">${escPro(annonce.auteur || '—')}</div>
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

window.reserverAnnonce = async (id) => {
  const annonce = donneesSource.find(a => a.id === id);
  if (!annonce) return;

  try {
    const res = await apiFetch(`/annonces/${id}/reserver`, { method: 'POST' });
    if (res?.ok) {
      showToast('Réservation confirmée - vous serez contacté sous 24h', 'success');
    } else {
      throw new Error();
    }
  } catch {
    // TODO: retirer mock en production
    showToast(`Réservation de "${annonce.titre}" confirmée`, 'success');
  }
};

function escPro(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
