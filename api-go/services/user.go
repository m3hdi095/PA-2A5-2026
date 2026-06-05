package services

// lecture et mise a jour du profil utilisateur
// le changement de mdp a sa propre route, on ne touche pas au mdp ici
// TODO: implémenter le changement de mot de passe avec vérification de l'ancien

import (
    "upcycleconnect/api/models"
    "upcycleconnect/api/repositories"
)

type UserService struct {
    repo *repositories.UserRepository
}

func NewUserService() *UserService {
    return &UserService{repo: &repositories.UserRepository{}}
}

func (s *UserService) GetUser(id uint) (*models.Utilisateur, error) {
    return s.repo.GetByID(id)
}

func (s *UserService) UpdateUser(user *models.Utilisateur) error {
    return s.repo.Update(user)
}