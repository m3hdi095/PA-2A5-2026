package services

// ateliers et evenements upcycling ouverts aux particuliers
// les inscriptions sont en non_paye jusqu'a ce que le webhook Stripe confirme
// TODO: envoyer un email de rappel 24h avant l'événement via la notif service

import (
    "errors"

    "upcycleconnect/api/database"
    "upcycleconnect/api/models"
    "upcycleconnect/api/repositories"
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

func (s *EvenementService) ListUpcoming(page, pageSize int) ([]models.Evenement, error) {
    offset := (page - 1) * pageSize
    return s.evenementRepo.ListUpcoming(pageSize, offset)
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
    return s.evenementRepo.Update(evenement)
}

func (s *EvenementService) DeleteEvenement(id uint) error {
    return s.evenementRepo.Delete(id)
}

func (s *EvenementService) ValidateEvenement(id uint, adminID uint, decision string) error {
    if decision != "valide" && decision != "annule" {
        return errors.New("décision invalide")
    }
    _, err := database.DB.Exec(`INSERT INTO validation_evenement (id_evenement, id_admin, decision) VALUES (?, ?, ?)`, id, adminID, decision)
    if err != nil {
        return err
    }
    return s.evenementRepo.UpdateStatus(id, decision)
}