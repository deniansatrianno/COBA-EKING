'use strict';

// State Kalender Kunjungan
App.calState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth()
};

// 1. View Utama Halaman Kunjungan
App.views.kunjungan = () => {
  const templateKunjungan = $('#tmpl-page-kunjungan');
  const frag = templateKunjungan ? templateKunjungan.content.cloneNode(true) : document.createDocumentFragment();

  // Inisialisasi State Grid Kunjungan
  App.G.k = App.G.k || {
    s: { q: '', f: { status: '', pic: '', dari: '', sampai: '' }, sk: 'tgl', sd: -1, p: 1, n: App.db.cfg.rows, sel: new Set() }
  };

  // Buat Page Header
  const tombolTambah = document.createElement('button');
  tombolTambah.className = 'btn p';
  tombolTambah.dataset.act = 'addK';
  tombolTambah.textContent = '+ Jadwalkan Kunjungan';

  const headerElem = App.buatPageHeader('Jadwal Kunjungan', 'Kelola perencanaaan dan realisasi kunjungan wisma', tombolTambah);
  frag.querySelector('#kunjungan-header-slot')?.replaceWith(headerElem);

  return frag;
};

// 2. Fungsi Init Setelah DOM Halaman Kunjungan Selesai Dirender
App.views.kunjungan.init = () => {
  const pilihPic = $('select[data-f="pic"]');
  if (pilihPic) {
    [...new Set(App.db.wisma.map(w => w.pic).filter(Boolean))].sort().forEach(p => {
      const o = document.createElement('option'); o.value = o.textContent = p; pilihPic.appendChild(o);
    });
  }
  App.updKunjungan();
  App.renderCalendar();
};

