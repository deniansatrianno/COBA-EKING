'use strict';
// ===== Fitur tambahan WVMS (front end) =====
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 1. Skor prioritas: makin tinggi makin perlu dikunjungi
App.hitungPrioritas = () => {
  const hariIni = new Date(App.today + 'T00:00');
  const selisih = tgl => Math.round((hariIni - new Date(tgl + 'T00:00')) / 864e5);
  return App.db.wisma.map(w => {
    const ks = App.db.kunjungan.filter(k => k.kode === w.kode && !k.batal);
    const terakhir = ks.filter(k => k.real).map(k => k.real).sort().pop();
    const telat = ks.filter(k => App.hitungStatus(k) === 'Overdue').length;
    const adaJadwal = ks.some(k => ['Today', 'Scheduled'].includes(App.hitungStatus(k)));
    const hari = terakhir ? selisih(terakhir) : 90;
    const kondisi = ks.filter(k => k.bukti?.skor != null).sort((a, b) => a.real > b.real ? 1 : -1).pop()?.bukti.skor;
    const skor = Math.min(100, Math.min(50, hari) + telat * 15 + (adaJadwal ? 0 : 20) + (kondisi != null ? Math.round((100 - kondisi) * 0.3) : 0));
    const alasan = [];
    if (telat) alasan.push(telat + ' jadwal terlambat');
    alasan.push(terakhir ? 'terakhir dikunjungi ' + hari + ' hari lalu' : 'belum pernah dikunjungi');
    if (kondisi != null && kondisi < 100) alasan.push('kondisi terakhir ' + kondisi + '%');
    if (!adaJadwal) alasan.push('belum ada jadwal');
    return { w, skor, alasan: alasan.join(', ') };
  }).sort((a, b) => b.skor - a.skor);
};

App.renderPrioritas = () => {
  const cards = $('#content .cards');
  if (!cards) return;
  const baris = App.hitungPrioritas().slice(0, 5).map(({ w, skor, alasan }) => `
    <tr>
      <td><b>${esc(w.nama)}</b><br><span class="mu">${esc(w.kode)}</span></td>
      <td>${esc(w.pic)}</td>
      <td class="mu">${esc(alasan)}</td>
      <td class="r"><b>${skor}</b></td>
      <td class="r"><button class="btn s p" data-act="jadwalkanW" data-kode="${esc(w.kode)}">Jadwalkan</button></td>
    </tr>`).join('');
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `<h2>Perlu Dikunjungi Duluan</h2><div class="tw"><table>
    <thead><tr><th>Wisma</th><th>PIC</th><th>Alasan</th><th class="r">Skor</th><th class="r">Aksi</th></tr></thead>
    <tbody>${baris || '<tr><td colspan="5"><div class="empty">Belum ada data wisma.</div></td></tr>'}</tbody></table></div>`;
  cards.after(panel);
};

const dashInitAsli = App.views.dashboard.init;
App.views.dashboard.init = a => { dashInitAsli?.(a); App.renderPrioritas(); };

// Buka form jadwal dengan wisma sudah terpilih
App.act.jadwalkanW = btn => {
  App.act.addK();
  const pilih = $('#modal [name="kode"]');
  if (pilih) pilih.value = btn.dataset.kode;
};

// 2. Ekspor Excel data kunjungan
App.act.expKXls = () => {
  const baris = [['ID', 'Kode Wisma', 'Nama Wisma', 'PIC', 'Tgl Rencana', 'Tgl Realisasi', 'Status', 'Catatan']];
  App.db.kunjungan.forEach(k => {
    const w = App.W(k.kode);
    baris.push([k.id, w._rusak ? '' : k.kode, w.nama, w.pic, k.tgl, k.real || '', App.hitungStatus(k), k.catatan || '']);
  });
  App.xls('data-kunjungan.xls', baris);
};

// 3. Tombol ganti tema (terang/gelap) di header
document.addEventListener('DOMContentLoaded', () => {
  const kanan = $('.hd .hr');
  if (!kanan) return;
  const tombol = document.createElement('button');
  tombol.className = 'ibtn';
  tombol.setAttribute('aria-label', 'Ganti tema terang/gelap');
  const tampil = () => { tombol.textContent = App.db.cfg.theme === 'dark' ? '☀️' : '🌙'; };
  tombol.onclick = () => {
    App.db.cfg.theme = App.db.cfg.theme === 'dark' ? 'light' : 'dark';
    App.save();
    document.documentElement.dataset.t = App.db.cfg.theme;
    tampil();
    App.refresh();   // grafik ikut berganti warna
  };
  tampil();
  kanan.prepend(tombol);
});

// 4. PWA: bisa di-install ke HP dan tetap terbuka saat offline
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ===== TAHAP 3: penugasan massal, check-in, laporan PDF =====

// Perbaikan: wisma.js dan kunjungan.js sama-sama mendefinisikan App.upd, yang terakhir menimpa yang pertama
App.upd = g => {
  if (g === 'w') { App.updWisma(); App.renderDenahWisma?.(); }
  if (g === 'k') App.updKunjungan();
};
// "Pilih semua" memanggil App.rows(), yang belum pernah ada: ambil baris yang tampil di halaman ini
App.rows = g => ({ slice: () => $$(`tbody input[type=checkbox][data-g="${g}"]`).map(c => ({ id: c.dataset.id })) });

const CHECKLIST = ['Kebersihan area', 'Listrik dan penerangan', 'Air dan sanitasi', 'Keamanan dan kunci', 'Kondisi kamar dan fasilitas', 'APAR dan peralatan darurat'];
const daftarPic = () => [...new Set(App.db.wisma.map(w => w.pic).filter(p => p && p !== '-'))].sort();

// Tombol "Tugaskan ke PIC" muncul saat ada wisma dicentang; "Auto-bagi" ada di toolbar
const updWismaAsli = App.updWisma;
App.updWisma = () => {
  updWismaAsli();
  const s = App.G.w?.s, slot = $('#wisma-bulk-slot');
  if (slot && s?.sel.size) {
    const b = document.createElement('button');
    b.className = 'btn s p'; b.dataset.act = 'assignW'; b.textContent = 'Tugaskan ke PIC';
    slot.insertBefore(b, slot.children[1]);
  }
  const tb = $('#wisma-table-body')?.closest('.panel')?.querySelector('.tb');
  if (tb && !tb.querySelector('[data-act="autoBagiW"]')) {
    const b = document.createElement('button');
    b.className = 'btn s'; b.dataset.act = 'autoBagiW'; b.textContent = 'Auto-bagi PIC';
    tb.append(b);
  }
};

