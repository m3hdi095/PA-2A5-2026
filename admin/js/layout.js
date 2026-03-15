// layout.js - Script commun pour toutes les pages admin
const apiBase = 'http://localhost:8000'; // à adapter selon votre serveur

// Vérifier l'authentification (sauf sur la page de login)
if (!window.location.pathname.includes('index.html')) {
    fetch(apiBase + '/me', { credentials: 'include' })
        .then(res => {
            if (!res.ok) window.location.href = 'index.html';
        })
        .catch(() => window.location.href = 'index.html');
}

// Gérer la déconnexion
document.addEventListener('click', (e) => {
    if (e.target.closest('#logout')) {
        e.preventDefault();
        fetch(apiBase + '/logout', { method: 'POST', credentials: 'include' })
            .then(() => window.location.href = 'index.html');
    }
});

// Fonction globale pour les toasts (simple, à améliorer)
function showToast(message, type = 'success') {
    alert(message); // Remplacez par une notification plus élégante
}

// Remplir les infos utilisateur dans la sidebar (si présent)
document.addEventListener('DOMContentLoaded', () => {
    fetch(apiBase + '/me', { credentials: 'include' })
        .then(res => res.json())
        .then(user => {
            const userNameEl = document.getElementById('sidebar-user-name');
            const userRoleEl = document.getElementById('sidebar-user-role');
            if (userNameEl && userRoleEl && user) {
                userNameEl.textContent = user.nom || 'Admin';
                userRoleEl.textContent = user.role || 'Administrateur';
            }
        })
        .catch(() => {});
});