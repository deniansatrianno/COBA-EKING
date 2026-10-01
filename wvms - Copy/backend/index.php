<?php
declare(strict_types=1);

/*
 * WVMS API (PHP + MySQL). Semua respons berupa JSON: {"status":"success|error","message":...}
 * Endpoint: health, login, logout, me, state, sync, users, schema  (lihat API-BACKEND.md)
 */

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/entities.php';
require_once __DIR__ . '/schema.php';

bootApi();

function actionHealth(): void
{
    $pdo = db();                       // gagal koneksi -> pesan jelas lewat failResponse()
    $report = ensureSchema($pdo);
    $out = [
        'status' => 'success',
        'message' => 'Backend dan MySQL aktif.',
        'php' => PHP_VERSION,
        'database' => DB_NAME,
        'schema_version' => SCHEMA_VERSION,
    ];
    $user = currentUser();
    $out['authenticated'] = $user !== null;
    if ($user !== null) {
        $tables = [];
        foreach (['users', 'wisma', 'kunjungan', 'tiket', 'log_aktivitas', 'konfigurasi', 'app_state'] as $t) {
            $tables[$t] = (int)$pdo->query('SELECT COUNT(*) FROM ' . qid($t))->fetchColumn();
        }
        $out['tables'] = $tables;
        if ($user['role'] === 'Admin') {
            $out['schema_report'] = $report;
        }
    }
    respond($out);
}

function actionLogin(): void
{
    requireJsonPost();
    $in = requestBody();
    $email = strtolower(trim((string)($in['email'] ?? '')));
    $password = (string)($in['sandi'] ?? $in['password'] ?? '');
    $ingat = !empty($in['ingat']);
    if ($email === '' || $password === '') {
        throw new ApiError('Email dan kata sandi wajib diisi.', 422);
    }

    $pdo = db();
    ensureSchemaOnce($pdo);
    $col = userPasswordColumn($pdo);
    $st = $pdo->prepare('SELECT id, nama, email, role, status, ' . qid($col) . ' AS pw FROM `users` WHERE LOWER(email) = ? LIMIT 1');
    $st->execute([$email]);
    $user = $st->fetch();

    // password_verify tetap dijalankan walau email tidak ada (waktu respons seragam).
    $ok = password_verify($password, $user ? (string)$user['pw'] : DUMMY_HASH);
    if (!$user || !$ok) {
        audit('Login gagal', $email, 'Sistem');
        throw new ApiError('Email atau kata sandi salah.', 401);
    }
    if (strcasecmp((string)$user['status'], 'Aktif') !== 0) {
        throw new ApiError('Akun Anda tidak aktif. Hubungi administrator.', 403);
    }

    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id' => (int)$user['id'],
        'nama' => (string)$user['nama'],
        'email' => (string)$user['email'],
        'role' => (string)$user['role'],
    ];
    $_SESSION['idle'] = $ingat ? SESSION_REMEMBER_SECONDS : SESSION_IDLE_SECONDS;
    $_SESSION['last'] = time();
    if ($ingat) {
        setcookie(session_name(), session_id(), [
            'expires' => time() + SESSION_REMEMBER_SECONDS,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => isHttps(),
        ]);
    }

    if (password_needs_rehash((string)$user['pw'], PASSWORD_DEFAULT)) {
        $pdo->prepare('UPDATE `users` SET ' . qid($col) . ' = ? WHERE `id` = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    }
    $pdo->prepare('UPDATE `users` SET `last_login` = NOW() WHERE `id` = ?')->execute([$user['id']]);
    audit('Login', $email);

    respond(['status' => 'success', 'message' => 'Login berhasil.', 'user' => $_SESSION['user']]);
}

function actionLogout(): void
{
    requireJsonPost();
    $u = currentUser();
    if ($u !== null) {
        audit('Logout', $u['email']);
    }
    destroySession();
    respond(['status' => 'success', 'message' => 'Logout berhasil.']);
}

function actionState(): void
{
    $user = requireLogin();
    $pdo = db();
    ensureSchemaOnce($pdo);
    $state = buildState($pdo, $user);
    respond(['status' => 'success', 'first_run' => $state['first_run'], 'data' => $state['data'], 'user' => $user]);
}

function actionSync(): void
{
    requireJsonPost();
    $user = requireLogin();
    $in = requestBody();
    $ops = $in['ops'] ?? null;
    if (!is_array($ops)) {
        throw new ApiError('Payload harus berisi objek "ops".', 422);
    }
    $pdo = db();
    ensureSchemaOnce($pdo);
    $counts = applySync($pdo, $user, $ops);
    respond(['status' => 'success', 'message' => 'Perubahan tersimpan di MySQL.', 'applied' => $counts]);
}

try {
    $action = strtolower(trim((string)($_GET['action'] ?? '')));
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

    if ($action === 'health' && $method === 'GET') {
        actionHealth();
    } elseif ($action === 'login') {
        actionLogin();
    } elseif ($action === 'logout') {
        actionLogout();
    } elseif ($action === 'me' && $method === 'GET') {
        respond(['status' => 'success', 'user' => requireLogin()]);
    } elseif ($action === 'state' && $method === 'GET') {
        actionState();
    } elseif ($action === 'state') {
        throw new ApiError('Endpoint lama. Gunakan action=sync untuk menyimpan perubahan.', 410);
    } elseif ($action === 'sync') {
        actionSync();
    } elseif ($action === 'users' && $method === 'GET') {
        requireRole(['Admin']);
        $rows = db()->query('SELECT id, nama, email, role, status, last_login, created_at FROM `users` ORDER BY id')->fetchAll();
        respond(['status' => 'success', 'data' => $rows]);
    } elseif ($action === 'schema' && $method === 'GET') {
        requireRole(['Admin']);
        respond(['status' => 'success', 'report' => ensureSchema(db())]);
    } else {
        respond([
            'status' => 'success',
            'message' => 'WVMS PHP backend aktif.',
            'actions' => ['health', 'login', 'logout', 'me', 'state', 'sync', 'users', 'schema'],
        ]);
    }
} catch (Throwable $e) {
    failResponse($e);
}
