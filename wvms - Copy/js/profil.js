'use strict';

// ============================================================
// HALAMAN PROFIL - WVMS
// ============================================================

// 1. View Utama
App.views.profil = (a) => {
    const div = document.createElement('div');
    div.id = 'profil-root';
    div.innerHTML = App._buildProfilHTML();
    return div;
};

App._buildProfilHTML = () => `
<div id="profil-header-slot-inner"></div>

<div class="cols" style="grid-template-columns: 0.75fr 1.25fr;">

  <!-- Kartu Identitas -->
  <div class="panel" style="text-align:center;">
    <h2>👤 Identitas Akun</h2>
    <div class="pb">
      <div id="prof-avatar-preview" style="
        width:88px;height:88px;border-radius:50%;
        background:var(--pri);color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-size:2.2rem;font-weight:700;
        margin:0 auto 14px auto;
        box-shadow:0 4px 16px rgba(23,54,93,0.25);
        transition:transform 0.2s;
        cursor:default;
      ">A</div>

      <h3 id="prof-disp-nama" style="font-size:17px;margin:0 0 6px;"></h3>
      <span class="bdg b-Scheduled" id="prof-disp-role" style="display:inline-block;margin-bottom:10px;"></span>
      <p id="prof-disp-email" class="mu" style="font-size:13px;margin:0;"></p>

      <hr style="border:none;border-top:1px solid var(--bd);margin:16px 0;">

      <div style="text-align:left;">
        <div class="dl" style="grid-template-columns:100px 1fr;font-size:13px;">
          <dt>Jabatan</dt><dd id="prof-disp-jabatan">–</dd>
          <dt>Status</dt><dd><span class="bdg b-Completed">Aktif</span></dd>
          <dt>Role</dt><dd id="prof-disp-role2">–</dd>
        </div>
      </div>
    </div>
  </div>

  <!-- Statistik Kontribusi -->
  <div class="panel">
    <h2>📊 Statistik Aplikasi</h2>
    <div class="pb">
      <div class="cards" style="grid-template-columns:1fr 1fr;margin-bottom:20px;">
        <div class="card ok">
          <small>Kunjungan Selesai</small>
          <b id="stat-selesai">–</b>
        </div>
        <div class="card in">
          <small>Kunjungan Terjadwal</small>
          <b id="stat-terjadwal">–</b>
        </div>
        <div class="card wa">
          <small>Kunjungan Terlambat</small>
          <b id="stat-terlambat">–</b>
        </div>
        <div class="card">
          <small>Total Wisma Dikelola</small>
          <b id="stat-wisma">–</b>
        </div>
      </div>

      <h3 style="font-size:12px;font-weight:600;color:var(--mu);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">5 Aktivitas Terakhir</h3>
      <div id="prof-recent-log" style="display:grid;gap:6px;"></div>
    </div>
  </div>

</div>

<!-- Form Edit Profil -->
<div class="panel">
  <h2>✏️ Ubah Informasi Profil</h2>
  <div class="pb">
    <p class="mu" style="font-size:12px;margin-bottom:16px;">Perubahan ini akan memperbarui identitas yang tampil di header dan seluruh bagian aplikasi.</p>
    <div id="profil-form-slot"></div>
  </div>
</div>`;

