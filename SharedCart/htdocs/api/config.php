<?php
declare(strict_types=1);

/*
 * InfinityFree database settings.
 * Copy the exact values from Control Panel -> MySQL Databases.
 * The database host is NOT localhost.
 */
const DB_HOST = 'sql200.infinityfree.com';
const DB_NAME = 'if0_42313151_db_grocery';
const DB_USER = 'if0_42313151';
const DB_PASS = 'n3liOKVsFsL1S0';

/* Generated signing key. Keep this private and do not change it after users log in. */
const JWT_SECRET = 'b24377e63f0a66153a65f53346037544f29a3a4e3e3c4fb8db27386c3a7072ba';
const JWT_EXPIRY_SECONDS = 604800; // 7 days
const APP_NAME = 'SharedCart';
const PASSWORD_RESET_CODE_LEN = 6;
const PASSWORD_RESET_TTL_MINUTES = 15;
const COMPLETED_ITEM_RETENTION_HOURS = 24;

// SMTP settings for outbound email.
// Fill these with your real mailbox provider values before deploying.
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;
const SMTP_USER = 'sharedcartmail2@gmail.com';
const SMTP_PASS = 'hvok hfxq vase twuq';
const SMTP_ENCRYPTION = 'tls'; // 'tls', 'ssl', or '' for plain SMTP
const SMTP_FROM_EMAIL = 'sharedcartmail2@gmail.com';
const SMTP_FROM_NAME = APP_NAME;

const MIN_PASSWORD_LEN = 8;
const MAX_USERNAME_LEN = 50;
const MAX_GROUP_NAME_LEN = 100;
const MAX_ITEM_NAME_LEN = 200;
const MAX_QUANTITY = 999;
const MAX_ITEM_TOTAL_QTY = 10;
const MAX_ITEM_IMAGE_BYTES = 5242880;
const COMPLETED_ITEM_RETENTION_HOURS = 24;

