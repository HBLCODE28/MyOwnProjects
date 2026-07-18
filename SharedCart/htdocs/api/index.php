<?php
declare(strict_types=1);

date_default_timezone_set('UTC');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/admin_helper.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ('OPTIONS' === $method) {
    http_response_code(204);
    exit;
}

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$scriptName  = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/api/index.php');
$apiBase     = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');

if ('' !== $apiBase && '/' !== $apiBase && str_starts_with($requestPath, $apiBase . '/')) {
    $relativePath = substr($requestPath, strlen($apiBase));
} elseif ($requestPath === $apiBase) {
    $relativePath = '/';
} else {
    $relativePath = preg_replace('#^.*?/api(?:/|$)#', '/', $requestPath, 1) ?? '/';
}

$parts    = array_values(array_filter(explode('/', trim($relativePath, '/')), 'strlen'));
$resource = $parts[0] ?? '';
$id = null;
$sub = '';
$adminSection = '';
$adminId = null;
$adminAction = '';

if ('auth' === $resource || 'invite' === $resource || 'profile' === $resource) {
    $sub = $parts[1] ?? '';
} elseif ('admin' === $resource) {
    $adminSection = $parts[1] ?? 'overview';
    if (isset($parts[2]) && ctype_digit((string)$parts[2])) {
        $adminId = (int)$parts[2];
        $adminAction = $parts[3] ?? '';
    } else {
        $adminAction = $parts[2] ?? '';
    }
} else {
    $id  = isset($parts[1]) && ctype_digit((string)$parts[1]) ? (int)$parts[1] : null;
    $sub = $parts[2] ?? '';
}

try {
    $schemaDb = getDb();
    $schemaDb->exec("SET time_zone = '+00:00'");
    ensureItemSharingSchema($schemaDb);
    ensureAdminSchema($schemaDb);

    match ($resource) {
        'auth'          => require __DIR__ . '/routes/auth.php',
        'invite'        => require __DIR__ . '/routes/invite.php',
        'profile'       => require __DIR__ . '/routes/profile.php',
        'groups'        => require __DIR__ . '/routes/groups.php',
        'items'         => require __DIR__ . '/routes/items.php',
        'notifications' => require __DIR__ . '/routes/notifications.php',
        'activity'      => require __DIR__ . '/routes/activity.php',
        'reports'       => require __DIR__ . '/routes/reports.php',
        'admin'         => require __DIR__ . '/routes/admin.php',
        default         => jsonError('Not found', 404),
    };
} catch (PDOException $e) {
    error_log('Database operation failed: ' . $e->getMessage());
    try { logSystemEvent(getDb(), 'database_error', $e->getMessage(), $relativePath); } catch (Throwable $ignored) {}
    jsonError('Database operation failed', 500);
} catch (Throwable $e) {
    error_log('API failure: ' . $e->getMessage());
    try { logSystemEvent(getDb(), 'api_error', $e->getMessage(), $relativePath); } catch (Throwable $ignored) {}
    jsonError('Server operation failed', 500);
}
