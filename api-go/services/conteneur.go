package services

// flux de depot dans les conteneurs, demande, validation, recuperation
// le code d'ouverture est genere ici, jamais dans l'URL ni cote client
// TODO: invalider le code d'ouverture après X minutes si le dépôt n'est pas confirmé

import (
    "crypto/rand"
    "encoding/hex"
    "errors"
    "fmt"
    "time"

    "upcycleconnect/api/models"
    "upcycleconnect/api/repositories"
    "upcycleconnect/api/utils"
)

func (s *ConteneurService) sendNotif(userID uint, titre, contenu string) {
    notif := &models.Notification{
        Titre:         titre,
        Contenu:       contenu,
        Type:          "depot",
        Canal:         "push",
        IDUtilisateur: userID,
    }
    _ = utils.SendPushNotification(userID, titre, contenu)
    _ = s.notifRepo.Create(notif)
}

type ConteneurService struct {
    conteneurRepo *repositories.ConteneurRepository
    depotRepo     *repositories.DepotRepository
    objetRepo     *repositories.ObjetRepository
    notifRepo     *repositories.NotificationRepository
}

func NewConteneurService() *ConteneurService {
    return &ConteneurService{
        conteneurRepo: &repositories.ConteneurRepository{},
        depotRepo:     &repositories.DepotRepository{},
        objetRepo:     &repositories.ObjetRepository{},
        notifRepo:     &repositories.NotificationRepository{},
    }
}

func (s *ConteneurService) ListConteneurs() ([]models.Conteneur, error) {
    return s.conteneurRepo.ListAll()
}

func (s *ConteneurService) RequestDepot(particulierID, conteneurID, objetID uint) (*models.Depot, error) {
    // le conteneur doit exister et ne pas etre plein
    conteneur, err := s.conteneurRepo.GetByID(conteneurID)
    if err != nil || conteneur == nil {
        return nil, errors.New("conteneur introuvable")
    }
    if conteneur.Statut == "plein" {
        return nil, errors.New("conteneur plein")
    }
    // code temporaire en hex, 6 chars suffisent pour l'instant
    codeOuverture, _ := generateRandomCode(6)
    // code barre pour le retrait, format UC-<12 hex>
    codeBarre, _ := generateRandomCode(12)
    codeBarreData := fmt.Sprintf("UC-%s", codeBarre)

    depot := &models.Depot{
        CodeOuverture:    codeOuverture,
        CodeBarreRetrait: codeBarreData,
        IDParticulier:    particulierID,
        IDConteneur:      conteneurID,
        IDObjet:          objetID,
    }
    err = s.depotRepo.Create(depot)
    if err != nil {
        return nil, err
    }

    // image PNG du code barre, stockee dans uploads/barcodes/
    barcodeFile := fmt.Sprintf("uploads/barcodes/depot_%d.png", depot.ID)
    if _, errBC := utils.GenerateBarcode(codeBarreData, barcodeFile); errBC != nil {
        _ = errBC
    }

    // push + email au particulier avec le code barre
    go s.sendNotif(particulierID, "Dépôt enregistré",
        fmt.Sprintf("Votre dépôt est en attente de validation. Code d'ouverture : %s", codeOuverture))

    go func() {
        userRepo := &repositories.UserRepository{}
        user, err := userRepo.GetByID(particulierID)
        if err == nil && user.Email != "" {
            sujet := "UpcycleConnect – votre code barre de dépôt"
            corps := fmt.Sprintf(
                "Bonjour %s,\n\n"+
                    "Votre dépôt a bien été enregistré et est en attente de validation.\n\n"+
                    "Code d'ouverture du conteneur : %s\n"+
                    "Code barre de retrait : %s\n\n"+
                    "Présentez ce code barre lors du dépôt de votre objet.\n\n"+
                    "À bientôt,\nL'équipe UpcycleConnect",
                user.Prenom, codeOuverture, codeBarreData,
            )
            _ = utils.SendEmail(user.Email, sujet, corps)
        }
    }()

    return depot, nil
}

