<?php
declare(strict_types=1);

// Port of src/games.js, trimmed to the three live modes (pin, odd, north). This is the
// sole round-generation authority for competitive play: the browser's copy of games.js
// is never consulted for competitive rounds, only for local untimed practice. So this
// file does not need to reproduce the old Node server's exact byte-for-byte PRNG output;
// it only needs to be internally deterministic, so every player who starts the same
// mode on the same UTC date sees the same sequence of rounds.

function coordinates(array $place): array {
  return [$place['longitude'], $place['latitude']];
}

function distance_km(array $a, array $b): float {
  [$lon1, $lat1] = $a;
  [$lon2, $lat2] = $b;
  $radians = M_PI / 180;
  $x = sin(($lat2 - $lat1) * $radians / 2) ** 2
    + cos($lat1 * $radians) * cos($lat2 * $radians) * sin(($lon2 - $lon1) * $radians / 2) ** 2;
  return 6371 * 2 * asin(sqrt(min(1, max(0, $x))));
}

function shuffled(array $items, DailyRandom $random): array {
  $result = array_values($items);
  for ($i = count($result) - 1; $i > 0; $i -= 1) {
    $j = (int) floor($random->next() * ($i + 1));
    [$result[$i], $result[$j]] = [$result[$j], $result[$i]];
  }
  return $result;
}

// FNV-1a seed + a 32-bit LCG, same shape as dailyRandom() in games.js. PHP ints are
// 64-bit so each step is masked back down to 32 bits to match the JS Math.imul/>>>0
// truncation behaviour.
final class DailyRandom {
  private int $value;

  public function __construct(int $value) {
    $this->value = $value & 0xFFFFFFFF;
  }

  public static function fromSeed(string $seed): self {
    $value = 2166136261;
    $length = strlen($seed);
    for ($i = 0; $i < $length; $i += 1) {
      $value = (($value ^ ord($seed[$i])) * 16777619) & 0xFFFFFFFF;
    }
    return new self($value);
  }

  public function next(): float {
    $this->value = (($this->value * 1664525) + 1013904223) & 0xFFFFFFFF;
    return $this->value / 4294967296;
  }

  public function state(): int {
    return $this->value;
  }
}

function redact_band(?array $band, bool $includeListeners): ?array {
  if ($band === null) return null;
  $out = ['id' => $band['id'], 'name' => $band['name']];
  if ($includeListeners) $out['monthlyListeners'] = $band['monthlyListeners'];
  return $out;
}

// Mirrors the redaction block in server.mjs's publicState(): while a round is still
// unanswered, strip anything that would let the client infer the correct answer early.
function public_round(string $mode, array $round): array {
  if (!empty($round['answered'])) return $round;
  unset($round['answer'], $round['commonPlace']);
  if ($mode === 'odd') unset($round['band']);
  $includeListeners = $mode === 'odd';
  if (isset($round['band'])) $round['band'] = redact_band($round['band'], $includeListeners);
  if ($mode === 'odd' && isset($round['options'])) {
    $round['options'] = array_map(fn($b) => redact_band($b, $includeListeners), $round['options']);
  }
  return $round;
}

final class MusicGame {
  public string $mode;
  public array $data;
  public string $date;
  private DailyRandom $random;
  public int $index = 0;
  public int $score = 0;
  public int $streak = 0;
  public int $bestStreak = 0;
  public array $used = [];
  public bool $over = false;
  public ?array $round = null;

  public function __construct(string $mode, array $data, array $options = []) {
    if (!in_array($mode, MODES, true)) throw new InvalidArgumentException('Unknown game');
    $this->mode = $mode;
    $this->data = $data;
    $this->date = $options['date'] ?? gmdate('Y-m-d');

    if (isset($options['resume'])) {
      $state = $options['resume'];
      $this->random = new DailyRandom($state['prngValue']);
      $this->index = $state['index'];
      $this->score = $state['score'];
      $this->streak = $state['streak'];
      $this->bestStreak = $state['bestStreak'];
      $this->used = array_fill_keys($state['used'], true);
      $this->over = $state['over'];
      $this->round = $state['round'];
    } else {
      $this->random = DailyRandom::fromSeed("competitive-v1:{$mode}:{$data['snapshot']}:{$this->date}");
      $this->round = $this->createRound();
    }
  }

  public static function fromRun(array $run, array $data): self {
    return new self($run['mode'], $data, ['date' => $run['date'], 'resume' => $run['state']]);
  }

  public function snapshot(): array {
    return [
      'prngValue' => $this->random->state(), 'index' => $this->index, 'score' => $this->score,
      'streak' => $this->streak, 'bestStreak' => $this->bestStreak, 'used' => array_keys($this->used),
      'over' => $this->over, 'round' => $this->round,
    ];
  }

  private function pick(array $items) {
    return $items[(int) floor($this->random->next() * count($items))];
  }

  private function band(?array $pool = null): array {
    $pool = $pool ?? $this->data['bands'];
    $level = min($this->index, 9);
    $start = (int) floor(count($pool) * ($level / 10) ** 1.5);
    $end = max($start + 1, (int) floor(count($pool) * (($level + 1) / 10) ** 1.5));
    $available = array_values(array_filter($pool, fn($b) => !isset($this->used[$b['id']])));
    $tier = array_values(array_filter(array_slice($pool, $start, $end - $start), fn($b) => !isset($this->used[$b['id']])));
    $band = $this->pick(count($tier) ? $tier : $available);
    if (!$band) throw new RuntimeException('No bands remain for this game');
    $this->used[$band['id']] = true;
    return $band;
  }

