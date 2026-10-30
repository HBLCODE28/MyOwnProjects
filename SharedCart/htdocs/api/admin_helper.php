<?php
declare(strict_types=1);

require_once __DIR__ . '/../../../secret/config.php';

const ADMIN_CONSOLE_PATH = '/admin-29db540de5959343f303d392c63dcece.php';

function dbTableColumns(PDO $dbh, string $table): array {
    $columns = [];
    try {
        $stmt = $dbh->query('SHOW COLUMNS FROM `' . str_replace('`', '``', $table) . '`');
        foreach ($stmt->fetchAll() as $row) {
            $columns[(string)$row['Field']] = true;
        }
    } catch (Throwable $e) {
        error_log('Schema read failed for ' . $table . ': ' . $e->getMessage());
    }
    return $columns;
}

function dbTableIndexes(PDO $dbh, string $table): array {
    $indexes = [];
    try {
        $stmt = $dbh->query('SHOW INDEX FROM `' . str_replace('`', '``', $table) . '`');
        foreach ($stmt->fetchAll() as $row) {
            $indexes[(string)$row['Key_name']] = true;
        }
    } catch (Throwable $e) {
        error_log('Index read failed for ' . $table . ': ' . $e->getMessage());
    }
    return $indexes;
}

function ensureColumn(PDO $dbh, string $table, string $column, string $definition): void {
    $columns = dbTableColumns($dbh, $table);
    if (isset($columns[$column])) return;
    try {
        $dbh->exec('ALTER TABLE `' . str_replace('`', '``', $table) . '` ADD COLUMN `' . str_replace('`', '``', $column) . '` ' . $definition);
    } catch (Throwable $e) {
        error_log('Column add failed ' . $table . '.' . $column . ': ' . $e->getMessage());
    }
}


function ensureVarcharCapacity(PDO $dbh, string $table, string $column, int $minimumLength, string $definition): void {
    try {
        $stmt = $dbh->query('SHOW COLUMNS FROM `' . str_replace('`', '``', $table) . '`');
        $row = null;
        foreach ($stmt->fetchAll() as $candidate) {
            if ((string)($candidate['Field'] ?? '') === $column) {
                $row = $candidate;
                break;
            }
        }
        if (!$row) return;
        $type = strtolower((string)($row['Type'] ?? ''));
        if (preg_match('/^(?:var)?char\((\d+)\)/', $type, $matches) && (int)$matches[1] >= $minimumLength) return;
        $dbh->exec('ALTER TABLE `' . str_replace('`', '``', $table) . '` MODIFY COLUMN `' . str_replace('`', '``', $column) . '` ' . $definition);
    } catch (Throwable $e) {
        error_log('Column resize failed ' . $table . '.' . $column . ': ' . $e->getMessage());
    }
}

function ensureIndex(PDO $dbh, string $table, string $name, string $columns): void {
    $indexes = dbTableIndexes($dbh, $table);
    if (isset($indexes[$name])) return;
    try {
        $dbh->exec('ALTER TABLE `' . str_replace('`', '``', $table) . '` ADD INDEX `' . str_replace('`', '``', $name) . '` (' . $columns . ')');
    } catch (Throwable $e) {
        error_log('Index add failed ' . $table . '.' . $name . ': ' . $e->getMessage());
    }
}

function enforceDatabaseStrictMode(PDO $dbh): void {
    try {
        $current = (string)$dbh->query('SELECT @@SESSION.sql_mode')->fetchColumn();
        $modes = array_values(array_filter(array_map(
            static fn(string $mode): string => strtoupper(trim($mode)),
            explode(',', $current)
        )));

        if (!in_array('STRICT_TRANS_TABLES', $modes, true) && !in_array('STRICT_ALL_TABLES', $modes, true)) {
            $modes[] = 'STRICT_TRANS_TABLES';
        }

        $modes = array_values(array_unique(array_filter(
            $modes,
            static fn(string $mode): bool => (bool)preg_match('/^[A-Z0-9_]+$/', $mode)
        )));
        $sqlMode = implode(',', $modes);
        $dbh->exec('SET SESSION sql_mode = ' . $dbh->quote($sqlMode));
    } catch (Throwable $e) {
        error_log('Unable to enable strict SQL mode: ' . $e->getMessage());
    }
}

