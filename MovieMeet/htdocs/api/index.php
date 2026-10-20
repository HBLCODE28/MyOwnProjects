<?php
declare(strict_types=1);
$configPath = __DIR__ . '/config.php';
if (is_file($configPath)) {
    $config = require $configPath;
    $GLOBALS['moviemeetConfig'] = is_array($config) ? $config : [];
}
require_once __DIR__ . '/lib.php';

try {
    $dbh = db();
    $action = cleanText($_GET['action'] ?? $_SERVER['HTTP_X_MOVIEMEET_ACTION'] ?? '', 40);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ('register' === $action && 'POST' === $method) {
        respond(['error' => 'ההרשמה סגורה. האתר פתוח לשימוש ללא חשבון.'], 403);
        $input = body();
        $name = cleanText($input['name'] ?? '', 80);
        $email = strtolower(cleanText($input['email'] ?? '', 254));
        $password = (string)($input['password'] ?? '');
        if ('' === $name || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) respond(['error' => 'יש למלא שם, אימייל תקין וסיסמה של 8 תווים לפחות'], 422);
        $stmt = $dbh->prepare('INSERT INTO mm_users(name,email,password_hash) VALUES(?,?,?)');
        try { $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]); } catch (PDOException $e) { respond(['error' => 'האימייל כבר רשום'], 409); }
        $userId = (int)$dbh->lastInsertId();
        $token = randomToken(32);
        $dbh->prepare('INSERT INTO mm_sessions(token,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))')->execute([$token, $userId]);
        respond(['token' => $token, 'user' => ['id' => $userId, 'name' => $name, 'email' => $email]], 201);
    }

    if ('login' === $action && 'POST' === $method) {
        $input = body();
        $email = strtolower(cleanText($input['email'] ?? '', 254));
        $stmt = $dbh->prepare('SELECT * FROM mm_users WHERE email=?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify((string)($input['password'] ?? ''), $user['password_hash'])) respond(['error' => 'האימייל או הסיסמה אינם נכונים'], 401);
        $token = randomToken(32);
        $dbh->prepare('INSERT INTO mm_sessions(token,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))')->execute([$token, $user['id']]);
        respond(['token' => $token, 'user' => ['id' => (int)$user['id'], 'name' => $user['name'], 'email' => $user['email']]]);
    }

    if ('me' === $action) respond(['user' => currentUser($dbh)]);

    if ('meetings' === $action) {
        $user = requireUser($dbh);
        $stmt = $dbh->prepare('SELECT DISTINCT e.token,e.name,e.date_start,e.date_end FROM mm_events e LEFT JOIN mm_participants p ON p.event_id=e.id AND p.user_id=? WHERE e.organizer_id=? OR p.user_id=? ORDER BY e.date_start DESC,e.created_at DESC');
        $stmt->execute([$user['id'], $user['id'], $user['id']]);
        respond(['user' => $user, 'meetings' => $stmt->fetchAll()]);
    }

    if ('admin-stats' === $action) {
        $user = requireUser($dbh);
        if (empty($user['is_admin'])) respond(['error' => 'ניהול מורשה למנהל בלבד'], 403);
        respond(['events' => (int)$dbh->query('SELECT COUNT(*) FROM mm_events')->fetchColumn(), 'participants' => (int)$dbh->query('SELECT COUNT(*) FROM mm_participants')->fetchColumn(), 'candidates' => (int)$dbh->query('SELECT COUNT(*) FROM mm_candidates')->fetchColumn()]);
    }

    if ('cinemas' === $action) {
        $rows = $dbh->query('SELECT id,network,name,city,latitude,longitude,booking_url FROM mm_cinemas ORDER BY network,name')->fetchAll();
        $city = cleanText($_GET['city'] ?? '', 80);
        $local = array_values(array_filter($rows, static fn(array $cinema): bool => textLower($cinema['city']) === textLower($city)));
        if ($city && !$local && cityCoordinates($city)) {
            usort($rows, static fn(array $first, array $second): int => travelMinutes($city, (float)$first['latitude'], (float)$first['longitude']) <=> travelMinutes($city, (float)$second['latitude'], (float)$second['longitude']));
            $rows = array_slice($rows, 0, 5);
        } elseif ($local) {
            $rows = $local;
        }
        respond(['cinemas' => $rows, 'exact' => (bool)$local, 'nearby' => (bool)($city && !$local && cityCoordinates($city))]);
    }

    if ('meeting-create' === $action && 'POST' === $method) {
        $input = body();
        $name = cleanText($input['name'] ?? '', 120);
        $start = cleanText($input['date_start'] ?? '', 10);
        $end = cleanText($input['date_end'] ?? '', 10);
        if ('' === $name || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end) || $end < $start) respond(['error' => 'יש למלא שם וטווח תאריכים תקין'], 422);
        $token = randomToken(16);
        $manager = randomToken(32); $adminId = (int)$dbh->query('SELECT id FROM mm_users ORDER BY id LIMIT 1')->fetchColumn();
        if (!$adminId) respond(['error' => 'יש להגדיר מנהל מערכת פעם אחת לפני יצירת מפגש'], 503);
        $dbh->prepare('INSERT INTO mm_events(token,manage_token,organizer_id,name,date_start,date_end) VALUES(?,?,?,?,?,?)')->execute([$token, $manager, $adminId, $name, $start, $end]);
        respond(['token' => $token, 'manage_token' => $manager], 201);
    }

    if ('meeting' === $action) {
        $token = cleanText($_GET['token'] ?? '', 32);
        $event = eventByToken($dbh, $token);
        $participantsStmt = $dbh->prepare('SELECT id,name,city,availability,genres,disliked_genres FROM mm_participants WHERE event_id=? ORDER BY created_at');
        $participantsStmt->execute([$event['id']]);
        $participants = $participantsStmt->fetchAll();
        foreach ($participants as &$participant) { $participant['availability'] = jsonList($participant['availability']); $participant['genres'] = jsonList($participant['genres']); $participant['disliked_genres'] = jsonList($participant['disliked_genres']); }
        $candidateStmt = $dbh->prepare('SELECT c.*,ci.network,ci.name cinema_name,ci.city cinema_city,ci.latitude,ci.longitude FROM mm_candidates c JOIN mm_cinemas ci ON ci.id=c.cinema_id WHERE c.event_id=? ORDER BY c.show_date,c.show_time');
        $candidateStmt->execute([$event['id']]);
        $candidates = $candidateStmt->fetchAll();
        $myParticipant = participantByToken($dbh, (int)$event['id']);
        foreach ($candidates as &$candidate) {
            $candidate['genres'] = jsonList($candidate['genres']);
            $candidate['score'] = recommendationScore($candidate, $participants);
            $voteStmt = $dbh->prepare('SELECT SUM(vote=1) yes_votes,SUM(vote=-1) no_votes FROM mm_votes WHERE candidate_id=?');
            $voteStmt->execute([$candidate['id']]);
            $candidate['votes'] = $voteStmt->fetch() ?: ['yes_votes' => 0, 'no_votes' => 0];
            $candidate['my_vote'] = null;
            if ($myParticipant) { $voteStmt = $dbh->prepare('SELECT vote FROM mm_votes WHERE participant_id=? AND candidate_id=?'); $voteStmt->execute([$myParticipant['id'], $candidate['id']]); $candidate['my_vote'] = $voteStmt->fetchColumn() ?: null; }
        }
        usort($candidates, static fn(array $a, array $b): int => $b['score']['total'] <=> $a['score']['total']);
        respond(['event' => ['token' => $event['token'], 'name' => $event['name'], 'date_start' => $event['date_start'], 'date_end' => $event['date_end'], 'is_organizer' => eventManager($event)], 'participants' => $participants, 'candidates' => $candidates, 'my_participant' => $myParticipant ? ['id' => (int)$myParticipant['id'], 'name' => $myParticipant['name'], 'city' => $myParticipant['city'], 'availability' => jsonList($myParticipant['availability']), 'genres' => jsonList($myParticipant['genres']), 'disliked_genres' => jsonList($myParticipant['disliked_genres'] ?? null)] : null]);
    }

    if ('join' === $action && 'POST' === $method) {
        $event = eventByToken($dbh, cleanText($_GET['token'] ?? '', 32));
        $input = body();
        $name = cleanText($input['name'] ?? '', 80);
        $city = cleanText($input['city'] ?? '', 80);
        $availability = array_values(array_filter($input['availability'] ?? [], static fn($row): bool => is_array($row) && isset($row['date'], $row['start'], $row['end'])));
        $genres = array_values(array_filter(array_map(static fn($genre): string => cleanText($genre, 40), $input['genres'] ?? [])));
        $dislikedGenres = array_values(array_filter(array_map(static fn($genre): string => cleanText($genre, 40), $input['disliked_genres'] ?? [])));
        if ('' === $name || '' === $city || !$availability) respond(['error' => 'יש למלא שם, עיר ולפחות חלון זמן אחד'], 422);
        $participant = participantByToken($dbh, (int)$event['id']); $participantToken = $participant['participant_token'] ?? randomToken(32);
        if ($participant) { $stmt = $dbh->prepare('UPDATE mm_participants SET name=?,city=?,availability=?,genres=?,disliked_genres=? WHERE id=?'); $stmt->execute([$name,$city,json_encode($availability),json_encode($genres),json_encode($dislikedGenres),$participant['id']]); }
        else { $stmt = $dbh->prepare('INSERT INTO mm_participants(event_id,name,city,availability,genres,disliked_genres,participant_token) VALUES(?,?,?,?,?,?,?)'); $stmt->execute([$event['id'],$name,$city,json_encode($availability),json_encode($genres),json_encode($dislikedGenres),$participantToken]); }
        respond(['ok' => true, 'participant_token' => $participantToken]);
    }

    if ('candidate-create' === $action && 'POST' === $method) {
        $event = eventByToken($dbh, cleanText($_GET['token'] ?? '', 32));
        if (!eventManager($event)) respond(['error' => 'רק יוצר המפגש יכול להוסיף הקרנה'], 403);
        $input = body();
        $cinemaId = (int)($input['cinema_id'] ?? 0);
        $title = cleanText($input['movie_title'] ?? '', 180);
        $date = cleanText($input['show_date'] ?? '', 10);
        $time = cleanText($input['show_time'] ?? '', 5);
        if (!$cinemaId || '' === $title || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time) || $date < $event['date_start'] || $date > $event['date_end']) respond(['error' => 'יש למלא קולנוע, סרט ותאריך ושעה בתוך טווח המפגש'], 422);
        $stmt = $dbh->prepare('SELECT booking_url FROM mm_cinemas WHERE id=?'); $stmt->execute([$cinemaId]); $url = (string)$stmt->fetchColumn();
        if ('' === $url) respond(['error' => 'הקולנוע לא נמצא'], 404);
        $genres = array_values(array_filter(array_map(static fn($genre): string => cleanText($genre, 40), $input['genres'] ?? [])));
        $dbh->prepare('INSERT INTO mm_candidates(event_id,cinema_id,tmdb_id,movie_title,poster_path,genres,show_date,show_time,booking_url) VALUES(?,?,?,?,?,?,?,?,?)')->execute([$event['id'], $cinemaId, (int)($input['tmdb_id'] ?? 0) ?: null, $title, cleanText($input['poster_path'] ?? '', 300) ?: null, json_encode($genres), $date, $time . ':00', $url]);
        respond(['ok' => true], 201);
    }

    if ('candidate-delete' === $action && 'POST' === $method) {
        $event = eventByToken($dbh, cleanText($_GET['token'] ?? '', 32));
        if (!eventManager($event)) respond(['error' => 'רק יוצר המפגש יכול למחוק הקרנה'], 403);
        $candidateId = (int)(body()['candidate_id'] ?? 0);
        if (!$candidateId) respond(['error' => 'הקרנה לא תקינה'], 422);
        $stmt = $dbh->prepare('DELETE FROM mm_candidates WHERE id=? AND event_id=?');
        $stmt->execute([$candidateId, $event['id']]);
        if (!$stmt->rowCount()) respond(['error' => 'ההקרנה לא נמצאה'], 404);
        respond(['ok' => true]);
    }

    if ('vote' === $action && 'POST' === $method) {
        $event = eventByToken($dbh, cleanText($_GET['token'] ?? '', 32));
        $participant = participantByToken($dbh, (int)$event['id']);
        if (!$participant) respond(['error' => 'יש לשמור את ההעדפות לפני הצבעה'], 403);
        $input = body(); $candidateId = (int)($input['candidate_id'] ?? 0); $vote = (int)($input['vote'] ?? 0);
        if (!$candidateId || !in_array($vote, [-1, 1], true)) respond(['error' => 'הצבעה לא תקינה'], 422);
        $check = $dbh->prepare('SELECT 1 FROM mm_candidates WHERE id=? AND event_id=?'); $check->execute([$candidateId, $event['id']]); if (!$check->fetchColumn()) respond(['error' => 'ההצעה לא נמצאה'], 404);
        $dbh->prepare('INSERT INTO mm_votes(participant_id,candidate_id,vote) VALUES(?,?,?) ON DUPLICATE KEY UPDATE vote=VALUES(vote),created_at=UTC_TIMESTAMP()')->execute([$participant['id'], $candidateId, $vote]);
        respond(['ok' => true]);
    }

    if ('seats-checked' === $action && 'POST' === $method) {
        $event = eventByToken($dbh, cleanText($_GET['token'] ?? '', 32));
        $participant = participantByToken($dbh, (int)$event['id']);
        if (!$participant) respond(['error' => 'יש לשמור את ההעדפות לפני אישור'], 403);
        $candidateId = (int)(body()['candidate_id'] ?? 0);
        $dbh->prepare('UPDATE mm_candidates SET seats_checked=1 WHERE id=? AND event_id=?')->execute([$candidateId, $event['id']]);
        respond(['ok' => true]);
    }

    respond(['error' => 'הפעולה לא נמצאה'], 404);
} catch (Throwable $error) {
    error_log('MovieMeet API error: ' . $error->getMessage());
    respond(apiErrorResponse($error), 500);
}