// 3. Render / Update Komponen Tabel Kunjungan
App.updKunjungan = () => {
  const stateGrid = App.G.k?.s;
  if (!stateGrid) return;

  // Gabungkan Data Kunjungan dengan Data Wisma
  let dataKunjungan = App.db.kunjungan.map(k => {
    const wisma = App.W(k.kode);  // App.W sudah handle wisma dihapus dengan aman
    const status = App.hitungStatus(k);
    return {
      ...k,
      // Jika wisma dihapus, wismaNama akan berisi '⚠ Wisma Telah Dihapus'
      wismaNama : wisma.nama || 'Wisma Tidak Ditemukan',
      pic       : wisma.pic  || '-',
      wismaHapus: wisma._hapus || false,  // flag untuk styling
      status
    };
  });

  // Filter Query Pencarian
  if (stateGrid.q) {
    const kueri = stateGrid.q.toLowerCase();
    dataKunjungan = dataKunjungan.filter(k =>
      (k.wismaNama + k.kode + k.pic + k.catatan).toLowerCase().includes(kueri)
    );
  }

  // Filter Status
  if (stateGrid.f.status) {
    dataKunjungan = dataKunjungan.filter(k => k.status === stateGrid.f.status);
  }

  if (stateGrid.f.pic) dataKunjungan = dataKunjungan.filter(k => k.pic === stateGrid.f.pic);
  if (stateGrid.f.dari) dataKunjungan = dataKunjungan.filter(k => k.tgl >= stateGrid.f.dari);
  if (stateGrid.f.sampai) dataKunjungan = dataKunjungan.filter(k => k.tgl <= stateGrid.f.sampai);

  // Sorting
  dataKunjungan.sort((a, b) => {
    const nilaiA = String(a[stateGrid.sk] || '').toLowerCase();
    const nilaiB = String(b[stateGrid.sk] || '').toLowerCase();
    return nilaiA > nilaiB ? stateGrid.sd : (nilaiA < nilaiB ? -stateGrid.sd : 0);
  });

  // Bulk Action UI
  const bulkSlot = $('#kunjungan-bulk-slot');
  if (bulkSlot) {
    if (stateGrid.sel.size > 0) {
      bulkSlot.hidden = false;
      bulkSlot.className = 'bulk';
      bulkSlot.innerHTML = '';

      const span = document.createElement('span');
      span.textContent = `${stateGrid.sel.size} kunjungan dipilih`;

      const btnHapusMassal = document.createElement('button');
      btnHapusMassal.className = 'btn s d';
      btnHapusMassal.dataset.act = 'delKBulk';
      btnHapusMassal.textContent = 'Hapus Terpilih';

      const btnBatal = document.createElement('button');
      btnBatal.className = 'btn s';
      btnBatal.dataset.g = 'k';
      btnBatal.setAttribute('data-clr', '1');
      btnBatal.textContent = 'Batal';

      bulkSlot.appendChild(span);
      bulkSlot.appendChild(btnHapusMassal);
      bulkSlot.appendChild(btnBatal);
    } else {
      bulkSlot.hidden = true;
    }
  }

  // Paginasi
  const totalBaris = dataKunjungan.length;
  const totalHalaman = Math.ceil(totalBaris / stateGrid.n) || 1;
  if (stateGrid.p > totalHalaman) stateGrid.p = totalHalaman;

  const awalBaris = (stateGrid.p - 1) * stateGrid.n;
  const barisHalamanIni = dataKunjungan.slice(awalBaris, awalBaris + stateGrid.n);

  const tbody = $('#kunjungan-table-body');
  if (tbody) {
    tbody.innerHTML = '';
    if (!barisHalamanIni.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7"><div class="empty">Tidak ada jadwal kunjungan ditemukan.</div></td>';
      tbody.appendChild(tr);
    } else {
      barisHalamanIni.forEach(item => {
        const frag = App.cloneTemplate('tmpl-kunjungan-row');
        const checkbox = frag.querySelector('[data-element="checkbox"]');
        checkbox.dataset.g = 'k';
        checkbox.dataset.id = item.id;
        checkbox.checked = stateGrid.sel.has(item.id);

        frag.querySelector('[data-element="wisma-nama"]').textContent = item.wismaNama;

        // Beri style khusus (abu-abu miring) jika wisma sudah dihapus
        if (item.wismaHapus) {
          const elNama = frag.querySelector('[data-element="wisma-nama"]');
          elNama.style.color  = 'var(--mu)';
          elNama.style.fontStyle = 'italic';
          elNama.title = 'Kunjungan ini merujuk wisma yang sudah dihapus (kode: ' + item.kode + ')';
        }
        frag.querySelector('[data-element="wisma-kode"]').textContent = App.W(item.kode)._rusak ? '-' : item.kode;
        frag.querySelector('[data-element="pic"]').textContent = item.pic;
        frag.querySelector('[data-element="tgl-rencana"]').textContent = App.fmt(item.tgl);
        frag.querySelector('[data-element="tgl-realisasi"]').textContent = item.real ? App.fmt(item.real) : '-';

        const tdStatus = frag.querySelector('[data-element="status"]');
        tdStatus.appendChild(App.buatBadgeElement(item.status));

        frag.querySelector('[data-element="btn-detail"]').dataset.id = item.id;
        frag.querySelector('[data-element="btn-edit"]').dataset.id = item.id;
        frag.querySelector('[data-element="btn-delete"]').dataset.id = item.id;
        
        const btnWA = frag.querySelector('[data-element="btn-wa"]');
        if (btnWA) {
            btnWA.dataset.id = item.id;
            // Only show WA button if not cancelled or completed
            if (item.status === 'Cancelled' || item.status === 'Completed') {
                btnWA.style.display = 'none';
            }
        }

        tbody.appendChild(frag);
      });
    }
  }

  // Render Baris Paginasi
  const pgSlot = $('#kunjungan-pagination-slot');
  if (pgSlot) {
    pgSlot.innerHTML = '';

    const spanInfo = document.createElement('span');
    spanInfo.textContent = `Menampilkan ${totalBaris ? awalBaris + 1 : 0}-${Math.min(awalBaris + stateGrid.n, totalBaris)} dari ${totalBaris} jadwal`;

    const spanGrow = document.createElement('span');
    spanGrow.className = 'grow';

    pgSlot.appendChild(spanInfo);
    pgSlot.appendChild(spanGrow);

    for (let i = 1; i <= totalHalaman; i++) {
      const btnHal = document.createElement('button');
      btnHal.className = 'btn s' + (i === stateGrid.p ? ' on' : '');
      btnHal.dataset.g = 'k';
      btnHal.dataset.p = i;
      btnHal.textContent = i;
      pgSlot.appendChild(btnHal);
    }
  }
};

