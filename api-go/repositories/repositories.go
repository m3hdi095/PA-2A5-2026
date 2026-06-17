package repositories

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"upcycleconnect/api/database"
	"upcycleconnect/api/models"
)

//  UTILISATEUR

type UserRepository struct{}

func (r *UserRepository) GetByID(id uint) (*models.Utilisateur, error) {
	query := `SELECT u.id_utilisateur, u.email, u.nom, u.prenom, u.role,
	          COALESCE(u.adresse,''), COALESCE(u.ville,''), COALESCE(u.code_postal,''), COALESCE(u.telephone,''),
	          u.date_inscription, u.actif, u.tutoriel_vu, COALESCE(u.langue_preferee,'fr'),
	          COALESCE(pro.niveau_abonnement,''),
	          COALESCE(pro.nom_entreprise,''), COALESCE(pro.siret,''), COALESCE(pro.type_metier,''),
	          COALESCE(par.upcycling_score_total, 0)
              FROM utilisateur u
              LEFT JOIN professionnel pro ON pro.id_professionnel = u.id_utilisateur
              LEFT JOIN particulier par ON par.id_particulier = u.id_utilisateur
              WHERE u.id_utilisateur = ?`
	row := database.DB.QueryRow(query, id)
	var u models.Utilisateur
	err := row.Scan(&u.ID, &u.Email, &u.Nom, &u.Prenom, &u.Role, &u.Adresse, &u.Ville, &u.CodePostal, &u.Telephone, &u.DateInscription, &u.Actif, &u.TutorielVu, &u.LanguePreferee, &u.Plan, &u.Entreprise, &u.Siret, &u.TypeMetier, &u.UpcyclingScore)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &u, err
}

func (r *UserRepository) UpdateProfessionnel(id uint, nomEntreprise, siret, typeMetier string) error {
	_, err := database.DB.Exec(
		`UPDATE professionnel SET nom_entreprise=?, siret=?, type_metier=? WHERE id_professionnel=?`,
		nomEntreprise, siret, typeMetier, id,
	)
	return err
}

func (r *UserRepository) GetByEmail(email string) (*models.Utilisateur, error) {
	query := `SELECT id_utilisateur, email, mot_de_passe, nom, prenom, role,
	          COALESCE(adresse,''), COALESCE(ville,''), COALESCE(code_postal,''), COALESCE(telephone,''),
	          date_inscription, actif, tutoriel_vu, COALESCE(langue_preferee,'fr')
              FROM utilisateur WHERE email = ?`
	row := database.DB.QueryRow(query, email)
	var u models.Utilisateur
	err := row.Scan(&u.ID, &u.Email, &u.MotDePasse, &u.Nom, &u.Prenom, &u.Role, &u.Adresse, &u.Ville, &u.CodePostal, &u.Telephone, &u.DateInscription, &u.Actif, &u.TutorielVu, &u.LanguePreferee)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &u, err
}

