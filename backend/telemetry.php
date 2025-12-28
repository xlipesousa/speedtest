<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$rawInput = file_get_contents('php://input');
if ($rawInput === false || $rawInput === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Empty payload']);
    exit;
}

$data = json_decode($rawInput, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON payload']);
    exit;
}

$logDir = realpath(__DIR__ . '/../data');
if ($logDir === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Log directory unavailable']);
    exit;
}

$logFile = $logDir . '/telemetry-log.jsonl';
$maxEntries = 500;
$maxAgeSeconds = 60 * 60 * 24 * 30; // 30 dias

$entry = [
    'receivedAt' => gmdate('c'),
    'remoteAddr' => $_SERVER['REMOTE_ADDR'] ?? null,
    'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
    'payload' => $data
];

if (($handle = fopen($logFile, 'c+')) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to open log file']);
    exit;
}

flock($handle, LOCK_EX);

$lines = [];
while (($line = fgets($handle)) !== false) {
    $decoded = json_decode($line, true);
    if (!is_array($decoded)) {
        continue;
    }
    $lines[] = $decoded;
}

$now = time();
$lines = array_filter($lines, static function(array $item) use ($now, $maxAgeSeconds): bool {
    if (empty($item['receivedAt'])) {
        return false;
    }
    $timestamp = strtotime((string) $item['receivedAt']);
    if ($timestamp === false) {
        return false;
    }
    return ($now - $timestamp) <= $maxAgeSeconds;
});

$lines[] = $entry;
$lines = array_slice($lines, -$maxEntries);

rewind($handle);
ftruncate($handle, 0);

foreach ($lines as $line) {
    fwrite($handle, json_encode($line, JSON_UNESCAPED_SLASHES) . "\n");
}

fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);

echo json_encode(['status' => 'stored', 'entries' => count($lines)]);
