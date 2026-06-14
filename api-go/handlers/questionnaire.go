package handlers

// questionnaire de satisfaction post-événement
// créé par les salariés, répondu par les participants inscrits

import (
	"encoding/json"
	"net/http"
	"strconv"

	"upcycleconnect/api/database"
	"upcycleconnect/api/middleware"
)

func CreateQuestionnaire(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "salarie" && role != "admin" {
		http.Error(w, `{"error":"Réservé aux salariés"}`, http.StatusForbidden)
		return
	}
	salarieID := r.Context().Value(middleware.ContextUserID).(uint)
	eventID, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	var input struct {
		Questions string `json:"questions"` // JSON string [{question, type}]
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Questions == "" {
		http.Error(w, `{"error":"questions manquantes"}`, http.StatusBadRequest)
		return
	}

	result, err := database.DB.Exec(
		`INSERT INTO questionnaire_satisfaction (id_evenement, id_salarie, questions)
		 VALUES (?, ?, ?)
		 ON DUPLICATE KEY UPDATE questions = VALUES(questions), statut = 'brouillon'`,
		eventID, salarieID, input.Questions,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": "brouillon"})
}

func EnvoyerQuestionnaire(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "salarie" && role != "admin" {
		http.Error(w, `{"error":"Réservé aux salariés"}`, http.StatusForbidden)
		return
	}
	qID, err := strconv.ParseUint(r.PathValue("qid"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	database.DB.Exec(
		`UPDATE questionnaire_satisfaction SET statut = 'envoye' WHERE id_questionnaire = ?`, qID,
	)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "envoye"})
}

func GetQuestionnaire(w http.ResponseWriter, r *http.Request) {
	eventID, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	var q struct {
		ID        uint   `json:"id"`
		Questions string `json:"questions"`
		Statut    string `json:"statut"`
	}
	err = database.DB.QueryRow(
		`SELECT id_questionnaire, questions, statut FROM questionnaire_satisfaction WHERE id_evenement = ? AND statut = 'envoye' LIMIT 1`,
		eventID,
	).Scan(&q.ID, &q.Questions, &q.Statut)
	if err != nil {
		http.Error(w, `{"error":"Questionnaire introuvable"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(q)
}

func RepondreQuestionnaire(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	qID, err := strconv.ParseUint(r.PathValue("qid"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	var input struct {
		Reponses string `json:"reponses"` // JSON libre
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Reponses == "" {
		http.Error(w, `{"error":"Réponses manquantes"}`, http.StatusBadRequest)
		return
	}

	_, err = database.DB.Exec(
		`INSERT INTO reponse_satisfaction (id_questionnaire, id_utilisateur, reponses) VALUES (?, ?, ?)
		 ON DUPLICATE KEY UPDATE reponses = VALUES(reponses)`,
		qID, userID, input.Reponses,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func GetReponsesQuestionnaire(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "salarie" && role != "admin" {
		http.Error(w, `{"error":"Réservé aux salariés"}`, http.StatusForbidden)
		return
	}
	qID, err := strconv.ParseUint(r.PathValue("qid"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	rows, err := database.DB.Query(
		`SELECT rs.id_reponse, CONCAT(u.prenom,' ',u.nom), rs.reponses, rs.date_reponse
		 FROM reponse_satisfaction rs
		 JOIN utilisateur u ON u.id_utilisateur = rs.id_utilisateur
		 WHERE rs.id_questionnaire = ?
		 ORDER BY rs.date_reponse ASC`,
		qID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type reponse struct {
		ID          uint   `json:"id"`
		Participant string `json:"participant"`
		Reponses    string `json:"reponses"`
		Date        string `json:"date"`
	}
	var list []reponse
	for rows.Next() {
		var rp reponse
		rows.Scan(&rp.ID, &rp.Participant, &rp.Reponses, &rp.Date)
		list = append(list, rp)
	}
	if list == nil {
		list = []reponse{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}
