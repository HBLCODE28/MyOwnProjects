<?php
require_once __DIR__ . '/config.php';

function appBaseUrl(): string {
    if (defined('APP_BASE_URL') && '' !== trim((string)APP_BASE_URL)) {
        $configured = rtrim(trim((string)APP_BASE_URL), '/');
        if (filter_var($configured, FILTER_VALIDATE_URL) && in_array(parse_url($configured, PHP_URL_SCHEME), ['https', 'http'], true)) {
            return $configured;
        }
    }

    // SERVER_NAME is preferred over the untrusted Host header to prevent host-header injection in emails.
    $host = strtolower(trim((string)($_SERVER['SERVER_NAME'] ?? '')));
    $host = preg_replace('/:\\d+$/', '', $host) ?: '';
    if ('' === $host || !preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i', $host)) {
        return '';
    }

    $scheme = (!empty($_SERVER['HTTPS']) && 'off' !== strtolower((string)$_SERVER['HTTPS'])) ? 'https' : 'http';
    $script = str_replace('\\', '/', (string)($_SERVER['SCRIPT_NAME'] ?? ''));
    $basePath = rtrim(dirname(dirname($script)), '/');
    if ('.' === $basePath || '/' === $basePath) $basePath = '';
    return $scheme . '://' . $host . $basePath;
}

function smtpConfigured(): bool {
    return '' !== trim(SMTP_HOST) && '' !== trim(SMTP_USER) && '' !== trim(SMTP_PASS) && '' !== trim(SMTP_FROM_EMAIL);
}


function emailDailySendLimit(): int {
    if (defined('EMAIL_DAILY_SEND_LIMIT')) {
        return max(1, (int)constant('EMAIL_DAILY_SEND_LIMIT'));
    }
    return 500;
}

function emailWarningThreshold(): int {
    if (defined('EMAIL_WARNING_THRESHOLD')) {
        return max(1, min(emailDailySendLimit(), (int)constant('EMAIL_WARNING_THRESHOLD')));
    }
    return min(emailDailySendLimit(), 350);
}

function emailCriticalThreshold(): int {
    if (defined('EMAIL_CRITICAL_THRESHOLD')) {
        return max(emailWarningThreshold(), min(emailDailySendLimit(), (int)constant('EMAIL_CRITICAL_THRESHOLD')));
    }
    return min(emailDailySendLimit(), 450);
}

