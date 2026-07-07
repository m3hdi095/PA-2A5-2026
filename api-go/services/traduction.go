package services

// surcharges de traduction stockees en base (table traduction)
// permet de modifier des libelles sans redeploy, pour l'instant peu utilise
// TODO: ajouter un endpoint admin pour lister et modifier les traductions directement

import "upcycleconnect/api/repositories"

type TraductionService struct {
	repo *repositories.TraductionRepository
}

func NewTraductionService() *TraductionService {
	return &TraductionService{repo: &repositories.TraductionRepository{}}
}

func (s *TraductionService) GetTraduction(table string, recordID uint, champ, langue string) (string, error) {
	return s.repo.Get(table, recordID, champ, langue)
}

func (s *TraductionService) SetTraduction(table string, recordID uint, champ, langue, valeur string) error {
	return s.repo.Set(table, recordID, champ, langue, valeur)
}
