package models

// structures de donnees des entites du domaine UpcycleConnect
// meme struct pour le scan SQL et le JSON, pas ideal mais ca evite de dupliquer tous les modeles
// les champs sensibles ont json:"-" pour pas les exposer en reponse API
// TODO: séparer les structs de requête (input) des structs de réponse (output) pour plus de clarté

import "time"

type Utilisateur struct {
	ID              uint      `json:"id"`
	Email           string    `json:"email"`
	MotDePasse      string    `json:"-"` // jamais exposé
	Nom             string    `json:"nom"`
	Prenom          string    `json:"prenom"`
	Role            string    `json:"role"`
	Adresse         string    `json:"adresse,omitempty"`
	Ville           string    `json:"ville,omitempty"`
	CodePostal      string    `json:"code_postal,omitempty"`
	Telephone       string    `json:"telephone,omitempty"`
	DateInscription time.Time `json:"date_inscription"`
	Actif           bool      `json:"actif"`
	TutorielVu      bool      `json:"tutoriel_vu"`
	LanguePreferee  string    `json:"langue_preferee"`
	Plan            string    `json:"plan,omitempty"`
	UpcyclingScore  int       `json:"upcycling_score"`
	Entreprise      string    `json:"entreprise,omitempty"`
	Siret           string    `json:"siret,omitempty"`
	TypeMetier      string    `json:"description,omitempty"`
}

type Particulier struct {
	ID                  uint `json:"id"`
	UpcyclingScoreTotal int  `json:"upcycling_score_total"`
}

type Professionnel struct {
	ID               uint   `json:"id"`
	NomEntreprise    string `json:"nom_entreprise"`
	Siret            string `json:"siret"`
	TypeMetier       string `json:"type_metier"`
	NiveauAbonnement string `json:"niveau_abonnement"`
}

type Objet struct {
	ID            uint      `json:"id"`
	Nom           string    `json:"nom"`
	CategorieID   *uint     `json:"categorie_id,omitempty"`
	Etat          string    `json:"etat"`
	ValeurEstimee float64   `json:"valeur_estimee"`
	CodeBarre     string    `json:"code_barre"`
	Description   string    `json:"description"`
	DateAjout     time.Time `json:"date_ajout"`
}

type Annonce struct {
	ID              uint       `json:"id"`
	Titre           string     `json:"titre"`
	Description     string     `json:"description"`
	TypeAnnonce     string     `json:"type_annonce"` // don, vente
	Prix            float64    `json:"prix"`
	DatePublication time.Time  `json:"date_publication"`
	DateExpiration  *time.Time `json:"date_expiration,omitempty"`
	Statut          string     `json:"statut"` // en_attente, validee, refusee
	IDUtilisateur   uint       `json:"id_utilisateur"`
	IDObjet         uint       `json:"id_objet"`
	Categorie       string     `json:"categorie,omitempty"`
	Auteur          string     `json:"auteur,omitempty"`
	Localisation    string     `json:"localisation,omitempty"`
	NbMessages      int        `json:"nb_messages,omitempty"`
	EstFavori       bool       `json:"est_favori,omitempty"`
}

