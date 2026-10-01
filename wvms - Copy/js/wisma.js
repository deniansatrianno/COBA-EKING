'use strict';

// Koordinat wisma (opsional): kosong = tidak tampil di peta
App.cekKoordinat = d => {
  const a = String(d.lat ?? '').trim(), o = String(d.lng ?? '').trim();
  if (!a && !o) return null;
  if (a === '' || !(Math.abs(+a) <= 90)) return { lat: 'Isi angka antara -90 dan 90.' };
  if (o === '' || !(Math.abs(+o) <= 180)) return { lng: 'Isi angka antara -180 dan 180.' };
  return null;
};
App.bacaKoordinat = d => String(d.lat ?? '').trim() ? { lat: +d.lat, lng: +d.lng } : { lat: '', lng: '' };

// 1. View Utama Halaman Wisma
App.views.wisma = () => {
  const templateWisma = $('#tmpl-page-wisma');
  const frag = templateWisma ? templateWisma.content.cloneNode(true) : document.createDocumentFragment();

  // Inisialisasi State Grid Wisma
  App.G.w = App.G.w || {
    s: { q: '', f: {}, sk: 'nama', sd: 1, p: 1, n: App.db.cfg.rows, sel: new Set() }
  };

  // Buat Page Header
  const tombolTambah = document.createElement('button');
  tombolTambah.className = 'btn p';
  tombolTambah.dataset.act = 'addW';
  tombolTambah.textContent = '+ Tambah Wisma';

  const headerElem = App.buatPageHeader('Data Wisma', 'Kelola daftar wisma dan penanggung jawab (PIC)', tombolTambah);
  frag.querySelector('#wisma-header-slot')?.replaceWith(headerElem);

  return frag;
};

App.views.wisma.init = () => {
  App.updWisma();
  App.renderDenahWisma();
};

