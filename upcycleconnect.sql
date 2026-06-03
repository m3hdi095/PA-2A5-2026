SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS upcycleconnect;
SET FOREIGN_KEY_CHECKS = 1;


CREATE DATABASE upcycleconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE upcycleconnect;

-- 1. Utilisateurs (particuliers, professionnels, salariés, administrateurs)
CREATE TABLE utilisateur (
    id_utilisateur INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    mot_de_passe VARCHAR(255) NOT NULL,  -- hash bcrypt
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    role ENUM('particulier', 'professionnel', 'salarie', 'admin') NOT NULL,
    adresse VARCHAR(255),
    ville VARCHAR(100),
    code_postal VARCHAR(20),
    telephone VARCHAR(20),
    date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP,
    actif BOOLEAN DEFAULT TRUE,
    tutoriel_vu BOOLEAN DEFAULT FALSE,
    langue_preferee CHAR(2) DEFAULT 'fr'
);

CREATE TABLE particulier (
    id_particulier INT UNSIGNED PRIMARY KEY,
    upcycling_score_total INT UNSIGNED DEFAULT 0,
    FOREIGN KEY (id_particulier) REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);

CREATE TABLE professionnel (
    id_professionnel INT UNSIGNED PRIMARY KEY,
    nom_entreprise VARCHAR(200) NOT NULL,
    siret VARCHAR(14) NOT NULL,
    type_metier VARCHAR(100),
    niveau_abonnement ENUM('freemium', 'premium') DEFAULT 'freemium',
    FOREIGN KEY (id_professionnel) REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);

CREATE TABLE salarie (
    id_salarie INT UNSIGNED PRIMARY KEY,
    poste ENUM('animateur', 'formateur') NOT NULL,
    date_embauche DATE,
    FOREIGN KEY (id_salarie) REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);

CREATE TABLE admin (
    id_admin INT UNSIGNED PRIMARY KEY,
    niveau_acces ENUM('super_admin', 'gestionnaire') DEFAULT 'gestionnaire',
    FOREIGN KEY (id_admin) REFERENCES utilisateur(id_utilisateur) ON DELETE CASCADE
);

-- 2. Catégories d'objets: 
CREATE TABLE categorie (
    id_categorie INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INT UNSIGNED DEFAULT NULL,
    FOREIGN KEY (parent_id) REFERENCES categorie(id_categorie) ON DELETE SET NULL
);

-- 3. Conteneurs, objets, dépôts, annonces, validations: 

-- Conteneurs (box)
CREATE TABLE conteneur (
    id_conteneur INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    adresse VARCHAR(255) NOT NULL,
    ville VARCHAR(100) NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    capacite INT UNSIGNED DEFAULT 100,
    nb_objets INT UNSIGNED DEFAULT 0,
    statut ENUM('disponible', 'plein', 'en_maintenance') DEFAULT 'disponible'
);

-- Objets
CREATE TABLE objet (
    id_objet INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    categorie_id INT UNSIGNED,
    etat ENUM('neuf', 'bon', 'abime', 'a_reparer') DEFAULT 'bon',
    valeur_estimee DECIMAL(10,2),
    code_barre VARCHAR(100) UNIQUE,
    description TEXT,
    date_ajout DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categorie_id) REFERENCES categorie(id_categorie) ON DELETE SET NULL
);

-- Dépôt d'un objet dans un conteneur par un particulier
CREATE TABLE depot (
    id_depot INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    statut ENUM('en_attente', 'valide', 'depose', 'recupere', 'refuse') DEFAULT 'en_attente',
    date_demande DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_validation DATETIME,
    date_depot DATETIME,
    date_recuperation DATETIME,
    code_ouverture VARCHAR(50),          
    code_barre_retrait VARCHAR(100),     
    motif_refus TEXT,
    id_particulier INT UNSIGNED NOT NULL,
    id_conteneur INT UNSIGNED NOT NULL,
    id_objet INT UNSIGNED NOT NULL,
    FOREIGN KEY (id_particulier) REFERENCES particulier(id_particulier),
    FOREIGN KEY (id_conteneur) REFERENCES conteneur(id_conteneur),
    FOREIGN KEY (id_objet) REFERENCES objet(id_objet)
);