function ensureEmailDeliveryLogTable(PDO $dbh): void {
    static $ready = false;
    if ($ready) return;
    $dbh->exec(
        "CREATE TABLE IF NOT EXISTS email_delivery_log (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            status ENUM('sent','failed') NOT NULL,
            recipient_hash CHAR(64) NOT NULL,
            recipient_domain VARCHAR(190) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_email_delivery_created_status (created_at, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $ready = true;
}

function recordEmailDelivery(string $recipient, bool $success): void {
    try {
        $dbh = getDb();
        ensureEmailDeliveryLogTable($dbh);
        $normalized = strtolower(trim($recipient));
        $at = strrpos($normalized, '@');
        $domain = false === $at ? null : substr($normalized, $at + 1);
        $stmt = $dbh->prepare(
            'INSERT INTO email_delivery_log (status, recipient_hash, recipient_domain)
             VALUES (:status, :recipient_hash, :recipient_domain)'
        );
        $stmt->execute([
            ':status' => $success ? 'sent' : 'failed',
            ':recipient_hash' => hash('sha256', $normalized),
            ':recipient_domain' => $domain,
        ]);

        if (1 === random_int(1, 100)) {
            $dbh->exec("DELETE FROM email_delivery_log WHERE created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 90 DAY)");
        }
    } catch (Throwable $e) {
        error_log('Email delivery logging failed: ' . $e->getMessage());
    }
}

function emailUsageSummary(PDO $dbh): array {
    $limit = emailDailySendLimit();
    $warning = emailWarningThreshold();
    $critical = emailCriticalThreshold();
    $summary = [
        'available' => true,
        'window_hours' => 24,
        'sent_24h' => 0,
        'failed_24h' => 0,
        'limit' => $limit,
        'warning_threshold' => $warning,
        'critical_threshold' => $critical,
        'remaining' => $limit,
        'percent' => 0,
        'level' => 'normal',
        'tracking_started_at' => null,
        'last_sent_at' => null,
    ];

    try {
        ensureEmailDeliveryLogTable($dbh);
        $row = $dbh->query(
            "SELECT
                COALESCE(SUM(CASE WHEN status = 'sent' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END), 0) AS sent_24h,
                COALESCE(SUM(CASE WHEN status = 'failed' AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END), 0) AS failed_24h,
                MIN(created_at) AS tracking_started_at,
                MAX(CASE WHEN status = 'sent' THEN created_at ELSE NULL END) AS last_sent_at
             FROM email_delivery_log"
        )->fetch();
        if ($row) {
            $summary['sent_24h'] = (int)($row['sent_24h'] ?? 0);
            $summary['failed_24h'] = (int)($row['failed_24h'] ?? 0);
            $summary['tracking_started_at'] = $row['tracking_started_at'] ?: null;
            $summary['last_sent_at'] = $row['last_sent_at'] ?: null;
        }
    } catch (Throwable $e) {
        error_log('Email usage summary failed: ' . $e->getMessage());
        $summary['available'] = false;
        return $summary;
    }

    $sent = (int)$summary['sent_24h'];
    $summary['remaining'] = max(0, $limit - $sent);
    $summary['percent'] = min(100, (int)round(($sent / max(1, $limit)) * 100));
    if ($sent >= $critical) {
        $summary['level'] = 'critical';
    } elseif ($sent >= $warning) {
        $summary['level'] = 'warning';
    }
    return $summary;
}

function mailFromAddress(): string {
    if ('' !== trim(SMTP_FROM_EMAIL)) {
        return trim(SMTP_FROM_EMAIL);
    }

    $host = parse_url(appBaseUrl(), PHP_URL_HOST) ?: '';
    if ('' === $host || !preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i', $host)) {
        return 'noreply@example.com';
    }

    return 'noreply@' . strtolower($host);
}

function encodeMailSubject(string $subject): string {
    return '=?UTF-8?B?' . base64_encode($subject) . '?=';
}

function smtpReadResponse($socket): array {
    $lines = [];
    $code = null;

    while (!feof($socket)) {
        $line = fgets($socket, 515);
        if (false === $line) {
            break;
        }
        $lines[] = rtrim($line, "\r\n");
        if (preg_match('/^(\d{3})([ -])/', $line, $matches)) {
            $code = (int)$matches[1];
            if (' ' === $matches[2]) {
                break;
            }
        }
    }

    return [$code, implode("\n", $lines)];
}

function smtpWriteCommand($socket, string $command): void {
    fwrite($socket, $command . "\r\n");
}

function smtpSendMessage(
    string $to,
    string $subject,
    string $textBody,
    string $htmlBody
): bool {
    if (!smtpConfigured()) {
        return false;
    }

    $host = trim(SMTP_HOST);
    $port = (int)SMTP_PORT;
    $encryption = strtolower(trim(SMTP_ENCRYPTION));
    $remote = ('ssl' === $encryption ? 'ssl://' : '') . $host . ':' . $port;

    $context = stream_context_create(['ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true,
        'peer_name' => $host,
        'SNI_enabled' => true,
        'allow_self_signed' => false,
    ]]);
    $socket = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) {
        error_log('SMTP connect failed: ' . $errno . ' ' . $errstr);
        return false;
    }

    stream_set_timeout($socket, 15);

    [$code] = smtpReadResponse($socket);
    if (220 !== $code) {
        fclose($socket);
        return false;
    }

    $hostname = parse_url(appBaseUrl(), PHP_URL_HOST) ?: (string)($_SERVER['SERVER_NAME'] ?? 'localhost');
    smtpWriteCommand($socket, 'EHLO ' . $hostname);
    [$code, $response] = smtpReadResponse($socket);
    if (250 !== $code) {
        smtpWriteCommand($socket, 'HELO ' . $hostname);
        [$code] = smtpReadResponse($socket);
        if (250 !== $code) {
            fclose($socket);
            return false;
        }
    }

    if ('tls' === $encryption) {
        smtpWriteCommand($socket, 'STARTTLS');
        [$code] = smtpReadResponse($socket);
        if (220 !== $code) {
            fclose($socket);
            return false;
        }

        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($socket);
            return false;
        }

        smtpWriteCommand($socket, 'EHLO ' . $hostname);
        [$code] = smtpReadResponse($socket);
        if (250 !== $code) {
            fclose($socket);
            return false;
        }
    }

    smtpWriteCommand($socket, 'AUTH LOGIN');
    [$code] = smtpReadResponse($socket);
    if (334 !== $code) {
        fclose($socket);
        return false;
    }

    smtpWriteCommand($socket, base64_encode(SMTP_USER));
    [$code] = smtpReadResponse($socket);
    if (334 !== $code) {
        fclose($socket);
        return false;
    }

    smtpWriteCommand($socket, base64_encode(SMTP_PASS));
    [$code] = smtpReadResponse($socket);
    if (235 !== $code) {
        fclose($socket);
        return false;
    }

    $from = mailFromAddress();
    smtpWriteCommand($socket, 'MAIL FROM:<' . $from . '>');
    [$code] = smtpReadResponse($socket);
    if (250 !== $code) {
        fclose($socket);
        return false;
    }

    smtpWriteCommand($socket, 'RCPT TO:<' . $to . '>');
    [$code] = smtpReadResponse($socket);
    if (250 !== $code && 251 !== $code) {
        fclose($socket);
        return false;
    }

    smtpWriteCommand($socket, 'DATA');
    [$code] = smtpReadResponse($socket);
    if (354 !== $code) {
        fclose($socket);
        return false;
    }

    $boundary = 'b_' . bin2hex(random_bytes(12));
    $messageIdHost = parse_url(appBaseUrl(), PHP_URL_HOST) ?: 'localhost';
    $fromName = defined('SMTP_FROM_NAME') && '' !== trim((string)SMTP_FROM_NAME) ? trim((string)SMTP_FROM_NAME) : APP_NAME;
    $fromName = str_replace(["\r", "\n"], '', $fromName);
    $message = implode("\r\n", [
        'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
        'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $messageIdHost . '>',
        'From: ' . $fromName . ' <' . $from . '>',
        'To: <' . $to . '>',
        'Subject: ' . encodeMailSubject($subject),
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        '',
        '--' . $boundary,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        $textBody,
        '--' . $boundary,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        $htmlBody,
        '--' . $boundary . '--',
        '',
    ]);

    $lines = explode("\r\n", $message);
    foreach ($lines as $line) {
        if (isset($line[0]) && '.' === $line[0]) {
            $line = '.' . $line;
        }
        fwrite($socket, $line . "\r\n");
    }
    fwrite($socket, ".\r\n");

    [$code] = smtpReadResponse($socket);
    smtpWriteCommand($socket, 'QUIT');
    fclose($socket);

    return 250 === $code;
}