// 3. Render / Update Komponen Tabel & Pagination Wisma
App.updWisma = () => {
  const stateGrid = App.G.w?.s;
  if (!stateGrid) return;

  // Filter & Sort Data Wisma
  let dataWisma = App.db.wisma.map(item => ({
    ...item,
    kunjunganCount: App.db.kunjungan.filter(k => k.kode === item.kode).length
  }));

  if (stateGrid.q) {
    const kueri = stateGrid.q.toLowerCase();
    dataWisma = dataWisma.filter(w => (w.nama + w.kode + w.alamat + w.pic).toLowerCase().includes(kueri));
  }

  const fl = stateGrid.f || {};
  const jadwalAktif = w => App.db.kunjungan.some(k => k.kode === w.kode && !k.batal && !k.real);
  if (fl.pic) dataWisma = dataWisma.filter(w => w.pic === fl.pic);
  if (fl.status) dataWisma = dataWisma.filter(w => (w.status || 'Aktif') === fl.status);
  if (fl.jadwal) dataWisma = dataWisma.filter(w => (fl.jadwal === 'ada') === jadwalAktif(w));
  if (fl.dari || fl.sampai) {
    dataWisma = dataWisma.filter(w => App.db.kunjungan.some(k => k.kode === w.kode && !k.batal && (!fl.dari || k.tgl >= fl.dari) && (!fl.sampai || k.tgl <= fl.sampai)));
  }

  dataWisma.sort((a, b) => {
    if (typeof a[stateGrid.sk] === 'number' && typeof b[stateGrid.sk] === 'number') return (a[stateGrid.sk] - b[stateGrid.sk]) * stateGrid.sd;
    const nilaiA = String(a[stateGrid.sk] || '').toLowerCase();
    const nilaiB = String(b[stateGrid.sk] || '').toLowerCase();
    return nilaiA > nilaiB ? stateGrid.sd : (nilaiA < nilaiB ? -stateGrid.sd : 0);
  });

  // Tampilkan Aksi Massal (Bulk Action) jika ada item dicentang
  const bulkSlot = $('#wisma-bulk-slot');
  if (bulkSlot) {
    if (stateGrid.sel.size > 0) {
      bulkSlot.hidden = false;
      bulkSlot.className = 'bulk';
      bulkSlot.innerHTML = '';

      const span = document.createElement('span');
      span.textContent = `${stateGrid.sel.size} wisma dipilih`;

      const btnHapusMassal = document.createElement('button');
      btnHapusMassal.className = 'btn s d';
      btnHapusMassal.dataset.act = 'delWBulk';
      btnHapusMassal.textContent = 'Hapus Terpilih';

      const btnBatal = document.createElement('button');
      btnBatal.className = 'btn s';
      btnBatal.dataset.g = 'w';
      btnBatal.setAttribute('data-clr', '1');
      btnBatal.textContent = 'Batal';

      bulkSlot.appendChild(span);
      bulkSlot.appendChild(btnHapusMassal);
      bulkSlot.appendChild(btnBatal);
    } else {
      bulkSlot.hidden = true;
    }
  }

  // Hitung Halaman & Paginasi
  const totalBaris = dataWisma.length;
  const totalHalaman = Math.ceil(totalBaris / stateGrid.n) || 1;
  if (stateGrid.p > totalHalaman) stateGrid.p = totalHalaman;

  const awalBaris = (stateGrid.p - 1) * stateGrid.n;
  const barisHalamanIni = dataWisma.slice(awalBaris, awalBaris + stateGrid.n);

  const tbody = $('#wisma-table-body');
  if (tbody) {
    tbody.innerHTML = '';
    if (!barisHalamanIni.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6"><div class="empty">Tidak ada data wisma ditemukan.</div></td>';
      tbody.appendChild(tr);
    } else {
      barisHalamanIni.forEach(itemWisma => {
        const frag = App.cloneTemplate('tmpl-wisma-row');
        const checkbox = frag.querySelector('[data-element="checkbox"]');
        checkbox.dataset.g = 'w';
        checkbox.dataset.id = itemWisma.id;
        checkbox.checked = stateGrid.sel.has(itemWisma.id);

        frag.querySelector('[data-element="nama"]').textContent = itemWisma.nama;
        frag.querySelector('[data-element="alamat"]').textContent = itemWisma.alamat;
        frag.querySelector('[data-element="kode"]').textContent = itemWisma.kode;
        frag.querySelector('[data-element="pic"]').textContent = itemWisma.pic;
        frag.querySelector('[data-element="kunjungan-count"]').textContent = itemWisma.kunjunganCount;

        frag.querySelector('[data-element="btn-detail"]').dataset.id = itemWisma.id;
        frag.querySelector('[data-element="btn-edit"]').dataset.id = itemWisma.id;
        frag.querySelector('[data-element="btn-delete"]').dataset.id = itemWisma.id;

        tbody.appendChild(frag);
      });
    }
  }

  // Render Baris Paginasi
  const pgSlot = $('#wisma-pagination-slot');
  if (pgSlot) {
    pgSlot.innerHTML = '';

    const spanInfo = document.createElement('span');
    spanInfo.textContent = `Menampilkan ${totalBaris ? awalBaris + 1 : 0}-${Math.min(awalBaris + stateGrid.n, totalBaris)} dari ${totalBaris} wisma`;

    const spanGrow = document.createElement('span');
    spanGrow.className = 'grow';

    pgSlot.appendChild(spanInfo);
    pgSlot.appendChild(spanGrow);

    for (let i = 1; i <= totalHalaman; i++) {
      const btnHal = document.createElement('button');
      btnHal.className = 'btn s' + (i === stateGrid.p ? ' on' : '');
      btnHal.dataset.g = 'w';
      btnHal.dataset.p = i;
      btnHal.textContent = i;
      pgSlot.appendChild(btnHal);
    }
  }
};

// Registrasi Update Handler untuk Grid Wisma di App Core
App.upd = (namaGrup) => {
  if (namaGrup === 'w') {
      App.updWisma();
      App.renderDenahWisma();
  }
};

