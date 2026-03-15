<?php
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Categorie.php';
require_once __DIR__ . '/../models/Prestation.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class StatsController {
    public function index() {
        requireAdmin();
        $userModel = new User();
        $categorieModel = new Categorie();
        $prestationModel = new Prestation();

        $stats = [
            'users' => count($userModel->getAll()),
            'categories' => count($categorieModel->getAll()),
            'prestations' => count($prestationModel->getAll())
        ];
        echo json_encode($stats);
    }
}
?>