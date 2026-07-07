// abonnements premium pour les professionnels
// L'upgrade se fait côté Stripe.js (le front confirme), on reçoit juste la ref ici.
// TODO: valider la ref_stripe côté serveur via l'API Stripe avant d'activer le premium

package handlers

import (
	"upcycleconnect/api/middleware"
	"encoding/json"
	"net/http"

	"upcycleconnect/api/services"
)

var abonnementService = services.NewAbonnementService()

// abonnement en cours du pro connecte, nil si pas d'abonnement actif
func GetMonAbonnement(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "professionnel" {
		http.Error(w, `{"error":"Réservé aux professionnels"}`, http.StatusForbidden)
		return
	}
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	abonnement, err := abonnementService.GetMon(userID)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(abonnement)
}

// passage en premium via le webhook Stripe normalement, mais ce endpoint c'est le cas manuel
// le front appelle ca apres confirmation Stripe.js mais on re-verifie pas la ref_stripe ici, c'est un TODO
func UpgradeAbonnement(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "professionnel" {
		http.Error(w, `{"error":"Réservé aux professionnels"}`, http.StatusForbidden)
		return
	}
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	if err := abonnementService.Upgrade(userID); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Crée la facture immédiatement (le webhook Stripe ne peut pas atteindre localhost en dev)
	go creerFactureManuel(userID, "abonnement")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "premium activé"})
}

// résiliation en fin de mois, pas immédiate, on change juste le statut
func ResilierAbonnement(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "professionnel" {
		http.Error(w, `{"error":"Réservé aux professionnels"}`, http.StatusForbidden)
		return
	}
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	if err := abonnementService.Resilier(userID); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "résiliation programmée en fin de mois"})
}

// factures liées à l'abonnement du pro, pour l'espace perso
func MesFacturesAbonnement(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "professionnel" {
		http.Error(w, `{"error":"Réservé aux professionnels"}`, http.StatusForbidden)
		return
	}
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	factures, err := abonnementService.ListFactures(userID)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(factures)
}
