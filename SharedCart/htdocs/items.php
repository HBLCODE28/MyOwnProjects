<?php
// Items routes: GET/POST /api/items?group_id=X, PATCH /api/items/{id}/complete, DELETE /api/items/{id}
require_once __DIR__ . '/../../secret/config.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../email_helper.php';

$auth = requireAuth();
$uid  = $auth['sub'];
$dbh  = getDb();
ensureAdminSchema($dbh);
try {
    ensureItemSharingSchema($dbh);
} catch (Throwable $e) {
    error_log('Item sharing schema init failed: ' . $e->getMessage());
}

function isMember(PDO $dbh, int $groupId, int $uid): bool {
    // Check if user belongs to a group.
    // Input: PDO instance, group ID, user ID.
    // Output: bool.
    $stmt = $dbh->prepare(
        'SELECT 1 FROM group_members gm JOIN `groups` g ON g.id = gm.group_id AND g.deleted_at IS NULL WHERE gm.group_id = :g AND gm.user_id = :u LIMIT 1'
    );
    $stmt->execute([':g' => $groupId, ':u' => $uid]);
    return (bool)$stmt->fetch();
}

function logActivity(PDO $dbh, int $groupId, int $userId, ?int $itemId, string $action, string $itemName, int $quantity = 1): void {
    // Insert a row into activity_log.
    // Input: PDO, group ID, user ID, item ID or null, action string, item name snapshot.
    // Output: void.
    $qty = max(1, min(MAX_QUANTITY, $quantity));
    $itemName = trim($itemName);
    if ('' === $itemName) {
        $itemName = 'פריט ללא שם';
    }
    try {
        $stmt = $dbh->prepare(
            'INSERT INTO activity_log (group_id, user_id, item_id, action, item_name, quantity)
             VALUES (:g, :u, :i, :a, :n, :q)'
        );
        $stmt->execute([':g' => $groupId, ':u' => $userId, ':i' => $itemId, ':a' => $action, ':n' => $itemName, ':q' => $qty]);
    } catch (PDOException $e) {
        $stmt = $dbh->prepare(
            'INSERT INTO activity_log (group_id, user_id, item_id, action, item_name)
             VALUES (:g, :u, :i, :a, :n)'
        );
        $stmt->execute([':g' => $groupId, ':u' => $userId, ':i' => $itemId, ':a' => $action, ':n' => $itemName]);
    }
}

function purgeExpiredCompletedItems(PDO $dbh, int $groupId): int {
    // Remove completed items that have stayed checked for a full day.
    // This keeps the shared list tidy without clearing the rest of the list.
    $stmt = $dbh->prepare(
        'UPDATE grocery_items
            SET deleted_at = UTC_TIMESTAMP(), deleted_by = NULL
          WHERE group_id = :g
            AND deleted_at IS NULL
            AND is_completed = 1
            AND completed_at IS NOT NULL
            AND completed_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ' . (int)COMPLETED_ITEM_RETENTION_HOURS . ' HOUR)'
    );
    $stmt->bindValue(':g', $groupId, PDO::PARAM_INT);
    $stmt->execute();

    return $stmt->rowCount();
}

function fetchItemContext(PDO $dbh, int $itemId): ?array {
    $stmt = $dbh->prepare(
        'SELECT i.id, i.group_id, i.created_by, i.name, i.image_path, i.quantity AS base_quantity, i.is_completed,
                g.name AS group_name,
                u.username AS creator_name
           FROM grocery_items i
           JOIN `groups` g ON g.id = i.group_id AND g.deleted_at IS NULL
           JOIN users u ON u.id = i.created_by AND u.deleted_at IS NULL
          WHERE i.id = :id
            AND i.deleted_at IS NULL
          LIMIT 1'
    );
    $stmt->execute([':id' => $itemId]);
    $item = $stmt->fetch();

    return $item ?: null;
}

