# InfinityFree deployment

1. Create a MySQL database in InfinityFree and run `schema.sql` in phpMyAdmin.
2. Copy `htdocs/config.php.example` to `htdocs/config.php`; enter the database data and a password hash.
3. Upload the **contents** of `htdocs/` to InfinityFree's `htdocs` directory (not the directory itself).
4. Ensure `uploads/` is writable. Visit `/admin.php` only directly; it is not linked publicly.

Generate the password hash locally with PHP: `php -r "echo password_hash('your password', PASSWORD_DEFAULT), PHP_EOL;"`.
