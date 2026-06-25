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
    icone VARCHAR(100) NULL DEFAULT NULL,
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
    localisation VARCHAR(200) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
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
    id_utilisateur INT UNSIGNED DEFAULT NULL,
    FOREIGN KEY (id_abonnement) REFERENCES abonnement(id_abonnement),
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur) ON DELETE SET NULL
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
    type ENUM('formation', 'atelier', 'conference', 'forum', 'evenement') NOT NULL,
    description TEXT,
    date_debut DATETIME NOT NULL,
    date_fin DATETIME NOT NULL,
    lieu VARCHAR(255),
    tarif DECIMAL(10,2),
    nb_places INT UNSIGNED,
    statut ENUM('en_attente', 'valide', 'annule', 'cloture') DEFAULT 'en_attente',
    id_salarie_createur INT UNSIGNED NULL DEFAULT NULL,
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

-- Conteneurs de test
INSERT INTO conteneur (id_conteneur, adresse, ville, latitude, longitude, capacite, nb_objets, statut) VALUES
(1, '12 rue de la Paix',        'Paris',     48.8698, 2.3311,  50, 3, 'disponible'),
(2, '45 avenue de la République','Montreuil', 48.8637, 2.4413,  30, 0, 'disponible'),
(3, '8 rue du Faubourg Saint-Antoine','Paris',48.8533, 2.3729, 40, 12, 'disponible');

-- Objets (liés aux catégories, utilisés dans les annonces et dépôts)
INSERT INTO objet (id_objet, nom, categorie_id, etat, valeur_estimee, description) VALUES
(1, 'Palettes bois EUR (lot x4)',    2, 'bon',     0.00,  'Palettes standard 120x80cm, sans traitement chimique, idéales mobilier DIY.'),
(2, 'Chutes tissu lin naturel 2kg',  1, 'bon',     0.00,  'Chutes de lin naturel teinture végétale, idéal couture ou macramé.'),
(3, 'Profilés aluminium 40x20mm x4', 3, 'bon',    35.00,  'Profilés alu 3m, légèrement rayés en surface, structurellement parfaits.'),
(4, 'Vêtements laine mérinos 5kg',   1, 'bon',     0.00,  'Laine mérinos recyclable, couleurs variées, parfait upcycling textile.'),
(5, 'Câbles électriques 2.5mm 15m',  5, 'bon',     0.00,  'Chutes câble cuivre 2.5mm², récupération rénovation appartement.'),
(6, 'Planches OSB 18mm (x20)',        2, 'bon',    60.00,  'Planches 2400x1200mm en bonne condition, idéal construction légère.'),
(7, 'Pots de peinture intérieure',   6, 'abime',   0.00,  '15 pots partiellement remplis, couleurs intérieures variées.'),
(8, 'Machine à coudre Singer 1970',  6, 'bon',     55.00,  'Modèle mécanique années 70, fonctionne, vendue avec accessoires.');

-- Annonces validées (par alice particulier id=2)
INSERT INTO annonce (id_annonce, titre, description, type_annonce, prix, date_publication, statut, id_utilisateur, id_objet) VALUES
(1, 'Don palettes bois EUR - lot de 4',     'Palettes en bon état, idéales pour mobilier DIY. Dimensions standard 120x80cm. À venir chercher sur place.',            'don',   0.00,  '2026-05-10 10:00:00', 'validee', 2, 1),
(2, 'Chutes tissu lin naturel (2 kg)',       'Chutes de couturière, diverses couleurs naturelles. Parfait pour couture créative et upcycling.',                         'don',   0.00,  '2026-05-12 14:00:00', 'validee', 2, 2),
(3, 'Profilés aluminium 40x20mm - lot x4',  'Lot de profilés en excellent état, légères égratignures superficielles. Idéal menuiserie légère ou cadres.',              'vente', 35.00, '2026-05-15 09:00:00', 'validee', 2, 3),
(4, 'Vêtements laine mérinos à recycler',   'Sac 5kg de laine mérinos, très bon état. Idéal tricot, feutrage ou upcycling textile créatif.',                          'don',   0.00,  '2026-05-18 11:00:00', 'validee', 2, 4),
(5, 'Câbles électriques cuivre 2.5mm',      'Environ 15m de chutes de câble cuivre 2.5mm². Provenance rénovation. Coupes propres. Récupérables dès que possible.',    'don',   0.00,  '2026-05-20 16:00:00', 'validee', 2, 5),
(6, 'Planches OSB 18mm - lot de 20',        '20 planches OSB 2400x1200mm en bonne condition. Légères marques de stockage. Idéal pour construction légère ou meubles.', 'vente', 60.00, '2026-05-22 08:00:00', 'validee', 2, 6);

