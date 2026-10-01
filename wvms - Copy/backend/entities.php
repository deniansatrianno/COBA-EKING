<?php
declare(strict_types=1);

require_once __DIR__ . '/lib.php';

const ADMIN_CFG_KEYS = ['company', 'alamat', 'email', 'telp', 'logo'];
const TIKET_STATUS = ['Baru', 'Diproses', 'Selesai'];

/* ============ Normalisasi (dipakai sync, migrasi tabel lama, dan impor) ============ */

function normWisma(array $in): array
{
    $known = ['id', 'kode', 'nama', 'alamat', 'pic', 'status', 'kapasitas', 'fasilitas', 'lat', 'lng'];
    return [
        'id' => reqStr($in, 'id', 64, 'ID wisma'),
        'kode' => reqStr($in, 'kode', 64, 'Kode wisma'),
        'nama' => reqStr($in, 'nama', 190, 'Nama wisma'),
        'alamat' => optStr($in, 'alamat', 60000),
        'pic' => optStr($in, 'pic', 190),
        'status' => optStr($in, 'status', 50) ?? 'Aktif',
        'kapasitas' => max(0, (int)($in['kapasitas'] ?? 0)),
        'fasilitas' => optStr($in, 'fasilitas', 60000),
        'lat' => coordOpt($in['lat'] ?? null, -90.0, 90.0, 'Latitude'),
        'lng' => coordOpt($in['lng'] ?? null, -180.0, 180.0, 'Longitude'),
        'meta_json' => extrasJson($in, $known),
    ];
}

function normKunjungan(array $in): array
{
    $known = ['id', 'kode', 'wisma_kode', 'tgl', 'real', 'tujuan', 'prioritas', 'catatan', 'batal', 'bukti'];
    if (!isset($in['kode']) && isset($in['wisma_kode'])) {
        $in['kode'] = $in['wisma_kode'];
    }
    return [
        'id' => reqStr($in, 'id', 64, 'ID kunjungan'),
        'wisma_kode' => reqStr($in, 'kode', 64, 'Kode wisma'),
        'tgl' => dateReq($in['tgl'] ?? null, 'Tanggal rencana'),
        'real' => dateOpt($in['real'] ?? null, 'Tanggal realisasi'),
        'tujuan' => optStr($in, 'tujuan', 190),
        'prioritas' => optStr($in, 'prioritas', 30),
        'catatan' => optStr($in, 'catatan', 60000),
        'batal' => !empty($in['batal']) ? 1 : 0,
        'bukti_json' => jsonOrNull($in['bukti'] ?? null),
        'meta_json' => extrasJson($in, $known),
    ];
}

function normTiket(array $in): array
{
    $known = ['id', 'kode', 'wisma_kode', 'kid', 'item', 'status', 'tgl', 'selesai'];
    if (!isset($in['kode']) && isset($in['wisma_kode'])) {
        $in['kode'] = $in['wisma_kode'];
    }
    $status = optStr($in, 'status', 30) ?? 'Baru';
    if (!in_array($status, TIKET_STATUS, true)) {
        throw new ApiError('Status tiket harus salah satu dari: ' . implode(', ', TIKET_STATUS) . '.', 422);
    }
    return [
        'id' => reqStr($in, 'id', 100, 'ID tiket'),
        'wisma_kode' => reqStr($in, 'kode', 64, 'Kode wisma'),
        'kunjungan_id' => optStr($in, 'kid', 64),
        'item' => reqStr($in, 'item', 255, 'Temuan tiket'),
        'status' => $status,
        'tgl' => dateOpt($in['tgl'] ?? null, 'Tanggal tiket') ?? date('Y-m-d'),
        'selesai' => dateOpt($in['selesai'] ?? null, 'Tanggal selesai'),
        'meta_json' => extrasJson($in, $known),
    ];
}

/* ============ Simpan satu baris (create / update) ============ */

function saveWisma(PDO $pdo, array $in, bool $isNew): void
{
    $row = normWisma($in);
    if ($isNew) {
        if (rowExists($pdo, 'wisma', 'id', $row['id'])) {
            throw new ApiError('ID wisma ' . $row['id'] . ' sudah dipakai. Muat ulang data lalu coba lagi.', 409);
        }
        if (rowExists($pdo, 'wisma', 'kode', $row['kode'])) {
            throw new ApiError('Kode wisma ' . $row['kode'] . ' sudah dipakai.', 409);
        }
        dbInsert($pdo, 'wisma', $row);
        return;
    }
    if (!rowExists($pdo, 'wisma', 'id', $row['id'])) {
        throw new ApiError('Wisma tidak ditemukan (mungkin sudah dihapus pengguna lain).', 404);
    }
    $st = $pdo->prepare('SELECT 1 FROM `wisma` WHERE `kode` = ? AND `id` <> ? LIMIT 1');
    $st->execute([$row['kode'], $row['id']]);
    if ($st->fetchColumn()) {
        throw new ApiError('Kode wisma ' . $row['kode'] . ' sudah dipakai wisma lain.', 409);
    }
    dbUpdate($pdo, 'wisma', 'id', $row['id'], $row);
}

