package services

// logique des annonces de materiaux
// les annonces arrivent en brouillon, l'admin doit valider avant qu'elles soient visibles
// TODO: envoyer une notification à l'auteur quand son annonce est validée ou refusée

import (
	"errors"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
	"upcycleconnect/api/repositories"
)

// propriétaireAnnonce retourne l'id_utilisateur de l'annonce, 0 si introuvable
func propriétaireAnnonce(id uint) uint {
	var ownerID uint
	database.DB.QueryRow(`SELECT id_utilisateur FROM annonce WHERE id_annonce = ?`, id).Scan(&ownerID)
	return ownerID
}

type AnnonceService struct {
	repo *repositories.AnnonceRepository
}

func NewAnnonceService() *AnnonceService {
	return &AnnonceService{repo: &repositories.AnnonceRepository{}}
}

func (s *AnnonceService) CreateAnnonce(annonce *models.Annonce) error {
	if annonce.TypeAnnonce == "vente" && annonce.Prix <= 0 {
		return errors.New("le prix doit être supérieur à 0 pour une vente")
	}
	// les pros sans abonnement actif sont limités à 3 annonces par mois
	var role string
	database.DB.QueryRow(`SELECT role FROM utilisateur WHERE id_utilisateur = ?`, annonce.IDUtilisateur).Scan(&role)
	if role == "professionnel" {
		var niveauAbonnement string
		database.DB.QueryRow(`SELECT COALESCE(niveau_abonnement,'free') FROM professionnel WHERE id_professionnel = ?`, annonce.IDUtilisateur).Scan(&niveauAbonnement)
		if niveauAbonnement == "free" || niveauAbonnement == "" {
			var nbCeMois int
			database.DB.QueryRow(`
				SELECT COUNT(*) FROM annonce
				WHERE id_utilisateur = ?
				  AND MONTH(date_publication) = MONTH(NOW())
				  AND YEAR(date_publication)  = YEAR(NOW())
				  AND statut != 'desactivee'`,
				annonce.IDUtilisateur,
			).Scan(&nbCeMois)
			if nbCeMois >= 3 {
				return errors.New("offre gratuite : maximum 3 annonces par mois (passez à l'offre Premium pour publier sans limite)")
			}
		}
	}
	return s.repo.Create(annonce)
}

func (s *AnnonceService) GetAnnonce(id uint) (*models.Annonce, error) {
	return s.repo.GetByID(id)
}

func (s *AnnonceService) ListAnnonces(filter string, page, pageSize int, lang string, lat, lon, rayon float64) ([]models.Annonce, error) {
	offset := (page - 1) * pageSize
	return s.repo.List(filter, pageSize, offset, lang, lat, lon, rayon)
}

func (s *AnnonceService) ListMyAnnonces(userID uint, page, pageSize int) ([]models.Annonce, error) {
	offset := (page - 1) * pageSize
	return s.repo.ListByUser(userID, pageSize, offset)
}

// annonces en attente, pour le panel admin
func (s *AnnonceService) ListPending(page, pageSize int) ([]models.Annonce, error) {
	offset := (page - 1) * pageSize
	return s.repo.ListPending(pageSize, offset)
}

func (s *AnnonceService) UpdateAnnonce(annonce *models.Annonce) error {
	existing, _ := s.repo.GetByID(annonce.ID)
	if existing == nil {
		return errors.New("annonce non trouvée")
	}
	// on peut modifier que si c'est encore en brouillon ou refusee, sinon c'est trop tard
	if existing.Statut != "brouillon" && existing.Statut != "refusee" {
		return errors.New("cette annonce ne peut plus être modifiée")
	}
	return s.repo.Update(annonce)
}

func (s *AnnonceService) DeleteAnnonce(id, userID uint, role string) error {
	annonce, err := s.repo.GetByID(id)
	if err != nil || annonce == nil {
		return errors.New("annonce non trouvée")
	}
	if annonce.IDUtilisateur != userID && role != "admin" {
		return errors.New("vous n'êtes pas autorisé à supprimer cette annonce")
	}
	return s.repo.UpdateStatus(id, "desactivee")
}

func (s *AnnonceService) ValidateAnnonce(id uint, adminID uint, decision, commentaire string) error {
	if decision != "validee" && decision != "refusee" {
		return errors.New("décision invalide")
	}
	_, err := database.DB.Exec(
		`INSERT INTO validation_annonce (id_annonce, id_admin, decision, commentaire) VALUES (?, ?, ?, ?)`,
		id, adminID, decision, commentaire,
	)
	if err != nil {
		return err
	}
	if decision == "validee" {
		ownerID := propriétaireAnnonce(id)
		if ownerID != 0 {
			database.AddUpcyclingScore(ownerID, 5, "annonce_validee")
			notifSvc := NewNotificationService()
			_ = notifSvc.SendNotification(ownerID,
				"Annonce validée !",
				"Votre annonce a été validée et est maintenant visible par tous les membres.",
				"info", "push")
		}
		database.DB.Exec(`UPDATE annonce SET date_expiration = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE id_annonce = ?`, id)
	}
	return s.repo.UpdateStatus(id, decision)
}
