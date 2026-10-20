<?php
// Invite routes: POST /api/invite/create, GET /api/invite/join?t={token}
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth_helper.php';

const INVITE_TTL_HOURS = 24;
const INVITE_TOKEN_BYTES = 32;

function makeToken(): string { return bin2hex(random_bytes(INVITE_TOKEN_BYTES)); }
function inviteTokenHash(string $token): string { return hash('sha256', $token); }

function ensureInviteTokensTable(PDO $dbh): void {
    try {
        $dbh->exec('CREATE TABLE IF NOT EXISTS invite_tokens (
            token CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            group_id INT UNSIGNED NOT NULL, created_by INT UNSIGNED NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL,
            PRIMARY KEY (token), KEY idx_invites_group (group_id), KEY idx_invites_creator (created_by), KEY idx_invites_expiry (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
        $column = $dbh->query("SHOW COLUMNS FROM invite_tokens LIKE 'token'")->fetch();
        if ($column && preg_match('/char\\((\\d+)\\)/i', (string)$column['Type'], $matches) && (int)$matches[1] < 64) {
            $dbh->exec('ALTER TABLE invite_tokens MODIFY token CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL');
        }
    } catch (PDOException $e) {
        error_log('Invite table setup failed: ' . $e->getMessage());
        jsonError('Invite storage unavailable', 500);
    }
}

function ensureGroupJoinRequestsTable(PDO $dbh): void {
    try {
        $dbh->exec('CREATE TABLE IF NOT EXISTS group_join_requests (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, group_id INT UNSIGNED NOT NULL, user_id INT UNSIGNED NOT NULL,
            status ENUM("pending", "approved", "rejected") NOT NULL DEFAULT "pending",
            requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at DATETIME NULL, resolved_by INT UNSIGNED NULL,
            PRIMARY KEY (id), UNIQUE KEY uq_group_join_request (group_id, user_id),
            KEY idx_group_join_request_status (group_id, status, requested_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    } catch (PDOException $e) {
        error_log('Join request table setup failed: ' . $e->getMessage());
        jsonError('Join request storage unavailable', 500);
    }
}

if ('create' === $sub) {
    if ('POST' !== $method) jsonError('Method not allowed', 405);
    $auth = requireAuth(); $uid = (int)$auth['sub'];
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $groupId = (int)($body['group_id'] ?? 0);
    if (!$groupId) jsonError('group_id required');
    $dbh = getDb(); ensureAdminSchema($dbh); ensureInviteTokensTable($dbh);
    $stmt = $dbh->prepare('SELECT 1 FROM group_members gm JOIN `groups` g ON g.id = gm.group_id AND g.deleted_at IS NULL WHERE gm.group_id = :group_id AND gm.user_id = :user_id LIMIT 1');
    $stmt->execute([':group_id' => $groupId, ':user_id' => $uid]);
    if (!$stmt->fetch()) jsonError('Forbidden', 403);
    $dbh->prepare('DELETE FROM invite_tokens WHERE expires_at < UTC_TIMESTAMP()')->execute();
    $token = makeToken();
    $stmt = $dbh->prepare('INSERT INTO invite_tokens (token, group_id, created_by, expires_at) VALUES (:token, :group_id, :user_id, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . INVITE_TTL_HOURS . ' HOUR))');
    $stmt->execute([':token' => inviteTokenHash($token), ':group_id' => $groupId, ':user_id' => $uid]);
    jsonOut(['token' => $token, 'expires_in_hours' => INVITE_TTL_HOURS]);
}

if ('join' === $sub) {
    if ('GET' !== $method) jsonError('Method not allowed', 405);
    $auth = requireAuth(); $uid = (int)$auth['sub'];
    $token = trim((string)($_GET['t'] ?? ''));
    if (!preg_match('/^[0-9a-f]{64}$/i', $token)) jsonError('Invalid token', 400);
    $dbh = getDb(); ensureAdminSchema($dbh); ensureInviteTokensTable($dbh); ensureGroupJoinRequestsTable($dbh);
    $stmt = $dbh->prepare('SELECT it.group_id, g.name, g.created_by, (it.expires_at < UTC_TIMESTAMP()) AS is_expired FROM invite_tokens it JOIN `groups` g ON g.id = it.group_id AND g.deleted_at IS NULL WHERE it.token = :token LIMIT 1');
    $stmt->execute([':token' => inviteTokenHash($token)]);
    $group = $stmt->fetch();
    if (!$group) jsonError('Token not found', 404);
    if ((int)$group['is_expired'] === 1) jsonError('Token expired', 410);
    $groupId = (int)$group['group_id'];
    $member = $dbh->prepare('SELECT 1 FROM group_members WHERE group_id = :group_id AND user_id = :user_id LIMIT 1');
    $member->execute([':group_id' => $groupId, ':user_id' => $uid]);
    if ($member->fetch()) jsonOut(['status' => 'approved', 'id' => $groupId, 'name' => (string)$group['name'], 'created_by' => (int)$group['created_by'], 'can_rename' => (int)$group['created_by'] === $uid]);
    $stmt = $dbh->prepare('INSERT INTO group_join_requests (group_id, user_id, status, requested_at, resolved_at, resolved_by) VALUES (:group_id, :user_id, "pending", UTC_TIMESTAMP(), NULL, NULL) ON DUPLICATE KEY UPDATE status = "pending", requested_at = UTC_TIMESTAMP(), resolved_at = NULL, resolved_by = NULL');
    $stmt->execute([':group_id' => $groupId, ':user_id' => $uid]);
    jsonOut(['status' => 'pending', 'name' => (string)$group['name']]);
}

jsonError('Not found', 404);
