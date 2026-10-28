<?php
declare(strict_types=1);

date_default_timezone_set('UTC');
require_once __DIR__ . '/api/config.php';
require_once __DIR__ . '/api/admin_helper.php';
require_once __DIR__ . '/api/auth_helper.php';

function recordAdminConsoleDenial(string $reason, ?array $payload = null, ?array $user = null): void {
    try {
        $dbh = getDb();
        $dbh->exec("SET time_zone = '+00:00'");
        ensureAdminSchema($dbh);
        $userId = isset($user['id']) ? (int)$user['id'] : (isset($payload['sub']) ? (int)$payload['sub'] : null);
        $email = (string)($user['email'] ?? '');
        $severity = in_array($reason, ['non_admin_role', 'blocked_account', 'deleted_account', 'token_version_mismatch'], true)
            ? 'critical'
            : 'warning';
        logSecurityEvent($dbh, 'admin_access_denied', $severity, $userId, $email, securityRequestPath(), [
            'reason' => $reason,
            'role' => (string)($user['role'] ?? ''),
        ]);
    } catch (Throwable $e) {
        error_log('Admin access denial logging failed: ' . $e->getMessage());
    }
}

function denyAdminConsole(string $reason, ?array $payload = null, ?array $user = null): never {
    recordAdminConsoleDenial($reason, $payload, $user);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Location: /index.html?admin_access=denied', true, 302);
    exit;
}

try {
    $token = trim((string)($_COOKIE[AUTH_COOKIE_NAME] ?? ''));
    if ('' === $token) denyAdminConsole('missing_session');

    $payload = jwtDecode($token);
    if (!$payload || empty($payload['sub'])) denyAdminConsole('invalid_session');

    $dbh = getDb();
    $dbh->exec("SET time_zone = '+00:00'");
    ensureAdminSchema($dbh);
    $user = userAccessRow($dbh, (int)$payload['sub']);

    if (!$user) denyAdminConsole('unknown_account', $payload);
    if (!empty($user['deleted_at'])) denyAdminConsole('deleted_account', $payload, $user);
    if ((int)($payload['ver'] ?? 0) !== (int)($user['token_version'] ?? 0)) denyAdminConsole('token_version_mismatch', $payload, $user);
    if ((int)($user['is_blocked'] ?? 0) === 1) denyAdminConsole('blocked_account', $payload, $user);
    if ('admin' !== (string)($user['role'] ?? 'user')) denyAdminConsole('non_admin_role', $payload, $user);
} catch (Throwable $e) {
    error_log('Admin page gate failed: ' . $e->getMessage());
    try {
        $dbh = getDb();
        ensureAdminSchema($dbh);
        logSecurityEvent($dbh, 'admin_gate_error', 'critical', null, '', securityRequestPath(), [
            'reason' => 'gate_exception',
        ]);
    } catch (Throwable $ignored) {
    }
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Location: /index.html?admin_access=denied', true, 302);
    exit;
}

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
?>
<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>SharedCart Admin</title>
  <meta name="theme-color" content="#ffffff">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <link rel="icon" type="image/svg+xml" href="favicon.svg?v=20260707-3">
  <link rel="alternate icon" href="favicon.ico?v=20260707-3">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="admin.css?v=20261028-1">
</head>
<body>
  <div id="adminApp" class="admin-shell" hidden>
    <aside class="admin-sidebar" aria-label="Admin navigation">
      <div class="admin-brand">
        <div class="brand-mark" data-icon="shopping-cart"></div>
        <div>
          <div class="brand-name">SharedCart</div>
          <div class="brand-sub" data-i18n="adminConsole">מסוף ניהול</div>
        </div>
      </div>

      <nav class="admin-nav">
        <button class="admin-nav-item active" data-view="overview" type="button">
          <span data-icon="layout-dashboard"></span><span data-i18n="overview">סקירה</span>
        </button>
        <button class="admin-nav-item" data-view="users" type="button">
          <span data-icon="users"></span><span data-i18n="users">משתמשים</span>
        </button>
        <button class="admin-nav-item" data-view="groups" type="button">
          <span data-icon="users-group"></span><span data-i18n="groups">קבוצות</span>
        </button>
        <button class="admin-nav-item" data-view="content" type="button">
          <span data-icon="list-details"></span><span data-i18n="content">תוכן</span>
        </button>
        <button class="admin-nav-item" data-view="moderation" type="button">
          <span data-icon="shield-check"></span><span data-i18n="moderation">סינון תוכן</span>
        </button>
        <button class="admin-nav-item" data-view="audit" type="button">
          <span data-icon="history"></span><span data-i18n="audit">יומן מנהל</span>
        </button>
        <button class="admin-nav-item" data-view="health" type="button">
          <span data-icon="activity-heartbeat"></span><span data-i18n="health">תקינות מערכת</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="admin-user-card">
          <div class="avatar" id="adminAvatar">A</div>
          <div class="admin-user-copy">
            <strong id="adminName">Admin</strong>
            <span id="adminEmail"></span>
          </div>
        </div>
        <a href="index.html" class="sidebar-link"><span data-icon="arrow-back-up"></span><span data-i18n="backToSite">חזרה לאתר</span></a>
      </div>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <div>
          <p class="eyebrow" data-i18n="workspace">SharedCart workspace</p>
          <h1 id="pageTitle" data-i18n="overview">סקירה</h1>
        </div>
        <div class="topbar-actions">
          <div id="periodControl" class="segmented-control" aria-label="Period">
            <button type="button" data-period="7">7 <span data-i18n="days">ימים</span></button>
            <button type="button" data-period="30" class="active">30 <span data-i18n="days">ימים</span></button>
          </div>
          <button id="btnSecurityAlerts" type="button" class="icon-button security-alert-button" aria-label="Security alerts" title="Security alerts">
            <span data-icon="shield-check"></span>
            <span id="securityAlertBadge" class="security-alert-badge" hidden>0</span>
          </button>
          <button id="btnAdminLanguage" type="button" class="icon-button" aria-label="Language" title="Language">
            <span data-icon="language"></span>
          </button>
          <button id="btnRefreshAdmin" type="button" class="icon-button" aria-label="Refresh" title="Refresh">
            <span data-icon="refresh"></span>
          </button>
        </div>
      </header>

      <section class="admin-toolbar" id="adminToolbar">
        <label class="search-field">
          <span data-icon="search"></span>
          <input id="adminSearch" type="search" autocomplete="off" data-i18n-placeholder="searchPlaceholder" placeholder="חיפוש">
        </label>
        <div id="viewFilters" class="toolbar-filters"></div>
        <button id="btnExportCsv" type="button" class="md-button secondary"><span data-icon="download"></span><span data-i18n="exportCsv">ייצוא CSV</span></button>
      </section>

      <main id="adminContent" class="admin-content" aria-live="polite"></main>
    </div>
  </div>

  <div id="adminModal" class="admin-modal" hidden>
    <div class="admin-modal-card" role="dialog" aria-modal="true" aria-labelledby="adminModalTitle">
      <div class="admin-modal-header">
        <h2 id="adminModalTitle"></h2>
        <button id="adminModalClose" class="icon-button" type="button" aria-label="Close"><span data-icon="x"></span></button>
      </div>
      <div id="adminModalBody" class="admin-modal-body"></div>
      <div id="adminModalActions" class="admin-modal-actions"></div>
    </div>
  </div>

  <div id="adminToast" class="admin-toast" role="status" hidden></div>
  <script src="admin.js?v=20261028-1"></script>
</body>
</html>
