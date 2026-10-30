<?php
declare(strict_types=1);

date_default_timezone_set('UTC');
require_once __DIR__ . '/../../secret/config.php';
require_once __DIR__ . '/api/admin_helper.php';
require_once __DIR__ . '/api/auth_helper.php';

try {
    $dbh = getDb();
    $dbh->exec("SET time_zone = '+00:00'");
    ensureAdminSchema($dbh);

    $userId = null;
    $email = '';
    $role = '';
    $token = trim((string)($_COOKIE[AUTH_COOKIE_NAME] ?? ''));
    if ('' !== $token) {
        $payload = jwtDecode($token);
        if ($payload && !empty($payload['sub'])) {
            $user = userAccessRow($dbh, (int)$payload['sub']);
            if ($user) {
                $userId = (int)$user['id'];
                $email = (string)($user['email'] ?? '');
                $role = (string)($user['role'] ?? 'user');
            }
        }
    }

    logSecurityEvent($dbh, 'admin_path_probe', 'critical', $userId, $email, securityRequestPath(), [
        'reason' => 'guessed_admin_path',
        'authenticated_role' => $role,
    ]);
} catch (Throwable $e) {
    error_log('Admin path probe logging failed: ' . $e->getMessage());
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
echo 'Not found';
