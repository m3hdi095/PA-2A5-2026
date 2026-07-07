package services

// creation des PaymentIntents Stripe et confirmation des paiements
// la cle Stripe vient de config.AppConfig (chargee depuis .env), jamais hardcodee

import (
	"errors"
	"fmt"
	"strconv"

	"upcycleconnect/api/config"
	"upcycleconnect/api/models"
	"upcycleconnect/api/repositories"

	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/paymentintent"
)

type PaiementService struct {
	paiementRepo *repositories.PaiementRepository
}

func NewPaiementService() *PaiementService {
	stripe.Key = config.AppConfig.StripeKey
	return &PaiementService{
		paiementRepo: &repositories.PaiementRepository{},
	}
}

func (s *PaiementService) CreatePaymentIntent(amount float64, currency string, metadata map[string]string) (string, error) {
	params := &stripe.PaymentIntentParams{
		Amount:   stripe.Int64(int64(amount * 100)),
		Currency: stripe.String(currency),
		Metadata: metadata,
	}
	pi, err := paymentintent.New(params)
	if err != nil {
		return "", err
	}
	paiement := &models.Paiement{
		Montant:      amount,
		Moyen:        "carte",
		RefStripe:    pi.ID,
		TypePaiement: metadata["type"],
	}
	if uid, err := strconv.ParseUint(metadata["user_id"], 10, 64); err == nil && uid > 0 {
		paiement.IDUtilisateur = uint(uid)
	}
	// lier l'abonnement des la creation du paiement pour que le webhook puisse l'activer
	if metadata["type"] == "abonnement" {
		if refID, err := strconv.ParseUint(metadata["reference_id"], 10, 64); err == nil && refID > 0 {
			id := uint(refID)
			paiement.IDAbonnement = &id
		}
	}
	if err := s.paiementRepo.Create(paiement); err != nil {
		return "", err
	}
	return pi.ClientSecret, nil
}

func (s *PaiementService) ConfirmPayment(paymentIntentID string) error {
	pi, err := paymentintent.Get(paymentIntentID, nil)
	if err != nil {
		return err
	}
	if pi.Status == "succeeded" {
		return s.paiementRepo.UpdateStatusByStripeRef(paymentIntentID, "paye")
	}
	return errors.New("paiement non confirmé")
}

// cree le PaymentIntent et la transaction en attente, le webhook confirme plus tard
func (s *PaiementService) ProcessAchat(annonceID, acheteurID, vendeurID uint, montant float64, commissionTaux float64) error {
	_, err := s.CreatePaymentIntent(montant, "eur", map[string]string{
		"type":         "transaction",
		"user_id":      fmt.Sprintf("%d", acheteurID),
		"reference_id": fmt.Sprintf("%d", annonceID),
	})
	if err != nil {
		return err
	}
	txRepo := &repositories.TransactionRepository{}
	tx := &models.TransactionAchat{
		Montant:        montant,
		CommissionTaux: commissionTaux,
		IDAnnonce:      annonceID,
		IDAcheteur:     acheteurID,
		IDVendeur:      vendeurID,
	}
	return txRepo.Create(tx)
}
