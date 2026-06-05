package handlers

// stats globales de la plateforme pour le dashboard admin

import (
	"upcycleconnect/api/middleware"
	"encoding/json"
	"net/http"
	"strconv"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
	"upcycleconnect/api/repositories"
)

var statsRepo = repositories.StatsRepository{}

func GetAdminStats(w http.ResponseWriter, r *http.Request) {
	stats, err := statsRepo.Get()
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// score upcycling + historique des 20 dernières actions du particulier
func GetScore(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)

	// Score total depuis la table particulier
	var scoreTotal int
	database.DB.QueryRow(
		`SELECT COALESCE(upcycling_score_total, 0) FROM particulier WHERE id_particulier = ?`, userID,
	).Scan(&scoreTotal)

	// Historique des 20 dernières actions
	rows, err := database.DB.Query(
		`SELECT id_log, points, COALESCE(motif,''), date_action, id_particulier
         FROM score_log WHERE id_particulier = ? ORDER BY date_action DESC LIMIT 20`,
		userID,
	)
	var historique []models.ScoreLog
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s models.ScoreLog
			rows.Scan(&s.ID, &s.Points, &s.Motif, &s.DateAction, &s.IDParticulier)
			historique = append(historique, s)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"score_total": scoreTotal,
		"historique":  historique,
	})
}

// suppression RGPD : on anonymise l'email et on desactive, on ne supprime rien
func SoftDeleteUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	parsed, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	userID := uint(parsed)

	// on prefixe l'email pour eviter les doublons si quelqu'un se reinscrit avec le meme mail
	_, err = database.DB.Exec(
		`UPDATE utilisateur SET actif = 0, email = CONCAT('deleted_', id_utilisateur, '_', email) WHERE id_utilisateur = ?`,
		userID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur lors de l'archivage"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "utilisateur archivé (RGPD)"})
}

// depots en attente de confirmation, pour le panel admin
func ListDepotsEnAttente(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(
		`SELECT d.id_depot, d.statut, d.date_demande, d.id_particulier, d.id_conteneur, d.id_objet,
                COALESCE(d.code_ouverture,''), COALESCE(d.code_barre_retrait,'')
         FROM depot d WHERE d.statut = 'en_attente' ORDER BY d.date_demande ASC`,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var depots []models.Depot
	for rows.Next() {
		var d models.Depot
		rows.Scan(&d.ID, &d.Statut, &d.DateDemande, &d.IDParticulier, &d.IDConteneur, &d.IDObjet,
			&d.CodeOuverture, &d.CodeBarreRetrait)
		depots = append(depots, d)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(depots)
}
