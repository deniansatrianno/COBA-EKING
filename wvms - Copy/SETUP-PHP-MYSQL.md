# WVMS: PHP + MySQL (XAMPP)

Alur data: **Browser → session PHP → `backend/index.php` (API JSON) → MySQL `wvms_db`**.
Browser tidak menyimpan data aplikasi. `localStorage` hanya dipakai untuk cache tema/palet warna supaya layar tidak berkedip.

## Persyaratan
XAMPP dengan PHP 7.4 atau lebih baru (XAMPP 8.x aman), Apache dan MySQL menyala.

## Instalasi
1. Extract **isi** ZIP ini ke `C:\xampp\htdocs\wvms\` sehingga ada `C:\xampp\htdocs\wvms\index.html`, `login.html`, folder `backend\`, dst.
   - Jika password MySQL root Anda tidak kosong, buat `backend\config.local.php` (file ini tidak ikut ditimpa saat update):
     ```php
     <?php
     define('DB_PASS', 'password-mysql-anda');
     ```
2. Nyalakan **Apache** dan **MySQL** di XAMPP Control Panel.
3. Database:
   - **Database `wvms_db` belum ada / masih kosong:** buka `http://localhost/phpmyadmin` → *Import* → pilih `database.sql`.
   - **`wvms_db` sudah berisi data Anda:** jangan import apa pun. Backend memeriksa dan menyesuaikan struktur sendiri saat login pertama (lihat "Migrasi otomatis"). Tidak ada data yang dihapus.
4. Cek backend: `http://localhost/wvms/backend/index.php?action=health` → harus `"status":"success"`.
5. Buka `http://localhost/wvms/` lalu login.

Akun awal: `admin@perusahaan.co.id` / `admin123`. **Segera ganti**:
```
C:\xampp\php\php.exe C:\xampp\htdocs\wvms\backend\tools\reset_admin.php admin@perusahaan.co.id PasswordBaruAnda
```
(Password yang tampil di halaman login sebelumnya, `admin123wvms@2026`, ternyata tidak cocok dengan hash di `database.sql` lama; yang cocok adalah `admin123`. Sekarang keduanya disamakan.)

## Migrasi otomatis (tanpa menghapus data)
Saat login/health, `backend/schema.php` memeriksa tabel `wisma`, `kunjungan`, `tiket`, `log_aktivitas`, `konfigurasi`:
- Cocok dengan skema (primary key, tipe kolom, foreign key) → dipakai apa adanya.
- Tidak cocok (mis. `kunjungan` tanpa primary key, atau tanpa foreign key) → tabel lama **diganti nama** menjadi `<tabel>_legacy_<waktu>` (tidak dihapus), tabel baru dibuat, lalu data lama disalin. Baris yatim (kode wisma tidak ada) dilewati dan tetap aman di tabel `_legacy`. Ringkasan hasilnya ada di `?action=schema` (Admin).
- Jika tabel relasional masih kosong tetapi `app_state` berisi snapshot lama, isinya diimpor sekali.
- Tabel `users` tidak diganti; hanya kolom yang hilang (`last_login`, `status`) ditambahkan.
- `app_state` tetap ada untuk kompatibilitas, tetapi **bukan** sumber data lagi.

## Skema (sumber tunggal: `backend/schema.php`, identik dengan `database.sql`)
| Tabel | Primary key | Relasi |
|---|---|---|
| `users` | `id` | |
| `wisma` | `id` (unik: `kode`) | |
| `kunjungan` | `id` | `wisma_kode → wisma.kode` (CASCADE) |
| `tiket` | `id` | `wisma_kode → wisma.kode` (CASCADE), `kunjungan_id → kunjungan.id` (SET NULL) |
| `log_aktivitas` | `id` (auto) | |
| `konfigurasi` | `kunci` | |
| `app_state` | `id` | (tidak dipakai lagi) |

Foreign key tidak pernah dimatikan. Kolom `real` selalu ditulis dengan backtick.

## Cara kerja simpan data
`App.db` tetap dipakai UI (supaya UI tidak berubah). `App.save()` (satu-satunya implementasi, di `js/app.js`) membandingkan `App.db` dengan salinan terakhir dari MySQL, lalu mengirim **hanya perubahan per baris** (tambah/ubah/hapus) ke `?action=sync`. Server memvalidasi, memeriksa role, dan menulis ke tabel dalam **satu transaksi**. Simpan berjalan berurutan (antrean), jadi tidak ada race condition atau Promise yang hilang. Jika server menolak (mis. kode wisma tidak ada, atau role tidak boleh), pengguna melihat pesan galat dan tampilan dikembalikan sesuai isi MySQL: tidak ada data yang "terlihat" di browser tetapi tidak ada di database.

