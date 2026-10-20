<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth_helper.php';

$auth = requireAuth();
$uid  = (int)$auth['sub'];
$dbh  = getDb();
ensureAdminSchema($dbh);

const PROFILE_MAX_PASSWORD_LEN = 256;
const PROFILE_PASSWORD_HASH_PREFIX = 'cg1:';

function profilePasswordMaterial(string $password): string {
    return base64_encode(hash('sha384', $password, true));
}

function profileHashPassword(string $password): string|false {
    $hash = password_hash(profilePasswordMaterial($password), PASSWORD_DEFAULT);
    return false === $hash ? false : PROFILE_PASSWORD_HASH_PREFIX . $hash;
}

function profileVerifyPassword(string $password, string $storedHash): bool {
    $storedHash = trim($storedHash);
    try {
        if (str_starts_with($storedHash, PROFILE_PASSWORD_HASH_PREFIX)) {
            return password_verify(
                profilePasswordMaterial($password),
                substr($storedHash, strlen(PROFILE_PASSWORD_HASH_PREFIX))
            );
        }
        return password_verify($password, $storedHash);
    } catch (Throwable $e) {
        error_log('Profile password verification failed: ' . $e->getMessage());
        return false;
    }
}

function profileUnicodeLength(string $value): int {
    $count = preg_match_all('/./us', $value, $matches);
    return false === $count ? strlen($value) : $count;
}

if ('GET' === $method && ('me' === $sub || '' === $sub)) {
    $stmt = $dbh->prepare(
        'SELECT id, username, email, role, preferred_language, blocked_until, blocked_reason, created_at, last_login_at
           FROM users
          WHERE id = :id AND deleted_at IS NULL
          LIMIT 1'
    );
    $stmt->execute([':id' => $uid]);
    $user = $stmt->fetch();
    if (!$user) jsonError('User not found', 404);
    unset($user['blocked_reason']);
    $user['id'] = (int)$user['id'];
    if ('admin' === (string)($user['role'] ?? 'user')) {
        $user['admin_path'] = ADMIN_CONSOLE_PATH;
    }
    jsonOut($user);
}

if ('PATCH' === $method && 'username' === $sub) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $username = trim((string)($body['username'] ?? ''));

    if ('' === $username) jsonError('Username required');
    if (profileUnicodeLength($username) > MAX_USERNAME_LEN) jsonError('Username too long');
    if (preg_match('/[\x00-\x1F\x7F]/u', $username)) jsonError('Username contains unsupported characters');
    assertContentAllowed($dbh, $username, $uid, 'username', 'user', $uid);

    $stmt = $dbh->prepare(
        'SELECT id
           FROM users
          WHERE id <> :uid
            AND deleted_at IS NULL
            AND (username = :username OR email = :username_as_email)
          LIMIT 1'
    );
    $stmt->execute([':username' => $username, ':username_as_email' => $username, ':uid' => $uid]);
    if ($stmt->fetch()) jsonError('Email or username already taken', 409);

    $stmt = $dbh->prepare('UPDATE users SET username = :username WHERE id = :uid');
    $stmt->execute([':username' => $username, ':uid' => $uid]);
    jsonOut(['message' => 'Username updated', 'username' => $username]);
}


if ('PATCH' === $method && 'password' === $sub) {
    jsonError('Email verification required', 403);
}

if ('PATCH' === $method && 'language' === $sub) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $language = (string)($body['language'] ?? '');
    if (!in_array($language, ['he', 'en'], true)) jsonError('Unsupported language');
    $stmt = $dbh->prepare('UPDATE users SET preferred_language = :language WHERE id = :uid');
    $stmt->execute([':language' => $language, ':uid' => $uid]);
    jsonOut(['message' => 'Language updated', 'language' => $language]);
}

jsonError('Method not allowed', 405);