func (s *ConteneurService) ValidateDepot(depotID uint, adminID uint, accept bool, motif string) error {
    depot, err := s.depotRepo.GetByID(depotID)
    if err != nil || depot == nil {
        return errors.New("dépôt introuvable")
    }
    if depot.Statut != "en_attente" {
        return errors.New("dépôt déjà traité")
    }
    now := time.Now()
    if accept {
        err = s.depotRepo.UpdateStatus(depotID, "valide", &now, "")
        if err == nil {
            conteneur, _ := s.conteneurRepo.GetByID(depot.IDConteneur)
            if conteneur != nil {
                s.conteneurRepo.UpdateNbObjets(conteneur.ID, conteneur.NbObjets+1)
            }
            go s.sendNotif(depot.IDParticulier, "Depot valide",
                fmt.Sprintf("Votre depot a ete valide. Presentez le code barre %s pour deposer votre objet.", depot.CodeBarreRetrait))
        }
    } else {
        err = s.depotRepo.UpdateStatus(depotID, "refuse", nil, motif)
        if err == nil {
            msg := "Votre dépôt a été refusé."
            if motif != "" {
                msg += " Motif : " + motif
            }
            go s.sendNotif(depot.IDParticulier, "Dépôt refusé", msg)
        }
    }
    return err
}

func (s *ConteneurService) RecupererDepot(depotID uint) error {
	depot, err := s.depotRepo.GetByID(depotID)
	if err != nil || depot == nil {
		return errors.New("dépôt introuvable")
	}
	if depot.Statut != "valide" {
		return errors.New("dépôt non disponible pour récupération")
	}
	return s.depotRepo.UpdateRecuperationDate(depotID)
}

func (s *ConteneurService) ListDepotsUser(userID uint) ([]models.Depot, error) {
	return s.depotRepo.ListByParticulier(userID, 50, 0)
}

func (s *ConteneurService) RecupererDepotParCode(code string) (*models.Depot, error) {
	depot, err := s.depotRepo.GetByCodeBarre(code)
	if err != nil || depot == nil {
		return nil, errors.New("code barre introuvable")
	}
	if depot.Statut != "valide" {
		return nil, errors.New("dépôt non disponible pour récupération (statut: " + depot.Statut + ")")
	}
	if depot.DateValidation != nil && time.Now().After(depot.DateValidation.Add(7*24*time.Hour)) {
		_ = s.depotRepo.ExpireDepot(depot.ID)
		conteneur, _ := s.conteneurRepo.GetByID(depot.IDConteneur)
		if conteneur != nil && conteneur.NbObjets > 0 {
			_ = s.conteneurRepo.UpdateNbObjets(conteneur.ID, conteneur.NbObjets-1)
		}
		return nil, errors.New("délai de 7 jours dépassé : l'objet a été remis en stock")
	}
	if err := s.depotRepo.UpdateRecuperationDate(depot.ID); err != nil {
		return nil, err
	}
	depot.Statut = "recupere"
	conteneur, _ := s.conteneurRepo.GetByID(depot.IDConteneur)
	if conteneur != nil && conteneur.NbObjets > 0 {
		_ = s.conteneurRepo.UpdateNbObjets(conteneur.ID, conteneur.NbObjets-1)
	}
	return depot, nil
}

func (s *ConteneurService) ExpireOldDepots() {
	depots, err := s.depotRepo.ListExpiredValides()
	if err != nil {
		return
	}
	for _, d := range depots {
		_ = s.depotRepo.ExpireDepot(d.ID)
		conteneur, _ := s.conteneurRepo.GetByID(d.IDConteneur)
		if conteneur != nil && conteneur.NbObjets > 0 {
			_ = s.conteneurRepo.UpdateNbObjets(conteneur.ID, conteneur.NbObjets-1)
		}
	}
}

func (s *ConteneurService) UpdateStatutConteneur(id uint, statut string) error {
	valid := map[string]bool{"disponible": true, "plein": true, "en_maintenance": true}
	if !valid[statut] {
		return errors.New("statut invalide")
	}
	return s.conteneurRepo.UpdateStatut(id, statut)
}

func (s *ConteneurService) CreateConteneur(c *models.Conteneur) error {
	if c.Adresse == "" || c.Capacite <= 0 {
		return errors.New("adresse et capacité requis")
	}
	return s.conteneurRepo.Create(c)
}

func generateRandomCode(length int) (string, error) {
    bytes := make([]byte, length)
    if _, err := rand.Read(bytes); err != nil {
        return "", err
    }
    return hex.EncodeToString(bytes)[:length], nil
}