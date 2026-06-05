// formations et ateliers

const MOCK_FORMATIONS = [
  { id:1, titre:'Atelier création luminaire en bois',         lieu:'Paris 11e,  La Fabrique',  date_debut:'2026-05-03T10:00:00Z', type:'atelier',   prix:0,   places_max:12, places_prises:9,  description:'Transformez des chutes de bois en lampes design. Matériel fourni, niveau débutant.' },
  { id:2, titre:'Formation upcycling textile - Niveau 1',     lieu:'Paris 20e,  Atelier Fil',  date_debut:'2026-05-10T14:00:00Z', type:'formation', prix:45,  places_max:10, places_prises:4,  description:'Techniques de base pour valoriser tissu et vêtements : patchwork, teinture naturelle.' },
  { id:3, titre:'Collecte vêtements printemps 2026',          lieu:'Montreuil,  Parvis Marie', date_debut:'2026-05-17T09:00:00Z', type:'evenement', prix:0,   places_max:200, places_prises:62, description:'Grande collecte solidaire : apportez vos vêtements propres, repartez avec d\'autres !' },
  { id:4, titre:'Atelier réparation électroménager',          lieu:'Paris 13e,  Repair Café',  date_debut:'2026-05-24T10:30:00Z', type:'atelier',   prix:5,   places_max:20, places_prises:18, description:'Apprenez à réparer grille-pain, cafetières, petits appareils. Amenez vos objets cassés !' },
  { id:5, titre:'Formation upcycling meuble - Niveau 2',      lieu:'Vincennes,  L\'Atelier',   date_debut:'2026-06-07T09:00:00Z', type:'formation', prix:80,  places_max:8,  places_prises:3,  description:'Restauration meuble, peinture à la craie, décapage. Niveau intermédiaire requis.' },
  { id:6, titre:'Journée portes ouvertes Ressourcerie',       lieu:'Paris 19e,  Ressourcerie', date_debut:'2026-06-14T10:00:00Z', type:'evenement', prix:0,   places_max:null, places_prises:0, description:'Découvrez la ressourcerie de Paris 19e : ateliers, expo et vente de seconde main.' },
  { id:7, titre:'Atelier teinture végétale sur tissu',        lieu:'Saint-Denis, BotaLab',    date_debut:'2026-06-21T14:00:00Z', type:'atelier',   prix:30,  places_max:14, places_prises:6,  description:'Colorez vos tissus avec plantes et racines. Kit de plantes inclus dans le prix.' },
  { id:8, titre:'Formation maraîchage urbain & compostage',   lieu:'Paris 10e,  Rooftop Vert', date_debut:'2026-07-05T10:00:00Z', type:'formation', prix:35,  places_max:15, places_prises:2,  description:'Valorisez déchets organiques et compostez en appartement. Bac à compost offert.' },
];

let filtreType = '';
let formationsData = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('formations');
  document.getElementById('f-type')?.addEventListener('change', e => {
    filtreType = e.target.value;
    renderFormations();
  });
  await chargerFormations();
});

async function chargerFormations() {
  try {
    const res = await apiFetch('/evenements');
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        formationsData = data;
        renderFormations();
        return;
      }
    }
  } catch {}
  formationsData = MOCK_FORMATIONS;
  renderFormations();
}

function renderFormations() {
  const container = document.getElementById('formations-container');
  if (!container) return;

  let list = [...formationsData];
  if (filtreType) list = list.filter(f => f.type === filtreType);

  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i><p>${t('formation_no_filter')}</p></div>`;
    return;
  }

  const locale = _lang === 'en' ? 'en-GB' : 'fr-FR';
  const typeConf = {
    formation: { badge: 'badge-formation', icone: 'fa-graduation-cap',     label: t('formation_type_formation') },
    atelier:   { badge: 'badge-atelier',   icone: 'fa-screwdriver-wrench', label: t('formation_type_atelier')   },
    evenement: { badge: 'badge-evenement', icone: 'fa-calendar-days',       label: t('formation_type_evenement') },
  };

  container.innerHTML = list.map((f, i) => {
    const d      = new Date(f.date_debut);
    const dateStr = d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const conf   = typeConf[f.type] || typeConf.evenement;
    const places = f.places_max !== null ? f.places_max - f.places_prises : null;
    const complet = places !== null && places <= 0;
    const prixTxt = f.prix > 0 ? `${f.prix} €` : t('formation_gratuit');
    return `
      <div class="formation-card animate-in" style="animation-delay:${i * .06}s">
        <div class="formation-card-header">
          <i class="fa-solid ${conf.icone}" aria-hidden="true"></i>
          <span class="badge ${conf.badge}">${conf.label}</span>
        </div>
        <div class="formation-card-body">
          <div class="formation-titre">${esc(f.titre)}</div>
          <div class="formation-meta">
            <span><i class="fa-solid fa-calendar-days" aria-hidden="true"></i>${dateStr}</span>
            ${f.lieu ? `<span><i class="fa-solid fa-location-dot" aria-hidden="true"></i>${esc(f.lieu)}</span>` : ''}
          </div>
          <p style="font-size:12px;color:var(--text-soft);line-height:1.5;flex:1">${esc(f.description || '')}</p>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
            <div class="formation-prix">${prixTxt}</div>
            ${places !== null
              ? `<div class="formation-places${complet ? ' complet' : ''}">${complet ? t('formation_complet') : `${places} ${t('formation_places_restantes')}`}</div>`
              : ''}
          </div>
          <button class="btn btn-primary btn-sm" style="width:100%;justify-content:center;margin-top:8px"
            onclick="inscrireFormation(${f.id}, '${esc(f.titre)}')" ${complet ? 'disabled style="opacity:.5"' : ''}>
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            ${complet ? t('formation_complet') : t('formation_btn_inscrire')}
          </button>
        </div>
      </div>`;
  }).join('');
}

window.inscrireFormation = async (id, titre) => {
  try {
    const res = await apiFetch(`/evenements/${id}/inscription`, { method: 'POST' });
    if (res?.ok) { showToast(t('formation_inscription_ok'), 'success'); return; }
    throw new Error();
  } catch {
    showToast(t('formation_inscription_sim'), 'success');
  }
};

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
