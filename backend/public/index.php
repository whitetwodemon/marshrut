<?php
// public/index.php — entry point (HTTP only)

declare(strict_types=1);

// Guard: не запускать через CLI (create-admin.php делает require autoload отдельно)
if (PHP_SAPI === 'cli') { exit(0); }

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../vendor/autoload.php';

use Marshrut\Router;
use Marshrut\Middleware\Cors;
use Marshrut\Middleware\Auth;
use Marshrut\Controllers\AuthController;
use Marshrut\Controllers\AdminController;
use Marshrut\Controllers\DetailsController;
use Marshrut\Controllers\OrdersController;
use Marshrut\Controllers\TasksController;
use Marshrut\Controllers\ScanLogController;
use Marshrut\Controllers\EventsController;
use Marshrut\Controllers\WorkshopsController;
use Marshrut\Controllers\WorkCentersController;
use Marshrut\Controllers\PausesController;
use Marshrut\Controllers\ShiftsController;
use Marshrut\Controllers\HealthController;
use Marshrut\Controllers\SettingsController;

Cors::handle();

$path   = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path   = rtrim($path, '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'];

if ($path === '/health') {
    echo json_encode(['status' => 'ok', 'time' => date('c')]);
    exit;
}

$r = new Router();

// Auth (public)
$r->add('POST', '/api/auth/login',    [AuthController::class, 'login']);
$r->add('POST', '/api/auth/register', [AuthController::class, 'register']);
$r->add('POST', '/api/auth/refresh',  [AuthController::class, 'refresh']);
$r->add('POST', '/api/auth/logout',   [AuthController::class, 'logout']);
$r->add('GET',  '/api/auth/me',       [AuthController::class, 'me']);

// Admin
$r->add('GET',    '/api/admin/users',                  [AdminController::class, 'listUsers']);
$r->add('POST',   '/api/admin/users',                  [AdminController::class, 'createUser']);
$r->add('GET',    '/api/admin/users/{id}',             [AdminController::class, 'getUser']);
$r->add('PUT',    '/api/admin/users/{id}',             [AdminController::class, 'updateUser']);
$r->add('DELETE', '/api/admin/users/{id}',             [AdminController::class, 'deleteUser']);
$r->add('GET',    '/api/admin/roles',                  [AdminController::class, 'listRoles']);
$r->add('PUT',    '/api/admin/roles/{id}/permissions', [AdminController::class, 'setRolePermissions']);
$r->add('GET',    '/api/admin/permissions',            [AdminController::class, 'listPermissions']);

// Dashboard

// Details
$r->add('GET',    '/api/details',       function($p) { Auth::require();             DetailsController::index($p); });
$r->add('POST',   '/api/details',       function($p) { Auth::can('details.create'); DetailsController::create($p); });
$r->add('GET',    '/api/details/{id}',  function($p) { Auth::require();             DetailsController::show($p); });
$r->add('PUT',    '/api/details/{id}',  function($p) { Auth::can('details.edit');   DetailsController::update($p); });
$r->add('DELETE', '/api/details/{id}',  function($p) { Auth::can('details.delete'); DetailsController::delete($p); });

// Orders
$r->add('GET',    '/api/orders',        function($p) { Auth::require();             OrdersController::index($p); });
$r->add('POST',   '/api/orders',        function($p) { Auth::can('orders.create');  OrdersController::create($p); });
$r->add('GET',    '/api/orders/{id}',   function($p) { Auth::require();             OrdersController::show($p); });
$r->add('PUT',    '/api/orders/{id}',   function($p) { Auth::can('orders.edit');    OrdersController::update($p); });
$r->add('DELETE', '/api/orders/{id}',   function($p) { Auth::can('orders.delete');  OrdersController::delete($p); });

// Tasks — порядок важен: статичные пути ДО параметрических
$r->add('GET',   '/api/tasks',              function($p) { Auth::require();           TasksController::index($p); });
$r->add('GET',   '/api/tasks/scan/{qr}',    function($p) { Auth::can('scanner.use'); TasksController::findByQr($p); });
$r->add('GET',   '/api/tasks/{id}',         function($p) { Auth::require();           TasksController::show($p); });
$r->add('PATCH', '/api/tasks/{id}/status',  function($p) { Auth::can('scanner.use'); TasksController::updateStatus($p); });
$r->add('POST',  '/api/tasks/{id}/close',   function($p) { Auth::can('scanner.use'); TasksController::close($p); });