// 4. Render Kalender Kunjungan
App.renderCalendar = () => {
  const container = $('#calendar-grid');
  const title = $('#cal-month-title');
  if (!container || !title) return;

  const y = App.calState.year;
  const m = App.calState.month;

  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  title.textContent = `${namaBulan[m]} ${y}`;

  container.innerHTML = '';

  const namaHari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  namaHari.forEach(h => {
    const div = document.createElement('div');
    div.className = 'cal-head';
    div.textContent = h;
    container.appendChild(div);
  });

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const div = document.createElement('div');
    div.className = 'cal-day empty';
    container.appendChild(div);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const div = document.createElement('div');
    div.className = 'cal-day';

    const numSpan = document.createElement('span');
    numSpan.className = 'cal-num';
    numSpan.textContent = d;
    div.appendChild(numSpan);

    const daftarAgenda = App.db.kunjungan.filter(k => k.tgl === dateStr);
    daftarAgenda.forEach(k => {
      const wisma = App.db.wisma.find(w => w.kode === k.kode);
      const item = document.createElement('div');
      item.className = 'cal-item ' + App.hitungStatus(k).toLowerCase();
      item.textContent = wisma ? wisma.nama : k.kode;
      item.dataset.act = 'detK';
      item.dataset.id = k.id;
      div.appendChild(item);
    });

    container.appendChild(div);
  }
};

// Registrasi Handler Update
App.upd = (namaGrup) => {
  if (namaGrup === 'k') App.updKunjungan();
};

// 5. Switcher Tampilan (Tabel vs Kalender)
// kunjungan_2.js (Baris 234)
App.act.switchKView = (btn) => {
  // Update tab styling
  const tabs = btn.closest('.tabs').querySelectorAll('a');
  tabs.forEach(t => t.classList.remove('on'));
  btn.classList.add('on');

  // Toggle views
  const view = btn.dataset.view;
  const vTable = $('#kunjungan-view-table');
  const vCalendar = $('#kunjungan-view-calendar');

  if (view === 'table') {
      vTable.hidden = false;
      vCalendar.hidden = true;
  } else {
      vTable.hidden = true;
      vCalendar.hidden = false;
      App.renderCalendar();
  }
};

App.act.addK = () => {
  if (!App.db.wisma || !App.db.wisma.length) {
    App.toast('Tambahkan data wisma terlebih dahulu.', 'error');
    return;
  }

  const opsiWisma = App.db.wisma.map(w => [w.kode, `${w.kode} - ${w.nama}`]);

  // Ambil tanggal hari ini secara aman
  const tglHariIni = (typeof App.today === 'function') ? App.today() : (App.today || new Date().toISOString().slice(0, 10));

  const formContent = document.createElement('div');
  formContent.innerHTML =
    '<div class="g2">' +
    App.buatField('kode', 'Pilih Wisma', '', { req: true, opts: opsiWisma }) +
    App.buatField('tgl', 'Tanggal Rencana Kunjungan', tglHariIni, { req: true, type: 'date' }) +
    App.buatField('tujuan', 'Tujuan Kunjungan', 'Pemeliharaan Rutin', { req: true, opts: ['Pemeliharaan Rutin', 'Inspeksi Mendadak', 'Serah Terima Kunci', 'Audit Fasilitas', 'Lainnya'] }) +
    App.buatField('prioritas', 'Prioritas', 'Normal', { req: true, opts: [['Rendah', '🟢 Rendah'], ['Normal', '🟡 Normal'], ['Tinggi', '🔴 Tinggi']] }) +
    '</div>' +
    App.buatField('catatan', 'Catatan / Agenda Lengkap', '', { area: true });

  App.modal('Jadwalkan Kunjungan Baru', formContent, (dataForm) => {
    const errorList = App.req(dataForm, ['kode', 'tgl', 'tujuan', 'prioritas']);
    if (Object.keys(errorList).length) return errorList;

    const kunjunganBaru = {
      id: App.nextVid(),
      kode: dataForm.kode,
      tgl: dataForm.tgl,
      tujuan: dataForm.tujuan,
      prioritas: dataForm.prioritas,
      real: '',
      catatan: dataForm.catatan ? dataForm.catatan.trim() : ''
    };

    App.db.kunjungan.push(kunjunganBaru);
    if (typeof App.log === 'function') App.log('Menjadwalkan Kunjungan', `Kunjungan ke ${kunjunganBaru.kode} tgl ${kunjunganBaru.tgl}`);
    App.save();
    App.toast('Jadwal kunjungan berhasil ditambahkan.', 'success');
    App.refresh();
  }, { ok: 'Simpan Jadwal', w: true });
};

