'use strict';

// State Filter Laporan
App.lapFilter = {
  mulai: '',
  selesai: ''
};

// 1. View Utama Halaman Laporan
App.views.laporan = () => {
  const templateLap = $('#tmpl-page-laporan');
  const frag = templateLap ? templateLap.content.cloneNode(true) : document.createDocumentFragment();

  const headerElem = App.buatPageHeader('Laporan Kunjungan', 'Analisis dan rekapitulasi histori kunjungan wisma');
  frag.querySelector('#laporan-header-slot')?.replaceWith(headerElem);

  return frag;
};

// 2. Fungsi Init Laporan
App.views.laporan.init = () => {
  App.updLaporan();
};

// 3. Render / Update Laporan
App.updLaporan = () => {
  let daftarKunjungan = [...App.db.kunjungan];

  // Filter Tanggal
  if (App.lapFilter.mulai) {
    daftarKunjungan = daftarKunjungan.filter(k => k.tgl >= App.lapFilter.mulai);
  }
  if (App.lapFilter.selesai) {
    daftarKunjungan = daftarKunjungan.filter(k => k.tgl <= App.lapFilter.selesai);
  }

  // Hitung Stat
  let countTerjadwal = 0;
  let countSelesai = 0;
  let countTerlambat = 0;

  daftarKunjungan.forEach(k => {
    const st = App.hitungStatus(k);
    // App.hitungStatus() mengembalikan 'Scheduled', 'Completed', 'Overdue', 'Today', 'Cancelled'
    if (st === 'Scheduled' || st === 'Today') countTerjadwal++;
    else if (st === 'Completed') countSelesai++;
    else if (st === 'Overdue') countTerlambat++;
  });

  // Render Stat Cards
  const statsSlot = $('#laporan-stats-slot');
  if (statsSlot) {
    statsSlot.innerHTML = `
      <div class="card"><h4>Total Wisma</h4><div class="num">${App.db.wisma.length}</div></div>
      <div class="card"><h4>Terjadwal</h4><div class="num">${countTerjadwal}</div></div>
      <div class="card"><h4>Selesai</h4><div class="num">${countSelesai}</div></div>
      <div class="card"><h4>Terlambat</h4><div class="num">${countTerlambat}</div></div>
    `;
  }

  // Rekap per Wisma
  const tbody = $('#laporan-table-body');
  if (tbody) {
    tbody.innerHTML = '';
    App.db.wisma.forEach(w => {
      const kWisma = daftarKunjungan.filter(k => k.kode === w.kode);
      let tJadwal = 0, tSelesai = 0, tLambat = 0;

      kWisma.forEach(k => {
        const st = App.hitungStatus(k);
        // Cocokkan dengan nilai yang dikembalikan App.hitungStatus()
        if (st === 'Scheduled' || st === 'Today') tJadwal++;
        else if (st === 'Completed') tSelesai++;
        else if (st === 'Overdue') tLambat++;
      });

      const frag = App.cloneTemplate('tmpl-laporan-row');
      frag.querySelector('[data-element="kode"]').textContent = w.kode;
      frag.querySelector('[data-element="nama"]').textContent = w.nama;
      frag.querySelector('[data-element="pic"]').textContent = w.pic;
      frag.querySelector('[data-element="terjadwal"]').textContent = tJadwal;
      frag.querySelector('[data-element="selesai"]').textContent = tSelesai;
      frag.querySelector('[data-element="terlambat"]').textContent = tLambat;
      frag.querySelector('[data-element="total"]').textContent = kWisma.length;

      tbody.appendChild(frag);
    });
  }
};

// 4. Aksi Laporan
App.act.filterLaporan = () => {
  const inputMulai = $('#lap-tgl-mulai');
  const inputSelesai = $('#lap-tgl-selesai');

  App.lapFilter.mulai = inputMulai ? inputMulai.value : '';
  App.lapFilter.selesai = inputSelesai ? inputSelesai.value : '';

  App.updLaporan();
  App.toast('Filter laporan diterapkan.');
};

App.act.resetFilterLaporan = () => {
  const inputMulai = $('#lap-tgl-mulai');
  const inputSelesai = $('#lap-tgl-selesai');
  if (inputMulai) inputMulai.value = '';
  if (inputSelesai) inputSelesai.value = '';

  App.lapFilter.mulai = '';
  App.lapFilter.selesai = '';

  App.updLaporan();
  App.toast('Filter laporan direset.');
};

App.act.expLaporan = () => {
  const baris = [['Kode Wisma', 'Nama Wisma', 'PIC', 'Terjadwal', 'Selesai', 'Terlambat', 'Total Kunjungan']];

  App.db.wisma.forEach(w => {
    let daftarK = App.db.kunjungan.filter(k => k.kode === w.kode);
    if (App.lapFilter.mulai) daftarK = daftarK.filter(k => k.tgl >= App.lapFilter.mulai);
    if (App.lapFilter.selesai) daftarK = daftarK.filter(k => k.tgl <= App.lapFilter.selesai);

    let tJadwal = 0, tSelesai = 0, tLambat = 0;
    daftarK.forEach(k => {
      const st = App.hitungStatus(k);
      if (st === 'Scheduled' || st === 'Today') tJadwal++;
      else if (st === 'Completed') tSelesai++;
      else if (st === 'Overdue') tLambat++;
    });

    baris.push([w.kode, w.nama, w.pic, tJadwal, tSelesai, tLambat, daftarK.length]);
  });

  App.csv('laporan-kunjungan.csv', baris);
};