<?php
// ============================================================
// index.php - ROTEADOR PRINCIPAL
// ============================================================

// CORRECAO PARA RODAR NO NODE.JS
if (!isset($_SERVER['REQUEST_URI'])) {
    $_SERVER['REQUEST_URI'] = $_SERVER['SCRIPT_NAME'] ?? '/';
}
if (!isset($_SERVER['REQUEST_METHOD'])) {
    $_SERVER['REQUEST_METHOD'] = 'GET';
}
if (!isset($_SERVER['SCRIPT_FILENAME'])) {
    $_SERVER['SCRIPT_FILENAME'] = __FILE__;
}
if (!isset($_SERVER['REMOTE_ADDR'])) {
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
}

// INICIAR SESSION
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// CARREGAR CONFIG
require_once __DIR__ . '/config.php';

// PEGAR ACAO
$action = isset($_GET['action']) ? $_GET['action'] : '';

// ============================================================
// API - RETORNA JSON
// ============================================================
if ($action === 'api') {
    require_once __DIR__ . '/api.php';
    exit;
}

// ============================================================
// LOGIN ADMIN (AJAX)
// ============================================================
if ($action === 'admin_login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/config.php';
    $password = isset($_POST['password']) ? trim($_POST['password']) : '';
    global $ADMIN_PASSWORD;
    
    if ($password === $ADMIN_PASSWORD) {
        $_SESSION['admin_logged'] = true;
        $_SESSION['admin_token'] = generateToken('admin');
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Senha incorreta!']);
    }
    exit;
}

// ============================================================
// LOGIN USUARIO (AJAX)
// ============================================================
if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/config.php';
    $key = isset($_POST['key']) ? trim($_POST['key']) : '';
    
    if (empty($key)) {
        echo json_encode(['success' => false, 'message' => 'Digite uma KEY!']);
        exit;
    }
    
    $keyData = validateKey($key);
    if ($keyData) {
        $_SESSION['key'] = $key;
        $_SESSION['user_id'] = $keyData['user_id'];
        $_SESSION['simultaneous_limit'] = $keyData['simultaneous'];
        $_SESSION['max_time'] = $keyData['max_time'];
        $_SESSION['key_expires'] = $keyData['expires_at'];
        $_SESSION['logged_in'] = true;
        
        $user = getUser($keyData['user_id']);
        $newUser = !$user;
        if ($newUser) $_SESSION['new_user'] = true;
        
        echo json_encode(['success' => true, 'new_user' => $newUser]);
    } else {
        echo json_encode(['success' => false, 'message' => 'KEY INVALIDA OU EXPIRADA!']);
    }
    exit;
}

// ============================================================
// REGISTRAR NOME DO USUARIO (AJAX)
// ============================================================
if ($action === 'register_name' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/config.php';
    $name = isset($_POST['name']) ? trim($_POST['name']) : '';
    $userId = $_SESSION['user_id'] ?? '';
    
    if (empty($name) || empty($userId)) {
        echo json_encode(['success' => false, 'message' => 'Nome invalido!']);
        exit;
    }
    
    if (registerUser($userId, $name)) {
        unset($_SESSION['new_user']);
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro ao registrar!']);
    }
    exit;
}

// ============================================================
// ADMIN ACTIONS (AJAX)
// ============================================================
if ($action === 'admin_action' && isset($_SESSION['admin_logged'])) {
    require_once __DIR__ . '/admin_actions.php';
    exit;
}

// ============================================================
// USER ACTIONS (AJAX)
// ============================================================
if ($action === 'user_action' && isset($_SESSION['logged_in'])) {
    require_once __DIR__ . '/user_actions.php';
    exit;
}

// ============================================================
// LOGOUT
// ============================================================
if ($action === 'logout') {
    session_destroy();
    header('Location: ?action=login');
    exit;
}

if ($action === 'admin_logout') {
    if (isset($_SESSION['admin_token'])) revokeToken($_SESSION['admin_token']);
    session_destroy();
    header('Location: ?action=login');
    exit;
}

// ============================================================
// VERIFICAR LOGIN PARA PAGINAS PROTEGIDAS
// ============================================================
if ($action !== 'login' && $action !== 'admin_login' && $action !== 'admin_action' && $action !== 'user_action' && $action !== 'register_name' && $action !== 'api' && !isset($_SESSION['admin_logged'])) {
    if (isset($_SESSION['logged_in']) && isset($_SESSION['key'])) {
        require_once __DIR__ . '/config.php';
        $keyData = validateKey($_SESSION['key']);
        if (!$keyData) {
            session_destroy();
            header('Location: ?action=login');
            exit;
        }
        $_SESSION['simultaneous_limit'] = $keyData['simultaneous'];
        $_SESSION['max_time'] = $keyData['max_time'];
        $_SESSION['key_expires'] = $keyData['expires_at'];
    } else {
        header('Location: ?action=login');
        exit;
    }
}

// ============================================================
// ROTEAMENTO DE PAGINAS
// ============================================================
switch ($action) {
    case 'login':
        require_once __DIR__ . '/login.php';
        break;
    
    case 'admin_panel':
        require_once __DIR__ . '/admin_panel.php';
        break;
    
    case 'dashboard':
        require_once __DIR__ . '/dashboard.php';
        break;
    
    default:
        require_once __DIR__ . '/login.php';
        break;
}
?>