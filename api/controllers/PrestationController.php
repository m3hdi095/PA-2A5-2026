<?php
require_once __DIR__ . '/../models/Prestation.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class PrestationController {
    private $model;

    public function __construct() {
        $this->model = new Prestation();
    }

    public function index() {
        requireAdmin();
        echo json_encode($this->model->getAll());
    }

    public function show($id) {
        requireAdmin();
        $item = $this->model->getById($id);
        if ($item) echo json_encode($item);
        else { http_response_code(404); echo json_encode(['error' => 'Prestation non trouvée']); }
    }

    public function store() {
        requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        if ($this->model->create($data)) echo json_encode(['success' => true]);
        else { http_response_code(500); echo json_encode(['error' => 'Erreur création']); }
    }

    public function update($id) {
        requireAdmin();
        $data = json_decode(file_get_contents('php://input'), true);
        if ($this->model->update($id, $data)) echo json_encode(['success' => true]);
        else { http_response_code(500); echo json_encode(['error' => 'Erreur mise à jour']); }
    }

    public function destroy($id) {
        requireAdmin();
        if ($this->model->delete($id)) echo json_encode(['success' => true]);
        else { http_response_code(500); echo json_encode(['error' => 'Erreur suppression']); }
    }
}
?>