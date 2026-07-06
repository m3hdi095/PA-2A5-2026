// formations et ateliers


let filtreType = '';
let formationsData = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('formations');
  await chargerFormations();
  chargerEvenementsPassés();
});

async function chargerFormations() {
  let apiOk = false;
  try {
    const res = await apiFetch(`/evenements?lang=${_lang}`);
    if (res?.ok) {
      const data = await res.json();
      if (Array.isArray(data)) { formationsData = data; apiOk = true; }
    }
  } catch {}

  if (!apiOk) {
    const banner = document.createElement('div');
    banner.className = 'empty-state card';
    banner.style.cssText = 'padding:16px 20px;display:flex;align-items:center;gap:12px;background:var(--warning-bg,#fff8e1);border-color:var(--warning,#f59e0b);margin-bottom:16px';
    banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--warning,#f59e0b)" aria-hidden="true"></i>' +
      '<span style="font-size:13px">Affichage hors-ligne — données non actualisées. Vérifiez votre connexion.</span>';
    const container = document.getElementById('formations-container');
    container?.parentElement?.insertBefore(banner, container);
  }

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
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i><p>${t('formation_no_filter')}</p><button class="btn btn-outline" onclick="resetFiltreFormations()"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Voir toutes les formations</button></div>`;
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
    const prixTxt = f.tarif > 0 ? `${f.tarif} €` : t('formation_gratuit');
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
            onclick="inscrireFormation(${f.id}, '${esc(f.titre)}', ${f.tarif || 0})" ${complet ? 'disabled style="opacity:.5"' : ''}>
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            ${complet ? t('formation_complet') : (f.tarif > 0 ? t('formation_btn_payer') || 'Réserver &amp; payer' : t('formation_btn_inscrire'))}
          </button>
        </div>
      </div>`;
  }).join('');
}

let _stripeInstance = null;
let _stripeCardEl   = null;
let _paiementEventId = null;

async function getStripe() {
  if (_stripeInstance) return _stripeInstance;
  try {
    const res = await apiFetch('/config');
    if (res?.ok) {
      const cfg = await res.json();
      if (cfg.stripe_pk && window.Stripe) {
        _stripeInstance = window.Stripe(cfg.stripe_pk);
      }
    }
  } catch {}
  return _stripeInstance;
}

window.inscrireFormation = async (id, titre, tarif) => {
  if (tarif > 0) {
    _paiementEventId = id;
    document.getElementById('paiement-event-titre').textContent = titre;
    document.getElementById('paiement-montant').textContent = tarif.toFixed(2) + ' €';
    document.getElementById('paiement-error').textContent = '';

    const stripe = await getStripe();
    if (stripe) {
      const elements = stripe.elements();
      _stripeCardEl  = elements.create('card', { style: { base: { fontFamily: 'Poppins, sans-serif', fontSize: '14px' } } });
      _stripeCardEl.mount('#card-element');
    } else {
      document.getElementById('card-element').innerHTML =
        '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px">Paiement Stripe (configuration requise)</p>';
    }
    document.getElementById('modal-paiement-formation').classList.add('open');
    return;
  }
  const res = await apiFetch('/evenements/inscription', { method: 'POST', body: JSON.stringify({ evenement_id: id }) });
  if (res?.ok) { showToast(t('formation_inscription_ok'), 'success'); return; }
  const err = res ? await res.json().catch(() => ({})) : {};
  showToast(err.error || t('formation_inscription_error') || 'Inscription impossible', 'error');
};

window.confirmerPaiementFormation = async () => {
  const btn = document.getElementById('btn-payer');
  const errEl = document.getElementById('paiement-error');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Traitement...'; }
  errEl.textContent = '';

  const montantEl = document.getElementById('paiement-montant');
  const montant   = parseFloat(montantEl?.textContent) || 0;

  try {
    const piRes = await apiFetch('/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ amount: montant, currency: 'eur', type: 'evenement', reference_id: _paiementEventId }),
    });
    if (!piRes?.ok) {
      errEl.textContent = 'Impossible de créer la session de paiement.';
      return;
    }
    const { client_secret: clientSecret } = await piRes.json();

    const stripe = await getStripe();
    if (stripe && _stripeCardEl) {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: _stripeCardEl },
      });
      if (error) {
        errEl.textContent = error.message || 'Paiement refusé.';
        return;
      }
      if (paymentIntent?.status === 'succeeded') {
        await apiFetch('/evenements/inscription', { method: 'POST', body: JSON.stringify({ evenement_id: _paiementEventId }) });
        document.getElementById('modal-paiement-formation').classList.remove('open');
        showToast('Inscription confirmée ! Votre facture sera envoyée par email.', 'success');
        await chargerFormations();
        return;
      }
    }
    errEl.textContent = 'Configuration Stripe manquante. Contactez l\'administrateur.';
  } catch {
    errEl.textContent = 'Service indisponible. Réessayez.';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-brands fa-stripe-s"></i> Payer'; }
  }
};

