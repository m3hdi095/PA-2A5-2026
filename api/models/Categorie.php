<?php
require_once __DIR__ . '/../config/database.php';

class Categorie {
    private $pdo;

    public function __construct() {
        global $pdo;
        $this->pdo = $pdo;
    }

    public function getAll() {
        $stmt = $this->pdo->query("SELECT * FROM categories");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getById($id) {
        $stmt = $this->pdo->prepare("SELECT * FROM categories WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function create($data) {
        $stmt = $this->pdo->prepare("INSERT INTO categories (nom, description, parent_id, icone) VALUES (?, ?, ?, ?)");
        return $stmt->execute([$data['nom'], $data['description'] ?? null, $data['parent_id'] ?? null, $data['icone'] ?? '📦']);
    }

    public function update($id, $data) {
        $stmt = $this->pdo->prepare("UPDATE categories SET nom = ?, description = ?, parent_id = ?, icone = ? WHERE id = ?");
        return $stmt->execute([$data['nom'], $data['description'] ?? null, $data['parent_id'] ?? null, $data['icone'] ?? '📦', $id]);
    }

    public function delete($id) {
        $stmt = $this->pdo->prepare("DELETE FROM categories WHERE id = ?");
        return $stmt->execute([$id]);
    }
}
?>