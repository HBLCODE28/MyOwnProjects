<?php
declare(strict_types=1);

const TAER_MIN_PLAYERS = 4;
const TAER_PREP_SECONDS = 60;
const TAER_TURN_SECONDS = 10;

function taer_now(): int { return time(); }
function taer_id(): string { return bin2hex(random_bytes(16)); }
function taer_token(): string { return bin2hex(random_bytes(24)); }

function taer_code(): string {
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $code = '';
    for ($i = 0; $i < 8; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    return $code;
}

function taer_clean_name($name): string {
    $name = trim(preg_replace('/\s+/u', ' ', (string)$name) ?? '');
    if (function_exists('mb_substr')) return mb_substr($name, 0, 40, 'UTF-8');
    preg_match_all('/./us', $name, $characters);
    return implode('', array_slice($characters[0], 0, 40));
}

function taer_lower(string $value): string {
    return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
}

function taer_avatar($value): string {
    $allowed = ['woman', 'man', 'girl', 'boy', 'senior-woman', 'senior-man'];
    return in_array($value, $allowed, true) ? $value : 'woman';
}

function taer_room_path(string $code): string {
    return __DIR__ . '/../data/' . preg_replace('/[^A-Z2-9]/', '', strtoupper($code)) . '.json';
}

function taer_with_room(string $code, callable $callback) {
    $code = strtoupper(preg_replace('/[^A-Z2-9]/', '', $code));
    if (!preg_match('/^[A-Z2-9]{8}$/', $code)) throw new RuntimeException('קוד החדר אינו תקין.');
    $path = taer_room_path($code);
    if (!is_file($path)) throw new RuntimeException('החדר לא נמצא או שכבר נסגר.');
    $handle = fopen($path, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) throw new RuntimeException('לא ניתן לגשת לחדר כרגע.');
    try {
        rewind($handle);
        $room = json_decode(stream_get_contents($handle) ?: '', true);
        if (!is_array($room)) throw new RuntimeException('נתוני החדר אינם תקינים.');
        taer_advance($room);
        $result = $callback($room);
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($room, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        fflush($handle);
        return $result;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function taer_create_room(string $name, string $avatar, string $sessionId): array {
    $name = taer_clean_name($name);
    if ($name === '') throw new RuntimeException('צריך להזין שם.');
    do { $code = taer_code(); $path = taer_room_path($code); } while (file_exists($path));
    $player = ['id' => taer_id(), 'session' => $sessionId, 'name' => $name, 'avatar' => taer_avatar($avatar), 'host' => true, 'score' => 0, 'lastSeen' => taer_now()];
    $room = [
        'code' => $code, 'invite' => taer_token(), 'created' => taer_now(), 'phase' => 'lobby', 'rounds' => 1,
        'currentRound' => 0, 'turnIndex' => -1, 'endsAt' => null, 'players' => [$player], 'assignments' => [],
        'turnOrder' => [], 'pairs' => [], 'roundResults' => [], 'ready' => [], 'allowRepeats' => false, 'notice' => null,
    ];
    if (file_put_contents($path, json_encode($room, JSON_UNESCAPED_UNICODE), LOCK_EX) === false) throw new RuntimeException('לא ניתן ליצור חדר.');
    return [$room, $player];
}

function taer_player_index(array $room, string $sessionId): int {
    foreach ($room['players'] as $index => $player) if (hash_equals($player['session'], $sessionId)) return $index;
    return -1;
}

function taer_join_room(array &$room, string $name, string $avatar, string $sessionId): array {
    $index = taer_player_index($room, $sessionId);
    if ($index >= 0) return $room['players'][$index];
    if ($room['phase'] !== 'lobby') throw new RuntimeException('המשחק כבר התחיל והחדר נעול להצטרפות.');
    $name = taer_clean_name($name);
    if ($name === '') throw new RuntimeException('צריך להזין שם.');
    foreach ($room['players'] as $player) if (taer_lower($player['name']) === taer_lower($name)) throw new RuntimeException('השם כבר קיים בחדר.');
    $player = ['id' => taer_id(), 'session' => $sessionId, 'name' => $name, 'avatar' => taer_avatar($avatar), 'host' => false, 'score' => 0, 'lastSeen' => taer_now()];
    $room['players'][] = $player;
    return $player;
}

function taer_require_host(array $room, int $playerIndex): void {
    if ($playerIndex < 0 || empty($room['players'][$playerIndex]['host'])) throw new RuntimeException('הפעולה זמינה למארגן בלבד.');
}

function taer_shuffle(array $items): array { shuffle($items); return $items; }

function taer_assignments(array $ids): array {
    for ($attempt = 0; $attempt < 100; $attempt++) {
        $targets = taer_shuffle($ids);
        $valid = true;
        foreach ($ids as $i => $id) if ($id === $targets[$i]) { $valid = false; break; }
        if ($valid) return array_combine($ids, $targets);
    }
    throw new RuntimeException('לא ניתן ליצור שיבוץ חוקי.');
}

function taer_start_round(array &$room): void {
    $room['currentRound']++;
    $ids = array_column($room['players'], 'id');
    $room['assignments'] = taer_assignments($ids);
    $room['turnOrder'] = taer_shuffle($ids);
    $room['turnIndex'] = -1;
    $room['pairs'] = [];
    foreach ($room['turnOrder'] as $id) $room['pairs'][] = ['describer' => $id, 'target' => $room['assignments'][$id], 'guesses' => []];
    $room['ready'] = [];
    $room['phase'] = 'prep';
    $room['endsAt'] = taer_now() + TAER_PREP_SECONDS;
    $room['notice'] = null;
}

function taer_begin_turns(array &$room): void {
    $room['phase'] = 'turn';
    $room['turnIndex'] = 0;
    $room['endsAt'] = taer_now() + TAER_TURN_SECONDS;
    $room['ready'] = [];
}

function taer_find_player(array $room, string $id): ?array {
    foreach ($room['players'] as $player) if ($player['id'] === $id) return $player;
    return null;
}

function taer_close_turn(array &$room): void {
    $pair =& $room['pairs'][$room['turnIndex']];
    $correct = null;
    foreach ($pair['guesses'] as $guess) if ($guess['target'] === $pair['target'] && ($correct === null || $guess['at'] < $correct['at'])) $correct = $guess;
    foreach ($room['players'] as &$player) {
        if ($player['id'] === $pair['describer']) $player['score'] += $correct ? 1 : 3;
        if ($correct && $player['id'] === $correct['player']) $player['score'] += 2;
    }
    unset($player);
    $pair['correct'] = $correct['player'] ?? null;
    if ($room['turnIndex'] + 1 < count($room['turnOrder'])) {
        $room['turnIndex']++;
        $room['endsAt'] = taer_now() + TAER_TURN_SECONDS;
        return;
    }
    $room['roundResults'][] = ['number' => $room['currentRound'], 'pairs' => $room['pairs']];
    $room['phase'] = $room['currentRound'] >= $room['rounds'] ? 'final' : 'roundResults';
    $room['endsAt'] = null;
}

function taer_advance(array &$room): void {
    $now = taer_now();
    while (($room['phase'] === 'prep' || $room['phase'] === 'turn') && is_int($room['endsAt']) && $room['endsAt'] <= $now) {
        if ($room['phase'] === 'prep') taer_begin_turns($room); else taer_close_turn($room);
    }
}

function taer_public_view(array $room, string $sessionId): array {
    $index = taer_player_index($room, $sessionId);
    if ($index < 0) throw new RuntimeException('המשתתף לא נמצא בחדר.');
    $self = $room['players'][$index];
    $current = $room['phase'] === 'turn' ? ($room['pairs'][$room['turnIndex']] ?? null) : null;
    $selected = null;
    if ($current) foreach ($current['guesses'] as $guess) if ($guess['player'] === $self['id']) $selected = $guess;
    $usedTargets = [];
    foreach ($room['pairs'] as $pair) foreach ($pair['guesses'] as $guess) if ($guess['player'] === $self['id']) $usedTargets[] = $guess['target'];
    $players = array_map(fn($p) => ['id' => $p['id'], 'name' => $p['name'], 'avatar' => $p['avatar'], 'host' => $p['host'], 'score' => $p['score']], $room['players']);
    return [
        'code' => $room['code'], 'invite' => $self['host'] ? $room['invite'] : null, 'phase' => $room['phase'], 'rounds' => $room['rounds'], 'roundNumber' => max(1, $room['currentRound']),
        'endsAt' => $room['endsAt'], 'players' => $players, 'self' => ['id' => $self['id'], 'name' => $self['name'], 'host' => $self['host'], 'avatar' => $self['avatar'], 'target' => $room['phase'] === 'prep' ? ($room['assignments'][$self['id']] ?? null) : null],
        'readyCount' => count($room['ready']), 'current' => $current ? ['describer' => $current['describer']] : null,
        'selected' => $selected['target'] ?? null, 'usedTargets' => array_values(array_unique($usedTargets)), 'roundResult' => $room['phase'] === 'roundResults' ? end($room['roundResults']) : null,
        'allResults' => $room['phase'] === 'final' ? $room['roundResults'] : [], 'canStart' => count($room['players']) >= TAER_MIN_PLAYERS,
        'notice' => $room['notice'], 'allowRepeats' => !empty($room['allowRepeats']), 'maxUniqueRounds' => max(1, count($room['players']) - 1),
    ];
}
