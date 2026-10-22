<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth_helper.php';

$auth = requireAuth();
$uid = (int)$auth['sub'];
$dbh = getDb();

const KITCHEN_AREAS = ['fridge_inside', 'fridge_door', 'vegetable_drawers', 'freezer', 'pantry'];

function kitchenCanAccess(PDO $dbh, int $groupId, int $userId): bool {
    $stmt = $dbh->prepare(
        'SELECT 1
          FROM `groups` g
          LEFT JOIN group_members gm
            ON gm.group_id = g.id
           AND gm.user_id = :member_user_id
         WHERE g.id = :group_id
           AND g.deleted_at IS NULL
           AND (gm.user_id IS NOT NULL OR g.created_by = :creator_user_id)
          LIMIT 1'
    );
    $stmt->execute([
        ':group_id' => $groupId,
        ':member_user_id' => $userId,
        ':creator_user_id' => $userId,
    ]);
    return (bool)$stmt->fetch();
}

function kitchenRestoreApprovedMembership(PDO $dbh, int $groupId, int $userId): bool {
    $approved = $dbh->prepare(
        'SELECT 1
           FROM group_join_requests r
           JOIN `groups` g ON g.id = r.group_id AND g.deleted_at IS NULL
           JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
          WHERE r.group_id = :group_id
            AND r.user_id = :user_id
            AND r.status = "approved"
          LIMIT 1'
    );
    $approved->execute([':group_id' => $groupId, ':user_id' => $userId]);
    if (!$approved->fetch()) return false;

    $restore = $dbh->prepare(
        'INSERT IGNORE INTO group_members (group_id, user_id)
         VALUES (:group_id, :user_id)'
    );
    $restore->execute([':group_id' => $groupId, ':user_id' => $userId]);

    return kitchenCanAccess($dbh, $groupId, $userId);
}

function kitchenCleanExpiredPreviousImages(PDO $dbh, int $groupId): void {
    $stmt = $dbh->prepare(
        'SELECT id, previous_image_path
           FROM kitchen_area_photos
          WHERE group_id = :group_id
            AND previous_image_path IS NOT NULL
            AND previous_image_expires_at <= UTC_TIMESTAMP()'
    );
    $stmt->execute([':group_id' => $groupId]);
    foreach ($stmt->fetchAll() as $row) {
        deleteUploadedKitchenImage((string)$row['previous_image_path']);
        $clear = $dbh->prepare(
            'UPDATE kitchen_area_photos
                SET previous_image_path = NULL, previous_image_expires_at = NULL
              WHERE id = :id'
        );
        $clear->execute([':id' => (int)$row['id']]);
    }
}

$groupId = (int)($_GET['group_id'] ?? $_POST['group_id'] ?? 0);
if (!$groupId) jsonError('group_id required');
if (!kitchenCanAccess($dbh, $groupId, $uid) && !kitchenRestoreApprovedMembership($dbh, $groupId, $uid)) {
    jsonError('Forbidden', 403);
}
kitchenCleanExpiredPreviousImages($dbh, $groupId);

if ('GET' === $method) {
    $stmt = $dbh->prepare(
        'SELECT kp.area_code, kp.image_path, kp.previous_image_path, kp.previous_image_expires_at,
                kp.updated_at, UNIX_TIMESTAMP(kp.updated_at) AS updated_ts, u.username AS updated_by
           FROM kitchen_area_photos kp
           JOIN users u ON u.id = kp.created_by AND u.deleted_at IS NULL
          WHERE kp.group_id = :group_id
          ORDER BY kp.area_code ASC'
    );
    $stmt->execute([':group_id' => $groupId]);
    jsonOut(['areas' => $stmt->fetchAll(), 'server_now' => time()]);
}

$area = trim((string)($_GET['area'] ?? $_POST['area'] ?? ''));
if (!in_array($area, KITCHEN_AREAS, true)) jsonError('Invalid kitchen area');

if ('POST' === $method) {
    if (!isset($_FILES['image'])) jsonError('Image upload failed', 400);
    $newPath = saveUploadedKitchenImage($_FILES['image']);
    $existingStmt = $dbh->prepare(
        'SELECT id, image_path, previous_image_path
           FROM kitchen_area_photos
          WHERE group_id = :group_id AND area_code = :area
          LIMIT 1'
    );
    $existingStmt->execute([':group_id' => $groupId, ':area' => $area]);
    $existing = $existingStmt->fetch();

    if ($existing) {
        deleteUploadedKitchenImage((string)($existing['previous_image_path'] ?? ''));
        $stmt = $dbh->prepare(
            'UPDATE kitchen_area_photos
                SET image_path = :image_path,
                    previous_image_path = :previous_image_path,
                    previous_image_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ' . (int)KITCHEN_PREVIOUS_IMAGE_RETENTION_HOURS . ' HOUR),
                    created_by = :user_id
              WHERE id = :id'
        );
        $stmt->execute([
            ':image_path' => $newPath,
            ':previous_image_path' => (string)$existing['image_path'],
            ':user_id' => $uid,
            ':id' => (int)$existing['id'],
        ]);
    } else {
        $stmt = $dbh->prepare(
            'INSERT INTO kitchen_area_photos (group_id, area_code, image_path, created_by)
             VALUES (:group_id, :area, :image_path, :user_id)'
        );
        $stmt->execute([':group_id' => $groupId, ':area' => $area, ':image_path' => $newPath, ':user_id' => $uid]);
    }
    jsonOut(['message' => 'Kitchen photo updated'], 201);
}

if ('PATCH' === $method && 'restore' === ($_GET['action'] ?? '')) {
    $stmt = $dbh->prepare(
        'SELECT id, image_path, previous_image_path, previous_image_expires_at
           FROM kitchen_area_photos
          WHERE group_id = :group_id AND area_code = :area
          LIMIT 1'
    );
    $stmt->execute([':group_id' => $groupId, ':area' => $area]);
    $photo = $stmt->fetch();
    if (!$photo || empty($photo['previous_image_path']) || empty($photo['previous_image_expires_at'])) {
        jsonError('No previous image to restore', 404);
    }
    $restore = $dbh->prepare(
        'UPDATE kitchen_area_photos
            SET image_path = :image_path,
                previous_image_path = NULL,
                previous_image_expires_at = NULL
          WHERE id = :id'
    );
    $restore->execute([
        ':image_path' => (string)$photo['previous_image_path'],
        ':id' => (int)$photo['id'],
    ]);
    deleteUploadedKitchenImage((string)$photo['image_path']);
    jsonOut(['message' => 'Previous kitchen photo restored']);
}

jsonError('Method not allowed', 405);
