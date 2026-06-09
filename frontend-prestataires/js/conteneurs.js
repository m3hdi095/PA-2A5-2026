// Carte des conteneurs + historique des récupérations

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
  const container = document.getElementById('liste-conteneurs');
  try {
    const res = await apiFetch('/conteneurs');
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        conteneursData = data;
        renderListeConteneurs();
        initCarte();
        return;
      }
    }
  } catch {}

  if (container) {
    container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:30px">Aucun conteneur disponible.</p>`;
  }
}

async function chargerHistorique() {
  try {
    const res = await apiFetch('/depots');
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data)) { historiqueData = data; renderHistorique(); return; }
    }
  } catch {}
  historiqueData = [];
  renderHistorique();
}

function nomConteneur(c) {
  return c.adresse ? (c.ville ? `${c.adresse}, ${c.ville}` : c.adresse) : `Conteneur #${c.id}`;
}

function tauxRemplissage(c) {
  if (!c.capacite) return 0;
  return Math.min(100, Math.round((c.nb_objets / c.capacite) * 100));
}

function renderListeConteneurs() {
  const container = document.getElementById('liste-conteneurs');
  if (!container) return;

  container.innerHTML = conteneursData.map((c, i) => {
    const taux    = tauxRemplissage(c);
    const statut  = buildStatutBadge(c.statut);
    const fillClass = taux >= 85 ? 'fill-high' : taux >= 60 ? 'fill-medium' : 'fill-low';
    return `
      <div class="conteneur-item animate-in" style="animation-delay:${i * 60}ms" id="citem-${c.id}"
           onclick="selectConteneur(${c.id})">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div class="conteneur-item-name">${escPro(c.adresse || 'Conteneur')}</div>
          ${statut}
        </div>
        <div class="conteneur-item-meta">${escPro(c.ville || '')}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="conteneur-fill-bar" style="flex:1">
            <div class="conteneur-fill-value ${fillClass}" style="width:${taux}%"></div>
          </div>
          <span style="font-family:Poppins,sans-serif;font-size:11px;font-weight:700;color:var(--text-soft);white-space:nowrap">${taux}%</span>
        </div>
      </div>`;
  }).join('');
}

function buildStatutBadge(statut) {
  const map = {
    disponible:     '<span class="badge badge-green">Disponible</span>',
    plein:          '<span class="badge badge-red">Plein</span>',
    en_maintenance: '<span class="badge badge-orange">Maintenance</span>',
  };
  return map[statut] || `<span class="badge badge-gray">${statut || 'Inconnu'}</span>`;
}

