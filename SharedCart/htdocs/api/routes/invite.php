<?php
// Invite routes:
// POST /api/invite/create
// GET /api/invite/join?t={token}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth_helper.php';

const INVITE_TTL_HOURS = 48;
const TOKEN_LEN        = 10;
const TOKEN_CHARS      = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function makeToken(): string {
    $out = '';
    while (strlen($out) < TOKEN_LEN) {
        $out .= TOKEN_CHARS[random_int(0, 61)];
    }
    return $out;
}

function ensureInviteTokensTable(PDO $dbh): void {
    try {
        $dbh->exec(
            'CREATE TABLE IF NOT EXISTS invite_tokens (
                token CHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
                group_id INT UNSIGNED NOT NULL,
                created_by INT UNSIGNED NOT NULL,
                used TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                PRIMARY KEY (token),
                KEY idx_invites_group (group_id),
                KEY idx_invites_creator (created_by),
                KEY idx_invites_expiry (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    } catch (PDOException $e) {
        error_log('Invite table setup failed: ' . $e->getMessage());
        jsonError('Invite storage unavailable', 500);
    }
}

if ('create' === $sub) {
    if ('POST' !== $method) jsonError('Method not allowed', 405);

    $auth    = requireAuth();
    $uid     = (int)$auth['sub'];
    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $groupId = (int)($body['group_id'] ?? 0);
    if (!$groupId) jsonError('group_id required');

    $dbh = getDb();
    ensureAdminSchema($dbh);
    ensureInviteTokensTable($dbh);

    $stmt = $dbh->prepare('SELECT 1 FROM group_members gm JOIN `groups` g ON g.id = gm.group_id AND g.deleted_at IS NULL WHERE gm.group_id = :g AND gm.user_id = :u LIMIT 1');
    $stmt->execute([':g' => $groupId, ':u' => $uid]);
    if (!$stmt->fetch()) jsonError('Forbidden', 403);

    $dbh->prepare('DELETE FROM invite_tokens WHERE expires_at < UTC_TIMESTAMP()')->execute();

    $token = '';
    for ($i = 0; $i < 5; $i++) {
        $candidate = makeToken();
        $check = $dbh->prepare('SELECT 1 FROM invite_tokens WHERE token = :t LIMIT 1');
        $check->execute([':t' => $candidate]);
        if (!$check->fetch()) {
            $token = $candidate;
            break;
        }
    }
    if ('' === $token) jsonError('Could not generate token', 500);

    $stmt = $dbh->prepare(
        'INSERT INTO invite_tokens (token, group_id, created_by, expires_at)
         VALUES (:t, :g, :u, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 48 HOUR))'
    );
    $stmt->execute([':t' => $token, ':g' => $groupId, ':u' => $uid]);

    jsonOut(['token' => $token]);
}

if ('join' === $sub) {
    if ('GET' !== $method) jsonError('Method not allowed', 405);

    $auth  = requireAuth();
    $uid   = (int)$auth['sub'];
    $token = trim((string)($_GET['t'] ?? ''));

    if (!preg_match('/^[0-9a-zA-Z]{' . TOKEN_LEN . '}$/', $token)) {
        jsonError('Invalid token', 400);
    }

    $dbh = getDb();
    ensureAdminSchema($dbh);
    ensureInviteTokensTable($dbh);

    $stmt = $dbh->prepare(
        'SELECT it.group_id, (it.expires_at < UTC_TIMESTAMP()) AS is_expired
           FROM invite_tokens it
           JOIN `groups` g ON g.id = it.group_id AND g.deleted_at IS NULL
          WHERE token = :t
          LIMIT 1'
    );
    $stmt->execute([':t' => $token]);
    $row = $stmt->fetch();

    if (!$row) jsonError('Token not found', 404);
    if ((int)$row['is_expired'] === 1) jsonError('Token expired', 410);

    $groupId = (int)$row['group_id'];

    try {
        $dbh->beginTransaction();

        $dbh->prepare('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (:g, :u)')
            ->execute([':g' => $groupId, ':u' => $uid]);
        $dbh->commit();
    } catch (Throwable $e) {
        if ($dbh->inTransaction()) $dbh->rollBack();
        throw $e;
    }

    $g = $dbh->prepare('SELECT id, name, created_by FROM `groups` WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $g->execute([':id' => $groupId]);
    $group = $g->fetch();
    if (!$group) jsonError('Group not found', 404);

    jsonOut([
        'id'         => (int)$group['id'],
        'name'       => $group['name'],
        'created_by' => (int)$group['created_by'],
        'can_rename' => (int)$group['created_by'] === $uid,
    ]);
}

jsonError('Not found', 404);
