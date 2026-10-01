<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

const DUMMY_HASH = '$2y$12$9emhSgiVs6BvjmfLyhj8cO/qBZ0S/3kr24LAp9M0NFgTRL2/.Uyee';

final class ApiError extends RuntimeException
{
    public int $httpStatus;

    public function __construct(string $message, int $httpStatus = 400)
    {
        parent::__construct($message);
        $this->httpStatus = $httpStatus;
    }
}

/* ---------- Respons JSON ---------- */

function respond(array $data, int $status = 200): void
{
    if (!headers_sent()) {
        http_response_code($status);
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

function failResponse(Throwable $e): void
{
    $status = 500;
    $message = 'Terjadi kesalahan pada server.';

    if ($e instanceof ApiError) {
        $status = $e->httpStatus;
        $message = $e->getMessage();
    } elseif ($e instanceof PDOException) {
        error_log('[WVMS] ' . $e->getMessage());
        $driverCode = (int)($e->errorInfo[1] ?? 0);
        if ($driverCode === 0 && preg_match('/\[(\d{4})\]/', $e->getMessage(), $m)) {
            $driverCode = (int)$m[1];   // galat koneksi: kodenya ada di teks pesan
        }
        if ($driverCode === 2002 || $driverCode === 2006) {
            $message = 'MySQL tidak dapat dihubungi. Pastikan MySQL di XAMPP sudah menyala.';
        } elseif ($driverCode === 1045) {
            $message = 'Login MySQL ditolak. Periksa DB_USER dan DB_PASS di backend/config.php.';
        } elseif ($driverCode === 1049) {
            $message = 'Database ' . DB_NAME . ' belum ada. Import database.sql lewat phpMyAdmin.';
        } else {
            $message = 'Kesalahan database. Lihat log error PHP untuk detailnya.';
        }
    } else {
        error_log('[WVMS] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    }

    $out = ['status' => 'error', 'message' => $message];
    if (APP_DEBUG) {
        $out['debug'] = $e->getMessage();
    }
    respond($out, $status);
}

/** Pasang penangkap error agar warning/fatal PHP tidak pernah bocor sebagai HTML ke frontend. */
function bootApi(): void
{
    ini_set('display_errors', '0');
    error_reporting(E_ALL);

    set_error_handler(function (int $no, string $str, string $file, int $line): bool {
        if (!(error_reporting() & $no)) {
            return false;
        }
        if (in_array($no, [E_DEPRECATED, E_USER_DEPRECATED, E_NOTICE, E_USER_NOTICE], true)) {
            error_log("[WVMS] $str ($file:$line)");
            return true;
        }
        throw new ErrorException($str, 0, $no, $file, $line);
    });

    register_shutdown_function(function (): void {
        $e = error_get_last();
        if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            if (!headers_sent()) {
                http_response_code(500);
                header('Content-Type: application/json; charset=utf-8');
            }
            $out = ['status' => 'error', 'message' => 'Kesalahan fatal pada server.'];
            if (APP_DEBUG) {
                $out['debug'] = $e['message'];
            }
            echo json_encode($out);
        }
    });

    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('X-Content-Type-Options: nosniff');
}

function requestBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new ApiError('Body permintaan harus berupa JSON yang valid.', 400);
    }
    return $decoded;
}

/** Endpoint yang mengubah data wajib POST + JSON (mencegah CSRF lewat form lintas situs). */
function requireJsonPost(): void
{
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
        throw new ApiError('Metode permintaan harus POST.', 405);
    }
    $ct = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (strpos($ct, 'application/json') === false) {
        throw new ApiError('Content-Type harus application/json.', 415);
    }
}

function qid(string $name): string
{
    return '`' . str_replace('`', '``', $name) . '`';
}

/* ---------- Validasi input ---------- */

function strLen(string $s): int
{
    return function_exists('mb_strlen') ? mb_strlen($s) : strlen($s);
}

