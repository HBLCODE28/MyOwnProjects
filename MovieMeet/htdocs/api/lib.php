<?php
declare(strict_types=1);

function envValue(string $name, string $default = ''): string {
    $config = $GLOBALS['moviemeetConfig'] ?? [];
    $value = is_array($config) && array_key_exists($name, $config) ? $config[$name] : getenv($name);
    return false === $value ? $default : trim((string)$value);
}

function db(): PDO {
    static $dbh = null;
    if ($dbh instanceof PDO) return $dbh;
    $host = envValue('MOVIEMEET_DB_HOST', '127.0.0.1');
    $name = envValue('MOVIEMEET_DB_NAME');
    $user = envValue('MOVIEMEET_DB_USER');
    $pass = envValue('MOVIEMEET_DB_PASS');
    if ('' === $name || '' === $user) throw new RuntimeException('Database is not configured');
    $dbh = new PDO("mysql:host=$host;dbname=$name;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    ensureSchema($dbh);
    return $dbh;
}

function ensureSchema(PDO $dbh): void {
    static $ready = false;
    if ($ready) return;
    $dbh->exec("CREATE TABLE IF NOT EXISTS mm_users (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $dbh->exec("CREATE TABLE IF NOT EXISTS mm_sessions (token CHAR(64) PRIMARY KEY, user_id INT UNSIGNED NOT NULL, expires_at DATETIME NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(user_id), CONSTRAINT mm_sessions_user FOREIGN KEY(user_id) REFERENCES mm_users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $dbh->exec("CREATE TABLE IF NOT EXISTS mm_events (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, token CHAR(32) NOT NULL UNIQUE, organizer_id INT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL, date_start DATE NOT NULL, date_end DATE NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT mm_events_user FOREIGN KEY(organizer_id) REFERENCES mm_users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $dbh->exec("CREATE TABLE IF NOT EXISTS mm_participants (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id INT UNSIGNED NOT NULL, user_id INT UNSIGNED NULL, name VARCHAR(80) NOT NULL, city VARCHAR(80) NOT NULL, availability JSON NOT NULL, genres JSON NOT NULL, disliked_genres JSON NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY mm_participant_user (event_id,user_id), CONSTRAINT mm_participants_event FOREIGN KEY(event_id) REFERENCES mm_events(id) ON DELETE CASCADE, CONSTRAINT mm_participants_user FOREIGN KEY(user_id) REFERENCES mm_users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    try { $dbh->exec('ALTER TABLE mm_participants ADD COLUMN disliked_genres JSON NULL'); } catch (PDOException) { }
    $dbh->exec("CREATE TABLE IF NOT EXISTS mm_cinemas (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, network VARCHAR(50) NOT NULL, name VARCHAR(100) NOT NULL, city VARCHAR(80) NOT NULL, latitude DECIMAL(10,7) NOT NULL, longitude DECIMAL(10,7) NOT NULL, booking_url VARCHAR(500) NOT NULL, UNIQUE KEY mm_cinema_name (network,name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $dbh->exec("CREATE TABLE IF NOT EXISTS mm_candidates (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id INT UNSIGNED NOT NULL, cinema_id INT UNSIGNED NOT NULL, tmdb_id INT NULL, movie_title VARCHAR(180) NOT NULL, poster_path VARCHAR(300) NULL, genres JSON NOT NULL, show_date DATE NOT NULL, show_time TIME NOT NULL, booking_url VARCHAR(500) NOT NULL, seats_checked TINYINT(1) NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT mm_candidates_event FOREIGN KEY(event_id) REFERENCES mm_events(id) ON DELETE CASCADE, CONSTRAINT mm_candidates_cinema FOREIGN KEY(cinema_id) REFERENCES mm_cinemas(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $dbh->exec("CREATE TABLE IF NOT EXISTS mm_votes (participant_id INT UNSIGNED NOT NULL, candidate_id INT UNSIGNED NOT NULL, vote TINYINT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(participant_id,candidate_id), CONSTRAINT mm_votes_participant FOREIGN KEY(participant_id) REFERENCES mm_participants(id) ON DELETE CASCADE, CONSTRAINT mm_votes_candidate FOREIGN KEY(candidate_id) REFERENCES mm_candidates(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $seed = [
        ['Cinema City','סינמה סיטי גלילות','רמת השרון',32.1465,34.8392,'https://www.cinema-city.co.il/'],
        ['Cinema City','סינמה סיטי ראשון לציון','ראשון לציון',31.9707,34.7894,'https://www.cinema-city.co.il/'],
        ['Cinema City','סינמה סיטי ירושלים','ירושלים',31.7963,35.2087,'https://www.cinema-city.co.il/'],
        ['HOT Cinema','HOT סינמה מודיעין','מודיעין',31.9006,34.9931,'https://www.hotcinema.co.il/theater/1'],
        ['HOT Cinema','HOT סינמה קריון','קריית ביאליק',32.8280,35.0840,'https://www.hotcinema.co.il/'],
        ['MovieLand','מובילנד נתניה','נתניה',32.3030,34.8625,'https://www.movieland.co.il/'],
    ];
    $stmt = $dbh->prepare('INSERT IGNORE INTO mm_cinemas(network,name,city,latitude,longitude,booking_url) VALUES(?,?,?,?,?,?)');
    foreach ($seed as $cinema) $stmt->execute($cinema);
    $ready = true;
}

function respond(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body(): array {
    $data = json_decode((string)file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function cleanText(mixed $value, int $limit): string {
    $value = trim((string)$value);
    return function_exists('mb_substr') ? mb_substr($value, 0, $limit, 'UTF-8') : substr($value, 0, $limit);
}

function textLower(string $value): string {
    return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
}

function randomToken(int $bytes = 16): string { return bin2hex(random_bytes($bytes)); }

function currentUser(PDO $dbh): ?array {
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    $headerToken = preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $header, $matches) ? $matches[1] : '';
    $customToken = (string)($_SERVER['HTTP_X_AUTH_TOKEN'] ?? '');
    $token = $headerToken ?: (preg_match('/^[a-f0-9]{64}$/i', $customToken) ? $customToken : '');
    if ('' === $token) return null;
    $stmt = $dbh->prepare('SELECT u.id,u.name,u.email FROM mm_sessions s JOIN mm_users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>UTC_TIMESTAMP()');
    $stmt->execute([$token]);
    return $stmt->fetch() ?: null;
}

function requireUser(PDO $dbh): array {
    $user = currentUser($dbh);
    if (!$user) respond(['error' => 'נדרשת התחברות'], 401);
    return $user;
}

function jsonList(mixed $value): array {
    if (is_string($value)) $value = json_decode($value, true);
    return is_array($value) ? array_values($value) : [];
}

function eventByToken(PDO $dbh, string $token): array {
    $stmt = $dbh->prepare('SELECT * FROM mm_events WHERE token=?');
    $stmt->execute([$token]);
    $event = $stmt->fetch();
    if (!$event) respond(['error' => 'המפגש לא נמצא'], 404);
    return $event;
}

function participantFor(PDO $dbh, int $eventId, ?int $userId): ?array {
    if (!$userId) return null;
    $stmt = $dbh->prepare('SELECT * FROM mm_participants WHERE event_id=? AND user_id=?');
    $stmt->execute([$eventId, $userId]);
    return $stmt->fetch() ?: null;
}

function minutesBetween(float $lat1, float $lng1, float $lat2, float $lng2): int {
    $earth = 6371;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return (int)round((2 * $earth * atan2(sqrt($a), sqrt(1 - $a)) * 1.35 / 35) * 60);
}

function travelMinutes(string $city, float $destinationLat, float $destinationLng): int {
    static $memoryCache = [];
    $origin = cityCoordinates($city);
    if (!$origin) return 90;
    $cacheKey = "$city:$destinationLat:$destinationLng";
    if (isset($memoryCache[$cacheKey])) return $memoryCache[$cacheKey];
    $fallback = minutesBetween($origin[0], $origin[1], $destinationLat, $destinationLng);
    $apiKey = envValue('MOVIEMEET_GOOGLE_MAPS_API_KEY');
    if ('' === $apiKey) return $memoryCache[$cacheKey] = $fallback;
    $url = 'https://maps.googleapis.com/maps/api/directions/json?origin=' . rawurlencode($origin[0] . ',' . $origin[1]) . '&destination=' . rawurlencode($destinationLat . ',' . $destinationLng) . '&mode=driving&key=' . rawurlencode($apiKey);
    $raw = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 5]]));
    $data = is_string($raw) ? json_decode($raw, true) : [];
    $seconds = (int)($data['routes'][0]['legs'][0]['duration']['value'] ?? 0);
    return $memoryCache[$cacheKey] = $seconds > 0 ? (int)ceil($seconds / 60) : $fallback;
}

function cityCoordinates(string $city): ?array {
    $cities = ['תל אביב'=>[32.0853,34.7818],'תל אביב-יפו'=>[32.0853,34.7818],'ירושלים'=>[31.7683,35.2137],'ראשון לציון'=>[31.9730,34.7925],'בת ים'=>[32.0231,34.7503],'חולון'=>[32.0114,34.7745],'חיפה'=>[32.7940,34.9896],'מודיעין'=>[31.8977,34.9885],'נתניה'=>[32.3215,34.8532],'רמת גן'=>[32.0823,34.8106],'פתח תקווה'=>[32.0871,34.8878],'הרצליה'=>[32.1624,34.8447],'באר שבע'=>[31.2530,34.7915],'רחובות'=>[31.8928,34.8113],'אשדוד'=>[31.8014,34.6435],'אשקלון'=>[31.6688,34.5743]];
    return $cities[$city] ?? null;
}