App.act.assignW = () => {
  const ids = [...App.G.w.s.sel];
  const box = document.createElement('div');
  box.innerHTML = App.buatField('pic', 'Pilih PIC', '', { opts: [['', '— pilih PIC —'], ...daftarPic()] }) +
    App.buatField('picBaru', 'Atau ketik nama PIC baru', '');
  App.modal(`Tugaskan ${ids.length} wisma`, box, d => {
    const pic = (d.picBaru || '').trim() || d.pic;
    if (!pic) return { pic: 'Pilih PIC atau ketik nama PIC baru.' };
    App.db.wisma.forEach(w => { if (ids.includes(w.id)) w.pic = pic; });
    App.G.w.s.sel.clear();
    App.log('Penugasan Massal', `${ids.length} wisma ke ${pic}`);
    App.save();
    App.toast(`${ids.length} wisma ditugaskan ke ${pic}.`);
    App.refresh();
  }, { ok: 'Tugaskan' });
};

// Bagi rata: wisma terpilih (atau yang belum punya PIC) ke PIC dengan beban paling sedikit
App.act.autoBagiW = () => {
  const sel = App.G.w?.s.sel;
  const target = sel?.size ? App.db.wisma.filter(w => sel.has(w.id)) : App.db.wisma.filter(w => !w.pic || w.pic === '-');
  const pics = daftarPic();
  if (!target.length) return App.toast('Semua wisma sudah punya PIC.', 'info');
  if (!pics.length) return App.toast('Belum ada PIC. Tugaskan manual dulu.', 'error');
  App.modal('Auto-bagi PIC', `<p>${target.length} wisma akan dibagi ke ${pics.length} PIC, mulai dari PIC dengan beban paling sedikit.</p>`, () => {
    const beban = Object.fromEntries(pics.map(p => [p, App.db.wisma.filter(w => w.pic === p && !target.includes(w)).length]));
    target.forEach(w => { const p = pics.reduce((a, b) => beban[a] <= beban[b] ? a : b); w.pic = p; beban[p]++; });
    sel?.clear();
    App.log('Auto-bagi PIC', `${target.length} wisma dibagi ke ${pics.length} PIC`);
    App.save();
    App.toast(`${target.length} wisma berhasil dibagi.`);
    App.refresh();
  }, { ok: 'Bagi Sekarang' });
};

// Peringatan di dashboard: PIC dengan 2+ jadwal terlambat
const renderPrioritasAsli = App.renderPrioritas;
App.renderPrioritas = () => {
  renderPrioritasAsli();
  const telat = {};
  App.db.kunjungan.forEach(k => {
    if (App.hitungStatus(k) !== 'Overdue') return;
    const p = App.W(k.kode).pic;
    if (p && p !== '-') telat[p] = (telat[p] || 0) + 1;
  });
  const rawan = Object.entries(telat).filter(([, n]) => n >= 2).map(([p, n]) => `${p} (${n})`);
  const h2 = $('#content .panel h2');
  if (rawan.length && h2) h2.insertAdjacentHTML('afterend', `<p class="mu" style="padding:0 14px 10px">PIC dengan 2 atau lebih jadwal terlambat: ${esc(rawan.join(', '))}</p>`);
};

// Check-in: GPS + foto + tanda tangan, lalu kunjungan otomatis berstatus Selesai
App.act.checkinK = btn => {
  const k = App.db.kunjungan.find(x => x.id === btn.dataset.id);
  if (!k) return;
  let lokasi = null, foto = '', adaTtd = false, menggambar = false;
  const box = document.createElement('div');
  box.innerHTML = `<div class="fl"><span>Checklist inspeksi (hilangkan centang jika ada masalah)</span>${CHECKLIST.map(t => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="ci-cek" checked> ${t}</label>`).join('')}</div>`+`<p class="mu" id="ci-gps">Lokasi belum diambil.</p>
    <button type="button" class="btn s" id="ci-lokasi">Ambil lokasi GPS</button>
    <label class="fl"><span>Foto bukti</span><input type="file" id="ci-foto" accept="image/*" capture="environment"></label>
    <div class="fl"><span>Tanda tangan PIC</span>
      <canvas id="ci-ttd" width="360" height="120" style="border:1px solid var(--bd);border-radius:6px;touch-action:none;max-width:100%;background:#fff"></canvas>
      <button type="button" class="btn s" id="ci-hapus">Hapus tanda tangan</button></div>`;
  App.modal('Check-in ' + k.id, box, () => {
    if (!lokasi) { App.toast('Ambil lokasi GPS dulu.', 'error'); return false; }
    const lama = { real: k.real, bukti: k.bukti };
    k.real = App.today;
    const cek = [...box.querySelectorAll('.ci-cek')].map(c => c.checked);
    const skor = Math.round(cek.filter(Boolean).length / cek.length * 100);
    const temuan = CHECKLIST.filter((_, i) => !cek[i]);
    k.bukti = { lokasi, foto, ttd: adaTtd ? cv.toDataURL('image/png') : '', waktu: Date.now(), skor, temuan };
    const tiketBaru = App.buatTiket(k, temuan);
    try { App.save(); } catch (e) {
      k.real = lama.real; k.bukti = lama.bukti;
      App.db.tiket = TIKET().filter(t => !tiketBaru.includes(t));
      App.toast('Penyimpanan browser penuh. Coba tanpa foto atau backup data dulu.', 'error');
      return false;
    }
    App.log('Check-in Kunjungan', `${k.id} selesai dengan bukti GPS`);
    App.toast('Check-in tersimpan.' + (tiketBaru.length ? ` ${tiketBaru.length} tiket tindak lanjut dibuat.` : ''));
    App.refresh();
  }, { ok: 'Simpan Check-in', w: true });

  box.querySelector('#ci-lokasi').onclick = () => {
    const info = box.querySelector('#ci-gps');
    info.textContent = 'Mengambil lokasi…';
    navigator.geolocation?.getCurrentPosition(
      p => { lokasi = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: p.coords.accuracy };
             info.textContent = `Lokasi didapat: ${lokasi.lat}, ${lokasi.lng} (±${Math.round(lokasi.acc)} m)`; },
      () => { info.textContent = 'Gagal mengambil lokasi. Izinkan akses lokasi di browser lalu coba lagi.'; },
      { enableHighAccuracy: true, timeout: 10000 }
    ) || (info.textContent = 'Browser ini tidak mendukung GPS.');
  };
  box.querySelector('#ci-foto').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => {
      const sk = Math.min(1, 800 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = img.width * sk; c.height = img.height * sk;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      foto = c.toDataURL('image/jpeg', 0.6);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };
  const cv = box.querySelector('#ci-ttd'), cx = cv.getContext('2d');
  const bersih = () => { cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.lineWidth = 2; cx.lineCap = 'round'; cx.strokeStyle = '#17365d'; adaTtd = false; };
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  bersih();
  cv.onpointerdown = e => { menggambar = adaTtd = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); cx.beginPath(); cx.moveTo(x, y); };
  cv.onpointermove = e => { if (!menggambar) return; const [x, y] = pos(e); cx.lineTo(x, y); cx.stroke(); };
  cv.onpointerup = () => { menggambar = false; };
  box.querySelector('#ci-hapus').onclick = bersih;
};

// Detail kunjungan: tombol Check-in (jika belum selesai) atau bukti check-in (jika sudah)
const detKAsli = App.act.detK;
App.act.detK = btn => {
  detKAsli(btn);
  const k = App.db.kunjungan.find(x => x.id === btn.dataset.id);
  const isi = $('#modal .mc'), kaki = $('#modal .mf');
  if (!k || !isi) return;
  if (k.bukti) {
    const b = k.bukti, peta = b.lokasi ? `https://www.google.com/maps?q=${b.lokasi.lat},${b.lokasi.lng}` : '';
    isi.insertAdjacentHTML('beforeend', `<hr><p><b>Bukti check-in</b>, ${esc(new Date(b.waktu).toLocaleString('id-ID'))}</p>` +
      (b.skor != null ? `<p>Skor kondisi: <b>${b.skor}%</b>${b.temuan?.length ? ', temuan: ' + esc(b.temuan.join(', ')) : ', tanpa temuan'}</p>` : '') +
      (peta ? `<p><a href="${peta}" target="_blank" rel="noopener">Lihat lokasi di peta</a> (akurasi ±${Math.round(b.lokasi.acc)} m)</p>` : '') +
      (b.foto ? `<img src="${b.foto}" alt="Foto bukti" style="max-width:100%;border-radius:6px">` : '') +
      (b.ttd ? `<img src="${b.ttd}" alt="Tanda tangan PIC" style="max-width:100%;border:1px solid var(--bd);border-radius:6px;margin-top:8px">` : ''));
  } else if (!k.batal && !k.real && kaki) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn p'; b.dataset.act = 'checkinK'; b.dataset.id = k.id; b.textContent = 'Check-in';
    kaki.prepend(b);
  }
};

