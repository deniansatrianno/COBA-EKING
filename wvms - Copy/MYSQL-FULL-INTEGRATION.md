# WVMS — Full PHP + MySQL integration

Backend ini mempertahankan UI/UX existing dan menjadikan MySQL sebagai sumber data persisten.

## Data yang disimpan
- `users`: akun dan metadata autentikasi.
- `wisma`: master wisma.
- `kunjungan`: jadwal dan hasil/realisasi kunjungan.
- `tiket`: tindak lanjut temuan checklist.
- `log_aktivitas`: aktivitas aplikasi dan audit server.
- `konfigurasi`: konfigurasi instansi/tampilan/template WA.
- `app_state`: snapshot kompatibilitas untuk data UI non-relasional.

## Perilaku migrasi
Saat `action=state` GET dijalankan, tabel inti yang masih kosong akan diisi dari snapshot `app_state` yang sudah ada. Migrasi dilakukan per tabel, jadi `wisma` yang sudah terisi tidak menghalangi migrasi `kunjungan` atau `tiket`.

## Penyimpanan
Setiap `App.save()` mengirim seluruh state ke PHP. PHP menjalankan transaksi yang menyinkronkan tabel-tabel inti dan snapshot. Legacy `id` VARCHAR didukung melalui `app_id` dan fallback ke kode/ID yang ada.

## Menjalankan
Gunakan Apache + MySQL/XAMPP dan akses `http://localhost/wvms/`. Jangan menggunakan Live Server port 5500.
