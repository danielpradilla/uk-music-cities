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

[, $player] = player_identity();
$pdo = db();
$now = now_ms();

$id = is_string($payload['id'] ?? null) ? $payload['id'] : '';
$run = load_run($pdo, $id);
if (!$run || $run['player'] !== $player || $now - $run['created'] > 30 * 60 * 1000) {
  respond(410, ['error' => 'This round has expired. Start a new game.']);
}
if (!is_int($payload['version'] ?? null) || $payload['version'] !== $run['version']) {
  respond(200, public_state($pdo, $run));
}
$action = $payload['action'] ?? null;
if (!in_array($action, ['submit', 'hint', 'next', 'timeout'], true)) {
  respond(400, ['error' => 'Unknown action.']);
}

$game = MusicGame::fromRun($run, load_game_data());

if (!$game->round['answered'] && $now >= $run['deadline']) {
  $game->timeout();
} elseif ($action === 'next') {
  if ($game->next()) {
    $run['started'] = $now;
    $run['deadline'] = $now + ROUND_SECONDS[$run['mode']] * 1000;
    $run['roundClosed'] = false;
  }
} elseif ($action === 'timeout') {
  // The browser clock can run ahead; only the server deadline (checked above) ends a round.
} else {
  $previous = $game->score;
  if ($action === 'submit') $game->submit($payload['value'] ?? null);
  elseif ($action === 'hint') $game->hint();
  $earned = $game->score - $previous;
  if ($earned > 0) {
    $bonus = (int) round($earned * 0.5 * min(1, max(0, ($run['deadline'] - $now) / (ROUND_SECONDS[$run['mode']] * 1000))));
    $game->score += $bonus;
    if ($game->round['result']) {
      $game->round['result']['points'] = $earned + $bonus;
      $game->round['result']['speedBonus'] = $bonus;
    } else {
      $game->round['message'] .= " +" . ($earned + $bonus) . " points, including {$bonus} for speed.";
    }
  }
}

$run['state'] = $game->snapshot();
if ($game->round['answered'] && !$run['roundClosed']) {
  $run['elapsed'] += min(ROUND_SECONDS[$run['mode']] * 1000, max(0, $now - $run['started']));
  $run['roundClosed'] = true;
}
if ($game->over && !$run['saved']) {
  save_score($pdo, $run);
  $run['saved'] = true;
}
$run['version'] += 1;
save_run($pdo, $run);
respond(200, public_state($pdo, $run));
