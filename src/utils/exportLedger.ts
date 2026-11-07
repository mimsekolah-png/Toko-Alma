import { PiutangItem, TitipanItem, PaymentRecord } from '../types';
import { formatRupiah, formatTanggalIndo, getTodayDateString } from './formatters';

export interface GroupedCustomerData {
  nama: string;
  telepon?: string;
  totalBon: number;
  totalDibayar: number;
  sisaTagihan: number;
  items: PiutangItem[];
  payments: PaymentRecord[];
}

export interface GroupedPenitipData {
  nama: string;
  telepon?: string;
  totalAwal: number;
  totalDiambil: number;
  sisaSaldo: number;
  items: TitipanItem[];
  payments: PaymentRecord[];
}

// Escape string for CSV format
function escapeCSV(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// ==========================================
// 1. EXPORT BUKU PIUTANG TO CSV (EXCEL)
// ==========================================
export function exportPiutangCSV(
  customers: GroupedCustomerData[],
  filterType: 'aktif' | 'semua' = 'aktif'
): void {
  const dateStr = getTodayDateString();
  const dateFormatted = formatTanggalIndo(dateStr);
  
  const filtered = filterType === 'aktif' 
    ? customers.filter((c) => c.sisaTagihan > 0)
    : customers;

  const totalBon = filtered.reduce((s, c) => s + c.totalBon, 0);
  const totalDibayar = filtered.reduce((s, c) => s + c.totalDibayar, 0);
  const totalSisa = filtered.reduce((s, c) => s + c.sisaTagihan, 0);

  const lines: string[] = [];

  // Metadata Header
  lines.push('BUKU CATATAN PIUTANG - TOKO ALMA');
  lines.push(`Tanggal Laporan: ${dateFormatted}`);
  lines.push(`Filter: ${filterType === 'aktif' ? 'Hanya Piutang Aktif (Belum Lunas)' : 'Semua Riwayat Piutang'}`);
  lines.push(`Total Pelanggan: ${filtered.length} Orang`);
  lines.push(`Total Sisa Piutang: ${formatRupiah(totalSisa)}`);
  lines.push('');

  // Section 1: Ringkasan Per Pelanggan
  lines.push('--- RINGKASAN PIUTANG PER PELANGGAN ---');
  lines.push([
    'No',
    'Nama Pelanggan',
    'No. Telepon/WA',
    'Total Bon (Rp)',
    'Total Dibayar (Rp)',
    'Sisa Tagihan (Rp)',
    'Status Tagihan'
  ].map(escapeCSV).join(','));

  filtered.forEach((c, idx) => {
    lines.push([
      idx + 1,
      c.nama,
      c.telepon || '-',
      c.totalBon,
      c.totalDibayar,
      c.sisaTagihan,
      c.sisaTagihan > 0 ? 'Belum Lunas (Aktif)' : 'Lunas'
    ].map(escapeCSV).join(','));
  });

  lines.push([
    'TOTAL',
    '',
    '',
    totalBon,
    totalDibayar,
    totalSisa,
    ''
  ].map(escapeCSV).join(','));

  lines.push('');
  lines.push('');

  // Section 2: Rincian Bon dan Pembayaran per Pelanggan
  lines.push('--- RINCIAN TRANSAKSI BON & PEMBAYARAN CICILAN ---');
  lines.push([
    'No',
    'Nama Pelanggan',
    'Tanggal Transaksi',
    'Jenis Transaksi',
    'Rincian / Keterangan',
    'Nominal (Rp)'
  ].map(escapeCSV).join(','));

  let detailCounter = 1;
  filtered.forEach((c) => {
    // Bon items
    c.items.forEach((it) => {
      lines.push([
        detailCounter++,
        c.nama,
        it.tanggal,
        'Bon Piutang Belanja',
        it.keterangan || '-',
        it.nominal
      ].map(escapeCSV).join(','));
    });

    // Payments
    c.payments.forEach((p) => {
      lines.push([
        detailCounter++,
        c.nama,
        p.tanggal,
        'Pembayaran / Cicilan',
        p.keterangan || 'Pembayaran tunai',
        p.nominal
      ].map(escapeCSV).join(','));
    });
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Buku-Piutang-Toko-Alma-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// 2. PRINT / PDF BUKU PIUTANG
// ==========================================
export function printPiutangPDF(
  customers: GroupedCustomerData[],
  filterType: 'aktif' | 'semua' = 'aktif'
): void {
  const dateStr = getTodayDateString();
  const dateFormatted = formatTanggalIndo(dateStr);
  
  const filtered = filterType === 'aktif' 
    ? customers.filter((c) => c.sisaTagihan > 0)
    : customers;

  const totalBon = filtered.reduce((s, c) => s + c.totalBon, 0);
  const totalDibayar = filtered.reduce((s, c) => s + c.totalDibayar, 0);
  const totalSisa = filtered.reduce((s, c) => s + c.sisaTagihan, 0);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak buku piutang.');
    return;
  }

  const tableRowsHtml = filtered.map((c, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td><strong>${c.nama}</strong><br/><span style="color: #64748b; font-size: 10px;">${c.telepon || '-'}</span></td>
      <td style="text-align: right; font-family: monospace;">${formatRupiah(c.totalBon)}</td>
      <td style="text-align: right; font-family: monospace; color: #059669;">${formatRupiah(c.totalDibayar)}</td>
      <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${c.sisaTagihan > 0 ? '#1e40af' : '#16a34a'};">
        ${formatRupiah(c.sisaTagihan)}
      </td>
      <td style="text-align: center;">
        <span style="font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: ${c.sisaTagihan > 0 ? '#eff6ff; color: #1d4ed8' : '#f0fdf4; color: #15803d'};">
          ${c.sisaTagihan > 0 ? 'Belum Lunas' : 'Lunas'}
        </span>
      </td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Buku Catatan Piutang - Toko Alma</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 15px; }
          .kop { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
          .kop h1 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }
          .kop h2 { margin: 4px 0 0; font-size: 12px; font-weight: normal; color: #475569; }
          .info-box { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; }
          .summary-card { text-align: right; }
          .summary-card .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .summary-card .value { font-size: 16px; font-weight: bold; color: #1d4ed8; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10.5px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
          th { background-color: #f1f5f9; text-transform: uppercase; font-size: 9.5px; font-weight: bold; }
          tfoot td { background-color: #f8fafc; font-weight: bold; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
          .sig-box { text-align: center; width: 180px; }
          .sig-line { margin-top: 50px; border-bottom: 1px solid #000; font-weight: bold; }
          .btn-print { margin-bottom: 15px; padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: right; margin-bottom: 10px;">
          <button class="btn-print" onclick="window.print()">Cetak / Simpan Sebagai PDF</button>
        </div>
        <div class="kop">
          <h1>E-JURNAL TOKO ALMA</h1>
          <h2>Laporan Rekapitulasi Buku Piutang Pelanggan</h2>
        </div>

        <div class="info-box">
          <div>
            <div><strong>Tanggal Cetak:</strong> ${dateFormatted}</div>
            <div><strong>Cakupan Data:</strong> ${filterType === 'aktif' ? 'Hanya Piutang Aktif' : 'Semua Catatan'} (${filtered.length} Pelanggan)</div>
          </div>
          <div class="summary-card">
            <div class="label">Total Sisa Piutang Aktif</div>
            <div class="value">${formatRupiah(totalSisa)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">No</th>
              <th>Nama Pelanggan</th>
              <th style="width: 100px; text-align: right;">Total Bon</th>
              <th style="width: 100px; text-align: right;">Total Bayar</th>
              <th style="width: 110px; text-align: right;">Sisa Piutang</th>
              <th style="width: 80px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 15px;">Tidak ada data piutang</td></tr>'}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="text-align: right;">TOTAL:</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(totalBon)}</td>
              <td style="text-align: right; font-family: monospace; color: #059669;">${formatRupiah(totalDibayar)}</td>
              <td style="text-align: right; font-family: monospace; color: #1d4ed8;">${formatRupiah(totalSisa)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div>Dibuat Oleh,</div>
            <div class="sig-line">Kasir Toko Alma</div>
          </div>
          <div class="sig-box">
            <div>Mengetahui,</div>
            <div class="sig-line">Pemilik Toko Alma</div>
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// ==========================================
// 3. EXPORT BUKU TITIPAN TO CSV (EXCEL)
// ==========================================
export function exportTitipanCSV(
  depositors: GroupedPenitipData[],
  filterType: 'aktif' | 'semua' = 'aktif'
): void {
  const dateStr = getTodayDateString();
  const dateFormatted = formatTanggalIndo(dateStr);
  
  const filtered = filterType === 'aktif' 
    ? depositors.filter((d) => d.sisaSaldo > 0)
    : depositors;

  const totalAwal = filtered.reduce((s, d) => s + d.totalAwal, 0);
  const totalDiambil = filtered.reduce((s, d) => s + d.totalDiambil, 0);
  const totalSisa = filtered.reduce((s, d) => s + d.sisaSaldo, 0);

  const lines: string[] = [];

  // Metadata Header
  lines.push('BUKU CATATAN TITIPAN DANA & BARANG - TOKO ALMA');
  lines.push(`Tanggal Laporan: ${dateFormatted}`);
  lines.push(`Filter: ${filterType === 'aktif' ? 'Hanya Titipan Aktif' : 'Semua Riwayat Titipan'}`);
  lines.push(`Total Penitip: ${filtered.length} Orang`);
  lines.push(`Total Sisa Saldo Titipan: ${formatRupiah(totalSisa)}`);
  lines.push('');

  // Section 1: Ringkasan Per Penitip
  lines.push('--- RINGKASAN TITIPAN PER PENITIP ---');
  lines.push([
    'No',
    'Nama Penitip',
    'No. Telepon/WA',
    'Total Titipan Masuk (Rp)',
    'Total Diserahkan/Diambil (Rp)',
    'Sisa Saldo Titipan (Rp)',
    'Status'
  ].map(escapeCSV).join(','));

  filtered.forEach((d, idx) => {
    lines.push([
      idx + 1,
      d.nama,
      d.telepon || '-',
      d.totalAwal,
      d.totalDiambil,
      d.sisaSaldo,
      d.sisaSaldo > 0 ? 'Aktif Tersimpan' : 'Sudah Selesai/Diambil'
    ].map(escapeCSV).join(','));
  });

  lines.push([
    'TOTAL',
    '',
    '',
    totalAwal,
    totalDiambil,
    totalSisa,
    ''
  ].map(escapeCSV).join(','));

  lines.push('');
  lines.push('');

  // Section 2: Rincian Transaksi Titipan & Pengambilan
  lines.push('--- RINCIAN TRANSAKSI TITIPAN & PENGAMBILAN DANA ---');
  lines.push([
    'No',
    'Nama Penitip',
    'Tanggal Transaksi',
    'Jenis Transaksi',
    'Rincian / Keterangan',
    'Nominal (Rp)'
  ].map(escapeCSV).join(','));

  let detailCounter = 1;
  filtered.forEach((d) => {
    // Titipan items
    d.items.forEach((it) => {
      lines.push([
        detailCounter++,
        d.nama,
        it.tanggal,
        'Titipan Masuk',
        it.keterangan || '-',
        it.nominal
      ].map(escapeCSV).join(','));
    });

    // Payments/Payouts
    d.payments.forEach((p) => {
      lines.push([
        detailCounter++,
        d.nama,
        p.tanggal,
        'Diserahkan / Diambil',
        p.keterangan || 'Penyerahan saldo titipan',
        p.nominal
      ].map(escapeCSV).join(','));
    });
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Buku-Titipan-Toko-Alma-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// 4. PRINT / PDF BUKU TITIPAN
// ==========================================
export function printTitipanPDF(
  depositors: GroupedPenitipData[],
  filterType: 'aktif' | 'semua' = 'aktif'
): void {
  const dateStr = getTodayDateString();
  const dateFormatted = formatTanggalIndo(dateStr);
  
  const filtered = filterType === 'aktif' 
    ? depositors.filter((d) => d.sisaSaldo > 0)
    : depositors;

  const totalAwal = filtered.reduce((s, d) => s + d.totalAwal, 0);
  const totalDiambil = filtered.reduce((s, d) => s + d.totalDiambil, 0);
  const totalSisa = filtered.reduce((s, d) => s + d.sisaSaldo, 0);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up browser diblokir. Harap izinkan pop-up untuk mencetak buku titipan.');
    return;
  }

  const tableRowsHtml = filtered.map((d, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td><strong>${d.nama}</strong><br/><span style="color: #64748b; font-size: 10px;">${d.telepon || '-'}</span></td>
      <td style="text-align: right; font-family: monospace;">${formatRupiah(d.totalAwal)}</td>
      <td style="text-align: right; font-family: monospace; color: #2563eb;">${formatRupiah(d.totalDiambil)}</td>
      <td style="text-align: right; font-family: monospace; font-weight: bold; color: ${d.sisaSaldo > 0 ? '#c2410c' : '#16a34a'};">
        ${formatRupiah(d.sisaSaldo)}
      </td>
      <td style="text-align: center;">
        <span style="font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: ${d.sisaSaldo > 0 ? '#fff7ed; color: #c2410c' : '#f0fdf4; color: #15803d'};">
          ${d.sisaSaldo > 0 ? 'Aktif' : 'Selesai'}
        </span>
      </td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Buku Catatan Titipan - Toko Alma</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 15px; }
          .kop { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
          .kop h1 { margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }
          .kop h2 { margin: 4px 0 0; font-size: 12px; font-weight: normal; color: #475569; }
          .info-box { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #fff7ed; border: 1px solid #fed7aa; padding: 10px 14px; border-radius: 6px; }
          .summary-card { text-align: right; }
          .summary-card .label { font-size: 10px; text-transform: uppercase; color: #9a3412; font-weight: bold; }
          .summary-card .value { font-size: 16px; font-weight: bold; color: #c2410c; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10.5px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
          th { background-color: #f1f5f9; text-transform: uppercase; font-size: 9.5px; font-weight: bold; }
          tfoot td { background-color: #f8fafc; font-weight: bold; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
          .sig-box { text-align: center; width: 180px; }
          .sig-line { margin-top: 50px; border-bottom: 1px solid #000; font-weight: bold; }
          .btn-print { margin-bottom: 15px; padding: 8px 16px; background: #ea580c; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: right; margin-bottom: 10px;">
          <button class="btn-print" onclick="window.print()">Cetak / Simpan Sebagai PDF</button>
        </div>
        <div class="kop">
          <h1>E-JURNAL TOKO ALMA</h1>
          <h2>Laporan Rekapitulasi Buku Titipan Dana / Barang</h2>
        </div>

        <div class="info-box">
          <div>
            <div><strong>Tanggal Cetak:</strong> ${dateFormatted}</div>
            <div><strong>Cakupan Data:</strong> ${filterType === 'aktif' ? 'Hanya Titipan Aktif' : 'Semua Catatan'} (${filtered.length} Penitip)</div>
          </div>
          <div class="summary-card">
            <div class="label">Total Sisa Titipan di Kas</div>
            <div class="value">${formatRupiah(totalSisa)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">No</th>
              <th>Nama Penitip</th>
              <th style="width: 100px; text-align: right;">Total Titipan</th>
              <th style="width: 100px; text-align: right;">Total Diambil</th>
              <th style="width: 110px; text-align: right;">Sisa Saldo</th>
              <th style="width: 80px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml || '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 15px;">Tidak ada data titipan</td></tr>'}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="text-align: right;">TOTAL:</td>
              <td style="text-align: right; font-family: monospace;">${formatRupiah(totalAwal)}</td>
              <td style="text-align: right; font-family: monospace; color: #2563eb;">${formatRupiah(totalDiambil)}</td>
              <td style="text-align: right; font-family: monospace; color: #c2410c;">${formatRupiah(totalSisa)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div>Dibuat Oleh,</div>
            <div class="sig-line">Kasir Toko Alma</div>
          </div>
          <div class="sig-box">
            <div>Mengetahui,</div>
            <div class="sig-line">Pemilik Toko Alma</div>
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
}