App.act.kirimWA = (tombol) => {
  const idKunjungan = tombol.dataset.id;
  const kunjungan = App.db.kunjungan.find(k => k.id === idKunjungan);
  if (!kunjungan) return;

  const wisma = App.db.wisma.find(w => w.kode === kunjungan.kode);
  if (!wisma) return;

  const picName = wisma.pic || 'Bapak/Ibu PIC';
  const tgl = App.fmt(kunjungan.tgl);
  const msg = App.pesanWA(kunjungan, wisma);
  
  const encodedMsg = encodeURIComponent(msg);
  window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
};

App.act.calPrev = () => {
  App.calState.month--;
  if (App.calState.month < 0) {
    App.calState.month = 11;
    App.calState.year--;
  }
  App.renderCalendar();
};

App.act.calNext = () => {
  App.calState.month++;
  if (App.calState.month > 11) {
    App.calState.month = 0;
    App.calState.year++;
  }
  App.renderCalendar();
};

// 6. Aksi CRUD Kunjungan

App.act.editK = (tombol) => {
  const idKunjungan = tombol.dataset.id;
  const kunjungan = App.db.kunjungan.find(k => k.id === idKunjungan);
  if (!kunjungan) return;

  const opsiWisma = App.db.wisma.map(w => [w.kode, `${w.kode} - ${w.nama}`]);
  const kodeValid = App.db.wisma.some(w => w.kode === kunjungan.kode);
  if (!kodeValid) opsiWisma.unshift(['', '— Pilih wisma yang benar —']);

  const formContent = document.createElement('div');
  formContent.innerHTML =
    '<div class="g2">' +
    App.buatField('kode', 'Wisma', kodeValid ? kunjungan.kode : '', { req: true, opts: opsiWisma }) +
    App.buatField('tgl', 'Tanggal Rencana', kunjungan.tgl, { req: true, type: 'date' }) +
    App.buatField('tujuan', 'Tujuan Kunjungan', kunjungan.tujuan || 'Pemeliharaan Rutin', { req: true, opts: ['Pemeliharaan Rutin', 'Inspeksi Mendadak', 'Serah Terima Kunci', 'Audit Fasilitas', 'Lainnya'] }) +
    App.buatField('prioritas', 'Prioritas', kunjungan.prioritas || 'Normal', { req: true, opts: [['Rendah', '🟢 Rendah'], ['Normal', '🟡 Normal'], ['Tinggi', '🔴 Tinggi']] }) +
    App.buatField('real', 'Tanggal Realisasi', kunjungan.real || '', { type: 'date' }) +
    App.buatField('status_batal', 'Batalkan Kunjungan?', kunjungan.batal ? 'ya' : 'tidak', { opts: [['tidak', 'Jadwal Aktif'], ['ya', 'Batalkan Jadwal']] }) +
    '</div>' +
    App.buatField('catatan', 'Catatan / Hasil Kunjungan', kunjungan.catatan || '', { area: true });

  App.modal('Edit Kunjungan', formContent, (dataForm) => {
    const errorList = App.req(dataForm, ['kode', 'tgl', 'tujuan', 'prioritas']);
    if (Object.keys(errorList).length) return errorList;

    kunjungan.kode = dataForm.kode;
    kunjungan.tgl = dataForm.tgl;
    kunjungan.tujuan = dataForm.tujuan;
    kunjungan.prioritas = dataForm.prioritas;
    kunjungan.real = dataForm.real || '';
    kunjungan.batal = dataForm.status_batal === 'ya';
    kunjungan.catatan = dataForm.catatan ? dataForm.catatan.trim() : '';

    App.log('Mengubah Kunjungan', `Perubahan jadwal ID ${kunjungan.id}`);
    App.save();
    App.toast('Data kunjungan berhasil diperbarui.', 'success');
    App.refresh();
  }, { ok: 'Simpan Perubahan', w: true });
};

