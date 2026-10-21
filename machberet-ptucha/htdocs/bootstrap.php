<?php
declare(strict_types=1);
session_start();
$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) { http_response_code(503); exit('יש להשלים את config.php לפני הפעלת האתר.'); }
$config = require $configFile;
try { $pdo = new PDO('mysql:host='.$config['db_host'].';dbname='.$config['db_name'].';charset=utf8mb4', $config['db_user'], $config['db_pass'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]); }
catch (PDOException $e) { error_log('Database connection failed: '.$e->getMessage()); http_response_code(503); exit('האתר אינו זמין כרגע.'); }
function e(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function csrf(): string { if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32)); return $_SESSION['csrf']; }
function check_csrf(): void { if (!hash_equals($_SESSION['csrf'] ?? '', $_POST['csrf'] ?? '')) { http_response_code(403); exit('בקשה לא תקינה.'); } }
function admin(): bool { return !empty($_SESSION['admin']); }
function require_admin(): void { if (!admin()) { header('Location: admin.php'); exit; } }
