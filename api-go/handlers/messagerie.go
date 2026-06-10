package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"upcycleconnect/api/database"
	"upcycleconnect/api/middleware"
)

type MessageAnnonce struct {
	ID           uint      `json:"id"`
	IDAnnonce    uint      `json:"id_annonce"`
	IDExpediteur uint      `json:"id_expediteur"`
	Contenu      string    `json:"contenu"`
	Lu           bool      `json:"lu"`
	DateEnvoi    time.Time `json:"date_envoi"`
	Expediteur   string    `json:"expediteur"`
	IsMine       bool      `json:"is_mine"`
}

type ConversationResume struct {
	AnnonceID    uint      `json:"annonce_id"`
	AnnonceTitre string    `json:"annonce_titre"`
	InterlocID   uint      `json:"interloc_id"`
	InterlocNom  string    `json:"interloc_nom"`
	DernierMsg   string    `json:"dernier_msg"`
	DateDernier  time.Time `json:"date_dernier"`
	NbNonLus     int       `json:"nb_non_lus"`
}

// GET /api/annonces/{id}/messages
func GetMessagesAnnonce(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	annonceID := uint(id)

	// vérifier que l'utilisateur est soit propriétaire soit a envoyé un message
	var ownerID uint
	database.DB.QueryRow(`SELECT id_utilisateur FROM annonce WHERE id_annonce = ?`, annonceID).Scan(&ownerID)

	rows, err := database.DB.Query(`
		SELECT m.id, m.id_annonce, m.id_expediteur, m.contenu, m.lu, m.date_envoi,
		       CONCAT(COALESCE(u.prenom,''), ' ', COALESCE(u.nom,''))
		FROM message_annonce m
		LEFT JOIN utilisateur u ON u.id_utilisateur = m.id_expediteur
		WHERE m.id_annonce = ?
		  AND (? = ? OR m.id_expediteur = ?)
		ORDER BY m.date_envoi ASC`, annonceID, userID, ownerID, userID)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	msgs := make([]MessageAnnonce, 0)
	for rows.Next() {
		var m MessageAnnonce
		rows.Scan(&m.ID, &m.IDAnnonce, &m.IDExpediteur, &m.Contenu, &m.Lu, &m.DateEnvoi, &m.Expediteur)
		m.IsMine = m.IDExpediteur == userID
		msgs = append(msgs, m)
	}

	// marquer les messages non-lus comme lus pour l'utilisateur courant
	if userID == ownerID {
		database.DB.Exec(`UPDATE message_annonce SET lu = 1 WHERE id_annonce = ? AND id_expediteur != ?`, annonceID, userID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msgs)
}

// POST /api/annonces/{id}/messages
func SendMessageAnnonce(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	annonceID := uint(id)

	var req struct {
		Contenu string `json:"contenu"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Contenu == "" {
		http.Error(w, `{"error":"Message vide"}`, http.StatusBadRequest)
		return
	}

	// vérifier que l'annonce existe et est disponible
	var ownerID uint
	var statut string
	err2 := database.DB.QueryRow(`SELECT id_utilisateur, statut FROM annonce WHERE id_annonce = ?`, annonceID).Scan(&ownerID, &statut)
	if err2 != nil || (statut != "validee" && statut != "desactivee") {
		jsonError(w, "annonce introuvable", http.StatusNotFound)
		return
	}

	res, dbErr := database.DB.Exec(
		`INSERT INTO message_annonce (id_annonce, id_expediteur, contenu) VALUES (?, ?, ?)`,
		annonceID, userID, req.Contenu,
	)
	if dbErr != nil {
		jsonError(w, "erreur lors de l'envoi", http.StatusInternalServerError)
		return
	}
	newID, _ := res.LastInsertId()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": newID, "status": "envoyé"})
}

// GET /api/annonces/mes-conversations  — inbox pour les propriétaires d'annonces
func MesConversations(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)

	rows, err := database.DB.Query(`
		SELECT a.id_annonce, a.titre,
		       m.id_expediteur,
		       CONCAT(COALESCE(u.prenom,''), ' ', COALESCE(u.nom,'')),
		       m.contenu, m.date_envoi,
		       SUM(CASE WHEN m.lu = 0 AND m.id_expediteur != ? THEN 1 ELSE 0 END)
		FROM message_annonce m
		JOIN annonce a ON a.id_annonce = m.id_annonce AND a.id_utilisateur = ?
		JOIN utilisateur u ON u.id_utilisateur = m.id_expediteur
		WHERE m.id_expediteur != ?
		GROUP BY a.id_annonce, a.titre, m.id_expediteur, u.prenom, u.nom,
		         m.contenu, m.date_envoi
		ORDER BY m.date_envoi DESC`, userID, userID, userID)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	convs := make([]ConversationResume, 0)
	for rows.Next() {
		var c ConversationResume
		rows.Scan(&c.AnnonceID, &c.AnnonceTitre, &c.InterlocID, &c.InterlocNom, &c.DernierMsg, &c.DateDernier, &c.NbNonLus)
		convs = append(convs, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(convs)
}

// GET /api/annonces/mes-conversations/count  — nb total de messages non-lus
func CountMessagesNonLus(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	var count int
	database.DB.QueryRow(`
		SELECT COUNT(*) FROM message_annonce m
		JOIN annonce a ON a.id_annonce = m.id_annonce AND a.id_utilisateur = ?
		WHERE m.lu = 0 AND m.id_expediteur != ?`, userID, userID).Scan(&count)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"count": count})
}

// POST /api/annonces/{id}/favori  — toggle favori, retourne l'état
func ToggleFavori(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	annonceID := uint(id)

	var existingID uint
	database.DB.QueryRow(`SELECT id FROM favori_annonce WHERE id_utilisateur = ? AND id_annonce = ?`, userID, annonceID).Scan(&existingID)

	if existingID > 0 {
		database.DB.Exec(`DELETE FROM favori_annonce WHERE id = ?`, existingID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"favori": false})
	} else {
		database.DB.Exec(`INSERT INTO favori_annonce (id_utilisateur, id_annonce) VALUES (?, ?)`, userID, annonceID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"favori": true})
	}
}

// GET /api/annonces/favoris  — liste des annonces favorites de l'utilisateur
func GetFavoris(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)

	rows, err := database.DB.Query(`
		SELECT a.id_annonce, a.titre, a.description, a.type_annonce, a.prix, a.statut,
		       COALESCE(c.nom,''), CONCAT(COALESCE(u.prenom,''), ' ', COALESCE(u.nom,'')), COALESCE(u.ville,'')
		FROM favori_annonce f
		JOIN annonce a ON a.id_annonce = f.id_annonce
		LEFT JOIN objet o ON a.id_objet = o.id_objet
		LEFT JOIN categorie c ON o.categorie_id = c.id_categorie
		LEFT JOIN utilisateur u ON u.id_utilisateur = a.id_utilisateur
		WHERE f.id_utilisateur = ?
		ORDER BY f.date_ajout DESC`, userID)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type AnnonceFavori struct {
		ID           uint    `json:"id"`
		Titre        string  `json:"titre"`
		Description  string  `json:"description"`
		TypeAnnonce  string  `json:"type_annonce"`
		Prix         float64 `json:"prix"`
		Statut       string  `json:"statut"`
		Categorie    string  `json:"categorie,omitempty"`
		Auteur       string  `json:"auteur,omitempty"`
		Localisation string  `json:"localisation,omitempty"`
		EstFavori    bool    `json:"est_favori"`
	}
	favoris := make([]AnnonceFavori, 0)
	for rows.Next() {
		var a AnnonceFavori
		rows.Scan(&a.ID, &a.Titre, &a.Description, &a.TypeAnnonce, &a.Prix, &a.Statut, &a.Categorie, &a.Auteur, &a.Localisation)
		a.EstFavori = true
		favoris = append(favoris, a)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(favoris)
}
