package services

// envoi et lecture des notifications
// le canal push passe par OneSignal, les autres (email, sms) pas encore branches
// TODO: ajouter canal "email" avec un template HTML basique

import (
    "upcycleconnect/api/models"
    "upcycleconnect/api/repositories"
    "upcycleconnect/api/utils"
)

type NotificationService struct {
    repo *repositories.NotificationRepository
}

func NewNotificationService() *NotificationService {
    return &NotificationService{repo: &repositories.NotificationRepository{}}
}

func (s *NotificationService) SendNotification(userID uint, title, message, notifType, canal string) error {
    notif := &models.Notification{
        Titre:        title,
        Contenu:      message,
        Type:         notifType,
        Canal:        canal,
        IDUtilisateur: userID,
    }
    // on essaie OneSignal, si ca rate on enregistre quand meme en base
    if canal == "push" {
        err := utils.SendPushNotification(userID, title, message)
        if err == nil {
            notif.RefOneSignal = "sent"
        }
    }
    return s.repo.Create(notif)
}

func (s *NotificationService) GetUserNotifications(userID uint, page, pageSize int) ([]models.Notification, error) {
    offset := (page - 1) * pageSize
    return s.repo.ListByUser(userID, pageSize, offset)
}

func (s *NotificationService) MarkAsRead(id uint) error {
    return s.repo.MarkAsRead(id)
}

func (s *NotificationService) MarkAllAsRead(userID uint) error {
    return s.repo.MarkAllAsRead(userID)
}

func (s *NotificationService) BroadcastToSegment(segment, titre, message string) (int, error) {
    userRepo := &repositories.UserRepository{}
    ids, err := userRepo.ListIDsByRole(segment)
    if err != nil {
        return 0, err
    }
    count, err := s.repo.BulkCreate(titre, message, "info", "push", ids)
    if err != nil {
        return 0, err
    }
    // envoi push OneSignal (best-effort, ne bloque pas si les clés manquent)
    _ = utils.BroadcastPushNotification(segment, titre, message)
    return count, nil
}