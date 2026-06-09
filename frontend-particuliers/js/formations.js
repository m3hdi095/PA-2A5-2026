// formations et ateliers


let filtreType = '';
let formationsData = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('formations');
  await chargerFormations();
});

async function chargerFormations() {
  try {
    const res = await apiFetch(`/evenements?lang=${_lang}`);
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        formationsData = data;
        return;
      }
    }
  } catch {}
  mettreAJourCompteurs();
  renderFormations();
}

function mettreAJourCompteurs() {
  const maintenant = new Date();
  const futurs = formationsData.filter(f => new Date(f.date_debut) >= maintenant);
  const total = document.querySelector('[data-val=""] .tab-count');
  if (total) total.textContent = futurs.length;
  ['formation', 'atelier', 'evenement'].forEach(type => {
    const nb  = futurs.filter(f => f.type === type).length;
    const btn = document.querySelector(`[data-val="${type}"] .tab-count`);
    if (btn) btn.textContent = nb;
  });
}

function renderFormations() {
  const container = document.getElementById('formations-container');
  if (!container) return;

  const maintenant = new Date();
  let list = formationsData.filter(f => new Date(f.date_debut) >= maintenant);
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
    const places = f.nb_places ? f.nb_places - (f.places_prises || 0) : null;
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
    const res = await apiFetch('/evenements/inscription', { method: 'POST', body: JSON.stringify({ evenement_id: id }) });
    if (res?.ok) { showToast(t('formation_inscription_ok'), 'success'); return; }
    throw new Error();
  } catch {
    showToast(t('formation_inscription_sim'), 'success');
  }
};

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
