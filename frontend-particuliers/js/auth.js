// auth espace particuliers

const API_BASE = 'http://localhost:8080/api';

async function loginApi(email, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Identifiants incorrects');
  const data = await res.json();
  if (!data.access_token && !data.token) throw new Error('Token manquant');
  return data;
}

async function registerApi(payload) {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, role: 'particulier' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erreur lors de l\'inscription');
  }
  return res.json();
}


document.addEventListener('DOMContentLoaded', () => {
  const formLogin    = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const sectionLogin = document.getElementById('section-login');
  const sectionReg   = document.getElementById('section-register');
  const toRegister   = document.getElementById('to-register');
  const toLogin      = document.getElementById('to-login');
  const errorEl      = document.getElementById('auth-error');

  const errorRegEl = document.getElementById('auth-error-reg');

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.add('visible');
  }
  function showRegError(msg) {
    if (!errorRegEl) return;
    errorRegEl.textContent = msg;
    errorRegEl.classList.add('visible');
  }
  function clearError() {
    errorEl?.classList.remove('visible');
    errorRegEl?.classList.remove('visible');
  }

  toRegister?.addEventListener('click', () => {
    sectionLogin?.classList.remove('active');
    sectionReg?.classList.add('active');
    clearError();
  });
  toLogin?.addEventListener('click', () => {
    sectionReg?.classList.remove('active');
    sectionLogin?.classList.add('active');
    clearError();
  });

  formLogin?.addEventListener('submit', async e => {
    e.preventDefault();
    clearError();
    const email    = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    if (!email || !password) { showError('Veuillez remplir tous les champs.'); return; }

    const btn = formLogin.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Connexion...'; }

    try {
      const data = await loginApi(email, password);
      const token = data.access_token || data.token;
      localStorage.setItem('uc_part_token', token);
      if (data.user) localStorage.setItem('uc_part_user', JSON.stringify(data.user));
      if (data.user && data.user.role !== 'particulier' && data.user.role !== 'admin') {
        clearError();
        showError('Cet espace est réservé aux particuliers. Connectez-vous sur l\'espace professionnel.');
        localStorage.removeItem('uc_part_token');
        return;
      }
      window.location.href = 'dashboard.html';
    } catch {
      showError('Identifiants incorrects ou service indisponible. Réessayez.');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Se connecter'; }
    }
  });

  formRegister?.addEventListener('submit', async e => {
    e.preventDefault();
    clearError();
    const prenom   = document.getElementById('reg-prenom')?.value.trim();
    const nom      = document.getElementById('reg-nom')?.value.trim();
    const email    = document.getElementById('reg-email')?.value.trim();
    const password = document.getElementById('reg-password')?.value;
    if (!prenom || !nom || !email || !password) { showRegError('Veuillez remplir tous les champs.'); return; }
    if (password.length < 8) { showRegError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (!/[A-Z]/.test(password)) { showRegError('Le mot de passe doit contenir au moins une majuscule.'); return; }
    if (!/[0-9]/.test(password)) { showRegError('Le mot de passe doit contenir au moins un chiffre.'); return; }

    const btn = formRegister.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Inscription...'; }

    try {
      await registerApi({ prenom, nom, email, password });
      const data = await loginApi(email, password);
      localStorage.setItem('uc_part_token', data.access_token || data.token);
      if (data.user) localStorage.setItem('uc_part_user', JSON.stringify(data.user));
      window.location.href = 'dashboard.html';
    } catch(err) {
      showRegError(err.message || 'Erreur lors de l\'inscription. Vérifiez votre connexion et réessayez.');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus" aria-hidden="true"></i> Créer mon compte'; }
    }
  });
});
