// auth salaries

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('uc_sal_token');
  if (token) { window.location.href = 'dashboard.html'; return; }

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
      const res = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      localStorage.setItem('uc_sal_user', JSON.stringify(data.user || {}));
      window.location.href = 'dashboard.html';
    } catch {
      showError('Service indisponible. Vérifiez votre connexion et réessayez.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Se connecter'; }
    }
  });
});