  private function createRound(): array {
    $round = ['answered' => false, 'hinted' => false, 'message' => '', 'result' => null];
    if ($this->mode === 'odd') {
      $eligible = array_values(array_filter($this->data['bands'],
        fn($b) => count($this->data['byPlace'][$b['originCluster']] ?? []) >= 3));
      $anchor = $this->band($eligible);
      $round['commonPlace'] = $anchor['originCluster'];
      $round['city'] = $anchor['originCluster'];
      $placeBands = $this->data['byPlace'][$anchor['originCluster']] ?? [];
      $companionsPool = array_values(array_filter($placeBands, fn($b) => $b['id'] !== $anchor['id']));
      $companions = array_slice(shuffled($companionsPool, $this->random), 0, 2);
      $farPool = array_values(array_filter($this->data['bands'], fn($b) => $b['originCluster'] !== $anchor['originCluster']
        && distance_km(coordinates($b), coordinates($anchor)) > 30));
      $round['band'] = $this->band($farPool);
      $options = shuffled(array_merge([$anchor], $companions, [$round['band']]), $this->random);
      $round['options'] = $options;
      foreach ($options as $b) $this->used[$b['id']] = true;
    } elseif ($this->mode === 'north') {
      $pool = $this->data['bands'];
      $round['reference'] = $this->round['band'] ?? $this->band($pool);
      $candidates = array_values(array_filter($pool, fn($b) => abs($b['latitude'] - $round['reference']['latitude']) > 0.05));
      $round['band'] = $this->band($candidates);
      $round['answer'] = $round['band']['latitude'] > $round['reference']['latitude'] ? 'north' : 'south';
    } else { // pin
      $round['band'] = $this->band();
    }
    return $round;
  }

  // Only pin offers a hint; odd and north never reach this whitelist.
  public function hint(): bool {
    if ($this->round['answered'] || $this->over) return false;
    if ($this->round['hinted'] || $this->mode !== 'pin') return false;
    $this->round['hinted'] = true;
    $band = $this->round['band'];
    $placeBands = $this->data['byPlace'][$band['originCluster']] ?? [];
    $neighbour = null;
    foreach ($placeBands as $candidate) {
      if ($candidate['id'] !== $band['id'] && $candidate['followers'] > $band['followers']) { $neighbour = $candidate; break; }
    }
    $this->round['hint'] = $neighbour
      ? "{$neighbour['name']} formed in the same place."
      : "The place starts with \u{201C}" . mb_substr($band['originCluster'], 0, 1) . "\u{201D}.";
    return true;
  }

  private function finish(bool $correct, int $points, string $message): void {
    $this->round['answered'] = true;
    $this->round['result'] = ['correct' => $correct, 'points' => $points, 'message' => $message];
    $this->score += $points;
    $this->streak = $correct ? $this->streak + 1 : 0;
    $this->bestStreak = max($this->bestStreak, $this->streak);
    if ($this->mode === 'north') {
      $bandLat = $this->round['band']['latitude'];
      $hasNext = false;
      foreach ($this->data['bands'] as $b) {
        if (!isset($this->used[$b['id']]) && abs($b['latitude'] - $bandLat) > 0.05) { $hasNext = true; break; }
      }
      $this->over = !$correct || !$hasNext;
    } else {
      $this->over = $this->index >= 9;
    }
  }

  public function submit($value): bool {
    if ($this->round['answered'] || $this->over) return false;
    $this->round['message'] = '';
    $band = $this->round['band'];
    $correct = false;
    $message = "{$band['name']} formed in {$band['originCluster']}.";
    $points = $this->round['hinted'] ? 60 : 100;

    if ($this->mode === 'pin') {
      $lon = is_array($value) ? ($value[0] ?? null) : null;
      $lat = is_array($value) ? ($value[1] ?? null) : null;
      if (!is_array($value) || count($value) !== 2 || !is_finite_number($lon) || !is_finite_number($lat)
        || abs($lon) > 180 || abs($lat) > 90) return false;
      $this->round['guess'] = [$lon, $lat];
      $distance = distance_km([$lon, $lat], coordinates($band));
      $this->round['distance'] = $distance;
      $points = (int) round(max(0, 100 * (1 - $distance / 500)) * ($this->round['hinted'] ? 0.6 : 1));
      $correct = $distance <= 50;
      $message = round($distance) . " km from {$band['originCluster']}. {$band['name']} formed here.";
    } elseif ($this->mode === 'odd') {
      $ids = array_map(fn($b) => $b['id'], $this->round['options']);
      if (!in_array($value, $ids, true)) return false;
      $this->round['choice'] = $value;
      $correct = $value === $band['id'];
      $message .= " The other three formed in {$this->round['commonPlace']}.";
    } else { // north
      if (!in_array($value, ['north', 'south'], true)) return false;
      $correct = $value === $this->round['answer'];
      $reference = $this->round['reference'];
      $message = "{$band['name']} ({$band['originCluster']}) formed {$this->round['answer']} of {$reference['name']} ({$reference['originCluster']}).";
    }

    $this->finish($correct, $this->mode === 'pin' ? $points : ($correct ? $points : 0), $message);
    return true;
  }

  public function timeout(): bool {
    if ($this->round['answered'] || $this->over) return false;
    $band = $this->round['band'];
    $this->finish(false, 0, "Time\u{2019}s up. {$band['name']} formed in {$band['originCluster']}.");
    if ($this->mode === 'odd') $this->round['result']['message'] .= " The other three formed in {$this->round['commonPlace']}.";
    if ($this->mode === 'north') $this->round['result']['message'] .= " That is {$this->round['answer']} of {$this->round['reference']['originCluster']}.";
    return true;
  }

  public function next(): bool {
    if (!$this->round['answered'] || $this->over) return false;
    $this->index += 1;
    $this->round = $this->createRound();
    return true;
  }
}
