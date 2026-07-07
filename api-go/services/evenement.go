package services

// ateliers et evenements upcycling ouverts aux particuliers
// les inscriptions sont en non_paye jusqu'a ce que le webhook Stripe confirme

import (
    "errors"
    "fmt"
    "log"
    "time"

    "upcycleconnect/api/config"
    "upcycleconnect/api/database"
    "upcycleconnect/api/models"
    "upcycleconnect/api/repositories"
    "upcycleconnect/api/utils"

    "github.com/stripe/stripe-go/v78"
    stripeRefund "github.com/stripe/stripe-go/v78/refund"
)

type EvenementService struct {
    evenementRepo *repositories.EvenementRepository
    inscriptionRepo *repositories.InscriptionRepository
}

func NewEvenementService() *EvenementService {
    return &EvenementService{
        evenementRepo:   &repositories.EvenementRepository{},
        inscriptionRepo: &repositories.InscriptionRepository{},
    }
}

func (s *EvenementService) CreateEvenement(evenement *models.Evenement) error {
    if evenement.Titre == "" || evenement.DateDebut.IsZero() {
        return errors.New("titre et date début requis")
    }
    return s.evenementRepo.Create(evenement)
}

func (s *EvenementService) ListUpcoming(page, pageSize int, lang string) ([]models.Evenement, error) {
    offset := (page - 1) * pageSize
    return s.evenementRepo.ListUpcoming(pageSize, offset, lang)
}

func (s *EvenementService) InscrireUtilisateur(userID, evenementID uint) error {
    exists, err := s.inscriptionRepo.CheckExists(userID, evenementID)
    if err != nil {
        return err
    }
    if exists {
        return errors.New("déjà inscrit à cet événement")
    }
    // on verifie les places avant d'inscrire
    evt, err := s.evenementRepo.GetByID(evenementID)
    if err != nil || evt == nil {
        return errors.New("événement introuvable")
    }
    // compter directement en SQL, plus fiable qu'un champ nb_inscrits qui peut desynchro
    var count int
    database.DB.QueryRow("SELECT COUNT(*) FROM inscription WHERE id_evenement = ?", evenementID).Scan(&count)
    if count >= evt.NbPlaces {
        return errors.New("plus de places disponibles")
    }
    inscription := &models.Inscription{
        Statut:        "non_paye",
        IDUtilisateur: userID,
        IDEvenement:   evenementID,
    }
    return s.inscriptionRepo.Create(inscription)
}

func (s *EvenementService) ListMesInscriptions(userID uint, page, pageSize int) ([]models.Inscription, error) {
	offset := (page - 1) * pageSize
	return s.inscriptionRepo.ListByUserFull(userID, pageSize, offset)
}

func (s *EvenementService) UpdateEvenement(evenement *models.Evenement) error {
    if evenement.Titre == "" || evenement.DateDebut.IsZero() {
        return errors.New("titre et date début requis")
    }
    var dateDebut time.Time
    database.DB.QueryRow(`SELECT date_debut FROM evenement WHERE id_evenement = ?`, evenement.ID).Scan(&dateDebut)
    if !dateDebut.IsZero() && time.Until(dateDebut) < 7*24*time.Hour {
        return errors.New("impossible de modifier un événement moins de 7 jours avant sa date")
    }
    return s.evenementRepo.Update(evenement)
}

func (s *EvenementService) DeleteEvenement(id uint) error {
    return s.evenementRepo.Delete(id)
}

func (s *EvenementService) SeDesinscrire(userID, evenementID uint) error {
	var dateDebut time.Time
	database.DB.QueryRow(`SELECT date_debut FROM evenement WHERE id_evenement = ?`, evenementID).Scan(&dateDebut)
	if !dateDebut.IsZero() && time.Until(dateDebut) < 48*time.Hour {
		return errors.New("impossible de se désinscrire moins de 48h avant l'événement")
	}

	insc, err := s.inscriptionRepo.GetByUserAndEvent(userID, evenementID)
	if err != nil || insc == nil {
		return errors.New("inscription introuvable")
	}

	// remboursement Stripe si le paiement existe
	if insc.IDPaiement != nil {
		var refStripe string
		database.DB.QueryRow(`SELECT ref_stripe FROM paiement WHERE id_paiement = ?`, *insc.IDPaiement).Scan(&refStripe)
		if refStripe != "" {
			stripe.Key = config.AppConfig.StripeKey
			_, err := stripeRefund.New(&stripe.RefundParams{
				PaymentIntent: stripe.String(refStripe),
			})
			if err != nil {
				return fmt.Errorf("erreur remboursement Stripe : %w", err)
			}
			database.DB.Exec(`UPDATE paiement SET statut = 'rembourse' WHERE id_paiement = ?`, *insc.IDPaiement)
		}
	}

	return s.inscriptionRepo.DeleteByUserAndEvent(userID, evenementID)
}