-- Annonces (dons / ventes)
CREATE TABLE annonce (
    id_annonce INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200) NOT NULL,
    description TEXT,
    type_annonce ENUM('don', 'vente') NOT NULL,
    prix DECIMAL(10,2) DEFAULT 0.00,
    date_publication DATETIME DEFAULT CURRENT_TIMESTAMP,
    statut ENUM('brouillon', 'en_attente', 'validee', 'refusee', 'publiee', 'desactivee') DEFAULT 'en_attente',
    id_utilisateur INT UNSIGNED NOT NULL,   
    id_objet INT UNSIGNED NOT NULL,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur),
    FOREIGN KEY (id_objet) REFERENCES objet(id_objet)
);

-- Validation d'une annonce par un administrateur
CREATE TABLE validation_annonce (
    id_validation INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_annonce INT UNSIGNED NOT NULL,
    id_admin INT UNSIGNED NOT NULL,
    date_validation DATETIME DEFAULT CURRENT_TIMESTAMP,
    decision ENUM('validee', 'refusee') NOT NULL,
    commentaire TEXT,
    FOREIGN KEY (id_annonce) REFERENCES annonce(id_annonce),
    FOREIGN KEY (id_admin) REFERENCES admin(id_admin),
    UNIQUE KEY unique_validation_annonce (id_annonce)  -- une annonce validée qu'une fois
);


-- 4. Abonnements, paiements, factures, contrats, publicités: 

-- Abonnements (pour professionnels)
CREATE TABLE abonnement (
    id_abonnement INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type_abonnement ENUM('mensuel', 'annuel') NOT NULL,
    prix_mensuel DECIMAL(10,2) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    statut ENUM('actif', 'expire', 'resilie') DEFAULT 'actif',
    acces_tableaux_bord BOOLEAN DEFAULT FALSE,
    acces_stats_materiaux BOOLEAN DEFAULT FALSE,
    alertes_collecte BOOLEAN DEFAULT FALSE,
    id_professionnel INT UNSIGNED NOT NULL,
    FOREIGN KEY (id_professionnel) REFERENCES professionnel(id_professionnel)
);

-- Paiements (via Stripe)
CREATE TABLE paiement (
    id_paiement INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    montant DECIMAL(10,2) NOT NULL,
    moyen ENUM('carte', 'paypal', 'virement') NOT NULL,
    date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP,
    ref_stripe VARCHAR(200) UNIQUE,
    statut ENUM('en_attente', 'paye', 'rembourse') DEFAULT 'en_attente',
    type_paiement ENUM('abonnement', 'transaction', 'evenement', 'service') NOT NULL,
    id_abonnement INT UNSIGNED DEFAULT NULL,
    FOREIGN KEY (id_abonnement) REFERENCES abonnement(id_abonnement)
);

-- Factures (en PDF)
CREATE TABLE facture (
    id_facture INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    numero_facture VARCHAR(50) UNIQUE NOT NULL,
    date_emission DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant_ht DECIMAL(10,2) NOT NULL,
    tva DECIMAL(5,2) DEFAULT 20.00,
    montant_ttc DECIMAL(10,2) GENERATED ALWAYS AS (montant_ht * (1 + tva/100)) STORED,
    statut ENUM('payee', 'en_attente', 'annulee') DEFAULT 'en_attente',
    fichier_pdf VARCHAR(500),
    id_utilisateur INT UNSIGNED NOT NULL,
    id_abonnement INT UNSIGNED,
    id_paiement INT UNSIGNED,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur),
    FOREIGN KEY (id_abonnement) REFERENCES abonnement(id_abonnement),
    FOREIGN KEY (id_paiement) REFERENCES paiement(id_paiement)
);

