<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth_helper.php';

$auth = requireAuth();
$uid  = (int)$auth['sub'];
$dbh  = getDb();
ensureAdminSchema($dbh);

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

    jsonOut(['members' => $members, 'can_manage' => $creatorId === $uid]);
}

if ('members' === $sub && null !== $id && 'DELETE' === $method) {
    $targetUserId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    if (!$targetUserId) jsonError('user_id required');

    $stmt = $dbh->prepare('SELECT created_by FROM `groups` WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $group = $stmt->fetch();
    if (!$group) jsonError('Group not found', 404);

    $creatorId = (int)$group['created_by'];
    if ($creatorId !== $uid) jsonError('Only the group creator can remove members', 403);
    if ($targetUserId === $creatorId) jsonError('The group creator cannot be removed', 400);

    $stmt = $dbh->prepare('DELETE FROM group_members WHERE group_id = :group_id AND user_id = :user_id');
    $stmt->execute([':group_id' => $id, ':user_id' => $targetUserId]);
    if (0 === $stmt->rowCount()) jsonError('Member not found', 404);
    jsonOut(['message' => 'Member removed']);
}

if ('join' === $sub && null !== $id && 'POST' === $method) {
    $stmt = $dbh->prepare('SELECT id, name, created_by FROM `groups` WHERE id = :id AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':id' => $id]);
    $group = $stmt->fetch();
    if (!$group) jsonError('Group not found', 404);

    $stmt = $dbh->prepare('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (:g, :u)');
    $stmt->execute([':g' => $id, ':u' => $uid]);
    jsonOut([
        'id' => (int)$group['id'],
        'name' => (string)$group['name'],
        'created_by' => (int)$group['created_by'],
        'can_rename' => (int)$group['created_by'] === $uid,
    ]);
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
    if ((int)$group['created_by'] !== $uid) jsonError('Only the group creator can rename it', 403);

    $stmt = $dbh->prepare('UPDATE `groups` SET name = :name WHERE id = :id');
    $stmt->execute([':name' => $name, ':id' => $id]);
    jsonOut(['id' => $id, 'name' => $name, 'created_by' => $uid, 'can_rename' => true]);
}

if ('GET' === $method && null === $id) {
    $stmt = $dbh->prepare(
        'SELECT DISTINCT g.id, g.name, g.created_at, g.created_by, (g.created_by = :viewer) AS can_rename
           FROM `groups` g
           JOIN group_members m ON m.group_id = g.id
          WHERE m.user_id = :member
            AND g.deleted_at IS NULL
          ORDER BY g.created_at DESC'
    );
    $stmt->execute([':viewer' => $uid, ':member' => $uid]);
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
