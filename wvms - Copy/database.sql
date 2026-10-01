-- WVMS database untuk XAMPP (MySQL/MariaDB).
-- Aman diimpor berulang: semua tabel memakai CREATE TABLE IF NOT EXISTS dan tidak ada DROP/TRUNCATE.
-- Jika wvms_db Anda sudah punya tabel dengan struktur lama, backend (backend/schema.php) akan menjalankan
-- migrasi otomatis saat login pertama: tabel lama TIDAK dihapus, hanya diganti nama menjadi <tabel>_legacy_<waktu>
-- lalu datanya disalin ke tabel baru. Urutan tabel di bawah penting karena ada foreign key.

CREATE DATABASE IF NOT EXISTS `wvms_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `wvms_db`;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `app_state` (
  `id` TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  `data` LONGTEXT NOT NULL,
  `updated_by` VARCHAR(190) NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `log_aktivitas` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `t` BIGINT NULL,
  `u` VARCHAR(190) NULL,
  `a` VARCHAR(255) NOT NULL,
  `d` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_log_t` (`t`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `konfigurasi` (
  `kunci` VARCHAR(100) NOT NULL,
  `nilai_json` LONGTEXT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`kunci`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Akun admin awal (password: admin123). Segera ganti: lihat SETUP-PHP-MYSQL.md > Ganti password.
INSERT INTO `users` (`nama`,`email`,`password`,`role`,`status`)
VALUES ('Administrator','admin@perusahaan.co.id',
        '$2y$12$lKqqIkt7uNHdZMGaWKmx0.rqOHbToBbcWlrUIAzec1fMCRlcfkNTS',
        'Admin','Aktif')
ON DUPLICATE KEY UPDATE `nama`=VALUES(`nama`), `role`=VALUES(`role`), `status`=VALUES(`status`);