-- Contrats (avec professionnels)
CREATE TABLE contrat (
    id_contrat INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type_contrat VARCHAR(100) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    montant DECIMAL(10,2) NOT NULL,
    statut ENUM('actif', 'termine', 'resilie') DEFAULT 'actif',
    fichier_pdf VARCHAR(500),
    id_professionnel INT UNSIGNED NOT NULL,
    id_admin_validation INT UNSIGNED,
    FOREIGN KEY (id_professionnel) REFERENCES professionnel(id_professionnel),
    FOREIGN KEY (id_admin_validation) REFERENCES admin(id_admin)
);

-- Campagnes publicitaires
CREATE TABLE publicite (
    id_pub INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200) NOT NULL,
    type_pub ENUM('banniere', 'sponsoring', 'partenariat') NOT NULL,
    budget_mensuel DECIMAL(10,2),
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    statut ENUM('actif', 'expire', 'refuse') DEFAULT 'actif',
    id_professionnel INT UNSIGNED NOT NULL,
    id_admin_validation INT UNSIGNED,
    FOREIGN KEY (id_professionnel) REFERENCES professionnel(id_professionnel),
    FOREIGN KEY (id_admin_validation) REFERENCES admin(id_admin)
);

-- Sponsoring d'un objet par une campagne
CREATE TABLE sponsorise_objet (
    id_pub INT UNSIGNED NOT NULL,
    id_objet INT UNSIGNED NOT NULL,
    PRIMARY KEY (id_pub, id_objet),
    FOREIGN KEY (id_pub) REFERENCES publicite(id_pub),
    FOREIGN KEY (id_objet) REFERENCES objet(id_objet)
);

-- 5.Transactions d'achat (avec commission pour la plateforme) 

CREATE TABLE transaction_achat (
    id_transaction INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    montant DECIMAL(10,2) NOT NULL,
    commission_taux DECIMAL(5,2) NOT NULL CHECK (commission_taux IN (5,10)),
    commission_montant DECIMAL(10,2) GENERATED ALWAYS AS (montant * commission_taux / 100) STORED,
    date_transaction DATETIME DEFAULT CURRENT_TIMESTAMP,
    statut ENUM('en_attente', 'payee', 'remboursee') DEFAULT 'en_attente',
    id_annonce INT UNSIGNED NOT NULL,
    id_acheteur INT UNSIGNED NOT NULL,
    id_vendeur INT UNSIGNED NOT NULL,
    id_paiement INT UNSIGNED,
    FOREIGN KEY (id_annonce) REFERENCES annonce(id_annonce),
    FOREIGN KEY (id_acheteur) REFERENCES utilisateur(id_utilisateur),
    FOREIGN KEY (id_vendeur) REFERENCES utilisateur(id_utilisateur),
    FOREIGN KEY (id_paiement) REFERENCES paiement(id_paiement)
);

-- 6. Evenements, formations, ateliers, conférences, forums, inscriptions, plannings:
CREATE TABLE evenement (
    id_evenement INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200) NOT NULL,
    type ENUM('formation', 'atelier', 'conference', 'forum') NOT NULL,
    description TEXT,
    date_debut DATETIME NOT NULL,
    date_fin DATETIME NOT NULL,
    lieu VARCHAR(255),
    tarif DECIMAL(10,2),
    nb_places INT UNSIGNED,
    statut ENUM('en_attente', 'valide', 'annule', 'cloture') DEFAULT 'en_attente',
    id_salarie_createur INT UNSIGNED NOT NULL,
    FOREIGN KEY (id_salarie_createur) REFERENCES salarie(id_salarie)
);

-- Validation d'un événement par un admin : 
CREATE TABLE validation_evenement (
    id_validation INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_evenement INT UNSIGNED NOT NULL,
    id_admin INT UNSIGNED NOT NULL,
    date_validation DATETIME DEFAULT CURRENT_TIMESTAMP,
    decision ENUM('valide', 'annule') NOT NULL,
    commentaire TEXT,
    FOREIGN KEY (id_evenement) REFERENCES evenement(id_evenement),
    FOREIGN KEY (id_admin) REFERENCES admin(id_admin),
    UNIQUE KEY unique_validation_evenement (id_evenement)
);

