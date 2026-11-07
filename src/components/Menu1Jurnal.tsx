import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Save, 
  CheckCircle2, 
  ArrowRight,
  CalendarCheck,
  CreditCard,
  PiggyBank,
  Bluetooth,
  Printer
} from 'lucide-react';
import { DailyRecap, KasAccounts } from '../types';
import { formatRupiah, formatTanggalIndo, getTodayDateString } from '../utils/formatters';
import { getMonthlyBaselineKas, getTotalKasKemarin } from '../utils/cycleCalculations';
import { BluetoothPrintModal } from './BluetoothPrintModal';

interface Menu1JurnalProps {
  modalAwal: number;
  onSaveModalAwal: (newModal: number) => void;
  kas: KasAccounts;
  onUpdateKas: (kas: KasAccounts) => void;
  piutangTotal: number;
  piutangCount: number;
  titipanTotal: number;
  titipanCount: number;
  totalKasHarian: number;
  totalKasKemarin: number;
  labaHarian: number;
  labaBulanan: number;
  saldoAwalBulan?: number;
  rekapList?: DailyRecap[];
  onSaveDailyRecap: (recap: Omit<DailyRecap, 'id' | 'savedAt'>) => void;
  onNavigateToTab: (tab: 'piutang' | 'titipan' | 'rekap') => void;
  isTodaySaved: boolean;
}

