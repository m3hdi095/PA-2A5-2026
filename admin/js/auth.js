const apiBase = 'http://localhost:8000'; // à adapter

// Gestion du formulaire de login (uniquement sur index.html)
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const response = await fetch(apiBase + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (response.ok) {
        window.location.href = 'dashboard.html';
    } else {
        document.getElementById('error-message').innerText = data.error || 'Erreur de connexion';
    }
});