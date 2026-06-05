// creation de PaymentIntent Stripe et reception des webhooks
// le webhook verifie la signature Stripe avant de traiter, ne pas bypasser

package handlers

import (
	"upcycleconnect/api/middleware"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"upcycleconnect/api/config"
	"upcycleconnect/api/database"
	"upcycleconnect/api/services"
	"upcycleconnect/api/utils"

	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/webhook"
)

func getPaiementService() *services.PaiementService {
	return services.NewPaiementService()
}

func CreatePaymentIntent(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.ContextUserID).(uint)
	var req struct {
		Amount      float64 `json:"amount"`
		Currency    string  `json:"currency"`
		Type        string  `json:"type"`
		ReferenceID uint    `json:"reference_id"` // evenement_id, annonce_id ou abonnement_id selon le type
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Données invalides"}`, http.StatusBadRequest)
		return
	}
	metadata := map[string]string{
		"type":         req.Type,
		"user_id":      fmt.Sprintf("%d", userID),
		"reference_id": fmt.Sprintf("%d", req.ReferenceID),
	}
	clientSecret, err := getPaiementService().CreatePaymentIntent(req.Amount, req.Currency, metadata)
	if err != nil {
		http.Error(w, `{"error":"Erreur Stripe"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"client_secret": clientSecret})
}

func StripeWebhook(w http.ResponseWriter, r *http.Request) {
	// body brut obligatoire, Stripe signe l'ensemble du payload
	payload, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"Lecture impossible"}`, http.StatusBadRequest)
		return
	}

	sigHeader := r.Header.Get("Stripe-Signature")
	event, err := webhook.ConstructEvent(payload, sigHeader, config.AppConfig.StripeWebhookSecret)
	if err != nil {
		log.Println("Stripe webhook signature invalide:", err)
		http.Error(w, `{"error":"Signature invalide"}`, http.StatusBadRequest)
		return
	}

	switch event.Type {
	case "payment_intent.succeeded":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			log.Println("Erreur parsing PaymentIntent:", err)
			break
		}
		handlePaymentSucceeded(pi)

	case "payment_intent.payment_failed":
		var pi stripe.PaymentIntent
		if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
			break
		}
		log.Println("Paiement échoué Stripe:", pi.ID)

	case "charge.refunded":
		var charge stripe.Charge
		if err := json.Unmarshal(event.Data.Raw, &charge); err != nil {
			break
		}
		if charge.PaymentIntent != nil {
			database.DB.Exec(`UPDATE paiement SET statut = 'rembourse' WHERE ref_stripe = ?`, charge.PaymentIntent.ID)
		}
	}

	w.WriteHeader(http.StatusOK)
}

func handlePaymentSucceeded(pi stripe.PaymentIntent) {
	var paiementID uint
	var typePaiement string
	var abonnementID *uint
	row := database.DB.QueryRow(
		`SELECT id_paiement, type_paiement, id_abonnement FROM paiement WHERE ref_stripe = ?`, pi.ID,
	)
	if err := row.Scan(&paiementID, &typePaiement, &abonnementID); err != nil {
		log.Println("Paiement introuvable pour stripe ref:", pi.ID)
		return
	}
	database.DB.Exec(`UPDATE paiement SET statut = 'paye' WHERE id_paiement = ?`, paiementID)

	userID, _ := strconv.ParseUint(pi.Metadata["user_id"], 10, 64)
	refID, _ := strconv.ParseUint(pi.Metadata["reference_id"], 10, 64)

	switch typePaiement {
	case "evenement":
		// on lie le paiement à l'inscription et on la passe en 'paye'
		database.DB.Exec(
			`UPDATE inscription SET statut = 'paye', id_paiement = ?
			 WHERE id_utilisateur = ? AND id_evenement = ?`,
			paiementID, userID, refID,
		)
	case "transaction":
		// pareil pour les transactions entre particuliers
		database.DB.Exec(
			`UPDATE transaction_achat SET statut = 'payee', id_paiement = ?
			 WHERE id_annonce = ? AND id_acheteur = ? AND statut = 'en_attente'`,
			paiementID, refID, userID,
		)
	case "abonnement":
		if abonnementID != nil {
			database.DB.Exec(`UPDATE abonnement SET statut = 'actif' WHERE id_abonnement = ?`, *abonnementID)
		}
	}

	// CONCAT prenom + nom pour le PDF, si le user n'existe pas nomClient sera vide
	var nomClient string
	database.DB.QueryRow(
		`SELECT CONCAT(prenom, ' ', nom) FROM utilisateur WHERE id_utilisateur = ?`, userID,
	).Scan(&nomClient)

	montantHT := float64(pi.Amount) / 100 / 1.2
	montantTTC := float64(pi.Amount) / 100
	factureNum := fmt.Sprintf("UC-%05d", paiementID)
	filename := fmt.Sprintf("uploads/factures/facture_%d.pdf", paiementID)

	os.MkdirAll("uploads/factures", 0755)

	pdfPath := ""
	factureData := utils.FactureData{
		Numero:     factureNum,
		Date:       time.Unix(pi.Created, 0).Format("02/01/2006"),
		NomClient:  nomClient,
		MontantHT:  montantHT,
		TVA:        20,
		MontantTTC: montantTTC,
	}
	if err := utils.GenerateInvoice(factureData, filename); err != nil {
		log.Println("Erreur génération PDF facture:", err)
	} else {
		pdfPath = filename
	}

	// montant_ttc est GENERATED ALWAYS donc on ne l'insere pas, la DB le calcule
	database.DB.Exec(
		`INSERT INTO facture (numero_facture, montant_ht, tva, statut, fichier_pdf, id_utilisateur, id_paiement)
		 VALUES (?, ?, 20, 'payee', ?, ?, ?)`,
		factureNum, montantHT, pdfPath, userID, paiementID,
	)
}
