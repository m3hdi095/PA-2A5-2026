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

// tous les messages d'une annonce, avec la verification d'accès
func GetMessagesAnnonce(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	annonceID := uint(id)

	var ownerID uint
	database.DB.QueryRow(`SELECT id_utilisateur FROM annonce WHERE id_annonce = ?`, annonceID).Scan(&ownerID)

	// on check si t'as le droit de voir cette conv (proprio ou participant)
	if userID != ownerID {
		var nb int
		database.DB.QueryRow(`SELECT COUNT(*) FROM message_annonce WHERE id_annonce = ? AND id_expediteur = ?`, annonceID, userID).Scan(&nb)
		if nb == 0 {
			http.Error(w, `{"error":"Accès interdit"}`, http.StatusForbidden)
			return
		}
	}

	// on charge tout le fil dans l'ordre chronologique
	rows, err := database.DB.Query(`
		SELECT m.id, m.id_annonce, m.id_expediteur, m.contenu, m.lu, m.date_envoi,
		       CONCAT(COALESCE(u.prenom,''), ' ', COALESCE(u.nom,''))
		FROM message_annonce m
		LEFT JOIN utilisateur u ON u.id_utilisateur = m.id_expediteur
		WHERE m.id_annonce = ?
		ORDER BY m.date_envoi ASC`, annonceID)
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

	database.DB.Exec(`UPDATE message_annonce SET lu = 1 WHERE id_annonce = ? AND id_expediteur != ?`, annonceID, userID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msgs)
}

// envoyer un message sur une annonce
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

// inbox de l'utilisateur, que ce soit comme vendeur ou acheteur
func MesConversations(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)

	// la requete SQL est un peu longue mais on a pas trouvé plus simple pour les deux rôles en meme temps
	rows, err := database.DB.Query(`
		SELECT
		    a.id_annonce,
		    a.titre,
		    CASE WHEN a.id_utilisateur = ?
		        THEN (SELECT MIN(m2.id_expediteur) FROM message_annonce m2 WHERE m2.id_annonce = a.id_annonce AND m2.id_expediteur != ?)
		        ELSE a.id_utilisateur
		    END AS interloc_id,
		    CASE WHEN a.id_utilisateur = ?
		        THEN (SELECT CONCAT(COALESCE(u2.prenom,''),' ',COALESCE(u2.nom,''))
		              FROM message_annonce m2 JOIN utilisateur u2 ON u2.id_utilisateur = m2.id_expediteur
		              WHERE m2.id_annonce = a.id_annonce AND m2.id_expediteur != ? ORDER BY m2.date_envoi LIMIT 1)
		        ELSE (SELECT CONCAT(COALESCE(u3.prenom,''),' ',COALESCE(u3.nom,'')) FROM utilisateur u3 WHERE u3.id_utilisateur = a.id_utilisateur)
		    END AS interloc_nom,
		    (SELECT m2.contenu FROM message_annonce m2 WHERE m2.id_annonce = a.id_annonce ORDER BY m2.date_envoi DESC LIMIT 1) AS dernier_msg,
		    (SELECT m2.date_envoi FROM message_annonce m2 WHERE m2.id_annonce = a.id_annonce ORDER BY m2.date_envoi DESC LIMIT 1) AS date_dernier,
		    COALESCE((SELECT COUNT(*) FROM message_annonce m2 WHERE m2.id_annonce = a.id_annonce AND m2.lu = 0 AND m2.id_expediteur != ? AND a.id_utilisateur = ?), 0) AS nb_non_lus
		FROM message_annonce m
		JOIN annonce a ON a.id_annonce = m.id_annonce
		WHERE a.id_utilisateur = ? OR m.id_expediteur = ?
		GROUP BY a.id_annonce, a.titre, a.id_utilisateur
		ORDER BY date_dernier DESC`,
		userID, userID, userID, userID, userID, userID, userID, userID)
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

// juste le nombre de messages pas lus, pour le badge dans le menu
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

// toggle favori, on insère ou on supprime selon si c'est déjà en favori
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

// GET /api/annonces/favoris - liste des annonces favorites de l'utilisateur
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
