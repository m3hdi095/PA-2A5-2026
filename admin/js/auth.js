// connexion admin, le JWT va dans localStorage et on vérifie le role avant de rediriger

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btnSubmit = e.target.querySelector('button[type="submit"]');
  const errEl     = document.getElementById('error-message');
  errEl.textContent = '';

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    errEl.textContent = t('auth_error_required');
    return;
  }

  btnSubmit.disabled     = true;
  btnSubmit.textContent  = t('auth_connecting');

  try {
    const res = await fetch(`${apiBase}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || t('auth_error_credentials');
      return;
    }

    // si le role n'est pas admin, on bloque meme si le token est valide
    if (data.role && data.role !== 'admin') {
      errEl.textContent = t('auth_error_admin_only');
      return;
    }

    setToken(data.token);
    if (data.user) localStorage.setItem('uc_admin_user', JSON.stringify(data.user));
    window.location.href = 'dashboard.html';

  } catch {
    errEl.textContent = t('auth_error_unavailable') || 'Service indisponible. Réessayez plus tard.';
  } finally {
    btnSubmit.disabled    = false;
    btnSubmit.innerHTML   = `<i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> ${t('auth_btn_login')}`;
  }
});
