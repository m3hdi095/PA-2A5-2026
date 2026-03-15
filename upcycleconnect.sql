DROP DATABASE upcycleconnect;


CREATE DATABASE upcycleconnect;
USE upcycleconnect;


CREATE TABLE utilisateur (
    id_utilisateur INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    type_utilisateur ENUM('particulier','professionnel','salarié','admin') NOT NULL,
    adresse VARCHAR(255),
    ville VARCHAR(100),
    code_postal VARCHAR(20),
    telephone VARCHAR(20),
    date_inscription DATE,
    statut BOOLEAN DEFAULT TRUE,
    upcycling_score_total INT DEFAULT 0
);



CREATE TABLE conteneur (
    id_conteneur INT AUTO_INCREMENT PRIMARY KEY,
    localisation VARCHAR(255),
    capacite INT,
    statut ENUM('disponible','plein','en_maintenance') DEFAULT 'disponible',
    code_acces VARCHAR(100)
);



CREATE TABLE objet (
    id_objet INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(150),
    categorie VARCHAR(100),
    etat ENUM('neuf','bon','abimé'),
    valeur_estimee DECIMAL(10,2),
    code_barre VARCHAR(100),
    id_conteneur INT,
    FOREIGN KEY (id_conteneur) REFERENCES conteneur(id_conteneur)
);



CREATE TABLE annonce (
    id_annonce INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200),
    description TEXT,
    type_annonce ENUM('don','vente'),
    prix DECIMAL(10,2),
    date_publication DATE,
    statut ENUM('en_attente','validée','refusée','archivée') DEFAULT 'en_attente',
    id_utilisateur INT,
    id_objet INT,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur),
    FOREIGN KEY (id_objet) REFERENCES objet(id_objet)
);



CREATE TABLE projet_upcycling (
    id_projet INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200),
    description TEXT,
    date_debut DATE,
    date_fin DATE,
    statut ENUM('en_cours','terminé'),
    id_utilisateur INT,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur)
);



CREATE TABLE objet_projet (
    id_objet_projet INT AUTO_INCREMENT PRIMARY KEY,
    id_objet INT,
    id_projet INT,
    FOREIGN KEY (id_objet) REFERENCES objet(id_objet),
    FOREIGN KEY (id_projet) REFERENCES projet_upcycling(id_projet)
);



CREATE TABLE evenement (
    id_evenement INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200),
    type ENUM('atelier','formation','conference','forum'),
    date DATE,
    lieu VARCHAR(200),
    tarif DECIMAL(10,2),
    nb_places INT,
    id_salarie INT,
    FOREIGN KEY (id_salarie) REFERENCES utilisateur(id_utilisateur)
);



CREATE TABLE paiement (
    id_paiement INT AUTO_INCREMENT PRIMARY KEY,
    moyen VARCHAR(100),
    date_paiement DATE,
    montant DECIMAL(10,2),
    ref_stripe VARCHAR(200)
);



CREATE TABLE facture (
    id_facture INT AUTO_INCREMENT PRIMARY KEY,
    date_emission DATE,
    montant DECIMAL(10,2),
    statut ENUM('payée','en_attente','annulée'),
    id_utilisateur INT,
    id_paiement INT,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur),
    FOREIGN KEY (id_paiement) REFERENCES paiement(id_paiement)
);


CREATE TABLE notification (
    id_notification INT AUTO_INCREMENT PRIMARY KEY,
    contenu TEXT,
    type ENUM('info','alerte','rappel'),
    date_envoi DATE,
    id_utilisateur INT,
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur)
);



CREATE TABLE conseil (
    id_conseil INT AUTO_INCREMENT PRIMARY KEY,
    titre VARCHAR(200),
    contenu TEXT,
    date_publication DATE,
    id_salarie INT,
    FOREIGN KEY (id_salarie) REFERENCES utilisateur(id_utilisateur)
);


