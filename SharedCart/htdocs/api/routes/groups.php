<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth_helper.php';

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

$auth = requireAuth();
$uid  = (int)$auth['sub'];
$dbh  = getDb();
ensureAdminSchema($dbh);
ensureGroupGovernanceSchema($dbh);
ensureGroupJoinRequestsTable($dbh);

// Group creator management panel.
// GET   /api/groups/{id}/management - return settings, members and active content.
// PATCH /api/groups/{id}/management - update creator-only group settings.
if ('management' === $sub && null !== $id && 'GET' === $method) {
    $stmt = $dbh->prepare(
        'SELECT id, name, created_by, notify_creator_on_item_taken, member_limit
           FROM `groups`
          WHERE id = :id
            AND deleted_at IS NULL
          LIMIT 1'
    );
    $stmt->execute([':id' => $id]);
    $group = $stmt->fetch();
    if (!$group) jsonError('Group not found', 404);
    if (!groupCanManage($dbh, $id, $uid)) jsonError('Only group managers can manage it', 403);

    $membersStmt = $dbh->prepare(
        'SELECT u.id, u.username, gm.joined_at, (u.id = g.created_by) AS is_creator,
                EXISTS(SELECT 1 FROM group_managers m WHERE m.group_id = gm.group_id AND m.user_id = gm.user_id) AS is_manager
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id AND u.deleted_at IS NULL
           JOIN `groups` g ON g.id = gm.group_id AND g.deleted_at IS NULL
          WHERE gm.group_id = :group_id
          ORDER BY is_creator DESC, gm.joined_at ASC, u.username ASC'
    );
    $membersStmt->execute([':group_id' => $id]);
    $members = array_map(static fn(array $member): array => [
        'id' => (int)$member['id'],
        'username' => (string)$member['username'],
        'joined_at' => $member['joined_at'],
        'is_creator' => (bool)$member['is_creator'],
    ], $membersStmt->fetchAll());

    $itemsStmt = $dbh->prepare(
        'SELECT i.id, i.name, i.is_completed, i.created_at,
                COALESCE(u.username, \'\') AS creator,
                COUNT(c.id) AS comment_count
           FROM grocery_items i
           LEFT JOIN users u
                  ON u.id = i.created_by
                 AND u.deleted_at IS NULL
           LEFT JOIN item_comments c
                  ON c.item_id = i.id
                 AND c.deleted_at IS NULL
          WHERE i.group_id = :group_id
            AND i.deleted_at IS NULL
          GROUP BY i.id, i.name, i.is_completed, i.created_at, u.username
          ORDER BY i.is_completed ASC, i.created_at DESC, i.id DESC'
    );
    $itemsStmt->execute([':group_id' => $id]);
    $items = array_map(static fn(array $item): array => [
        'id' => (int)$item['id'],
        'name' => (string)($item['name'] ?? ''),
        'is_completed' => (bool)$item['is_completed'],
        'created_at' => $item['created_at'],
        'creator' => (string)($item['creator'] ?? ''),
        'comment_count' => (int)$item['comment_count'],
    ], $itemsStmt->fetchAll());

    $requestsStmt = $dbh->prepare(
        'SELECT r.id, r.user_id, u.username, r.requested_at
           FROM group_join_requests r
           JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
          WHERE r.group_id = :group_id AND r.status = "pending"
          ORDER BY r.requested_at ASC, r.id ASC'
    );
    $requestsStmt->execute([':group_id' => $id]);
    $joinRequests = array_map(static fn(array $request): array => [
        'id' => (int)$request['id'],
        'user_id' => (int)$request['user_id'],
        'username' => (string)$request['username'],
        'requested_at' => $request['requested_at'],
    ], $requestsStmt->fetchAll());

    jsonOut([
        'group' => [
            'id' => (int)$group['id'],
            'name' => (string)$group['name'],
            'created_by' => (int)$group['created_by'],
            'notify_creator_on_item_taken' => (bool)$group['notify_creator_on_item_taken'],
            'member_limit' => (int)$group['member_limit'],
        ],
        'members' => $members,
        'items' => $items,
        'join_requests' => $joinRequests,
    ]);
}

if ('join-requests' === $sub && null !== $id && 'POST' === $method) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $requestId = (int)($body['request_id'] ?? 0);
    $action = (string)($body['action'] ?? '');
    if (!$requestId || !in_array($action, ['approve', 'reject'], true)) jsonError('Invalid join request action');

    $stmt = $dbh->prepare('SELECT created_by FROM `groups` WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $group = $stmt->fetch();
    if (!$group) jsonError('Group not found', 404);
    if (!groupCanManage($dbh, $id, $uid)) jsonError('Only group managers can manage join requests', 403);

    $dbh->beginTransaction();
    try {
        $stmt = $dbh->prepare('SELECT user_id FROM group_join_requests WHERE id = :request_id AND group_id = :group_id AND status = "pending" FOR UPDATE');
        $stmt->execute([':request_id' => $requestId, ':group_id' => $id]);
        $request = $stmt->fetch();
        if (!$request) jsonError('Join request not found', 404);
        $status = 'approve' === $action ? 'approved' : 'rejected';
        $stmt = $dbh->prepare('UPDATE group_join_requests SET status = :status, resolved_at = UTC_TIMESTAMP(), resolved_by = :resolved_by WHERE id = :request_id');
        $stmt->execute([':status' => $status, ':resolved_by' => $uid, ':request_id' => $requestId]);
        if ('approve' === $action) {
            $stmt = $dbh->prepare('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (:group_id, :user_id)');
            $stmt->execute([':group_id' => $id, ':user_id' => (int)$request['user_id']]);
        }
        $dbh->commit();
    } catch (Throwable $e) {
        if ($dbh->inTransaction()) $dbh->rollBack();
        throw $e;
    }
    jsonOut(['message' => 'Join request updated']);
}

if ('management' === $sub && null !== $id && 'PATCH' === $method) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (!array_key_exists('notify_creator_on_item_taken', $body) && !array_key_exists('member_limit', $body)) jsonError('Group settings required');

    $stmt = $dbh->prepare(
        'SELECT created_by
           FROM `groups`
          WHERE id = :id
            AND deleted_at IS NULL
          LIMIT 1'
    );
    $stmt->execute([':id' => $id]);
    $group = $stmt->fetch();
    if (!$group) jsonError('Group not found', 404);
    if (!groupCanManage($dbh, $id, $uid)) jsonError('Only group managers can manage it', 403);

    $enabled = array_key_exists('notify_creator_on_item_taken', $body)
        ? filter_var($body['notify_creator_on_item_taken'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
        : null;
    if (array_key_exists('notify_creator_on_item_taken', $body) && null === $enabled) jsonError('Invalid notification setting');
    $limit = array_key_exists('member_limit', $body) ? (int)$body['member_limit'] : null;
    if (null !== $limit && ($limit < 0 || $limit > 1000)) jsonError('Invalid member limit');

    $stmt = $dbh->prepare(
        'UPDATE `groups` SET
            notify_creator_on_item_taken = COALESCE(:enabled, notify_creator_on_item_taken),
            member_limit = COALESCE(:member_limit, member_limit)
          WHERE id = :id AND deleted_at IS NULL'
    );
    $stmt->execute([
        ':enabled' => null === $enabled ? null : ($enabled ? 1 : 0),
        ':member_limit' => $limit,
        ':id' => $id,
    ]);

    jsonOut([
        'message' => 'Group management settings updated',
        'notify_creator_on_item_taken' => $enabled,
        'member_limit' => $limit,
    ]);
}

if ('managers' === $sub && null !== $id && 'POST' === $method) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $targetUserId = (int)($body['user_id'] ?? 0);
    $isManager = filter_var($body['is_manager'] ?? null, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if (!$targetUserId || null === $isManager) jsonError('Invalid manager setting');
    $owner = $dbh->prepare('SELECT created_by FROM `groups` WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $owner->execute([':id' => $id]);
    if ((int)$owner->fetchColumn() !== $uid) jsonError('Only the group creator can manage managers', 403);
    if ($targetUserId === $uid) jsonError('The group creator is already a manager', 409);
    $member = $dbh->prepare('SELECT 1 FROM group_members WHERE group_id = :group_id AND user_id = :user_id LIMIT 1');
    $member->execute([':group_id' => $id, ':user_id' => $targetUserId]);
    if (!$member->fetchColumn()) jsonError('Member not found', 404);
    if ($isManager) {
        $stmt = $dbh->prepare('INSERT IGNORE INTO group_managers (group_id, user_id, granted_by) VALUES (:group_id, :user_id, :granted_by)');
        $stmt->execute([':group_id' => $id, ':user_id' => $targetUserId, ':granted_by' => $uid]);
    } else {
        $stmt = $dbh->prepare('DELETE FROM group_managers WHERE group_id = :group_id AND user_id = :user_id');
        $stmt->execute([':group_id' => $id, ':user_id' => $targetUserId]);
    }
    jsonOut(['message' => 'Manager setting updated']);
}

if ('members' === $sub && null !== $id && 'GET' === $method) {
    $stmt = $dbh->prepare(
        'SELECT g.created_by
           FROM `groups` g
           JOIN group_members viewer ON viewer.group_id = g.id
          WHERE g.id = :group_id
            AND g.deleted_at IS NULL
            AND viewer.user_id = :viewer
          LIMIT 1'
    );
    $stmt->execute([':viewer' => $uid, ':group_id' => $id]);
    $group = $stmt->fetch();
    if (!$group) jsonError('Group not found or access denied', 404);

    $creatorId = (int)$group['created_by'];
    $stmt = $dbh->prepare(
        'SELECT u.id, u.username, gm.joined_at, (u.id = g.created_by) AS is_creator
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id AND u.deleted_at IS NULL
           JOIN `groups` g ON g.id = gm.group_id AND g.deleted_at IS NULL
          WHERE gm.group_id = :group_id
          ORDER BY is_creator DESC, gm.joined_at ASC, u.username ASC'
    );
    $stmt->execute([':group_id' => $id]);
    $members = array_map(static fn(array $member): array => [
        'id' => (int)$member['id'],
        'username' => (string)$member['username'],
        'joined_at' => $member['joined_at'],
        'is_creator' => (bool)$member['is_creator'],
    ], $stmt->fetchAll());

    $joinRequests = [];
    if ($creatorId === $uid) {
        $requestsStmt = $dbh->prepare(
            'SELECT r.id, r.user_id, u.username, r.requested_at
               FROM group_join_requests r
               JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
              WHERE r.group_id = :group_id AND r.status = "pending"
              ORDER BY r.requested_at ASC, r.id ASC'
        );
        $requestsStmt->execute([':group_id' => $id]);
        $joinRequests = array_map(static fn(array $request): array => [
            'id' => (int)$request['id'],
            'user_id' => (int)$request['user_id'],
            'username' => (string)$request['username'],
            'requested_at' => $request['requested_at'],
        ], $requestsStmt->fetchAll());
    }

    jsonOut(['members' => $members, 'can_manage' => $creatorId === $uid, 'join_requests' => $joinRequests]);
}

if ('members' === $sub && null !== $id && 'DELETE' === $method) {
    $targetUserId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    if (!$targetUserId) jsonError('user_id required');

    $stmt = $dbh->prepare('SELECT created_by FROM `groups` WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $group = $stmt->fetch();
    if (!$group) jsonError('Group not found', 404);

    $creatorId = (int)$group['created_by'];
    if (!groupCanManage($dbh, $id, $uid)) jsonError('Only group managers can remove members', 403);
    if ($targetUserId === $creatorId) jsonError('The group creator cannot be removed', 400);

    $stmt = $dbh->prepare('DELETE FROM group_members WHERE group_id = :group_id AND user_id = :user_id');
    $stmt->execute([':group_id' => $id, ':user_id' => $targetUserId]);
    if (0 === $stmt->rowCount()) jsonError('Member not found', 404);
    jsonOut(['message' => 'Member removed']);
}

if ('join' === $sub && null !== $id && 'POST' === $method) {
    jsonError('Join requests require a valid invite link', 403);
}

if (null !== $id && 'DELETE' === $method && '' === $sub) {
    $stmt = $dbh->prepare('SELECT created_by FROM `groups` WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $group = $stmt->fetch();
    if (!$group) jsonError('Group not found', 404);
    if ((int)$group['created_by'] !== $uid) jsonError('Only the group creator can delete it', 403);

    $stmt = $dbh->prepare('UPDATE `groups` SET deleted_at = UTC_TIMESTAMP(), deleted_by = :uid WHERE id = :id AND deleted_at IS NULL');
    $stmt->execute([':uid' => $uid, ':id' => $id]);
    jsonOut(['message' => 'Group deleted']);
}

if ('leave' === $sub && null !== $id && 'POST' === $method) {
    $stmt = $dbh->prepare('SELECT created_by FROM `groups` WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $group = $stmt->fetch();
    if (!$group) jsonError('Group not found', 404);
    if ((int)$group['created_by'] === $uid) jsonError('The group creator cannot leave the group', 403);

    $stmt = $dbh->prepare('DELETE FROM group_members WHERE group_id = :group_id AND user_id = :user_id');
    $stmt->execute([':group_id' => $id, ':user_id' => $uid]);
    if (0 === $stmt->rowCount()) jsonError('Member not found', 404);
    jsonOut(['message' => 'Left group']);
}

if (null !== $id && 'PATCH' === $method && '' === $sub) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $name = trim((string)($body['name'] ?? ''));
    if ('' === $name) jsonError('Group name required');
    if (strlen($name) > MAX_GROUP_NAME_LEN) jsonError('Name too long');
    assertContentAllowed($dbh, $name, $uid, 'group_name', 'group', $id);

    $stmt = $dbh->prepare('SELECT created_by FROM `groups` WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $group = $stmt->fetch();
    if (!$group) jsonError('Group not found', 404);
    if (!groupCanManage($dbh, $id, $uid)) jsonError('Only group managers can rename it', 403);

    $stmt = $dbh->prepare('UPDATE `groups` SET name = :name WHERE id = :id');
    $stmt->execute([':name' => $name, ':id' => $id]);
    jsonOut(['id' => $id, 'name' => $name, 'created_by' => $uid, 'can_rename' => true]);
}

if ('GET' === $method && null === $id) {
    $stmt = $dbh->prepare(
        'SELECT DISTINCT g.id, g.name, g.created_at, g.created_by,
                (g.created_by = :viewer OR EXISTS(SELECT 1 FROM group_managers m WHERE m.group_id = g.id AND m.user_id = :manager_viewer)) AS can_rename
           FROM `groups` g
           JOIN group_members m ON m.group_id = g.id
          WHERE m.user_id = :member
            AND g.deleted_at IS NULL
          ORDER BY g.created_at DESC'
    );
    $stmt->execute([':viewer' => $uid, ':manager_viewer' => $uid, ':member' => $uid]);
    $groups = array_map(static function (array $group): array {
        $group['id'] = (int)$group['id'];
        $group['created_by'] = (int)$group['created_by'];
        $group['can_rename'] = (bool)$group['can_rename'];
        return $group;
    }, $stmt->fetchAll());
    jsonOut(array_values($groups));
}

if ('POST' === $method && null === $id) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $name = trim((string)($body['name'] ?? ''));
    if ('' === $name) jsonError('Group name required');
    if (strlen($name) > MAX_GROUP_NAME_LEN) jsonError('Name too long');
    assertContentAllowed($dbh, $name, $uid, 'group_name', 'group');

    $dbh->beginTransaction();
    try {
        $stmt = $dbh->prepare('INSERT INTO `groups` (name, created_by) VALUES (:name, :uid)');
        $stmt->execute([':name' => $name, ':uid' => $uid]);
        $groupId = (int)$dbh->lastInsertId();
        $stmt = $dbh->prepare('INSERT INTO group_members (group_id, user_id) VALUES (:g, :u)');
        $stmt->execute([':g' => $groupId, ':u' => $uid]);
        $dbh->commit();
    } catch (Throwable $e) {
        if ($dbh->inTransaction()) $dbh->rollBack();
        throw $e;
    }
    jsonOut(['id' => $groupId, 'name' => $name, 'created_by' => $uid, 'can_rename' => true], 201);
}

jsonError('Method not allowed', 405);
