<?php
require __DIR__ . '/bootstrap.php';
$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]); if (!$id) { http_response_code(404); exit; }
$statement = $pdo->prepare('SELECT title,file_name FROM summaries WHERE id=? AND published=1 LIMIT 1'); $statement->execute([$id]); $summary = $statement->fetch(); $path = $summary ? __DIR__ . '/uploads/' . basename($summary['file_name']) : '';
if (!$summary || !is_file($path)) { http_response_code(404); exit; }
$extension = strtolower(pathinfo($path, PATHINFO_EXTENSION)); $types = ['pdf'=>'application/pdf','docx'=>'application/vnd.openxmlformats-officedocument.wordprocessingml.document','jpg'=>'image/jpeg','png'=>'image/png']; if (!isset($types[$extension])) { http_response_code(404); exit; }
$filename = preg_replace('/[^\\pL\\pN ._-]+/u', '_', $summary['title']) . '.' . $extension;
header('Content-Type: ' . $types[$extension]); header('Content-Length: ' . filesize($path)); header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode($filename)); header('X-Content-Type-Options: nosniff'); readfile($path);