function saveKunjungan(PDO $pdo, array $in, bool $isNew): void
{
    $row = normKunjungan($in);
    if (!rowExists($pdo, 'wisma', 'kode', $row['wisma_kode'])) {
        throw new ApiError('Wisma dengan kode ' . $row['wisma_kode'] . ' tidak ditemukan. Kunjungan harus terhubung ke wisma yang ada.', 422);
    }
    if ($isNew) {
        if (rowExists($pdo, 'kunjungan', 'id', $row['id'])) {
            throw new ApiError('ID kunjungan ' . $row['id'] . ' sudah dipakai. Muat ulang data lalu coba lagi.', 409);
        }
        dbInsert($pdo, 'kunjungan', $row);
        return;
    }
    if (!rowExists($pdo, 'kunjungan', 'id', $row['id'])) {
        throw new ApiError('Kunjungan tidak ditemukan (mungkin sudah dihapus pengguna lain).', 404);
    }
    dbUpdate($pdo, 'kunjungan', 'id', $row['id'], $row);
}

function saveTiket(PDO $pdo, array $in, bool $isNew): void
{
    $row = normTiket($in);
    if (!rowExists($pdo, 'wisma', 'kode', $row['wisma_kode'])) {
        throw new ApiError('Wisma dengan kode ' . $row['wisma_kode'] . ' tidak ditemukan.', 422);
    }
    // Tiket boleh tetap ada walau kunjungan asalnya dihapus: relasi dikosongkan, bukan gagal.
    if ($row['kunjungan_id'] !== null && !rowExists($pdo, 'kunjungan', 'id', $row['kunjungan_id'])) {
        $row['kunjungan_id'] = null;
    }
    if ($isNew) {
        if (rowExists($pdo, 'tiket', 'id', $row['id'])) {
            throw new ApiError('ID tiket ' . $row['id'] . ' sudah dipakai. Muat ulang data lalu coba lagi.', 409);
        }
        dbInsert($pdo, 'tiket', $row);
        return;
    }
    if (!rowExists($pdo, 'tiket', 'id', $row['id'])) {
        throw new ApiError('Tiket tidak ditemukan (mungkin sudah dihapus pengguna lain).', 404);
    }
    dbUpdate($pdo, 'tiket', 'id', $row['id'], $row);
}

/* ============ Baca state lengkap dari tabel relasional ============ */

function metaOf(array $r): array
{
    return decodeJson($r['meta_json'] ?? null);
}