-- Inscription d'un utilisateur à un événement
CREATE TABLE inscription (
    id_inscription INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP,
    statut ENUM('paye', 'non_paye', 'annule') DEFAULT 'non_paye',
    id_utilisateur INT UNSIGNED NOT NULL,
    id_evenement INT UNSIGNED NOT NULL,
    id_paiement INT UNSIGNED,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur),
    FOREIGN KEY (id_evenement) REFERENCES evenement(id_evenement),
    FOREIGN KEY (id_paiement) REFERENCES paiement(id_paiement),
    UNIQUE KEY unique_inscription (id_utilisateur, id_evenement)
);

-- Planning personnel
CREATE TABLE planning (
    id_planning INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200),
    date_heure DATETIME NOT NULL,
    duree_minutes INT UNSIGNED,
    type_entree ENUM('evenement', 'personnel', 'rappel') DEFAULT 'personnel',
    notes TEXT,
    id_utilisateur INT UNSIGNED NOT NULL,
    id_evenement INT UNSIGNED,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur),
    FOREIGN KEY (id_evenement) REFERENCES evenement(id_evenement) ON DELETE SET NULL
);

-- 7. Projets d'upcycling, étapes, scores:
CREATE TABLE projet_upcycling (
    id_projet INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200) NOT NULL,
    description TEXT,
    date_debut DATE,
    date_fin DATE,
    statut ENUM('en_cours', 'termine') DEFAULT 'en_cours',
    score_impact INT UNSIGNED DEFAULT 0,
    kg_dechets_evites DECIMAL(10,2),
    partage_communaute BOOLEAN DEFAULT FALSE,
    id_utilisateur INT UNSIGNED NOT NULL,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur)
);

-- Étapes d'un projet 
CREATE TABLE etape_projet (
    id_etape INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200),
    description TEXT,
    ordre INT UNSIGNED,
    date_etape DATE,
    photo_url VARCHAR(500),
    id_projet INT UNSIGNED NOT NULL,
    FOREIGN KEY (id_projet) REFERENCES projet_upcycling(id_projet) ON DELETE CASCADE
);

-- Sponsoring d'un projet par une campagne
CREATE TABLE sponsorise_projet (
    id_pub INT UNSIGNED NOT NULL,
    id_projet INT UNSIGNED NOT NULL,
    PRIMARY KEY (id_pub, id_projet),
    FOREIGN KEY (id_pub) REFERENCES publicite(id_pub),
    FOREIGN KEY (id_projet) REFERENCES projet_upcycling(id_projet)
);

-- Objets utilisés dans un projet
CREATE TABLE utilise_objet (
    id_projet INT UNSIGNED NOT NULL,
    id_objet INT UNSIGNED NOT NULL,
    PRIMARY KEY (id_projet, id_objet),
    FOREIGN KEY (id_projet) REFERENCES projet_upcycling(id_projet),
    FOREIGN KEY (id_objet) REFERENCES objet(id_objet)
);

-- Historique des gains de score Upcycling (pour particuliers)
CREATE TABLE score_log (
    id_log INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    points INT NOT NULL,
    motif VARCHAR(255),
    date_action DATETIME DEFAULT CURRENT_TIMESTAMP,
    id_particulier INT UNSIGNED NOT NULL,
    id_projet INT UNSIGNED,
    FOREIGN KEY (id_particulier) REFERENCES particulier(id_particulier),
    FOREIGN KEY (id_projet) REFERENCES projet_upcycling(id_projet) ON DELETE SET NULL
);

-- 8. FOrums de discussion, messages, modération: 
CREATE TABLE forum (
    id_forum INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200) NOT NULL,
    description TEXT,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    statut ENUM('ouvert', 'ferme', 'archive') DEFAULT 'ouvert',
    id_salarie_createur INT UNSIGNED NOT NULL,
    FOREIGN KEY (id_salarie_createur) REFERENCES salarie(id_salarie)
);

