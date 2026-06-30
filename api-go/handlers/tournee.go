package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"upcycleconnect/api/database"
	"upcycleconnect/api/middleware"
)

func CreateTournee(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DateTournee string   `json:"date_tournee"`
		Note        string   `json:"note"`
		Conteneurs  []string `json:"conteneurs"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if req.DateTournee == "" {
		http.Error(w, `{"error":"La date est obligatoire"}`, http.StatusBadRequest)
		return
	}
	conteneurs := strings.Join(req.Conteneurs, ",")
	result, err := database.DB.Exec(
		`INSERT INTO tournee (date_tournee, note, conteneurs) VALUES (?, ?, ?)`,
		req.DateTournee, req.Note, conteneurs,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur lors de la création"}`, http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": "tournée planifiée"})
}

func ListTournees(w http.ResponseWriter, r *http.Request) {
	statut := r.URL.Query().Get("statut")
	var rows *sql.Rows
	var err error
	if statut != "" {
		rows, err = database.DB.Query(
			`SELECT id_tournee, date_tournee, COALESCE(note,''), COALESCE(conteneurs,''), statut, date_creation
			 FROM tournee WHERE statut = ? ORDER BY date_tournee DESC LIMIT 50`,
			statut,
		)
	} else {
		rows, err = database.DB.Query(
			`SELECT id_tournee, date_tournee, COALESCE(note,''), COALESCE(conteneurs,''), statut, date_creation
			 FROM tournee ORDER BY date_tournee DESC LIMIT 50`,
		)
	}
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Tournee struct {
		ID          int       `json:"id"`
		Date        string    `json:"date"`
		Note        string    `json:"note"`
		Conteneurs  string    `json:"conteneurs"`
		Statut      string    `json:"statut"`
		DateCreation time.Time `json:"date_creation"`
	}
	var list []Tournee
	for rows.Next() {
		var t Tournee
		var d time.Time
		rows.Scan(&t.ID, &d, &t.Note, &t.Conteneurs, &t.Statut, &t.DateCreation)
		t.Date = d.Format("2006-01-02")
		list = append(list, t)
	}
	if list == nil {
		list = []Tournee{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func GetAlertes(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	rows, err := database.DB.Query(
		`SELECT id_alerte, categorie, type_annonce, rayon, mot_cle, active, date_creation
		 FROM alerte_materiau WHERE id_professionnel = ? AND active = 1 ORDER BY date_creation DESC`,
		userID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Alerte struct {
		ID           int       `json:"id"`
		Categorie    string    `json:"categorie"`
		TypeAnnonce  string    `json:"type_annonce"`
		Rayon        int       `json:"rayon"`
		MotCle       string    `json:"mot_cle"`
		Active       bool      `json:"active"`
		DateCreation time.Time `json:"date_creation"`
	}
	var list []Alerte
	for rows.Next() {
		var a Alerte
		rows.Scan(&a.ID, &a.Categorie, &a.TypeAnnonce, &a.Rayon, &a.MotCle, &a.Active, &a.DateCreation)
		list = append(list, a)
	}
	if list == nil {
		list = []Alerte{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func CreateAlerte(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "professionnel" {
		http.Error(w, `{"error":"Réservé aux professionnels"}`, http.StatusForbidden)
		return
	}
	var req struct {
		Categorie   string `json:"categorie"`
		TypeAnnonce string `json:"type_annonce"`
		Rayon       int    `json:"rayon"`
		MotCle      string `json:"mot_cle"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if req.Rayon == 0 {
		req.Rayon = 10
	}
	result, err := database.DB.Exec(
		`INSERT INTO alerte_materiau (id_professionnel, categorie, type_annonce, rayon, mot_cle) VALUES (?, ?, ?, ?, ?)`,
		userID, req.Categorie, req.TypeAnnonce, req.Rayon, req.MotCle,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur lors de la création"}`, http.StatusInternalServerError)
		return
	}
	id, _ := result.LastInsertId()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "status": "alerte créée"})
}

func DeleteAlerte(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	res, err := database.DB.Exec(
		`UPDATE alerte_materiau SET active = 0 WHERE id_alerte = ? AND id_professionnel = ?`,
		id, userID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		http.Error(w, `{"error":"Alerte introuvable"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
