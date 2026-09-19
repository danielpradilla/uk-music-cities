<?php
declare(strict_types=1);

// The scores database lives one level above the domain docroot, outside anything
// Apache serves, mirroring server.mjs's "../.local-artifacts/..." convention.
function db(): PDO {
  static $pdo = null;
  if ($pdo !== null) return $pdo;
  $dir = dirname($_SERVER['DOCUMENT_ROOT']) . '/uk-music-cities-scores';
  if (!is_dir($dir)) mkdir($dir, 0700, true);
  $pdo = new PDO('sqlite:' . $dir . '/scores.sqlite');
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->exec('PRAGMA journal_mode=WAL');
  $pdo->exec('PRAGMA busy_timeout=5000');
  $pdo->exec('CREATE TABLE IF NOT EXISTS scores (
    player TEXT NOT NULL, nickname TEXT NOT NULL, mode TEXT NOT NULL, day TEXT NOT NULL,
    score INTEGER NOT NULL, elapsed INTEGER NOT NULL, updated INTEGER NOT NULL,
    PRIMARY KEY(player, mode, day)
  )');
  $pdo->exec('CREATE INDEX IF NOT EXISTS scores_board ON scores(mode, day, score DESC, elapsed ASC)');
  // "runs" replaces server.mjs's in-memory Map: PHP is stateless per request, so an
  // in-progress competitive round has to be persisted between the start/action calls
  // that make it up.
  $pdo->exec('CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY, player TEXT NOT NULL, nickname TEXT NOT NULL, mode TEXT NOT NULL,
    date TEXT NOT NULL, version INTEGER NOT NULL, state TEXT NOT NULL,
    started INTEGER NOT NULL, deadline INTEGER NOT NULL, elapsed INTEGER NOT NULL,
    round_closed INTEGER NOT NULL, saved INTEGER NOT NULL, created INTEGER NOT NULL
  )');
  $pdo->exec('CREATE INDEX IF NOT EXISTS runs_player ON runs(player)');
  return $pdo;
}

function daily_key(string $date): string {
  return $date . ':' . load_game_data()['snapshot'] . ':v1';
}

function load_run(PDO $pdo, string $id): ?array {
  if ($id === '') return null;
  $stmt = $pdo->prepare('SELECT * FROM runs WHERE id = :id');
  $stmt->execute([':id' => $id]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$row) return null;
  return [
    'id' => $row['id'], 'player' => $row['player'], 'nickname' => $row['nickname'],
    'mode' => $row['mode'], 'date' => $row['date'], 'version' => (int) $row['version'],
    'state' => json_decode($row['state'], true), 'started' => (int) $row['started'],
    'deadline' => (int) $row['deadline'], 'elapsed' => (int) $row['elapsed'],
    'roundClosed' => (bool) $row['round_closed'], 'saved' => (bool) $row['saved'],
    'created' => (int) $row['created'],
  ];
}

function save_run(PDO $pdo, array $run): void {
  $stmt = $pdo->prepare('INSERT INTO runs (id, player, nickname, mode, date, version, state, started, deadline, elapsed, round_closed, saved, created)
    VALUES (:id, :player, :nickname, :mode, :date, :version, :state, :started, :deadline, :elapsed, :round_closed, :saved, :created)
    ON CONFLICT(id) DO UPDATE SET version=excluded.version, state=excluded.state, started=excluded.started,
      deadline=excluded.deadline, elapsed=excluded.elapsed, round_closed=excluded.round_closed, saved=excluded.saved');
  $stmt->execute([
    ':id' => $run['id'], ':player' => $run['player'], ':nickname' => $run['nickname'], ':mode' => $run['mode'],
    ':date' => $run['date'], ':version' => $run['version'], ':state' => json_encode($run['state']),
    ':started' => $run['started'], ':deadline' => $run['deadline'], ':elapsed' => $run['elapsed'],
    ':round_closed' => $run['roundClosed'] ? 1 : 0, ':saved' => $run['saved'] ? 1 : 0, ':created' => $run['created'],
  ]);
}

function save_score(PDO $pdo, array $run): void {
  $stmt = $pdo->prepare('INSERT INTO scores(player,nickname,mode,day,score,elapsed,updated) VALUES(:player,:nickname,:mode,:day,:score,:elapsed,:updated)
    ON CONFLICT(player,mode,day) DO UPDATE SET nickname=excluded.nickname, score=excluded.score,
    elapsed=excluded.elapsed, updated=excluded.updated
    WHERE excluded.score > scores.score OR (excluded.score = scores.score AND excluded.elapsed < scores.elapsed)');
  $stmt->execute([
    ':player' => $run['player'], ':nickname' => $run['nickname'], ':mode' => $run['mode'], ':day' => daily_key($run['date']),
    ':score' => $run['state']['score'], ':elapsed' => $run['elapsed'], ':updated' => now_ms(),
  ]);
}

function leaderboard(PDO $pdo, string $mode, string $date, string $player): array {
  $day = daily_key($date);
  $rowsStmt = $pdo->prepare('SELECT player, nickname, score, elapsed, RANK() OVER (ORDER BY score DESC, elapsed ASC) AS rank
    FROM scores WHERE mode=:mode AND day=:day ORDER BY score DESC, elapsed ASC, updated ASC LIMIT 10');
  $rowsStmt->execute([':mode' => $mode, ':day' => $day]);
  $rows = $rowsStmt->fetchAll(PDO::FETCH_ASSOC);

  $mineStmt = $pdo->prepare('SELECT score, elapsed FROM scores WHERE player=:p AND mode=:m AND day=:d');
  $mineStmt->execute([':p' => $player, ':m' => $mode, ':d' => $day]);
  $mine = $mineStmt->fetch(PDO::FETCH_ASSOC);

  $totalStmt = $pdo->prepare('SELECT count(*) AS n FROM scores WHERE mode=:m AND day=:d');
  $totalStmt->execute([':m' => $mode, ':d' => $day]);
  $total = (int) $totalStmt->fetch(PDO::FETCH_ASSOC)['n'];

  $standing = null;
  if ($mine) {
    $aheadStmt = $pdo->prepare('SELECT count(*) AS n FROM scores WHERE mode=:m AND day=:d AND (score > :s1 OR (score = :s2 AND elapsed < :e))');
    $aheadStmt->execute([':m' => $mode, ':d' => $day, ':s1' => $mine['score'], ':s2' => $mine['score'], ':e' => $mine['elapsed']]);
    $ahead = (int) $aheadStmt->fetch(PDO::FETCH_ASSOC)['n'];

    $lowerStmt = $pdo->prepare('SELECT count(*) AS n FROM scores WHERE mode=:m AND day=:d AND player != :p AND score < :s');
    $lowerStmt->execute([':m' => $mode, ':d' => $day, ':p' => $player, ':s' => $mine['score']]);
    $lower = (int) $lowerStmt->fetch(PDO::FETCH_ASSOC)['n'];

    $standing = [
      'rank' => $ahead + 1, 'score' => (int) $mine['score'], 'elapsed' => (int) $mine['elapsed'], 'others' => $total - 1,
      'percentile' => $total > 1 ? (int) round(100 * $lower / ($total - 1)) : null,
    ];
  }

  return [
    'mode' => $mode, 'date' => $date, 'total' => $total, 'standing' => $standing,
    'rows' => array_map(fn($row) => [
      'rank' => (int) $row['rank'], 'nickname' => $row['nickname'], 'score' => (int) $row['score'],
      'elapsed' => (int) $row['elapsed'], 'you' => $row['player'] === $player,
    ], $rows),
  ];
}
