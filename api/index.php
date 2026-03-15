<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");

// Gestion CORS : autoriser l'origine exacte du front
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin == 'http://127.0.0.1:5500' || $origin == 'http://localhost:3000' || $origin == 'http://localhost:8000') {
    header("Access-Control-Allow-Origin: $origin");
}

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'controllers/AuthController.php';
require_once 'controllers/UserController.php';
require_once 'controllers/CategorieController.php';
require_once 'controllers/PrestationController.php';
require_once 'controllers/StatsController.php';

$request = $_SERVER['REQUEST_URI'];
$base = ''; // Si l'API est à la racine du serveur (pas de sous-dossier)
$path = str_replace($base, '', parse_url($request, PHP_URL_PATH));
$segments = explode('/', trim($path, '/'));
$resource = $segments[0] ?? '';
$id = $segments[1] ?? null;

switch ($resource) {
    case 'login':
        if ($_SERVER['REQUEST_METHOD'] == 'POST') (new AuthController())->login();
        break;
    case 'logout':
        if ($_SERVER['REQUEST_METHOD'] == 'POST') (new AuthController())->logout();
        break;
    case 'me':
        if ($_SERVER['REQUEST_METHOD'] == 'GET') (new AuthController())->me();
        break;
    case 'users':
        $ctrl = new UserController();
        if ($_SERVER['REQUEST_METHOD'] == 'GET' && !$id) $ctrl->index();
        elseif ($_SERVER['REQUEST_METHOD'] == 'GET' && $id) $ctrl->show($id);
        elseif ($_SERVER['REQUEST_METHOD'] == 'POST') $ctrl->store();
        elseif ($_SERVER['REQUEST_METHOD'] == 'PUT' && $id) $ctrl->update($id);
        elseif ($_SERVER['REQUEST_METHOD'] == 'DELETE' && $id) $ctrl->destroy($id);
        else http_response_code(405);
        break;
    case 'categories':
        $ctrl = new CategorieController();
        if ($_SERVER['REQUEST_METHOD'] == 'GET' && !$id) $ctrl->index();
        elseif ($_SERVER['REQUEST_METHOD'] == 'GET' && $id) $ctrl->show($id);
        elseif ($_SERVER['REQUEST_METHOD'] == 'POST') $ctrl->store();
        elseif ($_SERVER['REQUEST_METHOD'] == 'PUT' && $id) $ctrl->update($id);
        elseif ($_SERVER['REQUEST_METHOD'] == 'DELETE' && $id) $ctrl->destroy($id);
        else http_response_code(405);
        break;
    case 'prestations':
        $ctrl = new PrestationController();
        if ($_SERVER['REQUEST_METHOD'] == 'GET' && !$id) $ctrl->index();
        elseif ($_SERVER['REQUEST_METHOD'] == 'GET' && $id) $ctrl->show($id);
        elseif ($_SERVER['REQUEST_METHOD'] == 'POST') $ctrl->store();
        elseif ($_SERVER['REQUEST_METHOD'] == 'PUT' && $id) $ctrl->update($id);
        elseif ($_SERVER['REQUEST_METHOD'] == 'DELETE' && $id) $ctrl->destroy($id);
        else http_response_code(405);
        break;
    case 'stats':
        if ($_SERVER['REQUEST_METHOD'] == 'GET') (new StatsController())->index();
        break;
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Route non trouvée']);
}
?>