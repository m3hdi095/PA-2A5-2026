// planning personnel des salaries
// on ne supprime que les entrees perso, les inscriptions evenement se gerent ailleurs

package handlers

import (
	"upcycleconnect/api/middleware"
	"encoding/json"
	"net/http"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
)

// planning de l'utilisateur connecte, trié par date croissante
func GetMonPlanning(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)

	rows, err := database.DB.Query(
		`SELECT id_planning, COALESCE(titre,''), date_heure, COALESCE(duree_minutes,0),
                COALESCE(type_entree,'personnel'), COALESCE(notes,''), id_utilisateur, id_evenement
         FROM planning
         WHERE id_utilisateur = ?
         ORDER BY date_heure ASC`,
		userID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	entries := make([]models.Planning, 0)
	for rows.Next() {
		var p models.Planning
		rows.Scan(&p.ID, &p.Titre, &p.DateHeure, &p.DureeMinutes,
			&p.TypeEntree, &p.Notes, &p.IDUtilisateur, &p.IDEvenement)
		entries = append(entries, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// entree manuelle dans le planning, les inscriptions evenement se font via evenement.go
func CreatePlanningEntry(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)

	var input models.Planning
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if input.Titre == "" || input.DateHeure.IsZero() {
		http.Error(w, `{"error":"titre et date_heure sont obligatoires"}`, http.StatusBadRequest)
		return
	}
	input.IDUtilisateur = userID
	if input.TypeEntree == "" {
		input.TypeEntree = "personnel"
	}

	result, err := database.DB.Exec(
		`INSERT INTO planning (titre, date_heure, duree_minutes, type_entree, notes, id_utilisateur, id_evenement)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
		input.Titre, input.DateHeure, input.DureeMinutes,
		input.TypeEntree, input.Notes, input.IDUtilisateur, input.IDEvenement,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur lors de la création"}`, http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()
	input.ID = uint(id)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(input)
}

// on delete vraiment ici (pas soft), mais seulement les entrees perso pas les evenements
func DeletePlanningEntry(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	idStr := r.PathValue("id")

	_, err := database.DB.Exec(
		`DELETE FROM planning WHERE id_planning = ? AND id_utilisateur = ? AND type_entree != 'evenement'`,
		idStr, userID,
	)
	if err != nil {
		http.Error(w, `{"error":"Impossible de supprimer"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "supprimé"})
}
