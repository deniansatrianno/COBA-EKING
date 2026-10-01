<?php
declare(strict_types=1);

/*
 * Buat/atur ulang password akun Admin dari command line (tidak bisa dijalankan lewat browser).
 * Contoh (XAMPP Windows):
 *   C:\xampp\php\php.exe C:\xampp\htdocs\wvms\backend\tools\reset_admin.php admin@perusahaan.co.id PasswordBaru123
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Hanya dapat dijalankan dari command line.\n");
}

require_once __DIR__ . '/../schema.php';

$email = strtolower(trim((string)($argv[1] ?? '')));
$pass = (string)($argv[2] ?? '');
$nama = (string)($argv[3] ?? 'Administrator');
if ($email === '' || strlen($pass) < 8) {
    fwrite(STDERR, "Pemakaian: php reset_admin.php email password(min 8 karakter) [nama]\n");
    exit(1);
}

try {
    $pdo = db();
    ensureSchema($pdo);
    $col = userPasswordColumn($pdo);
    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $st = $pdo->prepare('SELECT id FROM `users` WHERE LOWER(email) = ? LIMIT 1');
    $st->execute([$email]);
    $id = $st->fetchColumn();
    if ($id) {
        $pdo->prepare('UPDATE `users` SET ' . qid($col) . ' = ?, `role` = ?, `status` = ? WHERE `id` = ?')->execute([$hash, 'Admin', 'Aktif', $id]);
        echo "Password akun $email diperbarui (role Admin, status Aktif).\n";
    } else {
        $pdo->prepare('INSERT INTO `users` (`nama`, `email`, ' . qid($col) . ', `role`, `status`) VALUES (?, ?, ?, ?, ?)')->execute([$nama, $email, $hash, 'Admin', 'Aktif']);
        echo "Akun Admin $email dibuat.\n";
    }
} catch (Throwable $e) {
    fwrite(STDERR, 'Gagal: ' . $e->getMessage() . "\n");
    exit(1);
}
