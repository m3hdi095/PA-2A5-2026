package services

// abonnements prestataires, freemium vers mensuel
// le webhook active l'abonnement apres paiement Stripe, Upgrade() c'est le cas manuel sans verification
// FIXME: Upgrade() s'active sans attendre Stripe, a corriger

import (
	"errors"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
)

type AbonnementService struct{}

func NewAbonnementService() *AbonnementService {
	return &AbonnementService{}
}

func (s *AbonnementService) GetMon(proID uint) (*models.Abonnement, error) {
	var a models.Abonnement
	err := database.DB.QueryRow(
		`SELECT id_abonnement, type_abonnement, prix_mensuel, date_debut, date_fin, statut,
                acces_tableaux_bord, acces_stats_materiaux, alertes_collecte, id_professionnel
         FROM abonnement WHERE id_professionnel = ? AND statut = 'actif' LIMIT 1`,
		proID,
	).Scan(&a.ID, &a.TypeAbonnement, &a.PrixMensuel, &a.DateDebut, &a.DateFin,
		&a.Statut, &a.AccesTableauxBord, &a.AccesStatsMat, &a.AlertesCollecte, &a.IDProfessionnel)
	if err != nil {
		return &models.Abonnement{
			TypeAbonnement:  "freemium",
			Statut:          "actif",
			IDProfessionnel: proID,
		}, nil
	}
	return &a, nil
}

func (s *AbonnementService) Upgrade(proID uint) error {
	database.DB.Exec(
		`UPDATE abonnement SET statut = 'expire', date_fin = CURDATE()
         WHERE id_professionnel = ? AND statut = 'actif'`,
		proID,
	)
	_, err := database.DB.Exec(
		`INSERT INTO abonnement (type_abonnement, prix_mensuel, date_debut, date_fin, statut,
                acces_tableaux_bord, acces_stats_materiaux, alertes_collecte, id_professionnel)
         VALUES ('mensuel', 15.00, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 'actif', 1, 1, 1, ?)`,
		proID,
	)
	if err != nil {
		return errors.New("impossible de créer l'abonnement")
	}
	database.DB.Exec(
		`UPDATE professionnel SET niveau_abonnement = 'premium' WHERE id_professionnel = ?`, proID,
	)
	return nil
}

func (s *AbonnementService) Resilier(proID uint) error {
	_, err := database.DB.Exec(
		`UPDATE abonnement SET statut = 'resilie', date_fin = LAST_DAY(CURDATE())
         WHERE id_professionnel = ? AND statut = 'actif'`,
		proID,
	)
	if err != nil {
		return errors.New("impossible de résilier l'abonnement")
	}
	database.DB.Exec(
		`UPDATE professionnel SET niveau_abonnement = 'freemium' WHERE id_professionnel = ?`, proID,
	)
	return nil
}

func (s *AbonnementService) ListFactures(proID uint) ([]models.Paiement, error) {
	rows, err := database.DB.Query(
		`SELECT p.id_paiement, p.montant, p.moyen, p.date_paiement, p.ref_stripe, p.statut, p.type_paiement, p.id_abonnement
         FROM paiement p
         JOIN abonnement a ON a.id_abonnement = p.id_abonnement
         WHERE a.id_professionnel = ? ORDER BY p.date_paiement DESC`,
		proID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var factures []models.Paiement
	for rows.Next() {
		var p models.Paiement
		rows.Scan(&p.ID, &p.Montant, &p.Moyen, &p.DatePaiement, &p.RefStripe, &p.Statut, &p.TypePaiement, &p.IDAbonnement)
		factures = append(factures, p)
	}
	return factures, nil
}
