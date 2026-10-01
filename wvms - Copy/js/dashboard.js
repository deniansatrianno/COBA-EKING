'use strict';

App.views.dashboard = () => {
  // Ambil template HTML dashboard yang disiapkan di template-container
  const templateDashboard = $('#tmpl-page-dashboard');
  const frag = templateDashboard ? templateDashboard.content.cloneNode(true) : document.createDocumentFragment();

  // 1. Pasang Page Header
  const headerElem = App.buatPageHeader('Dashboard', 'Ringkasan data wisma dan jadwal kunjungan');
  frag.querySelector('#dashboard-header-slot')?.replaceWith(headerElem);

  // 2. Hitung Statistik Ringkasan
  const daftarKunjungan = App.db.kunjungan;
  const hitungJumlahByStatus = status => daftarKunjungan.filter(item => App.hitungStatus(item) == status).length;

  frag.querySelector('#dash-total-wisma').textContent = App.db.wisma.length;
  frag.querySelector('#dash-today').textContent = hitungJumlahByStatus('Today');
  frag.querySelector('#dash-scheduled').textContent = hitungJumlahByStatus('Scheduled');
  frag.querySelector('#dash-completed').textContent = hitungJumlahByStatus('Completed');
  frag.querySelector('#dash-overdue').textContent = hitungJumlahByStatus('Overdue');

  // 3. Render Tabel Kunjungan Terbaru (Completed/Overdue)
  const kunjunganTerbaru = daftarKunjungan
    .filter(item => ['Completed', 'Overdue'].includes(App.hitungStatus(item)))
    .sort((a, b) => a.tgl < b.tgl ? 1 : -1)
    .slice(0, 5);

  const tbodyTerbaru = frag.querySelector('#dash-recent-table');
  if (tbodyTerbaru) {
    if (!kunjunganTerbaru.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="5"><div class="empty">Belum ada data.</div></td>';
      tbodyTerbaru.appendChild(tr);
    } else {
      kunjunganTerbaru.forEach(kunjunganItem => {
        tbodyTerbaru.appendChild(App.buatBarisTabelDashboard(kunjunganItem));
      });
    }
  }

  // 4. Render Tabel Kunjungan Mendatang (Today/Scheduled)
  const kunjunganMendatang = daftarKunjungan
    .filter(item => ['Today', 'Scheduled'].includes(App.hitungStatus(item)))
    .sort((a, b) => a.tgl > b.tgl ? 1 : -1)
    .slice(0, 5);

  const tbodyMendatang = frag.querySelector('#dash-upcoming-table');
  if (tbodyMendatang) {
    if (!kunjunganMendatang.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="5"><div class="empty">Belum ada data.</div></td>';
      tbodyMendatang.appendChild(tr);
    } else {
      kunjunganMendatang.forEach(kunjunganItem => {
        tbodyMendatang.appendChild(App.buatBarisTabelDashboard(kunjunganItem));
      });
    }
  }

  return frag;
};

// Helper Pembuatan Baris Tabel Dashboard Menggunakan <template>
App.buatBarisTabelDashboard = kunjunganItem => {
  const fragment = App.cloneTemplate('tmpl-dashboard-row');
  const wisma = App.W(kunjunganItem.kode);  // App.W sudah aman untuk wisma dihapus

  fragment.querySelector('[data-element="tgl"]').textContent  = App.fmt(kunjunganItem.tgl);
  fragment.querySelector('[data-element="kode"]').textContent = wisma._rusak ? '-' : kunjunganItem.kode;

  const elNama = fragment.querySelector('[data-element="nama"]');
  elNama.textContent = wisma.nama;

  // Beri tampilan miring abu-abu jika wisma sudah dihapus
  if (wisma._hapus) {
    elNama.style.color     = 'var(--mu)';
    elNama.style.fontStyle = 'italic';
    elNama.title = 'Wisma sudah dihapus dari sistem (kode: ' + kunjunganItem.kode + ')';
  }

  const elPic = fragment.querySelector('[data-element="pic"]');
  elPic.textContent = wisma._hapus ? '-' : wisma.pic;

  const statusSlot = fragment.querySelector('[data-element="status"]');
  statusSlot.appendChild(App.buatBadgeElement(App.hitungStatus(kunjunganItem)));

  const btnDetail = fragment.querySelector('[data-element="btn-detail"]');
  btnDetail.dataset.id = kunjunganItem.id;

  return fragment;
};

// 5. Inisialisasi Chart saat halaman Dashboard selesai dirender
App.views.dashboard.init = () => {
  App.renderDashboardCharts();
};

// Instance Chart agar tidak duplicate canvas saat refresh view
App.charts = App.charts || {};

App.renderDashboardCharts = () => {
  const ctxStatus = $('#chart-status-kunjungan')?.getContext('2d');

  if (!ctxStatus || typeof Chart === 'undefined') return;
  const css = getComputedStyle(document.documentElement);
  Chart.defaults.color = css.getPropertyValue('--mu').trim() || '#666';

  // Hancurkan chart lama jika ada (biar tidak tumpang tindih)
  if (App.charts.status) App.charts.status.destroy();

  const daftarKunjungan = App.db.kunjungan || [];

  // --- DATA CHART 1: STATUS KUNJUNGAN ---
  const hitungStatus = (st) => daftarKunjungan.filter(k => App.hitungStatus(k) === st).length;
  const dataStatus = [
    hitungStatus('Today'),
    hitungStatus('Scheduled'),
    hitungStatus('Completed'),
    hitungStatus('Overdue')
  ];

  App.charts.status = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: ['Hari Ini', 'Terjadwal', 'Selesai', 'Terlambat'],
      datasets: [{
        data: dataStatus,
        backgroundColor: ['#5b8db8', '#7fb7c4', '#6fae8f', '#d27a73'],
        borderWidth: 2,
        borderColor: css.getPropertyValue('--sf').trim() || '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        // Tooltip menampilkan angka + persentase saat hover
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const val   = ctx.parsed;
              const pct   = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${val} (${pct}%)`;
            }
          }
        }
      }
    },
    // Plugin inline: tampilkan angka + persen langsung di atas tiap segmen
    plugins: [{
      id: 'doughnutLabel',
      afterDatasetsDraw(chart) {
        const { ctx, data } = chart;
        const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
        chart.getDatasetMeta(0).data.forEach((arc, i) => {
          const val = data.datasets[0].data[i];
          if (val === 0) return;
          const pct   = total > 0 ? ((val / total) * 100).toFixed(0) : 0;
          // Hitung posisi tengah segmen
          const angle  = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
          const radius = (arc.innerRadius + arc.outerRadius) / 2;
          const x = arc.x + Math.cos(angle) * radius;
          const y = arc.y + Math.sin(angle) * radius;

          ctx.save();
          ctx.fillStyle   = '#fff';
          ctx.font        = 'bold 11px Inter, sans-serif';
          ctx.textAlign   = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${val}`, x, y - 7);
          ctx.font  = '10px Inter, sans-serif';
          ctx.fillText(`${pct}%`, x, y + 7);
          ctx.restore();
        });
      }
    }]
  });

};
