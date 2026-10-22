<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/admin_helper.php';

const AUTH_COOKIE_NAME = 'sharedcart_session';

function jwtEncode(array $payload): string {
    // Encode a payload into a signed JWT token.
    // Input: associative array payload.
    // Output: JWT string.
    $header  = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64UrlEncode(json_encode($payload));
    $sig     = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    return "$header.$payload.$sig";
}

function jwtDecode(string $token): ?array {
    // Decode and verify a JWT token.
    // Input: JWT string.
    // Output: payload array or null if invalid/expired.
    $parts = explode('.', $token);
    if (3 !== count($parts)) return null;

    [$header, $payload, $sig] = $parts;

    $headerData = json_decode(base64UrlDecode($header), true);
    if (!is_array($headerData) || 'HS256' !== ($headerData['alg'] ?? null) || 'JWT' !== ($headerData['typ'] ?? null)) return null;

    $expected = base64UrlEncode(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;

    $data = json_decode(base64UrlDecode($payload), true);
    if (!is_array($data) || !isset($data['sub'], $data['exp']) || !is_numeric($data['sub']) || !is_numeric($data['exp'])) return null;
    if ((int)$data['exp'] < time()) return null;

    return $data;
}

function isHttpsRequest(): bool {
    if (!empty($_SERVER['HTTPS']) && 'off' !== strtolower((string)$_SERVER['HTTPS'])) return true;
    if (443 === (int)($_SERVER['SERVER_PORT'] ?? 0)) return true;
    $forwardedProto = strtolower(trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))[0] ?? ''));
    return 'https' === $forwardedProto;
}

function setAuthSessionCookie(string $token): void {
    setcookie(AUTH_COOKIE_NAME, $token, [
        'expires' => time() + JWT_EXPIRY_SECONDS,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function clearAuthSessionCookie(): void {
    setcookie(AUTH_COOKIE_NAME, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    unset($_COOKIE[AUTH_COOKIE_NAME]);
}

function requestAuthTokens(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ('' === $header && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = $headers['Authorization'] ?? ($headers['authorization'] ?? '');
    }
    $tokens = [];
    if (str_starts_with($header, 'Bearer ')) {
        $bearer = trim(substr($header, 7));
        if ('' !== $bearer) $tokens[] = $bearer;
    }
    $cookie = trim((string)($_COOKIE[AUTH_COOKIE_NAME] ?? ''));
    if ('' !== $cookie && !in_array($cookie, $tokens, true)) $tokens[] = $cookie;
    return $tokens;
}

function requestAuthToken(): string {
    return requestAuthTokens()[0] ?? '';
}

function requireAuth(): array {
    // Validate Authorization header and return decoded JWT payload.
    // Input: none (reads from $_SERVER).
    // Output: payload array; exits with 401 on failure.
    $tokens = requestAuthTokens();
    if (!$tokens) jsonError('Unauthorized', 401);
    $dbh = getDb();
    ensureAdminSchema($dbh);
    foreach ($tokens as $token) {
        $payload = jwtDecode($token);
        if (null === $payload || empty($payload['sub'])) continue;

        $user = userAccessRow($dbh, (int)$payload['sub']);
        if (!$user || !empty($user['deleted_at'])) continue;
        $tokenVersion = (int)($payload['ver'] ?? 0);
        if ($tokenVersion !== (int)($user['token_version'] ?? 0)) continue;
        if ((int)($user['is_blocked'] ?? 0) === 1) {
            jsonOut([
                'error' => 'Account temporarily blocked',
                'blocked_until' => $user['blocked_until'],
                'reason' => $user['blocked_reason'] ?: 'Policy violation',
            ], 403);
        }

        $payload['role'] = (string)($user['role'] ?? 'user');
        $payload['username'] = (string)($user['username'] ?? '');
        $payload['email'] = (string)($user['email'] ?? '');
        $payload['preferred_language'] = (string)($user['preferred_language'] ?? 'he');
        return $payload;
    }

    jsonError('Unauthorized', 401);
}

function requireAdmin(): array {
    $payload = requireAuth();
    if ('admin' !== ($payload['role'] ?? 'user')) {
        try {
            $dbh = getDb();
            ensureAdminSchema($dbh);
            logSecurityEvent($dbh, 'admin_api_access_denied', 'critical', (int)($payload['sub'] ?? 0), (string)($payload['email'] ?? ''), securityRequestPath(), [
                'reason' => 'non_admin_api_request',
                'role' => (string)($payload['role'] ?? 'user'),
            ]);
        } catch (Throwable $e) {
            error_log('Admin API denial logging failed: ' . $e->getMessage());
        }
        jsonError('Admin access required', 403);
    }
    return $payload;
}

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string {
    $data = strtr($data, '-_', '+/');
    $padding = strlen($data) % 4;
    if (0 !== $padding) $data .= str_repeat('=', 4 - $padding);
    return base64_decode($data, true) ?: '';
}
