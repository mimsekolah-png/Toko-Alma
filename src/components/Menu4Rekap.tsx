import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Download, 
  Trash2, 
  FileSpreadsheet, 
  Printer, 
  Eye, 
  ChevronRight, 
  X,
  Wallet,
  TrendingUp,
  Award,
  Sparkles,
  Calculator,
  Bluetooth
} from 'lucide-react';
import { DailyRecap } from '../types';
import { formatRupiah, formatTanggalIndo, getTodayDateString } from '../utils/formatters';
import { BluetoothPrintModal } from './BluetoothPrintModal';

interface Menu4RekapProps {
  rekapList: DailyRecap[];
  onDeleteRekap: (id: string) => void;
  modalAwal: number;
}

export const Menu4Rekap: React.FC<Menu4RekapProps> = ({
  rekapList,
  onDeleteRekap,
  modalAwal,
}) => {
  // Month selector (default: current month YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = getTodayDateString();
    return today.slice(0, 7); // e.g. "2026-09"
  });

  // Modal for detail inspection
  const [selectedDetail, setSelectedDetail] = useState<DailyRecap | null>(null);
  const [showBtModal, setShowBtModal] = useState<boolean>(false);

  // Filter records by selected month and sort ascending for tables/charts
  const monthlyRecords = useMemo(() => {
    const sorted = rekapList
      .filter((r) => r.tanggal.startsWith(selectedMonth))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    // Ketentuan: Setiap awal bulan perhitungan laba kembali ke nol lagi, dan modal yang dihitung di laba adalah modal awal
    return sorted.map((r, index) => {
      const modalRef = r.modalAwal !== undefined && r.modalAwal > 0 ? r.modalAwal : modalAwal;
      const totalKasKemarin = index === 0 
        ? modalRef // Awal bulan: acuan adalah modal awal
        : sorted[index - 1].totalKasHarian; // Hari berikutnya: kas hari sebelumnya di bulan ini
      
      const labaHarian = r.totalKasHarian - totalKasKemarin;
      const labaBulanan = r.totalKasHarian - modalRef;

      return {
        ...r,
        modalAwal: modalRef,
        totalKasKemarin,
        labaHarian,
        labaBulanan,
      };
    });
  }, [rekapList, selectedMonth, modalAwal]);

  // Available unique months from data
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const current = getTodayDateString().slice(0, 7);
    set.add(current);
    rekapList.forEach((r) => {
      if (r.tanggal && r.tanggal.length >= 7) {
        set.add(r.tanggal.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [rekapList]);

  // Compute key summary statistics
  const stats = useMemo(() => {
    if (monthlyRecords.length === 0) {
      return {
        count: 0,
        latestTotalKas: 0,
        latestLabaHarian: 0,
        totalLabaHarian: 0,
        latestLabaBulanan: 0,
        avgLabaHarian: 0,
        modalAwalRef: modalAwal,
      };
    }

    const latest = monthlyRecords[monthlyRecords.length - 1];
    const totalLaba = monthlyRecords.reduce((acc, curr) => acc + curr.labaHarian, 0);

    return {
      count: monthlyRecords.length,
      latestTotalKas: latest.totalKasHarian,
      latestLabaHarian: latest.labaHarian,
      totalLabaHarian: totalLaba,
      latestLabaBulanan: latest.labaBulanan,
      avgLabaHarian: Math.round(totalLaba / monthlyRecords.length),
      modalAwalRef: latest.modalAwal || modalAwal,
    };
  }, [monthlyRecords, modalAwal]);

  const formattedMonthName = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // Export to CSV: Focused on Kas Hari Ini & Laba
  const handleExportCSV = () => {
    if (monthlyRecords.length === 0) {
      alert('Tidak ada data rekap untuk bulan ini.');
      return;
    }

    const headers = [
      'No',
      'Tanggal',
      'Kas Hari Ini',
      'Laba Harian',
      'Laba Bulanan',
    ];

    const rows = monthlyRecords.map((r, idx) => [
      idx + 1,
      r.tanggal,
      r.totalKasHarian,
      r.labaHarian,
      r.labaBulanan,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap-Kas-Laba-Toko-Alma-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print Report: Focused on Kas Hari Ini & Laba
  const handlePrintMonthlyReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rekap Kas & Laba Toko Alma - ${formattedMonthName}</title>
          <style>
            body { font-family: sans-serif; font-size: 12px; padding: 25px; color: #1e293b; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { margin: 0 0 5px; font-size: 18px; color: #0f172a; }
            .header h2 { margin: 0; font-size: 13px; font-weight: normal; color: #475569; }
            .summary-box { display: flex; justify-content: space-around; margin-bottom: 20px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; background-color: #f8fafc; }
            .summary-item { text-align: center; }
            .summary-item .label { font-size: 10px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; font-weight: bold; }
            .summary-item .value { font-size: 14px; font-weight: bold; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; }
            th { background-color: #f1f5f9; color: #334155; font-weight: 600; text-align: center; }
            td.center { text-align: center; }
            td.right { text-align: right; font-family: monospace; }
            .positive { color: #059669; font-weight: bold; }
            .negative { color: #dc2626; font-weight: bold; }
            .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>E-JURNAL TOKO ALMA</h1>
            <h2>Laporan Rekapitulasi Kas & Laba: Periode ${formattedMonthName}</h2>
          </div>

          <div class="summary-box">
            <div class="summary-item">
              <div class="label">Kas Hari Ini</div>
              <div class="value">${formatRupiah(stats.latestTotalKas)}</div>
            </div>
            <div class="summary-item">
              <div class="label">Laba Harian</div>
              <div class="value ${stats.latestLabaHarian >= 0 ? 'positive' : 'negative'}">${stats.latestLabaHarian >= 0 ? '+' : ''}${formatRupiah(stats.latestLabaHarian)}</div>
            </div>
            <div class="summary-item">
              <div class="label">Laba Bulanan</div>
              <div class="value ${stats.latestLabaBulanan >= 0 ? 'positive' : 'negative'}">${stats.latestLabaBulanan >= 0 ? '+' : ''}${formatRupiah(stats.latestLabaBulanan)}</div>
            </div>
            <div class="summary-item">
              <div class="label">Rata-rata / Hari</div>
              <div class="value ${stats.avgLabaHarian >= 0 ? 'positive' : 'negative'}">${stats.avgLabaHarian >= 0 ? '+' : ''}${formatRupiah(stats.avgLabaHarian)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">No</th>
                <th style="width: 120px;">Tanggal</th>
                <th>Kas Hari Ini</th>
                <th>Laba Harian</th>
                <th>Laba Bulanan</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyRecords.map((r, i) => `
                <tr>
                  <td class="center">${i + 1}</td>
                  <td class="center font-bold">${r.tanggal}</td>
                  <td class="right" style="font-weight: bold;">${formatRupiah(r.totalKasHarian)}</td>
                  <td class="right ${r.labaHarian >= 0 ? 'positive' : 'negative'}">
                    ${r.labaHarian >= 0 ? '+' : ''}${formatRupiah(r.labaHarian)}
                  </td>
                  <td class="right ${r.labaBulanan >= 0 ? 'positive' : 'negative'}">
                    ${r.labaBulanan >= 0 ? '+' : ''}${formatRupiah(r.labaBulanan)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <div>Dicetak pada: ${new Date().toLocaleString('id-ID')}</div>
            <div>Penanggung Jawab Toko Alma</div>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Top Filter & Actions Bar (High Density) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <span>Rekapitulasi Kas & Laba</span>
            </h2>
            <p className="text-xs text-slate-500">
              Rekap historis yang menampilkan kas hari ini dan perolehan laba berkala.
            </p>
          </div>

          {/* Month Selector and Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                id="select-filter-bulan"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer text-xs"
              >
                {availableMonths.map((m) => {
                  const [y, mm] = m.split('-');
                  const label = new Date(parseInt(y, 10), parseInt(mm, 10) - 1, 1).toLocaleDateString('id-ID', {
                    month: 'long',
                    year: 'numeric',
                  });
                  return (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              id="btn-export-csv"
              onClick={handleExportCSV}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Download CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Ekspor CSV</span>
            </button>

            <button
              id="btn-print-laporan"
              onClick={handlePrintMonthlyReport}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Cetak Laporan"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cetak Rekap</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Focused Metric Columns: Satu Baris Saja Per Icon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Kas Hari Ini */}
        <div className="bg-white rounded-lg border border-slate-200 px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-tight truncate">Kas Hari Ini</span>
          </div>
          <span className="text-xs sm:text-sm font-bold font-mono text-indigo-700 whitespace-nowrap ml-2">
            {formatRupiah(stats.latestTotalKas)}
          </span>
        </div>

        {/* Laba Harian */}
        <div className="bg-white rounded-lg border border-slate-200 px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-tight truncate">Laba Harian</span>
          </div>
          <span className={`text-xs sm:text-sm font-bold font-mono whitespace-nowrap ml-2 ${stats.latestLabaHarian >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
            {stats.latestLabaHarian >= 0 ? '+' : ''}{formatRupiah(stats.latestLabaHarian)}
          </span>
        </div>

        {/* Laba Bulanan */}
        <div className="bg-white rounded-lg border border-slate-200 px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-tight truncate">Laba Bulanan</span>
          </div>
          <span className={`text-xs sm:text-sm font-bold font-mono whitespace-nowrap ml-2 ${stats.latestLabaBulanan >= 0 ? 'text-blue-700 font-bold' : 'text-rose-600'}`}>
            {stats.latestLabaBulanan >= 0 ? '+' : ''}{formatRupiah(stats.latestLabaBulanan)}
          </span>
        </div>

        {/* Rata-rata */}
        <div className="bg-white rounded-lg border border-slate-200 px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-tight truncate">Rata-rata</span>
          </div>
          <span className={`text-xs sm:text-sm font-bold font-mono whitespace-nowrap ml-2 ${stats.avgLabaHarian >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
            {stats.avgLabaHarian >= 0 ? '+' : ''}{formatRupiah(stats.avgLabaHarian)}
          </span>
        </div>
      </div>

      {/* MAIN TABLE: HANYA MEMUNCULKAN KAS HARI INI DAN LABA SAJA */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Tabel Rekapitulasi: Kas Hari Ini & Laba ({formattedMonthName})
            </h3>
            <p className="text-[11px] text-slate-500">
              Menampilkan {monthlyRecords.length} entri tanggal rekapitulasi harian
            </p>
          </div>
        </div>

        {monthlyRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold">Belum ada data rekap harian tersimpan untuk bulan ini</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Buka Menu 1 (Input Harian) lalu klik "Simpan Rekap" untuk menyimpan buku hari ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 w-12 text-center">No</th>
                  <th className="px-4 py-2.5">Tanggal</th>
                  <th className="px-5 py-2.5 text-right font-bold text-indigo-900 bg-indigo-50/50">Kas Hari Ini</th>
                  <th className="px-5 py-2.5 text-right font-bold text-emerald-800 bg-emerald-50/40">Laba Harian</th>
                  <th className="px-5 py-2.5 text-right font-bold text-blue-800 bg-blue-50/40">Laba Bulanan</th>
                  <th className="px-4 py-2.5 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyRecords.map((record, idx) => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition">
                    {/* No */}
                    <td className="px-4 py-3 text-center font-mono text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Tanggal */}
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      <div className="font-bold text-slate-800">{record.tanggal}</div>
                      <div className="text-[10px] text-slate-400">
                        {formatTanggalIndo(record.tanggal).split(',')[0]}
                      </div>
                    </td>

                    {/* KAS HARI INI */}
                    <td className="px-5 py-3 text-right font-mono font-bold text-indigo-700 whitespace-nowrap bg-indigo-50/20 text-sm">
                      {formatRupiah(record.totalKasHarian)}
                    </td>

                    {/* LABA HARIAN */}
                    <td className="px-5 py-3 text-right font-mono font-bold whitespace-nowrap bg-emerald-50/15">
                      <span className={record.labaHarian >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                        {record.labaHarian > 0 ? '+' : ''}{formatRupiah(record.labaHarian)}
                      </span>
                    </td>

                    {/* LABA BULANAN */}
                    <td className="px-5 py-3 text-right font-mono font-bold whitespace-nowrap bg-blue-50/15">
                      <span className={record.labaBulanan >= 0 ? 'text-blue-700 font-bold' : 'text-rose-600'}>
                        {record.labaBulanan > 0 ? '+' : ''}{formatRupiah(record.labaBulanan)}
                      </span>
                    </td>

                    {/* Aksi: Detail & Hapus */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedDetail(record)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                          title="Lihat Rincian Akun & Komponen"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus rekap harian tanggal ${record.tanggal}?`)) {
                              onDeleteRekap(record.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="Hapus Rekap Tanggal Ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL (Optional popup for user if they want to see breakdown of 6 Kas, Piutang, and Titipan for that day) */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Rincian Komponen Rekap Harian</h3>
                <p className="text-[11px] text-slate-400">{formatTanggalIndo(selectedDetail.tanggal)}</p>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Highlight Kas & Laba */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-lg">
                  <div className="text-[9px] uppercase font-bold text-indigo-700">Kas Hari Ini</div>
                  <div className="text-sm font-bold font-mono text-indigo-900 mt-0.5">
                    {formatRupiah(selectedDetail.totalKasHarian)}
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                  <div className="text-[9px] uppercase font-bold text-emerald-700">Laba Harian</div>
                  <div className={`text-sm font-bold font-mono mt-0.5 ${selectedDetail.labaHarian >= 0 ? 'text-emerald-900' : 'text-rose-600'}`}>
                    {selectedDetail.labaHarian >= 0 ? '+' : ''}{formatRupiah(selectedDetail.labaHarian)}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg">
                  <div className="text-[9px] uppercase font-bold text-blue-700">Laba Bulanan</div>
                  <div className={`text-sm font-bold font-mono mt-0.5 ${selectedDetail.labaBulanan >= 0 ? 'text-blue-900' : 'text-rose-600'}`}>
                    {selectedDetail.labaBulanan >= 0 ? '+' : ''}{formatRupiah(selectedDetail.labaBulanan)}
                  </div>
                </div>
              </div>

              {/* Rincian Kas Accounts */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Rincian Akun Kas:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-blue-600 block font-sans font-bold">BRI</span>
                    <span className="font-bold text-slate-800">{formatRupiah(selectedDetail.kas.bri)}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-blue-600 block font-sans font-bold">BNI</span>
                    <span className="font-bold text-slate-800">{formatRupiah(selectedDetail.kas.bni)}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-blue-600 block font-sans font-bold">FLIP</span>
                    <span className="font-bold text-slate-800">{formatRupiah(selectedDetail.kas.flip)}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-pink-600 block font-sans font-bold">DANA</span>
                    <span className="font-bold text-slate-800">{formatRupiah(selectedDetail.kas.dana)}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-600 block font-sans font-bold">OD</span>
                    <span className="font-bold text-slate-800">{formatRupiah(selectedDetail.kas.od)}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-teal-600 block font-sans font-bold">EDC</span>
                    <span className="font-bold text-slate-800">{formatRupiah(selectedDetail.kas.edc || 0)}</span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200 sm:col-span-2">
                    <span className="text-[10px] text-green-600 block font-sans font-bold">CASH</span>
                    <span className="font-bold text-slate-800">{formatRupiah(selectedDetail.kas.cash)}</span>
                  </div>
                </div>
              </div>

              {/* Piutang & Titipan Components */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-blue-50/70 border border-blue-200 p-2.5 rounded-lg flex items-center justify-between">
                  <span className="text-blue-800 font-medium">Piutang Tercatat (+)</span>
                  <span className="font-bold font-mono text-blue-700">
                    {formatRupiah(selectedDetail.piutangTotal)}
                  </span>
                </div>
                <div className="bg-orange-50/70 border border-orange-200 p-2.5 rounded-lg flex items-center justify-between">
                  <span className="text-orange-800 font-medium">Titipan Tercatat (-)</span>
                  <span className="font-bold font-mono text-orange-700">
                    {formatRupiah(selectedDetail.titipanTotal)}
                  </span>
                </div>
              </div>

              {/* Formula explanation */}
              <div className="bg-slate-100 p-2.5 rounded-lg text-[10px] text-slate-600 font-mono">
                Kas Hari Ini = {formatRupiah(selectedDetail.totalKasMurni)} (Kas Murni) + {formatRupiah(selectedDetail.piutangTotal)} (Piutang) - {formatRupiah(selectedDetail.titipanTotal)} (Titipan) = <strong>{formatRupiah(selectedDetail.totalKasHarian)}</strong>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-3 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setShowBtModal(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Cetak Struk Rekap Harian ini ke Printer Bluetooth Thermal"
              >
                <Bluetooth className="w-3.5 h-3.5" />
                <span>Print Struk Bluetooth</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bluetooth Thermal Print Modal */}
      {showBtModal && selectedDetail && (
        <BluetoothPrintModal
          isOpen={showBtModal}
          onClose={() => setShowBtModal(false)}
          data={{
            type: 'kas_harian',
            dateStr: formatTanggalIndo(selectedDetail.tanggal),
            kasBreakdown: {
              bri: selectedDetail.kas.bri || 0,
              bni: selectedDetail.kas.bni || 0,
              flip: selectedDetail.kas.flip || 0,
              dana: selectedDetail.kas.dana || 0,
              od: selectedDetail.kas.od || 0,
              edc: selectedDetail.kas.edc || 0,
              cash: selectedDetail.kas.cash || 0,
            },
            totalKas: selectedDetail.totalKasHarian,
            labaHarian: selectedDetail.labaHarian,
            labaBulanan: selectedDetail.labaBulanan,
          }}
        />
      )}
    </div>
  );
};
