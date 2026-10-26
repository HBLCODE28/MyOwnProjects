<?php
require __DIR__ . '/bootstrap.php';
if (!admin()) { header('Location: panel-7qk3m.php'); exit; }
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_all_summaries'])) {
    check_csrf();
    $files = $pdo->query('SELECT file_name FROM summaries')->fetchAll();
    $pdo->beginTransaction();
    try { $pdo->exec('DELETE FROM summaries'); $pdo->commit(); }
    catch (Throwable $error) { $pdo->rollBack(); throw $error; }
    foreach ($files as $file) { $path = __DIR__ . '/uploads/' . basename($file['file_name']); if (is_file($path)) unlink($path); }
    header('Location: summaries-admin.php'); exit;
}
$summaries = $pdo->query('SELECT id,title,subject,grade FROM summaries ORDER BY created_at DESC LIMIT 100')->fetchAll();
?><!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"><title>ניהול סיכומים | מחברת פתוחה</title></head><body><header><a class="brand" href="panel-7qk3m.php">✦ מחברת פתוחה</a><nav><a href="panel-7qk3m.php">חזרה לניהול</a></nav></header><main class="admin"><h1>סיכומים שפורסמו</h1><?php if ($summaries): ?><form method="post" onsubmit="return confirm('למחוק את כל הסיכומים? הפעולה תמחק גם את כל הקבצים ולא ניתן לבטל אותה.');"><input type="hidden" name="csrf" value="<?= csrf() ?>"><button name="delete_all_summaries" value="1">מחיקת כל הסיכומים</button></form><?php endif ?><?php foreach ($summaries as $summary): ?><article class="item"><b><?= e($summary['title']) ?></b><p><?= e($summary['subject']) ?> · <?= e($summary['grade']) ?></p><a class="view-link" href="edit-summary.php?id=<?= $summary['id'] ?>">עריכת הסיכום</a></article><?php endforeach ?><?php if (!$summaries): ?><p>עדיין אין סיכומים שפורסמו.</p><?php endif ?></main></body></html>
