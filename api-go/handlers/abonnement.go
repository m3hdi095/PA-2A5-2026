// abonnements premium pour les professionnels

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

// passage en premium : le front envoie le payment_intent_id après confirmation Stripe.js,
// on vérifie côté serveur que le paiement a bien été reçu avant d'activer le compte
func UpgradeAbonnement(w http.ResponseWriter, r *http.Request) {
	role := r.Context().Value(middleware.ContextRole).(string)
	if role != "professionnel" {
		http.Error(w, `{"error":"Réservé aux professionnels"}`, http.StatusForbidden)
		return
	}
	var req struct {
		PaymentIntentID string `json:"payment_intent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PaymentIntentID == "" {
		jsonError(w, "payment_intent_id manquant", http.StatusBadRequest)
		return
	}
	paiementSvc := services.NewPaiementService()
	if err := paiementSvc.ConfirmPayment(req.PaymentIntentID); err != nil {
		jsonError(w, "paiement non confirmé par Stripe", http.StatusPaymentRequired)
		return
	}
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	if err := abonnementService.Upgrade(userID); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
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
