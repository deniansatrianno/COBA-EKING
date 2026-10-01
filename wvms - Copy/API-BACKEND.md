# API WVMS

Semua endpoint: `backend/index.php?action=<nama>`. Respons selalu JSON `{"status":"success|error","message":...}`; galat memakai kode HTTP yang sesuai (400/401/403/404/405/409/413/415/422/500). Endpoint yang mengubah data wajib `POST` dengan `Content-Type: application/json`. Autentikasi memakai cookie session PHP `WVMSSESS` (HttpOnly, SameSite=Lax).

| Action | Method | Peran | Fungsi |
|---|---|---|---|
| `health` | GET | publik | Cek PHP/MySQL dan skema. Bila sudah login: jumlah baris tiap tabel. |
| `login` | POST | publik | Body `{email, sandi, ingat}`. `password_verify()`; membuat session. |
| `logout` | POST | login | Mengakhiri session di server. |
| `me` | GET | login | User yang sedang login. |
| `state` | GET | login | Seluruh data (wisma, kunjungan, tiket, log, cfg, read, users*) dibaca dari tabel relasional. *`users` hanya untuk Admin. |
| `sync` | POST | Admin/Staff | Terapkan perubahan (lihat di bawah) dalam satu transaksi. Viewer ditolak (403). |
| `users` | GET | Admin | Daftar pengguna. |
| `schema` | GET | Admin | Menjalankan pemeriksaan/migrasi skema dan mengembalikan laporannya. |

## Body `sync`
```json
{ "ops": {
  "wisma":     { "create": [ {...} ], "update": [ {...} ], "delete": ["ID-001"] },
  "kunjungan": { "create": [], "update": [], "delete": [] },
  "tiket":     { "create": [], "update": [], "delete": [] },
  "cfg":       { "set": {"theme":"dark"}, "unset": ["kunci"] },
  "log":       [ {"t":1700000000000,"a":"Aksi","d":"detail"} ],
  "read":      ["notif-id"]
} }
```
- `create` gagal 409 bila ID/kode sudah ada (tidak menimpa data pengguna lain); `update` gagal 404 bila baris sudah dihapus.
- `kunjungan.kode` / `tiket.kode` harus ada di `wisma.kode` (422 bila tidak).
- Hapus hanya Admin (403 untuk Staff). Kunci konfigurasi `company, alamat, email, telp, logo` hanya Admin.
- Nama pelaku di `log` selalu diambil dari session server, bukan dari body.
- Field yang tidak punya kolom sendiri disimpan di kolom `meta_json` agar tidak ada data yang hilang.
