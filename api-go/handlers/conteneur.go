// depots d'objets dans les conteneurs physiques
// un particulier depose, un pro recupere, tout passe par le service
// FIXME: ajouter la vérification QR code côté serveur avant de confirmer le dépôt

package handlers

import (
	"upcycleconnect/api/middleware"
	"encoding/json"
	"net/http"
	"strconv"

	"upcycleconnect/api/models"
	"upcycleconnect/api/services"
)

var conteneurService = services.NewConteneurService()

func ListConteneurs(w http.ResponseWriter, r *http.Request) {
	conteneurs, err := conteneurService.ListConteneurs()
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(conteneurs)
}

// seuls les particuliers peuvent déposer, le service vérifie aussi de son côté
func CreateDepot(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "particulier" {
		http.Error(w, `{"error":"Seuls les particuliers peuvent déposer"}`, http.StatusForbidden)
		return
	}
	var req struct {
		ConteneurID uint `json:"conteneur_id"`
		ObjetID     uint `json:"objet_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	depot, err := conteneurService.RequestDepot(userID, req.ConteneurID, req.ObjetID)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(depot)
}

// mes depots a moi, selon qui est connecté
func ListDepots(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	depots, err := conteneurService.ListDepotsUser(userID)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(depots)
}

// le pro confirme la récupération, ca change le statut du depot
func RecupererDepot(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "professionnel" && role != "admin" {
		http.Error(w, `{"error":"Accès réservé aux professionnels"}`, http.StatusForbidden)
		return
	}
	depotID := r.PathValue("id")
	if depotID == "" {
		http.Error(w, `{"error":"ID manquant"}`, http.StatusBadRequest)
		return
	}
	parsed, err := strconv.ParseUint(depotID, 10, 32)
	if err != nil {
		http.Error(w, `{"error":"ID invalide"}`, http.StatusBadRequest)
		return
	}
	id := uint(parsed)
	if err := conteneurService.RecupererDepot(id); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "recupere"})
}

func RecupererDepotParCode(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "professionnel" && role != "admin" {
		http.Error(w, `{"error":"Accès réservé aux professionnels"}`, http.StatusForbidden)
		return
	}
	var req struct {
		CodeBarre string `json:"code_barre"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.CodeBarre == "" {
		http.Error(w, `{"error":"Code barre manquant"}`, http.StatusBadRequest)
		return
	}
	depot, err := conteneurService.RecupererDepotParCode(req.CodeBarre)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(depot)
}

func CreateConteneur(w http.ResponseWriter, r *http.Request) {
	var c models.Conteneur
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	if err := conteneurService.CreateConteneur(&c); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

func UpdateConteneurStatut(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	parsed, err := strconv.Atoi(idStr)
	if err != nil || parsed <= 0 {
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
	if err := conteneurService.UpdateStatutConteneur(uint(parsed), req.Statut); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func ValidateDepotAdmin(w http.ResponseWriter, r *http.Request) {
	adminID := r.Context().Value(middleware.ContextUserID).(uint)
	var req struct {
		DepotID  uint   `json:"depot_id"`
		Decision string `json:"decision"` // "valide" ou "refuse"
		Motif    string `json:"motif"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	accept := req.Decision == "valide"
	if err := conteneurService.ValidateDepot(req.DepotID, adminID, accept, req.Motif); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
