<?php
declare(strict_types=1);

const MODES = ['pin', 'odd', 'north'];
const ROUND_SECONDS = ['pin' => 18, 'odd' => 12, 'north' => 8];

// Mirrors prepareGameData() in src/games.js, trimmed to what pin/odd/north actually use:
// bands sorted by popularity, grouped by formation place. allBands/places aren't needed
// server-side because those two fields never feed round generation for these three modes.
function load_game_data(): array {
  static $data = null;
  if ($data !== null) return $data;
  $path = $_SERVER['DOCUMENT_ROOT'] . app_base() . '/data/dashboard.json';
  $dashboard = json_decode(file_get_contents($path), true);

  $bands = array_values(array_filter($dashboard['bands'], function ($band) {
    return ($band['gameEligible'] ?? false) === true
      && ($band['locationStatus'] ?? null) === 'uk'
      && ($band['placeType'] ?? null) === 'locality'
      && !empty($band['originCluster'])
      && is_finite_number($band['latitude'] ?? null)
      && is_finite_number($band['longitude'] ?? null);
  }));
  usort($bands, fn($a, $b) => ($b['followers'] <=> $a['followers']) ?: strcmp($a['id'], $b['id']));

  $byPlace = [];
  foreach ($bands as $band) $byPlace[$band['originCluster']][] = $band;

  $data = ['bands' => $bands, 'byPlace' => $byPlace, 'snapshot' => $dashboard['meta']['snapshotId']];
  return $data;
}