function cut(string $s, int $max): string
{
    return function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max);
}

function reqStr(array $in, string $key, int $max, string $label): string
{
    $v = $in[$key] ?? null;
    if ($v === null || is_array($v)) {
        throw new ApiError("$label wajib diisi.", 422);
    }
    $v = trim((string)$v);
    if ($v === '') {
        throw new ApiError("$label wajib diisi.", 422);
    }
    if (strLen($v) > $max) {
        throw new ApiError("$label terlalu panjang (maksimal $max karakter).", 422);
    }
    return $v;
}

function optStr(array $in, string $key, int $max): ?string
{
    $v = $in[$key] ?? null;
    if ($v === null || is_array($v)) {
        return null;
    }
    $v = trim((string)$v);
    return $v === '' ? null : cut($v, $max);
}

function dateOpt($v, string $label): ?string
{
    if ($v === null) {
        return null;
    }
    $s = trim((string)$v);
    if ($s === '') {
        return null;
    }
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $s, $m) || !checkdate((int)$m[2], (int)$m[3], (int)$m[1])) {
        throw new ApiError("$label tidak valid (format YYYY-MM-DD).", 422);
    }
    return $s;
}

function dateReq($v, string $label): string
{
    $d = dateOpt($v, $label);
    if ($d === null) {
        throw new ApiError("$label wajib diisi.", 422);
    }
    return $d;
}

function coordOpt($v, float $min, float $max, string $label): ?string
{
    if ($v === null || $v === '') {
        return null;
    }
    if (!is_numeric($v)) {
        throw new ApiError("$label harus berupa angka.", 422);
    }
    $f = (float)$v;
    if ($f < $min || $f > $max) {
        throw new ApiError("$label harus di antara $min dan $max.", 422);
    }
    return number_format($f, 7, '.', '');
}

function jsonOrNull($v, int $maxBytes = 8000000): ?string
{
    if ($v === null || $v === '' || $v === []) {
        return null;
    }
    $s = is_string($v) ? $v : json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($s === false) {
        throw new ApiError('Data tidak dapat dikonversi ke JSON.', 422);
    }
    if (strlen($s) > $maxBytes) {
        throw new ApiError('Data terlalu besar (mis. foto). Kecilkan ukurannya.', 413);
    }
    return $s;
}

/** Field yang tidak punya kolom sendiri disimpan di meta_json agar tidak ada data yang hilang. */
function extrasJson(array $in, array $known): ?string
{
    $extra = array_diff_key($in, array_flip($known));
    return $extra ? jsonOrNull($extra) : null;
}

function decodeJson(?string $s): array
{
    if ($s === null || $s === '') {
        return [];
    }
    $d = json_decode($s, true);
    return is_array($d) ? $d : [];
}

/* ---------- Helper SQL ---------- */

function rowExists(PDO $pdo, string $table, string $column, string $value): bool
{
    $st = $pdo->prepare('SELECT 1 FROM ' . qid($table) . ' WHERE ' . qid($column) . ' = ? LIMIT 1');
    $st->execute([$value]);
    return (bool)$st->fetchColumn();
}

function dbInsert(PDO $pdo, string $table, array $row): void
{
    $cols = array_keys($row);
    $sql = 'INSERT INTO ' . qid($table) . ' (' . implode(', ', array_map('qid', $cols)) . ') VALUES ('
         . implode(', ', array_fill(0, count($cols), '?')) . ')';
    $pdo->prepare($sql)->execute(array_values($row));
}

function dbUpdate(PDO $pdo, string $table, string $pk, string $id, array $row): void
{
    unset($row[$pk]);
    $sets = [];
    foreach (array_keys($row) as $col) {
        $sets[] = qid($col) . ' = ?';
    }
    $params = array_values($row);
    $params[] = $id;
    $pdo->prepare('UPDATE ' . qid($table) . ' SET ' . implode(', ', $sets) . ' WHERE ' . qid($pk) . ' = ?')->execute($params);
}