App.renderDenahWisma = () => {
  const container = $('#denah-wisma-container');
  if (!container) return;
  container.innerHTML = '';
  
  const tglHariIni = (typeof App.today === 'function') ? App.today() : (App.today || new Date().toISOString().slice(0, 10));

  App.db.wisma.forEach(w => {
      // Hitung total kunjungan
      const kunjungan = App.db.kunjungan.filter(k => k.kode === w.kode);
      const total = kunjungan.length;
      
      // Tentukan status
      let statusColor = '#2E7D32'; // Hijau (Normal)
      let statusText = 'Normal';
      
      const isAdaHariIni = kunjungan.some(k => k.tgl === tglHariIni);
      
      if (isAdaHariIni) {
          statusColor = '#1565C0'; // Biru (Ada Kunjungan Hari Ini)
          statusText = 'Kunjungan Hari Ini';
      } else if (total > 5) {
          statusColor = '#B7791F'; // Kuning (Padat Kunjungan)
          statusText = 'Padat Kunjungan';
      }
      
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cursor = 'pointer';
      card.style.borderLeftColor = statusColor;
      card.style.transition = 'transform 0.2s';
      card.dataset.act = 'detW';
      card.dataset.id = w.id;
      
      card.onmouseover = () => card.style.transform = 'scale(1.02)';
      card.onmouseout = () => card.style.transform = 'scale(1)';
      
      card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <small style="font-weight:bold; color: var(--mu);">${w.kode}</small>
              <span class="bdg" style="color: ${statusColor}; border-color: ${statusColor}; font-size: 10px;">${statusText}</span>
          </div>
          <b>${w.nama}</b>
          <div style="font-size: 12px; color: var(--mu); margin-top: 8px;">
              <div>PIC: ${w.pic || '-'}</div>
              <div>Total Kunjungan: ${total}</div>
          </div>
      `;
      
      container.appendChild(card);
  });
};

// 4. Aksi Modul Wisma (Aksi Tambah, Edit, Detail, Hapus, Impor, Ekspor)
App.act.addW = () => {
  const formContent = document.createElement('div');
  formContent.innerHTML =
    '<div class="g2">' +
    App.buatField('kode', 'Kode Wisma', 'WSM-' + String(App.db.wisma.length + 1).padStart(3, '0'), { req: true }) +
    App.buatField('nama', 'Nama Wisma', '', { req: true }) +
    App.buatField('pic', 'Penanggung Jawab (PIC)', '', { req: true }) +
    App.buatField('status', 'Status Operasional', 'Aktif', { req: true, opts: ['Aktif', 'Renovasi', 'Tutup Sementara'] }) +
    App.buatField('kapasitas', 'Kapasitas (Orang)', '', { type: 'number' }) +
    App.buatField('fasilitas', 'Fasilitas Utama', '', { placeholder: 'Cth: AC, WiFi, Parkir Luas' }) +
    App.buatField('lat', 'Latitude (opsional)', '', { placeholder: '-6.917464' }) +
    App.buatField('lng', 'Longitude (opsional)', '', { placeholder: '107.619123' }) +
    '</div>' +
    App.buatField('alamat', 'Alamat Lengkap', '', { req: true, area: true });

  App.modal('Tambah Wisma Baru', formContent, (dataForm) => {
    const errorList = App.req(dataForm, ['kode', 'nama', 'alamat', 'pic']);
    if (Object.keys(errorList).length) return errorList;
    const eKoord = App.cekKoordinat(dataForm); if (eKoord) return eKoord;

    if (App.db.wisma.some(w => w.kode.toLowerCase() === dataForm.kode.toLowerCase())) {
      return { kode: 'Kode wisma sudah digunakan.' };
    }

    const wismaBaru = {
      id: 'ID-' + String(Date.now()).slice(-4),
      kode: dataForm.kode.trim(),
      nama: dataForm.nama.trim(),
      alamat: dataForm.alamat.trim(),
      pic: dataForm.pic.trim(),
      status: dataForm.status || 'Aktif',
      kapasitas: dataForm.kapasitas || '0',
      fasilitas: dataForm.fasilitas || '-',
      ...App.bacaKoordinat(dataForm)
    };

    App.db.wisma.push(wismaBaru);
    App.log('Menambahkan Wisma', `${wismaBaru.kode} - ${wismaBaru.nama}`);
    App.save();
    App.toast('Wisma berhasil ditambahkan.', 'success');
    App.refresh();
  }, { ok: 'Simpan Wisma', w: true });
};

App.act.editW = (tombol) => {
  const idWisma = tombol.dataset.id;
  const wisma = App.db.wisma.find(w => w.id === idWisma);
  if (!wisma) return;

  const formContent = document.createElement('div');
  formContent.innerHTML =
    '<div class="g2">' +
    App.buatField('kode', 'Kode Wisma', wisma.kode, { req: true, ro: true }) +
    App.buatField('nama', 'Nama Wisma', wisma.nama, { req: true }) +
    App.buatField('pic', 'Penanggung Jawab (PIC)', wisma.pic, { req: true }) +
    App.buatField('status', 'Status Operasional', wisma.status || 'Aktif', { req: true, opts: ['Aktif', 'Renovasi', 'Tutup Sementara'] }) +
    App.buatField('kapasitas', 'Kapasitas (Orang)', wisma.kapasitas || '', { type: 'number' }) +
    App.buatField('fasilitas', 'Fasilitas Utama', wisma.fasilitas || '', { placeholder: 'Cth: AC, WiFi, Parkir Luas' }) +
    App.buatField('lat', 'Latitude (opsional)', wisma.lat ?? '') +
    App.buatField('lng', 'Longitude (opsional)', wisma.lng ?? '') +
    '</div>' +
    App.buatField('alamat', 'Alamat Lengkap', wisma.alamat, { req: true, area: true });

  App.modal('Edit Data Wisma', formContent, (dataForm) => {
    const errorList = App.req(dataForm, ['nama', 'alamat', 'pic']);
    if (Object.keys(errorList).length) return errorList;
    const eKoord = App.cekKoordinat(dataForm); if (eKoord) return eKoord;

    wisma.nama = dataForm.nama.trim();
    wisma.alamat = dataForm.alamat.trim();
    wisma.pic = dataForm.pic.trim();
    wisma.status = dataForm.status || 'Aktif';
    wisma.kapasitas = dataForm.kapasitas || '0';
    wisma.fasilitas = dataForm.fasilitas || '-';
    Object.assign(wisma, App.bacaKoordinat(dataForm));

    App.log('Mengubah Wisma', `${wisma.kode} - ${wisma.nama}`);
    App.save();
    App.toast('Data wisma berhasil diperbarui.', 'success');
    App.refresh();
  }, { ok: 'Simpan Perubahan', w: true });
};

App.act.detW = (tombol) => {
  const idWisma = tombol.dataset.id;
  const wisma = App.db.wisma.find(w => w.id === idWisma);
  if (!wisma) return;

  const daftarKunjungan = App.db.kunjungan.filter(k => k.kode === wisma.kode);

  const container = document.createElement('div');

  const dl = document.createElement('dl');
  dl.className = 'dl';
  dl.innerHTML = `
    <dt>Kode Wisma</dt><dd><b>${wisma.kode}</b></dd>
    <dt>Nama Wisma</dt><dd>${wisma.nama}</dd>
    <dt>Status</dt><dd>${wisma.status || 'Aktif'}</dd>
    <dt>Kapasitas</dt><dd>${wisma.kapasitas || '-'} Orang</dd>
    <dt>Fasilitas</dt><dd>${wisma.fasilitas || '-'}</dd>
    <dt>PIC</dt><dd>${wisma.pic}</dd>
    <dt>Alamat</dt><dd>${wisma.alamat}</dd>
    <dt>Total Kunjungan</dt><dd>${daftarKunjungan.length} kali</dd>
  `;
  container.appendChild(dl);

  const titleHistori = document.createElement('h3');
  titleHistori.className = 'title-sub-section';
  titleHistori.textContent = 'Riwayat Kunjungan';
  container.appendChild(titleHistori);

  if (!daftarKunjungan.length) {
    const divEmpty = document.createElement('div');
    divEmpty.className = 'empty';
    divEmpty.textContent = 'Belum ada riwayat kunjungan.';
    container.appendChild(divEmpty);
  } else {
    const tw = document.createElement('div');
    tw.className = 'tw';

    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>ID</th>
          <th>Tanggal Rencana</th>
          <th>Tanggal Realisasi</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    daftarKunjungan.forEach(k => {
      const tr = document.createElement('tr');

      const tdId = document.createElement('td');
      tdId.textContent = k.id;

      const tdTgl = document.createElement('td');
      tdTgl.textContent = App.fmt(k.tgl);

      const tdReal = document.createElement('td');
      tdReal.textContent = App.fmt(k.real);

      const tdStatus = document.createElement('td');
      tdStatus.appendChild(App.buatBadgeElement(App.hitungStatus(k)));

      tr.appendChild(tdId);
      tr.appendChild(tdTgl);
      tr.appendChild(tdReal);
      tr.appendChild(tdStatus);
      tbody.appendChild(tr);
    });

    tw.appendChild(table);
    container.appendChild(tw);
  }

  App.modal('Detail Wisma - ' + wisma.nama, container, null, { w: true });
};

// html/js/wisma.js (Ganti bagian App.act.delW & App.act.delWBulk)

App.act.delW = (tombol) => {
  const idWisma = tombol.dataset.id;
  const wisma = App.db.wisma.find(w => w.id === idWisma);
  if (!wisma) return;

  // 1. Cek apakah wisma masih dipakai di Modul Kunjungan (Cascade Check)
  const kunjunganTerkait = App.db.kunjungan.filter(k => k.kode === wisma.kode);

  let pesanPeringatan = `Apakah Anda yakin ingin menghapus wisma <b>${wisma.nama}</b> (${wisma.kode})?`;

  if (kunjunganTerkait.length > 0) {
    pesanPeringatan += `<br><br><span style="color: var(--danger, #ef4444);"><b>Peringatan:</b> Wisma ini memiliki <b>${kunjunganTerkait.length} jadwal kunjungan</b>. Semua data kunjungan terkait juga akan ikut terhapus!</span>`;
  }

  App.confirm(pesanPeringatan, () => {
    // 2. Cascade Delete: Hapus wisma & hapus semua kunjungan dengan kode wisma ini
    App.db.wisma = App.db.wisma.filter(w => w.id !== idWisma);
    App.db.kunjungan = App.db.kunjungan.filter(k => k.kode !== wisma.kode);

    App.G.w?.s?.sel?.delete(idWisma);
    App.log('Menghapus Wisma', `${wisma.kode} - ${wisma.nama} (beserta ${kunjunganTerkait.length} kunjungan)`);
    App.save();
    App.toast('Wisma dan data terkait berhasil dihapus.', 'warning');
    App.refresh();
  });
};

App.act.delWBulk = () => {
  const selectedIds = Array.from(App.G.w.s.sel);
  if (!selectedIds.length) return;

  const wismaDiperoleh = App.db.wisma.filter(w => selectedIds.includes(w.id));
  const kodeWismaTerpilih = wismaDiperoleh.map(w => w.kode);

  // Cek total kunjungan yang akan berdampak
  const kunjunganTerimbas = App.db.kunjungan.filter(k => kodeWismaTerpilih.includes(k.kode));

  let pesanPeringatan = `Apakah Anda yakin ingin menghapus <b>${selectedIds.length} wisma</b> terpilih?`;
  if (kunjunganTerimbas.length > 0) {
    pesanPeringatan += `<br><br><span style="color: var(--danger, #ef4444);"><b>Peringatan:</b> Terdapat <b>${kunjunganTerimbas.length} jadwal kunjungan</b> yang terhubung dengan wisma terpilih dan akan ikut terhapus!</span>`;
  }

  App.confirm(pesanPeringatan, () => {
    // Cascade Delete untuk Bulk
    App.db.wisma = App.db.wisma.filter(w => !selectedIds.includes(w.id));
    App.db.kunjungan = App.db.kunjungan.filter(k => !kodeWismaTerpilih.includes(k.kode));

    App.G.w.s.sel.clear();
    App.log('Menghapus Wisma (Bulk)', `${selectedIds.length} wisma dihapus`);
    App.save();
    App.toast(`${selectedIds.length} wisma berhasil dihapus.`, 'warning');
    App.refresh();
  });
};

// Catatan: App.act.delWBulk sudah didefinisikan di atas dengan cascade delete yang benar.

App.act.expW = () => {
  const baris = [['ID', 'Kode', 'Nama Wisma', 'Alamat', 'PIC']];
  App.db.wisma.forEach(w => baris.push([w.id, w.kode, w.nama, w.alamat, w.pic]));
  App.csv('data-wisma.csv', baris);
};

App.act.impW = () => {
  const formContent = document.createElement('div');
  const label = document.createElement('label');
  label.className = 'fl';

  const span = document.createElement('span');
  span.textContent = 'Pilih File CSV (Format: Kode, Nama Wisma, Alamat, PIC)';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.name = 'csvfile';

  label.appendChild(span);
  label.appendChild(input);
  formContent.appendChild(label);

  App.modal('Impor Data Wisma dari CSV', formContent, () => {
    const file = input.files[0];
    if (!file) {
      App.toast('Silakan pilih file CSV terlebih dahulu.', 'error');
      return false;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataBaris = App.parseCsv(e.target.result);
      let count = 0;

      dataBaris.forEach((kolom, index) => {
        if (index === 0 && kolom[0].toLowerCase().includes('id') || kolom[0].toLowerCase().includes('kode')) return;
        if (kolom.length >= 3) {
          const kode = (kolom[0] || '').trim();
          const nama = (kolom[1] || '').trim();
          const alamat = (kolom[2] || '').trim();
          const pic = (kolom[3] || '').trim() || 'PIC Default';

          if (kode && nama && !App.db.wisma.some(w => w.kode.toLowerCase() === kode.toLowerCase())) {
            App.db.wisma.push({
              id: 'ID-' + String(Date.now() + index).slice(-4),
              kode,
              nama,
              alamat,
              pic
            });
            count++;
          }
        }
      });

      App.log('Impor Wisma', `Mengimpor ${count} wisma baru`);
      App.save();
      App.toast(`Berhasil mengimpor ${count} data wisma.`);
      App.refresh();
    };
    reader.readAsText(file);
  }, { ok: 'Proses Impor' });
};