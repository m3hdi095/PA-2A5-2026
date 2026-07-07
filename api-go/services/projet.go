package services

// projets upcycling des prestataires, creation et suivi des etapes
// les projets publics sont visibles par tous les connectes, les prives seulement par leur auteur
// TODO: permettre d'attacher des matériaux (objets) directement à un projet

import (
    "errors"

    "upcycleconnect/api/models"
    "upcycleconnect/api/repositories"
)

type ProjetService struct {
    projetRepo *repositories.ProjetRepository
    etapeRepo  *repositories.EtapeProjetRepository
}

func NewProjetService() *ProjetService {
    return &ProjetService{
        projetRepo: &repositories.ProjetRepository{},
        etapeRepo:  &repositories.EtapeProjetRepository{},
    }
}

func (s *ProjetService) CreateProjet(projet *models.ProjetUpcycling) error {
    if projet.Titre == "" {
        return errors.New("le titre est requis")
    }
    return s.projetRepo.Create(projet)
}

func (s *ProjetService) GetProjet(id uint) (*models.ProjetUpcycling, error) {
    return s.projetRepo.GetByID(id)
}

func (s *ProjetService) ListUserProjets(userID uint, page, pageSize int) ([]models.ProjetUpcycling, error) {
    offset := (page - 1) * pageSize
    return s.projetRepo.ListByUser(userID, pageSize, offset)
}

func (s *ProjetService) ListPublics(page, pageSize int) ([]models.ProjetUpcycling, error) {
	offset := (page - 1) * pageSize
	return s.projetRepo.ListPublic(pageSize, offset)
}

func (s *ProjetService) AddEtape(etape *models.EtapeProjet) error {
    if etape.Titre == "" {
        return errors.New("le titre de l'étape est requis")
    }
    return s.etapeRepo.Create(etape)
}

func (s *ProjetService) UpdateStatut(id, userID uint, statut string) error {
    allowed := map[string]bool{"en_cours": true, "attente": true, "termine": true, "publie": true, "brouillon": true}
    if !allowed[statut] {
        return errors.New("statut invalide")
    }
    return s.projetRepo.UpdateStatut(id, userID, statut)
}