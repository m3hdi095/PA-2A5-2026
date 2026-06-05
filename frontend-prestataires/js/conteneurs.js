// Carte des conteneurs + historique des récupérations

const MOCK_CONTENEURS = [
  { id:1, nom:'Box Lafayette',    adresse:'12 rue La Fayette, Paris 10e',  lat:48.8767, lng:2.3508, statut:'actif',        taux:72, capacite:50, derniere:'2026-04-18' },
  { id:2, nom:'Box Bastille',     adresse:'4 pl. de la Bastille, Paris 4e', lat:48.8533, lng:2.3692, statut:'actif',        taux:45, capacite:60, derniere:'2026-04-17' },
  { id:3, nom:'Box Montrouge',    adresse:'8 av. Marx Dormoy, Montrouge',   lat:48.8174, lng:2.3209, statut:'maintenance',  taux:30, capacite:40, derniere:'2026-04-10' },
  { id:4, nom:'Box Montreuil',    adresse:'25 rue de Paris, Montreuil',     lat:48.8631, lng:2.4422, statut:'actif',        taux:88, capacite:70, derniere:'2026-04-19' },
  { id:5, nom:'Box Vincennes',    adresse:'14 rue de Fontenay, Vincennes',  lat:48.8464, lng:2.4370, statut:'actif',        taux:20, capacite:40, derniere:'2026-04-16' },
  { id:6, nom:'Box Pantin',       adresse:'18 av. Jean-Jaurès, Pantin',     lat:48.8976, lng:2.4012, statut:'sature',       taux:97, capacite:55, derniere:'2026-04-19' },
];

const MOCK_HISTORIQUE = [
  { id:1, objet:'Chutes tissu lin (1.2 kg)',   conteneur:'Box Lafayette',  date:'2026-04-15', statut:'recupere' },
  { id:2, objet:'Câble cuivre (3 m)',           conteneur:'Box Bastille',   date:'2026-04-10', statut:'recupere' },
  { id:3, objet:'Profilés alu (2 barres)',      conteneur:'Box Montreuil',  date:'2026-04-08', statut:'recupere' },
  { id:4, objet:'Planches bois (x4)',           conteneur:'Box Lafayette',  date:'2026-03-28', statut:'recupere' },
  { id:5, objet:'Pots peinture (x3)',           conteneur:'Box Vincennes',  date:'2026-03-20', statut:'recupere' },
];

let conteneursData = [];
let historiqueData = [];
let carteLeaflet = null;
let markeurs = {};
let conteneurActif = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('conteneurs');
  await Promise.all([chargerConteneurs(), chargerHistorique()]);
});

async function chargerConteneurs() {
  try {
    const res = await apiFetch('/conteneurs');
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) { conteneursData = data; renderListeConteneurs(); initCarte(); return; }
    }
  } catch {}
  conteneursData = [...MOCK_CONTENEURS];
  renderListeConteneurs();
  initCarte();
}

async function chargerHistorique() {
  try {
    const res = await apiFetch('/depots');
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data)) { historiqueData = data; renderHistorique(); return; }
    }
  } catch {}
  historiqueData = [...MOCK_HISTORIQUE];
  renderHistorique();
}

function renderListeConteneurs() {
  const container = document.getElementById('liste-conteneurs');
  if (!container) return;

  container.innerHTML = conteneursData.map((c, i) => {
    const statut = buildStatutBadge(c.statut);
    const fillClass = c.taux >= 85 ? 'fill-high' : c.taux >= 60 ? 'fill-medium' : 'fill-low';
    return `
      <div class="conteneur-item animate-in" style="animation-delay:${i * 60}ms" id="citem-${c.id}"
           onclick="selectConteneur(${c.id})">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div class="conteneur-item-name">${escPro(c.nom)}</div>
          ${statut}
        </div>
        <div class="conteneur-item-meta">${escPro(c.adresse)}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="conteneur-fill-bar" style="flex:1">
            <div class="conteneur-fill-value ${fillClass}" style="width:${c.taux}%"></div>
          </div>
          <span style="font-family:Poppins,sans-serif;font-size:11px;font-weight:700;color:var(--text-soft);white-space:nowrap">${c.taux}%</span>
        </div>
      </div>`;
  }).join('');
}

function buildStatutBadge(statut) {
  const map = {
    actif:       '<span class="badge badge-green">Actif</span>',
    maintenance: '<span class="badge badge-orange">Maintenance</span>',
    sature:      '<span class="badge badge-red">Saturé</span>',
  };
  return map[statut] || `<span class="badge badge-gray">${statut}</span>`;
}

