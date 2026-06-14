package handlers

// inscription et login
// le service hash le mdp, on touche jamais au mdp en clair ici

import (
	"encoding/json"
	"net/mail"
	"net/http"
	"unicode"

	"upcycleconnect/api/models"
	"upcycleconnect/api/services"
)

func validatePassword(pwd string) string {
	if len(pwd) < 8 {
		return "Le mot de passe doit contenir au moins 8 caractères"
	}
	var hasUpper, hasDigit bool
	for _, c := range pwd {
		if unicode.IsUpper(c) { hasUpper = true }
		if unicode.IsDigit(c) { hasDigit = true }
	}
	if !hasUpper { return "Le mot de passe doit contenir au moins une majuscule" }
	if !hasDigit { return "Le mot de passe doit contenir au moins un chiffre" }
	return ""
}

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
	if msg := validatePassword(input.Password); msg != "" {
		jsonError(w, msg, http.StatusBadRequest)
		return
	}
	user := &models.Utilisateur{
		Email:      input.Email,
		MotDePasse: input.Password,
		Nom:        input.Nom,
		Prenom:     input.Prenom,
		Role:       input.Role,
		Actif:      false,
	}
	if err := authService.Register(user); err != nil {
		jsonError(w, err.Error(), http.StatusConflict)
		return
	}
	go SendVerificationEmail(user.ID, user.Email, user.Prenom)
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
