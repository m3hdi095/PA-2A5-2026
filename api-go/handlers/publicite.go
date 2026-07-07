package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"upcycleconnect/api/database"
	"upcycleconnect/api/middleware"
)

type Publicite struct {
	ID               uint       `json:"id"`
	Titre            string     `json:"titre"`
	TypePub          string     `json:"type_pub"`
	BudgetMensuel    float64    `json:"budget_mensuel"`
	DateDebut        string     `json:"date_debut"`
	DateFin          string     `json:"date_fin"`
	Statut           string     `json:"statut"`
	IDProfessionnel  uint       `json:"id_professionnel"`
	NomEntreprise    string     `json:"nom_entreprise,omitempty"`
	CreatedAt        *time.Time `json:"created_at,omitempty"`
}

// toutes les pubs, filtrable par statut
func ListPublicites(w http.ResponseWriter, r *http.Request) {
	statut := r.URL.Query().Get("statut")

	query := `
		SELECT p.id_pub, p.titre, p.type_pub,
		       COALESCE(p.budget_mensuel, 0),
		       DATE_FORMAT(p.date_debut,'%Y-%m-%d'),
		       DATE_FORMAT(p.date_fin,'%Y-%m-%d'),
		       p.statut, p.id_professionnel,
		       COALESCE(pr.nom_entreprise, CONCAT(COALESCE(u.prenom,''),' ',COALESCE(u.nom,'')))
		FROM publicite p
		LEFT JOIN professionnel pr ON pr.id_professionnel = p.id_professionnel
		LEFT JOIN utilisateur u ON u.id_utilisateur = p.id_professionnel`

	var args []interface{}
	if statut != "" {
		query += ` WHERE p.statut = ?`
		args = append(args, statut)
	}
	query += ` ORDER BY p.date_debut DESC`

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	pubs := make([]Publicite, 0)
	for rows.Next() {
		var p Publicite
		rows.Scan(&p.ID, &p.Titre, &p.TypePub, &p.BudgetMensuel,
			&p.DateDebut, &p.DateFin, &p.Statut, &p.IDProfessionnel, &p.NomEntreprise)
		pubs = append(pubs, p)
	}

	var stats struct {
		TotalActif    int     `json:"total_actif"`
		TotalEnAttente int    `json:"total_en_attente"`
		RevenuMensuel float64 `json:"revenu_mensuel"`
	}
	database.DB.QueryRow(`SELECT COUNT(*) FROM publicite WHERE statut='actif'`).Scan(&stats.TotalActif)
	database.DB.QueryRow(`SELECT COUNT(*) FROM publicite WHERE date_debut > CURDATE() AND statut != 'refuse'`).Scan(&stats.TotalEnAttente)
	database.DB.QueryRow(`SELECT COALESCE(SUM(budget_mensuel),0) FROM publicite WHERE statut='actif'`).Scan(&stats.RevenuMensuel)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"publicites": pubs,
		"stats":      stats,
	})
}

// l'admin crée une pub directement, sans passer par une demande
func CreatePublicite(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Titre           string  `json:"titre"`
		TypePub         string  `json:"type_pub"`
		BudgetMensuel   float64 `json:"budget_mensuel"`
		DateDebut       string  `json:"date_debut"`
		DateFin         string  `json:"date_fin"`
		IDProfessionnel uint    `json:"id_professionnel"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Titre == "" {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	adminID := r.Context().Value(middleware.ContextUserID).(uint)
	res, err := database.DB.Exec(
		`INSERT INTO publicite (titre, type_pub, budget_mensuel, date_debut, date_fin, statut, id_professionnel, id_admin_validation)
		 VALUES (?, ?, ?, ?, ?, 'actif', ?, ?)`,
		input.Titre, input.TypePub, input.BudgetMensuel,
		input.DateDebut, input.DateFin, input.IDProfessionnel, adminID,
	)
	if err != nil {
		jsonError(w, "Erreur création", http.StatusInternalServerError)
		return
	}
	id, _ := res.LastInsertId()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": "ok"})
}

// pour passer une pub de actif à expire ou refuse
func UpdatePubliciteStatut(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	var req struct {
		Statut string `json:"statut"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	valid := map[string]bool{"actif": true, "expire": true, "refuse": true}
	if !valid[req.Statut] {
		jsonError(w, "statut invalide", http.StatusBadRequest)
		return
	}
	database.DB.Exec(`UPDATE publicite SET statut = ? WHERE id_pub = ?`, req.Statut, id)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// suppression directe, pas de soft delete ici contrairement aux annonces
func DeletePublicite(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	database.DB.Exec(`DELETE FROM publicite WHERE id_pub = ?`, id)
	w.WriteHeader(http.StatusNoContent)
}

// le pro envoie une demande de campagne, l'admin verra ca de son côté
func DemanderPublicite(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	var req struct {
		Titre         string  `json:"titre"`
		TypePub       string  `json:"type_pub"`
		BudgetMensuel float64 `json:"budget_mensuel"`
		DateDebut     string  `json:"date_debut"`
		DateFin       string  `json:"date_fin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if req.Titre == "" || req.DateDebut == "" || req.DateFin == "" {
		http.Error(w, `{"error":"Titre et dates sont obligatoires"}`, http.StatusBadRequest)
		return
	}
	if req.TypePub == "" {
		req.TypePub = "banniere"
	}
	result, err := database.DB.Exec(
		`INSERT INTO publicite (titre, type_pub, budget_mensuel, date_debut, date_fin, statut, id_professionnel)
		 VALUES (?, ?, ?, ?, ?, 'actif', ?)`,
		req.Titre, req.TypePub, req.BudgetMensuel, req.DateDebut, req.DateFin, userID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur lors de la création"}`, http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": "demande enregistrée"})
}

// les campagnes du pro connecté, pour qu'il voie ce qu'il a soumis
func MesCampagnes(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	rows, err := database.DB.Query(
		`SELECT id_pub, titre, type_pub, COALESCE(budget_mensuel,0),
		        DATE_FORMAT(date_debut,'%Y-%m-%d'), DATE_FORMAT(date_fin,'%Y-%m-%d'), statut
		 FROM publicite WHERE id_professionnel = ? ORDER BY date_debut DESC`, userID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	pubs := make([]Publicite, 0)
	for rows.Next() {
		var p Publicite
		rows.Scan(&p.ID, &p.Titre, &p.TypePub, &p.BudgetMensuel, &p.DateDebut, &p.DateFin, &p.Statut)
		pubs = append(pubs, p)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pubs)
}