CREATE TABLE message (
    id_message INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    contenu TEXT NOT NULL,
    date_envoi DATETIME DEFAULT CURRENT_TIMESTAMP,
    statut ENUM('visible', 'supprime') DEFAULT 'visible',
    id_utilisateur INT UNSIGNED NOT NULL,
    id_forum INT UNSIGNED NOT NULL,
    id_parent_message INT UNSIGNED,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur),
    FOREIGN KEY (id_forum) REFERENCES forum(id_forum),
    FOREIGN KEY (id_parent_message) REFERENCES message(id_message) ON DELETE CASCADE
);

-- Modération des forums par les salariés
CREATE TABLE moderation (
    id_salarie INT UNSIGNED NOT NULL,
    id_forum INT UNSIGNED NOT NULL,
    date_debut DATE,
    date_fin DATE,
    PRIMARY KEY (id_salarie, id_forum),
    FOREIGN KEY (id_salarie) REFERENCES salarie(id_salarie),
    FOREIGN KEY (id_forum) REFERENCES forum(id_forum)
);

-- 9. Conseils, ressources: 

CREATE TABLE conseil (
    id_conseil INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200) NOT NULL,
    contenu TEXT NOT NULL,
    date_publication DATETIME DEFAULT CURRENT_TIMESTAMP,
    statut ENUM('en_attente', 'publie', 'refuse') DEFAULT 'en_attente',
    id_salarie_redacteur INT UNSIGNED NOT NULL,
    id_admin_validation INT UNSIGNED,
    FOREIGN KEY (id_salarie_redacteur) REFERENCES salarie(id_salarie),
    FOREIGN KEY (id_admin_validation) REFERENCES admin(id_admin)
);

CREATE TABLE ressource (
    id_ressource INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200) NOT NULL,
    contenu TEXT,
    fichier_url VARCHAR(500),
    type ENUM('document', 'video', 'lien') NOT NULL,
    date_publication DATETIME DEFAULT CURRENT_TIMESTAMP,
    statut ENUM('actif', 'inactif') DEFAULT 'actif',
    id_salarie_publie INT UNSIGNED NOT NULL,
    id_admin_validation INT UNSIGNED,
    FOREIGN KEY (id_salarie_publie) REFERENCES salarie(id_salarie),
    FOREIGN KEY (id_admin_validation) REFERENCES admin(id_admin)
);

-- 10. NOtifications (push, email, sms), avec intégration OneSignal:

CREATE TABLE notification (
    id_notification INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(255),
    contenu TEXT NOT NULL,
    type ENUM('info', 'alerte', 'rappel') DEFAULT 'info',
    canal ENUM('push', 'email', 'sms') DEFAULT 'push',
    date_envoi DATETIME DEFAULT CURRENT_TIMESTAMP,
    lu BOOLEAN DEFAULT FALSE,
    ref_onesignal VARCHAR(255),
    id_utilisateur INT UNSIGNED NOT NULL,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur)
);

-- 11. Traductions multilingues :
CREATE TABLE traduction ( 
    id_traduction INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    table_concernee VARCHAR(50) NOT NULL,
    id_enregistrement INT UNSIGNED NOT NULL,
    champ VARCHAR(50) NOT NULL,
    langue CHAR(2) NOT NULL,
    valeur_traduite TEXT NOT NULL,
    UNIQUE KEY unique_traduction (table_concernee, id_enregistrement, champ, langue)
);

-- 12. Services de conseil : 
CREATE TABLE service (
    id_service INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    tarif DECIMAL(10,2) NOT NULL,
    duree_jours INT UNSIGNED DEFAULT 1,
    type_service ENUM('conseil', 'analyse', 'atelier_prive', 'autre') NOT NULL
);

CREATE TABLE achat_service (
    id_achat INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    date_achat DATETIME DEFAULT CURRENT_TIMESTAMP,
    montant DECIMAL(10,2) NOT NULL,
    statut ENUM('paye', 'non_paye', 'rembourse') DEFAULT 'non_paye',
    id_utilisateur INT UNSIGNED NOT NULL,
    id_service INT UNSIGNED NOT NULL,
    id_paiement INT UNSIGNED,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur),
    FOREIGN KEY (id_service) REFERENCES service(id_service),
    FOREIGN KEY (id_paiement) REFERENCES paiement(id_paiement)
);