export const Menu1Jurnal: React.FC<Menu1JurnalProps> = ({
  modalAwal,
  onSaveModalAwal,
  kas,
  onUpdateKas,
  piutangTotal,
  piutangCount,
  titipanTotal,
  titipanCount,
  totalKasHarian,
  totalKasKemarin,
  labaHarian,
  labaBulanan,
  saldoAwalBulan,
  rekapList = [],
  onSaveDailyRecap,
  onNavigateToTab,
  isTodaySaved,
}) => {
  // Modal awal editing state
  const [modalInput, setModalInput] = useState<string>(modalAwal.toString());
  const [modalSavedNotification, setModalSavedNotification] = useState<boolean>(false);

  // Date for saving journal
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);
  const [showBtModal, setShowBtModal] = useState<boolean>(false);

  // Sync modal input if modalAwal changes externally
  useEffect(() => {
    setModalInput(modalAwal.toString());
  }, [modalAwal]);

  // Total Kas Murni (BRI + BNI + FLIP + DANA + OD + EDC + CASH)
  const totalKasMurni = (kas.bri || 0) + (kas.bni || 0) + (kas.flip || 0) + 
                        (kas.dana || 0) + (kas.od || 0) + (kas.edc || 0) + (kas.cash || 0);

  const handleKasChange = (account: keyof KasAccounts, value: string) => {
    const numeric = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
    onUpdateKas({
      ...kas,
      [account]: numeric,
    });
  };

  const handleSaveModal = () => {
    const num = parseInt(modalInput.replace(/[^0-9]/g, ''), 10) || 0;
    onSaveModalAwal(num);
    setModalSavedNotification(true);
    setTimeout(() => setModalSavedNotification(false), 2500);
  };

  // Kas kemarin dan laba dinamis sesuai tanggal jurnal yang dipilih
  // "perhitungan laba setiap awal bulan kembali ke nol lagi, dan modal yang di hitung di laba adalah modal awal."
  const dynamicTotalKasKemarin = useMemo(() => {
    return getTotalKasKemarin(selectedDate, rekapList, modalAwal);
  }, [selectedDate, rekapList, modalAwal]);

  const dynamicLabaHarian = useMemo(() => {
    return totalKasHarian - dynamicTotalKasKemarin;
  }, [totalKasHarian, dynamicTotalKasKemarin]);

  const dynamicLabaBulanan = useMemo(() => {
    return totalKasHarian - modalAwal;
  }, [totalKasHarian, modalAwal]);

  const isAwalBulan = dynamicTotalKasKemarin === modalAwal;

  const handleSaveJournal = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveDailyRecap({
      tanggal: selectedDate,
      modalAwal,
      kas,
      totalKasMurni,
      piutangTotal,
      titipanTotal,
      totalKasHarian,
      totalKasKemarin: dynamicTotalKasKemarin,
      labaHarian: dynamicLabaHarian,
      labaBulanan: dynamicLabaBulanan,
      catatan: '',
    });
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 4000);
  };

  return (
    <div className="space-y-5">
      {/* SECTION 1: TOP HIGH DENSITY GRID (Modal Awal + Input Kas 2 Baris) */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        {/* Col 1: Modal Awal */}
        <div className="col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Modal Awal
              </label>
              {modalSavedNotification && (
                <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Tersimpan
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-700">Rp</span>
              <input
                id="input-modal-awal"
                type="text"
                inputMode="numeric"
                value={modalInput ? parseInt(modalInput, 10).toLocaleString('id-ID') : ''}
                onChange={(e) => setModalInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                className="w-full bg-slate-50 border-none rounded p-1 text-lg font-bold outline-blue-500 font-mono text-slate-800"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              id="btn-simpan-modal-awal"
              onClick={handleSaveModal}
              className="text-[10px] text-blue-600 font-bold hover:underline uppercase tracking-wider cursor-pointer"
            >
              SIMPAN MODAL
            </button>
            <span className="text-[10px] text-slate-400 font-mono">
              Aktif: {formatRupiah(modalAwal)}
            </span>
          </div>
        </div>

        {/* Col 2-4: Input Saldo Kas (2 Baris) */}
        <div className="col-span-1 md:col-span-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Input Saldo Kas (2 Baris)
            </label>
            <span className="text-[10px] font-mono text-slate-500">
              Subtotal Kas Murni: <strong className="text-slate-800 font-semibold">{formatRupiah(totalKasMurni)}</strong>
            </span>
          </div>

          {/* 2 ROWS GRID (BRI, BNI, FLIP, DANA / OD, EDC, CASH) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3">
            {/* BRI */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 focus-within:border-blue-500">
              <span className="text-[10px] font-bold w-10 text-blue-600">BRI</span>
              <input
                id="kas-bri"
                type="text"
                inputMode="numeric"
                value={kas.bri ? kas.bri.toLocaleString('id-ID') : ''}
                onChange={(e) => handleKasChange('bri', e.target.value)}
                placeholder="0"
                className="w-full text-xs font-medium font-mono text-slate-800 focus:outline-none bg-transparent"
              />
            </div>

            {/* BNI */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 focus-within:border-blue-600">
              <span className="text-[10px] font-bold w-10 text-blue-600">BNI</span>
              <input
                id="kas-bni"
                type="text"
                inputMode="numeric"
                value={kas.bni ? kas.bni.toLocaleString('id-ID') : ''}
                onChange={(e) => handleKasChange('bni', e.target.value)}
                placeholder="0"
                className="w-full text-xs font-medium font-mono text-slate-800 focus:outline-none bg-transparent"
              />
            </div>

            {/* FLIP */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 focus-within:border-blue-600">
              <span className="text-[10px] font-bold w-10 text-blue-600">FLIP</span>
              <input
                id="kas-flip"
                type="text"
                inputMode="numeric"
                value={kas.flip ? kas.flip.toLocaleString('id-ID') : ''}
                onChange={(e) => handleKasChange('flip', e.target.value)}
                placeholder="0"
                className="w-full text-xs font-medium font-mono text-slate-800 focus:outline-none bg-transparent"
              />
            </div>

            {/* DANA */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 focus-within:border-pink-600">
              <span className="text-[10px] font-bold w-10 text-pink-600">DANA</span>
              <input
                id="kas-dana"
                type="text"
                inputMode="numeric"
                value={kas.dana ? kas.dana.toLocaleString('id-ID') : ''}
                onChange={(e) => handleKasChange('dana', e.target.value)}
                placeholder="0"
                className="w-full text-xs font-medium font-mono text-slate-800 focus:outline-none bg-transparent"
              />
            </div>

            {/* OD */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 focus-within:border-slate-600">
              <span className="text-[10px] font-bold w-10 text-slate-600">OD</span>
              <input
                id="kas-od"
                type="text"
                inputMode="numeric"
                value={kas.od ? kas.od.toLocaleString('id-ID') : ''}
                onChange={(e) => handleKasChange('od', e.target.value)}
                placeholder="0"
                className="w-full text-xs font-medium font-mono text-slate-800 focus:outline-none bg-transparent"
              />
            </div>

            {/* EDC */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 focus-within:border-teal-600">
              <span className="text-[10px] font-bold w-10 text-teal-600">EDC</span>
              <input
                id="kas-edc"
                type="text"
                inputMode="numeric"
                value={kas.edc ? kas.edc.toLocaleString('id-ID') : ''}
                onChange={(e) => handleKasChange('edc', e.target.value)}
                placeholder="0"
                className="w-full text-xs font-medium font-mono text-slate-800 focus:outline-none bg-transparent"
              />
            </div>

            {/* CASH */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 focus-within:border-green-600">
              <span className="text-[10px] font-bold w-10 text-green-600">CASH</span>
              <input
                id="kas-cash"
                type="text"
                inputMode="numeric"
                value={kas.cash ? kas.cash.toLocaleString('id-ID') : ''}
                onChange={(e) => handleKasChange('cash', e.target.value)}
                placeholder="0"
                className="w-full text-xs font-medium font-mono text-slate-800 focus:outline-none bg-transparent"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: RINGKASAN OTOMATIS PIUTANG & TITIPAN (TANPA RINCIAN TABEL) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Kolom Piutang Otomatis dari Menu 2 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">
                Total Piutang (Otomatis Menu 2)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Sisa tagihan aktif: <span className="font-semibold text-slate-600">{piutangCount} pelanggan</span>
            </p>
          </div>

          <div className="text-right">
            <div className="text-lg font-bold font-mono text-blue-600">
              + {formatRupiah(piutangTotal)}
            </div>
            <button
              id="btn-link-ke-menu2"
              onClick={() => onNavigateToTab('piutang')}
              className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 ml-auto font-medium mt-0.5 cursor-pointer"
            >
              <span>Buka Menu 2</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Kolom Titipan Otomatis dari Menu 3 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <PiggyBank className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">
                Total Titipan (Otomatis Menu 3)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Saldo titipan aktif: <span className="font-semibold text-slate-600">{titipanCount} penitip</span>
            </p>
          </div>

          <div className="text-right">
            <div className="text-lg font-bold font-mono text-orange-600">
              - {formatRupiah(titipanTotal)}
            </div>
            <button
              id="btn-link-ke-menu3"
              onClick={() => onNavigateToTab('titipan')}
              className="text-[10px] text-orange-600 hover:underline flex items-center gap-1 ml-auto font-medium mt-0.5 cursor-pointer"
            >
              <span>Buka Menu 3</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: 3 BOTTOM SUMMARY CARDS IN EXACT HIGH DENSITY DESIGN */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        {/* Card 1: Total Kas Harian */}
        <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase opacity-80">Total Kas Harian</p>
            <p className="text-[10px] mb-1 italic opacity-60">(Kas + Piutang - Titipan)</p>
            <h3 className="text-2xl font-bold font-mono tracking-tight">{formatRupiah(totalKasHarian)}</h3>
          </div>
          <div className="mt-2 pt-2 border-t border-indigo-500/50 text-[10px] opacity-75 font-mono">
            = {formatRupiah(totalKasMurni)} + {formatRupiah(piutangTotal)} - {formatRupiah(titipanTotal)}
          </div>
        </div>

        {/* Card 2: Laba Harian */}
        <div className="bg-white border-2 border-emerald-500 p-4 rounded-xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-emerald-600">Laba Harian</p>
              {isAwalBulan && (
                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  Awal Bulan
                </span>
              )}
            </div>
            <p className="text-[10px] mb-1 italic text-slate-400">
              {isAwalBulan 
                ? `(Awal Bulan vs Modal: ${formatRupiah(modalAwal)})`
                : `(vs Kas Kemarin: ${formatRupiah(dynamicTotalKasKemarin)})`}
            </p>
            <h3 className={`text-2xl font-bold font-mono ${dynamicLabaHarian >= 0 ? 'text-slate-800' : 'text-red-500'}`}>
              {dynamicLabaHarian >= 0 ? '+' : ''}{formatRupiah(dynamicLabaHarian)}
            </h3>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
            {isAwalBulan 
              ? 'Awal bulan: Total Kas - Modal Awal (Reset ke 0)' 
              : 'Total Kas Hari Ini - Total Kas Kemarin'}
          </div>
        </div>

        {/* Card 3: Laba Bulanan */}
        <div className="bg-white border-2 border-blue-500 p-4 rounded-xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-blue-600">Laba Bulanan</p>
              <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                Acuan: Modal Awal
              </span>
            </div>
            <p className="text-[10px] mb-1 italic text-slate-400">
              (vs Modal Awal: {formatRupiah(modalAwal)})
            </p>
            <h3 className={`text-2xl font-bold font-mono ${dynamicLabaBulanan >= 0 ? 'text-slate-800 text-emerald-600' : 'text-red-500'}`}>
              {dynamicLabaBulanan >= 0 ? '+' : ''}{formatRupiah(dynamicLabaBulanan)}
            </h3>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
            Total Kas Hari Ini - Modal Awal (Reset setiap awal bulan)
          </div>
        </div>
      </section>

      {/* SECTION 4: SAVE JOURNAL FORM (High Density style) */}
      <form onSubmit={handleSaveJournal} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-blue-600" />
            <div>
              <span className="text-xs font-bold text-slate-800">Simpan Jurnal Hari Ini ke Menu 4</span>
              {isTodaySaved && (
                <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                  Sudah Tersimpan
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-slate-700 font-mono text-xs focus:outline-none"
              />
            </div>

            <button
              id="btn-print-struk-kas-bluetooth"
              type="button"
              onClick={() => setShowBtModal(true)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Cetak Struk Tutup Kas Harian via Bluetooth Thermal"
            >
              <Bluetooth className="w-3.5 h-3.5 text-blue-400" />
              <span>Print Struk Kas</span>
            </button>

            <button
              id="btn-simpan-rekap-harian"
              type="submit"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Rekap</span>
            </button>
          </div>
        </div>

        {saveSuccessNotice && (
          <div className="mt-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between">
            <span>Rekap harian tanggal <strong>{formatTanggalIndo(selectedDate)}</strong> berhasil disimpan!</span>
            <button
              type="button"
              onClick={() => onNavigateToTab('rekap')}
              className="font-bold underline text-emerald-900 ml-2 cursor-pointer"
            >
              Lihat di Menu 4 &rarr;
            </button>
          </div>
        )}
      </form>

      {/* Bluetooth Thermal Print Modal for Daily Kas Closing */}
      {showBtModal && (
        <BluetoothPrintModal
          isOpen={showBtModal}
          onClose={() => setShowBtModal(false)}
          data={{
            type: 'kas_harian',
            dateStr: formatTanggalIndo(selectedDate),
            kasBreakdown: {
              bri: kas.bri || 0,
              bni: kas.bni || 0,
              flip: kas.flip || 0,
              dana: kas.dana || 0,
              od: kas.od || 0,
              edc: kas.edc || 0,
              cash: kas.cash || 0,
            },
            totalKas: totalKasHarian,
            labaHarian: dynamicLabaHarian,
            labaBulanan: dynamicLabaBulanan,
          }}
        />
      )}
    </div>
  );
};
