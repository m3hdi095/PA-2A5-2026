// planning particuliers

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
const TYPE_CONF = {
  formation:  { badge: 'badge-formation', icone: 'fa-graduation-cap',     label: 'Formation' },
  atelier:    { badge: 'badge-atelier',   icone: 'fa-screwdriver-wrench', label: 'Atelier'   },
  evenement:  { badge: 'badge-evenement', icone: 'fa-calendar-days',       label: 'Événement' },
  conference: { badge: 'badge-evenement', icone: 'fa-microphone',          label: 'Conférence'},
  forum:      { badge: 'badge-evenement', icone: 'fa-comments',            label: 'Forum'     },
  personnel:  { badge: 'badge-atelier',   icone: 'fa-user',                label: 'Personnel' },
  rappel:     { badge: 'badge-warning',   icone: 'fa-bell',                label: 'Rappel'    },
};

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('planning');
  await chargerPlanning();
});

async function chargerPlanning() {
  const container = document.getElementById('planning-container');
  if (!container) return;
  container.innerHTML = `<p style="color:var(--text-muted);text-align:center">Chargement…</p>`;

  try {
    // on fusionne les inscriptions événements avec les entrées planning perso
    const [resInscriptions, resPlanning] = await Promise.all([
      apiFetch('/evenements/mes-inscriptions'),
      apiFetch('/planning/me'),
    ]);

    const inscriptions = resInscriptions.ok ? await resInscriptions.json() : [];
    const planningPerso = resPlanning.ok ? await resPlanning.json() : [];

    // on a besoin des dates des evenements pour les afficher dans le planning
    const evenements = await chargerEvenements();

    // Construire la liste unifiée
    const items = [];

    // Événements inscrits
    (Array.isArray(inscriptions) ? inscriptions : []).forEach(insc => {
      const ev = evenements.find(e => e.id === insc.id_evenement);
      if (!ev) return;
      items.push({
        id:       insc.id,
        titre:    ev.titre,
        lieu:     ev.lieu || '',
        dateHeure: new Date(ev.date_debut),
        type:     ev.type || 'evenement',
        inscrit:  true,
        idEvenement: ev.id,
      });
    });

    // Entrées planning personnelles
    (Array.isArray(planningPerso) ? planningPerso : []).forEach(p => {
      // Éviter les doublons avec les événements
      if (p.type_entree === 'evenement' && items.some(i => i.idEvenement === p.id_evenement)) return;
      items.push({
        id:       p.id,
        titre:    p.titre,
        lieu:     p.notes || '',
        dateHeure: new Date(p.date_heure),
        type:     p.type_entree || 'personnel',
        inscrit:  false,
        personnel: true,
      });
    });

    const maintenant = new Date();
    const itemsFuturs = items.filter(i => i.dateHeure >= maintenant);

    if (!itemsFuturs.length) {
      container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-calendar-xmark" aria-hidden="true"></i><p>Aucun événement à venir. <a href="#" style="color:var(--teal-700);font-weight:600" onclick="chargerEvenementsPublics()">Parcourir les événements</a></p></div>`;
      return;
    }

    // Trier par date et grouper par mois
    itemsFuturs.sort((a, b) => a.dateHeure - b.dateHeure);
    const grouped = {};
    itemsFuturs.forEach(e => {
      const d = e.dateHeure;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!grouped[key]) grouped[key] = { label: `${MOIS[d.getMonth()]} ${d.getFullYear()}`, events: [] };
      grouped[key].events.push(e);
    });

    container.innerHTML = Object.entries(grouped).map(([, group]) => `
      <div style="margin-bottom:24px">
        <div style="font-family:Poppins,sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);padding:8px 0 10px">${group.label}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${group.events.map((e, i) => {
            const d    = e.dateHeure;
            const conf = TYPE_CONF[e.type] || TYPE_CONF.evenement;
            const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
            const heure = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
            return `
              <div class="planning-item animate-in" style="animation-delay:${i * .06}s">
                <div class="planning-date">
                  <div class="day">${d.getDate()}</div>
                  <div class="month">${MOIS[d.getMonth()]}</div>
                </div>
                <div class="planning-sep"></div>
                <div class="planning-info" style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <div class="planning-title">${esc(e.titre)}</div>
                    ${e.inscrit ? '<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Inscrit</span>' : ''}
                  </div>
                  ${e.lieu ? `<div class="planning-lieu"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${esc(e.lieu)} &nbsp;·&nbsp; <i class="fa-solid fa-clock" aria-hidden="true"></i> ${heure}</div>` : `<div class="planning-lieu"><i class="fa-solid fa-clock" aria-hidden="true"></i> ${heure}</div>`}
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                  <span class="badge ${conf.badge}"><i class="fa-solid ${conf.icone}" aria-hidden="true"></i> ${conf.label}</span>
                  ${e.personnel
                    ? `<button class="btn btn-ghost btn-sm" onclick="supprimerEntree(${e.id})" style="color:var(--danger-text)"><i class="fa-solid fa-trash"></i></button>`
                    : e.inscrit
                      ? `<button class="btn btn-ghost btn-sm" onclick="seDesinscrire(${e.idEvenement})" style="color:var(--danger-text)">Se désinscrire</button>`
                      : `<button class="btn btn-outline btn-sm" onclick="sInscrire(${e.idEvenement})">S'inscrire</button>`
                  }
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`).join('');
  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger-text);text-align:center">Impossible de charger le planning. Vérifiez votre connexion.</p>`;
  }
}

async function chargerEvenements() {
  try {
    const res = await fetch(`${window.API_BASE || 'http://localhost:8080/api'}/evenements`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

window.sInscrire = async (evenementId) => {
  try {
    const res = await apiFetch('/evenements/inscription', { method: 'POST', body: JSON.stringify({ evenement_id: evenementId }) });
    if (res.ok) { showToast('Inscription confirmée !', 'success'); await chargerPlanning(); }
    else { const d = await res.json(); showToast(d.error || 'Erreur', 'error'); }
  } catch { showToast('Service indisponible.', 'error'); }
};

window.seDesinscrire = async (evenementId) => {
  showToast('Désinscription non disponible pour l\'instant.', 'info');
};

window.supprimerEntree = async (id) => {
  try {
    const res = await apiFetch(`/planning/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Entrée supprimée.', 'success'); await chargerPlanning(); }
  } catch { showToast('Erreur lors de la suppression.', 'error'); }
};

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