type Conteneur struct {
	ID        uint    `json:"id"`
	Adresse   string  `json:"adresse"`
	Ville     string  `json:"ville"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Capacite  int     `json:"capacite"`
	NbObjets  int     `json:"nb_objets"`
	Statut    string  `json:"statut"`
}

type Depot struct {
	ID               uint       `json:"id"`
	Statut           string     `json:"statut"`
	DateDemande      time.Time  `json:"date_demande"`
	DateValidation   *time.Time `json:"date_validation,omitempty"`
	DateDepot        *time.Time `json:"date_depot,omitempty"`
	DateRecuperation *time.Time `json:"date_recuperation,omitempty"`
	CodeOuverture    string     `json:"code_ouverture"`
	CodeBarreRetrait string     `json:"code_barre_retrait"`
	MotifRefus       string     `json:"motif_refus,omitempty"`
	IDParticulier    uint       `json:"id_particulier"`
	IDConteneur      uint       `json:"id_conteneur"`
	IDObjet          uint       `json:"id_objet"`
	AdresseConteneur string     `json:"adresse_conteneur,omitempty"`
	VilleConteneur   string     `json:"ville_conteneur,omitempty"`
}

type ProjetUpcycling struct {
	ID                uint      `json:"id"`
	Titre             string    `json:"titre"`
	Description       string    `json:"description"`
	DateDebut         time.Time `json:"date_debut"`
	DateFin           time.Time `json:"date_fin"`
	Statut            string    `json:"statut"`
	ScoreImpact       int       `json:"score_impact"`
	KgDechetsEvites   float64   `json:"kg_dechets_evites"`
	PartageCommunaute bool      `json:"partage_communaute"`
	IDUtilisateur     uint      `json:"id_utilisateur"`
}

type EtapeProjet struct {
	ID          uint      `json:"id"`
	Titre       string    `json:"titre"`
	Description string    `json:"description"`
	Ordre       int       `json:"ordre"`
	DateEtape   time.Time `json:"date_etape"`
	PhotoURL    string    `json:"photo_url"`
	IDProjet    uint      `json:"id_projet"`
}

type Evenement struct {
	ID                uint      `json:"id"`
	Titre             string    `json:"titre"`
	Type              string    `json:"type"`
	Description       string    `json:"description"`
	DateDebut         time.Time `json:"date_debut"`
	DateFin           time.Time `json:"date_fin"`
	Lieu              string    `json:"lieu"`
	Tarif             float64   `json:"tarif"`
	NbPlaces          int       `json:"nb_places"`
	NbInscriptions    int       `json:"places_prises"`
	Statut            string    `json:"statut"`
	IDSalarieCreateur *uint     `json:"id_salarie_createur"`
}

type Inscription struct {
	ID              uint      `json:"id"`
	DateInscription time.Time `json:"date_inscription"`
	Statut          string    `json:"statut"`
	IDUtilisateur   uint      `json:"id_utilisateur"`
	IDEvenement     uint      `json:"id_evenement"`
	IDPaiement      *uint     `json:"id_paiement,omitempty"`
}

type Paiement struct {
	ID            uint      `json:"id"`
	Montant       float64   `json:"montant"`
	Moyen         string    `json:"moyen"`
	DatePaiement  time.Time `json:"date_paiement"`
	RefStripe     string    `json:"ref_stripe"`
	Statut        string    `json:"statut"`
	TypePaiement  string    `json:"type_paiement"`
	IDAbonnement  *uint     `json:"id_abonnement,omitempty"`
	IDUtilisateur uint      `json:"id_utilisateur,omitempty"`
}

type TransactionAchat struct {
	ID                uint      `json:"id"`
	Montant           float64   `json:"montant"`
	CommissionTaux    float64   `json:"commission_taux"`
	CommissionMontant float64   `json:"commission_montant"`
	DateTransaction   time.Time `json:"date_transaction"`
	Statut            string    `json:"statut"`
	IDAnnonce         uint      `json:"id_annonce"`
	IDAcheteur        uint      `json:"id_acheteur"`
	IDVendeur         uint      `json:"id_vendeur"`
	IDPaiement        *uint     `json:"id_paiement,omitempty"`
}

type Notification struct {
	ID            uint      `json:"id"`
	Titre         string    `json:"titre"`
	Contenu       string    `json:"contenu"`
	Type          string    `json:"type"`
	Canal         string    `json:"canal"`
	DateEnvoi     time.Time `json:"date_envoi"`
	Lu            bool      `json:"lu"`
	RefOneSignal  string    `json:"ref_onesignal"`
	IDUtilisateur uint      `json:"id_utilisateur"`
}

type Traduction struct {
	ID               uint   `json:"id"`
	TableConcernee   string `json:"table_concernee"`
	IDEnregistrement uint   `json:"id_enregistrement"`
	Champ            string `json:"champ"`
	Langue           string `json:"langue"`
	ValeurTraduite   string `json:"valeur_traduite"`
}
type Categorie struct {
	ID          uint   `json:"id"`
	Nom         string `json:"nom"`
	Description string `json:"description,omitempty"`
	Icone       string `json:"icone,omitempty"`
	ParentID    *uint  `json:"parent_id,omitempty"`
	NbObjets    int    `json:"nb_objets"`
}

type ArticleConseil struct {
	ID                 uint      `json:"id"`
	Titre              string    `json:"titre"`
	Contenu            string    `json:"contenu"`
	Statut             string    `json:"statut"` // en_attente, publie, refuse
	DatePublication    time.Time `json:"date_publication"`
	IDSalarieRedacteur uint      `json:"id_salarie_redacteur"`
	IDAdminValidation  *uint     `json:"id_admin_validation,omitempty"`
}

type ForumMessage struct {
	ID              uint      `json:"id"`
	Contenu         string    `json:"contenu"`
	DateEnvoi       time.Time `json:"date_envoi"`
	Statut          string    `json:"statut"` // visible, supprime
	IDUtilisateur   uint      `json:"id_utilisateur"`
	IDForum         uint      `json:"id_forum"`
	IDParentMessage *uint     `json:"id_parent_message,omitempty"`
}

type Abonnement struct {
	ID                uint      `json:"id"`
	TypeAbonnement    string    `json:"type_abonnement"` // mensuel, annuel
	PrixMensuel       float64   `json:"prix_mensuel"`
	DateDebut         time.Time `json:"date_debut"`
	DateFin           time.Time `json:"date_fin"`
	Statut            string    `json:"statut"` // actif, expire, resilie
	AccesTableauxBord bool      `json:"acces_tableaux_bord"`
	AccesStatsMat     bool      `json:"acces_stats_materiaux"`
	AlertesCollecte   bool      `json:"alertes_collecte"`
	IDProfessionnel   uint      `json:"id_professionnel"`
}

type Planning struct {
	ID            uint      `json:"id"`
	Titre         string    `json:"titre"`
	DateHeure     time.Time `json:"date_heure"`
	DureeMinutes  int       `json:"duree_minutes"`
	TypeEntree    string    `json:"type_entree"` // evenement, personnel, rappel
	Notes         string    `json:"notes,omitempty"`
	IDUtilisateur uint      `json:"id_utilisateur"`
	IDEvenement   *uint     `json:"id_evenement,omitempty"`
}

type ScoreLog struct {
	ID            uint      `json:"id"`
	Points        int       `json:"points"`
	Motif         string    `json:"motif"`
	DateAction    time.Time `json:"date_action"`
	IDParticulier uint      `json:"id_particulier"`
	IDProjet      *uint     `json:"id_projet,omitempty"`
}
