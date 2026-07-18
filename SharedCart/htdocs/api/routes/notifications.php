<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth_helper.php';

$auth = requireAuth();
$uid  = (int)$auth['sub'];
$dbh  = getDb();
ensureAdminSchema($dbh);
ensureNotificationActionColumns($dbh);

$groupId = isset($_GET['group_id']) ? (int)$_GET['group_id'] : 0;
if ($groupId <= 0) jsonError('group_id required');

$stmt = $dbh->prepare(
    'SELECT 1
       FROM group_members gm
       JOIN `groups` g ON g.id = gm.group_id AND g.deleted_at IS NULL
      WHERE gm.group_id = :group_id
        AND gm.user_id = :user_id
      LIMIT 1'
);
$stmt->execute([':group_id' => $groupId, ':user_id' => $uid]);
if (!$stmt->fetchColumn()) jsonError('Group not found or access denied', 404);

if (null !== $id && 'PATCH' === $method) {
    $stmt = $dbh->prepare(
        'UPDATE notifications
            SET is_read = 1
          WHERE id = :id
            AND user_id = :uid
            AND item_id IN (
                SELECT gi.id FROM grocery_items gi WHERE gi.group_id = :group_id
            )'
    );
    $stmt->execute([':id' => $id, ':uid' => $uid, ':group_id' => $groupId]);
    jsonOut(['message' => 'Marked read']);
}

if (null === $id && 'DELETE' === $method) {
    $stmt = $dbh->prepare(
        'DELETE FROM notifications
          WHERE user_id = :uid
            AND item_id IN (
                SELECT gi.id FROM grocery_items gi WHERE gi.group_id = :group_id
            )'
    );
    $stmt->execute([':uid' => $uid, ':group_id' => $groupId]);
    jsonOut(['message' => 'Notifications cleared', 'deleted' => $stmt->rowCount()]);
}

if ('GET' === $method) {
    $stmt = $dbh->prepare(
        "SELECT n.id, n.created_at, n.is_read, n.event_type, n.amount,
                i.group_id,
                COALESCE(NULLIF(i.name, ''), 'פריט ללא שם') AS item_name,
                COALESCE(NULLIF(a.username, ''), 'משתמש') AS actor
           FROM notifications n
           JOIN grocery_items i ON i.id = n.item_id AND i.group_id = :group_id
           LEFT JOIN users a ON a.id = n.actor_id
          WHERE n.user_id = :uid
          ORDER BY n.created_at DESC
          LIMIT 50"
    );
    $stmt->execute([':group_id' => $groupId, ':uid' => $uid]);
    jsonOut(array_values($stmt->fetchAll()));
}

jsonError('Method not allowed', 405);
