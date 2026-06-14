// depot conteneur

let annonceSelectionnee = null;
let conteneurs = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('depot');
  await Promise.all([chargerAnnonces(), chargerHistorique(), chargerConteneurs()]);

  document.getElementById('modal-depot-close')?.addEventListener('click', fermerModal);
  document.getElementById('modal-annuler')?.addEventListener('click', fermerModal);
  document.getElementById('modal-confirmer')?.addEventListener('click', confirmerDepot);
  document.getElementById('modal-depot')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-depot')) fermerModal();
  });
});

async function chargerAnnonces() {
  const container = document.getElementById('annonces-depot');
  if (!container) return;
  try {
    const res = await apiFetch('/annonces/mes-annonces');
    const annonces = await res.json();
    if (!Array.isArray(annonces) || !annonces.length) {
      container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-box-open" aria-hidden="true"></i><p>Vous n'avez pas encore d'annonce. <a href="annonces.html" style="color:var(--teal-700);font-weight:600">Créer une annonce</a></p></div>`;
      return;
    }
    const validees   = annonces.filter(a => a.statut === 'validee');
    const enAttente  = annonces.filter(a => a.statut === 'en_attente');
    let html = '';
    validees.forEach(a => {
      html += `
        <div class="depot-item">
          <div class="depot-item-info">
            <div class="depot-item-titre">${esc(a.titre)}</div>
            <div class="depot-item-meta">
              ${a.type_annonce === 'don'
                ? '<span class="badge badge-don"><i class="fa-solid fa-hand-holding-heart"></i> Don</span>'
                : '<span class="badge badge-vente"><i class="fa-solid fa-tag"></i> Vente</span>'}
              <span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Validée</span>
            </div>
          </div>
          <button class="btn btn-primary" onclick="ouvrirDepot(${a.id}, ${a.id_objet}, '${esc(a.titre)}')">
            <i class="fa-solid fa-qrcode" aria-hidden="true"></i> Demander un dépôt
          </button>
        </div>`;
    });
    enAttente.forEach(a => {
      html += `
        <div class="depot-item" style="opacity:.7">
          <div class="depot-item-info">
            <div class="depot-item-titre">${esc(a.titre)}</div>
            <div class="depot-item-meta">
              <span class="badge badge-warning"><i class="fa-solid fa-clock"></i> En attente de validation</span>
            </div>
          </div>
          <button class="btn btn-outline" disabled style="opacity:.5;cursor:default">En attente</button>
        </div>`;
    });
    container.innerHTML = html || `<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>Aucune annonce validée.</p></div>`;
  } catch {
    document.getElementById('annonces-depot').innerHTML = `<p style="color:var(--danger-text)">Impossible de charger les annonces.</p>`;
  }
}

async function chargerConteneurs() {
  try {
    const res = await apiFetch('/conteneurs');
    conteneurs = await res.json();
    const sel = document.getElementById('modal-conteneur-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">Choisir un conteneur</option>' +
      conteneurs.map(c => `<option value="${c.id}">${esc(c.adresse)}, ${esc(c.ville)} (${c.nb_objets}/${c.capacite})</option>`).join('');
  } catch { /* silencieux */ }
}

async function chargerHistorique() {
  const tbody = document.getElementById('historique-body');
  if (!tbody) return;
  try {
    const res = await apiFetch('/depots');
    const depots = await res.json();
    if (!Array.isArray(depots) || !depots.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Aucun dépôt effectué pour l'instant</td></tr>`;
      return;
    }
    const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
    tbody.innerHTML = depots.map(d => {
      const date = new Date(d.date_demande).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
      const badgeStatut = {
        en_attente: '<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> En attente</span>',
        valide:     '<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Validé</span>',
        refuse:     '<span class="badge badge-danger"><i class="fa-solid fa-xmark"></i> Refusé</span>',
        recupere:   '<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Récupéré</span>',
      }[d.statut] || `<span class="badge">${esc(d.statut)}</span>`;
      return `
        <tr>
          <td style="color:var(--text-muted);font-size:12px">${date}</td>
          <td class="td-primary">Objet #${d.id_objet}</td>
          <td style="font-size:13px;color:var(--text-soft)">Conteneur #${d.id_conteneur}</td>
          <td>
            <code style="font-family:monospace;font-size:11px;background:var(--teal-25);padding:2px 6px;border-radius:4px">${esc(d.code_barre_retrait)}</code>
            ${d.code_barre_retrait ? `<br><img src="${serverBase}/uploads/barcodes/depot_${d.id}.png" alt="QR code" style="height:40px;margin-top:4px" onerror="this.style.display='none'">` : ''}
          </td>
          <td>${badgeStatut}</td>
        </tr>`;
    }).join('');
  } catch {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger-text)">Impossible de charger l'historique.</td></tr>`;
  }
}

window.ouvrirDepot = (annonceId, objetId, titre) => {
  annonceSelectionnee = { annonceId, objetId };
  const el = document.getElementById('depot-annonce-nom');
  if (el) el.textContent = titre;
  document.getElementById('modal-depot').classList.add('open');
};

function fermerModal() {
  document.getElementById('modal-depot').classList.remove('open');
  annonceSelectionnee = null;
}

async function confirmerDepot() {
  if (!annonceSelectionnee) return;
  const conteneurID = document.getElementById('modal-conteneur-select')?.value;
  if (!conteneurID) { showToast('Veuillez sélectionner un conteneur.', 'warning'); return; }

  const btn = document.getElementById('modal-confirmer');
  if (btn) { btn.disabled = true; btn.textContent = 'Envoi...'; }

  try {
    const res = await apiFetch('/depots', {
      method: 'POST',
      body: JSON.stringify({ conteneur_id: parseInt(conteneurID), objet_id: annonceSelectionnee.objetId }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Demande de dépôt enregistrée ! Code : ' + data.code_ouverture, 'success');
      fermerModal();
      await chargerHistorique();
    } else {
      showToast(data.error || 'Erreur lors de la demande.', 'error');
    }
  } catch {
    showToast('Service indisponible. Réessayez.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirmer'; }
  }
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