func (r *UserRepository) Create(user *models.Utilisateur) error {
	query := `INSERT INTO utilisateur (email, mot_de_passe, nom, prenom, role, adresse, ville, code_postal, telephone, langue_preferee)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := database.DB.Exec(query, user.Email, user.MotDePasse, user.Nom, user.Prenom, user.Role,
		user.Adresse, user.Ville, user.CodePostal, user.Telephone, user.LanguePreferee)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	user.ID = uint(id)

	// créer la ligne dans la table de rôle correspondante
	switch user.Role {
	case "particulier":
		database.DB.Exec(`INSERT IGNORE INTO particulier (id_particulier, upcycling_score_total) VALUES (?, 0)`, user.ID)
	case "professionnel":
		database.DB.Exec(`INSERT IGNORE INTO professionnel (id_professionnel, nom_entreprise, siret, type_metier, niveau_abonnement) VALUES (?, '', '', '', 'free')`, user.ID)
	}
	return nil
}

func (r *UserRepository) Update(user *models.Utilisateur) error {
	query := `UPDATE utilisateur SET nom=?, prenom=?, adresse=?, ville=?, code_postal=?, telephone=?, langue_preferee=?
              WHERE id_utilisateur=?`
	_, err := database.DB.Exec(query, user.Nom, user.Prenom, user.Adresse, user.Ville, user.CodePostal, user.Telephone, user.LanguePreferee, user.ID)
	return err
}

func (r *UserRepository) UpdateTutorialSeen(id uint) error {
	_, err := database.DB.Exec("UPDATE utilisateur SET tutoriel_vu = 1 WHERE id_utilisateur = ?", id)
	return err
}

func (r *UserRepository) UpdateActivation(id uint, actif bool) error {
	_, err := database.DB.Exec("UPDATE utilisateur SET actif = ? WHERE id_utilisateur = ?", actif, id)
	return err
}

func (r *UserRepository) GetPasswordHash(id uint) (string, error) {
	var hash string
	err := database.DB.QueryRow("SELECT mot_de_passe FROM utilisateur WHERE id_utilisateur = ?", id).Scan(&hash)
	return hash, err
}

func (r *UserRepository) UpdatePassword(id uint, hashedPwd string) error {
	_, err := database.DB.Exec("UPDATE utilisateur SET mot_de_passe = ? WHERE id_utilisateur = ?", hashedPwd, id)
	return err
}

func (r *UserRepository) ListAll(limit, offset int) ([]models.Utilisateur, error) {
	query := `
		SELECT u.id_utilisateur, u.email, u.nom, u.prenom, u.role,
		       COALESCE(u.telephone,''), COALESCE(u.adresse,''),
		       u.date_inscription, u.actif,
		       COALESCE(p.upcycling_score_total, 0)
		FROM utilisateur u
		LEFT JOIN particulier p ON p.id_particulier = u.id_utilisateur
		ORDER BY u.date_inscription DESC
		LIMIT ? OFFSET ?`
	rows, err := database.DB.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := make([]models.Utilisateur, 0)
	for rows.Next() {
		var u models.Utilisateur
		if err := rows.Scan(&u.ID, &u.Email, &u.Nom, &u.Prenom, &u.Role,
			&u.Telephone, &u.Adresse, &u.DateInscription, &u.Actif, &u.UpcyclingScore); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *UserRepository) ListIDsByRole(role string) ([]uint, error) {
	var (
		rows *sql.Rows
		err  error
	)
	if role == "tous" {
		rows, err = database.DB.Query("SELECT id_utilisateur FROM utilisateur WHERE actif = 1")
	} else {
		rows, err = database.DB.Query("SELECT id_utilisateur FROM utilisateur WHERE role = ? AND actif = 1", role)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []uint
	for rows.Next() {
		var id uint
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

//  ANNONCE

type AnnonceRepository struct{}

func (r *AnnonceRepository) Create(annonce *models.Annonce) error {
	query := `INSERT INTO annonce (titre, description, type_annonce, prix, localisation, date_publication, statut, id_utilisateur, id_objet)
              VALUES (?, ?, ?, ?, ?, NOW(), 'en_attente', ?, ?)`
	result, err := database.DB.Exec(query, annonce.Titre, annonce.Description, annonce.TypeAnnonce, annonce.Prix, annonce.Localisation, annonce.IDUtilisateur, annonce.IDObjet)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	annonce.ID = uint(id)
	return nil
}

func (r *AnnonceRepository) GetByID(id uint) (*models.Annonce, error) {
	query := `SELECT a.id_annonce, a.titre, a.description, a.type_annonce, a.prix, a.date_publication, a.statut, a.id_utilisateur, a.id_objet,
	          COALESCE(c.nom, ''), CONCAT(COALESCE(u.prenom,''), ' ', COALESCE(u.nom,'')),
	          COALESCE(a.localisation, u.ville, '')
              FROM annonce a
              LEFT JOIN objet o ON a.id_objet = o.id_objet
              LEFT JOIN categorie c ON o.categorie_id = c.id_categorie
              LEFT JOIN utilisateur u ON u.id_utilisateur = a.id_utilisateur
              WHERE a.id_annonce = ?`
	row := database.DB.QueryRow(query, id)
	var a models.Annonce
	err := row.Scan(&a.ID, &a.Titre, &a.Description, &a.TypeAnnonce, &a.Prix, &a.DatePublication, &a.Statut, &a.IDUtilisateur, &a.IDObjet, &a.Categorie, &a.Auteur, &a.Localisation)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &a, err
}

func (r *AnnonceRepository) List(filter string, limit, offset int, lang string) ([]models.Annonce, error) {
	query := `SELECT a.id_annonce,
		COALESCE(MAX(t_titre.valeur_traduite), a.titre),
		COALESCE(MAX(t_desc.valeur_traduite), a.description),
		a.type_annonce, a.prix, a.date_publication, a.statut, a.id_utilisateur, a.id_objet, COALESCE(MAX(c.nom), ''),
		CONCAT(COALESCE(MAX(u.prenom),''), ' ', COALESCE(MAX(u.nom),'')),
		COALESCE(a.localisation, MAX(u.ville), ''),
		COUNT(DISTINCT ma.id)
	FROM annonce a
	LEFT JOIN objet o ON a.id_objet = o.id_objet
	LEFT JOIN categorie c ON o.categorie_id = c.id_categorie
	LEFT JOIN traduction t_titre ON t_titre.table_concernee = 'annonce' AND t_titre.id_enregistrement = a.id_annonce AND t_titre.champ = 'titre' AND t_titre.langue = ?
	LEFT JOIN traduction t_desc  ON t_desc.table_concernee  = 'annonce' AND t_desc.id_enregistrement  = a.id_annonce AND t_desc.champ  = 'description' AND t_desc.langue  = ?
	LEFT JOIN utilisateur u ON u.id_utilisateur = a.id_utilisateur
	LEFT JOIN message_annonce ma ON ma.id_annonce = a.id_annonce
	WHERE a.statut = 'validee'
	AND (a.date_expiration IS NULL OR a.date_expiration > NOW())
	GROUP BY a.id_annonce, a.titre, a.description, a.type_annonce, a.prix, a.date_publication, a.date_expiration, a.statut, a.id_utilisateur, a.id_objet, a.localisation
	ORDER BY a.date_publication DESC LIMIT ? OFFSET ?`
	args := []interface{}{lang, lang, limit, offset}
	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	annonces := make([]models.Annonce, 0)
	for rows.Next() {
		var a models.Annonce
		err := rows.Scan(&a.ID, &a.Titre, &a.Description, &a.TypeAnnonce, &a.Prix, &a.DatePublication, &a.Statut, &a.IDUtilisateur, &a.IDObjet, &a.Categorie, &a.Auteur, &a.Localisation, &a.NbMessages)
		if err != nil {
			return nil, err
		}
		annonces = append(annonces, a)
	}
	return annonces, nil
}

func (r *AnnonceRepository) ListByUser(userID uint, limit, offset int) ([]models.Annonce, error) {
	query := `SELECT a.id_annonce, a.titre, a.description, a.type_annonce, a.prix, a.date_publication, a.date_expiration, a.statut, a.id_utilisateur, a.id_objet, COALESCE(c.nom, '')
              FROM annonce a
              LEFT JOIN objet o ON a.id_objet = o.id_objet
              LEFT JOIN categorie c ON o.categorie_id = c.id_categorie
              WHERE a.id_utilisateur = ? ORDER BY a.date_publication DESC LIMIT ? OFFSET ?`
	rows, err := database.DB.Query(query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	annonces := make([]models.Annonce, 0)
	for rows.Next() {
		var a models.Annonce
		err := rows.Scan(&a.ID, &a.Titre, &a.Description, &a.TypeAnnonce, &a.Prix, &a.DatePublication, &a.DateExpiration, &a.Statut, &a.IDUtilisateur, &a.IDObjet, &a.Categorie)
		if err != nil {
			return nil, err
		}
		annonces = append(annonces, a)
	}
	return annonces, nil
}

func (r *AnnonceRepository) Update(annonce *models.Annonce) error {
	query := `UPDATE annonce SET titre=?, description=?, type_annonce=?, prix=?, localisation=? WHERE id_annonce=?`
	_, err := database.DB.Exec(query, annonce.Titre, annonce.Description, annonce.TypeAnnonce, annonce.Prix, annonce.Localisation, annonce.ID)
	return err
}

func (r *AnnonceRepository) UpdateStatus(id uint, statut string) error {
	_, err := database.DB.Exec("UPDATE annonce SET statut = ? WHERE id_annonce = ?", statut, id)
	return err
}

func (r *AnnonceRepository) Delete(id uint) error {
	return r.UpdateStatus(id, "archivee")
}

//  CONTENEUR

type ConteneurRepository struct{}

func (r *ConteneurRepository) ListAll() ([]models.Conteneur, error) {
	rows, err := database.DB.Query("SELECT id_conteneur, adresse, ville, latitude, longitude, capacite, nb_objets, statut FROM conteneur")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	conteneurs := make([]models.Conteneur, 0)
	for rows.Next() {
		var c models.Conteneur
		err := rows.Scan(&c.ID, &c.Adresse, &c.Ville, &c.Latitude, &c.Longitude, &c.Capacite, &c.NbObjets, &c.Statut)
		if err != nil {
			return nil, err
		}
		conteneurs = append(conteneurs, c)
	}
	return conteneurs, nil
}

func (r *ConteneurRepository) GetByID(id uint) (*models.Conteneur, error) {
	row := database.DB.QueryRow("SELECT id_conteneur, adresse, ville, latitude, longitude, capacite, nb_objets, statut FROM conteneur WHERE id_conteneur = ?", id)
	var c models.Conteneur
	err := row.Scan(&c.ID, &c.Adresse, &c.Ville, &c.Latitude, &c.Longitude, &c.Capacite, &c.NbObjets, &c.Statut)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &c, err
}

//  DÉPÔT

type DepotRepository struct{}

func (r *DepotRepository) Create(depot *models.Depot) error {
	query := `INSERT INTO depot (statut, date_demande, code_ouverture, code_barre_retrait, id_particulier, id_conteneur, id_objet)
              VALUES ('en_attente', NOW(), ?, ?, ?, ?, ?)`
	result, err := database.DB.Exec(query, depot.CodeOuverture, depot.CodeBarreRetrait, depot.IDParticulier, depot.IDConteneur, depot.IDObjet)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	depot.ID = uint(id)
	depot.Statut = "en_attente"
	now := time.Now()
	depot.DateDemande = now
	return nil
}

func (r *DepotRepository) UpdateStatus(id uint, statut string, dateValidation *time.Time, motifRefus string) error {
	query := "UPDATE depot SET statut = ?, date_validation = ?, motif_refus = ? WHERE id_depot = ?"
	_, err := database.DB.Exec(query, statut, dateValidation, motifRefus, id)
	return err
}

func (r *DepotRepository) UpdateDepotDate(id uint, dateDepot time.Time) error {
	_, err := database.DB.Exec("UPDATE depot SET statut = 'depose', date_depot = ? WHERE id_depot = ?", dateDepot, id)
	return err
}

func (r *DepotRepository) UpdateRecuperation(id uint, dateRecup time.Time) error {
	_, err := database.DB.Exec("UPDATE depot SET statut = 'recupere', date_recuperation = ? WHERE id_depot = ?", dateRecup, id)
	return err
}

func (r *DepotRepository) GetByID(id uint) (*models.Depot, error) {
	row := database.DB.QueryRow("SELECT id_depot, statut, date_demande, date_validation, date_depot, date_recuperation, code_ouverture, code_barre_retrait, motif_refus, id_particulier, id_conteneur, id_objet FROM depot WHERE id_depot = ?", id)
	var d models.Depot
	err := row.Scan(&d.ID, &d.Statut, &d.DateDemande, &d.DateValidation, &d.DateDepot, &d.DateRecuperation, &d.CodeOuverture, &d.CodeBarreRetrait, &d.MotifRefus, &d.IDParticulier, &d.IDConteneur, &d.IDObjet)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &d, err
}

func (r *DepotRepository) ListByParticulier(particulierID uint, limit, offset int) ([]models.Depot, error) {
	rows, err := database.DB.Query(`
		SELECT d.id_depot, d.statut, d.date_demande, d.date_validation, d.date_depot, d.date_recuperation,
		       d.code_ouverture, d.code_barre_retrait, d.motif_refus, d.id_particulier, d.id_conteneur, d.id_objet,
		       COALESCE(c.adresse,''), COALESCE(c.ville,'')
		FROM depot d
		LEFT JOIN conteneur c ON c.id_conteneur = d.id_conteneur
		WHERE d.id_particulier = ?
		ORDER BY d.date_demande DESC LIMIT ? OFFSET ?`, particulierID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	depots := make([]models.Depot, 0)
	for rows.Next() {
		var d models.Depot
		err := rows.Scan(&d.ID, &d.Statut, &d.DateDemande, &d.DateValidation, &d.DateDepot, &d.DateRecuperation,
			&d.CodeOuverture, &d.CodeBarreRetrait, &d.MotifRefus, &d.IDParticulier, &d.IDConteneur, &d.IDObjet,
			&d.AdresseConteneur, &d.VilleConteneur)
		if err != nil {
			return nil, err
		}
		depots = append(depots, d)
	}
	return depots, nil
}

//  PROJET

type ProjetRepository struct{}

func (r *ProjetRepository) Create(projet *models.ProjetUpcycling) error {
	query := `INSERT INTO projet_upcycling (titre, description, date_debut, date_fin, statut, score_impact, kg_dechets_evites, partage_communaute, id_utilisateur)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := database.DB.Exec(query, projet.Titre, projet.Description, projet.DateDebut, projet.DateFin, projet.Statut, projet.ScoreImpact, projet.KgDechetsEvites, projet.PartageCommunaute, projet.IDUtilisateur)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	projet.ID = uint(id)
	return nil
}

