package services

// logique d'authentification, inscription et connexion
// meme message d'erreur que l'email existe ou pas, pour pas aider quelqu'un a deviner les comptes

import (
    "errors"

    "upcycleconnect/api/models"
    "upcycleconnect/api/repositories"
    "upcycleconnect/api/utils"
)

type AuthService struct {
    userRepo *repositories.UserRepository
}

func NewAuthService() *AuthService {
    return &AuthService{
        userRepo: &repositories.UserRepository{},
    }
}

func (s *AuthService) Register(user *models.Utilisateur) error {
    existing, _ := s.userRepo.GetByEmail(user.Email)
    if existing != nil {
        return errors.New("cet email est déjà utilisé")
    }
    hashed, err := utils.HashPassword(user.MotDePasse)
    if err != nil {
        return err
    }
    user.MotDePasse = hashed
    return s.userRepo.Create(user)
}

func (s *AuthService) Login(email, password string) (uint, string, error) {
    user, err := s.userRepo.GetByEmail(email)
    if err != nil || user == nil {
        return 0, "", errors.New("identifiants incorrects")
    }
    if !user.Actif {
        return 0, "", errors.New("Compte non activé. Vérifiez votre boîte mail et cliquez sur le lien d'activation.")
    }
    if !utils.CheckPasswordHash(password, user.MotDePasse) {
        return 0, "", errors.New("identifiants incorrects")
    }
    token, err := utils.GenerateJWT(user.ID, user.Role)
    if err != nil {
        return 0, "", err
    }
    return user.ID, token, nil
}