// 2. Init Profil
App.views.profil.init = () => {
    // Header
    const headerSlot = $('#profil-header-slot-inner');
    if (headerSlot) {
        const h = App.buatPageHeader('Profil Saya', 'Lihat dan kelola informasi akun serta statistik aktivitas Anda');
        headerSlot.replaceWith(h);
    }

    const me = App.db.cfg.me || {};

    // Isi Kartu Identitas
    const inisial = (me.nama || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const avatarEl = $('#prof-avatar-preview');
    const dispNama = $('#prof-disp-nama');
    const dispEmail = $('#prof-disp-email');
    const dispRole = $('#prof-disp-role');
    const dispRole2 = $('#prof-disp-role2');
    const dispJabatan = $('#prof-disp-jabatan');

    if (avatarEl) avatarEl.textContent = inisial;
    if (dispNama) dispNama.textContent = me.nama || '–';
    if (dispEmail) dispEmail.textContent = me.email || '–';
    if (dispRole) dispRole.textContent = me.role || '–';
    if (dispRole2) dispRole2.textContent = me.role || '–';
    if (dispJabatan) dispJabatan.textContent = me.jabatan || '–';

    // Hitung Statistik
    const kunjungan = App.db.kunjungan || [];
    const wisma = App.db.wisma || [];
    const hitungStatus = (k) => App.hitungStatus(k);

    const statSelesai = kunjungan.filter(k => hitungStatus(k) === 'Completed').length;
    const statTerjadwal = kunjungan.filter(k => hitungStatus(k) === 'Scheduled' || hitungStatus(k) === 'Today').length;
    const statTerlambat = kunjungan.filter(k => hitungStatus(k) === 'Overdue').length;

    const el = id => document.getElementById(id);
    if (el('stat-selesai')) el('stat-selesai').textContent = statSelesai;
    if (el('stat-terjadwal')) el('stat-terjadwal').textContent = statTerjadwal;
    if (el('stat-terlambat')) el('stat-terlambat').textContent = statTerlambat;
    if (el('stat-wisma')) el('stat-wisma').textContent = wisma.length;

    // 5 Aktivitas Terakhir
    const logContainer = $('#prof-recent-log');
    if (logContainer) {
        const logs = (App.db.log || []).slice(0, 5);
        if (!logs.length) {
            logContainer.innerHTML = '<p class="mu" style="font-size:13px;">Belum ada aktivitas tercatat.</p>';
        } else {
            logContainer.innerHTML = logs.map(l => `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--th);border-radius:6px;font-size:12px;">
                    <span style="font-size:16px;">📝</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l.a || '–'}</div>
                        <div class="mu" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l.d || ''}</div>
                    </div>
                    <span class="mu" style="white-space:nowrap;">${App.waktuLalu(l.t)}</span>
                </div>
            `).join('');
        }
    }

    // Form Edit Profil
    const formSlot = $('#profil-form-slot');
    if (formSlot) {
        formSlot.innerHTML = `
            <div class="g2">
                ${App.buatField('nama', 'Nama Lengkap', me.nama || '', { req: true })}
                ${App.buatField('email', 'Email', me.email || '', { req: true, type: 'email' })}
                ${App.buatField('jabatan', 'Jabatan / Posisi', me.jabatan || '')}
                ${App.buatField('role', 'Role Sistem', me.role || 'Admin', {
                    opts: [['Admin', '🔑 Admin'], ['Staff', '👔 Staff'], ['Viewer', '👁 Viewer']]
                })}
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;">
                <button class="btn p" data-act="saveProfile">💾 Simpan Perubahan</button>
            </div>
        `;
    }
};

// 3. Simpan Profil
App.act.saveProfile = (btn) => {
    const panel = btn.closest('.panel');
    if (!panel) return;

    const namaVal = panel.querySelector('[name="nama"]')?.value.trim();
    const emailVal = panel.querySelector('[name="email"]')?.value.trim();
    const jabatanVal = panel.querySelector('[name="jabatan"]')?.value.trim();
    const roleVal = panel.querySelector('[name="role"]')?.value.trim();

    if (!namaVal) { App.toast('Nama tidak boleh kosong.', 'error'); return; }
    if (!emailVal) { App.toast('Email tidak boleh kosong.', 'error'); return; }

    App.db.cfg.me = {
        ...App.db.cfg.me,
        nama: namaVal,
        email: emailVal,
        jabatan: jabatanVal,
        role: roleVal
    };

    App.log('Mengubah Profil', `Pembaruan profil: ${namaVal}`);
    App.save();
    App.toast('Profil berhasil diperbarui!', 'success');
    App.refresh();
};