-- Événements futurs créés par le salarié (id=4), validés par l'admin (id=1)
INSERT INTO evenement (id_evenement, titre, type, description, date_debut, date_fin, lieu, tarif, nb_places, statut, id_salarie_createur) VALUES
(1, 'Atelier création luminaire en bois recyclé', 'atelier',    'Transformez des chutes de bois en lampes design. Matériel fourni, niveau débutant bienvenu. Repartez avec votre création !',                          '2026-06-20 10:00:00', '2026-06-20 13:00:00', 'Paris 11e, La Fabrique',     0.00, 12, 'valide', 4),
(2, 'Formation upcycling textile, Niveau 1',      'formation',  'Techniques de base pour valoriser tissu et vêtements : patchwork, teinture naturelle, customisation. Matériel fourni.',                               '2026-06-28 14:00:00', '2026-06-28 17:00:00', 'Paris 20e, Atelier Fil',    45.00, 10, 'valide', 4),
(3, 'Atelier réparation électroménager',          'atelier',    'Apprenez à réparer grille-pain, cafetières, petits appareils électroménagers. Amenez vos objets cassés, repartez avec !',                             '2026-07-05 10:30:00', '2026-07-05 13:30:00', 'Paris 13e, Repair Café',     5.00, 20,  'valide', 4),
(4, 'Journée portes ouvertes Ressourcerie',       'evenement',  'Découvrez la ressourcerie de Paris 19e : ateliers découverte, exposition de créations upcyclées et vente de matériaux de seconde main.',               '2026-07-12 10:00:00', '2026-07-12 18:00:00', 'Paris 19e, La Ressourcerie', 0.00, 500, 'valide', 4);

-- Inscription d'alice à l'atelier bois (événement 1)
INSERT INTO inscription (id_inscription, date_inscription, statut, id_utilisateur, id_evenement) VALUES
(1, '2026-06-01 09:00:00', 'non_paye', 2, 1);

-- Projets d'upcycling
INSERT INTO projet_upcycling (id_projet, titre, description, date_debut, date_fin, statut, score_impact, kg_dechets_evites, partage_communaute, id_utilisateur) VALUES
(1, 'Lampe suspendue en palette',      'Transformation de chutes de palette en suspension luminaire industriel. Ponce, lasure bois naturelle, câblage LED.',  '2026-03-01', '2026-04-15', 'termine',  25, 4.5,  TRUE, 2),
(2, 'Étagère murale bois flotté',      'Récupération de planches OSB pour créer une étagère 3 niveaux avec fixations discrètes. Finition huile naturelle.',  '2026-04-01', NULL,          'en_cours', 10, 2.2,  TRUE, 2),
(3, 'Meuble TV bois et métal recyclés','Assemblage châssis métal récupéré et plateau bois pour meuble TV sur mesure. Projet client professionnel.',          '2026-05-10', NULL,          'en_cours', 15, 8.0,  TRUE, 3);

-- Conseils publiés par le salarié
INSERT INTO conseil (id_conseil, titre, contenu, date_publication, statut, id_salarie_redacteur, id_admin_validation) VALUES
(1, '5 astuces pour upcycler vos palettes',
 'Les palettes sont l\'une des matières premières les plus accessibles pour l\'upcycling. Voici 5 projets pour démarrer : 1) Bibliothèque murale — démonter et poncer les planches, les fixer en quinconce. 2) Jardinière — assembler 3 palettes en U, garnir de géotextile et terreau. 3) Table basse — empiler 2 palettes, ajouter des roulettes. 4) Tête de lit — garder la palette entière, peindre. 5) Composteur — assembler 4 palettes en carré avec charnières.',
 '2026-05-05 10:00:00', 'publie', 4, 1),
