<?php
// Auth routes: POST /api/auth/register, POST /api/auth/login
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth_helper.php';

const MAX_PASSWORD_LEN = 256;
const MAX_EMAIL_LEN = 254;
const PASSWORD_HASH_PREFIX = 'cg1:';

function authUnicodeLength(string $value): int {
    $count = preg_match_all('/./us', $value, $matches);
    return false === $count ? strlen($value) : $count;
}

function authPasswordMaterial(string $password): string {
    // Pre-hashing avoids bcrypt's 72-byte truncation while keeping password_verify compatibility.
    return base64_encode(hash('sha384', $password, true));
}

function authHashPassword(string $password): string|false {
    $hash = password_hash(authPasswordMaterial($password), PASSWORD_DEFAULT);
    return false === $hash ? false : PASSWORD_HASH_PREFIX . $hash;
}

function authVerifyPassword(string $password, string $storedHash): bool {
    try {
        if (str_starts_with($storedHash, PASSWORD_HASH_PREFIX)) {
            return password_verify(authPasswordMaterial($password), substr($storedHash, strlen(PASSWORD_HASH_PREFIX)));
        }

        // Compatibility with accounts created before password pre-hashing was added.
        return password_verify($password, $storedHash);
    } catch (Throwable $e) {
        error_log('Password verification failed: ' . $e->getMessage());
        return false;
    }
}

if ('POST' !== $method) jsonError('הפעולה אינה נתמכת', 405);

$body = json_decode(file_get_contents('php://input'), true) ?? [];

if ('register' === $sub) {
    $username = trim((string)($body['username'] ?? ''));
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');
    $passwordConfirmation = (string)($body['password_confirmation'] ?? $body['passwordConfirmation'] ?? '');

    $missing = [];
    if ('' === $username) $missing[] = 'שם משתמש';
    if ('' === $email) $missing[] = 'אימייל';
    if ('' === $password) $missing[] = 'סיסמה';
    if ('' === $passwordConfirmation) $missing[] = 'אימות סיסמה';
    if ($missing) jsonError('חסרים הפרטים הבאים: ' . implode(', ', $missing));

    if (!hash_equals($password, $passwordConfirmation)) jsonError('הסיסמאות אינן תואמות');

    $usernameLength = authUnicodeLength($username);
    $passwordLength = authUnicodeLength($password);

    if ($usernameLength > MAX_USERNAME_LEN) jsonError('שם המשתמש יכול להכיל עד 50 תווים');
    if (preg_match('/[\x00-\x1F\x7F]/u', $username)) jsonError('שם המשתמש מכיל תווים שאינם נתמכים');
    if (strlen($email) > MAX_EMAIL_LEN) jsonError('כתובת האימייל ארוכה מדי');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('כתובת האימייל אינה תקינה');
    if ($passwordLength < MIN_PASSWORD_LEN) jsonError('הסיסמה חייבת להכיל לפחות 8 תווים');
    if ($passwordLength > MAX_PASSWORD_LEN) jsonError('הסיסמה יכולה להכיל עד 256 תווים');
    if (str_contains($password, "\0")) jsonError('הסיסמה מכילה תו שאינו נתמך');

    $dbh = getDb();

    $stmt = $dbh->prepare('SELECT id FROM users WHERE email = :email OR username = :username LIMIT 1');
    $stmt->execute([':email' => $email, ':username' => $username]);
    if ($stmt->fetch()) jsonError('האימייל או שם המשתמש כבר קיימים', 409);

    try {
        $hash = authHashPassword($password);
        if (false === $hash) jsonError('יצירת החשבון נכשלה', 500);

        $stmt = $dbh->prepare('INSERT INTO users (username, email, password) VALUES (:u, :e, :p)');
        $stmt->execute([':u' => $username, ':e' => $email, ':p' => $hash]);
        $userId = (int)$dbh->lastInsertId();
    } catch (PDOException $e) {
        error_log('Registration failed: ' . $e->getMessage());

        // A duplicate may be created by two nearly simultaneous requests.
        if ('23000' === (string)$e->getCode()) {
            jsonError('האימייל או שם המשתמש כבר קיימים', 409);
        }
        jsonError('יצירת החשבון נכשלה', 500);
    } catch (Throwable $e) {
        error_log('Password hashing failed: ' . $e->getMessage());
        jsonError('יצירת החשבון נכשלה', 500);
    }

    $token = jwtEncode([
        'sub' => $userId,
        'exp' => time() + JWT_EXPIRY_SECONDS,
    ]);

    jsonOut([
        'message' => 'ההרשמה הושלמה',
        'token' => $token,
    ], 201);
}

if ('login' === $sub) {
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');

    $missing = [];
    if ('' === $email) $missing[] = 'אימייל';
    if ('' === $password) $missing[] = 'סיסמה';
    if ($missing) jsonError('חסרים הפרטים הבאים: ' . implode(', ', $missing));

    if (strlen($email) > MAX_EMAIL_LEN || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('כתובת האימייל אינה תקינה');
    }

    $dbh = getDb();
    $stmt = $dbh->prepare('SELECT id, password FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !authVerifyPassword($password, (string)$user['password'])) {
        jsonError('האימייל או הסיסמה אינם נכונים', 401);
    }

    $token = jwtEncode([
        'sub' => (int)$user['id'],
        'exp' => time() + JWT_EXPIRY_SECONDS,
    ]);

    jsonOut(['token' => $token]);
}

jsonError('הנתיב המבוקש לא נמצא', 404);