function apiErrorResponse(Throwable $error): array {
    $message = $error->getMessage();
    if (str_contains($message, 'Database is not configured')) return ['error' => 'חסרים פרטי מסד הנתונים בקובץ config.php.', 'code' => 'DATABASE_CONFIG'];
    if (str_contains($message, 'Unknown database')) return ['error' => 'שם מסד הנתונים לא נמצא. יש לבדוק את MOVIEMEET_DB_NAME.', 'code' => 'DATABASE_NOT_FOUND'];
    if (str_contains($message, 'Access denied')) return ['error' => 'שם המשתמש, הסיסמה או ההרשאות למסד הנתונים אינם תקינים.', 'code' => 'DATABASE_ACCESS'];
    if (str_contains($message, 'Connection refused') || str_contains($message, 'getaddrinfo') || str_contains($message, 'No route to host')) return ['error' => 'לא ניתן להתחבר לשרת מסד הנתונים. יש לבדוק את MOVIEMEET_DB_HOST.', 'code' => 'DATABASE_CONNECTION'];
    if (str_contains($message, "doesn't exist") || str_contains($message, 'Base table or view not found')) return ['error' => 'טבלאות MovieMeet חסרות במסד הנתונים. יש להריץ את DATABASE_SETUP.txt ב־phpMyAdmin.', 'code' => 'DATABASE_TABLES'];
    return ['error' => 'אירעה שגיאת שרת. נסו שוב בעוד רגע.', 'code' => 'SERVER_ERROR'];
}

