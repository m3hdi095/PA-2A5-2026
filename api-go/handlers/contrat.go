package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"upcycleconnect/api/database"
	"upcycleconnect/api/middleware"
)

type Contrat struct {
	ID               uint    `json:"id"`
	TypeContrat      string  `json:"type_contrat"`
	DateDebut        string  `json:"date_debut"`
	DateFin          string  `json:"date_fin"`
	Montant          float64 `json:"montant"`
	Statut           string  `json:"statut"`
	FichierPDF       string  `json:"fichier_pdf,omitempty"`
	IDProfessionnel  uint    `json:"id_professionnel"`
	NomEntreprise    string  `json:"nom_entreprise,omitempty"`
}

// les contrats du pro connecté, vu de son côté
func MonContrat(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	rows, err := database.DB.Query(
		`SELECT id_contrat, type_contrat,
		        DATE_FORMAT(date_debut,'%Y-%m-%d'), DATE_FORMAT(date_fin,'%Y-%m-%d'),
		        montant, statut, COALESCE(fichier_pdf,'')
		 FROM contrat WHERE id_professionnel = ?
		 ORDER BY date_debut DESC`, userID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	contrats := make([]Contrat, 0)
	for rows.Next() {
		var c Contrat
		rows.Scan(&c.ID, &c.TypeContrat, &c.DateDebut, &c.DateFin, &c.Montant, &c.Statut, &c.FichierPDF)
		contrats = append(contrats, c)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(contrats)
}

// tous les contrats cote admin, filtrable par statut
func AdminListContrats(w http.ResponseWriter, r *http.Request) {
	statut := r.URL.Query().Get("statut")
	query := `SELECT c.id_contrat, c.type_contrat,
	                 DATE_FORMAT(c.date_debut,'%Y-%m-%d'), DATE_FORMAT(c.date_fin,'%Y-%m-%d'),
	                 c.montant, c.statut, COALESCE(c.fichier_pdf,''), c.id_professionnel,
	                 COALESCE(pr.nom_entreprise, CONCAT(COALESCE(u.prenom,''),' ',COALESCE(u.nom,'')))
	          FROM contrat c
	          LEFT JOIN professionnel pr ON pr.id_professionnel = c.id_professionnel
	          LEFT JOIN utilisateur u ON u.id_utilisateur = c.id_professionnel`
	args := []interface{}{}
	if statut != "" {
		query += " WHERE c.statut = ?"
		args = append(args, statut)
	}
	query += " ORDER BY c.date_debut DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	contrats := make([]Contrat, 0)
	for rows.Next() {
		var c Contrat
		rows.Scan(&c.ID, &c.TypeContrat, &c.DateDebut, &c.DateFin,
			&c.Montant, &c.Statut, &c.FichierPDF, &c.IDProfessionnel, &c.NomEntreprise)
		contrats = append(contrats, c)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(contrats)
}

// l'admin change le statut d'un contrat (actif, termine, resilie)
func AdminUpdateContratStatut(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	var req struct {
		Statut string `json:"statut"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Statut == "" {
		http.Error(w, `{"error":"Statut requis"}`, http.StatusBadRequest)
		return
	}
	_, err = database.DB.Exec(`UPDATE contrat SET statut = ? WHERE id_contrat = ?`, req.Statut, id)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
