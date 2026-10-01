<?php
declare(strict_types=1);

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/entities.php';

const DEFAULT_ADMIN_EMAIL = 'admin@perusahaan.co.id';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

function tableExists(PDO $pdo, string $table): bool
{
    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
    $st->execute([$table]);
    return (int)$st->fetchColumn() > 0;
}

function tableColumns(PDO $pdo, string $table): array
{
    if (!tableExists($pdo, $table)) {
        return [];
    }
    $out = [];
    foreach ($pdo->query('SHOW FULL COLUMNS FROM ' . qid($table))->fetchAll() as $r) {
        $out[(string)$r['Field']] = $r;
    }
    return $out;
}

function hasForeignKey(PDO $pdo, string $table, string $column, string $ref): bool
{
    [$refTable, $refColumn] = explode('.', $ref);
    $st = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? '
        . 'AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME = ? AND REFERENCED_COLUMN_NAME = ?'
    );
    $st->execute([$table, $column, $refTable, $refColumn]);
    return (int)$st->fetchColumn() > 0;
}

/** Definisi kanonik. Nama tabel/kolom di sini adalah satu-satunya yang dipakai backend. */
function schemaSpecs(): array
{
    return [
        'wisma' => [
            'cols' => ['id', 'kode', 'nama', 'alamat', 'pic', 'status', 'kapasitas', 'fasilitas', 'lat', 'lng', 'meta_json'],
            'pk' => ['id'],
            'types' => ['id' => '/char/i', 'kode' => '/char/i'],
            'fks' => [],
            'ddl' => <<<'SQL'
CREATE TABLE IF NOT EXISTS `wisma` (
  `id` VARCHAR(64) NOT NULL,
  `kode` VARCHAR(64) NOT NULL,
  `nama` VARCHAR(190) NOT NULL,
  `alamat` TEXT NULL,
  `pic` VARCHAR(190) NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Aktif',
  `kapasitas` INT NOT NULL DEFAULT 0,
  `fasilitas` TEXT NULL,
  `lat` DECIMAL(10,7) NULL,
  `lng` DECIMAL(10,7) NULL,
  `meta_json` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wisma_kode` (`kode`),
  KEY `idx_wisma_pic` (`pic`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        ],
        'kunjungan' => [
            'cols' => ['id', 'wisma_kode', 'tgl', 'real', 'tujuan', 'prioritas', 'catatan', 'batal', 'bukti_json', 'meta_json'],
            'pk' => ['id'],
            'types' => ['id' => '/char/i', 'wisma_kode' => '/char/i', 'tgl' => '/^date$/i', 'real' => '/^date$/i'],
            'fks' => ['wisma_kode' => 'wisma.kode'],
            'ddl' => <<<'SQL'
CREATE TABLE IF NOT EXISTS `kunjungan` (
  `id` VARCHAR(64) NOT NULL,
  `wisma_kode` VARCHAR(64) NOT NULL,
  `tgl` DATE NOT NULL,
  `real` DATE NULL,
  `tujuan` VARCHAR(190) NULL,
  `prioritas` VARCHAR(30) NULL,
  `catatan` TEXT NULL,
  `batal` TINYINT(1) NOT NULL DEFAULT 0,
  `bukti_json` LONGTEXT NULL,
  `meta_json` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kunjungan_wisma` (`wisma_kode`),
  KEY `idx_kunjungan_tgl` (`tgl`),
  CONSTRAINT `fk_wvms_kunjungan_wisma` FOREIGN KEY (`wisma_kode`) REFERENCES `wisma` (`kode`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        ],
        'tiket' => [
            'cols' => ['id', 'wisma_kode', 'kunjungan_id', 'item', 'status', 'tgl', 'selesai', 'meta_json'],
            'pk' => ['id'],
            'types' => ['id' => '/char/i', 'wisma_kode' => '/char/i', 'kunjungan_id' => '/char/i', 'tgl' => '/^date$/i'],
            'fks' => ['wisma_kode' => 'wisma.kode', 'kunjungan_id' => 'kunjungan.id'],
            'ddl' => <<<'SQL'
CREATE TABLE IF NOT EXISTS `tiket` (
  `id` VARCHAR(100) NOT NULL,
  `wisma_kode` VARCHAR(64) NOT NULL,
  `kunjungan_id` VARCHAR(64) NULL,
  `item` VARCHAR(255) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'Baru',
  `tgl` DATE NOT NULL,
  `selesai` DATE NULL,
  `meta_json` LONGTEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tiket_wisma` (`wisma_kode`),
  KEY `idx_tiket_kunjungan` (`kunjungan_id`),
  KEY `idx_tiket_status` (`status`),
  CONSTRAINT `fk_wvms_tiket_wisma` FOREIGN KEY (`wisma_kode`) REFERENCES `wisma` (`kode`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_wvms_tiket_kunjungan` FOREIGN KEY (`kunjungan_id`) REFERENCES `kunjungan` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        ],
        'log_aktivitas' => [
            'cols' => ['id', 't', 'u', 'a', 'd'],
            'pk' => ['id'],
            'types' => [],
            'fks' => [],
            'ddl' => <<<'SQL'
CREATE TABLE IF NOT EXISTS `log_aktivitas` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `t` BIGINT NULL,
  `u` VARCHAR(190) NULL,
  `a` VARCHAR(255) NOT NULL,
  `d` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_log_t` (`t`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        ],
        'konfigurasi' => [
            'cols' => ['kunci', 'nilai_json'],
            'pk' => ['kunci'],
            'types' => [],
            'fks' => [],
            'ddl' => <<<'SQL'
CREATE TABLE IF NOT EXISTS `konfigurasi` (
  `kunci` VARCHAR(100) NOT NULL,
  `nilai_json` LONGTEXT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`kunci`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
        ],
    ];
}

function schemaCompatible(PDO $pdo, string $table, array $spec): bool
{
    $cols = tableColumns($pdo, $table);
    if (!$cols) {
        return false;
    }
    foreach ($spec['cols'] as $c) {
        if (!isset($cols[$c])) return false;
    }
    $pk = [];
    foreach ($cols as $name => $meta) {
        if (strtoupper((string)$meta['Key']) === 'PRI') $pk[] = $name;
    }
    $want = $spec['pk'];
    sort($pk);
    sort($want);
    if ($pk !== $want) return false;
    foreach ($spec['types'] as $c => $re) {
        if (!preg_match($re, (string)$cols[$c]['Type'])) return false;
    }
    foreach ($spec['fks'] as $col => $ref) {
        if (!hasForeignKey($pdo, $table, $col, $ref)) return false;
    }
    return true;
}

function rowsOf(PDO $pdo, string $table): array
{
    return $pdo->query('SELECT * FROM ' . qid($table))->fetchAll();
}

/** Ambil nilai pertama yang terisi dari beberapa kemungkinan nama kolom lama. */
function pick(array $row, array $names)
{
    foreach ($names as $n) {
        if (array_key_exists($n, $row) && $row[$n] !== null && $row[$n] !== '') return $row[$n];
    }
    return null;
}

function legacyItem(array $row): array
{
    $nonNull = array_filter($row, static function ($v) { return $v !== null; });
    return array_merge(metaOf($row), $nonNull);
}

/** Salin data dari tabel lama (yang sudah diganti namanya) ke tabel kanonik. Tidak ada yang dihapus. */
function copyLegacyData(PDO $pdo, array $legacy, array &$report): void
{
    $stat = ['wisma' => [0, 0], 'kunjungan' => [0, 0], 'tiket' => [0, 0]];

    if (isset($legacy['wisma'])) {
        foreach (rowsOf($pdo, $legacy['wisma']) as $r) {
            $it = legacyItem($r);
            $kode = pick($it, ['kode', 'kode_wisma']);
            $id = pick($it, ['app_id', 'id']);
            if ($kode === null) { $stat['wisma'][1]++; continue; }
            if ($id === null || ctype_digit((string)$id)) {
                $id = $id === null ? 'ID-' . substr(md5((string)$kode), 0, 10) : 'ID-' . str_pad((string)$id, 3, '0', STR_PAD_LEFT);
            }
            $it['id'] = (string)$id;
            $it['kode'] = (string)$kode;
            try { dbInsert($pdo, 'wisma', normWisma($it)); $stat['wisma'][0]++; } catch (Throwable $e) { $stat['wisma'][1]++; }
        }
    }

    if (isset($legacy['kunjungan'])) {
        foreach (rowsOf($pdo, $legacy['kunjungan']) as $r) {
            $it = legacyItem($r);
            $kode = pick($it, ['wisma_kode', 'kode_wisma', 'kode']);
            $id = pick($it, ['app_id', 'kode_kunjungan', 'kunjungan_kode', 'visit_id', 'id']);
            $it['id'] = $id === null ? 'VIS-' . substr(md5(json_encode($r)), 0, 10) : (string)$id;
            $it['kode'] = $kode === null ? '' : (string)$kode;
            $it['tgl'] = pick($it, ['tgl', 'tanggal']);
            $it['real'] = pick($it, ['real', 'realisasi', 'tgl_realisasi']);
            $bukti = decodeJson(isset($it['bukti_json']) ? (string)$it['bukti_json'] : null);
            if ($bukti) $it['bukti'] = $bukti;
            try {
                if ($it['kode'] === '' || !rowExists($pdo, 'wisma', 'kode', $it['kode'])) throw new ApiError('orphan');
                dbInsert($pdo, 'kunjungan', normKunjungan($it));
                $stat['kunjungan'][0]++;
            } catch (Throwable $e) { $stat['kunjungan'][1]++; }
        }
    }

    if (isset($legacy['tiket'])) {
        foreach (rowsOf($pdo, $legacy['tiket']) as $r) {
            $it = legacyItem($r);
            $it['id'] = (string)(pick($it, ['app_id', 'id']) ?? 'T-' . substr(md5(json_encode($r)), 0, 12));
            $it['kode'] = (string)(pick($it, ['wisma_kode', 'kode_wisma', 'kode']) ?? '');
            try {
                $row = normTiket($it);
                if (!rowExists($pdo, 'wisma', 'kode', $row['wisma_kode'])) throw new ApiError('orphan');
                if ($row['kunjungan_id'] !== null && !rowExists($pdo, 'kunjungan', 'id', $row['kunjungan_id'])) $row['kunjungan_id'] = null;
                dbInsert($pdo, 'tiket', $row);
                $stat['tiket'][0]++;
            } catch (Throwable $e) { $stat['tiket'][1]++; }
        }
    }

    foreach ($stat as $t => $s) {
        if (isset($legacy[$t])) {
            $report[] = "Data $t disalin dari {$legacy[$t]}: {$s[0]} berhasil, {$s[1]} dilewati (tidak valid/yatim).";
        }
    }
}

/** Log dan konfigurasi: bila strukturnya lama, tabel diganti nama lalu isinya disalin seperlunya. */
function ensureSimpleTable(PDO $pdo, string $table, array $spec, array &$report): void
{
    if (tableExists($pdo, $table) && !schemaCompatible($pdo, $table, $spec)) {
        $legacy = $table . '_legacy_' . date('Ymd_His');
        $pdo->exec('RENAME TABLE ' . qid($table) . ' TO ' . qid($legacy));
        $pdo->exec($spec['ddl']);
        $report[] = "Tabel `$table` lama diamankan sebagai `$legacy`.";
        $n = 0;
        foreach (rowsOf($pdo, $legacy) as $r) {
            try {
                if ($table === 'konfigurasi') {
                    $k = pick($r, ['kunci', 'key', 'nama', 'kode']);
                    $v = pick($r, ['nilai_json', 'nilai', 'value', 'data', 'isi']);
                    if ($k === null) continue;
                    $json = json_decode((string)$v, true) === null && (string)$v !== 'null' ? json_encode((string)$v) : (string)$v;
                    $pdo->prepare('INSERT IGNORE INTO `konfigurasi` (`kunci`, `nilai_json`) VALUES (?, ?)')->execute([cut((string)$k, 100), $json]);
                } else {
                    $a = pick($r, ['a', 'aksi', 'activity', 'aktivitas']);
                    if ($a === null) continue;
                    $pdo->prepare('INSERT INTO `log_aktivitas` (`t`, `u`, `a`, `d`) VALUES (?, ?, ?, ?)')->execute([
                        (int)(pick($r, ['t', 'timestamp']) ?? 0), cut((string)(pick($r, ['u', 'user', 'pengguna']) ?? ''), 190),
                        cut((string)$a, 255), (string)(pick($r, ['d', 'detail', 'keterangan']) ?? ''),
                    ]);
                }
                $n++;
            } catch (Throwable $e) { /* baris tidak bisa dipetakan: tetap aman di tabel lama */ }
        }
        $report[] = "Tabel `$table`: $n baris disalin dari tabel lama.";
        return;
    }
    $pdo->exec($spec['ddl']);
}

function ensureUsersTable(PDO $pdo): void
{
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nama` VARCHAR(120) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('Admin','Staff','Viewer') NOT NULL DEFAULT 'Staff',
  `status` ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif',
  `last_login` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);
    // Tabel users milik Anda tidak diganti/dihapus; hanya kolom yang hilang ditambahkan.
    $cols = tableColumns($pdo, 'users');
    if (!isset($cols['last_login'])) $pdo->exec('ALTER TABLE `users` ADD COLUMN `last_login` DATETIME NULL');
    if (!isset($cols['status'])) $pdo->exec("ALTER TABLE `users` ADD COLUMN `status` ENUM('Aktif','Nonaktif') NOT NULL DEFAULT 'Aktif'");

    if ((int)$pdo->query('SELECT COUNT(*) FROM `users`')->fetchColumn() === 0) {
        $col = userPasswordColumn($pdo);
        $pdo->prepare('INSERT INTO `users` (`nama`, `email`, ' . qid($col) . ', `role`, `status`) VALUES (?, ?, ?, ?, ?)')
            ->execute(['Administrator', DEFAULT_ADMIN_EMAIL, password_hash(DEFAULT_ADMIN_PASSWORD, PASSWORD_DEFAULT), 'Admin', 'Aktif']);
    }
}

/** Data lama yang hanya ada di snapshot app_state diimpor sekali ke tabel relasional. */
function importFromAppState(PDO $pdo, array &$report): void
{
    $has = static function (string $k) use ($pdo): bool { return rowExists($pdo, 'konfigurasi', 'kunci', $k); };
    if ($has('_seeded') || $has('_imported') || !tableExists($pdo, 'app_state')) return;
    foreach (['wisma', 'kunjungan', 'tiket'] as $t) {
        if ((int)$pdo->query('SELECT COUNT(*) FROM ' . qid($t))->fetchColumn() > 0) return;
    }
    $row = $pdo->query('SELECT `data` FROM `app_state` WHERE `id` = 1 LIMIT 1')->fetch();
    $state = $row ? json_decode((string)$row['data'], true) : null;
    if (!is_array($state) || empty($state['wisma'])) return;

    $n = ['wisma' => 0, 'kunjungan' => 0, 'tiket' => 0];
    $pdo->beginTransaction();
    try {
        foreach ((array)$state['wisma'] as $it) {
            if (!is_array($it)) continue;
            try { dbInsert($pdo, 'wisma', normWisma($it)); $n['wisma']++; } catch (Throwable $e) { /* lewati baris tidak valid */ }
        }
        foreach ((array)($state['kunjungan'] ?? []) as $it) {
            if (!is_array($it)) continue;
            try {
                $r = normKunjungan($it);
                if (!rowExists($pdo, 'wisma', 'kode', $r['wisma_kode'])) continue;
                dbInsert($pdo, 'kunjungan', $r); $n['kunjungan']++;
            } catch (Throwable $e) { /* lewati */ }
        }
        foreach ((array)($state['tiket'] ?? []) as $it) {
            if (!is_array($it)) continue;
            try {
                $r = normTiket($it);
                if (!rowExists($pdo, 'wisma', 'kode', $r['wisma_kode'])) continue;
                if ($r['kunjungan_id'] !== null && !rowExists($pdo, 'kunjungan', 'id', $r['kunjungan_id'])) $r['kunjungan_id'] = null;
                dbInsert($pdo, 'tiket', $r); $n['tiket']++;
            } catch (Throwable $e) { /* lewati */ }
        }
        foreach ((array)($state['cfg'] ?? []) as $k => $v) {
            $k = (string)$k;
            if ($k === 'me' || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/', $k)) continue;
            $pdo->prepare('INSERT IGNORE INTO `konfigurasi` (`kunci`, `nilai_json`) VALUES (?, ?)')->execute([$k, json_encode($v, JSON_UNESCAPED_UNICODE)]);
        }
        $pdo->exec("INSERT IGNORE INTO `konfigurasi` (`kunci`, `nilai_json`) VALUES ('_imported', 'true'), ('_seeded', 'true')");
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    $report[] = "Data dari app_state diimpor ke tabel relasional: {$n['wisma']} wisma, {$n['kunjungan']} kunjungan, {$n['tiket']} tiket.";
}

/**
 * Pastikan semua tabel ada dan sesuai. Tidak pernah menghapus data: tabel lama yang tidak cocok
 * hanya diganti nama (<nama>_legacy_<waktu>) dan isinya disalin ke tabel baru.
 * Mengembalikan daftar catatan (kosong bila tidak ada yang perlu diubah).
 */
function ensureSchema(PDO $pdo): array
{
    $report = [];
    $specs = schemaSpecs();

    ensureUsersTable($pdo);
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS `app_state` (
  `id` TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  `data` LONGTEXT NOT NULL,
  `updated_by` VARCHAR(190) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL);

    // Tiga tabel inti saling terhubung lewat foreign key, jadi dimigrasi bersama-sama.
    $core = ['wisma', 'kunjungan', 'tiket'];
    $needMigrate = false;
    foreach ($core as $t) {
        if (tableExists($pdo, $t) && !schemaCompatible($pdo, $t, $specs[$t])) $needMigrate = true;
    }
    $legacy = [];
    if ($needMigrate) {
        $stamp = date('Ymd_His');
        foreach (['tiket', 'kunjungan', 'wisma'] as $t) {   // anak dulu, induk terakhir
            if (tableExists($pdo, $t)) {
                $name = $t . '_legacy_' . $stamp;
                $pdo->exec('RENAME TABLE ' . qid($t) . ' TO ' . qid($name));
                $legacy[$t] = $name;
                $report[] = "Tabel `$t` lama tidak sesuai skema, diamankan sebagai `$name` (tidak dihapus).";
            }
        }
    }
    foreach ($core as $t) {
        $pdo->exec($specs[$t]['ddl']);
    }
    if ($legacy) {
        copyLegacyData($pdo, $legacy, $report);
    }

    ensureSimpleTable($pdo, 'log_aktivitas', $specs['log_aktivitas'], $report);
    ensureSimpleTable($pdo, 'konfigurasi', $specs['konfigurasi'], $report);
    importFromAppState($pdo, $report);

    return $report;
}

function ensureSchemaOnce(PDO $pdo): void
{
    startSession();
    if (($_SESSION['schema_v'] ?? 0) === SCHEMA_VERSION) return;
    ensureSchema($pdo);
    $_SESSION['schema_v'] = SCHEMA_VERSION;
}