/* ---------- Session ---------- */

function isHttps(): bool
{
    return !empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off';
}

function startSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    // Folder session khusus WVMS: umur session tidak ikut dipangkas oleh aplikasi PHP lain.
    $dir = __DIR__ . '/.sessions';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    if (is_dir($dir) && is_writable($dir)) {
        if (!is_file($dir . '/.htaccess')) {
            @file_put_contents($dir . '/.htaccess', "Require all denied\n");
        }
        session_save_path($dir);
    }
    ini_set('session.gc_maxlifetime', (string)SESSION_REMEMBER_SECONDS);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('WVMSSESS');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => isHttps(),
    ]);
    if (!session_start()) {
        throw new ApiError('Session PHP tidak dapat dimulai.', 500);
    }
}

function destroySession(): void
{
    startSession();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $p['path'],
            'domain' => $p['domain'],
            'secure' => $p['secure'],
            'httponly' => $p['httponly'],
            'samesite' => 'Lax',
        ]);
    }
    session_destroy();
}

/** User yang sedang login, diverifikasi ulang ke database (role/status selalu terbaru). */
function currentUser(): ?array
{
    startSession();
    $u = $_SESSION['user'] ?? null;
    if (!is_array($u) || empty($u['id'])) {
        return null;
    }
    $idle = (int)($_SESSION['idle'] ?? SESSION_IDLE_SECONDS);
    $last = (int)($_SESSION['last'] ?? time());
    if (time() - $last > $idle) {
        destroySession();
        return null;
    }
    $st = db()->prepare('SELECT id, nama, email, role, status FROM `users` WHERE id = ? LIMIT 1');
    $st->execute([$u['id']]);
    $fresh = $st->fetch();
    if (!$fresh || strcasecmp((string)$fresh['status'], 'Aktif') !== 0) {
        destroySession();
        return null;
    }
    $_SESSION['last'] = time();
    $_SESSION['user'] = [
        'id' => (int)$fresh['id'],
        'nama' => (string)$fresh['nama'],
        'email' => (string)$fresh['email'],
        'role' => (string)$fresh['role'],
    ];
    return $_SESSION['user'];
}

function requireLogin(): array
{
    $u = currentUser();
    if ($u === null) {
        throw new ApiError('Sesi login tidak ditemukan. Silakan login kembali.', 401);
    }
    return $u;
}

function requireRole(array $roles): array
{
    $u = requireLogin();
    if (!in_array($u['role'], $roles, true)) {
        throw new ApiError('Anda tidak memiliki izin untuk melakukan tindakan ini.', 403);
    }
    return $u;
}

function userPasswordColumn(PDO $pdo): string
{
    $st = $pdo->prepare('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN (?, ?)');
    $st->execute(['users', 'password', 'password_hash']);
    $found = $st->fetchAll(PDO::FETCH_COLUMN);
    if (in_array('password', $found, true)) {
        return 'password';
    }
    if (in_array('password_hash', $found, true)) {
        return 'password_hash';
    }
    throw new ApiError('Tabel users tidak memiliki kolom password atau password_hash.', 500);
}

/** Catat aktivitas ke log_aktivitas. Kegagalan audit tidak boleh menggagalkan operasi utama. */
function audit(string $aksi, string $detail = '', ?string $user = null): void
{
    try {
        $nama = $user ?? (string)($_SESSION['user']['nama'] ?? 'Sistem');
        db()->prepare('INSERT INTO `log_aktivitas` (`t`, `u`, `a`, `d`) VALUES (?, ?, ?, ?)')
            ->execute([(int)round(microtime(true) * 1000), cut($nama, 190), cut($aksi, 255), cut($detail, 60000)]);
    } catch (Throwable $e) {
        error_log('[WVMS] audit gagal: ' . $e->getMessage());
    }
}
