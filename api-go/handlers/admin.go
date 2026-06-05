package handlers

// routes admin pour la gestion des utilisateurs
// on verifie le role deux fois (middleware + ici), ca semble redondant mais si on se plante dans le cablage des routes ca protege quand meme

import (
	"encoding/json"
	"net/http"
	"strconv"

	"upcycleconnect/api/database"
	"upcycleconnect/api/repositories"
)

// userRepo partagé pour les routes admin
var adminUserRepo = repositories.UserRepository{}

func ListUsers(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	users, err := adminUserRepo.ListAll(20, (page-1)*20)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func ActivateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID uint `json:"user_id"`
		Actif  bool `json:"actif"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if err := adminUserRepo.UpdateActivation(req.UserID, req.Actif); err != nil {
		http.Error(w, `{"error":"Erreur lors de la mise à jour"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func UpdateAdminUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	var req struct {
		Nom       string `json:"nom"`
		Email     string `json:"email"`
		Role      string `json:"role"`
		Statut    string `json:"statut"`
		Telephone string `json:"telephone"`
		Adresse   string `json:"adresse"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	actif := req.Statut != "suspendu" && req.Statut != "inactif"
	_, err = database.DB.Exec(
		`UPDATE utilisateur SET nom=?, email=?, role=?, actif=?, telephone=?, adresse=? WHERE id_utilisateur=?`,
		req.Nom, req.Email, req.Role, actif, req.Telephone, req.Adresse, uint(id),
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur lors de la mise à jour"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