(2, 'Guide débutant : transformer des vêtements usagés',
 'Pas besoin de machine à coudre professionnelle pour commencer l\'upcycling textile. Un jean trop petit peut devenir un sac, une chemise peut se transformer en pochette. Les bases : 1) Choisir un vêtement en bon tissu. 2) Démonter les coutures avec un découd-vite. 3) Utiliser les pans comme nouvelles pièces de tissu. 4) Assembler avec une simple machine ou à la main. Conseil : commencer par des projets sans coutures (nouer, tresser, feutrer).',
 '2026-05-20 14:00:00', 'publie', 4, 1);

-- Forum et messages
INSERT INTO forum (id_forum, titre, description, statut, id_salarie_createur) VALUES
(1, 'Projets en cours — partagez vos créations', 'Espace de partage pour montrer vos projets d\'upcycling en cours ou terminés. Photos et conseils bienvenus.', 'ouvert', 4),
(2, 'Questions & entraide upcycling',             'Posez vos questions techniques sur les matériaux, les outils ou les techniques. La communauté vous répond.',     'ouvert', 4);

INSERT INTO message (id_message, contenu, date_envoi, statut, id_utilisateur, id_forum) VALUES
(1, 'Bonjour à tous ! Je viens de terminer ma lampe en palette, le résultat est super. Je recommande de poncer avec du grain 80 puis 120 avant la lasure.',                     '2026-05-15 10:30:00', 'visible', 2, 1),
(2, 'Superbe résultat Alice ! Est-ce que tu as utilisé une lasure spéciale bois recyclé ou une lasure classique ?',                                                              '2026-05-15 14:00:00', 'visible', 3, 1),
(3, 'Lasure à base d\'huile de lin pour les extérieurs, très naturelle et écologique. On en trouve facilement en magasin de bricolage.',                                         '2026-05-15 15:30:00', 'visible', 2, 1),
(4, 'Bonjour, quelqu\'un sait comment enlever les agrafes des palettes sans abîmer le bois ? J\'en ai cassé plusieurs en essayant avec un tournevis.',                          '2026-05-18 09:00:00', 'visible', 2, 2),
(5, 'Utilise un pied de biche plat entre la planche et l\'agrafe, en faisant levier doucement. Un marteau pour enfoncer d\'abord l\'agrafe puis le pied de biche.',             '2026-05-18 11:00:00', 'visible', 4, 2);

-- Historique du score upcycling d'alice (total = 148 pts)
INSERT INTO score_log (id_log, points, motif, date_action, id_particulier) VALUES
(1,  20, 'Dépôt objet conteneur — Palettes bois',          '2026-03-10 10:00:00', 2),
(2,  10, 'Annonce publiée — Don palettes bois',             '2026-03-15 11:00:00', 2),
(3,  25, 'Projet terminé — Lampe suspendue en palette',     '2026-04-15 18:00:00', 2),
(4,  20, 'Dépôt objet conteneur — Chutes tissu',           '2026-04-20 09:00:00', 2),
(5,  10, 'Annonce publiée — Don chutes tissu lin',          '2026-04-22 10:00:00', 2),
(6,  15, 'Inscription événement — Atelier luminaire bois',  '2026-06-01 09:00:00', 2),
(7,  10, 'Annonce publiée — Profilés aluminium',            '2026-05-15 09:00:00', 2),
(8,  10, 'Annonce publiée — Laine mérinos',                 '2026-05-18 11:00:00', 2),
(9,  10, 'Annonce publiée — Câbles cuivre',                 '2026-05-20 16:00:00', 2),
(10, 10, 'Annonce publiée — Planches OSB',                  '2026-05-22 08:00:00', 2),
(11, 20, 'Dépôt objet conteneur — Pots de peinture',       '2026-05-25 14:00:00', 2),
(12, -2, 'Correction manuelle — doublon',                   '2026-05-26 09:00:00', 2);

-- Planning personnel d'alice
INSERT INTO planning (id_planning, titre, date_heure, duree_minutes, type_entree, notes, id_utilisateur, id_evenement) VALUES
(1, 'Atelier luminaire bois recyclé', '2026-06-20 10:00:00', 180, 'evenement',  'Prévoir tenue de travail', 2, 1),
(2, 'Acheter huile de lin',           '2026-06-15 11:00:00',  30, 'rappel',     'Magasin Leroy Merlin ou bio', 2, NULL),
(3, 'Finir étagère murale',           '2026-06-22 14:00:00', 120, 'personnel',  'Fixer les supports au mur', 2, NULL);