function fetchContributionSummary(PDO $dbh, int $itemId, int $uid): array {
    $stmt = $dbh->prepare(
        'SELECT COALESCE(SUM(quantity), 0) AS total_extra
           FROM item_contributions
          WHERE item_id = :id'
    );
    $stmt->execute([':id' => $itemId]);
    $totalExtra = (int)($stmt->fetchColumn() ?: 0);

    $stmt = $dbh->prepare(
        'SELECT quantity
           FROM item_contributions
          WHERE item_id = :id AND user_id = :uid
          LIMIT 1'
    );
    $stmt->execute([':id' => $itemId, ':uid' => $uid]);
    $myContribution = (int)($stmt->fetchColumn() ?: 0);

    return [
        'total_extra' => $totalExtra,
        'my_contribution' => $myContribution,
    ];
}

function fetchItemCommentSummary(PDO $dbh, int $itemId): array {
    $stmt = $dbh->prepare(
        'SELECT c.body, c.created_at, UNIX_TIMESTAMP(c.created_at) AS created_ts, u.username
           FROM item_comments c
           JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL
          WHERE c.item_id = :id
            AND c.deleted_at IS NULL
          ORDER BY c.id DESC
          LIMIT 1'
    );
    $stmt->execute([':id' => $itemId]);
    $comment = $stmt->fetch();

    $countStmt = $dbh->prepare('SELECT COUNT(*) FROM item_comments WHERE item_id = :id AND deleted_at IS NULL');
    $countStmt->execute([':id' => $itemId]);

    return [
        'comment_count' => (int)($countStmt->fetchColumn() ?: 0),
        'latest_comment_body' => $comment ? (string)$comment['body'] : null,
        'latest_comment_created_at' => $comment ? (string)$comment['created_at'] : null,
        'latest_comment_ts' => $comment ? (int)$comment['created_ts'] : null,
        'latest_comment_user' => $comment ? (string)$comment['username'] : null,
    ];
}

function fetchItemSuggestions(PDO $dbh, int $groupId): array {
    $stmt = $dbh->prepare(
        'SELECT name
           FROM (
                SELECT i.name AS name
                  FROM grocery_items i
                 WHERE i.group_id = :g_items AND i.deleted_at IS NULL
                UNION
                SELECT al.item_name AS name
                  FROM activity_log al
                 WHERE al.group_id = :g_activity
           ) names
          ORDER BY name ASC
          LIMIT 12'
    );
    $stmt->execute([
        ':g_items' => $groupId,
        ':g_activity' => $groupId,
    ]);
    return array_values(array_unique(array_filter(array_map(
        static fn($row) => trim((string)($row['name'] ?? '')),
        $stmt->fetchAll()
    ))));
}

function notifyCreatorAndContributors(PDO $dbh, array $item, int $actorId, string $eventType, int $amount = 1): void {
    $recipientIds = [];

    if ((int)$item['created_by'] !== $actorId) {
        $recipientIds[(int)$item['created_by']] = true;
    }

    $stmt = $dbh->prepare(
        'SELECT DISTINCT user_id
           FROM item_contributions
          WHERE item_id = :id
            AND user_id <> :actor'
    );
    $stmt->execute([':id' => (int)$item['id'], ':actor' => $actorId]);
    foreach ($stmt->fetchAll() as $row) {
        $recipientIds[(int)$row['user_id']] = true;
    }

    foreach (array_keys($recipientIds) as $recipientId) {
        insertNotification($dbh, (int)$recipientId, (int)$item['id'], $actorId, $eventType, $amount);
    }
}

function getItemTotals(PDO $dbh, int $itemId, int $uid): ?array {
    $item = fetchItemContext($dbh, $itemId);
    if (!$item) {
        return null;
    }

    $summary = fetchContributionSummary($dbh, $itemId, $uid);

    $item['base_quantity'] = (int)$item['base_quantity'];
    $item['image_path'] = (string)($item['image_path'] ?? '');
    $item['total_extra'] = $summary['total_extra'];
    $item['my_contribution_qty'] = $summary['my_contribution'];
    $item['quantity'] = $item['base_quantity'] + $summary['total_extra'];
    $item['total_limit'] = MAX_ITEM_TOTAL_QTY;
    $item['total_remaining'] = max(0, MAX_ITEM_TOTAL_QTY - $item['quantity']);
    $comments = fetchItemCommentSummary($dbh, $itemId);
    $item['comment_count'] = $comments['comment_count'];
    $item['latest_comment_body'] = $comments['latest_comment_body'];
    $item['latest_comment_created_at'] = $comments['latest_comment_created_at'];
    $item['latest_comment_ts'] = $comments['latest_comment_ts'];
    $item['latest_comment_user'] = $comments['latest_comment_user'];

    return $item;
}

