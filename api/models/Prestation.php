<?php
require_once __DIR__ . '/../config/database.php';

class Prestation {
    private $pdo;

    public function __construct() {
        global $pdo;
        $this->pdo = $pdo;
    }

    public function getAll() {
        $stmt = $this->pdo->query("SELECT p.*, c.nom as categorie_nom, u.nom as createur_nom FROM prestations p LEFT JOIN categories c ON p.categorie_id = c.id LEFT JOIN users u ON p.cree_par = u.id");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getById($id) {
        $stmt = $this->pdo->prepare("SELECT p.*, c.nom as categorie_nom, u.nom as createur_nom FROM prestations p LEFT JOIN categories c ON p.categorie_id = c.id LEFT JOIN users u ON p.cree_par = u.id WHERE p.id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function create($data) {
        $stmt = $this->pdo->prepare("INSERT INTO prestations (titre, description, type, prix, date_debut, date_fin, lieu, places_max, places_prises, categorie_id, statut, cree_par, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        return $stmt->execute([
            $data['titre'], $data['description'], $data['type'], $data['prix'],
            $data['date_debut'], $data['date_fin'], $data['lieu'], $data['places_max'],
            $data['places_prises'] ?? 0, $data['categorie_id'], $data['statut'] ?? 'brouillon',
            $data['cree_par'], $data['emoji'] ?? '📋'
        ]);
    }

    public function update($id, $data) {
        $stmt = $this->pdo->prepare("UPDATE prestations SET titre = ?, description = ?, type = ?, prix = ?, date_debut = ?, date_fin = ?, lieu = ?, places_max = ?, categorie_id = ?, statut = ?, emoji = ? WHERE id = ?");
        return $stmt->execute([
            $data['titre'], $data['description'], $data['type'], $data['prix'],
            $data['date_debut'], $data['date_fin'], $data['lieu'], $data['places_max'],
            $data['categorie_id'], $data['statut'], $data['emoji'] ?? '📋', $id
        ]);
    }

    public function delete($id) {
        $stmt = $this->pdo->prepare("DELETE FROM prestations WHERE id = ?");
        return $stmt->execute([$id]);
    }
}
?>