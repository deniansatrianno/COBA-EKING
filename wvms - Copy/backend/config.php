<?php
declare(strict_types=1);

/*
 * Konfigurasi WVMS.
 * Untuk mengganti kredensial MySQL tanpa mengubah file ini, buat backend/config.local.php:
 *   <?php define('DB_PASS', 'password-anda');
 * File config.local.php tidak ikut ditimpa saat update project.
 */
if (is_file(__DIR__ . '/config.local.php')) {
    require __DIR__ . '/config.local.php';
}

$__defaults = [
    'DB_HOST' => '127.0.0.1',
    'DB_NAME' => 'wvms_db',
    'DB_USER' => 'root',
    'DB_PASS' => '',
    'DB_CHARSET' => 'utf8mb4',
    'APP_TIMEZONE' => 'Asia/Jakarta',
    'APP_DEBUG' => false,                      // true = detail error teknis ikut dikirim di JSON (hanya untuk development)
    'SESSION_IDLE_SECONDS' => 28800,           // 8 jam tanpa aktivitas
    'SESSION_REMEMBER_SECONDS' => 2592000,     // 30 hari bila "Ingat saya" dicentang
    'SCHEMA_VERSION' => 3,
];
foreach ($__defaults as $__k => $__v) {
    if (!defined($__k)) {
        define($__k, $__v);
    }
}
unset($__defaults, $__k, $__v);

date_default_timezone_set(APP_TIMEZONE);
