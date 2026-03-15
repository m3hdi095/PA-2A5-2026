<?php
require_once __DIR__ . '/../models/User.php';
session_start();

class AuthController {
    public function login() {
        $data = json_decode(file_get_contents('php://input'), true);
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';

        $userModel = new User();
        $user = $userModel->findByEmail($email);

        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['user'] = [
                'id' => $user['id'],
                'email' => $user['email'],
                'role' => $user['role'],
                'nom' => $user['nom']
            ];
            echo json_encode(['success' => true, 'user' => $_SESSION['user']]);
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Identifiants incorrects']);
        }
    }

    public function logout() {
        session_destroy();
        echo json_encode(['success' => true]);
    }

    public function me() {
        if (isset($_SESSION['user'])) {
            echo json_encode($_SESSION['user']);
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Non connecté']);
        }
    }
}
?>