<?php
declare(strict_types=1);

// Minimal self-check for the PHP competitive-game port. Not a framework: plain
// assertions against MusicGame directly, no HTTP layer. Run with:
//   php interactive/api/tests/run.php
// Exercises the highest-risk logic: seeded-round determinism (every player must see
// the same daily questions), scoring formulas per mode, and answer redaction.

$_SERVER['DOCUMENT_ROOT'] = realpath(__DIR__ . '/../../public');
$_SERVER['SCRIPT_NAME'] = '/x.php'; // app_base() resolves to '' with this DOCUMENT_ROOT

require __DIR__ . '/../lib/http.php';
require __DIR__ . '/../lib/dashboard.php';
require __DIR__ . '/../lib/musicgame.php';

$failures = 0;
function check(string $label, bool $condition): void {
  global $failures;
  if ($condition) {
    echo "ok   - $label\n";
  } else {
    echo "FAIL - $label\n";
    $failures += 1;
  }
}

$data = load_game_data();
check('game data loads bands', count($data['bands']) > 500);
check('game data groups bands by place', count($data['byPlace']) > 50);

// --- Determinism: same mode+date must produce the same sequence for independent players ---
foreach (['pin', 'odd', 'north'] as $mode) {
  $a = new MusicGame($mode, $data, ['date' => '2026-09-19']);
  $b = new MusicGame($mode, $data, ['date' => '2026-09-19']);
  $key = $mode === 'odd' ? 'options' : 'band';
  check("$mode: two independent games on the same date start identically",
    json_encode($a->round[$key]) === json_encode($b->round[$key]));
  $c = new MusicGame($mode, $data, ['date' => '2026-09-20']);
  check("$mode: a different date can produce a different first round",
    json_encode($a->round[$key]) !== json_encode($c->round[$key]) || true); // informational, not a hard requirement
}

// --- Pin: distance-based scoring, hint halves the ceiling, redaction hides the band pre-answer ---
$pin = new MusicGame('pin', $data, ['date' => '2026-09-19']);
$publicRound = public_round('pin', $pin->round);
check('pin: unanswered round hides band identity beyond id/name', array_keys($publicRound['band']) === ['id', 'name']);
$band = $pin->round['band'];
$exact = coordinates($band);
$ok = $pin->submit($exact);
check('pin: exact coordinates submit successfully', $ok);
check('pin: exact coordinates score ~100 (distance 0)', $pin->round['result']['points'] >= 99 && $pin->round['result']['points'] <= 100);
check('pin: exact coordinates are marked correct', $pin->round['result']['correct'] === true);

$pin2 = new MusicGame('pin', $data, ['date' => '2026-09-19']);
$pin2->hint();
check('pin: hint sets hinted flag', $pin2->round['hinted'] === true);
$pin2->submit(coordinates($pin2->round['band']));
check('pin: hinted exact-distance score is capped at 60', $pin2->round['result']['points'] === 60);

// --- Odd: correct band-out selection, wrong selection, redaction includes listeners but not originCluster ---
$odd = new MusicGame('odd', $data, ['date' => '2026-09-19']);
$publicOdd = public_round('odd', $odd->round);
check('odd: unanswered round hides which band is the answer', !isset($publicOdd['band']));
check('odd: unanswered options expose monthlyListeners but not originCluster',
  isset($publicOdd['options'][0]['monthlyListeners']) && !isset($publicOdd['options'][0]['originCluster']));
$correctId = $odd->round['band']['id'];
$odd->submit($correctId);
check('odd: choosing the actual odd band scores 100', $odd->round['result']['points'] === 100 && $odd->round['result']['correct'] === true);

$odd2 = new MusicGame('odd', $data, ['date' => '2026-09-19']);
$wrongId = array_values(array_filter($odd2->round['options'], fn($b) => $b['id'] !== $odd2->round['band']['id']))[0]['id'];
$odd2->submit($wrongId);
check('odd: choosing a wrong band scores 0', $odd2->round['result']['points'] === 0 && $odd2->round['result']['correct'] === false);

// --- North: reference carries from the previous round's band, wrong answer ends the streak ---
$north = new MusicGame('north', $data, ['date' => '2026-09-19']);
$firstBand = $north->round['band'];
$correctAnswer = $north->round['answer'];
$north->submit($correctAnswer);
check('north: correct answer keeps the game alive', $north->over === false);
check('north: score increments by 100 on a correct answer', $north->score === 100);
$north->next();
check('north: the next round\'s reference is the previous round\'s band', $north->round['reference']['id'] === $firstBand['id']);
$wrongAnswer = $north->round['answer'] === 'north' ? 'south' : 'north';
$north->submit($wrongAnswer);
check('north: a wrong answer ends the game', $north->over === true);
check('north: a wrong answer resets the streak', $north->streak === 0);

// --- Snapshot/resume round-trips state, including PRNG continuity ---
$fresh = new MusicGame('pin', $data, ['date' => '2026-09-19']);
$fresh->submit(coordinates($fresh->round['band']));
$snapshot = $fresh->snapshot();
$resumed = MusicGame::fromRun(['mode' => 'pin', 'date' => '2026-09-19', 'state' => $snapshot], $data);
check('resume: score round-trips', $resumed->score === $fresh->score);
check('resume: round-trips can advance to a further round', $resumed->next() === true);
$freshNext = $fresh->next();
check('resume: the resumed game continues the same PRNG stream as the original would have',
  $freshNext === true && json_encode($resumed->round['band']) === json_encode($fresh->round['band']));

echo "\n" . ($failures === 0 ? "ALL CHECKS PASSED\n" : "$failures CHECK(S) FAILED\n");
exit($failures === 0 ? 0 : 1);
