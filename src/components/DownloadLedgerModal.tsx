import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Printer, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Users,
  CreditCard,
  Banknote
} from 'lucide-react';
import { 
  exportPiutangCSV, 
  printPiutangPDF, 
  exportTitipanCSV, 
  printTitipanPDF, 
  GroupedCustomerData, 
  GroupedPenitipData 
} from '../utils/exportLedger';
import { formatRupiah } from '../utils/formatters';

interface DownloadLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'piutang' | 'titipan';
  piutangData?: GroupedCustomerData[];
  titipanData?: GroupedPenitipData[];
}

export const DownloadLedgerModal: React.FC<DownloadLedgerModalProps> = ({
  isOpen,
  onClose,
  type,
  piutangData = [],
  titipanData = [],
}) => {
  const [filterType, setFilterType] = useState<'aktif' | 'semua'>('aktif');

  const isPiutang = type === 'piutang';

  // Calculate filtered counts and totals
  const stats = useMemo(() => {
    if (isPiutang) {
      const filtered = filterType === 'aktif'
        ? piutangData.filter((c) => c.sisaTagihan > 0)
        : piutangData;
      const totalSisa = filtered.reduce((s, c) => s + c.sisaTagihan, 0);
      return {
        count: filtered.length,
        totalSisa,
        previewItems: filtered.slice(0, 4),
      };
    } else {
      const filtered = filterType === 'aktif'
        ? titipanData.filter((d) => d.sisaSaldo > 0)
        : titipanData;
      const totalSisa = filtered.reduce((s, d) => s + d.sisaSaldo, 0);
      return {
        count: filtered.length,
        totalSisa,
        previewItems: filtered.slice(0, 4),
      };
    }
  }, [isPiutang, filterType, piutangData, titipanData]);

  if (!isOpen) return null;

  const handleDownloadCSV = () => {
    if (isPiutang) {
      exportPiutangCSV(piutangData, filterType);
    } else {
      exportTitipanCSV(titipanData, filterType);
    }
  };

  const handlePrintPDF = () => {
    if (isPiutang) {
      printPiutangPDF(piutangData, filterType);
    } else {
      printTitipanPDF(titipanData, filterType);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 flex items-start justify-between border-b ${
          isPiutang 
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100' 
            : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
              isPiutang ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'
            }`}>
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {isPiutang ? 'Download Buku Catatan Piutang' : 'Download Buku Catatan Titipan'}
              </h3>
              <p className="text-xs text-slate-500">
                Toko Alma • Ekspor dokumen pembukuan ke Excel atau cetak PDF
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/80 rounded-lg transition cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Summary Banner */}
          <div className={`rounded-xl p-3.5 border flex items-center justify-between ${
            isPiutang ? 'bg-blue-50/70 border-blue-200' : 'bg-orange-50/70 border-orange-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${isPiutang ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                {isPiutang ? <CreditCard className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                  {isPiutang ? 'Total Sisa Piutang Aktif' : 'Total Sisa Titipan di Kas'}
                </span>
                <span className="text-sm sm:text-base font-bold font-mono text-slate-900">
                  {formatRupiah(stats.totalSisa)}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isPiutang ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'
              }`}>
                <Users className="w-3 h-3" />
                {stats.count} {isPiutang ? 'Pelanggan' : 'Penitip'}
              </span>
            </div>
          </div>

          {/* Opsi Filter Cakupan Data */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Cakupan Data Yang Diunduh:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFilterType('aktif')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-center gap-2 ${
                  filterType === 'aktif'
                    ? isPiutang 
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold ring-1 ring-blue-600'
                      : 'border-orange-600 bg-orange-50/50 text-orange-900 font-bold ring-1 ring-orange-600'
                    : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-white'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  filterType === 'aktif' 
                    ? isPiutang ? 'border-blue-600 bg-blue-600 text-white' : 'border-orange-600 bg-orange-600 text-white'
                    : 'border-slate-300'
                }`}>
                  {filterType === 'aktif' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="leading-tight">Hanya Yang Aktif</div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    {isPiutang ? 'Belum lunas (ada sisa bon)' : 'Masih ada saldo tersimpan'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFilterType('semua')}
                className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-center gap-2 ${
                  filterType === 'semua'
                    ? isPiutang 
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold ring-1 ring-blue-600'
                      : 'border-orange-600 bg-orange-50/50 text-orange-900 font-bold ring-1 ring-orange-600'
                    : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-white'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  filterType === 'semua' 
                    ? isPiutang ? 'border-blue-600 bg-blue-600 text-white' : 'border-orange-600 bg-orange-600 text-white'
                    : 'border-slate-300'
                }`}>
                  {filterType === 'semua' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="leading-tight">Semua Riwayat</div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    Termasuk yang sudah lunas/selesai
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Download Action Cards */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Pilih Format Download:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: CSV / Excel */}
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-400 transition text-left cursor-pointer group shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Excel / CSV
                    </span>
                  </div>
                  <div className="text-xs font-bold text-emerald-950 group-hover:text-emerald-700">
                    Unduh File Spreadsheet
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Format file <strong>.csv</strong> lengkap dengan rekapitulasi per nama dan rincian transaksi belanja.
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between text-xs font-bold text-emerald-700">
                  <span>Download .CSV</span>
                  <Download className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                </div>
              </button>

              {/* Option 2: PDF / Print Document */}
              <button
                type="button"
                onClick={handlePrintPDF}
                className={`p-3.5 rounded-xl border transition text-left cursor-pointer group shadow-2xs flex flex-col justify-between ${
                  isPiutang 
                    ? 'border-blue-200 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-400' 
                    : 'border-orange-200 bg-orange-50/40 hover:bg-orange-50 hover:border-orange-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className={`w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold ${
                      isPiutang ? 'bg-blue-600' : 'bg-orange-600'
                    }`}>
                      <Printer className="w-4 h-4" />
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isPiutang ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      Cetak / PDF
                    </span>
                  </div>
                  <div className={`text-xs font-bold ${isPiutang ? 'text-blue-950 group-hover:text-blue-700' : 'text-orange-950 group-hover:text-orange-700'}`}>
                    Cetak / Simpan PDF
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Dokumen resmi dengan kop Toko Alma, tabel rapi bergaris, dan lembar tanda tangan.
                  </div>
                </div>

                <div className={`mt-3 pt-2.5 border-t flex items-center justify-between text-xs font-bold ${
                  isPiutang 
                    ? 'border-blue-200/60 text-blue-700' 
                    : 'border-orange-200/60 text-orange-700'
                }`}>
                  <span>Cetak Dokumen</span>
                  <FileText className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                </div>
              </button>
            </div>
          </div>

          {/* Quick Preview Table (if data exists) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-2">
              <span>Preview Ringkasan Buku ({stats.count} Data Terdata):</span>
              <span className="text-[10px] text-slate-400 font-normal">
                {stats.count > 4 ? `Menampilkan 4 dari ${stats.count}` : `Semua (${stats.count})`}
              </span>
            </div>

            {stats.count === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Belum ada data {isPiutang ? 'piutang' : 'titipan'} yang sesuai filter</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {stats.previewItems.map((item, idx) => {
                  const name = item.nama;
                  const sisa = isPiutang 
                    ? (item as GroupedCustomerData).sisaTagihan 
                    : (item as GroupedPenitipData).sisaSaldo;
                  const total = isPiutang 
                    ? (item as GroupedCustomerData).totalBon 
                    : (item as GroupedPenitipData).totalAwal;

                  return (
                    <div key={idx} className="bg-white border border-slate-200/80 rounded-lg p-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-center text-[10px] font-bold text-slate-400">{idx + 1}.</span>
                        <span className="font-semibold text-slate-800">{name}</span>
                        {item.telepon && (
                          <span className="text-[10px] text-slate-400">({item.telepon})</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-900">{formatRupiah(sisa)}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">
                          (Tot: {formatRupiah(total)})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            *File .csv dan tampilan PDF aman disimpan offline di perangkat Anda.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
