<?php
require_once __DIR__ . '/../config/database.php';

class User {
    private $pdo;

    public function __construct() {
        global $pdo;
        $this->pdo = $pdo;
    }

    public function getAll() {
        $stmt = $this->pdo->query("SELECT id, email, nom, prenom, role, date_inscription, statut, telephone, adresse FROM users");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getById($id) {
        $stmt = $this->pdo->prepare("SELECT id, email, nom, prenom, role, date_inscription, statut, telephone, adresse FROM users WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function create($data) {
        $password = password_hash($data['password'], PASSWORD_DEFAULT);
        $stmt = $this->pdo->prepare("INSERT INTO users (email, password, nom, prenom, role, statut, telephone, adresse) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        return $stmt->execute([
            $data['email'], $password, $data['nom'], $data['prenom'],
            $data['role'], $data['statut'] ?? 'actif',
            $data['telephone'] ?? null, $data['adresse'] ?? null
        ]);
    }

    public function update($id, $data) {
        $sql = "UPDATE users SET email = ?, nom = ?, prenom = ?, role = ?, statut = ?, telephone = ?, adresse = ?";
        $params = [$data['email'], $data['nom'], $data['prenom'], $data['role'], $data['statut'], $data['telephone'] ?? null, $data['adresse'] ?? null];
        if (!empty($data['password'])) {
            $sql .= ", password = ?";
            $params[] = password_hash($data['password'], PASSWORD_DEFAULT);
        }
        $sql .= " WHERE id = ?";
        $params[] = $id;
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($params);
    }

    public function delete($id) {
        $stmt = $this->pdo->prepare("DELETE FROM users WHERE id = ?");
        return $stmt->execute([$id]);
    }

    public function findByEmail($email) {
        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
?>