// Scan log
$r->add('GET',  '/api/scan-log', function($p) { Auth::can('log.view');    ScanLogController::index($p); });
$r->add('POST', '/api/scan-log', function($p) { Auth::can('scanner.use'); ScanLogController::create($p); });

// Workshops
$r->add('GET',    '/api/workshops',            function($p) { Auth::require();       WorkshopsController::index($p); });
$r->add('POST',   '/api/workshops',            function($p) { Auth::can('orders.edit'); WorkshopsController::create($p); });
$r->add('GET',    '/api/workshops/{id}',       function($p) { Auth::require();       WorkshopsController::show($p); });
$r->add('PUT',    '/api/workshops/{id}',       function($p) { Auth::can('orders.edit'); WorkshopsController::update($p); });
$r->add('DELETE', '/api/workshops/{id}',       function($p) { Auth::can('orders.edit'); WorkshopsController::delete($p); });
$r->add('GET',    '/api/workshops/{id}/load',      function($p) { Auth::require();          WorkshopsController::load($p); });
$r->add('GET',    '/api/workshops/{id}/equipment', function($p) { Auth::require();          WorkshopsController::equipment($p); });
$r->add('POST',   '/api/workshops/{id}/equipment', function($p) { Auth::can('orders.edit'); WorkshopsController::addEquipment($p); });
$r->add('DELETE', '/api/equipment/{id}',           function($p) { Auth::can('orders.edit'); WorkshopsController::deleteEquipment($p); });
$r->add('GET',    '/api/equipment',                function($p) { Auth::require();          WorkshopsController::allEquipment($p); });

// Add task to existing order
$r->add('POST', '/api/orders/{id}/add-task', function($p) { Auth::can('orders.edit'); OrdersController::addTask($p); });

// Work Centers
$r->add('GET',    '/api/work-centers',         function($p) { Auth::require();          WorkCentersController::index($p); });
$r->add('POST',   '/api/work-centers',         function($p) { Auth::can('orders.edit'); WorkCentersController::create($p); });
$r->add('PUT',    '/api/work-centers/{id}',    function($p) { Auth::can('orders.edit'); WorkCentersController::update($p); });
$r->add('DELETE', '/api/work-centers/{id}',    function($p) { Auth::can('orders.edit'); WorkCentersController::delete($p); });
$r->add('GET',    '/api/work-centers/{id}/order-priority', function($p) { Auth::require();          WorkCentersController::getPriority($p); });
$r->add('POST',   '/api/work-centers/{id}/order-priority', function($p) { Auth::can('orders.edit'); WorkCentersController::setPriority($p); });
$r->add('GET',    '/api/work-centers/{id}/tasks', function($p) { Auth::require();       WorkCentersController::tasks($p); });
$r->add('POST',   '/api/orders/next-number',   function($p) { Auth::require();          WorkCentersController::nextOrderNumber($p); });

// Settings
$r->add('GET',  '/api/settings',       function($p) { Auth::require();          SettingsController::index($p); });
$r->add('POST', '/api/settings',       function($p) { Auth::can('settings.manage'); SettingsController::update($p); });

// Healthcheck (без авторизации)
$r->add('GET', '/api/health', function($p) { HealthController::check($p); });

// Shifts
$r->add('GET',  '/api/shifts/by-date',       function($p) { Auth::require(); ShiftsController::byDate($p); });
$r->add('GET',  '/api/shifts',              function($p) { Auth::require();       ShiftsController::index($p); });
$r->add('GET',  '/api/shifts/active',       function($p) { Auth::require();       ShiftsController::active($p); });
$r->add('POST', '/api/shifts/open',         function($p) { Auth::require();       ShiftsController::open($p); });
$r->add('POST', '/api/shifts/{id}/close',   function($p) { Auth::require();       ShiftsController::close($p); });
$r->add('POST', '/api/shifts/{id}/handoff', function($p) { Auth::require();       ShiftsController::handoff($p); });
$r->add('GET',  '/api/shifts/{id}/report',  function($p) { Auth::require();       ShiftsController::report($p); });

// Task pauses
$r->add('POST',   '/api/tasks/{id}/pause',     function($p) { Auth::require(); PausesController::start($p); });
$r->add('POST',   '/api/tasks/{id}/resume',    function($p) { Auth::require(); PausesController::end($p); });
$r->add('GET',    '/api/tasks/{id}/pauses',    function($p) { Auth::require(); PausesController::list($p); });

// SSE — real-time events (token via query param since EventSource has no headers)
$r->add('GET', '/api/events', [EventsController::class, 'stream']);

$r->dispatch($method, $path);