App.act.detK = (tombol) => {
  const idKunjungan = tombol.dataset.id;
  const kunjungan = App.db.kunjungan.find(k => k.id === idKunjungan);
  if (!kunjungan) return;

  const wisma = App.db.wisma.find(w => w.kode === kunjungan.kode) || {};
  const status = App.hitungStatus(kunjungan);

  const container = document.createElement('div');

  const dl = document.createElement('dl');
  dl.className = 'dl';
  dl.innerHTML = `
    <dt>ID Kunjungan</dt><dd><b>${kunjungan.id}</b></dd>
    <dt>Wisma</dt><dd>${wisma.nama || '-'} (${kunjungan.kode})</dd>
    <dt>PIC Wisma</dt><dd>${wisma.pic || '-'}</dd>
    <dt>Alamat</dt><dd>${wisma.alamat || '-'}</dd>
    <dt>Tujuan</dt><dd>${kunjungan.tujuan || 'Pemeliharaan Rutin'}</dd>
    <dt>Prioritas</dt><dd>${kunjungan.prioritas || 'Normal'}</dd>
    <dt>Tgl Rencana</dt><dd>${App.fmt(kunjungan.tgl)}</dd>
    <dt>Tgl Realisasi</dt><dd>${kunjungan.real ? App.fmt(kunjungan.real) : '-'}</dd>
    <dt>Status</dt><dd id="status-badge-slot"></dd>
    <dt>Catatan</dt><dd>${kunjungan.catatan || '<i>Tidak ada catatan.</i>'}</dd>
  `;
  container.appendChild(dl);

  container.querySelector('#status-badge-slot')?.appendChild(App.buatBadgeElement(status));

  App.modal('Detail Kunjungan', container, null, { w: true });
};

App.act.delK = (tombol) => {
  const idKunjungan = tombol.dataset.id;
  const kunjungan = App.db.kunjungan.find(k => k.id === idKunjungan);
  if (!kunjungan) return;

  App.confirm(`Apakah Anda yakin ingin menghapus jadwal kunjungan ID <b>${kunjungan.id}</b>?`, () => {
    App.db.kunjungan = App.db.kunjungan.filter(k => k.id !== idKunjungan);
    App.G.k?.s?.sel?.delete(idKunjungan);
    App.log('Menghapus Kunjungan', `Kunjungan ID ${idKunjungan} dihapus`);
    App.save();
    App.toast('Jadwal kunjungan berhasil dihapus.', 'warning');
    App.refresh();
  });
};

App.act.delKBulk = () => {
  const selectedIds = Array.from(App.G.k.s.sel);
  if (!selectedIds.length) return;

  App.confirm(`Apakah Anda yakin ingin menghapus <b>${selectedIds.length} jadwal kunjungan</b> terpilih?`, () => {
    App.db.kunjungan = App.db.kunjungan.filter(k => !selectedIds.includes(k.id));
    App.G.k.s.sel.clear();
    App.log('Menghapus Kunjungan (Bulk)', `${selectedIds.length} kunjungan dihapus`);
    App.save();
    App.toast(`${selectedIds.length} jadwal kunjungan berhasil dihapus.`, 'warning');
    App.refresh();
  });
};

App.act.expK = () => {
  const baris = [['ID Kunjungan', 'Kode Wisma', 'Nama Wisma', 'PIC', 'Tgl Rencana', 'Tgl Realisasi', 'Status', 'Catatan']];
  App.db.kunjungan.forEach(k => {
    const wisma = App.db.wisma.find(w => w.kode === k.kode) || {};
    baris.push([
      k.id,
      k.kode,
      wisma.nama || '',
      wisma.pic || '',
      k.tgl,
      k.real || '',
      App.hitungStatus(k),
      k.catatan || ''
    ]);
  });
  App.csv('data-kunjungan.csv', baris);
};