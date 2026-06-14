package handlers

// commentaires sur les articles de conseils
// soumis en attente, les salariés/admin modèrent avant publication

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"upcycleconnect/api/database"
	"upcycleconnect/api/middleware"
)

type commentaireConseil struct {
	ID            uint      `json:"id"`
	IDConseil     uint      `json:"id_conseil"`
	IDUtilisateur uint      `json:"id_utilisateur"`
	Auteur        string    `json:"auteur"`
	Contenu       string    `json:"contenu"`
	Statut        string    `json:"statut"`
	DateEnvoi     time.Time `json:"date_envoi"`
}

func ListCommentairesConseil(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	conseilID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	// seuls les approuvés sont visibles publiquement
	// les salariés/admin voient tous les statuts via le query param ?all=1
	all := r.URL.Query().Get("all") == "1"
	role, _ := r.Context().Value(middleware.ContextRole).(string)
	showAll := all && (role == "admin" || role == "salarie")

	query := `SELECT c.id_commentaire, c.id_conseil, c.id_utilisateur,
	                 CONCAT(u.prenom,' ',u.nom), c.contenu, c.statut, c.date_envoi
	          FROM commentaire_conseil c
	          JOIN utilisateur u ON u.id_utilisateur = c.id_utilisateur
	          WHERE c.id_conseil = ?`
	if !showAll {
		query += ` AND c.statut = 'approuve'`
	}
	query += ` ORDER BY c.date_envoi ASC`

	rows, err := database.DB.Query(query, conseilID)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var list []commentaireConseil
	for rows.Next() {
		var c commentaireConseil
		rows.Scan(&c.ID, &c.IDConseil, &c.IDUtilisateur, &c.Auteur, &c.Contenu, &c.Statut, &c.DateEnvoi)
		list = append(list, c)
	}
	if list == nil {
		list = []commentaireConseil{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func CreateCommentaireConseil(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	idStr := r.PathValue("id")
	conseilID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	var input struct {
		Contenu string `json:"contenu"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Contenu == "" {
		http.Error(w, `{"error":"Contenu vide"}`, http.StatusBadRequest)
		return
	}
	if len(input.Contenu) > 2000 {
		http.Error(w, `{"error":"Commentaire trop long (max 2000 caractères)"}`, http.StatusBadRequest)
		return
	}

	result, err := database.DB.Exec(
		`INSERT INTO commentaire_conseil (id_conseil, id_utilisateur, contenu) VALUES (?, ?, ?)`,
		conseilID, userID, input.Contenu,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":     id,
		"statut": "en_attente",
		"msg":    "Commentaire soumis à modération",
	})
}

func ListCommentairesEnAttente(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "admin" && role != "salarie" {
		http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
		return
	}

	rows, err := database.DB.Query(
		`SELECT c.id_commentaire, c.id_conseil, c.id_utilisateur,
		        CONCAT(u.prenom,' ',u.nom), c.contenu, c.statut, c.date_envoi
		 FROM commentaire_conseil c
		 JOIN utilisateur u ON u.id_utilisateur = c.id_utilisateur
		 WHERE c.statut = 'en_attente'
		 ORDER BY c.date_envoi ASC`,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var list []commentaireConseil
	for rows.Next() {
		var c commentaireConseil
		rows.Scan(&c.ID, &c.IDConseil, &c.IDUtilisateur, &c.Auteur, &c.Contenu, &c.Statut, &c.DateEnvoi)
		list = append(list, c)
	}
	if list == nil {
		list = []commentaireConseil{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func ModererCommentaire(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "admin" && role != "salarie" {
		http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
		return
	}

	idStr := r.PathValue("id")
	commentaireID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}

	var input struct {
		Decision string `json:"decision"` // approuve ou refuse
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if input.Decision != "approuve" && input.Decision != "refuse" {
		http.Error(w, `{"error":"Décision invalide"}`, http.StatusBadRequest)
		return
	}

	database.DB.Exec(
		`UPDATE commentaire_conseil SET statut = ? WHERE id_commentaire = ?`,
		input.Decision, commentaireID,
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