function sendAppEmail(string $to, string $subject, string $textBody, string $htmlBody): bool {
    $to = trim($to);
    if (!filter_var($to, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $to . $subject)) {
        error_log('Invalid email recipient or subject');
        return false;
    }

    if (smtpConfigured()) {
        $sent = smtpSendMessage($to, $subject, $textBody, $htmlBody);
        recordEmailDelivery($to, $sent);
        return $sent;
    }

    error_log('SMTP is not configured');
    return false;
}

function sendNotificationEmail(string $to, string $recipientName, string $actorName, string $itemName, string $groupName): bool {
    $subject = 'עדכון בקבוצת הקניות';
    $text = trim(
      "שלום $recipientName,\n\n" .
      $actorName . ' לקח/ה את הפריט "' . $itemName . '" בקבוצה "' . $groupName . '".' . "\n" .
      "אפשר להיכנס לאתר ולראות את שאר העדכונים."
    );

    $html = '<div style="font-family:Arial,sans-serif;direction:rtl;text-align:right;line-height:1.6;color:#0f172a">'
      . '<p>שלום ' . htmlspecialchars($recipientName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . ',</p>'
      . '<p><strong>' . htmlspecialchars($actorName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</strong> לקח/ה את הפריט <strong>"' . htmlspecialchars($itemName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '"</strong>
      בקבוצה <strong>"' . htmlspecialchars($groupName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '"</strong>.</p>'
      . '<p>אפשר להיכנס לאתר ולראות את שאר העדכונים.</p>'
      . '</div>';


    return sendAppEmail($to, $subject, $text, $html);
}
