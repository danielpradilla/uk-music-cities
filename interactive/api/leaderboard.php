<?php
declare(strict_types=1);
require __DIR__ . '/lib/http.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/dashboard.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') respond(405, ['error' => 'Method not allowed.']);
$mode = $_GET['mode'] ?? '';
if (!in_array($mode, MODES, true)) respond(400, ['error' => 'Unknown game.']);

// Read-only and same-origin isn't required here, matching server.mjs: a cookie identifies
// "your" standing if present, but no cookie is issued from this endpoint.
[, $player] = player_identity();
respond(200, leaderboard(db(), $mode, gmdate('Y-m-d'), $player));