// Laporan: simpan sebagai PDF lewat dialog cetak browser
App.act.cetakLaporan = () => window.print();

// ===== TAHAP 4-5: QR per wisma, halaman scan, simulasi peran =====

// Tombol QR di tiap baris wisma
const updWismaQr = App.updWisma;
App.updWisma = () => {
  updWismaQr();
  const tbw = $('#wisma-table-body')?.closest('.panel')?.querySelector('.tb');
  if (tbw && !tbw.querySelector('[data-act="cetakQr"]')) {
    const c = document.createElement('button');
    c.className = 'btn s'; c.dataset.act = 'cetakQr'; c.textContent = 'Cetak QR';
    tbw.append(c);
  }
  $$('#wisma-table-body [data-act="detW"]').forEach(d => {
    const b = document.createElement('button');
    b.className = 'btn s'; b.dataset.act = 'qrW'; b.dataset.id = d.dataset.id; b.textContent = 'QR';
    d.after(b);
    const r = document.createElement('button');
    r.className = 'btn s'; r.dataset.act = 'riwayatW'; r.dataset.id = d.dataset.id; r.textContent = 'Riwayat';
    d.after(r);
  });
};

App.act.qrW = btn => {
  const w = App.db.wisma.find(x => x.id === btn.dataset.id);
  if (!w) return;
  const box = document.createElement('div');
  box.style.textAlign = 'center';
  box.innerHTML = `<div id="qr-kotak" style="display:inline-block;padding:12px;background:#fff"></div>
    <p><b>${esc(w.nama)}</b><br><span class="mu">${esc(w.kode)}</span></p>
    <button type="button" class="btn s" id="qr-unduh">Unduh PNG</button>`;
  App.modal('QR Wisma', box, null);
  if (typeof QRCode === 'undefined') { box.querySelector('#qr-kotak').textContent = 'Library QR gagal dimuat. Cek koneksi internet.'; return; }
  const url = location.origin + location.pathname + '#scan/' + w.kode;
  new QRCode(box.querySelector('#qr-kotak'), { text: url, width: 220, height: 220 });
  box.querySelector('#qr-unduh').onclick = () => {
    const cv = box.querySelector('canvas'); if (!cv) return;
    const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = `qr-${w.kode}.png`; a.click();
  };
};

// Halaman tujuan QR: #scan/WSM-001
App.views.scan = kode => {
  const div = document.createElement('div');
  const w = App.db.wisma.find(x => x.kode === kode);
  if (!w) {
    div.innerHTML = `<div class="panel"><h2>QR tidak dikenali</h2><p class="mu" style="padding:0 14px 14px">Wisma dengan kode ${esc(kode)} tidak ada di data ini.</p></div>`;
    return div;
  }
  const jadwal = App.db.kunjungan.filter(k => k.kode === kode && !k.batal && !k.real).sort((a, b) => a.tgl > b.tgl ? 1 : -1)[0];
  const aksi = jadwal
    ? `<p>Jadwal terdekat: <b>${esc(App.fmt(jadwal.tgl))}</b> (${esc(App.hitungStatus(jadwal))})</p><button class="btn p" data-act="checkinK" data-id="${esc(jadwal.id)}">Check-in sekarang</button>`
    : `<p class="mu">Belum ada jadwal aktif untuk wisma ini.</p><button class="btn p" data-act="jadwalkanW" data-kode="${esc(w.kode)}">Buat jadwal kunjungan</button>`;
  div.innerHTML = `<div class="panel"><h2>${esc(w.nama)}</h2><div class="pb"><p class="mu">${esc(w.kode)}, PIC ${esc(w.pic)}<br>${esc(w.alamat)}</p>${aksi} <a class="btn s" href="#riwayat/${esc(w.kode)}">Riwayat wisma</a></div></div>`;
  return div;
};

// Simulasi peran (tampilan saja; keamanan sungguhan tugas back end)
const HAK = {
  Viewer: ['addW', 'editW', 'delW', 'delWBulk', 'impW', 'addK', 'editK', 'delK', 'delKBulk', 'assignW', 'autoBagiW', 'checkinK', 'jadwalkanW', 'saveCfgCompany', 'saveCfgDisplay', 'restoreData', 'resetData', 'saveWaTemplate', 'resetWaTemplate', 'jadwalOtomatis', 'tiketStatus', 'gantiPic'],
  Staff: ['delW', 'delWBulk', 'delK', 'delKBulk', 'saveCfgCompany', 'restoreData', 'resetData']
};
App.aksiDiblokir = act => (HAK[App.db.cfg.me?.role] || []).includes(act);
document.addEventListener('click', e => {
  const el = e.target.closest?.('[data-act]');
  if (!el || !App.aksiDiblokir(el.dataset.act)) return;
  e.stopPropagation(); e.preventDefault();
  App.toast(`Peran ${App.db.cfg.me.role} tidak boleh melakukan aksi ini (simulasi tampilan).`, 'error');
}, true);

// ===== TAHAP 6: peta, rute terdekat, antrean sinkron =====

// Menu "Peta" ditambahkan setelah menu bawaan
const chromeAsli = App.chrome;
App.chrome = kunci => {
  chromeAsli(kunci);
  const nav = $('#nav .wrap'), lap = nav.querySelector('[data-nav="laporan"], [href="#laporan"]');
  // Urutan: Dashboard, Wisma, Kunjungan, Scan QR, Peta, Laporan
  const terbuka = (App.db.tiket || []).filter(t => t.status !== 'Selesai').length;
  [['scanqr', 'Scan QR'], ['peta', 'Peta'], ['tiket', 'Tiket' + (terbuka ? ` (${terbuka})` : '')]].forEach(([id, teks]) => {
    const a = document.createElement('a');
    a.href = '#' + id; a.textContent = teks;
    if (kunci === id) { a.className = 'on'; a.setAttribute('aria-current', 'page'); }
    nav.insertBefore(a, lap || null);
  });
};

