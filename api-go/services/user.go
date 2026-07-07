package services

import (
    "errors"

    "golang.org/x/crypto/bcrypt"
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
    if err := s.repo.Update(user); err != nil {
        return err
    }
    if user.Entreprise != "" || user.Siret != "" || user.TypeMetier != "" {
        _ = s.repo.UpdateProfessionnel(user.ID, user.Entreprise, user.Siret, user.TypeMetier)
    }
    return nil
}

func (s *UserService) ChangePassword(userID uint, ancienPwd, nouveauPwd string) error {
    if len(nouveauPwd) < 8 {
        return errors.New("le nouveau mot de passe doit faire au moins 8 caractères")
    }
    hash, err := s.repo.GetPasswordHash(userID)
    if err != nil {
        return errors.New("utilisateur introuvable")
    }
    if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(ancienPwd)); err != nil {
        return errors.New("mot de passe actuel incorrect")
    }
    newHash, err := bcrypt.GenerateFromPassword([]byte(nouveauPwd), bcrypt.DefaultCost)
    if err != nil {
        return errors.New("erreur lors du chiffrement")
    }
    return s.repo.UpdatePassword(userID, string(newHash))
}