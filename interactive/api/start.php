<?php
declare(strict_types=1);
require __DIR__ . '/lib/http.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/dashboard.php';
require __DIR__ . '/lib/musicgame.php';
require __DIR__ . '/lib/state.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(405, ['error' => 'Method not allowed.']);
require_same_origin();
$payload = read_json_body();

if (!in_array($payload['mode'] ?? null, MODES, true)) respond(400, ['error' => 'Unknown game.']);
$nickname = is_string($payload['nickname'] ?? null) ? trim($payload['nickname']) : '';
if (!preg_match('/^[\p{L}\p{N} ._\'’-]{2,24}$/u', $nickname)) {
  respond(400, ['error' => "Use a nickname of 2\u{2013}24 letters, numbers, spaces or simple punctuation."]);
}

[$token, $player] = player_identity();
$pdo = db();
$now = now_ms();

// A run older than 30 minutes is abandoned; garbage-collect on every start.
$pdo->prepare('DELETE FROM runs WHERE created < :cutoff')->execute([':cutoff' => $now - 30 * 60 * 1000]);

$existing = $pdo->prepare('SELECT created FROM runs WHERE player = :p ORDER BY created DESC LIMIT 1');
$existing->execute([':p' => $player]);
$prior = $existing->fetch(PDO::FETCH_ASSOC);
if ($prior && $now - (int) $prior['created'] < 1000) {
  respond(429, ['error' => 'Wait a moment before starting again.']);
}
// Starting a new game abandons any previous one for this player, same as the old
// in-memory Map implementation.
$pdo->prepare('DELETE FROM runs WHERE player = :p')->execute([':p' => $player]);

$count = (int) $pdo->query('SELECT COUNT(*) AS n FROM runs')->fetch(PDO::FETCH_ASSOC)['n'];
if ($count >= 1000) respond(503, ['error' => 'The game server is busy. Try again shortly.']);

$mode = $payload['mode'];
$date = gmdate('Y-m-d');
$game = new MusicGame($mode, load_game_data(), ['date' => $date]);

$run = [
  'id' => bin2hex(random_bytes(24)), 'player' => $player, 'nickname' => $nickname, 'mode' => $mode, 'date' => $date,
  'version' => 0, 'state' => $game->snapshot(), 'started' => $now, 'deadline' => $now + ROUND_SECONDS[$mode] * 1000,
  'elapsed' => 0, 'roundClosed' => false, 'saved' => false, 'created' => $now,
];
save_run($pdo, $run);
set_player_cookie($token);
respond(200, public_state($pdo, $run));
