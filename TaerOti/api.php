<?php
declare(strict_types=1);
session_name('taer_oti');
session_start(['cookie_httponly' => true, 'cookie_samesite' => 'Lax']);
require __DIR__ . '/lib/game.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(array $payload): void { echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function body(): array { $value = json_decode(file_get_contents('php://input') ?: '', true); return is_array($value) ? $value : $_POST; }
if (empty($_SESSION['player_session'])) $_SESSION['player_session'] = taer_token();
$sessionId = $_SESSION['player_session'];

try {
    $input = body();
    $action = (string)($input['action'] ?? 'state');
    if ($action === 'create') {
        [$room, $player] = taer_create_room((string)($input['name'] ?? ''), (string)($input['avatar'] ?? ''), $sessionId);
        respond(['ok' => true, 'room' => taer_public_view($room, $sessionId)]);
    }
    $code = (string)($input['room'] ?? '');
    $result = taer_with_room($code, function (&$room) use ($action, $input, $sessionId) {
        $index = taer_player_index($room, $sessionId);
        $now = taer_now();
        $room['players'] = array_values(array_filter($room['players'], fn($player) => ($player['session'] ?? '') === $sessionId || ($player['lastSeen'] ?? 0) >= $now - 8));
        $index = taer_player_index($room, $sessionId);
        if ($action === 'join') { if ($index < 0 && !hash_equals($room['invite'], (string)($input['invite'] ?? ''))) throw new RuntimeException('קישור ההזמנה אינו תקין.'); taer_join_room($room, (string)($input['name'] ?? ''), (string)($input['avatar'] ?? ''), $sessionId); $index = taer_player_index($room, $sessionId); }
        if ($index < 0) throw new RuntimeException('הדפדפן הזה אינו מחובר לחדר. הצטרפו תחילה עם שם.');
        $room['players'][$index]['lastSeen'] = $now;
        if ($action === 'rounds') { taer_require_host($room, $index); if ($room['phase'] !== 'lobby') throw new RuntimeException('אי אפשר לשנות סבבים עכשיו.'); $rounds = max(1, min((int)($input['rounds'] ?? 1), 12)); $needed = $rounds + 1; $force = !empty($input['allowRepeats']); if (count($room['players']) < $needed && !$force) throw new RuntimeException("כדי לשחק {$rounds} סבבים בלי לחזור על אותו יעד צריך לפחות {$needed} משתתפים."); $room['rounds'] = $rounds; $room['allowRepeats'] = $force; }
        if ($action === 'start') { taer_require_host($room, $index); if ($room['phase'] !== 'lobby' || count($room['players']) < TAER_MIN_PLAYERS) throw new RuntimeException('צריך לפחות 4 משתתפים כדי להתחיל.'); taer_start_round($room); }
        if ($action === 'ready') { if ($room['phase'] !== 'prep') throw new RuntimeException('שלב ההכנה הסתיים.'); $room['ready'][$room['players'][$index]['id']] = true; if (count($room['ready']) === count($room['players'])) taer_begin_turns($room); }
        if ($action === 'guess') {
            if ($room['phase'] !== 'turn') throw new RuntimeException('הניחושים סגורים כרגע.');
            $pair =& $room['pairs'][$room['turnIndex']]; $playerId = $room['players'][$index]['id']; $target = (string)($input['target'] ?? '');
            if ($pair['describer'] === $playerId || $pair['describer'] === $target) throw new RuntimeException('אי אפשר לבחור באפשרות הזאת.');
            foreach ($pair['guesses'] as $guess) if ($guess['player'] === $playerId) throw new RuntimeException('כבר שלחת ניחוש.');
            foreach ($room['pairs'] as $otherPair) foreach ($otherPair['guesses'] as $guess) if ($guess['player'] === $playerId && $guess['target'] === $target) throw new RuntimeException('כבר בחרת בשם הזה בסבב הנוכחי.');
            if (!taer_find_player($room, $target)) throw new RuntimeException('היעד לא נמצא.');
            $pair['guesses'][] = ['player' => $playerId, 'target' => $target, 'at' => microtime(true)];
            if (count($pair['guesses']) >= count($room['players']) - 1) taer_close_turn($room);
        }
        if ($action === 'next') { taer_require_host($room, $index); if ($room['phase'] !== 'roundResults') throw new RuntimeException('הסבב עדיין לא הסתיים.'); taer_start_round($room); }
        if ($action === 'new') { taer_require_host($room, $index); if ($room['phase'] !== 'final') throw new RuntimeException('המשחק עדיין פעיל.'); foreach ($room['players'] as &$p) $p['score'] = 0; unset($p); $room['phase'] = 'lobby'; $room['currentRound'] = 0; $room['rounds'] = 1; $room['roundResults'] = []; $room['endsAt'] = null; }
        return taer_public_view($room, $sessionId);
    });
    respond(['ok' => true, 'room' => $result]);
} catch (Throwable $error) { http_response_code(400); respond(['ok' => false, 'error' => $error->getMessage()]); }
