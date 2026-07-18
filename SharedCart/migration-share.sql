-- Optional fallback migration for share links.
-- The updated invite route creates this table automatically.
-- Import this file in phpMyAdmin only if sharing still reports that invite storage is unavailable.

CREATE TABLE IF NOT EXISTS invite_tokens (
    token CHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    group_id INT UNSIGNED NOT NULL,
    created_by INT UNSIGNED NOT NULL,
    used TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (token),
    KEY idx_invites_group (group_id),
    KEY idx_invites_creator (created_by),
    KEY idx_invites_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
