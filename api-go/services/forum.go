package services

// messages du forum communautaire
// les roles sont verifies dans le handler, ici on gere juste le statut visible/supprime

import (
	"errors"
	"fmt"
	"time"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
)

type SignalementResult struct {
	ID             uint   `json:"id"`
	IDMessage      uint   `json:"id_message"`
	Type           string `json:"type"`
	Auteur         string `json:"auteur"`
	Forum          string `json:"forum"`
	Detail         string `json:"detail"`
	IlYA           string `json:"il_y_a"`
	NbSignalements int    `json:"nb_signalements"`
	Severite       string `json:"severite"`
}

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

// AddSignalement insère un signalement et masque le message
func (s *ForumService) AddSignalement(messageID, rapporteurID uint, raison string) error {
	var exists int
	database.DB.QueryRow(`SELECT COUNT(*) FROM message WHERE id_message = ?`, messageID).Scan(&exists)
	if exists == 0 {
		return errors.New("message introuvable")
	}
	_, err := database.DB.Exec(
		`INSERT INTO signalement (id_message, id_rapporteur, raison) VALUES (?, ?, ?)`,
		messageID, rapporteurID, raison,
	)
	if err != nil {
		return err
	}
	_, err = database.DB.Exec(`UPDATE message SET statut = 'signale' WHERE id_message = ? AND statut = 'visible'`, messageID)
	return err
}

// ListSignalements retourne les messages non traités groupés par message
func (s *ForumService) ListSignalements() ([]SignalementResult, error) {
	rows, err := database.DB.Query(`
		SELECT m.id_message,
		       COALESCE(u.nom,''), COALESCE(u.prenom,''),
		       m.contenu,
		       COUNT(sg.id_signalement) AS nb,
		       MIN(sg.date_signalement) AS premiere
		FROM signalement sg
		JOIN message m ON sg.id_message = m.id_message
		JOIN utilisateur u ON m.id_utilisateur = u.id_utilisateur
		WHERE sg.traite = 0
		GROUP BY m.id_message, u.nom, u.prenom, m.contenu
		ORDER BY nb DESC, premiere ASC
		LIMIT 50`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SignalementResult
	for rows.Next() {
		var messageID uint
		var nom, prenom, contenu string
		var nb int
		var premiere time.Time
		if err := rows.Scan(&messageID, &nom, &prenom, &contenu, &nb, &premiere); err != nil {
			continue
		}
		detail := contenu
		if len(detail) > 100 {
			detail = detail[:100] + "..."
		}
		severite := "warning"
		if nb > 2 {
			severite = "danger"
		}
		results = append(results, SignalementResult{
			ID:             messageID,
			IDMessage:      messageID,
			Type:           "Contenu signalé",
			Auteur:         fmt.Sprintf("%s %s", prenom, nom),
			Forum:          "Forum général",
			Detail:         detail,
			IlYA:           ilYA(premiere),
			NbSignalements: nb,
			Severite:       severite,
		})
	}
	if results == nil {
		results = []SignalementResult{}
	}
	return results, nil
}

// MarquerTraite clôt tous les signalements d'un message
func (s *ForumService) MarquerTraite(messageID uint) error {
	_, err := database.DB.Exec(`UPDATE signalement SET traite = 1 WHERE id_message = ?`, messageID)
	return err
}

func ilYA(t time.Time) string {
	d := time.Since(t)
	switch {
	case d < time.Hour:
		return fmt.Sprintf("%d min", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh", int(d.Hours()))
	default:
		return fmt.Sprintf("%dj", int(d.Hours()/24))
	}
}
