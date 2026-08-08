<?php
declare(strict_types=1);

// Compatibility entry point.
// Some Apache/shared-hosting configurations may resolve /api/auth/login to
// this physical file before the normal rewrite rule runs. Delegate all such
// requests to the canonical API router so authentication behavior stays in
// api/routes/auth.php.
require __DIR__ . '/index.php';
