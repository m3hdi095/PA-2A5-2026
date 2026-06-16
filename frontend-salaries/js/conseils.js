// gestion des conseils

let _quill = null;

const CAT_COLORS = {
  technique: { bg:'var(--green-50)',  txt:'var(--green-700)' },
  projets:   { bg:'#e8f5ee',          txt:'#2e8b57' },
  materiaux: { bg:'#fef3e2',          txt:'#e8a020' },
  outils:    { bg:'#e8f0fe',          txt:'#3f51b5' },
};

let conseils = [];

async function fetchConseils() {
  try {
    const res = await apiFetch('/conseils/mes-articles');
    if (res?.ok) {
      const data = await res.json();
      conseils = Array.isArray(data) ? data : [];
    }
  } catch {}
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('conseils-tbody');
  if (!tbody) return;
  if (!conseils.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fa-solid fa-lightbulb" style="font-size:28px;color:var(--green-200);display:block;margin-bottom:10px"></i>${t('sal_conseils_empty')}</div></td></tr>`;
    return;
  }
  tbody.innerHTML = conseils.map(c => {
    const cc = CAT_COLORS[c.categorie] || CAT_COLORS.technique;
    const statBadge = c.statut === 'publie'
      ? `<span class="badge badge-success">${t('sal_badge_publie')}</span>`
      : `<span class="badge badge-warning">${t('sal_badge_brouillon')}</span>`;
    return `<tr>
      <td style="font-weight:600">${esc(c.titre)}</td>
      <td><span class="badge" style="background:${cc.bg};color:${cc.txt}">${esc(c.categorie)}</span></td>
      <td>${new Date(c.date).toLocaleDateString(_lang === 'en' ? 'en-GB' : 'fr-FR',{day:'numeric',month:'short',year:'numeric'})}</td>
      <td><i class="fa-regular fa-heart" style="color:var(--danger)"></i> ${c.likes || 0}</td>
      <td>${statBadge}</td>
      <td>
        <div class="cell-actions">
          <button class="btn btn-outline btn-sm" onclick="ouvrirModalConseil(${c.id})" title="Modifier">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="toggleStatut(${c.id})" title="${c.statut==='publie'?'Dépublier':'Publier'}" style="color:var(--green-700)">
            <i class="fa-solid ${c.statut==='publie'?'fa-eye-slash':'fa-eye'}"></i>
          </button>
          <button class="btn btn-ghost btn-sm" onclick="supprimerConseil(${c.id})" title="Supprimer" style="color:var(--danger)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const badge = document.getElementById('badge-count');
  if (badge) badge.textContent = conseils.filter(c => c.statut === 'publie').length + ' publiés';
}

function ouvrirModalConseil(id) {
  const modal = document.getElementById('modal-conseil');
  const form  = document.getElementById('form-conseil');
  form.reset();
  document.getElementById('c-id').value = '';
  if (_quill) _quill.setText('');

  if (id) {
    const c = conseils.find(x => x.id === id);
    if (!c) return;
    document.getElementById('modal-titre-label').innerHTML = '<i class="fa-solid fa-pen"></i> Modifier le conseil';
    document.getElementById('c-id').value        = c.id;
    document.getElementById('c-titre').value     = c.titre;
    document.getElementById('c-categorie').value = c.categorie;
    document.getElementById('c-statut').value    = c.statut;
    if (_quill) _quill.clipboard.dangerouslyPasteHTML(c.contenu || '');
  } else {
    document.getElementById('modal-titre-label').innerHTML = '<i class="fa-solid fa-plus"></i> Nouveau conseil';
  }
  modal.classList.add('open');
}

function fermerModalConseil() {
  document.getElementById('modal-conseil').classList.remove('open');
  if (_quill) _quill.setText('');
}

window.ouvrirModalConseil = ouvrirModalConseil;
window.toggleStatut = async (id) => {
  const c = conseils.find(x => x.id === id);
  if (!c) return;
  const nouveauStatut = c.statut === 'publie' ? 'brouillon' : 'publie';
  try {
    const res = await apiFetch(`/conseils/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ titre: c.titre, contenu: c.contenu || '', categorie: c.categorie, statut: nouveauStatut }),
    });
    if (res?.ok) {
      c.statut = nouveauStatut;
      renderTable();
      showToast(nouveauStatut === 'publie' ? t('sal_toast_conseil_publie') : t('sal_toast_conseil_depublie'), 'success');
      return;
    }
    const err = res ? await res.json().catch(() => ({})) : {};
    showToast(err.error || t('toast_error'), 'error');
  } catch {
    showToast(t('toast_error'), 'error');
  }
};
window.supprimerConseil = async (id) => {
  if (!confirm(t('confirm_action'))) return;
  try {
    const res = await apiFetch(`/conseils/${id}`, { method: 'DELETE' });
    if (res?.ok) {
      conseils = conseils.filter(c => c.id !== id);
      renderTable();
      showToast(t('sal_toast_conseil_deleted'), 'warning');
      return;
    }
    const err = res ? await res.json().catch(() => ({})) : {};
    showToast(err.error || t('toast_error'), 'error');
  } catch {
    showToast(t('toast_error'), 'error');
  }
};

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.addEventListener('DOMContentLoaded', async () => {
  await initLayout('conseils');

  _quill = new Quill('#quill-editor', {
    theme: 'snow',
    placeholder: 'Rédigez votre conseil...',
    modules: {
      toolbar: [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
      ],
    },
  });

  fetchConseils();

  document.getElementById('btn-nouveau')?.addEventListener('click', () => ouvrirModalConseil(null));
  document.getElementById('modal-close')?.addEventListener('click', fermerModalConseil);
  document.getElementById('modal-cancel')?.addEventListener('click', fermerModalConseil);
  document.getElementById('modal-conseil')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-conseil')) fermerModalConseil();
  });

  document.getElementById('form-conseil')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id   = document.getElementById('c-id').value;
    const rawHtml = _quill ? _quill.root.innerHTML : '';
    const data = {
      titre:     document.getElementById('c-titre').value.trim(),
      categorie: document.getElementById('c-categorie').value,
      statut:    document.getElementById('c-statut').value,
      contenu:   rawHtml === '<p><br></p>' ? '' : rawHtml,
    };
    if (!data.titre) { showToast('Le titre est obligatoire', 'warning'); return; }

    try {
      const res = await apiFetch(id ? `/conseils/${id}` : '/conseils', {
        method: id ? 'PUT' : 'POST',
        body:   JSON.stringify(data),
      });
      if (res?.ok) { showToast(id ? 'Conseil mis à jour' : 'Conseil créé', 'success'); fermerModalConseil(); fetchConseils(); return; }
      const err = res ? await res.json().catch(() => ({})) : {};
      showToast(err.error || 'Erreur lors de l\'enregistrement', 'error');
    } catch {
      showToast('Service indisponible. Réessayez.', 'error');
    }
  });
});
