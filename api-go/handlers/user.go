package handlers

// user.go : lecture et mise à jour du profil de l'utilisateur connecté.
// le role vient du JWT, l'utilisateur ne peut pas le modifier lui-meme
// TODO: permettre le changement de mot de passe avec vérification de l'ancien

import (
	"upcycleconnect/api/middleware"
	"encoding/json"
	"net/http"

	"upcycleconnect/api/models"
	"upcycleconnect/api/repositories"
	"upcycleconnect/api/services"
)

var userService = services.NewUserService()

func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	user, err := userService.GetUser(userID)
	if err != nil || user == nil {
		http.Error(w, `{"error":"Utilisateur non trouvé"}`, http.StatusNotFound)
		return
	}
	user.MotDePasse = ""
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	var updates models.Utilisateur
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	updates.ID = userID
	if err := userService.UpdateUser(&updates); err != nil {
		http.Error(w, `{"error":"Erreur lors de la mise à jour"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if err := userService.ChangePassword(userID, req.OldPassword, req.NewPassword); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func MarkTutorialSeen(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	repo := &repositories.UserRepository{}
	if err := repo.UpdateTutorialSeen(userID); err != nil {
		http.Error(w, `{"error":"Erreur"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