function resetFiltreFormations() {
  filtreType = '';
  document.querySelectorAll('.filtre-tab').forEach(b => b.classList.remove('active'));
  document.querySelector('.filtre-tab[data-val=""]')?.classList.add('active');
  renderFormations();
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let _qPartId        = null;
let _qPartQuestions = [];

async function chargerEvenementsPassés() {
  let inscrits = [];
  try {
    const res = await apiFetch('/evenements/mes-inscriptions');
    if (res?.ok) { const d = await res.json(); if (Array.isArray(d)) inscrits = d; }
  } catch {}

  const maintenant = new Date();
  const passes = inscrits.filter(e => e.ev_date_debut && new Date(e.ev_date_debut) < maintenant);
  if (!passes.length) return;

  const locale = typeof _lang !== 'undefined' && _lang === 'en' ? 'en-GB' : 'fr-FR';
  const container = document.getElementById('passes-container');
  if (!container) return;

  container.innerHTML = passes.map(e => {
    const dateStr = new Date(e.ev_date_debut).toLocaleDateString(locale, { day:'numeric', month:'short', year:'numeric' });
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--neutral-50);border-radius:var(--radius);border:1px solid var(--border)">
      <div>
        <div style="font-weight:600;font-size:14px">${esc(e.ev_titre)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px"><i class="fa-solid fa-calendar-days"></i> ${dateStr}${e.ev_lieu ? ` &nbsp;·&nbsp; <i class="fa-solid fa-location-dot"></i> ${esc(e.ev_lieu)}` : ''}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="ouvrirQuestionnairePart(${e.id_evenement},'${esc(e.ev_titre)}')">
        <i class="fa-solid fa-star"></i> Questionnaire
      </button>
    </div>`;
  }).join('');

  document.getElementById('section-passes').style.display = 'block';
}

window.ouvrirQuestionnairePart = async (eventId, titre) => {
  let q = null;
  try {
    const res = await apiFetch(`/evenements/${eventId}/questionnaire`);
    if (!res?.ok) { showToast('Aucun questionnaire disponible pour cet événement', 'info'); return; }
    q = await res.json();
  } catch { showToast('Service indisponible', 'error'); return; }

  _qPartId = q.id;
  try { _qPartQuestions = JSON.parse(q.questions); } catch { _qPartQuestions = []; }
  document.getElementById('q-event-titre').textContent = titre;

  const container = document.getElementById('q-questions-container');
  container.innerHTML = _qPartQuestions.map((q, i) => {
    let input = '';
    if (q.type === 'note') {
      input = `<div style="display:flex;gap:8px;margin-top:4px">
        ${[1,2,3,4,5].map(n => `<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer">
          <input type="radio" name="q_${i}" value="${n}"> ${n}
        </label>`).join('')}
      </div>`;
    } else if (q.type === 'oui_non') {
      input = `<div style="display:flex;gap:16px;margin-top:4px">
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer"><input type="radio" name="q_${i}" value="Oui"> Oui</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer"><input type="radio" name="q_${i}" value="Non"> Non</label>
      </div>`;
    } else {
      input = `<textarea class="form-control" id="q_rep_${i}" rows="2" placeholder="Votre réponse..." style="font-size:13px;margin-top:4px"></textarea>`;
    }
    return `<div>
      <label style="font-size:13px;font-weight:600;color:var(--text)">${i+1}. ${esc(q.question)}</label>
      ${input}
    </div>`;
  }).join('');

  document.getElementById('modal-questionnaire-part').classList.add('open');
};

window.soumettreQuestionnairePart = async () => {
  if (!_qPartId) return;
  const reponses = _qPartQuestions.map((q, i) => {
    const radio    = document.querySelector(`input[name="q_${i}"]:checked`);
    const textarea = document.getElementById(`q_rep_${i}`);
    return { question: q.question, reponse: radio ? radio.value : (textarea?.value.trim() ?? '') };
  });

  try {
    const res = await apiFetch(`/questionnaires/${_qPartId}/repondre`, {
      method: 'POST',
      body: JSON.stringify({ reponses: JSON.stringify(reponses) }),
    });
    if (res?.ok) {
      showToast('Merci pour votre retour !', 'success');
      document.getElementById('modal-questionnaire-part').classList.remove('open');
    } else {
      const d = await res?.json().catch(() => ({}));
      showToast(d?.error || 'Erreur lors de l\'envoi', 'error');
    }
  } catch { showToast('Service indisponible', 'error'); }
};
