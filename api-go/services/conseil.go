package services

// articles de conseil rediges par les salaries
// les articles arrivent en en_attente, l'admin valide ou refuse
// FIXME: pas de notif quand l'admin valide ou refuse, a brancher

import (
	"errors"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
)

type ConseilService struct{}

func NewConseilService() *ConseilService {
	return &ConseilService{}
}

func (s *ConseilService) ListPublies() ([]models.ArticleConseil, error) {
	rows, err := database.DB.Query(
		`SELECT id_conseil, titre, contenu, statut, date_publication, id_salarie_redacteur, id_admin_validation
         FROM conseil WHERE statut = 'publie' ORDER BY date_publication DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var articles []models.ArticleConseil
	for rows.Next() {
		var a models.ArticleConseil
		rows.Scan(&a.ID, &a.Titre, &a.Contenu, &a.Statut, &a.DatePublication, &a.IDSalarieRedacteur, &a.IDAdminValidation)
		articles = append(articles, a)
	}
	return articles, nil
}

func (s *ConseilService) ListMesArticles(salarieID uint) ([]models.ArticleConseil, error) {
	rows, err := database.DB.Query(
		`SELECT id_conseil, titre, contenu, statut, date_publication, id_salarie_redacteur, id_admin_validation
         FROM conseil WHERE id_salarie_redacteur = ? ORDER BY date_publication DESC`,
		salarieID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var articles []models.ArticleConseil
	for rows.Next() {
		var a models.ArticleConseil
		rows.Scan(&a.ID, &a.Titre, &a.Contenu, &a.Statut, &a.DatePublication, &a.IDSalarieRedacteur, &a.IDAdminValidation)
		articles = append(articles, a)
	}
	return articles, nil
}

func (s *ConseilService) Create(article *models.ArticleConseil) error {
	if article.Titre == "" || article.Contenu == "" {
		return errors.New("titre et contenu sont obligatoires")
	}
	article.Statut = "en_attente"
	result, err := database.DB.Exec(
		`INSERT INTO conseil (titre, contenu, statut, id_salarie_redacteur) VALUES (?, ?, ?, ?)`,
		article.Titre, article.Contenu, article.Statut, article.IDSalarieRedacteur,
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	article.ID = uint(id)
	return nil
}

func (s *ConseilService) Update(article *models.ArticleConseil, salarieID uint) error {
	existing := &models.ArticleConseil{}
	err := database.DB.QueryRow(
		`SELECT id_conseil, statut, id_salarie_redacteur FROM conseil WHERE id_conseil = ?`, article.ID,
	).Scan(&existing.ID, &existing.Statut, &existing.IDSalarieRedacteur)
	if err != nil {
		return errors.New("article introuvable")
	}
	if existing.IDSalarieRedacteur != salarieID {
		return errors.New("vous n'êtes pas l'auteur de cet article")
	}
	if existing.Statut == "publie" {
		return errors.New("un article publié ne peut pas être modifié")
	}
	_, err = database.DB.Exec(
		`UPDATE conseil SET titre = ?, contenu = ?, statut = 'en_attente' WHERE id_conseil = ?`,
		article.Titre, article.Contenu, article.ID,
	)
	return err
}

func (s *ConseilService) Valider(articleID uint, decision string, adminID uint) error {
	if decision != "publie" && decision != "refuse" {
		return errors.New("décision invalide")
	}
	_, err := database.DB.Exec(
		`UPDATE conseil SET statut = ?, id_admin_validation = ? WHERE id_conseil = ?`,
		decision, adminID, articleID,
	)
	return err
}
