// moderation forum

let signalements = [];
let messagesRecents = [];

function renderSignalements() {
  const container = document.getElementById('signalements-list');
  if (!container) return;

  if (!signalements.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-muted)">
        <i class="fa-solid fa-circle-check" style="font-size:32px;color:var(--green-300);display:block;margin-bottom:10px"></i>
        Aucun signalement en attente, beau travail !
      </div>`;
    updateBadge();
    return;
  }

  container.innerHTML = signalements.map((s, i) => {
    const iconColor = s.severite === 'danger' ? '#c62828' : '#e8a020';
    const iconBg    = s.severite === 'danger' ? '#fde8e8' : '#fef3e2';
    const icon      = s.severite === 'danger' ? 'fa-triangle-exclamation' : 'fa-flag';
    const border    = i < signalements.length - 1 ? '' : 'border-bottom:none';
    return `
      <div class="activity-item" style="${border}" id="sig-${s.id}">
        <div class="activity-icon" style="background:${iconBg};color:${iconColor}">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="activity-text" style="flex:1">
          <strong>${esc(s.type)}</strong>, message de <em>${esc(s.auteur)}</em> dans le forum "<em>${esc(s.forum)}</em>"<br>
          <span style="font-size:11.5px;color:var(--text-muted)">${esc(s.detail)}</span><br>
          <span style="font-size:11px;color:var(--text-muted)">Signalé il y a ${s.il_y_a} · ${s.nb_signalements} membre${s.nb_signalements > 1 ? 's' : ''}</span>
        </div>
        <div class="cell-actions">
          <button class="btn btn-success btn-sm" onclick="validerSignalement(${s.id})">
            <i class="fa-solid fa-check"></i> Valider
          </button>
          <button class="btn btn-danger btn-sm" onclick="supprimerSignalement(${s.id})">
            <i class="fa-solid fa-trash"></i> Supprimer
          </button>
        </div>
      </div>`;
  }).join('');

  updateBadge();
}

function renderMessages() {
  const container = document.getElementById('messages-list');
  if (!container) return;
  container.innerHTML = messagesRecents.map((m, i) => `
    <div class="activity-item" style="${i === messagesRecents.length - 1 ? 'border-bottom:none' : ''}">
      <div class="activity-icon"><i class="fa-solid fa-user"></i></div>
      <div class="activity-text" style="flex:1">
        <strong>${esc(m.auteur)}</strong> dans "${esc(m.forum || '')}"<br>
        <span style="font-size:12px;color:var(--text-soft)">"${esc(m.contenu)}"</span>
      </div>
      <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">Il y a ${m.il_y_a || ''}</span>
    </div>`).join('');
}

function updateBadge() {
  const badge = document.getElementById('badge-signalements');
  if (!badge) return;
  const n = signalements.length;
  badge.textContent = n + ' ' + t('mod_signalement_label');
  badge.className   = n === 0 ? 'badge badge-success' : 'badge badge-warning';
}

window.validerSignalement = async (id) => {
  try {
    const res = await apiFetch(`/forum/signalements/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'supprimer' }),
    });
    if (res?.ok) {
      signalements = signalements.filter(s => s.id !== id);
      renderSignalements();
      showToast(t('sal_toast_moderation_traite'), 'success');
      return;
    }
    const err = res ? await res.json().catch(() => ({})) : {};
    showToast(err.error || t('toast_error'), 'error');
  } catch {
    showToast(t('toast_error'), 'error');
  }
};

window.supprimerSignalement = async (id) => {
  if (!confirm(t('confirm_action'))) return;
  try {
    const res = await apiFetch(`/forum/signalements/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ action: 'restaurer' }),
    });
    if (res?.ok) {
      signalements = signalements.filter(s => s.id !== id);
      renderSignalements();
      showToast(t('sal_toast_message_deleted'), 'warning');
      return;
    }
    const err = res ? await res.json().catch(() => ({})) : {};
    showToast(err.error || t('toast_error'), 'error');
  } catch {
    showToast(t('toast_error'), 'error');
  }
};

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

let commentairesEnAttente = [];

function renderCommentaires() {
  const container = document.getElementById('commentaires-list');
  if (!container) return;
  const badge = document.getElementById('badge-commentaires');

  if (!commentairesEnAttente.length) {
    container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted)">Aucun commentaire en attente.</div>`;
    if (badge) badge.style.display = 'none';
    return;
  }

  if (badge) {
    badge.style.display = '';
    badge.textContent = commentairesEnAttente.length + ' ' + t('mod_en_attente');
  }

  container.innerHTML = commentairesEnAttente.map((c, i) => `
    <div class="activity-item" style="${i === commentairesEnAttente.length - 1 ? 'border-bottom:none' : ''}" id="cmt-${c.id}">
      <div class="activity-icon" style="background:var(--teal-50);color:var(--teal-600)">
        <i class="fa-solid fa-comment"></i>
      </div>
      <div class="activity-text" style="flex:1">
        <strong>${esc(c.auteur)}</strong> sur l'article #${c.id_conseil}<br>
        <span style="font-size:12.5px;color:var(--text-soft)">"${esc((c.contenu||'').slice(0,200))}"</span>
      </div>
      <div class="cell-actions">
        <button class="btn btn-success btn-sm" onclick="modererCommentaire(${c.id},'approuve')">
          <i class="fa-solid fa-check"></i> Approuver
        </button>
        <button class="btn btn-danger btn-sm" onclick="modererCommentaire(${c.id},'refuse')">
          <i class="fa-solid fa-xmark"></i> Refuser
        </button>
      </div>
    </div>`).join('');
}

window.modererCommentaire = async (id, decision) => {
  try {
    const res = await apiFetch(`/commentaires/${id}/moderer`, {
      method: 'PUT',
      body: JSON.stringify({ decision }),
    });
    if (res?.ok) {
      commentairesEnAttente = commentairesEnAttente.filter(c => c.id !== id);
      renderCommentaires();
      showToast(decision === 'approuve' ? t('sal_toast_commentaire_approuve') : t('sal_toast_commentaire_refuse'), decision === 'approuve' ? 'success' : 'warning');
      return;
    }
    showToast('Erreur', 'error');
  } catch { showToast('Service indisponible', 'error'); }
};

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('moderation');

  await Promise.all([
    apiFetch('/forum/signalements').then(async res => {
      if (res?.ok) { const d = await res.json(); if (Array.isArray(d)) signalements = d; }
    }).catch(() => {}),
    apiFetch('/forum?limit=4').then(async res => {
      if (res?.ok) { const d = await res.json(); if (Array.isArray(d)) messagesRecents = d; }
    }).catch(() => {}),
    apiFetch('/commentaires/en-attente').then(async res => {
      if (res?.ok) { const d = await res.json(); if (Array.isArray(d)) commentairesEnAttente = d; }
    }).catch(() => {}),
  ]);

  renderSignalements();
  renderMessages();
  renderCommentaires();
});
