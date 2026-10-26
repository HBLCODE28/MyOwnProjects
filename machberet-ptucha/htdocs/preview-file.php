<?php
require __DIR__ . '/bootstrap.php';
$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]); if (!$id) { http_response_code(404); exit; }
$statement = $pdo->prepare('SELECT file_name FROM summaries WHERE id=? AND published=1 LIMIT 1'); $statement->execute([$id]); $summary = $statement->fetch(); $path = $summary ? __DIR__ . '/uploads/' . basename($summary['file_name']) : '';
if (!$summary || !is_file($path)) { http_response_code(404); exit; }
$extension = strtolower(pathinfo($path, PATHINFO_EXTENSION)); $types = ['pdf'=>'application/pdf','docx'=>'application/vnd.openxmlformats-officedocument.wordprocessingml.document','ppt'=>'application/vnd.ms-powerpoint','pptx'=>'application/vnd.openxmlformats-officedocument.presentationml.presentation','jpg'=>'image/jpeg','png'=>'image/png'];
if (!isset($types[$extension])) { http_response_code(404); exit; }
header('Content-Type: ' . $types[$extension]); header('Content-Length: ' . filesize($path)); header('Content-Disposition: inline; filename="preview.' . $extension . '"'); header('X-Content-Type-Options: nosniff'); readfile($path);
