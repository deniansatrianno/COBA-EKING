'use strict';

// Helper pencarian elemen DOM
const $ = (selector, root = document) => root.querySelector(selector); const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Format tanggal ISO ke YYYY-MM-DD
const dapatkanIsoTanggal = tanggal => new Date(tanggal.getTime() - tanggal.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// Objek Utama Aplikasi
const App = {
  views: {},
  act: {},
  G: {},
  today: dapatkanIsoTanggal(new Date())
};

// Hitung selisih hari
App.hitungSelisihHari = jumlahHari => {
  const d = new Date();
  d.setDate(d.getDate() + jumlahHari);
  return dapatkanIsoTanggal(d);
};

// Inisialisasi Data Demo
App.seed = () => {
  const daftarWismaData = [
    ['Pahlawan', 'Jl. Pahlawan No. 12, Cicaheum, Bandung', 'Hendra Wijaya'],
    ['Cikutra', 'Jl. Cikutra No. 88, Bandung', 'Ratna Dewi'],
    ['Dago', 'Jl. Ir. H. Juanda No. 141, Bandung', 'Asep Gunawan'],
    ['Pasteur', 'Jl. Dr. Djundjunan No. 45, Bandung', 'Budi Santoso'],
    ['Buah Batu', 'Jl. Buah Batu No. 210, Bandung', 'Siti Nurhaliza'],
    ['Lembang', 'Jl. Raya Lembang No. 33, Bandung Barat', 'Tri Haryanto'],
    ['Cimahi', 'Jl. Amir Machmud No. 71, Cimahi', 'Dedi Rohimat'],
    ['Sumedang', 'Jl. Prabu Geusan Ulun No. 9, Sumedang', 'Fahmi Lubis'],
    ['Garut', 'Jl. Ahmad Yani No. 24, Garut', 'Ratna Dewi'],
    ['Setiabudi', 'Jl. Setiabudi No. 150, Bandung', 'Hendra Wijaya']
  ];

  const wisma = daftarWismaData.map((item, index) => ({
    id: 'ID-' + String(index + 1).padStart(3, '0'),
    kode: 'WSM-' + String(index + 1).padStart(3, '0'),
    nama: 'Wisma ' + item[0],
    alamat: item[1],
    pic: item[2]
  }));

  const variasiKunjungan = [
    [0, -40, -40], [1, -33, -32], [2, -25, -25], [3, -20, -19], [4, -14, -14],
    [5, -9, -8], [6, -7, 0], [7, -4, 0], [8, -2, 0], [9, 0, 0],
    [0, 0, 0], [1, 3, 0], [2, 6, 0], [3, 9, 0], [4, 14, 0],
    [5, 21, 0], [6, -12, 'X'], [7, 28, 0]
  ];

  const catatanList = [
    'Audit K3 dan pemeliharaan genset',
    'Inspeksi kamar dan fasilitas',
    'Penggantian filter AC',
    'Pengecekan APAR',
    'Serah terima kunci',
    'Audit kebersihan dan sanitasi'
  ];

  const kunjungan = variasiKunjungan.map((item, index) => ({
    id: 'VIS-' + String(index + 1).padStart(3, '0'),
    tgl: App.hitungSelisihHari(item[1]),
    real: item[2] === 0 || item[2] === 'X' ? '' : App.hitungSelisihHari(item[2]),
    kode: wisma[item[0]].kode,
    catatan: catatanList[index % 6],
    batal: item[2] === 'X'
  }));

  return {
    wisma,
    kunjungan,
    users: [
      { id: 'USR-001', nama: 'Bambang Soediro', email: 'bambang@perusahaan.co.id', role: 'Admin', status: 'Aktif', login: 'Hari ini 08:12' },
      { id: 'USR-002', nama: 'Siti Nurhaliza', email: 'siti@perusahaan.co.id', role: 'Staff', status: 'Aktif', login: 'Kemarin 16:40' },
      { id: 'USR-003', nama: 'Agus Setiawan', email: 'agus@perusahaan.co.id', role: 'Viewer', status: 'Aktif', login: '3 hari lalu' }
    ],
    log: [
      { t: Date.now() - 3600000, u: 'Siti Nurhaliza', a: 'Menyelesaikan kunjungan', d: 'VIS-006 Wisma Lembang' },
      { t: Date.now() - 7200000, u: 'Bambang Soediro', a: 'Menambahkan Wisma', d: 'WSM-010 Wisma Setiabudi' }
    ],
    read: [],
    cfg: {
      company: 'Dapensi Trio Usaha',
      alamat: 'Jl. Asia Afrika No. 100, Bandung',
      email: 'info@nusantara.co.id',
      telp: '022-4231000',
      logo: '',
      theme: 'light',
      rows: 10,
      datefmt: 'id',
      remind: true,
      over: true,
      me: { nama: 'Bambang Soediro', email: 'bambang@perusahaan.co.id', role: 'Admin' }
    }
  };
};

// ===== Persistensi: semua data aplikasi ada di MySQL lewat backend PHP =====
// Browser TIDAK menyimpan data aplikasi. localStorage hanya untuk preferensi tampilan (tema/palet).
App.API = 'backend/index.php';
App.db = { wisma: [], kunjungan: [], tiket: [], users: [], log: [], read: [], cfg: { me: {} } };
App._base = null;                    // salinan data terakhir yang sudah dikonfirmasi MySQL
App._saveQueue = Promise.resolve();  // semua penyimpanan berjalan berurutan (tanpa race condition)

const appClone = value => JSON.parse(JSON.stringify(value));
const appSama = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const appKunciLog = e => [e.t, e.a, e.d].join('|');
const appBase = db => appClone({
  wisma: db.wisma, kunjungan: db.kunjungan, tiket: db.tiket, log: db.log, read: db.read,
  cfg: Object.fromEntries(Object.entries(db.cfg || {}).filter(([k]) => k !== 'me'))
});

// Pemanggil API tunggal: selalu JSON, galat jaringan/server jadi pesan yang jelas.
App.api = async (action, { method = 'GET', body } = {}) => {
  let res;
  try {
    res = await fetch(`${App.API}?action=${encodeURIComponent(action)}`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: { 'Accept': 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (_) {
    throw new Error('Tidak dapat terhubung ke server. Pastikan Apache dan MySQL di XAMPP sudah menyala.');
  }
  let json = null;
  try { json = await res.json(); } catch (_) { /* respons bukan JSON */ }
  if (res.status === 401) {
    location.replace('login.html?expired=1');
    throw new Error('Sesi login tidak ditemukan.');
  }
  if (!res.ok || !json || json.status !== 'success') {
    const err = new Error((json && json.message) || `Server tidak merespons dengan benar (HTTP ${res.status}). Periksa folder backend dan log error Apache/PHP.`);
    err.status = res.status;
    throw err;
  }
  return json;
};

// Terapkan preferensi tampilan dari konfigurasi MySQL (localStorage hanya cache agar tidak berkedip).
App.terapkanPreferensi = () => {
  const c = App.db.cfg || {};
  document.documentElement.dataset.t = c.theme || 'light';
  document.documentElement.dataset.p = c.palet || 'teal';
  try { localStorage.setItem('wvms.tema', c.theme || 'light'); localStorage.setItem('wvms.palet', c.palet || 'teal'); } catch (_) { /* abaikan */ }
};

App.loadFromServer = async () => {
  const json = await App.api('state');
  const data = json.data;
  if (!data || !Array.isArray(data.wisma) || !Array.isArray(data.kunjungan)) {
    throw new Error('Format data dari server tidak valid.');
  }
  data.tiket ||= []; data.users ||= []; data.log ||= []; data.read ||= []; data.cfg ||= {};
  // Nilai bawaan konfigurasi hanya untuk tampilan; baru tersimpan ke MySQL bila pengguna mengubahnya.
  const bawaan = App.seed().cfg;
  data.cfg = { ...bawaan, ...data.cfg, me: { nama: json.user.nama, email: json.user.email, role: json.user.role } };
  App.db = data;
  App._base = appBase(App.db);
  App.terapkanPreferensi();
  return App.db;
};

// Hitung selisih antara data terakhir di MySQL dan data sekarang -> operasi per baris.
App.hitungOps = (base, cur) => {
  const ops = {};
  for (const ent of ['wisma', 'kunjungan', 'tiket']) {
    const b = new Map((base[ent] || []).map(x => [String(x.id), x]));
    const c = new Map((cur[ent] || []).map(x => [String(x.id), x]));
    const create = [], update = [], del = [];
    c.forEach((v, id) => { if (!b.has(id)) create.push(v); else if (!appSama(b.get(id), v)) update.push(v); });
    b.forEach((v, id) => { if (!c.has(id)) del.push(id); });
    if (create.length || update.length || del.length) ops[ent] = { create, update, delete: del };
  }
  const bc = base.cfg || {}, cc = cur.cfg || {}, set = {}, unset = [];
  Object.keys(cc).forEach(k => { if (k !== 'me' && !appSama(bc[k], cc[k])) set[k] = cc[k]; });
  Object.keys(bc).forEach(k => { if (k !== 'me' && !(k in cc)) unset.push(k); });
  if (Object.keys(set).length || unset.length) ops.cfg = { set, unset };
  const known = new Set((base.log || []).map(appKunciLog));
  const baru = (cur.log || []).filter(e => !known.has(appKunciLog(e)));
  if (baru.length) ops.log = baru.slice(0, 50);
  if (!appSama(base.read || [], cur.read || [])) ops.read = cur.read || [];
  return ops;
};

// Simpan ke MySQL. Mengembalikan Promise<boolean>. Satu-satunya implementasi App.save di aplikasi.
App.save = () => {
  App._saveQueue = App._saveQueue.then(async () => {
    if (!App._base) return false;                       // data belum dimuat dari server
    const snap = appClone(App.db);
    const ops = App.hitungOps(App._base, snap);
    if (!Object.keys(ops).length) return true;          // tidak ada perubahan
    try {
      await App.api('sync', { method: 'POST', body: { ops } });
      App._base = appBase(snap);
      return true;
    } catch (error) {
      console.error('WVMS: gagal menyimpan ke MySQL:', error);
      App._lastSaveError = error;
      if (typeof App.toast === 'function') App.toast('Data belum tersimpan: ' + error.message, 'error');
      // Samakan tampilan dengan isi MySQL agar tidak ada data yang hanya "terlihat" di browser.
      if (error.status !== 401) {
        try { await App.loadFromServer(); if (typeof App.refresh === 'function') App.refresh(); } catch (e2) { console.error(e2); }
      }
      return false;
    }
  });
  return App._saveQueue;
};

// Logout: akhiri session PHP di server, baru pindah ke halaman login.
App.logout = async () => {
  try {
    await fetch(`${App.API}?action=logout`, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
  } catch (_) { /* tetap lanjut ke halaman login */ }
  try { localStorage.removeItem('wvms.sesi'); sessionStorage.removeItem('wvms.sesi'); } catch (_) { /* abaikan */ }
  location.href = 'login.html?keluar=1';
};

// Tambah log aktivitas
App.log = (aktivitas, detail) => {
  App.db.log.unshift({ t: Date.now(), u: App.db.cfg.me.nama, a: aktivitas, d: detail });
  App.db.log = App.db.log.slice(0, 100);
  App.save();
};

// Ambil data wisma berdasarkan kode.
// Jika wisma sudah dihapus, kembalikan objek placeholder yang aman
// sehingga tidak ada "[object Object]" atau undefined di tampilan.
App.W = kodeWisma => {
  const wisma = App.db.wisma.find(w => w.kode == kodeWisma);
  if (wisma) return wisma;
  // Kode rusak = data lama hasil bug form ("[object Object]"), bukan wisma yang dihapus
  const rusak = typeof kodeWisma !== 'string' || kodeWisma === '[object Object]';
  // Placeholder rapi untuk wisma yang sudah dihapus / kodenya rusak
  return {
    nama   : rusak ? '⚠ Kode Wisma Rusak (klik Edit untuk perbaiki)' : '⚠ Wisma Telah Dihapus',
    _rusak : rusak,
    alamat : '-',
    pic    : '-',
    kode   : kodeWisma,
    id     : '',
    _hapus : true   // flag penanda agar bisa diberi style khusus
  };
};

// Format Tanggal
App.fmt = tanggalStr => {
  if (!tanggalStr) return '-';
  if (App.db.cfg.datefmt == 'iso') return tanggalStr;
  return new Date(tanggalStr + 'T00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Hitung Status Kunjungan
App.hitungStatus = kunjunganItem => {
  if (kunjunganItem.batal) return 'Cancelled';
  if (kunjunganItem.real) return 'Completed';
  if (kunjunganItem.tgl < App.today) return 'Overdue';
  if (kunjunganItem.tgl == App.today) return 'Today';
  return 'Scheduled';
};

// Helper Clone Template HTML
App.cloneTemplate = idTemplate => {
  const template = $('#' + idTemplate);
  if (!template) return document.createElement('div');
  return template.content.cloneNode(true);
};

// Buat Element Badge Status Menggunakan Template
App.buatBadgeElement = statusTeks => {
  const fragment = App.cloneTemplate('tmpl-badge');
  const badgeElement = fragment.querySelector('[data-element="badge"]');
  badgeElement.textContent = statusTeks;
  badgeElement.classList.add('b-' + statusTeks);
  return badgeElement;
};

// Waktu Relatif
App.waktuLalu = timestamp => {
  const menit = Math.round((Date.now() - timestamp) / 60000);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return menit + ' mnt lalu';
  if (menit < 1440) return Math.round(menit / 60) + ' jam lalu';
  return Math.round(menit / 1440) + ' hari lalu';
};

// Generate ID Kunjungan Berikutnya
App.nextVid = () => 'VIS-' + String(Math.max(0, ...App.db.kunjungan.map(v => +v.id.replace(/\D/g, ''))) + 1).padStart(3, '0');

// Notifikasi Toast
App.toast = (pesan, tipe = 'success') => {
  const elemenToast = document.createElement('div');
  elemenToast.className = tipe;
  elemenToast.textContent = pesan;
  $('#toast').append(elemenToast);
  setTimeout(() => elemenToast.remove(), 3000);
};

// Modal System (DOM Manipulation)
App.modal = (judul, isiNode, fungsiAksiOk, opsi = {}) => {
  const modalWadah = $('#modal');
  modalWadah.hidden = false;
  modalWadah._prev = document.activeElement;
  modalWadah.innerHTML = '';

  const formModal = document.createElement('form');
  formModal.className = 'mb' + (opsi.w ? ' w' : '');
  formModal.setAttribute('role', 'dialog');
  formModal.setAttribute('aria-modal', 'true');
  formModal.setAttribute('aria-label', judul);
  formModal.noValidate = true;

  const h2 = document.createElement('h2');
  h2.textContent = judul;

  const kontenModal = document.createElement('div');
  kontenModal.className = 'mc';
  if (typeof isiNode === 'string') {
    kontenModal.innerHTML = isiNode;
  } else if (isiNode instanceof Node) {
    kontenModal.appendChild(isiNode);
  }

  const footerModal = document.createElement('div');
  footerModal.className = 'mf';

  const tombolBatal = document.createElement('button');
  tombolBatal.type = 'button';
  tombolBatal.className = 'btn';
  tombolBatal.dataset.act = 'close';
  tombolBatal.textContent = fungsiAksiOk ? 'Batal' : 'Tutup';

  footerModal.appendChild(tombolBatal);

  if (fungsiAksiOk) {
    const tombolOk = document.createElement('button');
    tombolOk.className = 'btn p' + (opsi.danger ? ' d' : '');
    tombolOk.textContent = opsi.ok || 'Simpan';
    footerModal.appendChild(tombolOk);
  }

  formModal.appendChild(h2);
  formModal.appendChild(kontenModal);
  formModal.appendChild(footerModal);
  modalWadah.appendChild(formModal);

  (formModal.querySelector('input:not([readonly]), select, .btn'))?.focus();

  formModal.onsubmit = event => {
    event.preventDefault();
    if (!fungsiAksiOk) return App.close();

    $$('.fe', modalWadah).forEach(x => x.textContent = ''); $$
      ('[aria-invalid]', modalWadah).forEach(x => x.removeAttribute('aria-invalid'));

    const formDataObject = Object.fromEntries(new FormData(event.target));
    const hasilValidasi = fungsiAksiOk(formDataObject);

    if (hasilValidasi && typeof hasilValidasi === 'object') {
      for (const key in hasilValidasi) {
        const inputElement = modalWadah.querySelector(`[name="${key}"]`);
        if (inputElement) {
          inputElement.setAttribute('aria-invalid', 'true');
          const errorParen = inputElement.parentElement.querySelector('.fe');
          if (errorParen) errorParen.textContent = hasilValidasi[key];
        }
      }
      modalWadah.querySelector('[aria-invalid]')?.focus();
    } else if (hasilValidasi !== false) {
      App.close();
    }
  };
};

App.close = () => {
  const modalWadah = $('#modal');
  modalWadah.hidden = true;
  modalWadah.innerHTML = '';
  modalWadah._prev?.focus?.();
};

App.confirm = (pesan, callbackSetuju) => {
  const modal = $('#confirm-modal') || $('#modal'); // sesuaikan ID modal kamu
  const modalContent = $('#confirm-modal-body'); // elemen pesan
  const btnHapus = $('#btn-modal-confirm');
  const btnBatal = $('#btn-modal-cancel');
  const btnClose = $('#btn-modal-close');

  if (modalContent) modalContent.innerHTML = pesan;

  // Tampilkan Modal
  if (modal) modal.hidden = false;

  // Event Tombol Hapus (Setuju)
  if (btnHapus) {
    btnHapus.onclick = () => {
      if (modal) modal.hidden = true; // TOGGLE CLOSE MODAL DI SINI
      if (typeof callbackSetuju === 'function') callbackSetuju();
    };
  }

  // Event Tombol Batal & Tombol X (Close)
  const tutupModal = () => { if (modal) modal.hidden = true; };
  if (btnBatal) btnBatal.onclick = tutupModal;
  if (btnClose) btnClose.onclick = tutupModal;
};

// Buat Field Form Dinamis
App.buatField = (namaInput, labelInput, nilaiAwal = '', opsi = {}) => {
  const wrapper = document.createElement('label');
  wrapper.className = 'fl';

  const spanLabel = document.createElement('span');
  spanLabel.textContent = labelInput + (opsi.req ? ' *' : '');
  wrapper.appendChild(spanLabel);

  if (opsi.opts) {
    const select = document.createElement('select');
    select.name = namaInput;
    if (opsi.ro) select.disabled = true;
    opsi.opts.forEach(optItem => {
      const [val, txt] = Array.isArray(optItem) ? optItem : [optItem, optItem];
      const option = document.createElement('option');
      option.value = val;
      option.textContent = txt;
      if (val == nilaiAwal) option.selected = true;
      select.appendChild(option);
    });
    wrapper.appendChild(select);
  } else if (opsi.area) {
    const textarea = document.createElement('textarea');
    textarea.name = namaInput;
    textarea.value = nilaiAwal;
    wrapper.appendChild(textarea);
  } else {
    const input = document.createElement('input');
    input.name = namaInput;
    input.type = opsi.type || 'text';
    input.value = nilaiAwal;
    if (opsi.ro) input.readOnly = true;
    if (opsi.id) input.id = opsi.id;
    wrapper.appendChild(input);
  }

  const spanError = document.createElement('span');
  spanError.className = 'fe';
  spanError.setAttribute('role', 'alert');
  wrapper.appendChild(spanError);

  return wrapper.outerHTML;
};

App.req = (dataForm, namaFieldWajib) => {
  const errorList = {};
  namaFieldWajib.forEach(nama => {
    if (!String(dataForm[nama] || '').trim()) errorList[nama] = 'Wajib diisi.';
  });
  return errorList;
};

// Export File (CSV & XLS)
App.csv = (namaFile, arrayBaris) => {
  const isiTeks = arrayBaris.map(baris => baris.map(kolom => `"${String(kolom ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  App.downloadFile(namaFile, '\ufeff' + isiTeks, 'text/csv');
};

App.xls = (namaFile, arrayBaris) => {
  const htmlContent = '<html><meta charset="utf-8"><table border="1">' +
    arrayBaris.map(r => '<tr>' + r.map(c => `<td>${String(c ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('') + '</tr>').join('') +
    '</table></html>';
  App.downloadFile(namaFile, htmlContent, 'application/vnd.ms-excel');
};

App.downloadFile = (namaFile, konten, mimeType) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([konten], { type: mimeType }));
  link.download = namaFile;
  link.click();
  App.toast('File ' + namaFile + ' diunduh.', 'info');
};

App.parseCsv = teks => {
  const baris = [];
  let itemBaris = [], sel = '', dalamKutip = false;
  for (let i = 0; i < teks.length; i++) {
    const karakter = teks[i];
    if (dalamKutip) {
      if (karakter == '"' && teks[i + 1] == '"') {
        sel += '"';
        i++;
      } else if (karakter == '"') {
        dalamKutip = false;
      } else {
        sel += karakter;
      }
    } else if (karakter == '"') {
      dalamKutip = true;
    } else if (karakter == ',' || karakter == ';') {
      itemBaris.push(sel);
      sel = '';
    } else if (karakter == '\n' || karakter == '\r') {
      if (karakter == '\r' && teks[i + 1] == '\n') i++;
      itemBaris.push(sel);
      sel = '';
      if (itemBaris.some(x => x.trim())) baris.push(itemBaris);
      itemBaris = [];
    } else {
      sel += karakter;
    }
  }
  itemBaris.push(sel);
  if (itemBaris.some(x => x.trim())) baris.push(itemBaris);
  return baris;
};

// Ambil Daftar Notifikasi
App.notifs = () => {
  const daftarNotif = [];
  App.db.kunjungan.forEach(kunjunganItem => {
    const status = App.hitungStatus(kunjunganItem);
    const namaWisma = App.W(kunjunganItem.kode).nama;
    if (status == 'Today' && App.db.cfg.remind) {
      daftarNotif.push({ id: 't' + kunjunganItem.id + App.today, t: `Kunjungan hari ini: ${namaWisma} (${kunjunganItem.id})` });
    }
    if (status == 'Overdue' && App.db.cfg.over) {
      daftarNotif.push({ id: 'o' + kunjunganItem.id, t: `Kunjungan terlambat: ${namaWisma} (${kunjunganItem.id})` });
    }
  });

  App.db.log.slice(0, 3).forEach(logItem => {
    daftarNotif.push({ id: 'l' + logItem.t, t: `${logItem.a}: ${logItem.d}` });
  });

  return daftarNotif;
};

// Update Tampilan Header Utama & Navigasi
App.chrome = kunciHalamanAktif => {
  const cfg = App.db.cfg;
  document.documentElement.dataset.t = cfg.theme;
  $('#coName').textContent = cfg.company;

  const logoWadah = $('#logo');
  logoWadah.innerHTML = '';
  if (cfg.logo) {
    const img = document.createElement('img');
    img.src = cfg.logo;
    img.alt = 'Logo';
    logoWadah.appendChild(img);
  } else {
    logoWadah.textContent = cfg.company.replace(/^PT\s+/i, '')[0] || 'W';
  }

  $('#uName').textContent = cfg.me.nama;
  $('#uRole').textContent = cfg.me.role;
  $('#uav').textContent = cfg.me.nama.split(' ').map(w => w[0]).slice(0, 2).join('');

  const menuNavigasi = [
    ['dashboard', 'Dashboard'],
    ['wisma', 'Wisma'],
    ['kunjungan', 'Kunjungan'],
    ['laporan', 'Laporan']
  ];

  const wrapNav = $('#nav .wrap');
  wrapNav.innerHTML = '';
  menuNavigasi.forEach(item => {
    const a = document.createElement('a');
    a.href = '#' + item[0];
    a.textContent = item[1];
    if (item[0] == kunciHalamanAktif) {
      a.className = 'on';
      a.setAttribute('aria-current', 'page');
    }
    wrapNav.appendChild(a);
  });

  const belumDibaca = App.notifs().filter(n => !cfg.read?.includes?.(n.id) && !App.db.read.includes(n.id)).length;
  const lencanaNotif = $('#bellN');
  lencanaNotif.textContent = belumDibaca;
  lencanaNotif.hidden = !belumDibaca;
};

// Generasi Header Halaman (Breadcrumb & Title) menggunakan DOM Manipulation & Template
App.buatPageHeader = (judul, subJudul, tombolNodeList = null, breadcrumbText = '') => {
  const fragment = App.cloneTemplate('tmpl-page-header');
  fragment.querySelector('[data-element="crumb"]').textContent = breadcrumbText || ('Beranda / ' + judul);
  fragment.querySelector('[data-element="title"]').textContent = judul;
  fragment.querySelector('[data-element="subtitle"]').textContent = subJudul;

  const wadahTombol = fragment.querySelector('[data-element="actions"]');
  if (tombolNodeList) {
    if (typeof tombolNodeList === 'string') {
      wadahTombol.innerHTML = tombolNodeList;
    } else if (Array.isArray(tombolNodeList)) {
      tombolNodeList.forEach(btn => wadahTombol.appendChild(btn));
    } else if (tombolNodeList instanceof Node) {
      wadahTombol.appendChild(tombolNodeList);
    }
  }

  return fragment;
};

// Router Utama Aplikasi
App.render = () => {
  const [r, a] = (location.hash.slice(1) || 'dashboard').split('/');
  const kunciHalaman = App.views[r] ? r : 'dashboard';
  Object.keys(App.G).forEach(g => delete App.G[g]);

  const wadahKonten = $('#content');
  wadahKonten.innerHTML = '';

  const hasilView = App.views[kunciHalaman](a);
  if (typeof hasilView === 'string') {
    wadahKonten.innerHTML = hasilView;
  } else if (hasilView instanceof Node) {
    wadahKonten.appendChild(hasilView);
  }

  App.views[kunciHalaman].init?.(a);
  App.chrome(kunciHalaman);
  App.rerender = () => App.render();
};

App.refresh = () => {
  const posisiScrollY = scrollY;
  const stateGridTersimpan = {};
  Object.keys(App.G).forEach(g => stateGridTersimpan[g] = App.G[g].s);

  App.render();

  Object.keys(stateGridTersimpan).forEach(g => {
    if (App.G[g]) Object.assign(App.G[g].s, { ...stateGridTersimpan[g] });
  });

  Object.keys(App.G).forEach(g => {
    const s2 = App.G[g].s;
    const inputCari = $(`[data-g="${g}"][data-q]`);
    if (inputCari) inputCari.value = s2.q;

    $$(`[data-g="${g}"][data-f]`).forEach(elemen => elemen.value = s2.f[elemen.dataset.f] || '');
    if (typeof App.upd === 'function') App.upd(g);
  });

  scrollTo(0, posisiScrollY);
};

// Pencarian Global
App.gsearch = kueri => {
  const wadahHasil = $('#gres');
  const teks = kueri.toLowerCase().trim();
  if (!teks) {
    wadahHasil.hidden = true;
    return;
  }

  const wismaMatch = App.db.wisma.filter(x => (x.id + x.kode + x.nama + x.alamat + x.pic).toLowerCase().includes(teks)).slice(0, 5);
  const kunjunganMatch = App.db.kunjungan.filter(x => (x.id + x.kode + App.W(x.kode).nama + App.W(x.kode).pic + x.catatan).toLowerCase().includes(teks)).slice(0, 5);

  wadahHasil.innerHTML = '';

  if (!wismaMatch.length && !kunjunganMatch.length) {
    const divEmpty = document.createElement('div');
    divEmpty.className = 'empty';
    divEmpty.textContent = 'Tidak ada hasil.';
    wadahHasil.appendChild(divEmpty);
    wadahHasil.hidden = false;
    return;
  }

  if (wismaMatch.length) {
    const h4 = document.createElement('h4');
    h4.textContent = 'Wisma';
    wadahHasil.appendChild(h4);

    wismaMatch.forEach(item => {
      const fragment = App.cloneTemplate('tmpl-search-item');
      const link = fragment.querySelector('[data-element="link"]');
      link.href = '#wisma';
      link.dataset.act = 'openW';
      link.dataset.id = item.id;

      fragment.querySelector('[data-element="title"]').textContent = item.nama + ' ';
      fragment.querySelector('[data-element="meta"]').textContent = `${item.kode} · ${item.pic}`;

      wadahHasil.appendChild(fragment);
    });
  }

  if (kunjunganMatch.length) {
    const h4 = document.createElement('h4');
    h4.textContent = 'Kunjungan';
    wadahHasil.appendChild(h4);

    kunjunganMatch.forEach(item => {
      const fragment = App.cloneTemplate('tmpl-search-item');
      const link = fragment.querySelector('[data-element="link"]');
      link.href = '#kunjungan';
      link.dataset.act = 'viewK';
      link.dataset.id = item.id;

      fragment.querySelector('[data-element="title"]').textContent = `${item.id} · ${App.W(item.kode).nama} `;
      fragment.querySelector('[data-element="meta"]').textContent = App.fmt(item.tgl);

      wadahHasil.appendChild(fragment);
    });
  }

  wadahHasil.hidden = false;
};

// Memulai Aplikasi
App.start = () => {
  addEventListener('hashchange', App.render);

  document.addEventListener('click', event => {
    const target = event.target;
    const grupData = target.closest('[data-g]');

    if (!target.closest('.ddw, .gs')) {
      $$('.dd').forEach(d => d.hidden = true);
    }

    const dropdownTrigger = target.closest('[data-dd]');
    if (dropdownTrigger) {
      const elemenDropdown = $('#dd-' + dropdownTrigger.dataset.dd);
      const statusHidden = elemenDropdown.hidden;
      $$('.dd').forEach(d => d.hidden = true); if (dropdownTrigger.dataset.dd == 'notif' && statusHidden) { elemenDropdown.innerHTML = ''; const h4 = document.createElement('h4'); h4.textContent = 'Notifikasi'; elemenDropdown.appendChild(h4); const daftarNotif = App.notifs(); if (!daftarNotif.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'Tidak ada notifikasi.'; elemenDropdown.appendChild(empty); } else { daftarNotif.forEach(notif => { const fragment = App.cloneTemplate('tmpl-notif-item'); const itemDiv = fragment.querySelector('[data-element="item"]'); if (!App.db.read.includes(notif.id)) itemDiv.classList.add('un'); itemDiv.textContent = notif.t; elemenDropdown.appendChild(fragment); }); } const linkTandai = document.createElement('a'); linkTandai.className = 'it'; linkTandai.href = '#'; linkTandai.dataset.act = 'readAll'; linkTandai.textContent = 'Tandai semua dibaca'; elemenDropdown.appendChild(linkTandai); } elemenDropdown.hidden = !statusHidden; return;
    } const elemenAksi = target.closest('[data-act]'); if (elemenAksi && App.act[elemenAksi.dataset.act]) {
      event.preventDefault(); $$
        ('.dd').forEach(d => d.hidden = true);
      App.act[elemenAksi.dataset.act](elemenAksi);
      return;
    }

    if (grupData) {
      const namaGrup = grupData.dataset.g;
      const stateGrid = App.G[namaGrup]?.s;
      if (!stateGrid) return;

      if (grupData.dataset.sort) {
        stateGrid.sd = stateGrid.sk == grupData.dataset.sort ? -stateGrid.sd : 1;
        stateGrid.sk = grupData.dataset.sort;
        if (typeof App.upd === 'function') App.upd(namaGrup);
      } else if (grupData.dataset.p) {
        stateGrid.p = +grupData.dataset.p;
        if (typeof App.upd === 'function') App.upd(namaGrup);
      } else if (grupData.hasAttribute('data-clr')) {
        stateGrid.sel.clear();
        if (typeof App.upd === 'function') App.upd(namaGrup);
      }
    }
  });

  document.addEventListener('input', event => {
    const target = event.target;
    if (target.id == 'gsearch') return App.gsearch(target.value);

    const namaGrup = target.dataset.g;
    const stateGrid = App.G[namaGrup]?.s;
    if (!stateGrid) return;

    if (target.hasAttribute('data-q')) {
      stateGrid.q = target.value;
      stateGrid.p = 1;
      if (typeof App.upd === 'function') App.upd(namaGrup);
    } else if (target.dataset.f) {
      stateGrid.f[target.dataset.f] = target.value;
      stateGrid.p = 1;
      if (typeof App.upd === 'function') App.upd(namaGrup);
    } else if (target.hasAttribute('data-n')) {
      stateGrid.n = +target.value;
      stateGrid.p = 1;
      if (typeof App.upd === 'function') App.upd(namaGrup);
    } else if (target.hasAttribute('data-all')) {
      const { cfg } = App.G[namaGrup];
      const barisTampil = App.rows(namaGrup).slice((stateGrid.p - 1) * stateGrid.n, stateGrid.p * stateGrid.n);
      barisTampil.forEach(x => target.checked ? stateGrid.sel.add(x.id) : stateGrid.sel.delete(x.id));
      if (typeof App.upd === 'function') App.upd(namaGrup);
    } else if (target.dataset.id) {
      target.checked ? stateGrid.sel.add(target.dataset.id) : stateGrid.sel.delete(target.dataset.id);
      if (typeof App.upd === 'function') App.upd(namaGrup);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key == 'Escape' && !$('#modal').hidden) App.close();
  });

  App.act.close = App.close;
  App.act.readAll = () => {
    App.notifs().forEach(n => App.db.read.push(n.id));
    App.save();
    App.chrome((location.hash.slice(1) || 'dashboard').split('/')[0]);
    App.toast('Semua notifikasi ditandai dibaca.', 'info');
  };

  App.act.logout = () => App.keluar();
  App.act.openW = tombol => {
    $('#gres').hidden = true;
    setTimeout(() => App.act.detW?.(tombol), 30);
  };
  App.act.viewK = tombol => {
    $('#gres').hidden = true;
    setTimeout(() => App.act.detK?.(tombol), 30);
  };

  App.render();
};

// Global Quick Search Palette Controller (Ctrl + K)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    App.toggleQuickSearch();
  }
  if (e.key === 'Escape') {
    App.closeQuickSearch();
  }
});

App.toggleQuickSearch = () => {
  const modal = $('#quick-search-modal');
  const input = $('#quick-search-input');
  if (!modal) return;

  if (modal.hidden) {
    modal.hidden = false;
    input.value = '';
    input.focus();
    App.renderQuickSearchResults('');
  } else {
    App.closeQuickSearch();
  }
};

App.closeQuickSearch = () => {
  const modal = $('#quick-search-modal');
  if (modal) modal.hidden = true;
};

// Listener Event Input
document.addEventListener('DOMContentLoaded', () => {
  const input = $('#quick-search-input');
  const modal = $('#quick-search-modal');

  input?.addEventListener('input', (e) => {
    App.renderQuickSearchResults(e.target.value.trim().toLowerCase());
  });

  // Klik luar kotak modal buat nutup
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) App.closeQuickSearch();
  });
});

// Render Hasil Pencarian
App.renderQuickSearchResults = (kueri) => {
  const container = $('#quick-search-results');
  if (!container) return;

  container.innerHTML = '';

  const hasil = [];

  // 1. Tambah Opsi Navigasi Cepat
  const menuNav = [
    { title: 'Buka Dashboard', type: 'Navigasi', act: () => { location.hash = 'dashboard'; } },
    { title: 'Buka Data Wisma', type: 'Navigasi', act: () => { location.hash = 'wisma'; } },
    { title: 'Buka Jadwal Kunjungan', type: 'Navigasi', act: () => { location.hash = 'kunjungan'; } },
    { title: 'Buka Laporan', type: 'Navigasi', act: () => { location.hash = 'laporan'; } },
    { title: 'Buka Pengaturan', type: 'Navigasi', act: () => { location.hash = 'settings'; } },
    { title: 'Buka Profil Saya', type: 'Navigasi', act: () => { location.hash = 'profil'; } }
  ];

  menuNav.forEach(m => {
    if (!kueri || m.title.toLowerCase().includes(kueri)) {
      hasil.push(m);
    }
  });

  // 2. Cari Data Wisma
  (App.db.wisma || []).forEach(w => {
    if (kueri && (w.nama + w.kode + w.pic).toLowerCase().includes(kueri)) {
      hasil.push({
        title: `${w.kode} - ${w.nama}`,
        sub: `PIC: ${w.pic} | Alamat: ${w.alamat}`,
        type: 'Wisma',
        act: () => {
          location.hash = 'wisma';
          setTimeout(() => App.act.detW?.({ dataset: { id: w.id } }), 80);
        }
      });
    }
  });

  // 3. Cari Data Kunjungan
  (App.db.kunjungan || []).forEach(k => {
    const wisma = App.db.wisma.find(w => w.kode === k.kode) || {};
    if (kueri && (k.id + k.kode + (wisma.nama || '') + k.catatan).toLowerCase().includes(kueri)) {
      hasil.push({
        title: `Kunjungan ID: ${k.id} (${wisma.nama || k.kode})`,
        sub: `Tanggal: ${App.fmt(k.tgl)} | Status: ${App.hitungStatus(k)}`,
        type: 'Kunjungan',
        act: () => {
          location.hash = 'kunjungan';
          setTimeout(() => App.act.detK?.({ dataset: { id: k.id } }), 80);
        }
      });
    }
  });

  if (!hasil.length) {
    container.innerHTML = '<div style="padding: 1rem; text-align: center; color: #94a3b8;">Tidak ada hasil ditemukan.</div>';
    return;
  }

  hasil.forEach(item => {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `
      <div>
        <div class="item-title">${item.title}</div>
        <div class="item-sub">${item.sub || 'Menu Pintas'}</div>
      </div>
      <span style="font-size:0.75rem; background:#e2e8f0; padding:2px 6px; border-radius:4px; white-space: nowrap; flex-shrink: 0;">${item.type}</span>
    `;
    div.onclick = () => {
      item.act();
      App.closeQuickSearch();
    };
    container.appendChild(div);
  });
};