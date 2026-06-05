// connexion et inscription prestataires

document.addEventListener('DOMContentLoaded', async () => {
  await chargerTraductions();

  // si déjà connecté, pas besoin de rester sur le login
  const token = getToken();
  if (token) {
    window.location.href = 'dashboard.html';
    return;
  }

  const formLogin     = document.getElementById('form-login');
  const formRegister  = document.getElementById('form-register');
  const sectionLogin  = document.getElementById('section-login');
  const sectionReg    = document.getElementById('section-register');
  const toggleToReg   = document.getElementById('toggle-to-register');
  const toggleToLog   = document.getElementById('toggle-to-login');

  // Toggle entre connexion et inscription
  toggleToReg?.addEventListener('click', (e) => {
    e.preventDefault();
    sectionLogin.classList.add('hidden');
    sectionReg.classList.remove('hidden');
    document.getElementById('login-form-title').textContent = t('register_title');
    document.getElementById('login-form-subtitle').textContent = t('register_subtitle');
  });

  toggleToLog?.addEventListener('click', (e) => {
    e.preventDefault();
    sectionReg.classList.add('hidden');
    sectionLogin.classList.remove('hidden');
    document.getElementById('login-form-title').textContent = t('login_title');
    document.getElementById('login-form-subtitle').textContent = t('login_subtitle');
  });

  // Soumission connexion
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showToastLogin('Veuillez remplir tous les champs', 'error');
      return;
    }

    const btn = formLogin.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Connexion...';

    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      if (!res) throw new Error('Réseau indisponible');

      const data = await res.json();

      if (!res.ok) {
        showToastLogin(data.message || t('toast_login_error'), 'error');
        return;
      }

      if (data.user?.role !== 'professionnel' && data.user?.role !== 'admin') {
        showToastLogin('Ce compte n\'est pas un compte professionnel', 'error');
        return;
      }

      setToken(data.token || data.access_token);
      localStorage.setItem('uc_pro_user', JSON.stringify(data.user || {}));
      showToastLogin(t('toast_login_ok'), 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);

    } catch (err) {
      console.warn('Erreur login:', err.message);
      showToastLogin('Service indisponible. Vérifiez votre connexion et réessayez.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = t('btn_login');
    }
  });

  // Soumission inscription
  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nom       = document.getElementById('reg-nom').value.trim();
    const email     = document.getElementById('reg-email').value.trim();
    const entreprise = document.getElementById('reg-entreprise').value.trim();
    const siret     = document.getElementById('reg-siret').value.trim();
    const password  = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;

    if (!nom || !email || !password) {
      showToastLogin('Veuillez remplir les champs obligatoires', 'error');
      return;
    }

    if (password !== password2) {
      showToastLogin('Les mots de passe ne correspondent pas', 'error');
      return;
    }

    if (password.length < 8) {
      showToastLogin('Le mot de passe doit contenir au moins 8 caractères', 'error');
      return;
    }

    const btn = formRegister.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Création...';

    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nom, email, password, entreprise, siret, role: 'professionnel' }),
      });

      const data = res ? await res.json() : null;

      if (!res?.ok) {
        showToastLogin(data?.message || 'Erreur lors de la création du compte', 'error');
        return;
      }

      showToastLogin(t('toast_register_ok'), 'success');
      // Revenir au formulaire de connexion après succès
      setTimeout(() => {
        toggleToLog?.click();
        document.getElementById('login-email').value = email;
      }, 1500);

    } catch {
      showToastLogin('Service indisponible. Vérifiez votre connexion et réessayez.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = t('btn_register');
    }
  });

  // Compteur de force du mot de passe
  document.getElementById('reg-password')?.addEventListener('input', (e) => {
    const val = e.target.value;
    const force = calculerForce(val);
    const indicateur = document.getElementById('password-strength');
    if (indicateur) {
      indicateur.style.width = `${force}%`;
      indicateur.style.background = force < 33 ? '#c0392b' : force < 66 ? '#c67c28' : '#2D664F';
    }
  });
});

function calculerForce(pwd) {
  let score = 0;
  if (pwd.length >= 8)  score += 25;
  if (pwd.length >= 12) score += 15;
  if (/[A-Z]/.test(pwd)) score += 20;
  if (/[0-9]/.test(pwd)) score += 20;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 20;
  return Math.min(score, 100);
}

function showToastLogin(message, type = 'success') {
  let toast = document.getElementById('toast-login');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-login';
    toast.className = 'toast-notif';
    document.body.appendChild(toast);
  }
  const icones = { success:'fa-circle-check', error:'fa-circle-xmark', warning:'fa-triangle-exclamation', info:'fa-circle-info' };
  toast.className = `toast-notif toast-${type} visible`;
  toast.innerHTML = `<i class="fa-solid ${icones[type]}" aria-hidden="true"></i> ${message}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('visible'), 3500);
}
