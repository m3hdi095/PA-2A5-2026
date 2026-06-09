package handlers

// routes admin pour la gestion des utilisateurs
// on verifie le role deux fois (middleware + ici), ca semble redondant mais si on se plante dans le cablage des routes ca protege quand meme

import (
	"encoding/json"
	"net/http"
	"strconv"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
	"upcycleconnect/api/repositories"
)

// userRepo partagé pour les routes admin
var adminUserRepo = repositories.UserRepository{}

func CountUsersByRole(w http.ResponseWriter, r *http.Request) {
	counts := map[string]int{"tous": 0, "particulier": 0, "professionnel": 0, "salarie": 0, "admin": 0}
	rows, err := database.DB.Query("SELECT role, COUNT(*) FROM utilisateur WHERE actif = 1 GROUP BY role")
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var role string
		var n int
		rows.Scan(&role, &n)
		counts[role] = n
		counts["tous"] += n
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(counts)
}

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

func AdminCreateUser(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email     string `json:"email"`
		Password  string `json:"password"`
		Nom       string `json:"nom"`
		Prenom    string `json:"prenom"`
		Role      string `json:"role"`
		Telephone string `json:"telephone"`
		Adresse   string `json:"adresse"`
		Statut    string `json:"statut"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if input.Email == "" || input.Password == "" || input.Nom == "" {
		http.Error(w, `{"error":"Email, mot de passe et nom sont requis"}`, http.StatusBadRequest)
		return
	}
	validRoles := map[string]bool{"particulier": true, "professionnel": true, "salarie": true, "admin": true}
	if !validRoles[input.Role] {
		input.Role = "particulier"
	}
	user := &models.Utilisateur{
		Email:      input.Email,
		MotDePasse: input.Password,
		Nom:        input.Nom,
		Prenom:     input.Prenom,
		Role:       input.Role,
		Telephone:  input.Telephone,
		Adresse:    input.Adresse,
		Actif:      input.Statut != "inactif",
	}
	if err := authService.Register(user); err != nil {
		jsonError(w, err.Error(), http.StatusConflict)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]uint{"id": user.ID})
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
		Prenom    string `json:"prenom"`
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
	actif := req.Statut == "actif"
	_, err = database.DB.Exec(
		`UPDATE utilisateur SET nom=?, prenom=?, email=?, role=?, actif=?, telephone=?, adresse=? WHERE id_utilisateur=?`,
		req.Nom, req.Prenom, req.Email, req.Role, actif, req.Telephone, req.Adresse, uint(id),
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur lors de la mise à jour"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
