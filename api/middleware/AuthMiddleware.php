<?php
session_start();

function isAdmin() {
    return isset($_SESSION['user']) && $_SESSION['user']['role'] === 'admin';
}

function requireAdmin() {
    if (!isAdmin()) {
        http_response_code(401);
        echo json_encode(['error' => 'Non autorisé']);
        exit;
    }
}
?>