<?php
declare(strict_types=1);

function respond(int $status, array $payload): never {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  header('X-Content-Type-Options: nosniff');
  echo json_encode($payload);
  exit;
}

// Script lives at .../uk-music-cities/api/start.php -> app base is /uk-music-cities
function app_base(): string {
  return rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/');
}

function is_finite_number($value): bool {
  return (is_int($value) || is_float($value)) && is_finite((float) $value);
}

function read_json_body(): array {
  $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
  if (stripos($contentType, 'application/json') !== 0) respond(415, ['error' => 'Send JSON.']);
  $raw = file_get_contents('php://input', false, null, 0, 4097);
  if ($raw === false) respond(400, ['error' => 'Invalid JSON.']);
  if (strlen($raw) > 4096) respond(413, ['error' => 'Request too large.']);
  $data = json_decode($raw, true);
  if (!is_array($data) || array_is_list($data)) respond(400, ['error' => 'Invalid request.']);
  return $data;
}

function require_same_origin(): void {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  $host = parse_url($origin, PHP_URL_HOST);
  $port = parse_url($origin, PHP_URL_PORT);
  $originHost = $host && $port ? "$host:$port" : $host;
  if (!$host || $originHost !== ($_SERVER['HTTP_HOST'] ?? '')) {
    respond(403, ['error' => "Use this game\u{2019}s own page."]);
  }
}

// Returns [token, playerHash, isNewToken]. A cookie is only ever written by start.php.
function player_identity(): array {
  $cookie = $_COOKIE['music_player'] ?? '';
  $isNew = !preg_match('/^[a-f0-9]{48}$/', $cookie);
  $token = $isNew ? bin2hex(random_bytes(24)) : $cookie;
  return [$token, hash('sha256', $token), $isNew];
}

function set_player_cookie(string $token): void {
  $secure = (($_SERVER['HTTPS'] ?? '') !== '') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
  setcookie('music_player', $token, [
    'expires' => time() + 31536000,
    'path' => app_base() . '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure' => $secure,
  ]);
}

function now_ms(): int {
  return (int) round(microtime(true) * 1000);
}
