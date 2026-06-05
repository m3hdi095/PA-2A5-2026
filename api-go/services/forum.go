package services

// messages du forum communautaire
// les roles sont verifies dans le handler, ici on gere juste le statut visible/supprime
// FIXME: pas de table signalement dans la BDD pour l'instant, la modération est simplifiée

import (
	"errors"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
)

type ForumService struct{}

func NewForumService() *ForumService {
	return &ForumService{}
}

// messages visibles d'un forum, pagines par 30
func (s *ForumService) ListMessages(forumID uint, page, pageSize int) ([]models.ForumMessage, error) {
	offset := (page - 1) * pageSize
	rows, err := database.DB.Query(
		`SELECT id_message, contenu, date_envoi, statut, id_utilisateur, id_forum, id_parent_message
         FROM message WHERE id_forum = ? AND statut = 'visible'
         ORDER BY date_envoi DESC LIMIT ? OFFSET ?`,
		forumID, pageSize, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []models.ForumMessage
	for rows.Next() {
		var m models.ForumMessage
		rows.Scan(&m.ID, &m.Contenu, &m.DateEnvoi, &m.Statut, &m.IDUtilisateur, &m.IDForum, &m.IDParentMessage)
		messages = append(messages, m)
	}
	return messages, nil
}

func (s *ForumService) PostMessage(msg *models.ForumMessage) error {
	if msg.Contenu == "" {
		return errors.New("le contenu ne peut pas être vide")
	}
	if msg.IDForum == 0 {
		return errors.New("id_forum est obligatoire")
	}
	result, err := database.DB.Exec(
		`INSERT INTO message (contenu, id_utilisateur, id_forum, id_parent_message) VALUES (?, ?, ?, ?)`,
		msg.Contenu, msg.IDUtilisateur, msg.IDForum, msg.IDParentMessage,
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	msg.ID = uint(id)
	return nil
}

// Signaler masque le message, utilise par les moderateurs
func (s *ForumService) Signaler(messageID uint) error {
	var exists int
	database.DB.QueryRow(`SELECT COUNT(*) FROM message WHERE id_message = ?`, messageID).Scan(&exists)
	if exists == 0 {
		return errors.New("message introuvable")
	}
	_, err := database.DB.Exec(`UPDATE message SET statut = 'supprime' WHERE id_message = ?`, messageID)
	return err
}

// remet visible, appelé via TraiterSignalement avec action='restaurer'
func (s *ForumService) Restaurer(messageID uint) error {
	_, err := database.DB.Exec(`UPDATE message SET statut = 'visible' WHERE id_message = ?`, messageID)
	return err
}
