<?php
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class UserController {
    private $userModel;

    public function __construct() {
        $this->userModel = new User();
    }

    public function index() {
        requireAdmin();
        echo json_encode($this->userModel->getAll());
    }

    public function show($id) {
        requireAdmin();
        $user = $this->userModel->getById($id);
        if ($user) {
            echo json_encode($user);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Utilisateur non trouvé']);
        }
    }

    public function store() {
        requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        if ($this->userModel->create($data)) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Erreur lors de la création']);
        }
    }

    public function update($id) {
        requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        if ($this->userModel->update($id, $data)) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Erreur lors de la mise à jour']);
        }
    }

    public function destroy($id) {
        requireAdmin();
        if ($this->userModel->delete($id)) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Erreur lors de la suppression']);
        }
    }
}
?>