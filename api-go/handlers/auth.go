package handlers

// inscription et login
// le service hash le mdp, on touche jamais au mdp en clair ici

import (
	"encoding/json"
	"net/mail"
	"net/http"

	"upcycleconnect/api/models"
	"upcycleconnect/api/services"
)

var authService = services.NewAuthService()

func Register(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email      string `json:"email"`
		Password   string `json:"password"`
		Nom        string `json:"nom"`
		Prenom     string `json:"prenom"`
		Role       string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if _, err := mail.ParseAddress(input.Email); err != nil {
		jsonError(w, "Format d'email invalide", http.StatusBadRequest)
		return
	}
	user := &models.Utilisateur{
		Email:      input.Email,
		MotDePasse: input.Password, // le service s'occupe du hashage
		Nom:        input.Nom,
		Prenom:     input.Prenom,
		Role:       input.Role,
		Actif:      true,
	}
	if err := authService.Register(user); err != nil {
		jsonError(w, err.Error(), http.StatusConflict)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]uint{"id": user.ID})
}

func Login(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	userID, token, err := authService.Login(creds.Email, creds.Password)
	if err != nil {
		http.Error(w, `{"error":"Identifiants incorrects"}`, http.StatusUnauthorized)
		return
	}
	// on renvoie le user complet parce que les frontends stockent le rôle en localStorage au login
	user, _ := userService.GetUser(userID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token,
		"role":  user.Role,
		"user":  user,
	})
}