func (r *ProjetRepository) GetByID(id uint) (*models.ProjetUpcycling, error) {
	row := database.DB.QueryRow("SELECT id_projet, titre, COALESCE(description,''), COALESCE(date_debut, CURDATE()), COALESCE(date_fin, CURDATE()), statut, score_impact, COALESCE(kg_dechets_evites,0), partage_communaute, id_utilisateur FROM projet_upcycling WHERE id_projet = ?", id)
	var p models.ProjetUpcycling
	err := row.Scan(&p.ID, &p.Titre, &p.Description, &p.DateDebut, &p.DateFin, &p.Statut, &p.ScoreImpact, &p.KgDechetsEvites, &p.PartageCommunaute, &p.IDUtilisateur)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &p, err
}

func (r *ProjetRepository) ListByUser(userID uint, limit, offset int) ([]models.ProjetUpcycling, error) {
	rows, err := database.DB.Query("SELECT id_projet, titre, COALESCE(description,''), COALESCE(date_debut, CURDATE()), COALESCE(date_fin, CURDATE()), statut, score_impact, COALESCE(kg_dechets_evites,0), partage_communaute, id_utilisateur FROM projet_upcycling WHERE id_utilisateur = ? ORDER BY date_debut DESC LIMIT ? OFFSET ?", userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projets := make([]models.ProjetUpcycling, 0)
	for rows.Next() {
		var p models.ProjetUpcycling
		err := rows.Scan(&p.ID, &p.Titre, &p.Description, &p.DateDebut, &p.DateFin, &p.Statut, &p.ScoreImpact, &p.KgDechetsEvites, &p.PartageCommunaute, &p.IDUtilisateur)
		if err != nil {
			return nil, err
		}
		projets = append(projets, p)
	}
	return projets, nil
}

func (r *ProjetRepository) ListPublic(limit, offset int) ([]models.ProjetUpcycling, error) {
	rows, err := database.DB.Query("SELECT id_projet, titre, COALESCE(description,''), COALESCE(date_debut, CURDATE()), COALESCE(date_fin, CURDATE()), statut, score_impact, COALESCE(kg_dechets_evites,0), partage_communaute, id_utilisateur FROM projet_upcycling WHERE partage_communaute = 1 AND statut = 'valide' ORDER BY date_debut DESC LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projets := make([]models.ProjetUpcycling, 0)
	for rows.Next() {
		var p models.ProjetUpcycling
		err := rows.Scan(&p.ID, &p.Titre, &p.Description, &p.DateDebut, &p.DateFin, &p.Statut, &p.ScoreImpact, &p.KgDechetsEvites, &p.PartageCommunaute, &p.IDUtilisateur)
		if err != nil {
			return nil, err
		}
		projets = append(projets, p)
	}
	return projets, nil
}

func (r *ProjetRepository) UpdateStatut(id, userID uint, statut string) error {
	res, err := database.DB.Exec(`UPDATE projet_upcycling SET statut = ? WHERE id_projet = ? AND id_utilisateur = ?`, statut, id, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errors.New("projet introuvable ou accès interdit")
	}
	return nil
}

func (r *ProjetRepository) ListEnAttente() ([]models.ProjetUpcycling, error) {
	rows, err := database.DB.Query(`SELECT id_projet, titre, COALESCE(description,''), COALESCE(date_debut, CURDATE()), COALESCE(date_fin, CURDATE()), statut, score_impact, COALESCE(kg_dechets_evites,0), partage_communaute, id_utilisateur FROM projet_upcycling WHERE partage_communaute = 1 AND statut = 'en_attente' ORDER BY date_debut DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projets := make([]models.ProjetUpcycling, 0)
	for rows.Next() {
		var p models.ProjetUpcycling
		if err := rows.Scan(&p.ID, &p.Titre, &p.Description, &p.DateDebut, &p.DateFin, &p.Statut, &p.ScoreImpact, &p.KgDechetsEvites, &p.PartageCommunaute, &p.IDUtilisateur); err != nil {
			return nil, err
		}
		projets = append(projets, p)
	}
	return projets, nil
}

func (r *ProjetRepository) AdminUpdateStatut(id uint, statut string) error {
	_, err := database.DB.Exec(`UPDATE projet_upcycling SET statut = ? WHERE id_projet = ?`, statut, id)
	return err
}

//  ÉTAPE PROJET

type EtapeProjetRepository struct{}

func (r *EtapeProjetRepository) Create(etape *models.EtapeProjet) error {
	query := `INSERT INTO etape_projet (titre, description, ordre, date_etape, photo_url, id_projet)
              VALUES (?, ?, ?, ?, ?, ?)`
	result, err := database.DB.Exec(query, etape.Titre, etape.Description, etape.Ordre, etape.DateEtape, etape.PhotoURL, etape.IDProjet)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	etape.ID = uint(id)
	return nil
}

//  ÉVÉNEMENT

type EvenementRepository struct{}

func (r *EvenementRepository) Create(evenement *models.Evenement) error {
	query := `INSERT INTO evenement (titre, type, description, date_debut, date_fin, lieu, tarif, nb_places, statut, id_salarie_createur)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'en_attente', ?)`
	result, err := database.DB.Exec(query, evenement.Titre, evenement.Type, evenement.Description, evenement.DateDebut, evenement.DateFin, evenement.Lieu, evenement.Tarif, evenement.NbPlaces, evenement.IDSalarieCreateur)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	evenement.ID = uint(id)
	return nil
}

func (r *EvenementRepository) GetByID(id uint) (*models.Evenement, error) {
	row := database.DB.QueryRow("SELECT id_evenement, titre, type, description, date_debut, date_fin, lieu, tarif, nb_places, statut, id_salarie_createur FROM evenement WHERE id_evenement = ?", id)
	var e models.Evenement
	err := row.Scan(&e.ID, &e.Titre, &e.Type, &e.Description, &e.DateDebut, &e.DateFin, &e.Lieu, &e.Tarif, &e.NbPlaces, &e.Statut, &e.IDSalarieCreateur)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &e, err
}

func (r *EvenementRepository) ListPublic(limit, offset int) ([]models.Evenement, error) {
	rows, err := database.DB.Query("SELECT id_evenement, titre, type, description, date_debut, date_fin, lieu, tarif, nb_places, statut, id_salarie_createur FROM evenement WHERE statut = 'valide' AND date_debut > NOW() ORDER BY date_debut ASC LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]models.Evenement, 0)
	for rows.Next() {
		var e models.Evenement
		err := rows.Scan(&e.ID, &e.Titre, &e.Type, &e.Description, &e.DateDebut, &e.DateFin, &e.Lieu, &e.Tarif, &e.NbPlaces, &e.Statut, &e.IDSalarieCreateur)
		if err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

func (r *EvenementRepository) ListAll(limit, offset int) ([]models.Evenement, error) {
	rows, err := database.DB.Query(
		`SELECT e.id_evenement, e.titre, e.type, e.description, e.date_debut, e.date_fin, e.lieu, e.tarif, e.nb_places, e.statut, e.id_salarie_createur,
		        COUNT(DISTINCT i.id_inscription) AS nb_inscriptions
		 FROM evenement e
		 LEFT JOIN inscription i ON i.id_evenement = e.id_evenement AND i.statut != 'annule'
		 GROUP BY e.id_evenement
		 ORDER BY e.date_debut DESC LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]models.Evenement, 0)
	for rows.Next() {
		var e models.Evenement
		if err := rows.Scan(&e.ID, &e.Titre, &e.Type, &e.Description, &e.DateDebut, &e.DateFin, &e.Lieu, &e.Tarif, &e.NbPlaces, &e.Statut, &e.IDSalarieCreateur, &e.NbInscriptions); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

func (r *EvenementRepository) ListByCreator(salarieID uint) ([]models.Evenement, error) {
	rows, err := database.DB.Query(
		`SELECT e.id_evenement, e.titre, e.type, e.description, e.date_debut, e.date_fin, e.lieu, e.tarif, e.nb_places, e.statut, e.id_salarie_createur,
		        COUNT(DISTINCT i.id_inscription) AS nb_inscriptions
		 FROM evenement e
		 LEFT JOIN inscription i ON i.id_evenement = e.id_evenement AND i.statut != 'annule'
		 WHERE e.id_salarie_createur = ?
		 GROUP BY e.id_evenement
		 ORDER BY e.date_debut DESC`, salarieID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]models.Evenement, 0)
	for rows.Next() {
		var e models.Evenement
		if err := rows.Scan(&e.ID, &e.Titre, &e.Type, &e.Description, &e.DateDebut, &e.DateFin, &e.Lieu, &e.Tarif, &e.NbPlaces, &e.Statut, &e.IDSalarieCreateur, &e.NbInscriptions); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

func (r *EvenementRepository) UpdateStatus(id uint, statut string) error {
	_, err := database.DB.Exec("UPDATE evenement SET statut = ? WHERE id_evenement = ?", statut, id)
	return err
}

func (r *EvenementRepository) Update(evenement *models.Evenement) error {
	query := `UPDATE evenement SET titre=?, type=?, description=?, date_debut=?, date_fin=?, lieu=?, tarif=?, nb_places=?, statut=?
	          WHERE id_evenement=?`
	_, err := database.DB.Exec(query, evenement.Titre, evenement.Type, evenement.Description,
		evenement.DateDebut, evenement.DateFin, evenement.Lieu, evenement.Tarif, evenement.NbPlaces, evenement.Statut, evenement.ID)
	return err
}

func (r *EvenementRepository) Delete(id uint) error {
	_, err := database.DB.Exec("UPDATE evenement SET statut = 'annule' WHERE id_evenement = ?", id)
	return err
}

//  INSCRIPTION

type InscriptionRepository struct{}

func (r *InscriptionRepository) Create(inscription *models.Inscription) error {
	query := `INSERT INTO inscription (date_inscription, statut, id_utilisateur, id_evenement, id_paiement)
              VALUES (NOW(), 'non_paye', ?, ?, ?)`
	result, err := database.DB.Exec(query, inscription.IDUtilisateur, inscription.IDEvenement, inscription.IDPaiement)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	inscription.ID = uint(id)
	return nil
}

func (r *InscriptionRepository) GetByUserAndEvent(userID, eventID uint) (*models.Inscription, error) {
	row := database.DB.QueryRow("SELECT id_inscription, date_inscription, statut, id_utilisateur, id_evenement, id_paiement FROM inscription WHERE id_utilisateur = ? AND id_evenement = ?", userID, eventID)
	var i models.Inscription
	err := row.Scan(&i.ID, &i.DateInscription, &i.Statut, &i.IDUtilisateur, &i.IDEvenement, &i.IDPaiement)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &i, err
}

func (r *InscriptionRepository) UpdateStatus(id uint, statut string, paiementID *uint) error {
	_, err := database.DB.Exec("UPDATE inscription SET statut = ?, id_paiement = ? WHERE id_inscription = ?", statut, paiementID, id)
	return err
}

func (r *InscriptionRepository) ListByUser(userID uint, limit, offset int) ([]models.Inscription, error) {
	rows, err := database.DB.Query("SELECT id_inscription, date_inscription, statut, id_utilisateur, id_evenement, id_paiement FROM inscription WHERE id_utilisateur = ? ORDER BY date_inscription DESC LIMIT ? OFFSET ?", userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	inscriptions := make([]models.Inscription, 0)
	for rows.Next() {
		var i models.Inscription
		err := rows.Scan(&i.ID, &i.DateInscription, &i.Statut, &i.IDUtilisateur, &i.IDEvenement, &i.IDPaiement)
		if err != nil {
			return nil, err
		}
		inscriptions = append(inscriptions, i)
	}
	return inscriptions, nil
}

//  PAIEMENT

type PaiementRepository struct{}

func (r *PaiementRepository) Create(paiement *models.Paiement) error {
	query := `INSERT INTO paiement (montant, moyen, date_paiement, ref_stripe, statut, type_paiement, id_abonnement, id_utilisateur)
              VALUES (?, ?, NOW(), ?, 'en_attente', ?, ?, ?)`
	result, err := database.DB.Exec(query, paiement.Montant, paiement.Moyen, paiement.RefStripe, paiement.TypePaiement, paiement.IDAbonnement, paiement.IDUtilisateur)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	paiement.ID = uint(id)
	return nil
}

func (r *PaiementRepository) UpdateStatus(id uint, statut string) error {
	_, err := database.DB.Exec("UPDATE paiement SET statut = ? WHERE id_paiement = ?", statut, id)
	return err
}

//  NOTIFICATION

type NotificationRepository struct{}

func (r *NotificationRepository) Create(notif *models.Notification) error {
	query := `INSERT INTO notification (titre, contenu, type, canal, date_envoi, lu, ref_onesignal, id_utilisateur)
              VALUES (?, ?, ?, ?, NOW(), 0, ?, ?)`
	result, err := database.DB.Exec(query, notif.Titre, notif.Contenu, notif.Type, notif.Canal, notif.RefOneSignal, notif.IDUtilisateur)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	notif.ID = uint(id)
	return nil
}

func (r *NotificationRepository) BulkCreate(titre, contenu, notifType, canal string, userIDs []uint) (int, error) {
	if len(userIDs) == 0 {
		return 0, nil
	}
	placeholders := make([]string, len(userIDs))
	args := make([]interface{}, 0, len(userIDs)*5)
	for i, id := range userIDs {
		placeholders[i] = "(?, ?, ?, ?, NOW(), 0, '', ?)"
		args = append(args, titre, contenu, notifType, canal, id)
	}
	query := "INSERT INTO notification (titre, contenu, type, canal, date_envoi, lu, ref_onesignal, id_utilisateur) VALUES " +
		strings.Join(placeholders, ", ")
	result, err := database.DB.Exec(query, args...)
	if err != nil {
		return 0, err
	}
	affected, _ := result.RowsAffected()
	return int(affected), nil
}

func (r *NotificationRepository) ListByUser(userID uint, limit, offset int) ([]models.Notification, error) {
	rows, err := database.DB.Query("SELECT id_notification, titre, contenu, type, canal, date_envoi, lu, ref_onesignal, id_utilisateur FROM notification WHERE id_utilisateur = ? ORDER BY date_envoi DESC LIMIT ? OFFSET ?", userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	notifs := make([]models.Notification, 0)
	for rows.Next() {
		var n models.Notification
		if err := rows.Scan(&n.ID, &n.Titre, &n.Contenu, &n.Type, &n.Canal, &n.DateEnvoi, &n.Lu, &n.RefOneSignal, &n.IDUtilisateur); err != nil {
			return nil, err
		}
		notifs = append(notifs, n)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return notifs, nil
}

func (r *NotificationRepository) MarkAsRead(id uint) error {
	_, err := database.DB.Exec("UPDATE notification SET lu = 1 WHERE id_notification = ?", id)
	return err
}

func (r *NotificationRepository) MarkAllAsRead(userID uint) error {
	_, err := database.DB.Exec("UPDATE notification SET lu = 1 WHERE id_utilisateur = ? AND lu = 0", userID)
	return err
}

type BroadcastRecord struct {
	Titre     string
	Contenu   string
	DateEnvoi time.Time
	NbEnvoyes int
}

func (r *NotificationRepository) GetBroadcastHistory(limit int) ([]BroadcastRecord, error) {
	rows, err := database.DB.Query(
		`SELECT COALESCE(titre,''), COALESCE(contenu,''), MIN(date_envoi), COUNT(*)
		 FROM notification
		 GROUP BY titre, contenu
		 ORDER BY MIN(date_envoi) DESC
		 LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := make([]BroadcastRecord, 0)
	for rows.Next() {
		var rec BroadcastRecord
		if err := rows.Scan(&rec.Titre, &rec.Contenu, &rec.DateEnvoi, &rec.NbEnvoyes); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

//  TRADUCTION

type TraductionRepository struct{}

func (r *TraductionRepository) Get(table string, id uint, champ, langue string) (string, error) {
	var valeur string
	query := "SELECT valeur_traduite FROM traduction WHERE table_concernee = ? AND id_enregistrement = ? AND champ = ? AND langue = ?"
	err := database.DB.QueryRow(query, table, id, champ, langue).Scan(&valeur)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return valeur, err
}

func (r *TraductionRepository) Set(table string, id uint, champ, langue, valeur string) error {
	// Upsert: on supprime puis on insère
	_, err := database.DB.Exec("DELETE FROM traduction WHERE table_concernee = ? AND id_enregistrement = ? AND champ = ? AND langue = ?", table, id, champ, langue)
	if err != nil {
		return err
	}
	_, err = database.DB.Exec("INSERT INTO traduction (table_concernee, id_enregistrement, champ, langue, valeur_traduite) VALUES (?, ?, ?, ?, ?)", table, id, champ, langue, valeur)
	return err
}

//  ANNONCE (méthodes manquantes)

// annonces en attente, pour l'admin
func (r *AnnonceRepository) ListPending(limit, offset int) ([]models.Annonce, error) {
	query := `SELECT id_annonce, titre, description, type_annonce, prix, date_publication, statut, id_utilisateur, id_objet
              FROM annonce WHERE statut = 'en_attente' ORDER BY date_publication ASC LIMIT ? OFFSET ?`
	rows, err := database.DB.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	annonces := make([]models.Annonce, 0)
	for rows.Next() {
		var a models.Annonce
		if err := rows.Scan(&a.ID, &a.Titre, &a.Description, &a.TypeAnnonce, &a.Prix, &a.DatePublication, &a.Statut, &a.IDUtilisateur, &a.IDObjet); err != nil {
			return nil, err
		}
		annonces = append(annonces, a)
	}
	return annonces, nil
}

//  ÉVÉNEMENT (méthodes manquantes)

// evenements validés a venir, avec le nb d'inscrits pour afficher les places restantes
func (r *EvenementRepository) ListUpcoming(limit, offset int, lang string) ([]models.Evenement, error) {
	query := `SELECT e.id_evenement,
		COALESCE(MAX(t_titre.valeur_traduite), e.titre),
		e.type,
		COALESCE(MAX(t_desc.valeur_traduite), e.description),
		e.date_debut, e.date_fin, e.lieu, e.tarif, e.nb_places, e.statut, e.id_salarie_createur,
		COUNT(DISTINCT i.id_inscription) AS nb_inscriptions
	FROM evenement e
	LEFT JOIN inscription i ON i.id_evenement = e.id_evenement AND i.statut != 'annule'
	LEFT JOIN traduction t_titre ON t_titre.table_concernee = 'evenement' AND t_titre.id_enregistrement = e.id_evenement AND t_titre.champ = 'titre' AND t_titre.langue = ?
	LEFT JOIN traduction t_desc  ON t_desc.table_concernee  = 'evenement' AND t_desc.id_enregistrement  = e.id_evenement AND t_desc.champ  = 'description' AND t_desc.langue  = ?
	WHERE e.statut = 'valide' AND e.date_debut > NOW()
	GROUP BY e.id_evenement, e.titre, e.type, e.description, e.date_debut, e.date_fin, e.lieu, e.tarif, e.nb_places, e.statut, e.id_salarie_createur
	ORDER BY e.date_debut ASC LIMIT ? OFFSET ?`
	rows, err := database.DB.Query(query, lang, lang, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]models.Evenement, 0)
	for rows.Next() {
		var e models.Evenement
		if err := rows.Scan(&e.ID, &e.Titre, &e.Type, &e.Description, &e.DateDebut, &e.DateFin, &e.Lieu, &e.Tarif, &e.NbPlaces, &e.Statut, &e.IDSalarieCreateur, &e.NbInscriptions); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

//  INSCRIPTION (méthodes manquantes)

// verifie si l'user est deja inscrit, pour eviter les doublons
func (r *InscriptionRepository) CheckExists(userID, evenementID uint) (bool, error) {
	var count int
	err := database.DB.QueryRow(
		"SELECT COUNT(*) FROM inscription WHERE id_utilisateur = ? AND id_evenement = ?",
		userID, evenementID,
	).Scan(&count)
	return count > 0, err
}

// inscriptions avec les details de l'evenement joint, le front a besoin du titre et de la date
func (r *InscriptionRepository) ListByUserFull(userID uint, limit, offset int) ([]models.Inscription, error) {
	rows, err := database.DB.Query(
		`SELECT id_inscription, date_inscription, statut, id_utilisateur, id_evenement, id_paiement
         FROM inscription WHERE id_utilisateur = ? ORDER BY date_inscription DESC LIMIT ? OFFSET ?`,
		userID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	inscriptions := make([]models.Inscription, 0)
	for rows.Next() {
		var i models.Inscription
		if err := rows.Scan(&i.ID, &i.DateInscription, &i.Statut, &i.IDUtilisateur, &i.IDEvenement, &i.IDPaiement); err != nil {
			return nil, err
		}
		inscriptions = append(inscriptions, i)
	}
	return inscriptions, nil
}

func (r *InscriptionRepository) DeleteByUserAndEvent(userID, evenementID uint) error {
	res, err := database.DB.Exec(
		`DELETE FROM inscription WHERE id_utilisateur = ? AND id_evenement = ?`,
		userID, evenementID,
	)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return errors.New("inscription introuvable")
	}
	return nil
}

//  OBJET

type ObjetRepository struct{}

func (r *ObjetRepository) Create(obj *models.Objet) error {
	result, err := database.DB.Exec(
		`INSERT INTO objet (nom, categorie_id, etat, valeur_estimee, description) VALUES (?, ?, ?, ?, ?)`,
		obj.Nom, obj.CategorieID, obj.Etat, obj.ValeurEstimee, obj.Description,
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	obj.ID = uint(id)
	return nil
}

func (r *ObjetRepository) GetByID(id uint) (*models.Objet, error) {
	row := database.DB.QueryRow(
		`SELECT id_objet, nom, categorie_id, etat, valeur_estimee, code_barre, description, date_ajout FROM objet WHERE id_objet = ?`,
		id,
	)
	var o models.Objet
	err := row.Scan(&o.ID, &o.Nom, &o.CategorieID, &o.Etat, &o.ValeurEstimee, &o.CodeBarre, &o.Description, &o.DateAjout)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &o, err
}

//  CONTENEUR (méthodes manquantes)

func (r *ConteneurRepository) UpdateNbObjets(id uint, nb int) error {
	_, err := database.DB.Exec("UPDATE conteneur SET nb_objets = ? WHERE id_conteneur = ?", nb, id)
	return err
}

func (r *ConteneurRepository) UpdateStatut(id uint, statut string) error {
	_, err := database.DB.Exec("UPDATE conteneur SET statut = ? WHERE id_conteneur = ?", statut, id)
	return err
}

func (r *ConteneurRepository) Create(c *models.Conteneur) error {
	res, err := database.DB.Exec(
		"INSERT INTO conteneur (adresse, ville, latitude, longitude, capacite, nb_objets, statut) VALUES (?, ?, ?, ?, ?, 0, 'disponible')",
		c.Adresse, c.Ville, c.Latitude, c.Longitude, c.Capacite,
	)
	if err != nil {
		return err
	}
	id, _ := res.LastInsertId()
	c.ID = uint(id)
	c.Statut = "disponible"
	c.NbObjets = 0
	return nil
}

//  DÉPÔT (méthodes manquantes)

func (r *DepotRepository) UpdateRecuperationDate(id uint) error {
	_, err := database.DB.Exec(
		"UPDATE depot SET statut = 'recupere', date_recuperation = ? WHERE id_depot = ?",
		time.Now(), id,
	)
	return err
}

func (r *DepotRepository) ExpireDepot(id uint) error {
	_, err := database.DB.Exec("UPDATE depot SET statut = 'expire' WHERE id_depot = ?", id)
	return err
}

func (r *DepotRepository) ListExpiredValides() ([]models.Depot, error) {
	rows, err := database.DB.Query(
		`SELECT id_depot, statut, date_demande, date_validation, date_depot, date_recuperation,
		        code_ouverture, code_barre_retrait, motif_refus, id_particulier, id_conteneur, id_objet
		 FROM depot
		 WHERE statut = 'valide'
		   AND date_validation IS NOT NULL
		   AND date_validation < DATE_SUB(NOW(), INTERVAL 7 DAY)`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var depots []models.Depot
	for rows.Next() {
		var d models.Depot
		rows.Scan(&d.ID, &d.Statut, &d.DateDemande, &d.DateValidation, &d.DateDepot, &d.DateRecuperation,
			&d.CodeOuverture, &d.CodeBarreRetrait, &d.MotifRefus, &d.IDParticulier, &d.IDConteneur, &d.IDObjet)
		depots = append(depots, d)
	}
	return depots, nil
}

func (r *DepotRepository) GetByCodeBarre(code string) (*models.Depot, error) {
	row := database.DB.QueryRow(
		"SELECT id_depot, statut, date_demande, date_validation, date_depot, date_recuperation, code_ouverture, code_barre_retrait, motif_refus, id_particulier, id_conteneur, id_objet FROM depot WHERE code_barre_retrait = ? LIMIT 1",
		code,
	)
	d := &models.Depot{}
	err := row.Scan(&d.ID, &d.Statut, &d.DateDemande, &d.DateValidation, &d.DateDepot, &d.DateRecuperation, &d.CodeOuverture, &d.CodeBarreRetrait, &d.MotifRefus, &d.IDParticulier, &d.IDConteneur, &d.IDObjet)
	if err != nil {
		return nil, err
	}
	return d, nil
}

//  CATEGORIE

type CategorieRepository struct{}

func (r *CategorieRepository) Create(cat *models.Categorie) error {
	result, err := database.DB.Exec(
		"INSERT INTO categorie (nom, description, icone, parent_id) VALUES (?, ?, ?, ?)",
		cat.Nom, cat.Description, cat.Icone, cat.ParentID,
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	cat.ID = uint(id)
	return nil
}

func (r *CategorieRepository) GetByID(id uint) (*models.Categorie, error) {
	row := database.DB.QueryRow(
		"SELECT id_categorie, nom, COALESCE(description,''), COALESCE(icone,''), parent_id FROM categorie WHERE id_categorie = ?", id,
	)
	var c models.Categorie
	err := row.Scan(&c.ID, &c.Nom, &c.Description, &c.Icone, &c.ParentID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &c, err
}

func (r *CategorieRepository) ListAll() ([]models.Categorie, error) {
	rows, err := database.DB.Query("SELECT id_categorie, nom, COALESCE(description,''), COALESCE(icone,''), parent_id FROM categorie WHERE nom NOT LIKE '[supprimee]%' ORDER BY nom")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cats := make([]models.Categorie, 0)
	for rows.Next() {
		var c models.Categorie
		if err := rows.Scan(&c.ID, &c.Nom, &c.Description, &c.Icone, &c.ParentID); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, nil
}

func (r *CategorieRepository) Update(cat *models.Categorie) error {
	_, err := database.DB.Exec(
		"UPDATE categorie SET nom = ?, description = ?, icone = ?, parent_id = ? WHERE id_categorie = ?",
		cat.Nom, cat.Description, cat.Icone, cat.ParentID, cat.ID,
	)
	return err
}

func (r *CategorieRepository) Delete(id uint) error {
	// Soft delete : on marque avec un préfixe pour signaler la suppression sans effacer
	_, err := database.DB.Exec("UPDATE categorie SET nom = CONCAT('[supprimee] ', nom) WHERE id_categorie = ?", id)
	return err
}

func (r *CategorieRepository) List(lang string) ([]models.Categorie, error) {
	// On compte les objets par catégorie pour l'affichage admin
	query := `
		SELECT c.id_categorie,
			COALESCE(MAX(t.valeur_traduite), c.nom),
			COALESCE(c.description,''), COALESCE(c.icone,''), c.parent_id,
			COUNT(o.id_objet) AS nb_objets
		FROM categorie c
		LEFT JOIN objet o ON o.categorie_id = c.id_categorie
		LEFT JOIN traduction t ON t.table_concernee = 'categorie' AND t.id_enregistrement = c.id_categorie AND t.champ = 'nom' AND t.langue = ?
		WHERE c.nom NOT LIKE '[supprimee]%'
		GROUP BY c.id_categorie, c.nom, c.description, c.icone, c.parent_id
		ORDER BY c.nom`
	rows, err := database.DB.Query(query, lang)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cats := make([]models.Categorie, 0)
	for rows.Next() {
		var c models.Categorie
		if err := rows.Scan(&c.ID, &c.Nom, &c.Description, &c.Icone, &c.ParentID, &c.NbObjets); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, nil
}

//  STATS ADMIN

type StatsRepository struct{}

type AdminStats struct {
	TotalUtilisateurs   int     `json:"total_utilisateurs"`
	TotalAnnonces       int     `json:"total_annonces"`
	TotalEvenements     int     `json:"total_evenements"`
	TotalConteneurs     int     `json:"total_conteneurs"`
	TotalCategories     int     `json:"total_categories"`
	TotalFactures       int     `json:"total_factures"`
	AnnoncesEnAttente   int     `json:"annonces_en_attente"`
	DepotsEnAttente     int     `json:"depots_en_attente"`
	EvenementsEnAttente int     `json:"evenements_en_attente"`
	CAMois              float64 `json:"ca_mois"`
	CATotal             float64 `json:"ca_total"`
	CommissionsMois     float64 `json:"commissions_mois"`
	CommissionsTotal    float64 `json:"commissions_total"`
	NbAbonnesPremium    int     `json:"nb_abonnes_premium"`
	SignalementsAttente int     `json:"signalements_attente"`
}

func (r *StatsRepository) Get() (*AdminStats, error) {
	s := &AdminStats{}
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM utilisateur WHERE actif = 1`).Scan(&s.TotalUtilisateurs)
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM annonce`).Scan(&s.TotalAnnonces)
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM evenement`).Scan(&s.TotalEvenements)
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM conteneur`).Scan(&s.TotalConteneurs)
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM categorie`).Scan(&s.TotalCategories)
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM facture`).Scan(&s.TotalFactures)
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM annonce WHERE statut='en_attente'`).Scan(&s.AnnoncesEnAttente)
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM depot WHERE statut='en_attente'`).Scan(&s.DepotsEnAttente)
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM evenement WHERE statut='en_attente'`).Scan(&s.EvenementsEnAttente)
	_ = database.DB.QueryRow(`SELECT COALESCE(SUM(montant),0) FROM paiement WHERE statut='paye' AND MONTH(date_paiement)=MONTH(NOW()) AND YEAR(date_paiement)=YEAR(NOW())`).Scan(&s.CAMois)
	_ = database.DB.QueryRow(`SELECT COALESCE(SUM(montant),0) FROM paiement WHERE statut='paye'`).Scan(&s.CATotal)
	_ = database.DB.QueryRow(`SELECT COALESCE(SUM(commission_montant),0) FROM transaction_achat WHERE statut='payee' AND MONTH(date_transaction)=MONTH(NOW()) AND YEAR(date_transaction)=YEAR(NOW())`).Scan(&s.CommissionsMois)
	_ = database.DB.QueryRow(`SELECT COALESCE(SUM(commission_montant),0) FROM transaction_achat WHERE statut='payee'`).Scan(&s.CommissionsTotal)
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM professionnel WHERE niveau_abonnement='premium'`).Scan(&s.NbAbonnesPremium)
	_ = database.DB.QueryRow(`SELECT COUNT(*) FROM message WHERE statut='supprime'`).Scan(&s.SignalementsAttente)
	return s, nil
}

func (r *PaiementRepository) UpdateStatusByStripeRef(stripeRef, statut string) error {
	_, err := database.DB.Exec("UPDATE paiement SET statut = ? WHERE ref_stripe = ?", statut, stripeRef)
	return err
}

//  TRANSACTION

type TransactionRepository struct{}

func (r *TransactionRepository) Create(tx *models.TransactionAchat) error {
	query := `INSERT INTO transaction_achat (montant, commission_taux, statut, id_annonce, id_acheteur, id_vendeur)
              VALUES (?, ?, 'en_attente', ?, ?, ?)`
	result, err := database.DB.Exec(query, tx.Montant, tx.CommissionTaux, tx.IDAnnonce, tx.IDAcheteur, tx.IDVendeur)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	tx.ID = uint(id)
	return nil
}
