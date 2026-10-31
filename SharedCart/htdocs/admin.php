<?php
declare(strict_types=1);

require_once __DIR__ . '/../../secret/config.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../admin_helper.php';
require_once __DIR__ . '/../email_helper.php';

$auth = requireAdmin();
$adminUserId = (int)$auth['sub'];
$dbh = getDb();
ensureAdminSchema($dbh);
ensureItemSharingSchema($dbh);
enforceAdminRateLimit($dbh, $adminUserId);

$section = $adminSection ?: 'overview';
$targetId = $adminId;
$action = $adminAction;

function adminEnsurePasswordResetTable(PDO $dbh): void {
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
}

function adminResetCode(): string {
    $code = '';
    for ($i = 0; $i < PASSWORD_RESET_CODE_LEN; $i++) $code .= (string)random_int(0, 9);
    return $code;
}

function adminResetCodeHash(string $code): string|false {
    $material = base64_encode(hash('sha384', $code, true));
    $hash = password_hash($material, PASSWORD_DEFAULT);
    return false === $hash ? false : 'cg1:' . $hash;
}

function adminSendResetEmail(string $email, string $username, string $code, string $language): bool {
    $isEnglish = 'en' === $language;
    $subject = $isEnglish ? 'Password reset code' : 'קוד לאיפוס סיסמה';
    $text = $isEnglish
        ? "Hello $username,\n\nAn administrator initiated a password reset for your " . APP_NAME . " account.\nYour verification code is: $code\n\nThe code is valid for " . PASSWORD_RESET_TTL_MINUTES . " minutes."
        : "שלום $username,\n\nמנהל המערכת התחיל איפוס סיסמה עבור החשבון שלך ב-" . APP_NAME . ".\nקוד האימות שלך הוא: $code\n\nהקוד תקף ל-" . PASSWORD_RESET_TTL_MINUTES . " דקות.";
    $direction = $isEnglish ? 'ltr' : 'rtl';
    $html = '<div style="font-family:Arial,sans-serif;direction:' . $direction . ';text-align:' . ($isEnglish ? 'left' : 'right') . ';line-height:1.6;color:#0f172a">'
        . '<p>' . htmlspecialchars($isEnglish ? "Hello $username," : "שלום $username,", ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p>'
        . '<p>' . htmlspecialchars($isEnglish ? 'An administrator initiated a password reset for your account.' : 'מנהל המערכת התחיל איפוס סיסמה עבור החשבון שלך.', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p>'
        . '<p><strong>' . htmlspecialchars(($isEnglish ? 'Verification code: ' : 'קוד אימות: ') . $code, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</strong></p>'
        . '<p>' . htmlspecialchars(($isEnglish ? 'The code is valid for ' : 'הקוד תקף ל-') . PASSWORD_RESET_TTL_MINUTES . ($isEnglish ? ' minutes.' : ' דקות.'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p>'
        . '</div>';
    return sendAppEmail($email, $subject, $text, $html);
}

function adminBody(): array {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function adminPeriodDays(): int {
    $period = (int)($_GET['period'] ?? 30);
    return 7 === $period ? 7 : 30;
}

function adminPaging(): array {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(10, (int)($_GET['per_page'] ?? 25)));
    return [$page, $perPage, ($page - 1) * $perPage];
}

function adminSearch(): string {
    return trim((string)($_GET['search'] ?? ''));
}

function adminCount(PDO $dbh, string $sql, array $params = []): int {
    $stmt = $dbh->prepare($sql);
    $stmt->execute($params);
    return (int)($stmt->fetchColumn() ?: 0);
}

function adminDirectorySize(string $directory): int {
    if (!is_dir($directory)) return 0;
    $total = 0;
    try {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if ($file->isFile()) $total += $file->getSize();
        }
    } catch (Throwable $e) {
        error_log('Directory size failed: ' . $e->getMessage());
    }
    return $total;
}


function adminUploadDisplayPath(): string {
    return 'uploads/item-images';
}

function adminItemUploadDir(): string {
    $fallback = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'item-images';

    if (!function_exists('itemUploadDir')) return $fallback;

    try {
        $configured = itemUploadDir();
        if (is_string($configured) && '' !== trim($configured)) return $configured;
    } catch (Throwable $e) {
        error_log('Configured upload directory lookup failed: ' . $e->getMessage());
    }

    return $fallback;
}

function adminSafeDiskSpace(string $directory): array {
    // Some shared hosts disable server disk-capacity functions completely.
    // Upload usage is calculated separately, so disk capacity remains unavailable instead of causing an API error.
    return ['free' => null, 'total' => null];
}

function adminSafeCount(PDO $dbh, string $sql, array $params = [], int $fallback = 0): int {
    try {
        return adminCount($dbh, $sql, $params);
    } catch (Throwable $e) {
        error_log('Admin count query failed: ' . $e->getMessage());
        return $fallback;
    }
}

function adminSafeFetchAll(PDO $dbh, string $sql): array {
    try {
        $stmt = $dbh->query($sql);
        return $stmt ? $stmt->fetchAll() : [];
    } catch (Throwable $e) {
        error_log('Admin list query failed: ' . $e->getMessage());
        return [];
    }
}

function adminDirectoryStats(string $directory): array {
    $files = 0;
    $bytes = 0;
    if (!is_dir($directory)) return ['files' => 0, 'bytes' => 0];
    try {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if (!$file->isFile()) continue;
            $files++;
            $bytes += $file->getSize();
        }
    } catch (Throwable $e) {
        error_log('Directory stats failed: ' . $e->getMessage());
    }
    return ['files' => $files, 'bytes' => $bytes];
}

function adminIniEnabled(string $name): bool {
    $value = strtolower(trim((string)ini_get($name)));
    return !in_array($value, ['', '0', 'off', 'false', 'no', 'none'], true);
}

function adminRelativePath(string $path, string $root): string {
    $root = rtrim(str_replace('\\', '/', $root), '/');
    $path = str_replace('\\', '/', $path);
    if (str_starts_with($path, $root . '/')) return substr($path, strlen($root) + 1);
    return basename($path);
}

function adminFindFilesByExtension(string $directory, array $extensions, int $limit = 25): array {
    if (!is_dir($directory)) return [];
    $matches = [];
    $extensions = array_map('strtolower', $extensions);
    try {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if (!$file->isFile()) continue;
            $extension = strtolower((string)$file->getExtension());
            if (!in_array($extension, $extensions, true)) continue;
            $matches[] = adminRelativePath($file->getPathname(), $directory);
            if (count($matches) >= $limit) break;
        }
    } catch (Throwable $e) {
        error_log('File extension scan failed: ' . $e->getMessage());
    }
    return $matches;
}

function adminFindSensitiveWebFiles(string $documentRoot, int $limit = 25): array {
    $matches = [];
    $extensions = ['sql', 'zip', 'tar', 'gz', 'tgz', 'bak', 'backup', 'old', 'log', 'env'];
    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($documentRoot, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        $iterator->setMaxDepth(2);
        foreach ($iterator as $file) {
            if (!$file->isFile()) continue;
            $relative = adminRelativePath($file->getPathname(), $documentRoot);
            if (str_starts_with($relative, 'uploads/')) continue;
            $name = strtolower($file->getFilename());
            $extension = strtolower((string)$file->getExtension());
            $sensitiveName = str_starts_with($name, '.env') || str_contains($name, 'config.php.') || str_ends_with($name, '~');
            if (!$sensitiveName && !in_array($extension, $extensions, true)) continue;
            $matches[] = $relative;
            if (count($matches) >= $limit) break;
        }
    } catch (Throwable $e) {
        error_log('Sensitive file scan failed: ' . $e->getMessage());
    }
    return $matches;
}

function adminSecuritySummary(PDO $dbh): array {
    $summary = [
        'unread_alerts' => 0,
        'critical_alerts' => 0,
        'admin_attempts_24h' => 0,
        'failed_logins_24h' => 0,
        'successful_logins_24h' => 0,
        'blocked_login_keys' => 0,
    ];
    try {
        $row = $dbh->query(
            "SELECT
                COALESCE(SUM(CASE WHEN is_read = 0 AND severity IN ('warning','critical') THEN 1 ELSE 0 END), 0) AS unread_alerts,
                COALESCE(SUM(CASE WHEN is_read = 0 AND severity = 'critical' THEN 1 ELSE 0 END), 0) AS critical_alerts,
                COALESCE(SUM(CASE WHEN event_type IN ('admin_access_denied','admin_path_probe','admin_gate_error','admin_api_access_denied') AND last_seen_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR) THEN occurrence_count ELSE 0 END), 0) AS admin_attempts_24h,
                COALESCE(SUM(CASE WHEN event_type IN ('login_failed','login_rate_limited','login_denied_deleted_account','login_denied_blocked_account') AND last_seen_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR) THEN occurrence_count ELSE 0 END), 0) AS failed_logins_24h,
                COALESCE(SUM(CASE WHEN event_type = 'login_success' AND last_seen_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR) THEN occurrence_count ELSE 0 END), 0) AS successful_logins_24h
             FROM security_events"
        )->fetch();
        if ($row) {
            foreach (array_keys($summary) as $key) {
                if (array_key_exists($key, $row)) $summary[$key] = (int)$row[$key];
            }
        }
        $summary['blocked_login_keys'] = adminCount(
            $dbh,
            'SELECT COUNT(*) FROM auth_login_attempts WHERE blocked_until IS NOT NULL AND blocked_until > UTC_TIMESTAMP()'
        );
    } catch (Throwable $e) {
        error_log('Security summary failed: ' . $e->getMessage());
    }
    return $summary;
}

