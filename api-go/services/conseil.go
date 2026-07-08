package services

// articles de conseil rediges par les salaries
// les articles arrivent en en_attente, l'admin valide ou refuse

import (
	"errors"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
)

type ConseilService struct{}

func NewConseilService() *ConseilService {
	return &ConseilService{}
}

func (s *ConseilService) ListPublies(lang string) ([]models.ArticleConseil, error) {
	rows, err := database.DB.Query(
		`SELECT c.id_conseil,
			COALESCE(MAX(t_titre.valeur_traduite), c.titre),
			COALESCE(MAX(t_contenu.valeur_traduite), c.contenu),
			c.statut, c.date_publication, c.id_salarie_redacteur, c.id_admin_validation, c.date_fin
		FROM conseil c
		LEFT JOIN traduction t_titre   ON t_titre.table_concernee   = 'conseil' AND t_titre.id_enregistrement   = c.id_conseil AND t_titre.champ   = 'titre'   AND t_titre.langue   = ?
		LEFT JOIN traduction t_contenu ON t_contenu.table_concernee = 'conseil' AND t_contenu.id_enregistrement = c.id_conseil AND t_contenu.champ = 'contenu' AND t_contenu.langue = ?
		WHERE c.statut = 'publie'
		GROUP BY c.id_conseil, c.titre, c.contenu, c.statut, c.date_publication, c.id_salarie_redacteur, c.id_admin_validation, c.date_fin
		ORDER BY c.date_publication DESC`,
		lang, lang,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var articles []models.ArticleConseil
	for rows.Next() {
		var a models.ArticleConseil
		rows.Scan(&a.ID, &a.Titre, &a.Contenu, &a.Statut, &a.DatePublication, &a.IDSalarieRedacteur, &a.IDAdminValidation, &a.DateFin)
		articles = append(articles, a)
	}
	return articles, nil
}

func (s *ConseilService) ListMesArticles(salarieID uint) ([]models.ArticleConseil, error) {
	rows, err := database.DB.Query(
		`SELECT id_conseil, titre, contenu, statut, date_publication, id_salarie_redacteur, id_admin_validation, date_fin
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
		rows.Scan(&a.ID, &a.Titre, &a.Contenu, &a.Statut, &a.DatePublication, &a.IDSalarieRedacteur, &a.IDAdminValidation, &a.DateFin)
		articles = append(articles, a)
	}
	return articles, nil
}

func (s *ConseilService) ListEnAttente() ([]models.ArticleConseil, error) {
	rows, err := database.DB.Query(
		`SELECT c.id_conseil, c.titre, c.contenu, c.statut, c.date_publication,
		        c.id_salarie_redacteur, c.date_fin,
		        CONCAT(COALESCE(u.prenom,''), ' ', COALESCE(u.nom,''))
		 FROM conseil c
		 LEFT JOIN utilisateur u ON u.id_utilisateur = c.id_salarie_redacteur
		 WHERE c.statut = 'en_attente'
		 ORDER BY c.date_publication ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var articles []models.ArticleConseil
	for rows.Next() {
		var a models.ArticleConseil
		rows.Scan(&a.ID, &a.Titre, &a.Contenu, &a.Statut, &a.DatePublication, &a.IDSalarieRedacteur, &a.DateFin, &a.Auteur)
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
		`INSERT INTO conseil (titre, contenu, statut, id_salarie_redacteur, date_fin) VALUES (?, ?, ?, ?, ?)`,
		article.Titre, article.Contenu, article.Statut, article.IDSalarieRedacteur, article.DateFin,
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
		`UPDATE conseil SET titre = ?, contenu = ?, date_fin = ?, statut = 'en_attente' WHERE id_conseil = ?`,
		article.Titre, article.Contenu, article.DateFin, article.ID,
	)
	return err
}

func (s *ConseilService) Valider(articleID uint, decision string, adminID uint) error {
	if decision != "publie" && decision != "refuse" {
		return errors.New("décision invalide")
	}
	var auteurID uint
	database.DB.QueryRow(`SELECT id_salarie_redacteur FROM conseil WHERE id_conseil = ?`, articleID).Scan(&auteurID)
	_, err := database.DB.Exec(
		`UPDATE conseil SET statut = ?, id_admin_validation = ? WHERE id_conseil = ?`,
		decision, adminID, articleID,
	)
	if err == nil && auteurID != 0 {
		notifSvc := NewNotificationService()
		if decision == "publie" {
			_ = notifSvc.SendNotification(auteurID,
				"Article publié !",
				"Votre article a été validé et est maintenant visible par la communauté.",
				"info", "push")
		} else {
			_ = notifSvc.SendNotification(auteurID,
				"Article refusé",
				"Votre article n'a pas été validé. Contactez un administrateur pour plus d'informations.",
				"warning", "push")
		}
	}
	return err
}

func (s *ConseilService) IncrVues(conseilID uint) {
	database.DB.Exec(`UPDATE conseil SET nb_vues = nb_vues + 1 WHERE id_conseil = ?`, conseilID)
}

func (s *ConseilService) ToggleLike(conseilID, userID uint) (liked bool, nbLikes int) {
	var exists int
	database.DB.QueryRow(
		`SELECT COUNT(*) FROM like_conseil WHERE id_conseil = ? AND id_utilisateur = ?`,
		conseilID, userID,
	).Scan(&exists)

	if exists > 0 {
		database.DB.Exec(`DELETE FROM like_conseil WHERE id_conseil = ? AND id_utilisateur = ?`, conseilID, userID)
		database.DB.Exec(`UPDATE conseil SET nb_likes = GREATEST(0, nb_likes - 1) WHERE id_conseil = ?`, conseilID)
		liked = false
	} else {
		database.DB.Exec(`INSERT INTO like_conseil (id_conseil, id_utilisateur) VALUES (?, ?)`, conseilID, userID)
		database.DB.Exec(`UPDATE conseil SET nb_likes = nb_likes + 1 WHERE id_conseil = ?`, conseilID)
		liked = true
	}
	database.DB.QueryRow(`SELECT nb_likes FROM conseil WHERE id_conseil = ?`, conseilID).Scan(&nbLikes)
	return
}

func (s *ConseilService) Delete(conseilID, salarieID uint) error {
	var ownerID uint
	err := database.DB.QueryRow(
		`SELECT id_salarie_redacteur FROM conseil WHERE id_conseil = ?`, conseilID,
	).Scan(&ownerID)
	if err != nil {
		return errors.New("article introuvable")
	}
	if ownerID != salarieID {
		return errors.New("vous n'êtes pas l'auteur de cet article")
	}
	_, err = database.DB.Exec(`DELETE FROM conseil WHERE id_conseil = ?`, conseilID)
	return err
}