function buildState(PDO $pdo, array $user): array
{
    $wisma = [];
    foreach ($pdo->query('SELECT * FROM `wisma` ORDER BY `kode`')->fetchAll() as $r) {
        $wisma[] = array_merge(metaOf($r), [
            'id' => (string)$r['id'],
            'kode' => (string)$r['kode'],
            'nama' => (string)$r['nama'],
            'alamat' => (string)($r['alamat'] ?? ''),
            'pic' => (string)($r['pic'] ?? ''),
            'status' => (string)($r['status'] ?? 'Aktif'),
            'kapasitas' => (int)($r['kapasitas'] ?? 0),
            'fasilitas' => (string)($r['fasilitas'] ?? ''),
            'lat' => $r['lat'] === null ? '' : (float)$r['lat'],
            'lng' => $r['lng'] === null ? '' : (float)$r['lng'],
        ]);
    }

    $kunjungan = [];
    foreach ($pdo->query('SELECT * FROM `kunjungan` ORDER BY `tgl`, `id`')->fetchAll() as $r) {
        $item = array_merge(metaOf($r), [
            'id' => (string)$r['id'],
            'kode' => (string)$r['wisma_kode'],
            'tgl' => (string)$r['tgl'],
            'real' => $r['real'] === null ? '' : (string)$r['real'],
            'tujuan' => (string)($r['tujuan'] ?? ''),
            'prioritas' => (string)($r['prioritas'] ?? ''),
            'catatan' => (string)($r['catatan'] ?? ''),
            'batal' => (bool)(int)$r['batal'],
        ]);
        $bukti = decodeJson($r['bukti_json'] ?? null);
        if ($bukti) {
            $item['bukti'] = $bukti;
        }
        $kunjungan[] = $item;
    }

    $tiket = [];
    foreach ($pdo->query('SELECT * FROM `tiket` ORDER BY `tgl`, `id`')->fetchAll() as $r) {
        $meta = metaOf($r);
        $tiket[] = array_merge($meta, [
            'id' => (string)$r['id'],
            'kode' => (string)$r['wisma_kode'],
            'kid' => (string)($r['kunjungan_id'] ?? ($meta['kid'] ?? '')),
            'item' => (string)$r['item'],
            'status' => (string)$r['status'],
            'tgl' => (string)$r['tgl'],
            'selesai' => $r['selesai'] === null ? '' : (string)$r['selesai'],
        ]);
    }

    $log = [];
    foreach ($pdo->query('SELECT `t`, `u`, `a`, `d` FROM `log_aktivitas` ORDER BY `t` DESC, `id` DESC LIMIT 100')->fetchAll() as $r) {
        $log[] = ['t' => (int)$r['t'], 'u' => (string)($r['u'] ?? ''), 'a' => (string)$r['a'], 'd' => (string)($r['d'] ?? '')];
    }

    $cfg = [];
    $internal = [];
    foreach ($pdo->query('SELECT `kunci`, `nilai_json` FROM `konfigurasi`')->fetchAll() as $r) {
        $key = (string)$r['kunci'];
        $val = $r['nilai_json'] === null ? null : json_decode((string)$r['nilai_json'], true);
        if ($val === null && $r['nilai_json'] !== null && strtolower(trim((string)$r['nilai_json'])) !== 'null') {
            $val = (string)$r['nilai_json'];   // nilai lama yang bukan JSON
        }
        if (strpos($key, '_') === 0) {
            $internal[$key] = $val;
        } else {
            $cfg[$key] = $val;
        }
    }
    $cfg['me'] = ['nama' => $user['nama'], 'email' => $user['email'], 'role' => $user['role']];

    $read = $internal['_read_' . $user['id']] ?? [];
    $users = [];
    if ($user['role'] === 'Admin') {
        foreach ($pdo->query('SELECT id, nama, email, role, status, last_login FROM `users` ORDER BY id')->fetchAll() as $r) {
            $users[] = ['id' => 'USR-' . $r['id'], 'nama' => $r['nama'], 'email' => $r['email'], 'role' => $r['role'], 'status' => $r['status'], 'login' => (string)($r['last_login'] ?? '-')];
        }
    }

    $firstRun = !isset($internal['_seeded']) && count($wisma) === 0 && count($kunjungan) === 0;

    return [
        'first_run' => $firstRun,
        'data' => [
            'wisma' => $wisma,
            'kunjungan' => $kunjungan,
            'tiket' => $tiket,
            'users' => $users,
            'log' => $log,
            'read' => is_array($read) ? $read : [],
            'cfg' => $cfg,
        ],
    ];
}

/* ============ Terapkan perubahan dari frontend ============ */

function opsList($ops, string $entity, string $bucket): array
{
    $v = is_array($ops) ? ($ops[$entity][$bucket] ?? []) : [];
    return is_array($v) ? $v : [];
}

function translateDbError(PDOException $e): ApiError
{
    error_log('[WVMS] ' . $e->getMessage());
    $msg = $e->getMessage();
    if (stripos($msg, 'foreign key') !== false) {
        return new ApiError('Relasi data tidak valid (mis. kode wisma tidak ada).', 422);
    }
    if (stripos($msg, 'Duplicate entry') !== false) {
        return new ApiError('Data duplikat: ID atau kode sudah dipakai.', 409);
    }
    if (stripos($msg, 'Data too long') !== false || stripos($msg, 'Incorrect') !== false) {
        return new ApiError('Ada nilai yang terlalu panjang atau formatnya tidak sesuai.', 422);
    }
    if (stripos($msg, 'max_allowed_packet') !== false || stripos($msg, 'gone away') !== false) {
        return new ApiError('Data terlalu besar untuk MySQL (mis. foto). Naikkan max_allowed_packet atau kecilkan foto.', 413);
    }
    return new ApiError('Kesalahan database saat menyimpan data.', 500);
}