function jsonOut(mixed $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonError(string $message, int $status = 400): never {
    jsonOut(['error' => $message], $status);
}

function getDb(): PDO {
    static $dbh = null;

    if ($dbh instanceof PDO) {
        return $dbh;
    }

    if (
        str_contains(DB_HOST, 'XXX') ||
        str_contains(DB_NAME, 'XXXXXXXX') ||
        str_contains(DB_USER, 'XXXXXXXX') ||
        DB_PASS === 'YOUR_DATABASE_PASSWORD'
    ) {
        jsonError('Server database configuration is incomplete', 500);
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    try {
        $dbh = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        error_log('Database connection failed: ' . $e->getMessage());
        jsonError('Database connection failed', 500);
    }

    return $dbh;
}

function ensureItemContributionsTable(PDO $dbh): void {
    try {
        $dbh->exec(
            'CREATE TABLE IF NOT EXISTS item_contributions (
                item_id INT UNSIGNED NOT NULL,
                user_id INT UNSIGNED NOT NULL,
                quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (item_id, user_id),
                KEY idx_item_contributions_user (user_id),
                CONSTRAINT fk_item_contributions_item FOREIGN KEY (item_id) REFERENCES grocery_items(id) ON DELETE CASCADE,
                CONSTRAINT fk_item_contributions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT chk_item_contributions_quantity CHECK (quantity BETWEEN 1 AND 999)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    } catch (PDOException $e) {
        error_log('Item contributions table setup failed: ' . $e->getMessage());
    }
}

function ensureNotificationActionColumns(PDO $dbh): void {
    $columns = [];
    try {
        $stmt = $dbh->query('SHOW COLUMNS FROM notifications');
        foreach ($stmt->fetchAll() as $row) {
            $columns[(string)$row['Field']] = true;
        }
    } catch (PDOException $e) {
        error_log('Notification schema check failed: ' . $e->getMessage());
        return;
    }

    try {
        if (!isset($columns['event_type'])) {
            $dbh->exec(
                "ALTER TABLE notifications
                    ADD COLUMN event_type VARCHAR(32) NOT NULL DEFAULT 'completed' AFTER actor_id"
            );
        }
        if (!isset($columns['amount'])) {
            $dbh->exec(
                'ALTER TABLE notifications
                    ADD COLUMN amount SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER event_type'
            );
        }
    } catch (PDOException $e) {
        error_log('Notification schema update failed: ' . $e->getMessage());
    }
}

function ensureActivityQuantityColumn(PDO $dbh): void {
    $columns = [];
    try {
        $stmt = $dbh->query('SHOW COLUMNS FROM activity_log');
        foreach ($stmt->fetchAll() as $row) {
            $columns[(string)$row['Field']] = true;
        }
    } catch (PDOException $e) {
        error_log('Activity schema check failed: ' . $e->getMessage());
        return;
    }

    try {
        if (!isset($columns['quantity'])) {
            $dbh->exec(
                'ALTER TABLE activity_log
                    ADD COLUMN quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER item_name'
            );
        }
    } catch (PDOException $e) {
        error_log('Activity schema update failed: ' . $e->getMessage());
    }
}

function ensureItemCommentsTable(PDO $dbh): void {
    try {
        $dbh->exec(
            'CREATE TABLE IF NOT EXISTS item_comments (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                item_id INT UNSIGNED NOT NULL,
                user_id INT UNSIGNED NOT NULL,
                body VARCHAR(500) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_item_comments_item_created (item_id, created_at),
                KEY idx_item_comments_user (user_id),
                CONSTRAINT fk_item_comments_item FOREIGN KEY (item_id) REFERENCES grocery_items(id) ON DELETE CASCADE,
                CONSTRAINT fk_item_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    } catch (PDOException $e) {
        error_log('Item comments table setup failed: ' . $e->getMessage());
    }
}

function ensureItemImageColumn(PDO $dbh): void {
    $columns = [];
    try {
        $stmt = $dbh->query('SHOW COLUMNS FROM grocery_items');
        foreach ($stmt->fetchAll() as $row) {
            $columns[(string)$row['Field']] = true;
        }
    } catch (PDOException $e) {
        error_log('Item image schema check failed: ' . $e->getMessage());
        return;
    }

    try {
        if (!isset($columns['image_path'])) {
            $dbh->exec(
                'ALTER TABLE grocery_items
                    ADD COLUMN image_path VARCHAR(255) NULL AFTER name'
            );
        }
    } catch (PDOException $e) {
        error_log('Item image schema update failed: ' . $e->getMessage());
    }
}

function itemUploadDir(): string {
    return dirname(__DIR__) . '/uploads/item-images';
}

function saveUploadedItemImage(array $file): ?string {
    if (!isset($file['error']) || UPLOAD_ERR_NO_FILE === $file['error']) {
        return null;
    }
    if (UPLOAD_ERR_OK !== $file['error']) {
        jsonError('Image upload failed', 400);
    }
    if (!is_uploaded_file((string)$file['tmp_name'])) {
        jsonError('Image upload failed', 400);
    }
    if ((int)($file['size'] ?? 0) > MAX_ITEM_IMAGE_BYTES) {
        jsonError('Image is too large', 400);
    }

    $tmpPath = (string)$file['tmp_name'];
    $mime = '';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $mime = (string)(finfo_file($finfo, $tmpPath) ?: '');
            finfo_close($finfo);
        }
    }

    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    if (!isset($extensions[$mime])) {
        jsonError('Unsupported image type', 400);
    }

    $dir = itemUploadDir();
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        jsonError('Image storage unavailable', 500);
    }

    $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
    $targetPath = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . $filename;
    if (!move_uploaded_file($tmpPath, $targetPath)) {
        jsonError('Image upload failed', 400);
    }

    return '/uploads/item-images/' . $filename;
}

function deleteUploadedItemImage(?string $path): void {
    $path = trim((string)$path);
    if ('' === $path) {
        return;
    }
    $relative = preg_replace('#^/?uploads/item-images/#', '', $path);
    if ('' === $relative) {
        return;
    }
    $fullPath = itemUploadDir() . DIRECTORY_SEPARATOR . basename($relative);
    if (is_file($fullPath)) {
        @unlink($fullPath);
    }
}

function backfillLegacyActivityLogRows(PDO $dbh): void {
    try {
        $stmt = $dbh->query("SHOW COLUMNS FROM activity_log LIKE 'quantity'");
        if (!$stmt || !$stmt->fetch()) {
            return;
        }
    } catch (PDOException $e) {
        error_log('Activity backfill schema check failed: ' . $e->getMessage());
        return;
    }

    try {
        $dbh->exec(
            "UPDATE activity_log al
             JOIN grocery_items i ON i.id = al.item_id
                SET al.action = 'added',
                    al.quantity = i.quantity
              WHERE (al.action = '' OR al.action IS NULL)
                AND al.item_id IS NOT NULL"
        );
    } catch (PDOException $e) {
        error_log('Activity backfill failed: ' . $e->getMessage());
    }
}

function ensureItemSharingSchema(PDO $dbh): void {
    ensureItemContributionsTable($dbh);
    ensureNotificationActionColumns($dbh);
    ensureActivityQuantityColumn($dbh);
    ensureItemCommentsTable($dbh);
    ensureItemImageColumn($dbh);
    backfillLegacyActivityLogRows($dbh);
}

function insertNotification(PDO $dbh, int $userId, int $itemId, int $actorId, string $eventType, int $amount = 1): void {
    $safeAmount = max(1, min(MAX_QUANTITY, $amount));

    try {
        $stmt = $dbh->prepare(
            'INSERT INTO notifications (user_id, item_id, actor_id, event_type, amount)
             VALUES (:u, :i, :a, :e, :m)'
        );
        $stmt->execute([
            ':u' => $userId,
            ':i' => $itemId,
            ':a' => $actorId,
            ':e' => $eventType,
            ':m' => $safeAmount,
        ]);
    } catch (PDOException $e) {
        try {
            $stmt = $dbh->prepare(
                'INSERT INTO notifications (user_id, item_id, actor_id)
                 VALUES (:u, :i, :a)'
            );
            $stmt->execute([
                ':u' => $userId,
                ':i' => $itemId,
                ':a' => $actorId,
            ]);
        } catch (PDOException $inner) {
            error_log('Notification insert failed: ' . $inner->getMessage());
            throw $inner;
        }
    }
}