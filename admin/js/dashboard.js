const apiBase = 'http://localhost:8000'; // à adapter

async function loadStats() {
    try {
        const res = await fetch(apiBase + '/stats', { credentials: 'include' });
        if (!res.ok) throw new Error('Erreur chargement stats');
        const stats = await res.json();
        // Mettre à jour les statistiques dans le DOM (exemple avec des IDs)
        // Vous devez adapter selon votre HTML
        const statUsers = document.getElementById('stat-users');
        const statCats = document.getElementById('stat-categories');
        const statPrest = document.getElementById('stat-prestations');
        if (statUsers) statUsers.textContent = stats.users;
        if (statCats) statCats.textContent = stats.categories;
        if (statPrest) statPrest.textContent = stats.prestations;
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener('DOMContentLoaded', loadStats);