function applySync(PDO $pdo, array $user, array $ops): array
{
    $role = (string)$user['role'];
    $entities = ['wisma', 'kunjungan', 'tiket'];

    $writes = false;
    foreach (['wisma', 'kunjungan', 'tiket', 'cfg', 'log'] as $k) {
        if (!empty($ops[$k])) {
            $writes = true;
        }
    }
    if ($role === 'Viewer' && $writes) {
        throw new ApiError('Peran Viewer hanya dapat melihat data.', 403);
    }
    if ($role !== 'Admin') {
        foreach ($entities as $e) {
            if (!empty(opsList($ops, $e, 'delete'))) {
                throw new ApiError('Hanya Admin yang boleh menghapus data.', 403);
            }
        }
        $cfgOps = is_array($ops['cfg'] ?? null) ? $ops['cfg'] : [];
        $touched = array_merge(array_keys(is_array($cfgOps['set'] ?? null) ? $cfgOps['set'] : []), is_array($cfgOps['unset'] ?? null) ? $cfgOps['unset'] : []);
        foreach ($touched as $k) {
            if (in_array((string)$k, ADMIN_CFG_KEYS, true)) {
                throw new ApiError('Hanya Admin yang boleh mengubah informasi instansi.', 403);
            }
        }
    }

    $counts = ['wisma' => 0, 'kunjungan' => 0, 'tiket' => 0, 'cfg' => 0, 'log' => 0];
    $pdo->beginTransaction();
    try {
        // Urutan menjaga foreign key: induk dulu saat menulis, anak dulu saat menghapus.
        $savers = ['wisma' => 'saveWisma', 'kunjungan' => 'saveKunjungan', 'tiket' => 'saveTiket'];
        foreach ($savers as $entity => $fn) {
            foreach (opsList($ops, $entity, 'create') as $item) {
                if (!is_array($item)) throw new ApiError("Format data $entity tidak valid.", 422);
                $fn($pdo, $item, true);
                $counts[$entity]++;
            }
            foreach (opsList($ops, $entity, 'update') as $item) {
                if (!is_array($item)) throw new ApiError("Format data $entity tidak valid.", 422);
                $fn($pdo, $item, false);
                $counts[$entity]++;
            }
        }
        foreach (['tiket', 'kunjungan', 'wisma'] as $entity) {
            foreach (opsList($ops, $entity, 'delete') as $id) {
                if (!is_scalar($id)) continue;
                $pdo->prepare('DELETE FROM ' . qid($entity) . ' WHERE `id` = ?')->execute([(string)$id]);
                $counts[$entity]++;
            }
        }

        $cfgOps = is_array($ops['cfg'] ?? null) ? $ops['cfg'] : [];
        foreach ((is_array($cfgOps['set'] ?? null) ? $cfgOps['set'] : []) as $key => $value) {
            $key = (string)$key;
            if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/', $key) || $key === 'me') {
                continue;
            }
            $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($json === false || strlen($json) > 1000000) {
                throw new ApiError("Nilai konfigurasi '$key' tidak valid atau terlalu besar.", 422);
            }
            $pdo->prepare('INSERT INTO `konfigurasi` (`kunci`, `nilai_json`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `nilai_json` = VALUES(`nilai_json`)')
                ->execute([$key, $json]);
            $counts['cfg']++;
        }
        foreach ((is_array($cfgOps['unset'] ?? null) ? $cfgOps['unset'] : []) as $key) {
            $key = (string)$key;
            if ($key === '' || strpos($key, '_') === 0) continue;
            $pdo->prepare('DELETE FROM `konfigurasi` WHERE `kunci` = ?')->execute([$key]);
            $counts['cfg']++;
        }

        if (isset($ops['read']) && is_array($ops['read'])) {
            $ids = array_values(array_filter(array_map('strval', array_slice($ops['read'], 0, 500)), static function ($v) { return $v !== ''; }));
            $pdo->prepare('INSERT INTO `konfigurasi` (`kunci`, `nilai_json`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `nilai_json` = VALUES(`nilai_json`)')
                ->execute(['_read_' . $user['id'], json_encode($ids)]);
        }

        $logs = is_array($ops['log'] ?? null) ? array_slice($ops['log'], 0, 100) : [];
        foreach ($logs as $e) {
            if (!is_array($e)) continue;
            $a = cut(trim((string)($e['a'] ?? '')), 255);
            if ($a === '') continue;
            $t = isset($e['t']) && is_numeric($e['t']) ? (int)$e['t'] : (int)round(microtime(true) * 1000);
            // Nama pelaku selalu dari session server, bukan dari kiriman browser.
            $pdo->prepare('INSERT INTO `log_aktivitas` (`t`, `u`, `a`, `d`) VALUES (?, ?, ?, ?)')
                ->execute([$t, cut((string)$user['nama'], 190), $a, cut((string)($e['d'] ?? ''), 60000)]);
            $counts['log']++;
        }

        if ($counts['wisma'] + $counts['kunjungan'] + $counts['tiket'] > 0) {
            $pdo->exec("INSERT IGNORE INTO `konfigurasi` (`kunci`, `nilai_json`) VALUES ('_seeded', 'true')");
        }
        $pdo->commit();
    } catch (ApiError $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw translateDbError($e);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    return $counts;
}