-- Notifications pour alice
INSERT INTO notification (id_notification, titre, contenu, type, canal, lu, id_utilisateur) VALUES
(1, 'Votre annonce a été validée', 'Votre annonce "Don palettes bois EUR" a été validée par l\'équipe UpcycleConnect. Elle est maintenant visible par tous les membres.', 'info', 'push', TRUE,  2),
(2, 'Rappel : atelier dans 3 jours', 'N\'oubliez pas votre inscription à l\'atelier Création luminaire en bois recyclé le 20 juin à 10h. Paris 11e, La Fabrique.',  'rappel', 'push', FALSE, 2);

-- Traductions anglaises (EN) pour le contenu metier
INSERT INTO traduction (table_concernee, id_enregistrement, champ, langue, valeur_traduite) VALUES
('evenement', 1, 'titre',       'en', 'Recycled Wood Lighting Workshop'),
('evenement', 1, 'description', 'en', 'Transform wood offcuts into designer lamps. Materials provided, beginner friendly. Take your creation home!'),
('evenement', 2, 'titre',       'en', 'Textile Upcycling Training, Level 1'),
('evenement', 2, 'description', 'en', 'Basic techniques for giving new life to fabric and clothing: patchwork, natural dyeing, customization. Materials provided.'),
('evenement', 3, 'titre',       'en', 'Home Appliance Repair Workshop'),
('evenement', 3, 'description', 'en', 'Learn to repair toasters, coffee makers and small appliances. Bring your broken items, leave with them fixed.'),
('evenement', 4, 'titre',       'en', 'Ressourcerie Open House Day'),
('evenement', 4, 'description', 'en', 'Discover the ressourcerie: upcycling workshops, exhibition of recycled creations and second-hand materials for sale.'),
('annonce', 1, 'titre',       'en', 'Free pallets - lot of 4'),
('annonce', 1, 'description', 'en', 'Good condition pallets, ideal for DIY furniture. Standard 120x80cm dimensions. Pick up on site.'),
('annonce', 2, 'titre',       'en', 'Natural linen fabric offcuts (2 kg)'),
('annonce', 2, 'description', 'en', 'Seamstress offcuts, various natural colors. Perfect for creative sewing and upcycling.'),
('annonce', 3, 'titre',       'en', 'Aluminium profiles 40x20mm - lot x4'),
('annonce', 3, 'description', 'en', 'Lot of profiles in excellent condition, slight surface scratches. Ideal for light carpentry or frames.'),
('annonce', 4, 'titre',       'en', 'Merino wool clothing to recycle'),
('annonce', 4, 'description', 'en', '5kg bag of merino wool, great condition. Ideal for felting, knitting or creative textile upcycling.'),
('annonce', 5, 'titre',       'en', 'Copper electrical cable 2.5mm'),
('annonce', 5, 'description', 'en', 'About 15m of 2.5mm copper cable offcuts. From apartment renovation. Clean cuts.'),
('annonce', 6, 'titre',       'en', 'OSB boards 18mm - lot of 20'),
('annonce', 6, 'description', 'en', '20 OSB boards 2400x1200mm in good condition. Ideal for light construction or furniture.'),
('conseil', 1, 'titre',   'en', '5 tips for upcycling your pallets'),
('conseil', 1, 'contenu', 'en', 'Pallets are one of the most accessible raw materials. 5 projects to get started: 1) Wall bookshelf. 2) Planter. 3) Coffee table with wheels. 4) Headboard. 5) Composter by assembling 4 pallets in a square.'),
('conseil', 2, 'titre',   'en', 'Beginner guide: transforming used clothing'),
('conseil', 2, 'contenu', 'en', 'No professional machine needed. An old pair of jeans becomes a bag, a shirt becomes a pouch. Basics: choose good fabric, unpick the seams, assemble the panels.'),
('categorie', 1, 'nom', 'en', 'Textiles'),
('categorie', 2, 'nom', 'en', 'Wood'),
('categorie', 3, 'nom', 'en', 'Metal'),
('categorie', 4, 'nom', 'en', 'Plastic'),
('categorie', 5, 'nom', 'en', 'Electronics'),
('categorie', 6, 'nom', 'en', 'Other');