function fetchItemsFallback(PDO $dbh, int $groupId, int $uid): array {
    $stmt = $dbh->prepare(
        'SELECT i.id, i.name, i.image_path, i.quantity AS base_quantity,
                i.quantity AS quantity,
                i.is_completed,
                i.created_at, i.completed_at,
                UNIX_TIMESTAMP(i.created_at) AS created_ts,
                CASE WHEN i.completed_at IS NULL THEN NULL ELSE UNIX_TIMESTAMP(i.completed_at) END AS completed_ts,
                i.created_by,
                u.username AS creator,
                c.username AS completer,
                0 AS my_contribution_qty,
                ' . (int)MAX_ITEM_TOTAL_QTY . ' AS total_limit,
                GREATEST(0, ' . (int)MAX_ITEM_TOTAL_QTY . ' - i.quantity) AS total_remaining,
                (SELECT COALESCE(SUM(
                            CASE
                                WHEN al.action = \'completed\' THEN 3
                                WHEN al.action IN (\'added\', \'deleted\') THEN 2
                                WHEN al.action IN (\'contribution_added\', \'contribution_removed\') THEN 1
                                ELSE 0
                            END
                        ), 0)
                   FROM activity_log al
                  WHERE al.group_id = i.group_id
                    AND (
                        (TRIM(i.name) <> \'\' AND al.item_name = i.name)
                        OR (TRIM(i.name) = \'\' AND al.item_id = i.id)
                    )) AS usage_count
           FROM grocery_items i
           JOIN users u ON u.id = i.created_by AND u.deleted_at IS NULL
           LEFT JOIN users c ON c.id = i.completed_by AND c.deleted_at IS NULL
          WHERE i.group_id = :g
            AND i.deleted_at IS NULL
          ORDER BY i.is_completed ASC, usage_count DESC, i.created_at DESC'
    );
    $stmt->execute([':g' => $groupId]);
    $items = $stmt->fetchAll();

    // The primary list query may fall back when an optional column or aggregate
    // is unavailable. Enrich each row separately so quantities and comments
    // still reflect the current database state.
    foreach ($items as &$item) {
        $itemId = (int)$item['id'];
        $baseQuantity = (int)($item['base_quantity'] ?? $item['quantity'] ?? 0);

        try {
            $summary = fetchContributionSummary($dbh, $itemId, $uid);
            $item['total_extra'] = (int)$summary['total_extra'];
            $item['my_contribution_qty'] = (int)$summary['my_contribution'];
            $item['quantity'] = $baseQuantity + (int)$summary['total_extra'];
            $item['total_remaining'] = max(0, MAX_ITEM_TOTAL_QTY - (int)$item['quantity']);
        } catch (Throwable $e) {
            error_log('Fallback contribution summary failed for item ' . $itemId . ': ' . $e->getMessage());
            $item['total_extra'] = 0;
            $item['my_contribution_qty'] = 0;
            $item['quantity'] = $baseQuantity;
            $item['total_remaining'] = max(0, MAX_ITEM_TOTAL_QTY - $baseQuantity);
        }

        try {
            $comments = fetchItemCommentSummary($dbh, $itemId);
            $item['comment_count'] = $comments['comment_count'];
            $item['latest_comment_body'] = $comments['latest_comment_body'];
            $item['latest_comment_created_at'] = $comments['latest_comment_created_at'];
            $item['latest_comment_ts'] = $comments['latest_comment_ts'];
            $item['latest_comment_user'] = $comments['latest_comment_user'];
        } catch (Throwable $e) {
            error_log('Fallback comment summary failed for item ' . $itemId . ': ' . $e->getMessage());
            $item['comment_count'] = 0;
            $item['latest_comment_body'] = null;
            $item['latest_comment_created_at'] = null;
            $item['latest_comment_ts'] = null;
            $item['latest_comment_user'] = null;
        }
    }
    unset($item);

    return $items;
}

// POST /api/items/{id}/contribution
// DELETE /api/items/{id}/contribution
if ('contribution' === $sub && null !== $id && ('POST' === $method || 'DELETE' === $method)) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $qty = max(1, min(MAX_QUANTITY, (int)($body['quantity'] ?? 1)));

    $item = fetchItemContext($dbh, $id);
    if (!$item) jsonError('Item not found', 404);
    if (!isMember($dbh, (int)$item['group_id'], $uid)) jsonError('Forbidden', 403);
    if ((int)$item['is_completed'] === 1) jsonError('Item already completed', 400);

    $current = fetchContributionSummary($dbh, $id, $uid);
    $currentUserQty = $current['my_contribution'];

    $dbh->beginTransaction();

    if ('POST' === $method) {
        $currentTotal = (int)$item['base_quantity'] + $current['total_extra'];
        $remaining = MAX_ITEM_TOTAL_QTY - $currentTotal;
        if ($remaining <= 0 || $qty > $remaining) {
            if ($dbh->inTransaction()) $dbh->rollBack();
            jsonError('Contribution limit reached', 400);
        }

        $stmt = $dbh->prepare(
            'INSERT INTO item_contributions (item_id, user_id, quantity)
             VALUES (:i, :u, :q)
             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)'
        );
        $stmt->execute([':i' => $id, ':u' => $uid, ':q' => $qty]);

        logActivity($dbh, (int)$item['group_id'], $uid, $id, 'contribution_added', $item['name'], $qty);
        if ((int)$item['created_by'] !== $uid) {
            insertNotification($dbh, (int)$item['created_by'], (int)$item['id'], $uid, 'contribution_added', $qty);
        }
    } else {
        $isCreator = (int)$item['created_by'] === (int)$uid;

        if ($isCreator) {
            // The item creator manages the total quantity. Keep at least one unit
            // so decreasing quantity never deletes the item itself.
            $currentTotal = (int)$item['base_quantity'] + (int)$current['total_extra'];
            if ($qty > max(0, $currentTotal - 1)) {
                if ($dbh->inTransaction()) $dbh->rollBack();
                jsonError('Item quantity cannot be lower than 1', 400);
            }

            $remainingToRemove = $qty;

            // Remove the creator's own added quantity first.
            if ($remainingToRemove > 0 && $currentUserQty > 0) {
                $remove = min($remainingToRemove, $currentUserQty);
                if ($remove === $currentUserQty) {
                    $stmt = $dbh->prepare('DELETE FROM item_contributions WHERE item_id = :i AND user_id = :u');
                    $stmt->execute([':i' => $id, ':u' => $uid]);
                } else {
                    $stmt = $dbh->prepare(
                        'UPDATE item_contributions SET quantity = quantity - :q WHERE item_id = :i AND user_id = :u'
                    );
                    $stmt->execute([':i' => $id, ':u' => $uid, ':q' => $remove]);
                }
                $remainingToRemove -= $remove;
            }

            // The creator may also remove quantity added by other members.
            if ($remainingToRemove > 0) {
                $stmt = $dbh->prepare(
                    'SELECT user_id, quantity
                       FROM item_contributions
                      WHERE item_id = :i AND user_id <> :u
                      ORDER BY quantity DESC, user_id ASC'
                );
                $stmt->execute([':i' => $id, ':u' => $uid]);
                foreach ($stmt->fetchAll() as $contribution) {
                    if ($remainingToRemove <= 0) break;
                    $contributorId = (int)$contribution['user_id'];
                    $contributorQty = (int)$contribution['quantity'];
                    $remove = min($remainingToRemove, $contributorQty);

                    if ($remove === $contributorQty) {
                        $delete = $dbh->prepare('DELETE FROM item_contributions WHERE item_id = :i AND user_id = :u');
                        $delete->execute([':i' => $id, ':u' => $contributorId]);
                    } else {
                        $update = $dbh->prepare(
                            'UPDATE item_contributions SET quantity = quantity - :q WHERE item_id = :i AND user_id = :u'
                        );
                        $update->execute([':i' => $id, ':u' => $contributorId, ':q' => $remove]);
                    }
                    $remainingToRemove -= $remove;
                }
            }

            // If no added quantity remains, decrease the creator's original base quantity.
            if ($remainingToRemove > 0) {
                $newBaseQuantity = max(1, (int)$item['base_quantity'] - $remainingToRemove);
                $stmt = $dbh->prepare('UPDATE grocery_items SET quantity = :q WHERE id = :id');
                $stmt->execute([':q' => $newBaseQuantity, ':id' => $id]);
                $remainingToRemove = 0;
            }
        } else {
            // Other members may only remove the quantity they personally added.
            if ($currentUserQty < $qty) {
                if ($dbh->inTransaction()) $dbh->rollBack();
                jsonError('You can only remove your own added quantity', 400);
            }

            if ($currentUserQty === $qty) {
                $stmt = $dbh->prepare(
                    'DELETE FROM item_contributions WHERE item_id = :i AND user_id = :u'
                );
                $stmt->execute([':i' => $id, ':u' => $uid]);
            } else {
                $stmt = $dbh->prepare(
                    'UPDATE item_contributions
                        SET quantity = quantity - :q
                      WHERE item_id = :i AND user_id = :u'
                );
                $stmt->execute([':i' => $id, ':u' => $uid, ':q' => $qty]);
            }
        }

        logActivity($dbh, (int)$item['group_id'], $uid, $id, 'contribution_removed', $item['name'], $qty);
        if ((int)$item['created_by'] !== $uid) {
            insertNotification($dbh, (int)$item['created_by'], (int)$item['id'], $uid, 'contribution_removed', $qty);
        }
    }

    $dbh->commit();
    $updated = getItemTotals($dbh, $id, $uid);
    jsonOut([
        'message' => 'Contribution updated',
        'item' => $updated,
    ]);
}

// PATCH /api/items/{id}/complete
// PATCH /api/items/{id}/uncomplete
if ('uncomplete' === $sub && null !== $id && 'PATCH' === $method) {
    $stmt = $dbh->prepare(
        'SELECT group_id, is_completed FROM grocery_items WHERE id = :id LIMIT 1'
    );
    $stmt->execute([':id' => $id]);
    $item = $stmt->fetch();

    if (!$item) jsonError('Item not found', 404);
    if (!isMember($dbh, (int)$item['group_id'], $uid)) jsonError('Forbidden', 403);
    if (!$item['is_completed']) jsonError('Not completed');

    $stmt = $dbh->prepare(
        'UPDATE grocery_items SET is_completed=0, completed_by=NULL, completed_at=NULL WHERE id=:id'
    );
    $stmt->execute([':id' => $id]);
    jsonOut(['message' => 'Uncompleted']);
}

if ('complete' === $sub && null !== $id && 'PATCH' === $method) {
    $item = fetchItemContext($dbh, $id);

    if (!$item) jsonError('Item not found', 404);
    if (!isMember($dbh, (int)$item['group_id'], $uid)) jsonError('Forbidden', 403);
    if ((int)$item['is_completed'] === 1) jsonError('Already completed');

    $dbh->beginTransaction();

    $stmt = $dbh->prepare(
        'UPDATE grocery_items
            SET is_completed = 1, completed_by = :uid, completed_at = NOW()
          WHERE id = :id'
    );
    $stmt->execute([':uid' => $uid, ':id' => $id]);

    $emailPayload = null;
    if ((int)$item['created_by'] !== $uid) {
        $actor = $dbh->prepare('SELECT username FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1');
        $actor->execute([':id' => $uid]);
        $actorName = (string)($actor->fetchColumn() ?: '');

        $emailPayload = [
            'to' => null,
            'recipient_name' => '',
            'actor_name' => $actorName,
            'item_name' => (string)$item['name'],
            'group_name' => (string)$item['group_name'],
        ];

        $recipient = $dbh->prepare('SELECT username, email FROM users WHERE id = :id LIMIT 1');
        $recipient->execute([':id' => (int)$item['created_by']]);
        $recipientRow = $recipient->fetch();
        if ($recipientRow) {
            $emailPayload['to'] = (string)$recipientRow['email'];
            $emailPayload['recipient_name'] = (string)$recipientRow['username'];
        }
    }

    notifyCreatorAndContributors($dbh, $item, $uid, 'completed', 1);
    logActivity($dbh, (int)$item['group_id'], $uid, $id, 'completed', $item['name'], 1);
    $dbh->commit();

    if ($emailPayload && $emailPayload['to']) {
        if (!sendNotificationEmail(
            (string)$emailPayload['to'],
            (string)$emailPayload['recipient_name'],
            (string)$emailPayload['actor_name'],
            (string)$emailPayload['item_name'],
            (string)$emailPayload['group_name']
        )) {
            error_log('Notification email failed for item ' . $id);
        }
    }

    jsonOut(['message' => 'Completed']);
}

// DELETE /api/items/{id}
if (null !== $id && 'DELETE' === $method) {
    $stmt = $dbh->prepare(
        'SELECT group_id, created_by, name, image_path FROM grocery_items WHERE id = :id LIMIT 1'
    );
    $stmt->execute([':id' => $id]);
    $item = $stmt->fetch();

    if (!$item) jsonError('Item not found', 404);
    if ((int)$item['created_by'] !== $uid) jsonError('Only the creator can delete', 403);

    $dbh->beginTransaction();
    logActivity($dbh, (int)$item['group_id'], $uid, $id, 'deleted', $item['name'], 1);

    $stmt = $dbh->prepare(
        'UPDATE grocery_items
            SET deleted_at = UTC_TIMESTAMP(), deleted_by = :uid
          WHERE id = :id AND deleted_at IS NULL'
    );
    $stmt->execute([':uid' => $uid, ':id' => $id]);
    $dbh->commit();

    jsonOut(['message' => 'Deleted']);
}

// GET /api/items?group_id=X
if ('GET' === $method && null === $id && '' === $sub) {
    $groupId = isset($_GET['group_id']) ? (int)$_GET['group_id'] : 0;
    if (!$groupId) jsonError('group_id required');
    if (!isMember($dbh, $groupId, $uid)) jsonError('Forbidden', 403);

    purgeExpiredCompletedItems($dbh, $groupId);

    try {
        $stmt = $dbh->prepare(
            'SELECT i.id, i.name, i.image_path, i.quantity AS base_quantity,
                    i.quantity + COALESCE(extra.total_extra, 0) AS quantity,
                    i.is_completed,
                    i.created_at, i.completed_at,
                    UNIX_TIMESTAMP(i.created_at) AS created_ts,
                    CASE WHEN i.completed_at IS NULL THEN NULL ELSE UNIX_TIMESTAMP(i.completed_at) END AS completed_ts,
                    i.created_by,
                    u.username AS creator,
                    c.username AS completer,
                    COALESCE(my.quantity, 0) AS my_contribution_qty,
                    ' . (int)MAX_ITEM_TOTAL_QTY . ' AS total_limit,
                    GREATEST(0, ' . (int)MAX_ITEM_TOTAL_QTY . ' - (i.quantity + COALESCE(extra.total_extra, 0))) AS total_remaining,
                    (SELECT COALESCE(SUM(
                                CASE
                                    WHEN al.action = \'completed\' THEN 3
                                    WHEN al.action IN (\'added\', \'deleted\') THEN 2
                                    WHEN al.action IN (\'contribution_added\', \'contribution_removed\') THEN 1
                                    ELSE 0
                                END
                            ), 0)
                       FROM activity_log al
                      WHERE al.group_id = i.group_id
                        AND (
                            (TRIM(i.name) <> \'\' AND al.item_name = i.name)
                            OR (TRIM(i.name) = \'\' AND al.item_id = i.id)
                        )) AS usage_count,
                    ic.comment_count,
                    ic.latest_comment_body,
                    ic.latest_comment_created_at,
                    ic.latest_comment_ts,
                    ic.latest_comment_user
               FROM grocery_items i
               JOIN users u ON u.id = i.created_by AND u.deleted_at IS NULL
               LEFT JOIN users c ON c.id = i.completed_by AND c.deleted_at IS NULL
               LEFT JOIN (
                    SELECT item_id, SUM(quantity) AS total_extra
                      FROM item_contributions
                     GROUP BY item_id
               ) extra ON extra.item_id = i.id
               LEFT JOIN item_contributions my ON my.item_id = i.id AND my.user_id = :uid
               LEFT JOIN (
                    SELECT c1.item_id,
                           COUNT(*) AS comment_count,
                           SUBSTRING_INDEX(GROUP_CONCAT(c1.body ORDER BY c1.id DESC SEPARATOR '|'), '|', 1) AS latest_comment_body,
                           SUBSTRING_INDEX(GROUP_CONCAT(c1.created_at ORDER BY c1.id DESC SEPARATOR '|'), '|', 1) AS latest_comment_created_at,
                           SUBSTRING_INDEX(GROUP_CONCAT(UNIX_TIMESTAMP(c1.created_at) ORDER BY c1.id DESC SEPARATOR '|'), '|', 1) AS latest_comment_ts,
                           SUBSTRING_INDEX(GROUP_CONCAT(u1.username ORDER BY c1.id DESC SEPARATOR '|'), '|', 1) AS latest_comment_user
                      FROM item_comments c1
                      JOIN users u1 ON u1.id = c1.user_id AND u1.deleted_at IS NULL
                     WHERE c1.deleted_at IS NULL
                     GROUP BY c1.item_id
               ) ic ON ic.item_id = i.id
              WHERE i.group_id = :g
                AND i.deleted_at IS NULL
              ORDER BY i.is_completed ASC, usage_count DESC, i.created_at DESC'
        );
        $stmt->execute([':g' => $groupId, ':uid' => $uid]);
        $items = $stmt->fetchAll();
    } catch (Throwable $e) {
        error_log('Item list fallback used: ' . $e->getMessage());
        $items = fetchItemsFallback($dbh, $groupId, (int)$uid);
    }

    jsonOut([
        'items' => $items,
        'suggestions' => fetchItemSuggestions($dbh, $groupId),
        'server_now' => time()
    ]);
}

// POST /api/items
// Only the collection route creates a new item. Nested POST routes such as
// /api/items/{id}/comments and /api/items/{id}/image are handled below.
if ('POST' === $method && null === $id && '' === $sub) {
    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''));
    $isMultipart = str_contains($contentType, 'multipart/form-data');
    $body    = $isMultipart ? $_POST : (json_decode(file_get_contents('php://input'), true) ?? []);
    $name    = trim((string)($body['name'] ?? ''));
    $groupId = (int)($body['group_id'] ?? 0);
    $qty     = max(1, min(MAX_QUANTITY, (int)($body['quantity'] ?? 1)));
    $imagePath = null;
    $hasImageUpload = $isMultipart
        && isset($_FILES['image'])
        && UPLOAD_ERR_NO_FILE !== (int)($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE);

    if ('' === $name && !$hasImageUpload) jsonError('Item name or image required');
    if (!$groupId)     jsonError('group_id required');
    if (strlen($name) > MAX_ITEM_NAME_LEN) jsonError('Name too long');
    if (!isMember($dbh, $groupId, $uid))   jsonError('Forbidden', 403);
    if ($qty > MAX_ITEM_TOTAL_QTY) jsonError('Contribution limit reached', 400);
    if ('' !== $name) assertContentAllowed($dbh, $name, (int)$uid, 'item_name', 'item');

    if ($hasImageUpload) {
        $imagePath = saveUploadedItemImage($_FILES['image']);
    }

    // Duplicate-name handling applies only when the user supplied a name.
    // Image-only items may appear more than once.
    if ('' !== $name) {
        $stmt = $dbh->prepare(
            'SELECT id, name, is_completed
               FROM grocery_items
              WHERE group_id = :g
                AND name = :n
                AND deleted_at IS NULL
              LIMIT 1'
        );
        $stmt->execute([':g' => $groupId, ':n' => $name]);
        $existing = $stmt->fetch();
        if ($existing) {
            $existingItem = getItemTotals($dbh, (int)$existing['id'], $uid);
            jsonOut([
                'error' => 'Item already exists',
                'existing_item' => $existingItem,
                'can_add_to_existing' => (int)$existing['is_completed'] === 0
                    && (int)($existingItem['total_remaining'] ?? MAX_ITEM_TOTAL_QTY) > 0,
            ], 409);
        }
    }

    $dbh->beginTransaction();
    $stmt = $dbh->prepare(
        'INSERT INTO grocery_items (group_id, created_by, name, image_path, quantity) VALUES (:g, :u, :n, :img, :q)'
    );
    $stmt->execute([':g' => $groupId, ':u' => $uid, ':n' => $name, ':img' => $imagePath, ':q' => $qty]);
    $itemId = (int)$dbh->lastInsertId();

    logActivity($dbh, $groupId, $uid, $itemId, 'added', $name, $qty);
    $dbh->commit();

    jsonOut(['id' => $itemId, 'name' => $name, 'image_path' => $imagePath, 'quantity' => $qty], 201);
}

// POST /api/items/{id}/comments
// GET  /api/items/{id}/comments
if ('comments' === $sub && null !== $id) {
    $item = fetchItemContext($dbh, $id);
    if (!$item) jsonError('Item not found', 404);
    if (!isMember($dbh, (int)$item['group_id'], $uid)) jsonError('Forbidden', 403);

    if ('GET' === $method) {
        $stmt = $dbh->prepare(
            'SELECT c.id, c.body, c.created_at, UNIX_TIMESTAMP(c.created_at) AS created_ts, u.username
               FROM item_comments c
               JOIN users u ON u.id = c.user_id AND u.deleted_at IS NULL
              WHERE c.item_id = :id
                AND c.deleted_at IS NULL
              ORDER BY c.id DESC'
        );
        $stmt->execute([':id' => $id]);
        jsonOut([
            'items' => $stmt->fetchAll(),
            'server_now' => time(),
        ]);
    }

    if ('POST' === $method) {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $comment = trim((string)($body['body'] ?? ''));
        if ('' === $comment) jsonError('Comment required');
        $commentLength = preg_match_all('/./us', $comment, $matches);
        if (false === $commentLength) {
            $commentLength = strlen($comment);
        }
        if ($commentLength > 500) jsonError('Comment too long');
        assertContentAllowed($dbh, $comment, (int)$uid, 'comment', 'item', (int)$id);

        $stmt = $dbh->prepare(
            'INSERT INTO item_comments (item_id, user_id, body)
             VALUES (:i, :u, :b)'
        );
        $stmt->execute([':i' => $id, ':u' => $uid, ':b' => $comment]);

        $stmt = $dbh->prepare('SELECT username FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1');
        $stmt->execute([':id' => $uid]);
        $username = (string)($stmt->fetchColumn() ?: '');

        jsonOut([
            'message' => 'Comment added',
            'comment' => [
                'id' => (int)$dbh->lastInsertId(),
                'body' => $comment,
                'created_at' => gmdate('Y-m-d H:i:s'),
                'created_ts' => time(),
                'username' => $username,
            ],
        ], 201);
    }

    jsonError('Method not allowed', 405);
}

// POST /api/items/{id}/image
if ('image' === $sub && null !== $id && 'POST' === $method) {
    $item = fetchItemContext($dbh, $id);
    if (!$item) jsonError('Item not found', 404);
    if (!isMember($dbh, (int)$item['group_id'], $uid)) jsonError('Forbidden', 403);

    if (!isset($_FILES['image'])) jsonError('Image upload failed', 400);
    $newPath = saveUploadedItemImage($_FILES['image']);
    $oldPath = (string)($item['image_path'] ?? '');

    $stmt = $dbh->prepare('UPDATE grocery_items SET image_path = :img WHERE id = :id');
    $stmt->execute([':img' => $newPath, ':id' => $id]);
    deleteUploadedItemImage($oldPath);

    jsonOut([
        'message' => 'Image updated',
        'image_path' => $newPath,
    ]);
}

jsonError('Method not allowed', 405);
