'use strict';

// ============================================================
// HALAMAN PENGATURAN - WVMS
// ============================================================

// 1. View Utama
App.views.settings = () => {
    const frag = document.createDocumentFragment();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div id="settings-header-slot"></div>`;
    frag.appendChild(wrapper);

    // Load HTML partial pengaturan
    const htmlSlot = $('#settings-header-slot') || document.createElement('div');
    const headerElem = App.buatPageHeader(
        'Pengaturan Aplikasi',
        'Konfigurasi instansi, preferensi tampilan, backup data, dan log aktivitas sistem'
    );
    return frag;
};

// Override: gunakan fetch untuk muat HTML partial
App.views.settings = (a) => {
    const div = document.createElement('div');
    div.id = 'settings-root';
    // Konten dibangun langsung via JS agar tidak bergantung fetch
    div.innerHTML = App._buildSettingsHTML();
    return div;
};

App._buildSettingsHTML = () => `
<div id="settings-header-slot-inner"></div>

<div class="cols" style="grid-template-columns: 1.2fr 0.8fr;">
  <div class="panel">
    <h2>🏢 Informasi Instansi</h2>
    <div class="pb">
      <p class="mu" style="margin-bottom:14px;font-size:12px;">Data ini tampil di header aplikasi dan dokumen ekspor.</p>
      <div id="cfg-company-slot"></div>
    </div>
  </div>
  <div class="panel">
    <h2>🎨 Preferensi Tampilan</h2>
    <div class="pb">
      <p class="mu" style="margin-bottom:14px;font-size:12px;">Atur tampilan dan perilaku umum aplikasi.</p>
      <div id="cfg-display-slot"></div>
    </div>
  </div>
</div>

<div class="panel">
  <h2>💾 Kelola Data Aplikasi</h2>
  <div class="pb">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;">
      <div style="border:1px solid var(--bd);border-radius:8px;padding:18px;border-top:3px solid var(--ok);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="font-size:24px;">📦</span>
          <div><b style="display:block;font-size:14px;">Backup Data</b><span class="mu" style="font-size:12px;">Ekspor seluruh data ke file JSON</span></div>
        </div>
        <p class="mu" style="font-size:12px;margin-bottom:14px;">Unduh salinan lengkap database WVMS (wisma, kunjungan, log, konfigurasi) dalam format <code>.json</code>.</p>
        <button class="btn p" data-act="backupData" style="width:100%;">⬇ Download Backup JSON</button>
      </div>
      <div style="border:1px solid var(--bd);border-radius:8px;padding:18px;border-top:3px solid var(--in);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="font-size:24px;">📂</span>
          <div><b style="display:block;font-size:14px;">Restore Data</b><span class="mu" style="font-size:12px;">Pulihkan dari file backup JSON</span></div>
        </div>
        <p class="mu" style="font-size:12px;margin-bottom:14px;">Pilih file <code>.json</code> backup yang pernah diunduh untuk memulihkan seluruh data ke kondisi tersimpan.</p>
        <button class="btn" data-act="restoreData" style="width:100%;border-color:var(--in);color:var(--in);">⬆ Upload File Backup</button>
      </div>
      <div style="border:1px solid var(--bd);border-radius:8px;padding:18px;border-top:3px solid var(--er);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="font-size:24px;">⚠️</span>
          <div><b style="display:block;font-size:14px;">Reset Data</b><span class="mu" style="font-size:12px;">Kembalikan ke kondisi awal / demo</span></div>
        </div>
        <p class="mu" style="font-size:12px;margin-bottom:14px;"><b style="color:var(--er);">Hati-hati!</b> Tindakan ini menghapus <b>seluruh data</b> dan mengembalikan ke data demo. Tidak bisa dibatalkan!</p>
        <button class="btn d" data-act="resetData" style="width:100%;">🗑 Reset ke Data Default</button>
      </div>
    </div>
  </div>
</div>

<div class="panel">
  <h2>📋 Log Aktivitas Sistem</h2>
  <p class="mu" style="padding:0 14px 10px;font-size:12px;">Rekam jejak 50 aksi terakhir yang dilakukan pada aplikasi.</p>
  <div class="tw">
    <table>
      <thead><tr>
        <th style="width:160px;">⏱ Waktu</th>
        <th style="width:140px;">👤 Pengguna</th>
        <th style="width:200px;">Aksi</th>
        <th>Detail</th>
      </tr></thead>
      <tbody id="log-table-body"></tbody>
    </table>
  </div>
</div>`;

// 2. Init Settings
App.views.settings.init = () => {
    // Header
    const headerSlot = $('#settings-header-slot-inner');
    if (headerSlot) {
        const h = App.buatPageHeader(
            'Pengaturan Aplikasi',
            'Konfigurasi instansi, preferensi tampilan, backup data, dan log aktivitas sistem'
        );
        headerSlot.replaceWith(h);
    }

    // Form Konfigurasi Perusahaan
    const companySlot = $('#cfg-company-slot');
    if (companySlot) {
        companySlot.innerHTML =
            App.buatField('company', 'Nama Instansi / Perusahaan', App.db.cfg.company || '', { req: true }) +
            App.buatField('alamat', 'Alamat Kantor', App.db.cfg.alamat || '', { area: true }) +
            App.buatField('email', 'Email Instansi', App.db.cfg.email || '', { type: 'email' }) +
            App.buatField('telp', 'Nomor Telepon', App.db.cfg.telp || '') +
            `<button class="btn p" data-act="saveCfgCompany" style="margin-top:4px;">💾 Simpan Informasi Instansi</button>`;
    }

    // Form Preferensi Tampilan
    const displaySlot = $('#cfg-display-slot');
    if (displaySlot) {
        displaySlot.innerHTML =
            App.buatField('theme', 'Tema Tampilan', App.db.cfg.theme || 'light', {
                opts: [['light', '☀️ Light Mode'], ['dark', '🌙 Dark Mode']]
            }) +
            App.buatField('datefmt', 'Format Tanggal', App.db.cfg.datefmt || 'id', {
                opts: [['id', '🇮🇩 Indonesia (01 Jan 2025)'], ['iso', '📅 ISO (2025-01-01)']]
            }) +
            App.buatField('rows', 'Baris Per Halaman', App.db.cfg.rows || 10, { type: 'number' }) +
            App.buatField('remind', 'Pengingat Kunjungan Hari Ini', App.db.cfg.remind ? 'ya' : 'tidak', {
                opts: [['ya', '✅ Aktifkan Pengingat'], ['tidak', '❌ Nonaktifkan']]
            }) +
            `<button class="btn p" data-act="saveCfgDisplay" style="margin-top:4px;">💾 Simpan Preferensi</button>`;
    }

    // Log Aktivitas
    const tbody = $('#log-table-body');
    if (tbody) {
        tbody.innerHTML = '';
        const logs = [...(App.db.log || [])];
        if (!logs.length) {
            tbody.innerHTML = '<tr><td colspan="4"><div class="empty">Belum ada riwayat aktivitas.</div></td></tr>';
        } else {
            logs.slice(0, 50).forEach(l => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="mu" style="font-size:12px;">${App.waktuLalu(l.t)}</td>
                    <td><span style="font-size:12px;">${l.u || '–'}</span></td>
                    <td><b>${l.a || '–'}</b></td>
                    <td class="mu" style="font-size:12px;">${l.d || '–'}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
};

// 3. Simpan Konfigurasi Perusahaan
App.act.saveCfgCompany = (btn) => {
    const panel = btn.closest('.panel');
    if (!panel) return;

    const company = panel.querySelector('[name="company"]')?.value.trim();
    const alamat = panel.querySelector('[name="alamat"]')?.value.trim();
    const email = panel.querySelector('[name="email"]')?.value.trim();
    const telp = panel.querySelector('[name="telp"]')?.value.trim();

    if (!company) { App.toast('Nama instansi tidak boleh kosong.', 'error'); return; }

    App.db.cfg.company = company;
    App.db.cfg.alamat = alamat;
    App.db.cfg.email = email;
    App.db.cfg.telp = telp;

    App.log('Mengubah Pengaturan', 'Pembaruan informasi instansi');
    App.save();
    App.toast('Informasi instansi berhasil disimpan.', 'success');
    App.refresh();
};

// 4. Simpan Preferensi Tampilan
App.act.saveCfgDisplay = (btn) => {
    const panel = btn.closest('.panel');
    if (!panel) return;

    const theme = panel.querySelector('[name="theme"]')?.value;
    const datefmt = panel.querySelector('[name="datefmt"]')?.value;
    const rows = parseInt(panel.querySelector('[name="rows"]')?.value, 10);
    const remind = panel.querySelector('[name="remind"]')?.value === 'ya';

    if (!rows || rows < 1) { App.toast('Jumlah baris minimal 1.', 'error'); return; }

    App.db.cfg.theme = theme || 'light';
    App.db.cfg.datefmt = datefmt || 'id';
    App.db.cfg.rows = rows;
    App.db.cfg.remind = remind;

    App.log('Mengubah Preferensi', 'Pembaruan tema dan tampilan sistem');
    App.save();
    App.toast('Preferensi tampilan berhasil disimpan.', 'success');
    App.refresh();
};

// 5. Backup Data
App.act.backupData = () => {
    const jsonStr = JSON.stringify(App.db, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-wvms-${App.today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    App.log('Backup Data', 'Mengekspor database ke file JSON');
    App.toast('File backup JSON berhasil diunduh.', 'success');
};

// 6. Restore Data (hanya Admin; menggantikan isi MySQL dengan isi file backup)
App.act.restoreData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result);
                if (Array.isArray(parsed.wisma) && Array.isArray(parsed.kunjungan) && parsed.cfg) {
                    const me = App.db.cfg.me;
                    App.db.wisma = parsed.wisma;
                    App.db.kunjungan = parsed.kunjungan;
                    App.db.tiket = Array.isArray(parsed.tiket) ? parsed.tiket : [];
                    App.db.cfg = { ...parsed.cfg, me };
                    App.save().then(ok => {
                        if (ok) App.toast('Data berhasil dipulihkan dari backup ke MySQL!', 'success');
                        App.refresh();
                    });
                } else {
                    App.toast('Format file backup tidak valid. Pastikan file adalah backup WVMS yang benar.', 'error');
                }
            } catch (err) {
                App.toast('Gagal membaca file JSON. File mungkin rusak.', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

// 7. Reset Data (hanya Admin): mengganti isi MySQL dengan data contoh awal
App.act.resetData = () => {
    App.confirm(
        `Apakah Anda yakin ingin <b>mereset seluruh data</b>?<br><br>
        Tindakan ini akan:<br>
        • Menghapus semua data wisma &amp; kunjungan<br>
        • Mengembalikan ke data demo awal<br>
        • <b style="color:var(--er)">Tidak dapat dibatalkan!</b>`,
        () => {
            const demo = App.seed();
            App.db.wisma = demo.wisma;
            App.db.kunjungan = demo.kunjungan;
            App.db.tiket = [];
            App.db.cfg = { ...demo.cfg, me: App.db.cfg.me };
            App.save().then(ok => { if (ok) location.reload(); });
        }
    );
};
