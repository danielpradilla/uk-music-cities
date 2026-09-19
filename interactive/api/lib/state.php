<?php
declare(strict_types=1);

// Mirrors publicState() in server.mjs.
function public_state(PDO $pdo, array $run): array {
  return [
    'id' => $run['id'], 'version' => $run['version'], 'serverNow' => now_ms(),
    'deadline' => $run['deadline'], 'limit' => ROUND_SECONDS[$run['mode']] * 1000,
    'game' => [
      'mode' => $run['mode'], 'daily' => false, 'competitive' => true, 'date' => $run['date'],
      'index' => $run['state']['index'], 'score' => $run['state']['score'], 'streak' => $run['state']['streak'],
      'bestStreak' => $run['state']['bestStreak'], 'over' => $run['state']['over'],
      'round' => public_round($run['mode'], $run['state']['round']),
    ],
    'board' => $run['state']['over'] ? leaderboard($pdo, $run['mode'], $run['date'], $run['player']) : null,
  ];
}