function adminRecentSecurityEvents(PDO $dbh, int $limit = 30): array {
    try {
        $stmt = $dbh->prepare(
            'SELECT s.id, s.event_type, s.severity, s.user_id, s.email_masked, s.ip_address,
                    s.user_agent, s.request_path, s.details, s.occurrence_count, s.is_read,
                    s.first_seen_at, s.last_seen_at,
                    COALESCE(u.username, s.username_snapshot) AS username
               FROM security_events s
               LEFT JOIN users u ON u.id = s.user_id
              ORDER BY s.last_seen_at DESC
              LIMIT :limit'
        );
        $stmt->bindValue(':limit', max(1, min(100, $limit)), PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    } catch (Throwable $e) {
        error_log('Security events read failed: ' . $e->getMessage());
        return [];
    }
}

function adminAddSecurityCheck(array &$checks, string $key, string $status, string $value = '', array $meta = []): void {
    $checks[] = [
        'key' => $key,
        'status' => in_array($status, ['pass', 'warning', 'critical'], true) ? $status : 'warning',
        'value' => $value,
        'meta' => $meta,
    ];
}

function adminRunSecurityScan(PDO $dbh, string $uploadDir): array {
    $checks = [];
    $documentRoot = dirname(__DIR__, 2);
    $rootHtaccess = $documentRoot . '/.htaccess';
    $uploadHtaccess = dirname($uploadDir) . '/.htaccess';
    $gateFile = $documentRoot . '/' . ltrim(ADMIN_CONSOLE_PATH, '/');

    try {
        $dbVersion = (string)$dbh->query('SELECT VERSION()')->fetchColumn();
        adminAddSecurityCheck($checks, 'database_connection', 'pass', $dbVersion);
    } catch (Throwable $e) {
        adminAddSecurityCheck($checks, 'database_connection', 'critical');
    }

    $requiredTables = ['users', 'groups', 'grocery_items', 'item_comments', 'activity_log', 'security_events', 'auth_login_attempts', 'system_events'];
    $missingTables = array_values(array_filter($requiredTables, static fn(string $table): bool => !adminTableExists($dbh, $table)));
    adminAddSecurityCheck($checks, 'required_tables', $missingTables ? 'critical' : 'pass', '', ['missing' => $missingTables]);

    $activeAdmins = adminSafeCount($dbh, "SELECT COUNT(*) FROM users WHERE role = 'admin' AND deleted_at IS NULL");
    adminAddSecurityCheck($checks, 'active_admins', $activeAdmins > 0 ? 'pass' : 'critical', (string)$activeAdmins);

    $invalidPasswords = adminSafeCount(
        $dbh,
        "SELECT COUNT(*) FROM users
          WHERE deleted_at IS NULL
            AND (password IS NULL OR (password NOT LIKE '$2y$%' AND password NOT LIKE '$2a$%' AND password NOT LIKE '$2b$%' AND password NOT LIKE 'cg1:$2y$%' AND password NOT LIKE 'cg1:$2a$%' AND password NOT LIKE 'cg1:$2b$%'))"
    );
    adminAddSecurityCheck($checks, 'password_hashes', 0 === $invalidPasswords ? 'pass' : 'critical', (string)$invalidPasswords);

    $jwtLength = defined('JWT_SECRET') ? strlen((string)JWT_SECRET) : 0;
    adminAddSecurityCheck($checks, 'jwt_secret', $jwtLength >= 32 ? 'pass' : 'critical', $jwtLength >= 32 ? '32+' : (string)$jwtLength);

    adminAddSecurityCheck($checks, 'php_version', version_compare(PHP_VERSION, '8.1.0', '>=') ? 'pass' : 'warning', PHP_VERSION);
    adminAddSecurityCheck($checks, 'display_errors', adminIniEnabled('display_errors') ? 'warning' : 'pass', (string)ini_get('display_errors'));
    adminAddSecurityCheck($checks, 'allow_url_include', adminIniEnabled('allow_url_include') ? 'critical' : 'pass', (string)ini_get('allow_url_include'));
    adminAddSecurityCheck($checks, 'expose_php', adminIniEnabled('expose_php') ? 'warning' : 'pass', (string)ini_get('expose_php'));

    $uploadExists = is_dir($uploadDir);
    $uploadWritable = $uploadExists ? is_writable($uploadDir) : is_writable(dirname($uploadDir));
    adminAddSecurityCheck($checks, 'upload_directory', $uploadExists && $uploadWritable ? 'pass' : 'critical', adminUploadDisplayPath());

    $uploadProtected = false;
    $uploadProtectionFiles = [];
    foreach ([$uploadDir . '/.htaccess', $uploadHtaccess] as $candidate) {
        if (!is_file($candidate)) continue;
        $rules = (string)file_get_contents($candidate);
        $hasFilesMatch = str_contains($rules, 'FilesMatch');
        $hasDenyRule = str_contains($rules, 'Require all denied')
            || str_contains($rules, 'Deny from all')
            || str_contains($rules, 'RemoveHandler');
        if ($hasFilesMatch && $hasDenyRule) $uploadProtected = true;
        $uploadProtectionFiles[] = adminRelativePath($candidate, $documentRoot);
    }
    adminAddSecurityCheck(
        $checks,
        'upload_execution_protection',
        $uploadProtected ? 'pass' : 'critical',
        $uploadProtected ? 'protected' : 'missing',
        ['files' => $uploadProtectionFiles]
    );

    $suspiciousUploads = adminFindFilesByExtension($uploadDir, ['php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'phar', 'cgi', 'pl', 'py', 'sh']);
    adminAddSecurityCheck($checks, 'suspicious_uploads', $suspiciousUploads ? 'critical' : 'pass', (string)count($suspiciousUploads), ['files' => $suspiciousUploads]);

    $rootRules = is_file($rootHtaccess) ? (string)file_get_contents($rootHtaccess) : '';
    $rootProtected = str_contains($rootRules, 'Options -Indexes') && str_contains($rootRules, 'Content-Security-Policy') && str_contains($rootRules, 'admin-access-monitor.php');
    adminAddSecurityCheck($checks, 'web_server_rules', $rootProtected ? 'pass' : 'warning');

    adminAddSecurityCheck($checks, 'admin_gate', is_file($gateFile) ? 'pass' : 'critical');
    adminAddSecurityCheck($checks, 'admin_probe_monitor', is_file($documentRoot . '/admin-access-monitor.php') ? 'pass' : 'critical');

    $sensitiveFiles = adminFindSensitiveWebFiles($documentRoot);
    adminAddSecurityCheck($checks, 'sensitive_public_files', $sensitiveFiles ? 'warning' : 'pass', (string)count($sensitiveFiles), ['files' => $sensitiveFiles]);

    $security = adminSecuritySummary($dbh);
    adminAddSecurityCheck($checks, 'blocked_login_attempts', $security['blocked_login_keys'] > 0 ? 'warning' : 'pass', (string)$security['blocked_login_keys']);
    adminAddSecurityCheck($checks, 'admin_access_attempts', $security['admin_attempts_24h'] > 0 ? 'warning' : 'pass', (string)$security['admin_attempts_24h']);
    adminAddSecurityCheck($checks, 'failed_logins', $security['failed_logins_24h'] >= 20 ? 'critical' : ($security['failed_logins_24h'] > 0 ? 'warning' : 'pass'), (string)$security['failed_logins_24h']);

    $systemErrors = adminSafeCount($dbh, "SELECT COUNT(*) FROM system_events WHERE event_type IN ('api_error','database_error') AND resolved_at IS NULL AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)");
    adminAddSecurityCheck($checks, 'system_errors', $systemErrors >= 10 ? 'critical' : ($systemErrors > 0 ? 'warning' : 'pass'), (string)$systemErrors);

    $counts = ['pass' => 0, 'warning' => 0, 'critical' => 0];
    foreach ($checks as $check) $counts[$check['status']]++;
    $score = max(0, 100 - ($counts['warning'] * 5) - ($counts['critical'] * 20));
    $overall = $counts['critical'] > 0 ? 'critical' : ($counts['warning'] > 0 ? 'warning' : 'pass');

    return [
        'scanned_at' => gmdate('c'),
        'overall_status' => $overall,
        'score' => $score,
        'summary' => $counts,
        'checks' => $checks,
        'security' => $security,
    ];
}

function preventLastAdminChange(PDO $dbh, int $targetUserId): void {
    $stmt = $dbh->prepare("SELECT role FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1");
    $stmt->execute([':id' => $targetUserId]);
    if ('admin' !== (string)$stmt->fetchColumn()) return;
    $count = adminCount($dbh, "SELECT COUNT(*) FROM users WHERE role = 'admin' AND deleted_at IS NULL");
    if ($count <= 1) jsonError('The last admin cannot be removed', 409);
}

function adminTableExists(PDO $dbh, string $table): bool {
    try {
        $stmt = $dbh->prepare(
            'SELECT 1 FROM information_schema.tables
              WHERE table_schema = DATABASE() AND table_name = :table_name
              LIMIT 1'
        );
        $stmt->execute([':table_name' => $table]);
        return (bool)$stmt->fetchColumn();
    } catch (Throwable $e) {
        error_log('Table existence check failed for ' . $table . ': ' . $e->getMessage());
        return false;
    }
}

function adminIdList(array $ids): string {
    $safe = array_values(array_unique(array_filter(array_map('intval', $ids), static fn(int $id): bool => $id > 0)));
    return $safe ? implode(',', $safe) : '0';
}

function adminFetchIdList(PDO $dbh, string $sql, array $params = []): array {
    $stmt = $dbh->prepare($sql);
    $stmt->execute($params);
    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function adminHardDeleteUser(PDO $dbh, int $targetUserId, int $adminUserId): array {
    $stmt = $dbh->prepare(
        'SELECT id, username, email, role, deleted_at
           FROM users
          WHERE id = :id
          LIMIT 1'
    );
    $stmt->execute([':id' => $targetUserId]);
    $user = $stmt->fetch();
    if (!$user) jsonError('User not found', 404);
    if (empty($user['deleted_at'])) jsonError('User must be soft-deleted before permanent deletion', 409);
    if ($targetUserId === $adminUserId) jsonError('You cannot permanently delete your own account', 409);

    $ownedGroupIds = adminFetchIdList(
        $dbh,
        'SELECT id FROM `groups` WHERE created_by = :user_id',
        [':user_id' => $targetUserId]
    );
    $groupList = adminIdList($ownedGroupIds);

    $itemStmt = $dbh->prepare(
        "SELECT id, image_path
           FROM grocery_items
          WHERE created_by = :user_id OR group_id IN ($groupList)"
    );
    $itemStmt->execute([':user_id' => $targetUserId]);
    $itemRows = $itemStmt->fetchAll();
    $itemIds = array_map(static fn(array $row): int => (int)$row['id'], $itemRows);
    $itemList = adminIdList($itemIds);
    $imagePaths = array_values(array_filter(array_map(
        static fn(array $row): string => trim((string)($row['image_path'] ?? '')),
        $itemRows
    )));

    $commentIds = adminFetchIdList(
        $dbh,
        "SELECT id FROM item_comments WHERE user_id = :user_id OR item_id IN ($itemList)",
        [':user_id' => $targetUserId]
    );
    $commentList = adminIdList($commentIds);

    $dbh->beginTransaction();
    try {
        if (adminTableExists($dbh, 'content_reports')) {
            $dbh->prepare(
                "DELETE FROM content_reports
                  WHERE reporter_id = :user_id
                     OR (target_type = 'user' AND target_id = :target_user_id)
                     OR (target_type = 'item' AND target_id IN ($itemList))
                     OR (target_type = 'comment' AND target_id IN ($commentList))"
            )->execute([':user_id' => $targetUserId, ':target_user_id' => $targetUserId]);
            $dbh->prepare('UPDATE content_reports SET resolved_by = NULL WHERE resolved_by = :user_id')
                ->execute([':user_id' => $targetUserId]);
        }

        if (adminTableExists($dbh, 'notifications')) {
            $dbh->prepare(
                "DELETE FROM notifications
                  WHERE user_id = :user_id OR actor_id = :actor_id OR item_id IN ($itemList)"
            )->execute([':user_id' => $targetUserId, ':actor_id' => $targetUserId]);
        }
        if (adminTableExists($dbh, 'password_reset_requests')) {
            $dbh->prepare('DELETE FROM password_reset_requests WHERE user_id = :user_id OR email = :email')
                ->execute([':user_id' => $targetUserId, ':email' => (string)$user['email']]);
        }
        if (adminTableExists($dbh, 'auth_login_attempts')) {
            $dbh->prepare('DELETE FROM auth_login_attempts WHERE email_hash = :email_hash')
                ->execute([':email_hash' => hash('sha256', strtolower(trim((string)$user['email'])))]);
        }
        if (adminTableExists($dbh, 'admin_rate_limits')) {
            $dbh->prepare('DELETE FROM admin_rate_limits WHERE admin_user_id = :user_id')
                ->execute([':user_id' => $targetUserId]);
        }
        if (adminTableExists($dbh, 'invite_tokens')) {
            $dbh->prepare(
                "DELETE FROM invite_tokens WHERE created_by = :user_id OR group_id IN ($groupList)"
            )->execute([':user_id' => $targetUserId]);
        }
        if (adminTableExists($dbh, 'moderation_events')) {
            $dbh->prepare(
                "DELETE FROM moderation_events
                  WHERE user_id = :user_id
                     OR (entity_type = 'user' AND entity_id = :entity_user_id)
                     OR (entity_type = 'item' AND entity_id IN ($itemList))
                     OR (entity_type = 'comment' AND entity_id IN ($commentList))"
            )->execute([':user_id' => $targetUserId, ':entity_user_id' => $targetUserId]);
        }
        if (adminTableExists($dbh, 'blocked_terms')) {
            $dbh->prepare('UPDATE blocked_terms SET created_by = NULL WHERE created_by = :user_id')
                ->execute([':user_id' => $targetUserId]);
        }

        $dbh->prepare("DELETE FROM item_contributions WHERE user_id = :user_id OR item_id IN ($itemList)")
            ->execute([':user_id' => $targetUserId]);
        $dbh->prepare("DELETE FROM item_comments WHERE user_id = :user_id OR item_id IN ($itemList)")
            ->execute([':user_id' => $targetUserId]);
        $dbh->prepare(
            "DELETE FROM activity_log
              WHERE user_id = :user_id OR item_id IN ($itemList) OR group_id IN ($groupList)"
        )->execute([':user_id' => $targetUserId]);
        $dbh->exec("DELETE FROM grocery_items WHERE id IN ($itemList)");
        $dbh->prepare("DELETE FROM group_members WHERE user_id = :user_id OR group_id IN ($groupList)")
            ->execute([':user_id' => $targetUserId]);
        $dbh->exec("DELETE FROM `groups` WHERE id IN ($groupList)");

        $dbh->prepare('UPDATE users SET blocked_by = NULL WHERE blocked_by = :user_id')
            ->execute([':user_id' => $targetUserId]);
        $dbh->prepare('UPDATE users SET deleted_by = NULL WHERE deleted_by = :user_id')
            ->execute([':user_id' => $targetUserId]);
        $dbh->prepare('UPDATE `groups` SET deleted_by = NULL WHERE deleted_by = :user_id')
            ->execute([':user_id' => $targetUserId]);
        $dbh->prepare('UPDATE grocery_items SET completed_by = NULL WHERE completed_by = :user_id')
            ->execute([':user_id' => $targetUserId]);
        $dbh->prepare('UPDATE grocery_items SET deleted_by = NULL WHERE deleted_by = :user_id')
            ->execute([':user_id' => $targetUserId]);
        $dbh->prepare('UPDATE item_comments SET deleted_by = NULL WHERE deleted_by = :user_id')
            ->execute([':user_id' => $targetUserId]);

        // Handle any additional foreign keys added by the hosting database or future migrations.
        $fkStmt = $dbh->query(
            "SELECT k.TABLE_NAME, k.COLUMN_NAME, c.IS_NULLABLE
               FROM information_schema.KEY_COLUMN_USAGE k
               JOIN information_schema.COLUMNS c
                 ON c.TABLE_SCHEMA = k.TABLE_SCHEMA
                AND c.TABLE_NAME = k.TABLE_NAME
                AND c.COLUMN_NAME = k.COLUMN_NAME
              WHERE k.TABLE_SCHEMA = DATABASE()
                AND k.REFERENCED_TABLE_SCHEMA = DATABASE()
                AND k.REFERENCED_TABLE_NAME = 'users'
                AND k.REFERENCED_COLUMN_NAME = 'id'"
        );
        foreach ($fkStmt->fetchAll() as $foreignKey) {
            $table = (string)$foreignKey['TABLE_NAME'];
            $column = (string)$foreignKey['COLUMN_NAME'];
            if ('users' === $table || !preg_match('/^[A-Za-z0-9_]+$/', $table) || !preg_match('/^[A-Za-z0-9_]+$/', $column)) continue;
            if ('YES' === (string)$foreignKey['IS_NULLABLE']) {
                $sql = "UPDATE `$table` SET `$column` = NULL WHERE `$column` = :user_id";
            } else {
                $sql = "DELETE FROM `$table` WHERE `$column` = :user_id";
            }
            $dbh->prepare($sql)->execute([':user_id' => $targetUserId]);
        }

        $deleteUser = $dbh->prepare('DELETE FROM users WHERE id = :id AND deleted_at IS NOT NULL');
        $deleteUser->execute([':id' => $targetUserId]);
        if (1 !== $deleteUser->rowCount()) throw new RuntimeException('Permanent user deletion did not complete');
        $dbh->commit();
    } catch (Throwable $e) {
        if ($dbh->inTransaction()) $dbh->rollBack();
        throw $e;
    }

    foreach ($imagePaths as $imagePath) deleteUploadedItemImage($imagePath);

    return [
        'username' => (string)$user['username'],
        'groups_deleted' => count($ownedGroupIds),
        'items_deleted' => count($itemIds),
        'comments_deleted' => count($commentIds),
    ];
}

if ('me' === $section && 'GET' === $method) {
    jsonOut([
        'id' => $adminUserId,
        'username' => (string)$auth['username'],
        'email' => (string)$auth['email'],
        'role' => 'admin',
        'language' => (string)($auth['preferred_language'] ?? 'he'),
        'security_alerts' => adminSecuritySummary($dbh)['unread_alerts'],
    ]);
}

if ('overview' === $section && 'GET' === $method) {
    $days = adminPeriodDays();
    $since = gmdate('Y-m-d H:i:s', time() - $days * 86400);

    $stats = [
        'users' => adminCount($dbh, 'SELECT COUNT(*) FROM users WHERE deleted_at IS NULL'),
        'active_users' => adminCount($dbh, 'SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND last_login_at >= :since', [':since' => $since]),
        'groups' => adminCount($dbh, 'SELECT COUNT(*) FROM `groups` WHERE deleted_at IS NULL'),
        'active_items' => adminCount($dbh, 'SELECT COUNT(*) FROM grocery_items WHERE deleted_at IS NULL'),
        'actions' => adminCount($dbh, 'SELECT COUNT(*) FROM activity_log WHERE created_at >= :since', [':since' => $since]),
        'blocked_users' => adminCount($dbh, 'SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND blocked_until > UTC_TIMESTAMP()'),
        'moderation_events' => adminCount($dbh, 'SELECT COUNT(*) FROM moderation_events WHERE created_at >= :since', [':since' => $since]),
        'open_reports' => adminCount($dbh, "SELECT COUNT(*) FROM content_reports WHERE status = 'open'"),
        'system_errors' => adminCount($dbh, "SELECT COUNT(*) FROM system_events WHERE event_type IN ('api_error','database_error') AND resolved_at IS NULL AND created_at >= :since", [':since' => $since]),
    ];

    $popularStmt = $dbh->prepare(
        "SELECT MAX(item_name) AS name,
                SUM(CASE WHEN action = 'completed' THEN COALESCE(quantity, 1) ELSE 0 END) AS consumed,
                COUNT(*) AS activity_count
           FROM activity_log
          WHERE created_at >= :since
            AND TRIM(item_name) <> ''
            AND item_name <> 'פריט ללא שם'
          GROUP BY LOWER(TRIM(item_name))
          ORDER BY SUM(CASE WHEN action = 'completed' THEN COALESCE(quantity, 1) ELSE 0 END) DESC, COUNT(*) DESC
          LIMIT 8"
    );
    $popularStmt->execute([':since' => $since]);

    $dailyStmt = $dbh->prepare(
        'SELECT DATE(created_at) AS day, COUNT(*) AS count
           FROM activity_log
          WHERE created_at >= :since
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) ASC'
    );
    $dailyStmt->execute([':since' => $since]);

    $consumerStmt = $dbh->prepare(
        "SELECT u.id, u.username, COUNT(*) AS count
           FROM activity_log a
           JOIN users u ON u.id = a.user_id AND u.deleted_at IS NULL
          WHERE a.created_at >= :since AND a.action = 'completed'
          GROUP BY u.id, u.username
          ORDER BY COUNT(*) DESC
          LIMIT 8"
    );
    $consumerStmt->execute([':since' => $since]);

    $writerStmt = $dbh->prepare(
        "SELECT u.id, u.username,
                COALESCE(items.items_count, 0) AS items_count,
                COALESCE(comments.comments_count, 0) AS comments_count,
                COALESCE(items.items_count, 0) + COALESCE(comments.comments_count, 0) AS total_count
           FROM users u
           LEFT JOIN (
                SELECT user_id, COUNT(*) AS items_count
                  FROM activity_log
                 WHERE action = 'added' AND created_at >= :since_items
                 GROUP BY user_id
           ) items ON items.user_id = u.id
           LEFT JOIN (
                SELECT user_id, COUNT(*) AS comments_count
                  FROM item_comments
                 WHERE deleted_at IS NULL AND created_at >= :since_comments
                 GROUP BY user_id
           ) comments ON comments.user_id = u.id
          WHERE u.deleted_at IS NULL
            AND (COALESCE(items.items_count, 0) + COALESCE(comments.comments_count, 0)) > 0
          ORDER BY (COALESCE(items.items_count, 0) + COALESCE(comments.comments_count, 0)) DESC
          LIMIT 8"
    );
    $writerStmt->execute([':since_items' => $since, ':since_comments' => $since]);

    $groupsStmt = $dbh->prepare(
        "SELECT g.id, g.name,
                COUNT(DISTINCT gm.user_id) AS members,
                COUNT(DISTINCT CASE WHEN i.deleted_at IS NULL THEN i.id END) AS items,
                COUNT(DISTINCT a.id) AS actions
           FROM `groups` g
           LEFT JOIN group_members gm ON gm.group_id = g.id
           LEFT JOIN grocery_items i ON i.group_id = g.id
           LEFT JOIN activity_log a ON a.group_id = g.id AND a.created_at >= :since
          WHERE g.deleted_at IS NULL
          GROUP BY g.id, g.name
          ORDER BY COUNT(DISTINCT a.id) DESC, COUNT(DISTINCT gm.user_id) DESC
          LIMIT 8"
    );
    $groupsStmt->execute([':since' => $since]);

    $anomalyStmt = $dbh->prepare(
        "SELECT u.id, u.username, DATE(a.created_at) AS day, COUNT(*) AS actions
           FROM activity_log a
           JOIN users u ON u.id = a.user_id AND u.deleted_at IS NULL
          WHERE a.created_at >= :since
          GROUP BY u.id, u.username, DATE(a.created_at)
         HAVING COUNT(*) >= 50
          ORDER BY COUNT(*) DESC
          LIMIT 10"
    );
    $anomalyStmt->execute([':since' => $since]);

    $uploadDir = adminItemUploadDir();
    jsonOut([
        'period' => $days,
        'stats' => $stats,
        'popular_items' => $popularStmt->fetchAll(),
        'daily_activity' => $dailyStmt->fetchAll(),
        'top_consumers' => $consumerStmt->fetchAll(),
        'top_writers' => $writerStmt->fetchAll(),
        'top_groups' => $groupsStmt->fetchAll(),
        'anomalies' => $anomalyStmt->fetchAll(),
        'health' => [
            'database' => 'ok',
            'server_time' => gmdate('c'),
            'uploads_writable' => is_dir($uploadDir) ? is_writable($uploadDir) : is_writable(dirname($uploadDir)),
            'uploads_bytes' => adminDirectorySize($uploadDir),
            'system_errors' => $stats['system_errors'],
            'php_version' => PHP_VERSION,
        ],
    ]);
}

if ('users' === $section) {
    if ('GET' === $method && null === $targetId) {
        [$page, $perPage, $offset] = adminPaging();
        $search = adminSearch();
        $status = (string)($_GET['status'] ?? 'all');
        $where = ['1=1'];
        $params = [];
        if ('' !== $search) {
            $where[] = '(u.username LIKE :search OR u.email LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }
        if ('active' === $status) $where[] = 'u.deleted_at IS NULL AND (u.blocked_until IS NULL OR u.blocked_until <= UTC_TIMESTAMP())';
        elseif ('blocked' === $status) $where[] = 'u.deleted_at IS NULL AND u.blocked_until > UTC_TIMESTAMP()';
        elseif ('deleted' === $status) $where[] = 'u.deleted_at IS NOT NULL';
        elseif ('admins' === $status) $where[] = "u.role = 'admin' AND u.deleted_at IS NULL";

        $whereSql = implode(' AND ', $where);
        $countStmt = $dbh->prepare('SELECT COUNT(*) FROM users u WHERE ' . $whereSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $sql = "SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login_at,
                       u.blocked_until, u.blocked_reason, u.deleted_at, u.preferred_language, u.violation_count,
                       (SELECT COUNT(*) FROM group_members gm WHERE gm.user_id = u.id) AS groups_count,
                       (SELECT COUNT(*) FROM activity_log a WHERE a.user_id = u.id AND a.action = 'added') AS items_added,
                       (SELECT COUNT(*) FROM activity_log a WHERE a.user_id = u.id AND a.action = 'completed') AS items_completed,
                       (SELECT COUNT(*) FROM item_comments c WHERE c.user_id = u.id AND c.deleted_at IS NULL) AS comments_count
                  FROM users u
                 WHERE $whereSql
                 ORDER BY u.created_at DESC
                 LIMIT :limit OFFSET :offset";
        $stmt = $dbh->prepare($sql);
        foreach ($params as $key => $value) $stmt->bindValue($key, $value, PDO::PARAM_STR);
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        jsonOut(['items' => $stmt->fetchAll(), 'page' => $page, 'per_page' => $perPage, 'total' => $total]);
    }

    if (null === $targetId) jsonError('User id required');
    $body = adminBody();

    if ('PATCH' === $method && 'block' === $action) {
        if ($targetId === $adminUserId) jsonError('You cannot block your own account', 409);
        $hours = min(8760, max(1, (int)($body['hours'] ?? 24)));
        $reason = trim((string)($body['reason'] ?? ''));
        if ('' === $reason) jsonError('Block reason required');
        $blockedUntil = gmdate('Y-m-d H:i:s', time() + ($hours * 3600));
        $stmt = $dbh->prepare(
            'UPDATE users SET blocked_until = :blocked_until, blocked_reason = :reason, blocked_by = :admin
              WHERE id = :id AND deleted_at IS NULL'
        );
        $stmt->execute([
            ':blocked_until' => $blockedUntil,
            ':reason' => $reason,
            ':admin' => $adminUserId,
            ':id' => $targetId,
        ]);
        adminAudit($dbh, $adminUserId, 'user_blocked', 'user', $targetId, ['hours' => $hours, 'reason' => $reason]);
        jsonOut(['message' => 'User blocked']);
    }

    if ('PATCH' === $method && 'unblock' === $action) {
        $dbh->prepare('UPDATE users SET blocked_until = NULL, blocked_reason = NULL, blocked_by = NULL WHERE id = :id')->execute([':id' => $targetId]);
        adminAudit($dbh, $adminUserId, 'user_unblocked', 'user', $targetId);
        jsonOut(['message' => 'User unblocked']);
    }

    if ('DELETE' === $method && '' === $action) {
        if ($targetId === $adminUserId) jsonError('You cannot delete your own account', 409);
        preventLastAdminChange($dbh, $targetId);
        $dbh->prepare('UPDATE users SET deleted_at = UTC_TIMESTAMP(), deleted_by = :admin WHERE id = :id AND deleted_at IS NULL')
            ->execute([':admin' => $adminUserId, ':id' => $targetId]);
        adminAudit($dbh, $adminUserId, 'user_deleted', 'user', $targetId);
        jsonOut(['message' => 'User deleted']);
    }

    if ('PATCH' === $method && 'restore' === $action) {
        $dbh->prepare('UPDATE users SET deleted_at = NULL, deleted_by = NULL WHERE id = :id')->execute([':id' => $targetId]);
        adminAudit($dbh, $adminUserId, 'user_restored', 'user', $targetId);
        jsonOut(['message' => 'User restored']);
    }

    if ('DELETE' === $method && 'purge' === $action) {
        $result = adminHardDeleteUser($dbh, $targetId, $adminUserId);
        adminAudit($dbh, $adminUserId, 'user_permanently_deleted', 'user', $targetId, $result);
        jsonOut(['message' => 'User permanently deleted', 'result' => $result]);
    }

    if ('PATCH' === $method && 'role' === $action) {
        $role = (string)($body['role'] ?? 'user');
        if (!in_array($role, ['user', 'admin'], true)) jsonError('Invalid role');
        if ('user' === $role) preventLastAdminChange($dbh, $targetId);
        $dbh->prepare('UPDATE users SET role = :role WHERE id = :id')->execute([':role' => $role, ':id' => $targetId]);
        adminAudit($dbh, $adminUserId, 'user_role_changed', 'user', $targetId, ['role' => $role]);
        jsonOut(['message' => 'Role updated', 'role' => $role]);
    }

    if ('PATCH' === $method && 'username' === $action) {
        $username = trim((string)($body['username'] ?? ''));
        if ('' === $username) jsonError('Username required');
        $length = function_exists('mb_strlen') ? mb_strlen($username, 'UTF-8') : strlen($username);
        if ($length > MAX_USERNAME_LEN) jsonError('Username too long');
        if (preg_match('/[\x00-\x1F\x7F]/u', $username)) jsonError('Username contains unsupported characters');
        assertContentAllowed($dbh, $username, null, 'admin_username_change', 'user', $targetId);
        $check = $dbh->prepare(
            'SELECT 1
               FROM users
              WHERE id <> :id
                AND deleted_at IS NULL
                AND (username = :username OR email = :username_as_email)
              LIMIT 1'
        );
        $check->execute([':username' => $username, ':username_as_email' => $username, ':id' => $targetId]);
        if ($check->fetchColumn()) jsonError('Email or username already taken', 409);
        $dbh->prepare('UPDATE users SET username = :username WHERE id = :id')->execute([':username' => $username, ':id' => $targetId]);
        adminAudit($dbh, $adminUserId, 'username_changed', 'user', $targetId, ['username' => $username]);
        jsonOut(['message' => 'Username updated', 'username' => $username]);
    }

    if ('POST' === $method && 'password-reset' === $action) {
        $stmt = $dbh->prepare('SELECT id, username, email, preferred_language FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1');
        $stmt->execute([':id' => $targetId]);
        $user = $stmt->fetch();
        if (!$user) jsonError('User not found', 404);
        adminEnsurePasswordResetTable($dbh);
        $code = adminResetCode();
        $hash = adminResetCodeHash($code);
        if (false === $hash) jsonError('Password reset unavailable', 500);
        $expiresAt = gmdate('Y-m-d H:i:s', time() + PASSWORD_RESET_TTL_MINUTES * 60);
        $dbh->beginTransaction();
        $dbh->prepare('DELETE FROM password_reset_requests WHERE email = :email')->execute([':email' => (string)$user['email']]);
        $insert = $dbh->prepare(
            'INSERT INTO password_reset_requests (user_id, email, code_hash, expires_at)
             VALUES (:user_id, :email, :code_hash, :expires_at)'
        );
        $insert->execute([
            ':user_id' => (int)$user['id'],
            ':email' => (string)$user['email'],
            ':code_hash' => $hash,
            ':expires_at' => $expiresAt,
        ]);
        $dbh->commit();
        if (!adminSendResetEmail((string)$user['email'], (string)$user['username'], $code, (string)($user['preferred_language'] ?? 'he'))) {
            jsonError('Password reset email failed', 500);
        }
        adminAudit($dbh, $adminUserId, 'password_reset_requested', 'user', $targetId);
        jsonOut(['message' => 'Password reset email sent']);
    }

    jsonError('Method not allowed', 405);
}

if ('groups' === $section) {
    $days = adminPeriodDays();
    $since = gmdate('Y-m-d H:i:s', time() - $days * 86400);

    if ('GET' === $method && null === $targetId) {
        [$page, $perPage, $offset] = adminPaging();
        $search = adminSearch();
        $status = (string)($_GET['status'] ?? 'active');
        if (!in_array($status, ['active', 'deleted', 'all'], true)) $status = 'active';
        $where = match ($status) {
            'deleted' => 'g.deleted_at IS NOT NULL',
            'all' => '1=1',
            default => 'g.deleted_at IS NULL',
        };
        $params = [':since' => $since];
        if ('' !== $search) {
            $where .= ' AND (g.name LIKE :search OR owner.username LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }

        $countSql = "SELECT COUNT(*) FROM `groups` g JOIN users owner ON owner.id = g.created_by WHERE $where";
        $countStmt = $dbh->prepare($countSql);
        $countStmt->execute(array_filter($params, fn($k) => ':since' !== $k, ARRAY_FILTER_USE_KEY));
        $total = (int)$countStmt->fetchColumn();

        $sql = "SELECT g.id, g.name, g.created_at, g.deleted_at,
                       owner.id AS owner_id, owner.username AS owner_name,
                       COALESCE(member_stats.members_count, 0) AS members_count,
                       COALESCE(item_stats.active_items, 0) AS active_items,
                       COALESCE(activity_stats.period_actions, 0) AS period_actions,
                       activity_stats.last_activity
                  FROM `groups` g
                  JOIN users owner ON owner.id = g.created_by
                  LEFT JOIN (
                       SELECT group_id, COUNT(*) AS members_count
                         FROM group_members
                        GROUP BY group_id
                  ) member_stats ON member_stats.group_id = g.id
                  LEFT JOIN (
                       SELECT group_id, COUNT(*) AS active_items
                         FROM grocery_items
                        WHERE deleted_at IS NULL
                        GROUP BY group_id
                  ) item_stats ON item_stats.group_id = g.id
                  LEFT JOIN (
                       SELECT group_id, COUNT(*) AS period_actions, MAX(created_at) AS last_activity
                         FROM activity_log
                        WHERE created_at >= :since
                        GROUP BY group_id
                  ) activity_stats ON activity_stats.group_id = g.id
                 WHERE $where
                 ORDER BY COALESCE(activity_stats.last_activity, g.created_at) DESC
                 LIMIT :limit OFFSET :offset";
        $stmt = $dbh->prepare($sql);
        foreach ($params as $key => $value) $stmt->bindValue($key, $value, PDO::PARAM_STR);
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        jsonOut(['items' => $stmt->fetchAll(), 'page' => $page, 'per_page' => $perPage, 'total' => $total, 'period' => $days]);
    }

    if (null === $targetId) jsonError('Group id required');

    if ('GET' === $method && ('stats' === $action || '' === $action)) {
        $groupStmt = $dbh->prepare(
            'SELECT g.id, g.name, g.created_at, g.deleted_at, u.id AS owner_id, u.username AS owner_name
               FROM `groups` g JOIN users u ON u.id = g.created_by
              WHERE g.id = :id LIMIT 1'
        );
        $groupStmt->execute([':id' => $targetId]);
        $group = $groupStmt->fetch();
        if (!$group) jsonError('Group not found', 404);

        $consumer = $dbh->prepare(
            "SELECT u.id, u.username, COUNT(*) AS count
               FROM activity_log a JOIN users u ON u.id = a.user_id
              WHERE a.group_id = :group_id AND a.created_at >= :since AND a.action = 'completed'
              GROUP BY u.id, u.username ORDER BY COUNT(*) DESC LIMIT 10"
        );
        $consumer->execute([':group_id' => $targetId, ':since' => $since]);

        // Derived tables avoid MariaDB/MySQL alias and aggregate-reference errors in HAVING/ORDER BY.
        $writers = $dbh->prepare(
            "SELECT u.id, u.username,
                    COALESCE(item_counts.items_count, 0) AS items_count,
                    COALESCE(comment_counts.comments_count, 0) AS comments_count,
                    COALESCE(item_counts.items_count, 0) + COALESCE(comment_counts.comments_count, 0) AS total_count
               FROM users u
               LEFT JOIN (
                    SELECT user_id, COUNT(*) AS items_count
                      FROM activity_log
                     WHERE group_id = :items_group
                       AND created_at >= :items_since
                       AND action = 'added'
                     GROUP BY user_id
               ) item_counts ON item_counts.user_id = u.id
               LEFT JOIN (
                    SELECT c.user_id, COUNT(*) AS comments_count
                      FROM item_comments c
                      JOIN grocery_items gi ON gi.id = c.item_id
                     WHERE gi.group_id = :comments_group
                       AND c.deleted_at IS NULL
                       AND c.created_at >= :comments_since
                     GROUP BY c.user_id
               ) comment_counts ON comment_counts.user_id = u.id
              WHERE u.deleted_at IS NULL
                AND (COALESCE(item_counts.items_count, 0) + COALESCE(comment_counts.comments_count, 0)) > 0
              ORDER BY (COALESCE(item_counts.items_count, 0) + COALESCE(comment_counts.comments_count, 0)) DESC, u.username ASC
              LIMIT 10"
        );
        $writers->execute([
            ':items_group' => $targetId,
            ':items_since' => $since,
            ':comments_group' => $targetId,
            ':comments_since' => $since,
        ]);

        $popular = $dbh->prepare(
            "SELECT MAX(item_name) AS name, COUNT(*) AS count
               FROM activity_log
              WHERE group_id = :group_id AND created_at >= :since AND action = 'completed' AND item_name <> 'פריט ללא שם'
              GROUP BY LOWER(TRIM(item_name)) ORDER BY COUNT(*) DESC LIMIT 10"
        );
        $popular->execute([':group_id' => $targetId, ':since' => $since]);

        $members = $dbh->prepare(
            'SELECT u.id, u.username, u.email, gm.joined_at,
                    (u.id = g.created_by) AS is_creator
               FROM group_members gm
               JOIN users u ON u.id = gm.user_id
               JOIN `groups` g ON g.id = gm.group_id
              WHERE gm.group_id = :id
              ORDER BY is_creator DESC, gm.joined_at ASC'
        );
        $members->execute([':id' => $targetId]);

        $recentActivity = $dbh->prepare(
            "SELECT a.action, a.item_name, COALESCE(a.quantity, 1) AS quantity, a.created_at,
                    COALESCE(u.username, 'Deleted user') AS username
               FROM activity_log a
               LEFT JOIN users u ON u.id = a.user_id
              WHERE a.group_id = :group_id
                AND a.created_at >= :since
              ORDER BY a.created_at DESC
              LIMIT 50"
        );
        $recentActivity->execute([':group_id' => $targetId, ':since' => $since]);

        jsonOut([
            'group' => $group,
            'period' => $days,
            'top_consumers' => $consumer->fetchAll(),
            'top_writers' => $writers->fetchAll(),
            'popular_items' => $popular->fetchAll(),
            'members' => $members->fetchAll(),
            'recent_activity' => $recentActivity->fetchAll(),
        ]);
    }

    if ('DELETE' === $method && '' === $action) {
        $dbh->prepare('UPDATE `groups` SET deleted_at = UTC_TIMESTAMP(), deleted_by = :admin WHERE id = :id AND deleted_at IS NULL')
            ->execute([':admin' => $adminUserId, ':id' => $targetId]);
        adminAudit($dbh, $adminUserId, 'group_deleted', 'group', $targetId);
        jsonOut(['message' => 'Group deleted']);
    }

    if ('PATCH' === $method && 'restore' === $action) {
        $dbh->prepare('UPDATE `groups` SET deleted_at = NULL, deleted_by = NULL WHERE id = :id')->execute([':id' => $targetId]);
        adminAudit($dbh, $adminUserId, 'group_restored', 'group', $targetId);
        jsonOut(['message' => 'Group restored']);
    }

    jsonError('Method not allowed', 405);
}

if ('content' === $section) {
    $kind = (string)($_GET['kind'] ?? 'items');
    [$page, $perPage, $offset] = adminPaging();
    $search = adminSearch();

    if ('GET' === $method && null === $targetId) {
        if ('comments' === $kind) {
            $status = (string)($_GET['status'] ?? 'all');
            if (!in_array($status, ['active', 'deleted', 'all'], true)) $status = 'all';
            $where = match ($status) {
                'active' => 'c.deleted_at IS NULL',
                'deleted' => 'c.deleted_at IS NOT NULL',
                default => '1=1',
            };
            $params = [];
            if ('' !== $search) {
                $where .= ' AND (c.body LIKE :search OR u.username LIKE :search OR g.name LIKE :search)';
                $params[':search'] = '%' . $search . '%';
            }
            $countStmt = $dbh->prepare(
                "SELECT COUNT(*) FROM item_comments c
                   JOIN users u ON u.id = c.user_id
                   JOIN grocery_items i ON i.id = c.item_id
                   JOIN `groups` g ON g.id = i.group_id
                  WHERE $where"
            );
            $countStmt->execute($params);
            $total = (int)($countStmt->fetchColumn() ?: 0);
            $stmt = $dbh->prepare(
                "SELECT c.id, c.body, c.created_at, c.deleted_at, u.username, u.id AS user_id,
                        i.id AS item_id, i.name AS item_name, g.id AS group_id, g.name AS group_name
                   FROM item_comments c
                   JOIN users u ON u.id = c.user_id
                   JOIN grocery_items i ON i.id = c.item_id
                   JOIN `groups` g ON g.id = i.group_id
                  WHERE $where
                  ORDER BY c.created_at DESC LIMIT :limit OFFSET :offset"
            );
            foreach ($params as $key => $value) $stmt->bindValue($key, $value, PDO::PARAM_STR);
            $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            jsonOut(['kind' => 'comments', 'items' => $stmt->fetchAll(), 'page' => $page, 'per_page' => $perPage, 'total' => $total, 'status' => $status]);
        }

        $status = (string)($_GET['status'] ?? 'all');
        if (!in_array($status, ['active', 'deleted', 'all'], true)) $status = 'all';
        $where = match ($status) {
            'active' => 'i.deleted_at IS NULL',
            'deleted' => 'i.deleted_at IS NOT NULL',
            default => '1=1',
        };
        $params = [];
        if ('' !== $search) {
            $where .= ' AND (i.name LIKE :search OR u.username LIKE :search OR g.name LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }
        $countStmt = $dbh->prepare(
            "SELECT COUNT(*) FROM grocery_items i
               JOIN users u ON u.id = i.created_by
               JOIN `groups` g ON g.id = i.group_id
              WHERE $where"
        );
        $countStmt->execute($params);
        $total = (int)($countStmt->fetchColumn() ?: 0);
        $stmt = $dbh->prepare(
            "SELECT i.id, i.name, i.image_path, i.quantity, i.is_completed, i.created_at, i.deleted_at,
                    u.id AS user_id, u.username, g.id AS group_id, g.name AS group_name
               FROM grocery_items i
               JOIN users u ON u.id = i.created_by
               JOIN `groups` g ON g.id = i.group_id
              WHERE $where
              ORDER BY i.created_at DESC LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) $stmt->bindValue($key, $value, PDO::PARAM_STR);
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        jsonOut(['kind' => 'items', 'items' => $stmt->fetchAll(), 'page' => $page, 'per_page' => $perPage, 'total' => $total, 'status' => $status]);
    }

    if (null === $targetId) jsonError('Content id required');
    if (!in_array($action, ['item', 'comment'], true)) jsonError('Content type required');
    $table = 'item' === $action ? 'grocery_items' : 'item_comments';
    $targetType = $action;

    if ('DELETE' === $method) {
        $dbh->prepare("UPDATE `$table` SET deleted_at = UTC_TIMESTAMP(), deleted_by = :admin WHERE id = :id AND deleted_at IS NULL")
            ->execute([':admin' => $adminUserId, ':id' => $targetId]);
        adminAudit($dbh, $adminUserId, $targetType . '_deleted', $targetType, $targetId);
        jsonOut(['message' => ucfirst($targetType) . ' deleted']);
    }
    if ('PATCH' === $method) {
        $dbh->prepare("UPDATE `$table` SET deleted_at = NULL, deleted_by = NULL WHERE id = :id")
            ->execute([':id' => $targetId]);
        adminAudit($dbh, $adminUserId, $targetType . '_restored', $targetType, $targetId);
        jsonOut(['message' => ucfirst($targetType) . ' restored']);
    }
    jsonError('Method not allowed', 405);
}

if ('moderation' === $section) {
    if ('terms' === $action || ('' === $action && null === $targetId)) {
        if ('GET' === $method) {
            $stmt = $dbh->query('SELECT id, term, language, severity, is_active, created_at FROM blocked_terms ORDER BY language, term');
            jsonOut(['items' => $stmt->fetchAll()]);
        }
        if ('POST' === $method) {
            $body = adminBody();
            $term = trim((string)($body['term'] ?? ''));
            $language = (string)($body['language'] ?? detectContentLanguage($term));
            $severity = min(3, max(1, (int)($body['severity'] ?? 2)));
            if ('' === $term) jsonError('Term required');
            if (!in_array($language, ['he', 'en'], true)) jsonError('Unsupported language');
            $stmt = $dbh->prepare(
                'INSERT INTO blocked_terms (term, normalized_term, language, severity, is_active, created_by)
                 VALUES (:term, :normalized, :language, :severity, 1, :admin)
                 ON DUPLICATE KEY UPDATE term = VALUES(term), severity = VALUES(severity), is_active = 1, updated_at = CURRENT_TIMESTAMP'
            );
            $stmt->execute([
                ':term' => $term,
                ':normalized' => moderationNormalize($term, $language),
                ':language' => $language,
                ':severity' => $severity,
                ':admin' => $adminUserId,
            ]);
            adminAudit($dbh, $adminUserId, 'blocked_term_saved', 'blocked_term', (int)$dbh->lastInsertId(), ['language' => $language, 'severity' => $severity]);
            jsonOut(['message' => 'Term saved'], 201);
        }
    }

    if (null !== $targetId && 'term' === $action && 'DELETE' === $method) {
        $dbh->prepare('UPDATE blocked_terms SET is_active = 0 WHERE id = :id')->execute([':id' => $targetId]);
        adminAudit($dbh, $adminUserId, 'blocked_term_disabled', 'blocked_term', $targetId);
        jsonOut(['message' => 'Term disabled']);
    }

    if ('events' === $action && 'GET' === $method) {
        [$page, $perPage, $offset] = adminPaging();
        $search = adminSearch();
        $where = '1=1';
        $params = [];
        if ('' !== $search) {
            $where .= ' AND (e.field_name LIKE :search OR e.matched_term LIKE :search OR e.content_excerpt LIKE :search OR u.username LIKE :search OR u.email LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }
        $countStmt = $dbh->prepare("SELECT COUNT(*) FROM moderation_events e LEFT JOIN users u ON u.id = e.user_id WHERE $where");
        $countStmt->execute($params);
        $total = (int)($countStmt->fetchColumn() ?: 0);
        $stmt = $dbh->prepare(
            "SELECT e.id, e.field_name, e.entity_type, e.entity_id, e.language, e.matched_term,
                    e.content_excerpt, e.ip_address, e.created_at, u.username, u.email
               FROM moderation_events e
               LEFT JOIN users u ON u.id = e.user_id
              WHERE $where
              ORDER BY e.created_at DESC LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) $stmt->bindValue($key, $value, PDO::PARAM_STR);
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        jsonOut(['items' => $stmt->fetchAll(), 'page' => $page, 'per_page' => $perPage, 'total' => $total]);
    }

    if ('reports' === $action && 'GET' === $method) {
        [$page, $perPage, $offset] = adminPaging();
        $status = (string)($_GET['status'] ?? 'open');
        if (!in_array($status, ['open', 'resolved', 'dismissed', 'all'], true)) $status = 'open';
        $search = adminSearch();
        $where = 'all' === $status ? '1=1' : 'r.status = :status';
        if ('' !== $search) {
            $where .= ' AND (r.reason LIKE :search OR reporter.username LIKE :search OR reporter.email LIKE :search)';
        }
        $stmt = $dbh->prepare(
            "SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.resolution_note,
                    r.created_at, r.resolved_at, reporter.username AS reporter_name, reporter.email AS reporter_email,
                    resolver.username AS resolver_name,
                    CASE
                        WHEN r.target_type = 'item' THEN (SELECT COALESCE(NULLIF(i.name, ''), '[image]') FROM grocery_items i WHERE i.id = r.target_id LIMIT 1)
                        WHEN r.target_type = 'comment' THEN (SELECT c.body FROM item_comments c WHERE c.id = r.target_id LIMIT 1)
                        WHEN r.target_type = 'user' THEN (SELECT u.username FROM users u WHERE u.id = r.target_id LIMIT 1)
                    END AS target_label
               FROM content_reports r
               JOIN users reporter ON reporter.id = r.reporter_id
               LEFT JOIN users resolver ON resolver.id = r.resolved_by
              WHERE $where
              ORDER BY CASE WHEN r.status = 'open' THEN 0 ELSE 1 END, r.created_at DESC
              LIMIT :limit OFFSET :offset"
        );
        if ('all' !== $status) $stmt->bindValue(':status', $status, PDO::PARAM_STR);
        if ('' !== $search) $stmt->bindValue(':search', '%' . $search . '%', PDO::PARAM_STR);
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $totalSql = 'SELECT COUNT(*) FROM content_reports r JOIN users reporter ON reporter.id = r.reporter_id WHERE ' . $where;
        $totalStmt = $dbh->prepare($totalSql);
        if ('all' !== $status) $totalStmt->bindValue(':status', $status, PDO::PARAM_STR);
        if ('' !== $search) $totalStmt->bindValue(':search', '%' . $search . '%', PDO::PARAM_STR);
        $totalStmt->execute();
        jsonOut([
            'items' => $stmt->fetchAll(),
            'page' => $page,
            'per_page' => $perPage,
            'total' => (int)($totalStmt->fetchColumn() ?: 0),
            'status' => $status,
        ]);
    }

    if (null !== $targetId && 'report' === $action && 'PATCH' === $method) {
        $body = adminBody();
        $status = (string)($body['status'] ?? 'resolved');
        $note = trim((string)($body['note'] ?? ''));
        if (!in_array($status, ['resolved', 'dismissed'], true)) jsonError('Invalid report status');
        $stmt = $dbh->prepare(
            'UPDATE content_reports
                SET status = :status, resolved_by = :admin, resolution_note = :note, resolved_at = UTC_TIMESTAMP()
              WHERE id = :id'
        );
        $stmt->execute([':status' => $status, ':admin' => $adminUserId, ':note' => $note ?: null, ':id' => $targetId]);
        adminAudit($dbh, $adminUserId, 'report_' . $status, 'report', $targetId, ['note' => $note]);
        jsonOut(['message' => 'Report updated']);
    }

    jsonError('Method not allowed', 405);
}

if ('audit' === $section && 'GET' === $method) {
    [$page, $perPage, $offset] = adminPaging();
    $search = adminSearch();
    $where = '1=1';
    $params = [];
    if ('' !== $search) {
        $where .= ' AND (l.action LIKE :search OR l.target_type LIKE :search OR l.details LIKE :search OR u.username LIKE :search OR u.email LIKE :search)';
        $params[':search'] = '%' . $search . '%';
    }
    $countStmt = $dbh->prepare("SELECT COUNT(*) FROM admin_audit_log l LEFT JOIN users u ON u.id = l.admin_user_id WHERE $where");
    $countStmt->execute($params);
    $total = (int)($countStmt->fetchColumn() ?: 0);
    $stmt = $dbh->prepare(
        "SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.ip_address, l.created_at,
                u.username AS admin_name, u.email AS admin_email
           FROM admin_audit_log l
           LEFT JOIN users u ON u.id = l.admin_user_id
          WHERE $where
          ORDER BY l.created_at DESC LIMIT :limit OFFSET :offset"
    );
    foreach ($params as $key => $value) $stmt->bindValue($key, $value, PDO::PARAM_STR);
    $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    jsonOut(['items' => $stmt->fetchAll(), 'page' => $page, 'per_page' => $perPage, 'total' => $total]);
}

if ('security' === $section && 'scan' === $action && 'POST' === $method) {
    $scan = adminRunSecurityScan($dbh, adminItemUploadDir());
    adminAudit($dbh, $adminUserId, 'security_scan_run', 'system', null, [
        'score' => $scan['score'],
        'status' => $scan['overall_status'],
        'warnings' => $scan['summary']['warning'],
        'critical' => $scan['summary']['critical'],
    ]);
    jsonOut($scan);
}

if ('security' === $section && 'read' === $action && 'POST' === $method) {
    $dbh->exec("UPDATE security_events SET is_read = 1 WHERE is_read = 0 AND severity IN ('warning','critical')");
    adminAudit($dbh, $adminUserId, 'security_alerts_read', 'system');
    jsonOut(['message' => 'Security alerts marked as read', 'security_alerts' => 0]);
}

if ('health' === $section && 'GET' === $method) {
    $version = (string)$dbh->query('SELECT VERSION()')->fetchColumn();
    $tables = [];
    foreach (['users', 'groups', 'grocery_items', 'item_comments', 'activity_log', 'blocked_terms', 'moderation_events', 'content_reports', 'admin_audit_log', 'system_events', 'auth_login_attempts', 'auth_request_limits', 'security_events'] as $table) {
        try {
            $tables[$table] = adminCount($dbh, 'SELECT COUNT(*) FROM `' . $table . '`');
        } catch (Throwable $e) {
            $tables[$table] = null;
        }
    }
    $uploadDir = adminItemUploadDir();
    $uploadStats = adminDirectoryStats($uploadDir);
    $diskSpace = adminSafeDiskSpace($uploadDir);
    $security = adminSecuritySummary($dbh);
    $errors24h = adminSafeCount($dbh, "SELECT COUNT(*) FROM system_events WHERE event_type IN ('api_error','database_error') AND resolved_at IS NULL AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)");
    $recentErrors = adminSafeFetchAll(
        $dbh,
        "SELECT e.event_type, e.route, e.message, e.created_at, e.ip_address,
                COALESCE(NULLIF(u.username, ''), NULLIF(e.username_snapshot, '')) AS username
           FROM system_events e
           LEFT JOIN users u ON u.id = e.user_id
          WHERE e.event_type IN ('api_error','database_error')
            AND e.resolved_at IS NULL
          ORDER BY e.created_at DESC
          LIMIT 20"
    );
    jsonOut([
        'database_version' => $version,
        'php_version' => PHP_VERSION,
        'server_software' => securityLimitText((string)($_SERVER['SERVER_SOFTWARE'] ?? ''), 100),
        'server_time' => gmdate('c'),
        'uploads_path' => adminUploadDisplayPath(),
        'uploads_writable' => is_dir($uploadDir) ? is_writable($uploadDir) : is_writable(dirname($uploadDir)),
        'uploads_bytes' => $uploadStats['bytes'],
        'uploads_files' => $uploadStats['files'],
        'disk_free_bytes' => $diskSpace['free'],
        'disk_total_bytes' => $diskSpace['total'],
        'upload_max_filesize' => (string)ini_get('upload_max_filesize'),
        'post_max_size' => (string)ini_get('post_max_size'),
        'memory_limit' => (string)ini_get('memory_limit'),
        'file_uploads' => adminIniEnabled('file_uploads'),
        'errors_24h' => $errors24h,
        'recent_errors' => $recentErrors,
        'security' => $security,
        'recent_security_events' => adminRecentSecurityEvents($dbh, 30),
        'tables' => $tables,
    ]);
}

jsonError('Not found', 404);
