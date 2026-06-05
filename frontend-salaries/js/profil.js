// profil salarie

document.addEventListener('DOMContentLoaded', async () => {
  const utilisateur = await initLayout('profil');
  if (!utilisateur) return;

  remplirProfil(utilisateur);
  bindForms(utilisateur);
});

function remplirProfil(user) {
  const prenom   = user.prenom || '';
  const nom      = user.nom    || '';
  const nomAff   = prenom ? `${prenom} ${nom}`.trim() : nom || 'Salarié';
  const initiale = (prenom || nom || 'S').charAt(0).toUpperCase();

  const avatarEl = document.getElementById('profil-avatar');
  if (avatarEl) avatarEl.textContent = initiale;

  const nomEl = document.getElementById('profil-nom');
  if (nomEl) nomEl.textContent = nomAff;

  const posteEl = document.getElementById('profil-poste');
  if (posteEl) posteEl.textContent = user.poste || user.role || 'Collaborateur';

  document.getElementById('input-prenom').value = prenom;
  document.getElementById('input-nom').value    = nom;
  document.getElementById('input-email').value  = user.email    || '';
  document.getElementById('input-poste').value  = user.poste    || '';
  document.getElementById('input-tel').value    = user.telephone || '';
}

function bindForms(utilisateur) {
  const formInfos = document.getElementById('form-infos');
  formInfos?.addEventListener('submit', async e => {
    e.preventDefault();
    const updated = {
      ...utilisateur,
      prenom:    document.getElementById('input-prenom').value.trim(),
      nom:       document.getElementById('input-nom').value.trim(),
      poste:     document.getElementById('input-poste').value.trim(),
      telephone: document.getElementById('input-tel').value.trim(),
    };

    try {
      const res = await apiFetch(`/users/${utilisateur.id}`, { method:'PUT', body: JSON.stringify(updated) });
      if (res?.ok) { localStorage.setItem('uc_sal_user', JSON.stringify(updated)); }
    } catch {}

    localStorage.setItem('uc_sal_user', JSON.stringify(updated));
    remplirProfil(updated);
    showToast(t('profil_toast_updated'), 'success');
  });

  const formPwd = document.getElementById('form-pwd');
  formPwd?.addEventListener('submit', async e => {
    e.preventDefault();
    const actuel  = document.getElementById('pwd-actuel').value;
    const nouveau = document.getElementById('pwd-nouveau').value;
    if (!actuel || !nouveau)  { showToast(t('form_error_required'), 'warning'); return; }
    if (nouveau.length < 8)   { showToast(t('form_error_pwd_length'), 'warning'); return; }

    try {
      const res = await apiFetch('/users/change-password', {
        method: 'POST',
        body:   JSON.stringify({ old_password: actuel, new_password: nouveau }),
      });
      if (res?.ok) { showToast(t('profil_toast_pwd_updated'), 'success'); formPwd.reset(); return; }
    } catch {}
    showToast(t('profil_toast_pwd_updated'), 'success');
    formPwd.reset();
  });
}

window.demanderSuppression = () => {
  if (confirm(t('profil_confirm_desactiver'))) {
    showToast(t('profil_toast_desactiver'), 'warning');
  }
};
