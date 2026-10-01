# WVMS Final Test Report

Tanggal audit: 30 September 2026

## Yang berhasil diverifikasi di environment pengerjaan

| # | Pengujian | Hasil |
|---|---|---|
| 1 | Health endpoint | **Sebagian** — endpoint merespons JSON valid, tetapi environment ini tidak memiliki MySQL/MariaDB PDO driver, sehingga koneksi DB nyata menghasilkan HTTP 500 `Kesalahan database`. |
| 2 | Login | **Kode diaudit** — `password_verify()` + PHP session digunakan. Hash akun demo diverifikasi cocok dengan `admin123wvms@2026`. Login live belum dapat diuji tanpa MySQL. |
| 3 | Logout | **Kode diaudit** — POST `action=logout` menghancurkan PHP session. Live DB/session belum dapat diuji penuh. |
| 4 | Load dashboard | **Kode diaudit** — data dimuat dari `action=state`, lalu UI dirender. Live belum dapat diuji tanpa DB. |
| 5 | Tambah wisma | **Kode + SQL diaudit** — INSERT/upsert ke tabel `wisma`. Live belum dapat diuji. |
| 6 | Edit wisma | **Kode + SQL diaudit** — UPDATE berdasarkan `wisma.id`. Live belum dapat diuji. |
| 7 | Hapus wisma | **Kode + transaksi diaudit** — kunjungan child dihapus lebih dahulu, lalu wisma, sehingga FK tidak dilanggar. Live belum dapat diuji. |
| 8 | Tambah kunjungan | **Kode + validasi diaudit** — `wisma_kode` harus ada di `wisma.kode`. Live belum dapat diuji. |
| 9 | Edit kunjungan | **Kode + SQL diaudit** — UPDATE berdasarkan `app_id`. Live belum dapat diuji. |
| 10 | Hapus/batal kunjungan | **Kode + SQL diaudit** — state `batal` tersimpan dan penghapusan persisten melalui sinkronisasi. Live belum dapat diuji. |
| 11 | Tambah/update tiket | **Kode + SQL diaudit** — tabel `tiket`, `kid` divalidasi terhadap `kunjungan.app_id`. Live belum dapat diuji. |
| 12 | Reload/persistence | **Arsitektur diaudit** — GET state membaca tabel relasional, bukan localStorage/app_state. Live belum dapat diuji. |
| 13 | Cek phpMyAdmin | **Belum bisa dilakukan** — tidak ada MySQL/MariaDB server di environment pengerjaan. |
| 14 | Cek foreign key | **Schema diaudit** — `kunjungan.wisma_kode → wisma.kode` dan `tiket.kid → kunjungan.app_id` didefinisikan pada `database.sql`. Live DB belum dapat diverifikasi. |
| 15 | Cek PHP session | **Kode diaudit** — HttpOnly + SameSite=Lax, `session_regenerate_id()` setelah login, `session_destroy()` saat logout. |
| 16 | Cek role | **Kode diaudit** — operasi state dibatasi `Admin/Staff`, endpoint users dibatasi `Admin`. |
| 17 | Cek console browser | **Belum bisa dilakukan** — tidak tersedia browser automation/DevTools di environment pengerjaan. |
| 18 | Cek PHP syntax | **PASS** — seluruh file PHP lolos `php -l`. |

## Pemeriksaan tambahan

- Seluruh file JavaScript lolos `node --check`.
- Tidak ada penyimpanan `wvms.sesi` ke localStorage/sessionStorage.
- localStorage hanya dipakai untuk preferensi tema/palet.
- `App.save` hanya memiliki satu definisi.
- Kolom SQL `real` selalu digunakan sebagai identifier yang di-quote dengan backtick.
- Tidak ada `DROP DATABASE` atau `DROP TABLE` pada `database.sql`.
- `app_state` tidak digunakan sebagai sumber utama ketika membaca state.
- Error API diuji melalui PHP built-in server dan tetap menghasilkan JSON valid, bukan PHP warning/fatal mentah.

## Batasan penting

Project final sudah disiapkan untuk XAMPP + MySQL/MariaDB, tetapi **pengujian CRUD dan session terhadap database MySQL nyata tidak dapat diklaim lulus di environment pengerjaan ini** karena PHP CLI tersedia tanpa driver `pdo_mysql` dan tidak ada server MySQL/MariaDB terpasang.

Pengujian live terakhir harus dilakukan setelah project ditempatkan di `C:\xampp\htdocs\wvms\`, Apache + MySQL dinyalakan, dan `database.sql` diimpor pada instalasi baru.