function recommendationScore(array $candidate, array $participants): array {
    $count = max(1, count($participants));
    $showAt = $candidate['show_date'] . ' ' . substr($candidate['show_time'], 0, 5);
    $available = 0; $genrePoints = 0; $travelMinutes = [];
    foreach ($participants as $participant) {
        foreach ($participant['availability'] as $window) {
            if ($window['date'] === $candidate['show_date'] && $window['start'] <= substr($candidate['show_time'], 0, 5) && $window['end'] >= substr($candidate['show_time'], 0, 5)) { $available++; break; }
        }
        $likes = array_map('textLower', $participant['genres']);
        $dislikes = array_map('textLower', $participant['disliked_genres'] ?? []);
        $movieGenres = array_map('textLower', $candidate['genres']);
        $genrePoints += array_intersect($dislikes, $movieGenres) ? 0 : (!$likes ? .5 : (array_intersect($likes, $movieGenres) ? 1 : 0));
        $origin = cityCoordinates($participant['city']);
        if ($origin) $travelMinutes[] = travelMinutes($participant['city'], (float)$candidate['latitude'], (float)$candidate['longitude']);
    }
    $availability = round(45 * $available / $count);
    $genres = round(35 * $genrePoints / $count);
    $maxTravel = $travelMinutes ? max($travelMinutes) : 90;
    $travel = max(0, round(20 * (1 - min($maxTravel, 120) / 120)));
    return ['total' => $availability + $genres + $travel, 'available' => $available, 'participant_count' => $count, 'availability' => $availability, 'genres' => $genres, 'travel' => $travel, 'max_travel_minutes' => $maxTravel, 'show_at' => $showAt];
}
