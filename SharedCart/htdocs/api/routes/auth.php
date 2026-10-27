<?php
// Auth routes:
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/forgot-password
// POST /api/auth/verify-reset-code
// POST /api/auth/reset-password
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../email_helper.php';

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
    $storedHash = trim($storedHash);
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

const LOGIN_FAILURE_LIMIT = 7;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_BLOCK_MINUTES = 15;


function enforceAuthActionLimit(PDO $dbh, string $action, string $identity, int $maxRequests, int $windowMinutes): void {
    $action = preg_replace('/[^a-z0-9_-]/i', '', $action) ?: 'auth';
    $key = hash('sha256', $action . '|' . $identity);
    $windowMinutes = max(1, min(1440, $windowMinutes));
    $maxRequests = max(1, min(1000, $maxRequests));
    try {
        $sql = 'INSERT INTO auth_request_limits
                    (limit_key, action_name, request_count, window_started_at)
                VALUES (:limit_key, :action_name, 1, UTC_TIMESTAMP())
                ON DUPLICATE KEY UPDATE
                    request_count = IF(window_started_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . $windowMinutes . ' MINUTE), 1, request_count + 1),
                    window_started_at = IF(window_started_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . $windowMinutes . ' MINUTE), UTC_TIMESTAMP(), window_started_at),
                    updated_at = CURRENT_TIMESTAMP';
        $dbh->prepare($sql)->execute([':limit_key' => $key, ':action_name' => $action]);
        $check = $dbh->prepare('SELECT request_count, window_started_at FROM auth_request_limits WHERE limit_key = :limit_key AND action_name = :action_name LIMIT 1');
        $check->execute([':limit_key' => $key, ':action_name' => $action]);
        $row = $check->fetch();
        if ($row && (int)$row['request_count'] > $maxRequests) {
            $started = strtotime((string)$row['window_started_at'] . ' UTC') ?: time();
            $retryAfter = max(1, ($started + $windowMinutes * 60) - time());
            jsonOut(['error' => 'Too many requests', 'retry_after' => $retryAfter], 429);
        }
        if (random_int(1, 50) === 1) {
            $dbh->exec('DELETE FROM auth_request_limits WHERE updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY)');
        }
    } catch (PDOException $e) {
        error_log('Auth action rate limit failed: ' . $e->getMessage());
        // SECURITY_RATE_LIMIT_FAIL_CLOSED: do not process sensitive auth actions
        // when the rate-limit store cannot be verified.
        jsonOut(['error' => 'Authentication protection temporarily unavailable'], 503);
    }
}

function authLoginAttemptKey(string $email): array {
    $ip = clientIpAddress();
    $normalizedEmail = strtolower(trim($email));
    return [
        hash('sha256', $normalizedEmail . '|' . $ip),
        hash('sha256', $normalizedEmail),
        $ip,
    ];
}

function enforceLoginAttemptLimit(PDO $dbh, string $email): void {
    [$key] = authLoginAttemptKey($email);
    try {
        $stmt = $dbh->prepare(
            'SELECT attempts, first_attempt_at, blocked_until
               FROM auth_login_attempts
              WHERE attempt_key = :attempt_key
              LIMIT 1'
        );
        $stmt->execute([':attempt_key' => $key]);
        $row = $stmt->fetch();
        if (!$row) return;

        if (!empty($row['blocked_until']) && strtotime((string)$row['blocked_until'] . ' UTC') > time()) {
            logSecurityEvent($dbh, 'login_rate_limited', 'critical', null, $email, '/api/auth/login', [
                'reason' => 'rate_limit',
                'blocked_until' => (string)$row['blocked_until'],
            ]);
            jsonOut([
                'error' => 'Too many login attempts',
                'retry_after' => max(1, strtotime((string)$row['blocked_until'] . ' UTC') - time()),
            ], 429);
        }

        $windowStarted = strtotime((string)$row['first_attempt_at'] . ' UTC');
        if (false !== $windowStarted && $windowStarted < time() - LOGIN_WINDOW_MINUTES * 60) {
            $dbh->prepare('DELETE FROM auth_login_attempts WHERE attempt_key = :attempt_key')
                ->execute([':attempt_key' => $key]);
        }
    } catch (PDOException $e) {
        error_log('Login rate check failed: ' . $e->getMessage());
        // SECURITY_RATE_LIMIT_FAIL_CLOSED
        jsonOut(['error' => 'Login protection temporarily unavailable'], 503);
    }
}

function recordLoginFailure(PDO $dbh, string $email): void {
    [$key, $emailHash, $ip] = authLoginAttemptKey($email);
    try {
        $stmt = $dbh->prepare(
            'INSERT INTO auth_login_attempts
                (attempt_key, email_hash, ip_address, attempts, first_attempt_at, last_attempt_at, blocked_until)
             VALUES (:attempt_key, :email_hash, :ip, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP(), NULL)
             ON DUPLICATE KEY UPDATE
                blocked_until = IF(
                    first_attempt_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . LOGIN_WINDOW_MINUTES . ' MINUTE),
                    NULL,
                    IF(
                        attempts + 1 >= ' . LOGIN_FAILURE_LIMIT . ',
                        DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . LOGIN_BLOCK_MINUTES . ' MINUTE),
                        blocked_until
                    )
                ),
                attempts = IF(first_attempt_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . LOGIN_WINDOW_MINUTES . ' MINUTE), 1, attempts + 1),
                first_attempt_at = IF(first_attempt_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . LOGIN_WINDOW_MINUTES . ' MINUTE), UTC_TIMESTAMP(), first_attempt_at),
                last_attempt_at = UTC_TIMESTAMP(),
                ip_address = VALUES(ip_address)'
        );
        $stmt->execute([
            ':attempt_key' => $key,
            ':email_hash' => $emailHash,
            ':ip' => '' !== $ip ? $ip : null,
        ]);
        if (random_int(1, 50) === 1) {
            $dbh->exec('DELETE FROM auth_login_attempts WHERE last_attempt_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)');
        }
    } catch (PDOException $e) {
        error_log('Login failure recording failed: ' . $e->getMessage());
        // Keep failed-login protection fail-closed if an invalid attempt cannot
        // be recorded. The authentication attempt is denied with 503.
        jsonOut(['error' => 'Login protection temporarily unavailable'], 503);
    }
}

function clearLoginFailures(PDO $dbh, string $email): void {
    [$key] = authLoginAttemptKey($email);
    try {
        $dbh->prepare('DELETE FROM auth_login_attempts WHERE attempt_key = :attempt_key')
            ->execute([':attempt_key' => $key]);
    } catch (PDOException $e) {
        error_log('Login failure cleanup failed: ' . $e->getMessage());
    }
}

function ensurePasswordResetTable(PDO $dbh): void {
    try {
        $dbh->exec(
            'CREATE TABLE IF NOT EXISTS password_reset_requests (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id INT UNSIGNED NOT NULL,
                email VARCHAR(255) NOT NULL,
                code_hash VARCHAR(255) NOT NULL,
                reset_token_hash CHAR(64) NULL,
                attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
                verified_at DATETIME NULL,
                used TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                PRIMARY KEY (id),
                KEY idx_reset_email (email),
                KEY idx_reset_user (user_id),
                KEY idx_reset_expiry (expires_at),
                KEY idx_reset_used (used),
                CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    } catch (PDOException $e) {
        error_log('Password reset table setup failed: ' . $e->getMessage());
        jsonError('המערכת לשחזור סיסמה אינה זמינה כרגע', 500);
    }
}

function generateResetCode(): string {
    $code = '';
    for ($i = 0; $i < PASSWORD_RESET_CODE_LEN; $i++) {
        $code .= (string)random_int(0, 9);
    }
    return $code;
}

function generateResetToken(): string {
    return bin2hex(random_bytes(32));
}

function sendPasswordResetEmail(string $to, string $username, string $code): bool {
    $appUrl = appBaseUrl();
    $text = trim(
        "שלום $username,\n\n" .
        "קיבלנו בקשה לאיפוס סיסמה עבור החשבון שלך ב-" . APP_NAME . ".\n" .
        "קוד האימות שלך הוא: $code\n\n" .
        "הקוד תקף ל-" . PASSWORD_RESET_TTL_MINUTES . " דקות.\n" .
        "אם לא ביקשת איפוס סיסמה, אפשר להתעלם מהודעה זו."
    );

    $html = '<div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;line-height:1.6;color:#0f172a">'
        . '<p>שלום ' . htmlspecialchars($username, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . ',</p>'
        . '<p>קיבלנו בקשה לאיפוס סיסמה עבור החשבון שלך ב-' . htmlspecialchars(APP_NAME, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '.</p>'
        . '<p><strong>קוד האימות שלך הוא: ' . htmlspecialchars($code, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</strong></p>'
        . '<p>הקוד תקף ל-' . (int)PASSWORD_RESET_TTL_MINUTES . ' דקות.</p>'
        . '<p>אם לא ביקשת איפוס סיסמה, אפשר להתעלם מהודעה זו.</p>'
        . ($appUrl !== '' ? '<p><a href="' . htmlspecialchars($appUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">פתח את האתר</a></p>' : '')
        . '</div>';

    return sendAppEmail($to, 'קוד לאיפוס סיסמה', $text, $html);
}

if ('POST' !== $method) jsonError('הפעולה אינה נתמכת', 405);

$body = json_decode(file_get_contents('php://input'), true) ?? [];

if ('logout' === $sub) {
    clearAuthSessionCookie();
    jsonOut(['message' => 'Signed out']);
}

if ('register' === $sub) {
    $username = trim((string)($body['username'] ?? ''));
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $password = (string)($body['password'] ?? '');
    $passwordConfirmation = (string)($body['password_confirmation'] ?? $body['passwordConfirmation'] ?? '');
    $preferredLanguage = in_array(($body['language'] ?? 'he'), ['he', 'en'], true) ? (string)$body['language'] : 'he';

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
    ensureAdminSchema($dbh);
    enforceAuthActionLimit($dbh, 'register', clientIpAddress() ?: 'unknown', 10, 60);
    assertContentAllowed($dbh, $username, null, 'username', 'user');

    $stmt = $dbh->prepare(
        'SELECT id
           FROM users
          WHERE deleted_at IS NULL
            AND (email = :email OR username = :username OR email = :username_as_email OR username = :email_as_username)
          LIMIT 1'
    );
    $stmt->execute([
        ':email' => $email,
        ':username' => $username,
        ':username_as_email' => $username,
        ':email_as_username' => $email,
    ]);
    if ($stmt->fetch()) jsonError('האימייל או שם המשתמש כבר קיימים', 409);

    try {
        $hash = authHashPassword($password);
        if (false === $hash) jsonError('יצירת החשבון נכשלה', 500);

        $stmt = $dbh->prepare('INSERT INTO users (username, email, password, preferred_language) VALUES (:u, :e, :p, :language)');
        $stmt->execute([':u' => $username, ':e' => $email, ':p' => $hash, ':language' => $preferredLanguage]);
        $userId = (int)$dbh->lastInsertId();
    } catch (PDOException $e) {
        error_log('Registration failed: ' . $e->getMessage());

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
        'ver' => 0,
        'iat' => time(),
        'exp' => time() + JWT_EXPIRY_SECONDS,
    ]);
    setAuthSessionCookie($token);

    jsonOut([
        'message' => 'ההרשמה הושלמה',
        'role' => 'user',
        'language' => $preferredLanguage,
    ], 201);
}

if ('login' === $sub) {
    $identifier = trim((string)($body['identifier'] ?? $body['email'] ?? $body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');

    $missing = [];
    if ('' === $identifier) $missing[] = 'שם משתמש או אימייל';
    if ('' === $password) $missing[] = 'סיסמה';
    if ($missing) jsonError('חסרים הפרטים הבאים: ' . implode(', ', $missing));

    if (authUnicodeLength($identifier) > MAX_EMAIL_LEN || preg_match('/[\x00-\x1F\x7F]/u', $identifier)) {
        jsonError('Invalid login identifier');
    }

    $dbh = getDb();
    ensureAdminSchema($dbh);
    enforceLoginAttemptLimit($dbh, $identifier);
    $stmt = $dbh->prepare(
        'SELECT id, username, email, password, role, blocked_until, blocked_reason, deleted_at, preferred_language, token_version,
                (blocked_until IS NOT NULL AND blocked_until > UTC_TIMESTAMP()) AS is_blocked
           FROM users
          WHERE LOWER(TRIM(email)) = LOWER(TRIM(:identifier_email))
             OR LOWER(TRIM(username)) = LOWER(TRIM(:identifier_username))
          ORDER BY CASE
                     WHEN LOWER(TRIM(email)) = LOWER(TRIM(:priority_email)) THEN 0
                     ELSE 1
                   END
          LIMIT 1'
    );
    $stmt->execute([
        ':identifier_email' => $identifier,
        ':identifier_username' => $identifier,
        ':priority_email' => $identifier,
    ]);
    $user = $stmt->fetch();
    $securityEmail = $user ? strtolower(trim((string)($user['email'] ?? ''))) : (filter_var($identifier, FILTER_VALIDATE_EMAIL) ? strtolower($identifier) : '');

    if ($user) {
        $storedHash = trim((string)$user['password']);
        if (str_starts_with($storedHash, PASSWORD_HASH_PREFIX) && strlen($storedHash) < 64) {
            jsonOut([
                'error' => 'הסיסמה הישנה נפגעה בזמן עדכון מסד הנתונים. יש לאפס את הסיסמה.',
                'code' => 'password_reset_required',
            ], 409);
        }
    }

    if (!$user || !authVerifyPassword($password, (string)$user['password'])) {
        recordLoginFailure($dbh, $identifier);
        logSecurityEvent($dbh, 'login_failed', 'warning', $user ? (int)$user['id'] : null, $securityEmail, '/api/auth/login', [
            'reason' => 'invalid_credentials',
            'account_found' => (bool)$user,
        ]);
        jsonError('Invalid credentials', 401);
    }

    // Upgrade legacy hashes after a successful login. The password column is widened
    // by ensureAdminSchema() before this point, so the prefixed hash is not truncated.
    $storedPasswordHash = trim((string)$user['password']);
    if (!str_starts_with($storedPasswordHash, PASSWORD_HASH_PREFIX)) {
        $upgradedHash = authHashPassword($password);
        if (false !== $upgradedHash) {
            try {
                $dbh->prepare('UPDATE users SET password = :password WHERE id = :id')
                    ->execute([':password' => $upgradedHash, ':id' => (int)$user['id']]);
            } catch (Throwable $e) {
                error_log('Password hash upgrade failed: ' . $e->getMessage());
            }
        }
    }

    clearLoginFailures($dbh, $identifier);
    if (!empty($user['deleted_at'])) {
        logSecurityEvent($dbh, 'login_denied_deleted_account', 'warning', (int)$user['id'], $securityEmail, '/api/auth/login', [
            'reason' => 'deleted_account',
        ]);
        jsonError('Account deleted', 403);
    }
    if ((int)($user['is_blocked'] ?? 0) === 1) {
        logSecurityEvent($dbh, 'login_denied_blocked_account', 'warning', (int)$user['id'], $securityEmail, '/api/auth/login', [
            'reason' => 'blocked_account',
            'blocked_until' => (string)($user['blocked_until'] ?? ''),
        ]);
        jsonOut([
            'error' => 'Account temporarily blocked',
            'blocked_until' => $user['blocked_until'],
            'reason' => $user['blocked_reason'] ?: 'Policy violation',
        ], 403);
    }

    $dbh->prepare('UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = :id')->execute([':id' => (int)$user['id']]);

    $token = jwtEncode([
        'sub' => (int)$user['id'],
        'ver' => (int)($user['token_version'] ?? 0),
        'iat' => time(),
        'exp' => time() + JWT_EXPIRY_SECONDS,
    ]);
    setAuthSessionCookie($token);

    $role = (string)($user['role'] ?? 'user');
    logSecurityEvent($dbh, 'login_success', 'info', (int)$user['id'], $securityEmail, '/api/auth/login', [
        'reason' => 'authenticated',
        'role' => $role,
    ]);
    jsonOut([
        'role' => $role,
        'language' => (string)($user['preferred_language'] ?? 'he'),
        'admin_path' => 'admin' === $role ? ADMIN_CONSOLE_PATH : null,
    ]);
}

if ('forgot-password' === $sub) {
    $email = strtolower(trim((string)($body['email'] ?? '')));
    if ('' === $email) jsonError('חסרים הפרטים הבאים: אימייל');
    if (strlen($email) > MAX_EMAIL_LEN || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('כתובת האימייל אינה תקינה');
    }

    $dbh = getDb();
    ensurePasswordResetTable($dbh);
    enforceAuthActionLimit($dbh, 'forgot_password', strtolower($email) . '|' . (clientIpAddress() ?: 'unknown'), 5, 60);

    $stmt = $dbh->prepare('SELECT id, username, email FROM users WHERE email = :email AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if ($user) {
        $code = generateResetCode();
        $hash = authHashPassword($code);
        if (false === $hash) jsonError('המערכת לשחזור סיסמה אינה זמינה כרגע', 500);

        $stmt = $dbh->prepare('DELETE FROM password_reset_requests WHERE email = :email');
        $stmt->execute([':email' => $email]);

        $expiresAt = gmdate('Y-m-d H:i:s', time() + (PASSWORD_RESET_TTL_MINUTES * 60));
        $stmt = $dbh->prepare(
            'INSERT INTO password_reset_requests (user_id, email, code_hash, expires_at)
             VALUES (:uid, :email, :code_hash, :expires_at)'
        );
        $stmt->bindValue(':uid', (int)$user['id'], PDO::PARAM_INT);
        $stmt->bindValue(':email', $email, PDO::PARAM_STR);
        $stmt->bindValue(':code_hash', $hash, PDO::PARAM_STR);
        $stmt->bindValue(':expires_at', $expiresAt, PDO::PARAM_STR);
        $stmt->execute();

        if (!sendPasswordResetEmail($email, (string)$user['username'], $code)) {
            jsonError('לא ניתן לשלוח את קוד האימות כרגע', 500);
        }
    }

    jsonOut([
        'message' => 'אם הכתובת קיימת, נשלח קוד אימות לאימייל',
    ]);
}

if ('verify-reset-code' === $sub) {
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $code = trim((string)($body['code'] ?? ''));

    if ('' === $email || '' === $code) {
        jsonError('חסרים הפרטים הבאים: אימייל, קוד אימות');
    }
    if (strlen($email) > MAX_EMAIL_LEN || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('כתובת האימייל אינה תקינה');
    }
    if (!preg_match('/^\d{' . PASSWORD_RESET_CODE_LEN . '}$/', $code)) {
        jsonError('קוד האימות אינו תקין');
    }

    $dbh = getDb();
    ensurePasswordResetTable($dbh);
    enforceAuthActionLimit($dbh, 'verify_reset', strtolower($email) . '|' . (clientIpAddress() ?: 'unknown'), 12, 60);

    $stmt = $dbh->prepare(
        'SELECT r.id, r.user_id, r.code_hash, r.attempts, r.expires_at, r.used, u.username
           FROM password_reset_requests r
           JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
          WHERE r.email = :email
          ORDER BY r.created_at DESC
          LIMIT 1'
    );
    $stmt->execute([':email' => $email]);
    $request = $stmt->fetch();

    if (!$request) jsonError('קוד האימות לא נמצא', 404);
    if ((int)$request['used'] === 1) jsonError('קוד האימות כבר נוצל', 410);
    if (strtotime((string)$request['expires_at'] . ' UTC') < time()) jsonError('קוד האימות פג תוקף', 410);
    if ((int)$request['attempts'] >= 5) jsonError('בוצעו יותר מדי ניסיונות', 429);

    if (!authVerifyPassword($code, (string)$request['code_hash'])) {
        $stmt = $dbh->prepare('UPDATE password_reset_requests SET attempts = attempts + 1 WHERE id = :id');
        $stmt->execute([':id' => (int)$request['id']]);
        jsonError('קוד האימות אינו נכון', 401);
    }

    $resetToken = generateResetToken();
    $resetTokenHash = hash('sha256', $resetToken);

    $stmt = $dbh->prepare(
        'UPDATE password_reset_requests
            SET verified_at = UTC_TIMESTAMP(),
                reset_token_hash = :hash
          WHERE id = :id'
    );
    $stmt->execute([':hash' => $resetTokenHash, ':id' => (int)$request['id']]);

    jsonOut([
        'message' => 'הקוד אומת בהצלחה. אפשר להגדיר סיסמה חדשה.',
        'reset_token' => $resetToken,
        'email' => $email,
        'username' => (string)$request['username'],
    ]);
}

if ('reset-password' === $sub) {
    $email = strtolower(trim((string)($body['email'] ?? '')));
    $resetToken = trim((string)($body['reset_token'] ?? ''));
    $password = (string)($body['password'] ?? '');
    $passwordConfirmation = (string)($body['password_confirmation'] ?? $body['passwordConfirmation'] ?? '');

    $missing = [];
    if ('' === $email) $missing[] = 'אימייל';
    if ('' === $resetToken) $missing[] = 'קוד אימות';
    if ('' === $password) $missing[] = 'סיסמה';
    if ('' === $passwordConfirmation) $missing[] = 'אימות סיסמה';
    if ($missing) jsonError('חסרים הפרטים הבאים: ' . implode(', ', $missing));

    if (strlen($email) > MAX_EMAIL_LEN || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonError('כתובת האימייל אינה תקינה');
    }
    if (!preg_match('/^[0-9a-f]{64}$/', $resetToken)) {
        jsonError('קוד האימות אינו תקין');
    }
    if (!hash_equals($password, $passwordConfirmation)) {
        jsonError('הסיסמאות אינן תואמות');
    }

    $passwordLength = authUnicodeLength($password);
    if ($passwordLength < MIN_PASSWORD_LEN) jsonError('הסיסמה חייבת להכיל לפחות 8 תווים');
    if ($passwordLength > MAX_PASSWORD_LEN) jsonError('הסיסמה יכולה להכיל עד 256 תווים');
    if (str_contains($password, "\0")) jsonError('הסיסמה מכילה תו שאינו נתמך');

    $dbh = getDb();
    ensurePasswordResetTable($dbh);

    $stmt = $dbh->prepare(
        'SELECT r.id, r.user_id, r.reset_token_hash, r.used, r.expires_at
           FROM password_reset_requests r
          WHERE r.email = :email
          ORDER BY r.created_at DESC
          LIMIT 1'
    );
    $stmt->execute([':email' => $email]);
    $request = $stmt->fetch();

    if (!$request) jsonError('קוד האימות לא נמצא', 404);
    if ((int)$request['used'] === 1) jsonError('קוד האימות כבר נוצל', 410);
    if (strtotime((string)$request['expires_at'] . ' UTC') < time()) jsonError('קוד האימות פג תוקף', 410);
    if (!hash_equals((string)$request['reset_token_hash'], hash('sha256', $resetToken))) {
        jsonError('קוד האימות אינו תקין', 401);
    }

    try {
        $dbh->beginTransaction();

        $hash = authHashPassword($password);
        if (false === $hash) {
            throw new RuntimeException('Password hashing failed');
        }

        $stmt = $dbh->prepare('UPDATE users SET password = :password, token_version = token_version + 1 WHERE id = :id');
        $stmt->execute([
            ':password' => $hash,
            ':id' => (int)$request['user_id'],
        ]);

        $stmt = $dbh->prepare(
            'UPDATE password_reset_requests
                SET used = 1
              WHERE id = :id'
        );
        $stmt->execute([':id' => (int)$request['id']]);

        $dbh->commit();
    } catch (Throwable $e) {
        if ($dbh->inTransaction()) $dbh->rollBack();
        error_log('Password reset failed: ' . $e->getMessage());
        jsonError('איפוס הסיסמה נכשל', 500);
    }

    jsonOut(['message' => 'הסיסמה עודכנה בהצלחה']);
}

jsonError('הנתיב המבוקש לא נמצא', 404);
