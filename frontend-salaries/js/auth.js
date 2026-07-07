// auth salaries

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('uc_sal_token');
  if (token) { window.location.href = 'dashboard.html'; return; }

  // message de confirmation après activation par lien email
  if (new URLSearchParams(window.location.search).get('verified') === '1') {
    const banner = document.getElementById('auth-error') || document.createElement('p');
    banner.id = 'auth-error';
    banner.textContent = 'Compte activé avec succès. Vous pouvez vous connecter.';
    banner.style.cssText = 'background:#e6f4ea;color:#2d4a3e;padding:10px 14px;border-radius:8px;margin-bottom:12px;font-size:.9rem;';
    document.getElementById('form-login')?.prepend(banner);
  }

  const formLogin    = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const toRegister   = document.getElementById('to-register');
  const toLogin      = document.getElementById('to-login');
  const secLogin     = document.getElementById('section-login');
  const secReg       = document.getElementById('section-register');

  toRegister?.addEventListener('click', () => { secLogin.style.display='none'; secReg.style.display='block'; });
  toLogin?.addEventListener('click',    () => { secReg.style.display='none'; secLogin.style.display='block'; });

  function showError(msg) {
    let el = document.getElementById('auth-error');
    if (!el) {
      el = document.createElement('p');
      el.id = 'auth-error';
      el.style.cssText = 'color:#c0392b;margin-top:.5rem;font-size:.9rem;';
      formLogin?.appendChild(el);
    }
    el.textContent = msg;
  }

  formLogin?.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    if (!email || !password) { showError('Veuillez remplir tous les champs.'); return; }

    const btn = formLogin.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Connexion...'; }

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Identifiants incorrects.');
        return;
      }
      if (data.user?.role !== 'salarie' && data.user?.role !== 'admin') {
        showError('Cet espace est réservé aux salariés.');
        localStorage.removeItem('uc_sal_token');
        return;
      }
      localStorage.setItem('uc_sal_token', data.token || data.access_token);
      if (data.csrf_token) localStorage.setItem('uc_sal_csrf', data.csrf_token);
      localStorage.setItem('uc_sal_user', JSON.stringify(data.user || {}));
      window.location.href = 'dashboard.html';
    } catch {
      showError('Service indisponible. Vérifiez votre connexion et réessayez.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Se connecter'; }
    }
  });
});
