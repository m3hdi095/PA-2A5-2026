<?php
$host = 'localhost';
$dbname = 'upcycleconnect';
$username = 'root';
$password = ''; // Mets ton mot de passe MySQL

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    die(json_encode(['error' => 'Connexion BDD échouée : ' . $e->getMessage()]));
}
?>