## Peran (diperiksa di server)
- **Viewer**: hanya melihat.
- **Staff**: tambah/ubah wisma, kunjungan, tiket; tidak boleh menghapus, restore/reset, atau mengubah informasi instansi.
- **Admin**: semuanya.
Peran diambil dari tabel `users` pada setiap request. Pilihan role di halaman Profil hanya memengaruhi tampilan, tidak memengaruhi izin di server.

## Checklist pengujian manual
Nomor 1-18 mengikuti daftar permintaan. Centang satu per satu setelah instalasi.
1. **Health:** buka `.../backend/index.php?action=health` → `status: success`.
2. **Login:** `admin@perusahaan.co.id` / `admin123` → masuk dashboard. Password salah → pesan galat.
3. **Logout:** menu pengguna → Keluar → konfirmasi → halaman login; menekan Back/membuka `index.html` harus kembali ke login (session PHP benar-benar berakhir).
4. **Dashboard:** kartu dan grafik tampil tanpa galat.
5. **Tambah wisma:** Wisma → Tambah → simpan. Cek di phpMyAdmin tabel `wisma` ada baris barunya.
6. **Edit wisma:** ubah nama → di phpMyAdmin kolom `nama` berubah.
7. **Hapus wisma:** (Admin) hapus → baris hilang dari `wisma`, dan kunjungan/tiket wisma itu ikut hilang (cascade).
8. **Tambah kunjungan:** Kunjungan → Tambah → pilih wisma → simpan. Cek tabel `kunjungan`: `wisma_kode` berisi kode wisma yang benar.
9. **Edit kunjungan:** ubah catatan/tanggal → tabel ikut berubah.
10. **Hapus/batal kunjungan:** hapus → baris hilang; batalkan → kolom `batal` = 1.
11. **Tiket:** selesaikan satu check-in dengan item checklist tidak dicentang → tabel `tiket` terisi; ubah statusnya (Baru → Diproses → Selesai).
12. **Reload:** tekan Ctrl+F5 dan tutup/buka browser → semua data tetap ada.
13. **phpMyAdmin:** bandingkan isi tabel dengan layar.
14. **Foreign key:** di phpMyAdmin jalankan `INSERT INTO kunjungan (id,wisma_kode,tgl) VALUES ('X','TIDAK-ADA','2026-01-01');` → harus ditolak MySQL (error foreign key).
15. **Session:** hapus cookie `WVMSSESS` lalu reload `index.html` → diarahkan ke login.
16. **Role:** buat user Staff/Viewer di tabel `users` (password hash lewat `reset_admin.php` lalu ubah kolom `role`), login sebagai itu: Viewer tidak bisa menambah data; Staff tidak bisa menghapus (server menolak walau tombol ditekan).
17. **Console browser (F12):** tidak ada galat merah selain yang disengaja.
18. **Sintaks PHP:** `C:\xampp\php\php.exe -l C:\xampp\htdocs\wvms\backend\index.php` (ulangi untuk `lib.php`, `schema.php`, `entities.php`) → "No syntax errors detected".

## Pemecahan masalah
| Gejala | Penyebab / solusi |
|---|---|
| "MySQL tidak dapat dihubungi" | MySQL di XAMPP belum menyala. |
| "Login MySQL ditolak" | Isi `DB_USER`/`DB_PASS` (lihat `config.local.php` di atas). |
| "Database wvms_db belum ada" | Import `database.sql` lewat phpMyAdmin. |
| "Server tidak merespons dengan benar (HTTP 500)" | Buka log error Apache (`C:\xampp\apache\logs\error.log`). Untuk melihat detail di JSON, set `define('APP_DEBUG', true);` di `config.local.php` (matikan lagi setelah selesai). |
| Foto check-in gagal tersimpan | Naikkan `max_allowed_packet` di `C:\xampp\mysql\bin\my.ini` (mis. 16M) lalu restart MySQL. |
| Login selalu gagal padahal benar | Jalankan `reset_admin.php` (lihat di atas). |
