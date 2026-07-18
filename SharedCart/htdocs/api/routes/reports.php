<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth_helper.php';
require_once __DIR__ . '/../admin_helper.php';

$auth = requireAuth();
$uid = (int)$auth['sub'];
$dbh = getDb();
ensureAdminSchema($dbh);

if ('POST' === $method && null === $id) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $targetType = (string)($body['target_type'] ?? '');
    $targetId = (int)($body['target_id'] ?? 0);
    $reason = trim((string)($body['reason'] ?? ''));
    if (!in_array($targetType, ['item', 'comment', 'user'], true)) jsonError('Invalid report target');
    if ($targetId <= 0) jsonError('Report target required');
    if ('' === $reason) jsonError('Report reason required');
    if (function_exists('mb_strlen') ? mb_strlen($reason, 'UTF-8') > 500 : strlen($reason) > 500) jsonError('Report reason too long');
    assertContentAllowed($dbh, $reason, $uid, 'report_reason', 'report');

    if ('item' === $targetType) {
        $stmt = $dbh->prepare(
            'SELECT 1 FROM grocery_items i
             JOIN group_members gm ON gm.group_id = i.group_id AND gm.user_id = :uid
             JOIN `groups` g ON g.id = i.group_id AND g.deleted_at IS NULL
             WHERE i.id = :id AND i.deleted_at IS NULL LIMIT 1'
        );
    } elseif ('comment' === $targetType) {
        $stmt = $dbh->prepare(
            'SELECT 1 FROM item_comments c
             JOIN grocery_items i ON i.id = c.item_id
             JOIN group_members gm ON gm.group_id = i.group_id AND gm.user_id = :uid
             JOIN `groups` g ON g.id = i.group_id AND g.deleted_at IS NULL
             WHERE c.id = :id AND c.deleted_at IS NULL AND i.deleted_at IS NULL LIMIT 1'
        );
    } else {
        $stmt = $dbh->prepare(
            'SELECT 1
               FROM group_members mine
               JOIN group_members theirs ON theirs.group_id = mine.group_id AND theirs.user_id = :id
               JOIN `groups` g ON g.id = mine.group_id AND g.deleted_at IS NULL
              WHERE mine.user_id = :uid
              LIMIT 1'
        );
    }
    $stmt->execute([':uid' => $uid, ':id' => $targetId]);
    if (!$stmt->fetchColumn()) jsonError('Report target not accessible', 403);

    $duplicate = $dbh->prepare(
        "SELECT id FROM content_reports
          WHERE reporter_id = :reporter AND target_type = :type AND target_id = :target AND status = 'open'
          LIMIT 1"
    );
    $duplicate->execute([':reporter' => $uid, ':type' => $targetType, ':target' => $targetId]);
    if ($duplicate->fetch()) jsonError('Report already submitted', 409);

    $stmt = $dbh->prepare(
        'INSERT INTO content_reports (reporter_id, target_type, target_id, reason)
         VALUES (:reporter, :type, :target, :reason)'
    );
    $stmt->execute([':reporter' => $uid, ':type' => $targetType, ':target' => $targetId, ':reason' => $reason]);
    jsonOut(['message' => 'Report submitted', 'id' => (int)$dbh->lastInsertId()], 201);
}

if ('GET' === $method && null === $id) {
    $stmt = $dbh->prepare(
        'SELECT id, target_type, target_id, reason, status, created_at, resolved_at
           FROM content_reports WHERE reporter_id = :uid ORDER BY created_at DESC LIMIT 50'
    );
    $stmt->execute([':uid' => $uid]);
    jsonOut(['items' => $stmt->fetchAll()]);
}

jsonError('Method not allowed', 405);
