# InfinityFree deployment

1. Create a MySQL database in InfinityFree and run `schema.sql` in phpMyAdmin. For an existing installation, run `database-upgrade.sql` once before uploading the updated files, so new Hebrew content is saved with UTF-8 encoding.
2. Copy `htdocs/config.php.example` to `htdocs/config.php`; enter the database data and a password hash.
3. Upload the **contents** of `htdocs/` to InfinityFree's `htdocs` directory (not the directory itself).
4. Ensure `uploads/` is writable. Visit `/panel-7qk3m.php` directly; it is not linked publicly.

Generate the password hash locally with PHP: `php -r "echo password_hash('your password', PASSWORD_DEFAULT), PHP_EOL;"`.