function ensureAdminSchema(PDO $dbh): void {
    // Apply data-integrity protection to every DB connection passed here, even
    // when the schema itself was already checked during this request.
    enforceDatabaseStrictMode($dbh);

    static $done = false;
    if ($done) return;
    $done = true;

    ensureVarcharCapacity($dbh, 'users', 'password', 255, 'VARCHAR(255) NOT NULL');
    ensureColumn($dbh, 'users', 'role', "ENUM('user','admin') NOT NULL DEFAULT 'user'");
    ensureColumn($dbh, 'users', 'blocked_until', 'DATETIME NULL');
    ensureColumn($dbh, 'users', 'blocked_reason', 'VARCHAR(255) NULL');
    ensureColumn($dbh, 'users', 'blocked_by', 'INT UNSIGNED NULL');
    ensureColumn($dbh, 'users', 'deleted_at', 'DATETIME NULL');
    ensureColumn($dbh, 'users', 'deleted_by', 'INT UNSIGNED NULL');
    ensureColumn($dbh, 'users', 'last_login_at', 'DATETIME NULL');
    ensureColumn($dbh, 'users', 'preferred_language', "ENUM('he','en') NOT NULL DEFAULT 'he'");
    ensureColumn($dbh, 'users', 'violation_count', 'INT UNSIGNED NOT NULL DEFAULT 0');
    ensureColumn($dbh, 'users', 'token_version', 'INT UNSIGNED NOT NULL DEFAULT 0');
    ensureIndex($dbh, 'users', 'idx_users_role', '`role`');
    ensureIndex($dbh, 'users', 'idx_users_blocked_until', '`blocked_until`');
    ensureIndex($dbh, 'users', 'idx_users_deleted_at', '`deleted_at`');

    ensureColumn($dbh, 'grocery_items', 'deleted_at', 'DATETIME NULL');
    ensureColumn($dbh, 'grocery_items', 'deleted_by', 'INT UNSIGNED NULL');
    ensureIndex($dbh, 'grocery_items', 'idx_grocery_items_deleted_at', '`deleted_at`');

    ensureColumn($dbh, 'groups', 'deleted_at', 'DATETIME NULL');
    ensureColumn($dbh, 'groups', 'deleted_by', 'INT UNSIGNED NULL');
    ensureColumn($dbh, 'groups', 'notify_creator_on_item_taken', 'TINYINT(1) NOT NULL DEFAULT 0');
    ensureIndex($dbh, 'groups', 'idx_groups_deleted_at', '`deleted_at`');

    ensureColumn($dbh, 'item_comments', 'deleted_at', 'DATETIME NULL');
    ensureColumn($dbh, 'item_comments', 'deleted_by', 'INT UNSIGNED NULL');
    ensureIndex($dbh, 'item_comments', 'idx_item_comments_deleted_at', '`deleted_at`');

    try {
        $dbh->exec(
            "CREATE TABLE IF NOT EXISTS blocked_terms (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT,
                term VARCHAR(190) NOT NULL,
                normalized_term VARCHAR(190) NOT NULL,
                language ENUM('he','en') NOT NULL,
                severity TINYINT UNSIGNED NOT NULL DEFAULT 2,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_by INT UNSIGNED NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_blocked_term_language (language, normalized_term),
                KEY idx_blocked_terms_active (is_active, language)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $dbh->exec(
            "CREATE TABLE IF NOT EXISTS moderation_events (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                user_id INT UNSIGNED NULL,
                field_name VARCHAR(64) NOT NULL,
                entity_type VARCHAR(32) NOT NULL,
                entity_id BIGINT UNSIGNED NULL,
                language ENUM('he','en') NULL,
                matched_term_id INT UNSIGNED NULL,
                matched_term VARCHAR(190) NULL,
                content_excerpt VARCHAR(255) NOT NULL,
                content_hash CHAR(64) NOT NULL,
                ip_address VARCHAR(45) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_moderation_events_user (user_id, created_at),
                KEY idx_moderation_events_created (created_at),
                KEY idx_moderation_events_entity (entity_type, entity_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $dbh->exec(
            "CREATE TABLE IF NOT EXISTS admin_audit_log (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                admin_user_id INT UNSIGNED NOT NULL,
                action VARCHAR(80) NOT NULL,
                target_type VARCHAR(40) NOT NULL,
                target_id BIGINT UNSIGNED NULL,
                details TEXT NULL,
                ip_address VARCHAR(45) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_admin_audit_created (created_at),
                KEY idx_admin_audit_admin (admin_user_id, created_at),
                KEY idx_admin_audit_target (target_type, target_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $dbh->exec(
            "CREATE TABLE IF NOT EXISTS content_reports (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                reporter_id INT UNSIGNED NOT NULL,
                target_type ENUM('item','comment','user') NOT NULL,
                target_id BIGINT UNSIGNED NOT NULL,
                reason VARCHAR(500) NOT NULL,
                status ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
                resolved_by INT UNSIGNED NULL,
                resolution_note VARCHAR(500) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME NULL,
                PRIMARY KEY (id),
                KEY idx_content_reports_status (status, created_at),
                KEY idx_content_reports_target (target_type, target_id),
                KEY idx_content_reports_reporter (reporter_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $dbh->exec(
            "CREATE TABLE IF NOT EXISTS admin_rate_limits (
                admin_user_id INT UNSIGNED NOT NULL,
                minute_bucket CHAR(12) NOT NULL,
                request_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (admin_user_id, minute_bucket),
                KEY idx_admin_rate_updated (updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $dbh->exec(
            "CREATE TABLE IF NOT EXISTS system_events (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                event_type VARCHAR(40) NOT NULL,
                route VARCHAR(190) NULL,
                message VARCHAR(500) NOT NULL,
                user_id INT UNSIGNED NULL,
                username_snapshot VARCHAR(100) NULL,
                ip_address VARCHAR(45) NULL,
                resolved_at DATETIME NULL,
                resolved_by INT UNSIGNED NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_system_events_created (created_at),
                KEY idx_system_events_type (event_type, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $dbh->exec(
            "CREATE TABLE IF NOT EXISTS auth_login_attempts (
                attempt_key CHAR(64) NOT NULL,
                email_hash CHAR(64) NOT NULL,
                ip_address VARCHAR(45) NULL,
                attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
                first_attempt_at DATETIME NOT NULL,
                last_attempt_at DATETIME NOT NULL,
                blocked_until DATETIME NULL,
                PRIMARY KEY (attempt_key),
                KEY idx_login_attempts_blocked (blocked_until),
                KEY idx_login_attempts_last (last_attempt_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $dbh->exec(
            "CREATE TABLE IF NOT EXISTS auth_request_limits (
                limit_key CHAR(64) NOT NULL,
                action_name VARCHAR(32) NOT NULL,
                request_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
                window_started_at DATETIME NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (limit_key, action_name),
                KEY idx_auth_request_limits_updated (updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
        $dbh->exec(
            "CREATE TABLE IF NOT EXISTS security_events (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                event_key CHAR(64) NOT NULL,
                event_type VARCHAR(64) NOT NULL,
                severity VARCHAR(16) NOT NULL DEFAULT 'warning',
                user_id INT UNSIGNED NULL,
                username_snapshot VARCHAR(100) NULL,
                email_masked VARCHAR(190) NULL,
                ip_address VARCHAR(45) NULL,
                user_agent VARCHAR(255) NULL,
                request_path VARCHAR(190) NULL,
                details TEXT NULL,
                occurrence_count INT UNSIGNED NOT NULL DEFAULT 1,
                is_read TINYINT(1) NOT NULL DEFAULT 0,
                first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_security_event_key (event_key),
                KEY idx_security_events_unread (is_read, severity, last_seen_at),
                KEY idx_security_events_type (event_type, last_seen_at),
                KEY idx_security_events_ip (ip_address, last_seen_at),
                KEY idx_security_events_user (user_id, last_seen_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    } catch (Throwable $e) {
        error_log('Admin tables setup failed: ' . $e->getMessage());
    }

    // Existing installations receive identity snapshots automatically.
    ensureColumn($dbh, 'security_events', 'username_snapshot', 'VARCHAR(100) NULL');
    ensureColumn($dbh, 'system_events', 'user_id', 'INT UNSIGNED NULL');
    ensureColumn($dbh, 'system_events', 'username_snapshot', 'VARCHAR(100) NULL');
    ensureColumn($dbh, 'system_events', 'ip_address', 'VARCHAR(45) NULL');
    ensureColumn($dbh, 'system_events', 'resolved_at', 'DATETIME NULL');
    ensureColumn($dbh, 'system_events', 'resolved_by', 'INT UNSIGNED NULL');
    resolveKnownLegacySystemEvents($dbh);

    seedBlockedTerms($dbh);

}

function resolveKnownLegacySystemEvents(PDO $dbh): void {
    $markerRoute = '/maintenance/resolve-known-errors-20260707-v1';

    try {
        $stmt = $dbh->prepare(
            "SELECT 1 FROM system_events
              WHERE event_type = 'maintenance' AND route = :route
              LIMIT 1"
        );
        $stmt->execute([':route' => $markerRoute]);
        if ($stmt->fetchColumn()) return;

        $dbh->beginTransaction();
        $dbh->exec(
            "UPDATE system_events
                SET resolved_at = COALESCE(resolved_at, UTC_TIMESTAMP())
              WHERE resolved_at IS NULL
                AND (
                    (event_type = 'api_error' AND route = '/admin/health' AND message LIKE '%disk_total_space%')
                    OR (event_type = 'database_error' AND message LIKE '%items_count%not supported%')
                    OR (event_type = 'database_error' AND message LIKE '%last_activity%not supported%')
                    OR (event_type = 'database_error' AND message LIKE '%it.token%')
                )"
        );
        $stmt = $dbh->prepare(
            "INSERT INTO system_events
                (event_type, route, message, resolved_at)
             VALUES
                ('maintenance', :route, 'Known fixed historical errors were marked as resolved', UTC_TIMESTAMP())"
        );
        $stmt->execute([':route' => $markerRoute]);
        $dbh->commit();
    } catch (Throwable $e) {
        if ($dbh->inTransaction()) $dbh->rollBack();
        error_log('Legacy system event resolution failed: ' . $e->getMessage());
    }
}

function moderationLower(string $text): string {
    if (function_exists('mb_strtolower')) return mb_strtolower($text, 'UTF-8');
    return strtolower($text);
}

function moderationNormalize(string $text, string $language = ''): string {
    $text = moderationLower(trim($text));
    $text = strtr($text, [
        "\xE2\x80\x8B" => '', "\xE2\x80\x8C" => '', "\xE2\x80\x8D" => '',
        '0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a', '5' => 's', '7' => 't', '@' => 'a', '$' => 's',
    ]);
    $text = preg_replace('/[\x{0591}-\x{05C7}]/u', '', $text) ?? $text;
    $text = preg_replace('/(.)\1{2,}/u', '$1', $text) ?? $text;
    $text = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $text) ?? $text;
    return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
}

function detectContentLanguage(string $text): string {
    return preg_match('/[\x{0590}-\x{05FF}]/u', $text) ? 'he' : 'en';
}

function seedBlockedTerms(PDO $dbh): void {
    static $seeded = false;
    if ($seeded) return;
    $seeded = true;

    $defaults = [
        ['en', 'fuck', 3], ['en', 'fucking', 3], ['en', 'shit', 2], ['en', 'bitch', 3],
        ['en', 'cunt', 3], ['en', 'nigger', 3], ['en', 'kike', 3], ['en', 'retard', 2],
        ['he', 'זונה', 3], ['he', 'שרמוטה', 3], ['he', 'כושי', 3], ['he', 'מפגר', 2],
        ['he', 'בן זונה', 3], ['he', 'בת זונה', 3], ['he', 'מניאק', 2], ['he', 'נאצי', 3],
    ];

    try {
        $stmt = $dbh->prepare(
            'INSERT IGNORE INTO blocked_terms (term, normalized_term, language, severity, is_active)
             VALUES (:term, :normalized, :language, :severity, 1)'
        );
        foreach ($defaults as [$language, $term, $severity]) {
            $stmt->execute([
                ':term' => $term,
                ':normalized' => moderationNormalize($term, $language),
                ':language' => $language,
                ':severity' => $severity,
            ]);
        }
    } catch (Throwable $e) {
        error_log('Blocked terms seed failed: ' . $e->getMessage());
    }
}

function findBlockedTerm(PDO $dbh, string $text): ?array {
    $normalized = moderationNormalize($text);
    if ('' === $normalized) return null;

    try {
        $rows = $dbh->query(
            'SELECT id, term, normalized_term, language, severity
               FROM blocked_terms
              WHERE is_active = 1
              ORDER BY severity DESC, CHAR_LENGTH(normalized_term) DESC'
        )->fetchAll();
    } catch (Throwable $e) {
        error_log('Moderation term lookup failed: ' . $e->getMessage());
        return null;
    }

    // Match only a complete normalized word or phrase. Padding with spaces keeps
    // punctuation-separated terms detectable without matching inside another word.
    $padded = ' ' . $normalized . ' ';
    foreach ($rows as $row) {
        $term = trim((string)$row['normalized_term']);
        if ('' === $term) continue;
        if (str_contains($padded, ' ' . $term . ' ')) return $row;
    }
    return null;
}

function clientIpAddress(): string {
    // Prefer the web server's peer address. Forwarded headers are only fallbacks because clients can spoof them.
    $candidates = [$_SERVER['REMOTE_ADDR'] ?? '', $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''];
    foreach ($candidates as $candidate) {
        $first = trim(explode(',', (string)$candidate)[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
    }
    return '';
}

function logModerationEvent(PDO $dbh, ?int $userId, string $fieldName, string $entityType, ?int $entityId, string $content, array $match): void {
    $excerpt = trim(preg_replace('/\s+/u', ' ', $content) ?? $content);
    if (function_exists('mb_substr')) $excerpt = mb_substr($excerpt, 0, 255, 'UTF-8');
    else $excerpt = substr($excerpt, 0, 255);

    try {
        $stmt = $dbh->prepare(
            'INSERT INTO moderation_events
                (user_id, field_name, entity_type, entity_id, language, matched_term_id, matched_term, content_excerpt, content_hash, ip_address)
             VALUES (:user_id, :field_name, :entity_type, :entity_id, :language, :term_id, :term, :excerpt, :hash, :ip)'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':field_name' => $fieldName,
            ':entity_type' => $entityType,
            ':entity_id' => $entityId,
            ':language' => $match['language'] ?? detectContentLanguage($content),
            ':term_id' => $match['id'] ?? null,
            ':term' => $match['term'] ?? null,
            ':excerpt' => $excerpt,
            ':hash' => hash('sha256', $content),
            ':ip' => clientIpAddress(),
        ]);
        if ($userId) {
            $dbh->prepare('UPDATE users SET violation_count = violation_count + 1 WHERE id = :id')->execute([':id' => $userId]);
        }
    } catch (Throwable $e) {
        error_log('Moderation event logging failed: ' . $e->getMessage());
    }
}

function assertContentAllowed(PDO $dbh, string $content, ?int $userId, string $fieldName, string $entityType, ?int $entityId = null): void {
    if ('' === trim($content)) return;
    $match = findBlockedTerm($dbh, $content);
    if (!$match) return;
    logModerationEvent($dbh, $userId, $fieldName, $entityType, $entityId, $content, $match);
    jsonError('Content contains blocked language', 422);
}

function adminAudit(PDO $dbh, int $adminId, string $action, string $targetType, ?int $targetId = null, array $details = []): void {
    try {
        $stmt = $dbh->prepare(
            'INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, details, ip_address)
             VALUES (:admin, :action, :target_type, :target_id, :details, :ip)'
        );
        $stmt->execute([
            ':admin' => $adminId,
            ':action' => $action,
            ':target_type' => $targetType,
            ':target_id' => $targetId,
            ':details' => $details ? json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            ':ip' => clientIpAddress(),
        ]);
    } catch (Throwable $e) {
        error_log('Admin audit failed: ' . $e->getMessage());
    }
}

function userAccessRow(PDO $dbh, int $userId): ?array {
    ensureAdminSchema($dbh);
    $stmt = $dbh->prepare(
        'SELECT id, username, email, role, blocked_until, blocked_reason, deleted_at, preferred_language, token_version,
                (blocked_until IS NOT NULL AND blocked_until > UTC_TIMESTAMP()) AS is_blocked
           FROM users
          WHERE id = :id
          LIMIT 1'
    );
    $stmt->execute([':id' => $userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}


function enforceAdminRateLimit(PDO $dbh, int $adminId, int $maxPerMinute = 180): void {
    $bucket = gmdate('YmdHi');
    try {
        $stmt = $dbh->prepare(
            'INSERT INTO admin_rate_limits (admin_user_id, minute_bucket, request_count)
             VALUES (:admin, :bucket, 1)
             ON DUPLICATE KEY UPDATE request_count = request_count + 1, updated_at = CURRENT_TIMESTAMP'
        );
        $stmt->execute([':admin' => $adminId, ':bucket' => $bucket]);
        $check = $dbh->prepare('SELECT request_count FROM admin_rate_limits WHERE admin_user_id = :admin AND minute_bucket = :bucket');
        $check->execute([':admin' => $adminId, ':bucket' => $bucket]);
        if ((int)$check->fetchColumn() > $maxPerMinute) jsonError('Too many admin requests', 429);
        if (random_int(1, 50) === 1) {
            $dbh->exec("DELETE FROM admin_rate_limits WHERE updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY)");
        }
    } catch (PDOException $e) {
        error_log('Admin rate limit failed: ' . $e->getMessage());
        // SECURITY_RATE_LIMIT_FAIL_CLOSED: admin mutations must not continue
        // when the rate-limit store cannot be verified.
        jsonError('Admin request protection temporarily unavailable', 503);
    }
}

function securityResolveIdentity(PDO $dbh, ?int $userId = null, string $email = ''): array {
    $resolvedId = $userId && $userId > 0 ? $userId : null;
    $resolvedEmail = strtolower(trim($email));
    $username = '';

    // For API errors, recover the signed-in user from the same JWT used by the request.
    if (null === $resolvedId && function_exists('jwtDecode')) {
        $token = '';
        if (defined('AUTH_COOKIE_NAME')) {
            $token = trim((string)($_COOKIE[AUTH_COOKIE_NAME] ?? ''));
        }
        if ('' === $token) {
            $authorization = trim((string)($_SERVER['HTTP_AUTHORIZATION'] ?? ''));
            if (preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches)) {
                $token = trim((string)$matches[1]);
            }
        }
        if ('' !== $token) {
            try {
                $payload = jwtDecode($token);
                if (is_array($payload) && !empty($payload['sub'])) {
                    $resolvedId = (int)$payload['sub'];
                }
            } catch (Throwable $e) {
                // Identity enrichment must never interrupt the original request.
            }
        }
    }

    try {
        if (null !== $resolvedId) {
            $stmt = $dbh->prepare('SELECT id, username, email FROM users WHERE id = :id LIMIT 1');
            $stmt->execute([':id' => $resolvedId]);
            $row = $stmt->fetch();
        } elseif ('' !== $resolvedEmail && filter_var($resolvedEmail, FILTER_VALIDATE_EMAIL)) {
            $stmt = $dbh->prepare('SELECT id, username, email FROM users WHERE LOWER(TRIM(email)) = :email LIMIT 1');
            $stmt->execute([':email' => $resolvedEmail]);
            $row = $stmt->fetch();
        } else {
            $row = false;
        }

        if ($row) {
            $resolvedId = (int)$row['id'];
            $username = securityLimitText((string)($row['username'] ?? ''), 100);
            $resolvedEmail = strtolower(trim((string)($row['email'] ?? $resolvedEmail)));
        }
    } catch (Throwable $e) {
        error_log('Security identity lookup failed: ' . $e->getMessage());
    }

    return [
        'user_id' => $resolvedId,
        'username' => $username,
        'email' => $resolvedEmail,
    ];
}

function logSystemEvent(PDO $dbh, string $eventType, string $message, string $route = ''): void {
    try {
        ensureAdminSchema($dbh);
        $message = function_exists('mb_substr') ? mb_substr($message, 0, 500, 'UTF-8') : substr($message, 0, 500);
        $route = function_exists('mb_substr') ? mb_substr($route, 0, 190, 'UTF-8') : substr($route, 0, 190);
        $identity = securityResolveIdentity($dbh);
        $stmt = $dbh->prepare(
            'INSERT INTO system_events (event_type, route, message, user_id, username_snapshot, ip_address)
             VALUES (:type, :route, :message, :user_id, :username, :ip)'
        );
        $stmt->execute([
            ':type' => $eventType,
            ':route' => $route,
            ':message' => $message,
            ':user_id' => $identity['user_id'],
            ':username' => '' !== $identity['username'] ? $identity['username'] : null,
            ':ip' => clientIpAddress() ?: null,
        ]);
    } catch (Throwable $e) {
        error_log('System event logging failed: ' . $e->getMessage());
    }
}

function securityLimitText(string $value, int $limit): string {
    $value = trim($value);
    if (function_exists('mb_substr')) return mb_substr($value, 0, $limit, 'UTF-8');
    return substr($value, 0, $limit);
}

function maskSecurityEmail(string $email): string {
    $email = strtolower(trim($email));
    if ('' === $email || !str_contains($email, '@')) return '';
    [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
    if ('' === $local || '' === $domain) return '';
    $visible = function_exists('mb_substr') ? mb_substr($local, 0, min(2, mb_strlen($local, 'UTF-8')), 'UTF-8') : substr($local, 0, 2);
    return $visible . str_repeat('*', max(3, min(8, strlen($local) - strlen($visible)))) . '@' . $domain;
}

function securityUserAgent(): string {
    return securityLimitText((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 255);
}

function securityRequestPath(): string {
    $path = parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: '';
    return securityLimitText($path, 190);
}

function logSecurityEvent(
    PDO $dbh,
    string $eventType,
    string $severity = 'warning',
    ?int $userId = null,
    string $email = '',
    string $requestPath = '',
    array $details = []
): void {
    try {
        ensureAdminSchema($dbh);
        $eventType = preg_replace('/[^a-z0-9_.-]/i', '_', $eventType) ?: 'security_event';
        $eventType = securityLimitText($eventType, 64);
        $severity = in_array($severity, ['info', 'warning', 'critical'], true) ? $severity : 'warning';
        $identity = securityResolveIdentity($dbh, $userId, $email);
        $userId = $identity['user_id'];
        $email = (string)$identity['email'];
        $username = (string)$identity['username'];
        $ip = clientIpAddress();
        $maskedEmail = maskSecurityEmail($email);
        $path = '' !== trim($requestPath) ? securityLimitText($requestPath, 190) : securityRequestPath();
        $reason = securityLimitText((string)($details['reason'] ?? ''), 80);
        $eventKey = hash('sha256', implode('|', [$eventType, $severity, $ip, (string)($userId ?? ''), $maskedEmail, $path, $reason, gmdate('YmdH')]));
        $detailsJson = $details ? json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
        if (is_string($detailsJson)) $detailsJson = securityLimitText($detailsJson, 2000);
        $isRead = 'info' === $severity ? 1 : 0;

        $sql = <<<'SQL'
INSERT INTO security_events
    (event_key, event_type, severity, user_id, username_snapshot, email_masked, ip_address, user_agent, request_path, details, occurrence_count, is_read, first_seen_at, last_seen_at)
VALUES
    (:event_key, :event_type, :severity, :user_id, :username_snapshot, :email_masked, :ip_address, :user_agent, :request_path, :details, 1, :is_read, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
    occurrence_count = occurrence_count + 1,
    last_seen_at = UTC_TIMESTAMP(),
    is_read = IF(VALUES(severity) = 'info', is_read, 0),
    severity = VALUES(severity),
    user_id = COALESCE(VALUES(user_id), user_id),
    username_snapshot = COALESCE(NULLIF(VALUES(username_snapshot), ''), username_snapshot),
    email_masked = COALESCE(NULLIF(VALUES(email_masked), ''), email_masked),
    user_agent = VALUES(user_agent),
    details = VALUES(details)
SQL;
        $stmt = $dbh->prepare($sql);
        $stmt->execute([
            ':event_key' => $eventKey,
            ':event_type' => $eventType,
            ':severity' => $severity,
            ':user_id' => $userId,
            ':username_snapshot' => '' !== $username ? $username : null,
            ':email_masked' => '' !== $maskedEmail ? $maskedEmail : null,
            ':ip_address' => '' !== $ip ? $ip : null,
            ':user_agent' => securityUserAgent() ?: null,
            ':request_path' => '' !== $path ? $path : null,
            ':details' => $detailsJson,
            ':is_read' => $isRead,
        ]);

        if (random_int(1, 100) === 1) {
            $dbh->exec('DELETE FROM security_events WHERE last_seen_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)');
        }
    } catch (Throwable $e) {
        error_log('Security event logging failed: ' . $e->getMessage());
    }
}

function ensureGroupGovernanceSchema(PDO $dbh): void {
    try {
        $dbh->exec('CREATE TABLE IF NOT EXISTS group_managers (
            group_id INT UNSIGNED NOT NULL,
            user_id INT UNSIGNED NOT NULL,
            granted_by INT UNSIGNED NOT NULL,
            granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, user_id),
            KEY idx_group_managers_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
        $column = $dbh->query("SHOW COLUMNS FROM `groups` LIKE 'member_limit'")->fetch();
        if (!$column) $dbh->exec('ALTER TABLE `groups` ADD member_limit SMALLINT UNSIGNED NOT NULL DEFAULT 0');
    } catch (PDOException $e) {
        error_log('Group governance schema setup failed: ' . $e->getMessage());
        jsonError('Group settings unavailable', 500);
    }
}

function groupCanManage(PDO $dbh, int $groupId, int $userId): bool {
    $stmt = $dbh->prepare(
        'SELECT 1 FROM `groups` g
          LEFT JOIN group_managers m ON m.group_id = g.id AND m.user_id = :user_id
         WHERE g.id = :group_id AND g.deleted_at IS NULL
           AND (g.created_by = :owner_id OR m.user_id IS NOT NULL)
         LIMIT 1'
    );
    $stmt->execute([':group_id' => $groupId, ':user_id' => $userId, ':owner_id' => $userId]);
    return (bool)$stmt->fetchColumn();
}