// EnvoyerRappels est appelé toutes les heures par main.go.
// Il envoie email + push aux inscrits dont l'événement commence dans 47-49h.
func (s *EvenementService) EnvoyerRappels() {
	rows, err := database.DB.Query(`
		SELECT e.id_evenement, e.titre, e.date_debut, COALESCE(e.lieu,''),
		       u.id_utilisateur, COALESCE(u.prenom,''), u.email
		FROM evenement e
		JOIN inscription i ON i.id_evenement = e.id_evenement AND i.statut IN ('non_paye','paye')
		JOIN utilisateur u ON u.id_utilisateur = i.id_utilisateur
		WHERE e.date_debut BETWEEN DATE_ADD(NOW(), INTERVAL 47 HOUR) AND DATE_ADD(NOW(), INTERVAL 49 HOUR)`)
	if err != nil {
		log.Println("EnvoyerRappels query error:", err)
		return
	}
	defer rows.Close()

	notifSvc := NewNotificationService()
	for rows.Next() {
		var evtID, userID uint
		var titre, lieu, prenom, email string
		var dateDebut time.Time
		if err := rows.Scan(&evtID, &titre, &dateDebut, &lieu, &userID, &prenom, &email); err != nil {
			continue
		}
		dateStr := dateDebut.Format("02/01/2006 à 15h04")
		sujet := fmt.Sprintf("Rappel : %s dans 48h", titre)
		corps := fmt.Sprintf(`<p>Bonjour %s,</p>
<p>Votre événement <strong>%s</strong> commence le <strong>%s</strong>%s.</p>
<p>Bonne préparation !</p>
<p>L'équipe UpcycleConnect</p>`,
			prenom, titre, dateStr,
			func() string {
				if lieu != "" {
					return " à " + lieu
				}
				return ""
			}(),
		)
		_ = utils.SendEmail(email, sujet, corps)
		_ = notifSvc.SendNotification(userID, sujet, fmt.Sprintf("Votre événement « %s » commence demain.", titre), "info", "push")
	}
}

func (s *EvenementService) ValidateEvenement(id uint, adminID uint, decision string) error {
    if decision != "valide" && decision != "annule" {
        return errors.New("décision invalide")
    }
    _, err := database.DB.Exec(`INSERT INTO validation_evenement (id_evenement, id_admin, decision) VALUES (?, ?, ?)`, id, adminID, decision)
    if err != nil {
        return err
    }
    if err := s.evenementRepo.UpdateStatus(id, decision); err != nil {
        return err
    }
    // planning auto-rempli pour le salarié créateur
    if decision == "valide" {
        var titre string
        var dateDebut time.Time
        var idSalarie *uint
        database.DB.QueryRow(
            `SELECT titre, date_debut, id_salarie_createur FROM evenement WHERE id_evenement = ?`, id,
        ).Scan(&titre, &dateDebut, &idSalarie)
        if idSalarie != nil {
            var idUser uint
            database.DB.QueryRow(`SELECT id_utilisateur FROM salarie WHERE id_salarie = ?`, *idSalarie).Scan(&idUser)
            if idUser > 0 {
                database.DB.Exec(
                    `INSERT IGNORE INTO planning (titre, date_heure, type_entree, id_utilisateur, id_evenement)
                     VALUES (?, ?, 'evenement', ?, ?)`,
                    titre, dateDebut, idUser, id,
                )
            }
        }
    }
    return nil
}

func (s *EvenementService) AnnulerEvenementSalarie(eventID, userID uint) error {
    var titreEvt string
    var dateDebut time.Time
    err := database.DB.QueryRow(
        `SELECT e.titre, e.date_debut
         FROM evenement e
         JOIN salarie sal ON sal.id_salarie = e.id_salarie_createur
         WHERE e.id_evenement = ? AND sal.id_utilisateur = ?`,
        eventID, userID,
    ).Scan(&titreEvt, &dateDebut)
    if err != nil {
        return errors.New("événement introuvable ou non autorisé")
    }

    if _, err = database.DB.Exec(`UPDATE evenement SET statut = 'annule' WHERE id_evenement = ?`, eventID); err != nil {
        return err
    }

    rows, err := database.DB.Query(
        `SELECT i.id_inscription, i.id_utilisateur, i.id_paiement, u.email, COALESCE(u.prenom,'')
         FROM inscription i
         JOIN utilisateur u ON u.id_utilisateur = i.id_utilisateur
         WHERE i.id_evenement = ? AND i.statut IN ('paye','non_paye')`, eventID)
    if err != nil {
        return nil
    }
    defer rows.Close()

    stripe.Key = config.AppConfig.StripeKey
    dateStr := dateDebut.Format("02/01/2006")
    for rows.Next() {
        var inscID, inscrUserID uint
        var idPaiement *uint
        var email, prenom string
        if err := rows.Scan(&inscID, &inscrUserID, &idPaiement, &email, &prenom); err != nil {
            continue
        }
        if idPaiement != nil {
            var refStripe string
            database.DB.QueryRow(`SELECT ref_stripe FROM paiement WHERE id_paiement = ?`, *idPaiement).Scan(&refStripe)
            if refStripe != "" {
                _, _ = stripeRefund.New(&stripe.RefundParams{PaymentIntent: stripe.String(refStripe)})
                database.DB.Exec(`UPDATE paiement SET statut = 'rembourse' WHERE id_paiement = ?`, *idPaiement)
            }
        }
        database.DB.Exec(`UPDATE inscription SET statut = 'annule' WHERE id_inscription = ?`, inscID)
        corps := fmt.Sprintf(`<p>Bonjour %s,</p>
<p>L'événement <strong>%s</strong> prévu le <strong>%s</strong> a été annulé.</p>
<p>Si vous aviez payé, votre remboursement sera effectué sous 5 à 10 jours ouvrés.</p>
<p>L'équipe UpcycleConnect</p>`, prenom, titreEvt, dateStr)
        _ = utils.SendEmail(email, "Annulation : "+titreEvt, corps)
    }
    return nil
}