<?php
declare(strict_types=1);

require_once __DIR__ . '/../../../../secret/config.php';
require_once __DIR__ . '/../auth_helper.php';

$auth = requireAuth();
$uid  = (int)$auth['sub'];
$dbh  = getDb();
ensureAdminSchema($dbh);

$groupId = isset($_GET['group_id']) ? (int)$_GET['group_id'] : 0;
if (!$groupId) jsonError('group_id required');

if ('GET' === $method) {
    $stmt = $dbh->prepare(
        'SELECT g.created_by
           FROM `groups` g
           JOIN group_members gm ON gm.group_id = g.id
          WHERE g.id = :g AND g.deleted_at IS NULL AND gm.user_id = :u
          LIMIT 1'
    );
    $stmt->execute([':g' => $groupId, ':u' => $uid]);
    $creatorId = $stmt->fetchColumn();
    if (false === $creatorId) jsonError('Forbidden', 403);

    $stmt = $dbh->prepare(
        'SELECT l.action, l.item_name, COALESCE(l.quantity, 1) AS quantity, l.created_at,
                UNIX_TIMESTAMP(l.created_at) AS created_ts, u.username
           FROM activity_log l
           JOIN users u ON u.id = l.user_id
          WHERE l.group_id = :g
          ORDER BY l.created_at DESC
          LIMIT 100'
    );
    $stmt->execute([':g' => $groupId]);
    jsonOut(['items' => $stmt->fetchAll(), 'server_now' => time(), 'can_manage' => ((int)$creatorId === $uid)]);
}

if ('DELETE' === $method) {
    $stmt = $dbh->prepare('SELECT created_by FROM `groups` WHERE id = :g AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([':g' => $groupId]);
    $creatorId = $stmt->fetchColumn();
    if (false === $creatorId) jsonError('Group not found', 404);
    if ((int)$creatorId !== $uid) jsonError('Only the group creator can clear activity history', 403);

    $stmt = $dbh->prepare('DELETE FROM activity_log WHERE group_id = :g');
    $stmt->execute([':g' => $groupId]);
    jsonOut(['message' => 'Activity history cleared', 'deleted' => $stmt->rowCount()]);
}

jsonError('Method not allowed', 405);