function initCarte() {
  const mapEl = document.getElementById('leaflet-map');
  if (!mapEl || !window.L) return;

  if (carteLeaflet) { carteLeaflet.remove(); carteLeaflet = null; }

  carteLeaflet = L.map('leaflet-map').setView([48.866, 2.370], 12);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(carteLeaflet);

  conteneursData.forEach(c => {
    if (!c.latitude || !c.longitude) return;

    const couleur = c.statut === 'plein' ? '#c0392b' : c.statut === 'en_maintenance' ? '#c67c28' : '#2D664F';
    const taille  = c.statut === 'plein' ? 14 : 12;
    const taux    = tauxRemplissage(c);

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

    const marqueur = L.marker([c.latitude, c.longitude], { icon: iconeMarqueur }).addTo(carteLeaflet);
    marqueur.bindPopup(`
      <div style="font-family:Poppins,sans-serif;min-width:180px">
        <strong style="color:#2D664F">${escPro(c.adresse || 'Conteneur')}</strong><br>
        <span style="font-size:12px;color:#666">${escPro(c.ville || '')}</span><br><br>
        <div style="font-size:12px">
          <span style="font-weight:700">Taux : </span>${taux}%<br>
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

  document.querySelectorAll('.conteneur-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`citem-${id}`);
  if (el) {
    el.classList.add('active');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (c.latitude && c.longitude) {
    carteLeaflet.flyTo([c.latitude, c.longitude], 15, { duration: 0.8 });
    markeurs[id]?.openPopup();
  }
  conteneurActif = id;

  afficherDetailConteneur(c);
};

function afficherDetailConteneur(c) {
  const panel = document.getElementById('detail-conteneur');
  if (!panel) return;

  const taux      = tauxRemplissage(c);
  const fillClass = taux >= 85 ? 'fill-high' : taux >= 60 ? 'fill-medium' : 'fill-low';

  panel.innerHTML = `
    <div style="padding:16px 18px;border-bottom:1px solid var(--border);background:var(--green-50)">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-family:Poppins,sans-serif;font-size:13px;font-weight:700">${escPro(c.adresse || 'Conteneur')}</span>
        ${buildStatutBadge(c.statut)}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${escPro(c.ville || '')}</div>
    </div>
    <div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px">
      <div>
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px">
          <span>Taux de remplissage</span>
          <span style="color:var(--green-700)">${taux}%</span>
        </div>
        <div class="conteneur-fill-bar" style="height:8px">
          <div class="conteneur-fill-value ${fillClass}" style="width:${taux}%"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="background:var(--green-25);border-radius:8px;padding:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Capacité</div>
          <div style="font-family:Poppins,sans-serif;font-size:18px;font-weight:800;color:var(--text)">${c.capacite} obj.</div>
        </div>
        <div style="background:var(--green-25);border-radius:8px;padding:12px">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Objets présents</div>
          <div style="font-family:Poppins,sans-serif;font-size:18px;font-weight:800;color:var(--text)">${c.nb_objets}</div>
        </div>
      </div>
      ${c.statut === 'disponible' || c.statut === 'plein' ? `
      <button class="btn btn-primary" onclick="ouvrirModalScan()" style="width:100%">
        <i class="fa-solid fa-qrcode" aria-hidden="true"></i>
        Scanner un code barre
      </button>` : `
      <div style="background:var(--warning-bg);border-radius:8px;padding:12px;font-size:12.5px;color:var(--warning-text);text-align:center;font-weight:600">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        Conteneur en maintenance
      </div>`}
    </div>
  `;
  panel.style.display = 'block';
}

window.ouvrirModalScan = () => {
  const modal = document.getElementById('modal-scan');
  if (modal) {
    document.getElementById('scan-code-input').value = '';
    document.getElementById('scan-result').textContent = '';
    modal.classList.add('open');
  }
};

window.fermerModalScan = () => {
  document.getElementById('modal-scan')?.classList.remove('open');
};

window.confirmerScan = async () => {
  const code = document.getElementById('scan-code-input')?.value?.trim();
  if (!code) { showToast('Entrez un code barre.', 'warning'); return; }

  const btn = document.getElementById('btn-confirmer-scan');
  if (btn) { btn.disabled = true; btn.textContent = 'Vérification...'; }

  try {
    const res = await apiFetch('/depots/recuperer-par-code', {
      method: 'POST',
      body: JSON.stringify({ code_barre: code }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Récupération confirmée ! Objet #' + data.id_objet, 'success');
      fermerModalScan();
      await chargerHistorique();
      await chargerConteneurs();
    } else {
      document.getElementById('scan-result').textContent = data.error || 'Code introuvable ou déjà récupéré.';
    }
  } catch {
    document.getElementById('scan-result').textContent = 'Erreur réseau.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirmer la récupération'; }
  }
};

function renderHistorique() {
  const tbody = document.getElementById('historique-body');
  if (!tbody) return;

  if (!historiqueData.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">Aucune récupération enregistrée</td></tr>`;
    return;
  }

  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  tbody.innerHTML = historiqueData.map(h => {
    const dateStr = h.date_recuperation || h.date_demande;
    const date = dateStr ? new Date(dateStr).toLocaleDateString(locale, { day:'2-digit', month:'short', year:'numeric' }) : '';
    const statutBadge = h.statut === 'recupere' || h.statut === 'recupere'
      ? '<span class="badge badge-green">Récupéré</span>'
      : `<span class="badge badge-gray">${escPro(h.statut)}</span>`;
    return `
      <tr>
        <td style="color:var(--text-muted);font-size:12px">${date}</td>
        <td class="td-primary">Objet #${h.id_objet || h.id}</td>
        <td>
          <span style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-soft)">
            <i class="fa-solid fa-location-dot" style="color:var(--green-500)" aria-hidden="true"></i>
            Conteneur #${h.id_conteneur || ''}
          </span>
        </td>
        <td>${statutBadge}</td>
      </tr>`;
  }).join('');
}

function escPro(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