const punyaKoordinat = w => w.lat !== '' && w.lng !== '' && w.lat != null && w.lng != null && Number.isFinite(+w.lat) && Number.isFinite(+w.lng);
const jarakKm = (a, b) => {
  const r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
// Urutan kunjungan: selalu ke titik terdekat berikutnya (nearest neighbour)
App.urutRute = (awal, titik) => {
  const sisa = [...titik], hasil = [];
  let cur = awal;
  while (sisa.length) {
    let bi = 0;
    sisa.forEach((t, i) => { if (jarakKm(cur, [+t.lat, +t.lng]) < jarakKm(cur, [+sisa[bi].lat, +sisa[bi].lng])) bi = i; });
    const t = sisa.splice(bi, 1)[0];
    hasil.push({ ...t, km: jarakKm(cur, [+t.lat, +t.lng]) });
    cur = [+t.lat, +t.lng];
  }
  return hasil;
};

App.views.peta = () => {
  const div = document.createElement('div');
  div.appendChild(App.buatPageHeader('Peta Wisma', 'Merah: terlambat, biru tua: hari ini, biru muda: terjadwal, hijau: selesai, abu-abu: belum ada kunjungan'));
  div.insertAdjacentHTML('beforeend', `<div class="panel"><div class="tb">
    <button class="btn p" data-act="petaRute">Urutkan rute dari lokasi saya</button>
    <span class="mu" id="peta-info"></span></div>
    <div id="peta" style="height:480px;border-radius:8px"></div>
    <div class="pb" id="peta-rute"></div></div>`);
  return div;
};
App.views.peta.init = () => {
  const el = $('#peta');
  if (!el) return;
  if (typeof L === 'undefined') { el.textContent = 'Library peta gagal dimuat. Cek koneksi internet.'; return; }
  try { App._peta?.remove(); } catch (e) { /* peta lama sudah hilang */ }
  const titik = App.db.wisma.filter(punyaKoordinat);
  const peta = App._peta = L.map(el).setView([-6.9175, 107.6191], 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(peta);
  const warna = { Overdue: '#dc2626', Today: '#1d4ed8', Scheduled: '#06b6d4', Completed: '#16a34a', None: '#64748b' };
  titik.forEach(w => {
    const ks = App.db.kunjungan.filter(k => k.kode === w.kode && !k.batal);
    const buka = ks.filter(k => !k.real).map(k => App.hitungStatus(k));
    const st = !ks.length ? 'None' : buka.includes('Overdue') ? 'Overdue' : buka.includes('Today') ? 'Today' : buka.includes('Scheduled') ? 'Scheduled' : 'Completed';
    L.circleMarker([+w.lat, +w.lng], { radius: 10, color: '#fff', weight: 2, fillColor: warna[st], fillOpacity: 0.95 })
      .addTo(peta).bindPopup(`<b>${esc(w.nama)}</b><br>PIC: ${esc(w.pic)}`);
  });
  if (titik.length) peta.fitBounds(titik.map(w => [+w.lat, +w.lng]), { padding: [30, 30], maxZoom: 15 });
  $('#peta-info').textContent = titik.length
    ? `${titik.length} dari ${App.db.wisma.length} wisma punya koordinat`
    : 'Belum ada koordinat. Isi Latitude dan Longitude lewat tombol Edit di halaman Wisma.';
};

App.act.petaRute = () => {
  const info = $('#peta-rute');
  info.textContent = 'Mengambil lokasi…';
  const buka = w => App.db.kunjungan.filter(k => k.kode === w.kode && !k.batal && !k.real).map(k => App.hitungStatus(k));
  let target = App.db.wisma.filter(w => punyaKoordinat(w) && buka(w).some(s => s === 'Today' || s === 'Overdue'));
  if (!target.length) target = App.db.wisma.filter(w => punyaKoordinat(w) && buka(w).length);
  if (!target.length) { info.textContent = 'Tidak ada wisma berkoordinat yang punya jadwal aktif.'; return; }
  navigator.geolocation?.getCurrentPosition(p => {
    const awal = [p.coords.latitude, p.coords.longitude];
    const urut = App.urutRute(awal, target);
    L.polyline([awal, ...urut.map(t => [+t.lat, +t.lng])], { color: '#17365d', weight: 3, dashArray: '6 6' }).addTo(App._peta);
    L.circleMarker(awal, { radius: 6, color: '#fff', fillColor: '#17365d', fillOpacity: 1 }).addTo(App._peta).bindPopup('Lokasi Anda');
    const gmaps = 'https://www.google.com/maps/dir/' + [awal, ...urut.map(t => [+t.lat, +t.lng])].map(c => c.join(',')).join('/');
    info.innerHTML = `<ol>${urut.map(t => `<li><b>${esc(t.nama)}</b>, ${t.km.toFixed(1)} km dari titik sebelumnya (PIC ${esc(t.pic)})</li>`).join('')}</ol>
      <a class="btn s" href="${gmaps}" target="_blank" rel="noopener">Buka rute di Google Maps</a>`;
  }, () => { info.textContent = 'Gagal mengambil lokasi. Izinkan akses lokasi di browser lalu coba lagi.'; }, { enableHighAccuracy: true, timeout: 10000 })
  || (info.textContent = 'Browser ini tidak mendukung GPS.');
};

// Tombol refresh di header (menggantikan antrean sinkron)
App.act.refreshData = async () => {
  try { await App.loadFromServer(); App.refresh(); App.toast('Data diperbarui dari server.', 'info'); }
  catch (e) { App.toast('Gagal memuat data: ' + e.message, 'error'); }
};
document.addEventListener('DOMContentLoaded', () => {
  const kanan = $('.hd .hr');
  if (!kanan) return;
  const b = document.createElement('button');
  b.className = 'ibtn'; b.dataset.act = 'refreshData'; b.title = 'Muat ulang data'; b.textContent = '↻';
  b.setAttribute('aria-label', 'Muat ulang data');
  kanan.prepend(b);
});

// ===== TAHAP 7: Scan QR wisma =====
const stopKamera = () => {
  App._kamera?.getTracks().forEach(t => t.stop());
  App._kamera = null;
  cancelAnimationFrame(App._scanRaf);
};
const renderAsli = App.render;
let halamanTerakhir = null;
App.render = () => {
  stopKamera();   // kamera mati saat pindah halaman
  const kunci = (location.hash.slice(1) || 'dashboard').split('/')[0];
  const pindah = kunci !== halamanTerakhir;
  renderAsli();
  if (pindah) {   // pindah halaman: mulai dari atas dengan animasi masuk halus
    halamanTerakhir = kunci;
    scrollTo(0, 0);
    const c = $('#content');
    c.classList.remove('masuk'); void c.offsetWidth; c.classList.add('masuk');
  }
};

const ambilKode = teks => {
  const m = String(teks).match(/#scan\/([^\s#?]+)/);
  return decodeURIComponent(m ? m[1] : String(teks).trim());
};
const bukaWisma = teks => {
  const kode = ambilKode(teks);
  const w = App.db.wisma.find(x => x.kode.toLowerCase() === kode.toLowerCase());
  if (!w) return false;
  stopKamera();
  location.hash = 'scan/' + w.kode;
  return true;
};

App.views.scanqr = () => {
  const div = document.createElement('div');
  div.appendChild(App.buatPageHeader('Scan QR Wisma', 'Arahkan kamera ke QR wisma untuk langsung membuka datanya'));
  div.insertAdjacentHTML('beforeend', `<div class="panel"><div class="pb">
    <video id="scan-video" playsinline muted style="width:100%;max-width:420px;border-radius:8px;background:#000"></video>
    <p class="mu" id="scan-info">Menyalakan kamera…</p>
    <div class="tb"><input id="scan-manual" placeholder="Atau ketik kode wisma, mis. WSM-001" aria-label="Kode wisma">
      <button class="btn p" data-act="cariKodeWisma">Cari</button>
      <label class="btn s">Pilih foto QR<input type="file" id="scan-file" accept="image/*" hidden></label></div>
  </div></div>`);
  return div;
};

App.views.scanqr.init = async () => {
  const video = $('#scan-video'), info = $('#scan-info');
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  let jeda = 0;
  const baca = (src, w, h) => {
    const sk = Math.min(1, 640 / Math.max(w, h));
    cv.width = w * sk; cv.height = h * sk;
    cx.drawImage(src, 0, 0, cv.width, cv.height);
    const d = cx.getImageData(0, 0, cv.width, cv.height);
    return jsQR(d.data, d.width, d.height);
  };
  const tanggapi = hasil => {
    if (bukaWisma(hasil.data)) return true;
    info.textContent = `QR terbaca (${ambilKode(hasil.data)}) tapi wisma tidak ada di data ini.`;
    jeda = Date.now() + 2000;
    return false;
  };
  $('#scan-file').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (typeof jsQR !== 'function') { info.textContent = 'Library scanner gagal dimuat. Cek internet.'; return; }
    const img = new Image();
    img.onload = () => {
      const h = baca(img, img.width, img.height);
      if (h) tanggapi(h); else info.textContent = 'QR tidak terbaca di foto ini. Coba foto yang lebih jelas.';
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };
  if (typeof jsQR !== 'function') { info.textContent = 'Library scanner gagal dimuat. Cek internet, atau ketik kode wisma manual.'; return; }
  if (!navigator.mediaDevices?.getUserMedia) { info.textContent = 'Kamera tidak tersedia di browser ini. Pakai foto QR atau ketik kode.'; return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
  catch (e) { info.textContent = 'Kamera tidak bisa diakses. Izinkan akses kamera di browser, atau pakai foto QR / ketik kode.'; return; }
  if (!video.isConnected) { stream.getTracks().forEach(t => t.stop()); return; }   // user sudah pindah halaman
  App._kamera = stream;
  video.srcObject = stream;
  await video.play();
  info.textContent = 'Arahkan kamera ke QR wisma.';
  const loop = () => {
    if (!App._kamera) return;
    if (video.videoWidth && Date.now() > jeda) {
      const h = baca(video, video.videoWidth, video.videoHeight);
      if (h && tanggapi(h)) return;
    }
    App._scanRaf = requestAnimationFrame(loop);
  };
  loop();
};

App.act.cariKodeWisma = () => {
  const v = ($('#scan-manual')?.value || '').trim();
  if (!v) return App.toast('Ketik kode wisma dulu.', 'error');
  if (!bukaWisma(v)) App.toast('Wisma dengan kode itu tidak ditemukan.', 'error');
};

// ===== TAHAP 8: logout, tema tersimpan, reset filter, pengaturan baru =====
const saveAsli = App.save;
const simpanPrefTampilan = () => {
  document.documentElement.dataset.p = App.db.cfg.palet || 'teal';
  try { localStorage.setItem('wvms.tema', App.db.cfg.theme || 'light'); localStorage.setItem('wvms.palet', App.db.cfg.palet || 'teal'); } catch (e) { /* abaikan */ }
};
App.save = () => { const hasil = saveAsli(); simpanPrefTampilan(); return hasil; };   // tetap mengembalikan Promise dari app.js

App.keluar = () => App.modal('Keluar dari aplikasi?',
  '<p>Sesi Anda akan diakhiri dan Anda kembali ke halaman login.</p>',
  () => { App.logout(); }, { ok: 'Keluar' });

App.act.resetFilterK = () => {
  const s = App.G.k.s;
  s.q = ''; s.f = { status: '', pic: '', dari: '', sampai: '' }; s.p = 1;
  App.refresh();
};

const TAB_SET = [['tampilan', 'Tampilan'], ['instansi', 'Instansi'], ['tim', 'Tim PIC'], ['wa', 'Pesan WA'], ['data', 'Data'], ['log', 'Log Aktivitas']];
App._tabSet = 'tampilan';
const tampilTab = id => {
  App._tabSet = id;
  $$('section[data-tab]').forEach(x => { x.hidden = x.dataset.tab !== id; });
  $$('.tabs a[data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === id));
};
App.act.tabSet = el => tampilTab(el.dataset.tab);
const ket = t => `<p class="mu" style="margin-bottom:14px;font-size:12px">${t}</p>`;
App._buildSettingsHTML = () => `
<div id="settings-header-slot-inner"></div>
<div class="tabs" style="margin-bottom:1.25rem">${TAB_SET.map(([id, t]) => `<a href="#" data-act="tabSet" data-tab="${id}">${t}</a>`).join('')}</div>
<section data-tab="tampilan"><div class="panel"><h2>Warna Aplikasi</h2><div class="pb">${ket('Pilih palet yang paling nyaman di mata. Berlaku untuk mode terang dan gelap.')}<div class="palet" id="cfg-palet"></div></div></div><div class="panel"><h2>Preferensi Tampilan</h2><div class="pb">${ket('Tema, format tanggal, jumlah baris tabel, dan pengingat.')}<div id="cfg-display-slot"></div></div></div></section>
<section data-tab="instansi"><div class="panel"><h2>Informasi Instansi</h2><div class="pb">${ket('Tampil di header aplikasi dan dokumen ekspor.')}<div id="cfg-company-slot"></div></div></div></section>
<section data-tab="tim"><div class="panel"><h2>Tim PIC</h2>${ket('Ringkasan beban kerja tiap PIC. Ganti nama akan memperbarui semua wisma miliknya.').replace('margin-bottom:14px', 'padding:0 14px 10px')}
  <div class="tw"><table><thead><tr><th>PIC</th><th class="r">Wisma</th><th class="r">Jadwal aktif</th><th class="r">Terlambat</th><th class="r">Aksi</th></tr></thead><tbody id="cfg-pic-body"></tbody></table></div></div></section>
<section data-tab="wa"><div class="panel"><h2>Template Pesan WhatsApp</h2><div class="pb">${ket('Dipakai tombol WA di halaman Kunjungan. Kata kunci diganti otomatis.')}<div id="cfg-wa-slot"></div></div></div></section>
<section data-tab="data"><div class="panel"><h2>Kelola Data</h2><div class="pb"><div id="cfg-storage"></div>
  <div id="cfg-data-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:16px"></div></div></div></section>
<section data-tab="log"><div class="panel"><h2>Log Aktivitas</h2>${ket('50 aksi terakhir di aplikasi ini.').replace('margin-bottom:14px', 'padding:0 14px 10px')}
  <div class="tw"><table><thead><tr><th style="width:160px">Waktu</th><th style="width:140px">Pengguna</th><th style="width:200px">Aksi</th><th>Detail</th></tr></thead><tbody id="log-table-body"></tbody></table></div></div></section>`;

const settingsInitAsli = App.views.settings.init;
App.views.settings.init = a => {
  settingsInitAsli(a);
  const baris = daftarPic().map(p => {
    const ws = App.db.wisma.filter(w => w.pic === p);
    const ks = App.db.kunjungan.filter(k => !k.batal && !k.real && ws.some(w => w.kode === k.kode));
    const tl = ks.filter(k => App.hitungStatus(k) === 'Overdue').length;
    return `<tr><td><b>${esc(p)}</b></td><td class="r">${ws.length}</td><td class="r">${ks.length}</td><td class="r">${tl}</td><td class="r"><button class="btn s" data-act="gantiPic" data-pic="${esc(p)}">Ganti nama</button></td></tr>`;
  }).join('');
  $('#cfg-pic-body').innerHTML = baris || '<tr><td colspan="5"><div class="empty">Belum ada PIC.</div></td></tr>';
  const kb = Math.round(JSON.stringify(App.db).length / 1024), pct = Math.min(100, Math.round(kb / 5000 * 100));
  $('#cfg-storage').innerHTML = `<b>Penyimpanan browser</b><div class="meter"><i style="width:${pct}%"></i></div><p class="mu" style="font-size:12px">${kb} KB terpakai dari sekitar 5.000 KB (${pct}%). Foto check-in paling banyak memakai ruang.</p>`;
  $('#cfg-data-cards').innerHTML = [
    ['📦', 'Backup Data', 'Unduh salinan lengkap data ke file JSON.', 'backupData', 'p', 'Unduh Backup'],
    ['📂', 'Restore Data', 'Pulihkan data dari file backup JSON.', 'restoreData', '', 'Pilih File Backup'],
    ['⚠️', 'Reset Data', 'Hapus semua data dan kembali ke data demo. Tidak bisa dibatalkan.', 'resetData', 'd', 'Reset ke Data Demo']
  ].map(([i, t, d, act, c, l]) => `<div style="border:1px solid var(--bd);border-radius:8px;padding:16px"><b>${i} ${t}</b><p class="mu" style="font-size:12px;margin:6px 0 12px">${d}</p><button class="btn ${c}" data-act="${act}" style="width:100%">${l}</button></div>`).join('');
  const cur = App.db.cfg.palet || 'teal';
  $('#cfg-palet').innerHTML = [['teal', 'Hijau Teal', ['#2f7472', '#3f8f6b', '#f3f5f2']], ['biru', 'Biru Kalem', ['#3f6b8f', '#4a80a8', '#f2f5f8']], ['pasir', 'Pasir Hangat', ['#9a6f4d', '#6f8fa3', '#f6f2ec']]]
    .map(([id, nama, w]) => `<button data-act="setPalet" data-p="${id}" class="${cur === id ? 'on' : ''}">${w.map(c => `<i style="background:${c}"></i>`).join('')}<span style="margin-left:10px">${nama}</span></button>`).join('');
  $('#cfg-wa-slot').innerHTML = App.buatField('wa', 'Isi pesan', App.db.cfg.waTemplate || WA_DEFAULT, { area: true }) +
    '<p class="mu" style="font-size:12px;margin:6px 0 12px">Kata kunci: {pic} {wisma} {kode} {tanggal} {catatan} {instansi}</p>' +
    '<button class="btn p" data-act="saveWaTemplate">Simpan Template</button> <button class="btn s" data-act="resetWaTemplate">Kembalikan Bawaan</button>';
  tampilTab(App._tabSet);
};

App.act.gantiPic = btn => {
  const lama = btn.dataset.pic, box = document.createElement('div');
  box.innerHTML = App.buatField('pic', 'Nama baru', lama, { req: true });
  App.modal('Ganti nama PIC: ' + lama, box, d => {
    const baru = (d.pic || '').trim();
    if (!baru) return { pic: 'Wajib diisi.' };
    App.db.wisma.forEach(w => { if (w.pic === lama) w.pic = baru; });
    App.log('Ganti Nama PIC', `${lama} menjadi ${baru}`);
    App.save();
    App.toast('Nama PIC diperbarui.');
    App.refresh();
  }, { ok: 'Simpan' });
};

// ===== TAHAP 9: template WA, tiket, riwayat, kinerja PIC, tren, jadwal otomatis, cetak QR =====

// 1. Template pesan WhatsApp
const WA_DEFAULT = 'Halo {pic},\n\nIni pengingat dari {instansi}. Ada jadwal kunjungan ke *{wisma}* ({kode}) pada *{tanggal}*.\n\nCatatan: {catatan}\n\nMohon persiapannya. Terima kasih!';
App.pesanWA = (k, w) => {
  const isi = { pic: w.pic || 'Bapak/Ibu PIC', wisma: w.nama, kode: w.kode, tanggal: App.fmt(k.tgl), catatan: k.catatan || '-', instansi: App.db.cfg.company || 'WVMS' };
  return (App.db.cfg.waTemplate || WA_DEFAULT).replace(/\{(\w+)\}/g, (m, kunci) => (kunci in isi ? isi[kunci] : m));
};
App.act.saveWaTemplate = btn => {
  const v = btn.closest('.panel').querySelector('[name="wa"]')?.value.trim();
  if (!v) return App.toast('Isi pesan tidak boleh kosong.', 'error');
  App.db.cfg.waTemplate = v;
  App.log('Ubah Template WA', 'Template pesan pengingat diperbarui');
  App.save(); App.toast('Template pesan disimpan.'); App.refresh();
};
App.act.resetWaTemplate = () => { delete App.db.cfg.waTemplate; App.save(); App.toast('Template dikembalikan ke bawaan.'); App.refresh(); };

// 2. Tiket tindak lanjut dari temuan checklist
const TIKET = () => (App.db.tiket ||= []);
App.buatTiket = (k, temuan) => {
  const daftar = TIKET();
  const baru = temuan.map((item, i) => ({ id: 'T-' + String(App.today).replace(/-/g, '') + '-' + Date.now().toString(36).toUpperCase() + (i + 1), kode: k.kode, kid: k.id, item, status: 'Baru', tgl: App.today, selesai: '' }));
  daftar.push(...baru);
  return baru;
};
const KELAS_TIKET = { Baru: 'b-Overdue', Diproses: 'b-Scheduled', Selesai: 'b-Completed' };
const LANJUT_TIKET = { Baru: ['Diproses', 'Proses'], Diproses: ['Selesai', 'Selesaikan'], Selesai: ['Baru', 'Buka lagi'] };
App._tiketF = '';
App.views.tiket = () => {
  const div = document.createElement('div');
  div.appendChild(App.buatPageHeader('Tiket Tindak Lanjut', 'Temuan dari checklist inspeksi yang perlu ditangani sampai selesai'));
  const semua = TIKET();
  const daftar = semua.filter(t => !App._tiketF || t.status === App._tiketF).sort((a, b) => a.tgl < b.tgl ? 1 : -1);
  const tabs = [['', 'Semua'], ['Baru', 'Baru'], ['Diproses', 'Diproses'], ['Selesai', 'Selesai']]
    .map(([s, t]) => `<a href="#" data-act="tiketFilter" data-s="${s}" class="${App._tiketF === s ? 'on' : ''}">${t} (${s ? semua.filter(x => x.status === s).length : semua.length})</a>`).join('');
  const baris = daftar.map(t => {
    const w = App.W(t.kode), [, label] = LANJUT_TIKET[t.status];
    return `<tr><td><b>${esc(t.id)}</b></td><td>${esc(w.nama)}<br><span class="mu">${esc(w.pic)}</span></td><td>${esc(t.item)}</td><td>${esc(App.fmt(t.tgl))}</td>
      <td><span class="bdg ${KELAS_TIKET[t.status]}">${esc(t.status)}</span></td>
      <td class="r"><button class="btn s" data-act="tiketStatus" data-id="${esc(t.id)}">${label}</button></td></tr>`;
  }).join('');
  div.insertAdjacentHTML('beforeend', `<div class="tabs" style="margin-bottom:1.25rem">${tabs}</div>
    <div class="panel"><div class="tw"><table><thead><tr><th>ID</th><th>Wisma</th><th>Temuan</th><th>Tanggal</th><th>Status</th><th class="r">Aksi</th></tr></thead>
    <tbody>${baris || '<tr><td colspan="6"><div class="empty">Belum ada tiket. Tiket dibuat otomatis saat check-in menemukan masalah.</div></td></tr>'}</tbody></table></div></div>`);
  return div;
};
App.act.tiketFilter = el => { App._tiketF = el.dataset.s; App.refresh(); };
App.act.tiketStatus = el => {
  const t = TIKET().find(x => x.id === el.dataset.id);
  if (!t) return;
  t.status = LANJUT_TIKET[t.status][0];
  t.selesai = t.status === 'Selesai' ? App.today : '';
  App.log('Ubah Tiket', `${t.id} menjadi ${t.status}`);
  App.save(); App.refresh();
};

// 3. Riwayat per wisma (timeline)
App.act.riwayatW = btn => {
  const w = App.db.wisma.find(x => x.id === btn.dataset.id);
  if (w) location.hash = 'riwayat/' + w.kode;
};
App.views.riwayat = kode => {
  const div = document.createElement('div');
  const w = App.db.wisma.find(x => x.kode === kode);
  if (!w) { div.innerHTML = '<div class="panel"><h2>Wisma tidak ditemukan</h2></div>'; return div; }
  div.appendChild(App.buatPageHeader('Riwayat ' + w.nama, `${w.kode}, PIC ${w.pic}. ${w.alamat}`));
  const ks = App.db.kunjungan.filter(k => k.kode === kode && !k.batal).sort((a, b) => a.tgl < b.tgl ? 1 : -1);
  const hitung = st => ks.filter(k => App.hitungStatus(k) === st).length;
  const skors = ks.filter(k => k.bukti?.skor != null).map(k => k.bukti.skor);
  const rata = skors.length ? Math.round(skors.reduce((a, b) => a + b, 0) / skors.length) + '%' : '-';
  const tiket = TIKET().filter(t => t.kode === kode && t.status !== 'Selesai').length;
  const kartu = [['Total kunjungan', ks.length, ''], ['Selesai', hitung('Completed'), 'ok'], ['Terlambat', hitung('Overdue'), 'er'], ['Skor kondisi rata-rata', rata, 'in'], ['Tiket terbuka', tiket, 'wa']]
    .map(([t, v, c]) => `<div class="card ${c}"><small>${t}</small><b>${v}</b></div>`).join('');
  const item = k => {
    const st = App.hitungStatus(k), b = k.bukti;
    return `<div class="it"><b>${esc(App.fmt(k.tgl))}</b> <span class="bdg b-${st}">${st}</span>
      <div class="mu">${esc(k.tujuan || '-')}${k.catatan ? ', ' + esc(k.catatan) : ''}</div>` +
      (b ? `<div>Skor kondisi <b>${b.skor}%</b>${b.temuan?.length ? ', temuan: ' + esc(b.temuan.join(', ')) : ', tanpa temuan'}${b.lokasi ? ` · <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${b.lokasi.lat},${b.lokasi.lng}">lokasi</a>` : ''}</div>` +
        (b.foto ? `<img src="${b.foto}" alt="Foto kunjungan">` : '') : '') + '</div>';
  };
  div.insertAdjacentHTML('beforeend', `<div class="cards">${kartu}</div><div class="panel"><h2>Riwayat Kunjungan</h2><div class="pb">` +
    (ks.length ? `<div class="tl">${ks.map(item).join('')}</div>` : '<div class="empty">Belum ada kunjungan untuk wisma ini.</div>') + '</div></div>');
  return div;
};

// 4 dan 5. Laporan: kinerja PIC dan tren bulanan
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const renderLaporanExtra = () => {
  const slot = $('#laporan-stats-slot');
  if (!slot) return;
  let ex = $('#lap-extra');
  if (!ex) { ex = document.createElement('div'); ex.id = 'lap-extra'; slot.after(ex); }
  const f = App.lapFilter;
  const ks = App.db.kunjungan.filter(k => !k.batal && (!f.mulai || k.tgl >= f.mulai) && (!f.selesai || k.tgl <= f.selesai));
  const per = {};
  ks.forEach(k => {
    const w = App.W(k.kode);
    if (w._hapus || w._rusak) return;
    const p = per[w.pic] ||= { pic: w.pic, selesai: 0, telat: 0, tepat: 0, skor: [] };
    const st = App.hitungStatus(k);
    if (st === 'Completed') { p.selesai++; if (k.real && k.real <= k.tgl) p.tepat++; } else if (st === 'Overdue') p.telat++;
    if (k.bukti?.skor != null) p.skor.push(k.bukti.skor);
  });
  const pct = p => p.selesai ? Math.round(p.tepat / p.selesai * 100) : -1;
  const rows = Object.values(per).sort((a, b) => pct(b) - pct(a) || b.selesai - a.selesai).map(p => `<tr>
    <td><b>${esc(p.pic)}</b></td><td class="r">${App.db.wisma.filter(w => w.pic === p.pic).length}</td><td class="r">${p.selesai}</td><td class="r">${p.telat}</td>
    <td class="r">${pct(p) < 0 ? '-' : pct(p) + '%'}</td><td class="r">${p.skor.length ? Math.round(p.skor.reduce((a, b) => a + b, 0) / p.skor.length) + '%' : '-'}</td></tr>`).join('');
  ex.innerHTML = `<div class="panel"><h3>Kinerja PIC</h3><div class="tw"><table><thead><tr><th>PIC</th><th class="r">Wisma</th><th class="r">Selesai</th><th class="r">Terlambat</th><th class="r">Tepat waktu</th><th class="r">Skor kondisi</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6"><div class="empty">Belum ada data.</div></td></tr>'}</tbody></table></div></div>
    <div class="panel"><h3>Tren Bulanan</h3><div class="pb"><div style="position:relative;height:260px"><canvas id="chart-tren"></canvas></div></div></div>`;
  if (typeof Chart === 'undefined') return;
  const bulan = [...new Set(ks.map(k => k.tgl.slice(0, 7)))].sort();
  const hitung = (b, fn) => ks.filter(k => k.tgl.startsWith(b) && fn(App.hitungStatus(k))).length;
  App.charts ||= {};
  App.charts.tren?.destroy();
  const css = getComputedStyle(document.documentElement);
  Chart.defaults.color = css.getPropertyValue('--mu').trim() || '#666';
  App.charts.tren = new Chart($('#chart-tren'), {
    type: 'bar',
    data: {
      labels: bulan.map(b => NAMA_BULAN[+b.slice(5) - 1] + ' ' + b.slice(0, 4)),
      datasets: [
        { label: 'Selesai', data: bulan.map(b => hitung(b, s => s === 'Completed')), backgroundColor: '#6fae8f', borderRadius: 4 },
        { label: 'Terjadwal', data: bulan.map(b => hitung(b, s => s === 'Scheduled' || s === 'Today')), backgroundColor: '#7fb7c4', borderRadius: 4 },
        { label: 'Terlambat', data: bulan.map(b => hitung(b, s => s === 'Overdue')), backgroundColor: '#d27a73', borderRadius: 4 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { position: 'bottom' } } }
  });
};
const updLaporanAsli = App.updLaporan;
App.updLaporan = () => { updLaporanAsli(); renderLaporanExtra(); };

// 6. Jadwal otomatis untuk wisma yang belum punya jadwal aktif
const p2 = n => String(n).padStart(2, '0');
const isoLokal = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const lewatiAkhirPekan = d => { while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return d; };
// Murni (mudah dites): kembalikan daftar {kode, iso}. Wisma paling prioritas dapat tanggal paling awal.
App.rencanaJadwal = (daftar, mulai, maks) => {
  const beban = {};
  return daftar.map(w => {
    const d = lewatiAkhirPekan(new Date(mulai + 'T00:00:00'));
    while ((beban[w.pic + '|' + isoLokal(d)] || 0) >= maks) { d.setDate(d.getDate() + 1); lewatiAkhirPekan(d); }
    const iso = isoLokal(d);
    beban[w.pic + '|' + iso] = (beban[w.pic + '|' + iso] || 0) + 1;
    return { kode: w.kode, iso };
  });
};
App.act.jadwalOtomatis = () => {
  const target = App.hitungPrioritas().map(x => x.w).filter(w => w.pic && w.pic !== '-' && !App.db.kunjungan.some(k => k.kode === w.kode && !k.batal && !k.real));
  if (!target.length) return App.toast('Semua wisma sudah punya jadwal aktif.', 'info');
  const besok = new Date(App.today + 'T00:00:00'); besok.setDate(besok.getDate() + 1);
  const box = document.createElement('div');
  box.innerHTML = `<p class="mu">${target.length} wisma belum punya jadwal aktif. Yang paling prioritas dijadwalkan lebih awal, hanya di hari kerja.</p><div class="g2">` +
    App.buatField('mulai', 'Mulai tanggal', isoLokal(besok), { req: true, type: 'date' }) +
    App.buatField('maks', 'Maks kunjungan per PIC per hari', '3', { req: true, type: 'number' }) + '</div>';
  App.modal(`Jadwal otomatis (${target.length} wisma)`, box, d => {
    const maks = parseInt(d.maks, 10);
    if (!d.mulai) return { mulai: 'Pilih tanggal mulai.' };
    if (!(maks >= 1 && maks <= 20)) return { maks: 'Isi angka 1 sampai 20.' };
    App.rencanaJadwal(target, d.mulai, maks).forEach(r => {
      App.db.kunjungan.push({ id: App.nextVid(), kode: r.kode, tgl: r.iso, tujuan: 'Pemeliharaan Rutin', prioritas: 'Normal', real: '', catatan: 'Dijadwalkan otomatis' });
    });
    App.log('Jadwal Otomatis', `${target.length} jadwal dibuat`);
    App.save(); App.toast(`${target.length} jadwal kunjungan dibuat.`); App.refresh();
  }, { ok: 'Buat Jadwal', w: true });
};

// 7. Cetak lembar QR (semua wisma, atau yang dicentang) untuk ditempel di lokasi
App.act.cetakQr = () => {
  if (typeof QRCode === 'undefined') return App.toast('Library QR gagal dimuat. Cek internet.', 'error');
  const sel = App.G.w?.s.sel;
  const daftar = sel?.size ? App.db.wisma.filter(w => sel.has(w.id)) : App.db.wisma;
  if (!daftar.length) return App.toast('Belum ada wisma.', 'info');
  const lembar = document.createElement('div');
  lembar.id = 'cetak-qr';
  daftar.forEach(w => {
    const kartu = document.createElement('div');
    kartu.className = 'kartu-qr';
    kartu.innerHTML = `<div class="qr"></div><b>${esc(w.nama)}</b><span>${esc(w.kode)}</span>`;
    lembar.appendChild(kartu);
    new QRCode(kartu.querySelector('.qr'), { text: location.origin + location.pathname + '#scan/' + w.kode, width: 150, height: 150 });
  });
  document.body.appendChild(lembar);
  document.body.classList.add('cetak-qr');
  const bersih = () => { lembar.remove(); document.body.classList.remove('cetak-qr'); removeEventListener('afterprint', bersih); };
  addEventListener('afterprint', bersih);
  setTimeout(() => print(), 300);
};

// ===== Perbaikan tampilan: palet warna dan filter Wisma =====
App.act.setPalet = el => {
  App.db.cfg.palet = el.dataset.p;
  App.save();
  App.toast('Palet warna diganti.');
  App.refresh();
};
App.act.resetFilterW = () => {
  const s = App.G.w.s;
  s.q = ''; s.f = {}; s.p = 1;
  App.refresh();
};
const wismaInitAsli = App.views.wisma.init;
App.views.wisma.init = a => {
  const pilih = $('select[data-f="pic"][data-g="w"]');
  if (pilih) daftarPic().forEach(p => { const o = document.createElement('option'); o.value = o.textContent = p; pilih.appendChild(o); });
  wismaInitAsli?.(a);
};