-- 13. Indexes pour optimiser les requêtes fréquentes :

CREATE INDEX idx_annonce_statut ON annonce(statut);
CREATE INDEX idx_annonce_utilisateur ON annonce(id_utilisateur);
CREATE INDEX idx_depot_statut ON depot(statut);
CREATE INDEX idx_depot_conteneur ON depot(id_conteneur);
CREATE INDEX idx_evenement_date ON evenement(date_debut);
CREATE INDEX idx_evenement_statut ON evenement(statut);
CREATE INDEX idx_utilisateur_role ON utilisateur(role);
CREATE INDEX idx_utilisateur_email ON utilisateur(email);
CREATE INDEX idx_notification_utilisateur ON notification(id_utilisateur, lu);
CREATE INDEX idx_paiement_stripe ON paiement(ref_stripe);
CREATE INDEX idx_projet_utilisateur ON projet_upcycling(id_utilisateur);
CREATE INDEX idx_traduction_langue ON traduction(langue);
CREATE INDEX idx_objet_categorie ON objet(categorie_id);
CREATE INDEX idx_transaction_date ON transaction_achat(date_transaction);
CREATE INDEX idx_inscription_evenement ON inscription(id_evenement);
CREATE INDEX idx_planning_utilisateur ON planning(id_utilisateur, date_heure);
CREATE INDEX idx_message_forum ON message(id_forum, date_envoi);


-- Données de test à supprimer en prod : 
-- Utilisateurs de base
-- Mot de passe de démo pour tous les comptes : admin2026
INSERT INTO utilisateur (id_utilisateur, email, mot_de_passe, nom, prenom, role, actif, tutoriel_vu) VALUES
(1, 'admin@upcycleconnect.fr',   '$2a$12$ILs0nh0v0gPpEidRTAMHoOmTMQ/rgUQyzQTNcZn7Dv6ApDeSTzi4G', 'Admin',       'Super',   'admin',          TRUE, TRUE),
(2, 'alice@test.fr',             '$2a$12$ILs0nh0v0gPpEidRTAMHoOmTMQ/rgUQyzQTNcZn7Dv6ApDeSTzi4G', 'Dupont',      'Alice',   'particulier',    TRUE, TRUE),
(3, 'pro@test.fr',               '$2a$12$ILs0nh0v0gPpEidRTAMHoOmTMQ/rgUQyzQTNcZn7Dv6ApDeSTzi4G', 'Martin',      'Paul',    'professionnel',  TRUE, TRUE),
(4, 'salarie@test.fr',           '$2a$12$ILs0nh0v0gPpEidRTAMHoOmTMQ/rgUQyzQTNcZn7Dv6ApDeSTzi4G', 'Leroy',       'Sophie',  'salarie',        TRUE, TRUE);

-- Profils liés
INSERT INTO admin (id_admin, niveau_acces) VALUES (1, 'super_admin');
INSERT INTO particulier (id_particulier, upcycling_score_total) VALUES (2, 148);
INSERT INTO professionnel (id_professionnel, nom_entreprise, siret, type_metier, niveau_abonnement) VALUES (3, 'EcoMatériaux SARL', '12345678901234', 'Récupération', 'premium');
INSERT INTO salarie (id_salarie, poste, date_embauche) VALUES (4, 'animateur', '2024-01-15');

-- Catégories
INSERT INTO categorie (id_categorie, nom, description) VALUES
(1, 'Textiles',     'Vêtements, tissus, linge'),
(2, 'Bois',         'Meubles, palettes, planches'),
(3, 'Métal',        'Ferraille, aluminium, acier'),
(4, 'Plastique',    'Bouteilles, emballages, jouets'),
(5, 'Électronique', 'Appareils, câbles, composants'),
(6, 'Autre',        'Tout ce qui ne rentre pas ailleurs');

-- Conteneur de test
INSERT INTO conteneur (id_conteneur, adresse, ville, latitude, longitude, capacite, nb_objets, statut) VALUES
(1, '12 rue de la Paix', 'Paris', 48.8698, 2.3311, 50, 3, 'disponible');