function initCarte() {
  const mapEl = document.getElementById('leaflet-map');
  if (!mapEl || !window.L) return;

  carteLeaflet = L.map('leaflet-map').setView([48.866, 2.370], 12);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(carteLeaflet);

  conteneursData.forEach(c => {
    const couleur = c.statut === 'sature' ? '#c0392b' : c.statut === 'maintenance' ? '#c67c28' : '#2D664F';
    const taille  = c.statut === 'sature' ? 14 : 12;

    const iconeMarqueur = L.divIcon({
      html: `<div style="
        width:${taille + 8}px;height:${taille + 8}px;
        background:${couleur};border-radius:50%;
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
      "></div>`,
      className: '',
      iconSize: [taille + 8, taille + 8],
      iconAnchor: [(taille + 8) / 2, (taille + 8) / 2],
    });

    const marqueur = L.marker([c.lat, c.lng], { icon: iconeMarqueur }).addTo(carteLeaflet);
    marqueur.bindPopup(`
      <div style="font-family:Poppins,sans-serif;min-width:180px">
        <strong style="color:#2D664F">${c.nom}</strong><br>
        <span style="font-size:12px;color:#666">${c.adresse}</span><br><br>
        <div style="font-size:12px">
          <span style="font-weight:700">Taux : </span>${c.taux}%<br>
          <span style="font-weight:700">Capacité : </span>${c.capacite} objets<br>
          <span style="font-weight:700">Statut : </span>${c.statut}
        </div>
      </div>
    `);
    marqueur.on('click', () => selectConteneur(c.id));
    markeurs[c.id] = marqueur;
  });
}

window.selectConteneur = (id) => {
  const c = conteneursData.find(x => x.id === id);
  if (!c || !carteLeaflet) return;

  // Retirer classe active des autres
  document.querySelectorAll('.conteneur-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`citem-${id}`);
  if (el) {
    el.classList.add('active');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Centrer la carte
  carteLeaflet.flyTo([c.lat, c.lng], 15, { duration: 0.8 });
  markeurs[id]?.openPopup();
  conteneurActif = id;

  // Afficher le détail
  afficherDetailConteneur(c);
};

function afficherDetailConteneur(c) {
  const panel = document.getElementById('detail-conteneur');
  if (!panel) return;

  const fillClass = c.taux >= 85 ? 'fill-high' : c.taux >= 60 ? 'fill-medium' : 'fill-low';
  const locale    = _lang === 'en' ? 'en-GB' : 'fr-FR';
  const dateAff   = new Date(c.derniere).toLocaleDateString(locale, { day:'2-digit', month:'long', year:'numeric' });

  panel.innerHTML = `
    <div style="padding:16px 18px;border-bottom:1px solid var(--border);background:var(--green-50)">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-family:Poppins,sans-serif;font-size:13px;font-weight:700">${escPro(c.nom)}</span>
        ${buildStatutBadge(c.statut)}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${escPro(c.adresse)}</div>
    </div>
    <div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px">
      <div>
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px">
          <span>Taux de remplissage</span>
          <span style="color:var(--green-700)">${c.taux}%</span>
        </div>
        <div class="conteneur-fill-bar" style="height:8px">
          <div class="conteneur-fill-value ${fillClass}" style="width:${c.taux}%"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="background:var(--green-25);border-radius:8px;padding:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Capacité</div>
          <div style="font-family:Poppins,sans-serif;font-size:18px;font-weight:800;color:var(--text)">${c.capacite} obj.</div>
        </div>
        <div style="background:var(--green-25);border-radius:8px;padding:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Dernière ouverture</div>
          <div style="font-family:Poppins,sans-serif;font-size:12px;font-weight:700;color:var(--text)">${dateAff}</div>
        </div>
      </div>
      ${c.statut === 'actif' || c.statut === 'sature' ? `
      <button class="btn btn-primary" onclick="simulerScan(${c.id})" style="width:100%">
        <i class="fa-solid fa-qrcode" aria-hidden="true"></i>
        Scanner pour récupérer
      </button>` : `
      <div style="background:var(--warning-bg);border-radius:8px;padding:12px;font-size:12.5px;color:var(--warning-text);text-align:center;font-weight:600">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        Conteneur en maintenance
      </div>`}
    </div>
  `;
  panel.style.display = 'block';
}

window.simulerScan = (id) => {
  const c = conteneursData.find(x => x.id === id);
  if (!c) return;
  showToast(`Code-barres envoyé par email pour ${c.nom}`, 'success');
};

function renderHistorique() {
  const tbody = document.getElementById('historique-body');
  if (!tbody) return;

  if (!historiqueData.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">Aucune récupération enregistrée</td></tr>`;
    return;
  }

  tbody.innerHTML = historiqueData.map(h => {
    const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
    const date = new Date(h.date).toLocaleDateString(locale, { day:'2-digit', month:'short', year:'numeric' });
    return `
      <tr>
        <td style="color:var(--text-muted);font-size:12px">${date}</td>
        <td class="td-primary">${escPro(h.objet)}</td>
        <td>
          <span style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-soft)">
            <i class="fa-solid fa-location-dot" style="color:var(--green-500)" aria-hidden="true"></i>
            ${escPro(h.conteneur)}
          </span>
        </td>
        <td><span class="badge badge-green">Récupéré</span></td>
      </tr>`;
  }).join('');
}

function escPro(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
