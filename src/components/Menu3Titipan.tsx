import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  Phone,
  CheckCircle2,
  Banknote,
  AlertCircle,
  X,
  PiggyBank,
  ArrowDownLeft,
  Download,
  Bluetooth,
  BookOpen,
  UserCheck
} from 'lucide-react';
import { PaymentRecord, TitipanItem } from '../types';
import { formatRupiah, formatTanggalIndo, getTodayDateString } from '../utils/formatters';
import { calculatePenitipCycles, PenitipCycleResult } from '../utils/cycleCalculations';
import { ShareModal } from './ShareModal';
import { DownloadLedgerModal } from './DownloadLedgerModal';
import { BluetoothPrintModal } from './BluetoothPrintModal';
import { ReceiptData } from '../utils/bluetoothPrinter';
import {
  getPhoneForName,
  saveContactPhone,
  pickContactFromDevice,
  isContactPickerSupported,
  isInsideIframe,
  formatPhoneNumber
} from '../utils/contacts';
import { EditContactModal } from './EditContactModal';
import { InternalContactPickerModal } from './InternalContactPickerModal';

interface Menu3TitipanProps {
  titipanList: TitipanItem[];
  payments: PaymentRecord[];
  onAddTitipan: (item: Omit<TitipanItem, 'id' | 'createdAt'>) => void;
  onDeleteTitipan: (id: string) => void;
  onAddPayment: (payment: Omit<PaymentRecord, 'id' | 'createdAt'>) => void;
  onDeletePayment: (paymentId: string) => void;
  onUpdateCustomerPhone?: (name: string, phone: string) => void;
}

export const Menu3Titipan: React.FC<Menu3TitipanProps> = ({
  titipanList,
  payments,
  onAddTitipan,
  onDeleteTitipan,
  onAddPayment,
  onDeletePayment,
  onUpdateCustomerPhone,
}) => {
  // Form input state
  const [nama, setNama] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [nominal, setNominal] = useState('');
  const [tanggal, setTanggal] = useState(getTodayDateString());
  const [telepon, setTelepon] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPenitip, setExpandedPenitip] = useState<Record<string, boolean>>({});
  const [showInternalContactPicker, setShowInternalContactPicker] = useState<boolean>(false);

  // Payment (Payout / Penyerahan Titipan) Modal State
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    penitipName: string;
    phone: string;
    sisaSaldo: number;
    nominal: string;
    keterangan: string;
    tanggal: string;
  }>({
    isOpen: false,
    penitipName: '',
    phone: '',
    sisaSaldo: 0,
    nominal: '',
    keterangan: '',
    tanggal: getTodayDateString(),
  });

  // Edit Contact Modal State
  const [contactModalData, setContactModalData] = useState<{
    isOpen: boolean;
    customerName: string;
    phone: string;
  }>({
    isOpen: false,
    customerName: '',
    phone: '',
  });

  // Share Modal State
  const [shareModalData, setShareModalData] = useState<{
    isOpen: boolean;
    name: string;
    items: Array<{ tanggal: string; keterangan: string; nominal: number }>;
    payments: Array<{ tanggal: string; keterangan: string; nominal: number }>;
    total: number;
    sisa: number;
    phone: string;
  }>({
    isOpen: false,
    name: '',
    items: [],
    payments: [],
    total: 0,
    sisa: 0,
    phone: '',
  });

  // All depositors grouped by cycle:
  // JIKA LUNAS / SELESAI DIAMBIL, KETIKA DIINPUT DENGAN NAMA YANG SAMA DIHITUNG DARI NOL KEMBALI
  const allPenitipGroups: PenitipCycleResult[] = useMemo(() => {
    return calculatePenitipCycles(titipanList, payments);
  }, [titipanList, payments]);

  // Group by depositor name for active list display
  const groupedPenitip = useMemo(() => {
    // Hanya tampilkan titipan aktif dengan sisa saldo > 0
    let result = allPenitipGroups.filter((g) => g.sisaSaldo > 0);

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.nama.toLowerCase().includes(q) ||
          c.items.some((it) => it.keterangan.toLowerCase().includes(q)) ||
          c.payments.some((p) => p.keterangan.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allPenitipGroups, searchQuery]);

  // Overall summary statistics: Hanya Sisa Titipan Aktif
  const summaryStats = useMemo(() => {
    const active = allPenitipGroups.filter((g) => g.sisaSaldo > 0);
    const sisaTitipan = active.reduce((acc, p) => acc + p.sisaSaldo, 0);
    return { sisaTitipan, activeCount: active.length };
  }, [allPenitipGroups]);

  // Unique names for autocomplete
  const existingNames = useMemo(() => {
    const names = new Set<string>();
    titipanList.forEach((t) => names.add(t.nama.trim()));
    payments.forEach((p) => names.add(p.nama.trim()));
    return Array.from(names);
  }, [titipanList, payments]);

  const togglePenitipExpand = (penitipName: string) => {
    setExpandedPenitip((prev) => ({
      ...prev,
      [penitipName]: !prev[penitipName],
    }));
  };

  const isPickerSupported = isContactPickerSupported();

  const handleNamaChange = (val: string) => {
    setNama(val);
    const existing = allPenitipGroups.find(
      (c) => c.nama.trim().toLowerCase() === val.trim().toLowerCase()
    );
    const matched = existing?.telepon || getPhoneForName(val);
    if (matched) {
      setTelepon(matched);
    }
  };

  const applyPickedContact = (contactName: string, phone: string) => {
    const cleanPhone = formatPhoneNumber(phone);
    if (!cleanPhone) return;
    setTelepon(cleanPhone);

    const effectiveName = nama.trim() ? nama.trim() : contactName.trim();
    if (!nama.trim() && contactName.trim()) {
      setNama(contactName.trim());
    }

    if (effectiveName) {
      saveContactPhone(effectiveName, cleanPhone);
      if (onUpdateCustomerPhone) {
        onUpdateCustomerPhone(effectiveName, cleanPhone);
      }
    }

    if (contactName.trim() && contactName.trim().toLowerCase() !== effectiveName.toLowerCase()) {
      saveContactPhone(contactName.trim(), cleanPhone);
    }
  };

  const handlePickContactFromDevice = async () => {
    if (isContactPickerSupported() && !isInsideIframe()) {
      try {
        const contact = await pickContactFromDevice();
        if (contact?.cancelled) {
          return;
        }
        if (contact?.phone) {
          if (contact.allPhones && contact.allPhones.length > 1) {
            setShowInternalContactPicker(true);
            return;
          }
          applyPickedContact(contact.name, contact.phone);
          return;
        }
      } catch (e) {
        console.warn('Native contact picker notice:', e);
      }
    }
    setShowInternalContactPicker(true);
  };

  const openEditContact = (customerName: string, currentPhone?: string) => {
    const effectivePhone = currentPhone || getPhoneForName(customerName) || '';
    setContactModalData({
      isOpen: true,
      customerName,
      phone: effectivePhone,
    });
  };

  const handleSaveContactModal = (customerName: string, newPhone: string) => {
    saveContactPhone(customerName, newPhone);
    if (onUpdateCustomerPhone) {
      onUpdateCustomerPhone(customerName, newPhone);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNominal = parseInt(nominal.replace(/[^0-9]/g, ''), 10);
    if (!nama.trim() || !keterangan.trim() || isNaN(cleanNominal) || cleanNominal <= 0) {
      alert('Mohon lengkapi nama penitip, rincian titipan, dan nominal yang valid.');
      return;
    }

    const effectivePhone = telepon.trim() || getPhoneForName(nama.trim()) || undefined;
    if (telepon.trim()) {
      saveContactPhone(nama.trim(), telepon.trim());
      if (onUpdateCustomerPhone) {
        onUpdateCustomerPhone(nama.trim(), telepon.trim());
      }
    }

    onAddTitipan({
      nama: nama.trim(),
      keterangan: keterangan.trim(),
      nominal: cleanNominal,
      tanggal,
      status: 'aktif',
      telepon: effectivePhone,
    });

    setKeterangan('');
    setNominal('');
  };

  const openPaymentModal = (penitip: PenitipCycleResult) => {
    const phone = penitip.telepon || getPhoneForName(penitip.nama) || '';
    setPaymentModal({
      isOpen: true,
      penitipName: penitip.nama,
      phone,
      sisaSaldo: penitip.sisaSaldo,
      nominal: penitip.sisaSaldo > 0 ? penitip.sisaSaldo.toString() : '',
      keterangan: 'Penyerahan / Pengambilan dana titipan',
      tanggal: getTodayDateString(),
    });
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNominal = parseInt(paymentModal.nominal.replace(/[^0-9]/g, ''), 10);
    if (isNaN(cleanNominal) || cleanNominal <= 0) {
      alert('Masukkan nominal penyerahan yang valid.');
      return;
    }
    if (!paymentModal.keterangan.trim()) {
      alert('Mohon sertakan keterangan penyerahan titipan (misal: "Diambil tunai untuk belanja" atau "Transfer BNI").');
      return;
    }

    onAddPayment({
      nama: paymentModal.penitipName,
      nominal: cleanNominal,
      keterangan: paymentModal.keterangan.trim(),
      tanggal: paymentModal.tanggal,
    });

    setPaymentModal((prev) => ({ ...prev, isOpen: false }));
  };

  const openShareModal = (penitip: PenitipCycleResult) => {
    const phone = penitip.telepon || getPhoneForName(penitip.nama) || '';
    setShareModalData({
      isOpen: true,
      name: penitip.nama,
      items: penitip.items.map((it) => ({
        tanggal: it.tanggal,
        keterangan: it.keterangan,
        nominal: it.nominal,
      })),
      payments: penitip.payments.map((p) => ({
        tanggal: p.tanggal,
        keterangan: p.keterangan,
        nominal: p.nominal,
      })),
      total: penitip.totalAwal,
      sisa: penitip.sisaSaldo,
      phone,
    });
  };

  const [btModalData, setBtModalData] = useState<{
    isOpen: boolean;
    data: ReceiptData | null;
  }>({ isOpen: false, data: null });

  const openBluetoothModal = (penitip: PenitipCycleResult) => {
    const phone = penitip.telepon || getPhoneForName(penitip.nama) || '';
    setBtModalData({
      isOpen: true,
      data: {
        type: 'titipan',
        name: penitip.nama,
        phone,
        dateStr: formatTanggalIndo(getTodayDateString()),
        items: penitip.items.map((it) => ({
          tanggal: it.tanggal,
          keterangan: it.keterangan,
          nominal: it.nominal,
        })),
        payments: penitip.payments.map((p) => ({
          tanggal: p.tanggal,
          keterangan: p.keterangan,
          nominal: p.nominal,
        })),
        total: penitip.totalAwal,
        totalBayar: penitip.totalDiambil,
        sisa: penitip.sisaSaldo,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* SECTION 1: HEADER & STATS SUMMARY (HIGH DENSITY) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-orange-600" />
              <span>Buku Titipan Dana / Barang</span>
            </h2>
            <p className="text-xs text-slate-500">
              Pencatatan titipan dana, penyerahan/pengambilan dana bertanda keterangan, dan rekap otomatis per nama.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-download-buku-titipan"
              onClick={() => setShowDownloadModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title="Download Buku Titipan (Excel/CSV & Cetak PDF)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Buku Titipan</span>
            </button>

            <button
              id="btn-toggle-tambah-titipan"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Tutup Form Titipan' : '+ Catat Titipan Baru'}</span>
            </button>
          </div>
        </div>

        {/* Metric Summary: Hanya Sisa Titipan Aktif */}
        <div className="mt-3 bg-orange-50/70 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold shrink-0">
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-orange-700 block">Sisa Titipan Aktif</span>
              <span className="text-xs text-slate-500 font-medium">
                Total saldo titipan dana yang masih tersimpan di kas toko
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] bg-orange-600 text-white px-2 py-0.5 rounded font-bold inline-block mb-0.5">
              {summaryStats.activeCount} Penitip
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-orange-900">
              {formatRupiah(summaryStats.sisaTitipan)}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: ADD FORM (COLLAPSIBLE) */}
      {showAddForm && (
        <form onSubmit={handleFormSubmit} className="bg-white rounded-xl border border-orange-200 p-4 shadow-xs">
          <div className="text-xs font-bold text-orange-700 mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Form Input Titipan Baru</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Nama Penitip *
              </label>
              <input
                id="input-titipan-nama"
                type="text"
                list="penitip-names-list"
                value={nama}
                onChange={(e) => handleNamaChange(e.target.value)}
                placeholder="Contoh: Bu Wahyu (Kue Basah)"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                required
              />
              <datalist id="penitip-names-list">
                {existingNames.map((name, i) => (
                  <option key={i} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Nominal Titipan (Rp) *
              </label>
              <input
                id="input-titipan-nominal"
                type="text"
                inputMode="numeric"
                value={nominal ? parseInt(nominal.replace(/[^0-9]/g, ''), 10).toLocaleString('id-ID') : ''}
                onChange={(e) => setNominal(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Tanggal Titipan
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  No. WhatsApp (Opsional)
                </label>
                <button
                  type="button"
                  onClick={handlePickContactFromDevice}
                  className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60"
                  title="Buka daftar kontak dari buku telepon internal HP"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Ambil Kontak HP</span>
                </button>
              </div>
              <input
                id="input-titipan-telepon"
                type="tel"
                inputMode="tel"
                value={telepon}
                onChange={(e) => setTelepon(e.target.value.replace(/[^0-9+]/g, ''))}
                placeholder="08123456789"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Keterangan Titipan *
              </label>
              <input
                id="input-titipan-keterangan"
                type="text"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Contoh: Hasil penjualan kue lemper & pastel sore"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                required
              />
            </div>

            <div className="flex items-end">
              <button
                id="btn-simpan-titipan"
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-1.5 rounded-lg transition shadow-xs cursor-pointer"
              >
                Simpan Titipan
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SECTION 3: SEARCH & FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari penitip aktif..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <span className="px-2.5 py-1 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold whitespace-nowrap">
            Titipan Aktif ({groupedPenitip.length})
          </span>
        </div>

        <span className="text-xs text-slate-400">
          Menampilkan <strong>{groupedPenitip.length}</strong> penitip aktif
        </span>
      </div>

      {/* SECTION 4: PENITIP CARDS DENGAN SISA TITIPAN AKTIF */}
      <div className="space-y-3">
        {groupedPenitip.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-semibold">Tidak ada saldo titipan aktif saat ini</p>
          </div>
        ) : (
          groupedPenitip.map((penitip) => {
            const isExpanded = !!expandedPenitip[penitip.nama];
            const penitipPhone = penitip.telepon || getPhoneForName(penitip.nama) || '';

            return (
              <div
                key={penitip.nama}
                className="bg-white rounded-xl border border-slate-200 hover:border-orange-300 transition shadow-xs"
              >
                {/* Header Bar Penitip */}
                <div className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs bg-orange-100 text-orange-700">
                      {penitip.nama.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-800">{penitip.nama}</span>
                        <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold">
                          Titipan Aktif ({penitip.items.length} Item)
                        </span>
                        {penitip.pastCycles && penitip.pastCycles.length > 0 && (
                          <span 
                            className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold"
                            title={`Penitip ini pernah menyelesaikan titipan sebelumnya sebanyak ${penitip.pastCycles.length} kali.`}
                          >
                            ✓ {penitip.pastCycles.length}x Selesai Sebelumnya
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
                        <span>Terkini: {formatTanggalIndo(penitip.latestDate)}</span>
                        {penitipPhone ? (
                          <button
                            type="button"
                            onClick={() => openEditContact(penitip.nama, penitipPhone)}
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md cursor-pointer transition border border-emerald-200/60"
                            title="Nomor WhatsApp terhubung. Klik untuk mengubah."
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{penitipPhone}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditContact(penitip.nama, '')}
                            className="inline-flex items-center gap-1 font-semibold text-[10px] text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-0.5 rounded-md cursor-pointer transition border border-orange-200"
                            title="Hubungkan nomor WA penitip ini"
                          >
                            <Phone className="w-3 h-3 text-orange-500" />
                            <span>+ Lengkapi No WA</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown & Actions: HANYA MENAMPILKAN SISA TITIPAN AKTIF */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-between md:justify-end">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Sisa Titipan Aktif
                      </div>
                      <div className="text-sm sm:text-base font-bold font-mono text-orange-700">
                        {formatRupiah(penitip.sisaSaldo)}
                      </div>
                    </div>

                    {/* Action Buttons: FITUR BAYAR / SERAHKAN TITIPAN */}
                    <div className="flex items-center gap-1.5">
                      <button
                        id={`btn-bayar-titipan-${penitip.nama.replace(/\s+/g, '-').toLowerCase()}`}
                        onClick={() => openPaymentModal(penitip)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer shadow-xs"
                        title="Bayar / Serahkan Dana Titipan ke Penitip"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Bayar/Ambil</span>
                      </button>

                      <button
                        onClick={() => openShareModal(penitip)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer"
                        title="Kirim Bukti Rekap Saldo Titipan ke WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5 text-orange-600" />
                        <span className="hidden sm:inline">WA</span>
                      </button>

                      <button
                        id={`btn-print-bt-titipan-${penitip.nama.replace(/\s+/g, '-').toLowerCase()}`}
                        onClick={() => openBluetoothModal(penitip)}
                        className="px-2.5 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer"
                        title="Print Bukti Titipan via Bluetooth Thermal"
                      >
                        <Bluetooth className="w-3.5 h-3.5 text-orange-600" />
                        <span className="hidden sm:inline">Print</span>
                      </button>

                      <button
                        onClick={() => togglePenitipExpand(penitip.nama)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        title="Lihat rincian titipan dan riwayat penyerahan"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Deposit Items + Payout History */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-3.5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Left: Daftar Titipan Masuk */}
                      <div className="bg-white rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] font-bold text-slate-600 uppercase mb-2 flex items-center justify-between">
                          <span>Daftar Titipan Masuk ({penitip.items.length})</span>
                          <span className="font-mono text-slate-500 font-normal">
                            Total: {formatRupiah(penitip.totalAwal)}
                          </span>
                        </div>

                        {penitip.items.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">Tidak ada rincian titipan</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {penitip.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-1.5 rounded bg-slate-50 text-xs border border-slate-100"
                              >
                                <div>
                                  <div className="font-medium text-slate-800">{item.keterangan}</div>
                                  <div className="text-[10px] text-slate-400">{item.tanggal}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold text-slate-700">
                                    {formatRupiah(item.nominal)}
                                  </span>
                                  <button
                                    onClick={() => onDeleteTitipan(item.id)}
                                    className="text-slate-300 hover:text-red-500 p-1 rounded transition cursor-pointer"
                                    title="Hapus titipan ini"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Riwayat Penyerahan/Pengambilan Dana (Disertai Keterangan) */}
                      <div className="bg-white rounded-lg border border-blue-200 p-3">
                        <div className="text-[11px] font-bold text-blue-700 uppercase mb-2 flex items-center justify-between">
                          <span>Riwayat Penyerahan / Diambil ({penitip.payments.length})</span>
                          <span className="font-mono text-blue-700 font-normal">
                            Total: {formatRupiah(penitip.totalDiambil)}
                          </span>
                        </div>

                        {penitip.payments.length === 0 ? (
                          <div className="p-3 text-center text-slate-400 text-xs">
                            <p>Belum ada dana yang diambil/diserahkan.</p>
                            <button
                              onClick={() => openPaymentModal(penitip)}
                              className="mt-1 text-[11px] text-blue-600 font-bold underline cursor-pointer"
                            >
                              + Serahkan Dana Titipan
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {penitip.payments.map((pay) => (
                              <div
                                key={pay.id}
                                className="flex items-center justify-between p-1.5 rounded bg-blue-50/50 text-xs border border-blue-100"
                              >
                                <div>
                                  <div className="font-medium text-blue-900 flex items-center gap-1.5">
                                    <span>{pay.keterangan}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">{pay.tanggal}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-blue-700">
                                    - {formatRupiah(pay.nominal)}
                                  </span>
                                  <button
                                    onClick={() => onDeletePayment(pay.id)}
                                    className="text-slate-300 hover:text-red-500 p-1 rounded transition cursor-pointer"
                                    title="Hapus penyerahan ini"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Riwayat Siklus Titipan Selesai Sebelumnya */}
                    {penitip.pastCycles && penitip.pastCycles.length > 0 && (
                      <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs">
                        <div className="font-bold text-slate-700 flex items-center justify-between mb-2">
                          <span className="flex items-center gap-1.5 text-[11px] uppercase font-bold text-blue-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            Riwayat Siklus Titipan Selesai ({penitip.pastCycles.length} Kali)
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Setiap selesai diambil penuh, titipan baru dihitung mulai dari 0 kembali
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {penitip.pastCycles.map((cycle) => (
                            <div 
                              key={cycle.cycleNumber} 
                              className="bg-blue-50/50 p-2 rounded border border-blue-100 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-slate-800">Siklus #{cycle.cycleNumber}</span>
                                <span className="text-[10px] text-slate-400 ml-2">
                                  Selesai diambil: {formatTanggalIndo(cycle.completedAt)} ({cycle.items.length} Titipan)
                                </span>
                              </div>
                              <div className="font-mono text-blue-700 font-bold text-xs">
                                Total: {formatRupiah(cycle.totalItem)} (SELESAI)
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL BAYAR / SERAHKAN TITIPAN DISERTAI KETERANGAN PER NAMA */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold">Bayar / Serahkan Dana Titipan</h3>
                  <p className="text-[11px] opacity-80">Penitip: {paymentModal.penitipName}</p>
                </div>
              </div>
              <button
                onClick={() => setPaymentModal((p) => ({ ...p, isOpen: false }))}
                className="text-white/80 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePayment} className="p-4 space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Sisa Saldo Titipan Saat Ini</span>
                  <div className="text-base font-bold font-mono text-slate-800">
                    {formatRupiah(paymentModal.sisaSaldo)}
                  </div>
                </div>
                {paymentModal.sisaSaldo > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentModal((p) => ({
                        ...p,
                        nominal: p.sisaSaldo.toString(),
                        keterangan: p.keterangan || 'Diambil semua / penyerahan lunas',
                      }))
                    }
                    className="text-[11px] text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded font-bold cursor-pointer transition"
                  >
                    Ambil Semua
                  </button>
                )}
              </div>

              {/* Single Nominal Input - Cukup satu saja biar tidak error */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nominal Yang Diserahkan/Diambil (Rp) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={paymentModal.nominal ? parseInt(paymentModal.nominal.replace(/[^0-9]/g, ''), 10).toLocaleString('id-ID') : ''}
                  onChange={(e) =>
                    setPaymentModal((p) => ({ ...p, nominal: e.target.value.replace(/[^0-9]/g, '') }))
                  }
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />

                {/* Quick nominal chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Cepat:</span>
                  {[20000, 50000, 100000, 200000].map((quickNominal) => (
                    <button
                      key={quickNominal}
                      type="button"
                      onClick={() => setPaymentModal((p) => ({ ...p, nominal: quickNominal.toString() }))}
                      className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-700 font-semibold cursor-pointer transition"
                    >
                      {quickNominal.toLocaleString('id-ID')}
                    </button>
                  ))}
                </div>

                {/* Live balance feedback */}
                {(() => {
                  const inputVal = parseInt(paymentModal.nominal.replace(/[^0-9]/g, ''), 10) || 0;
                  const sisa = paymentModal.sisaSaldo;
                  if (inputVal <= 0) return null;
                  const sisaBaru = sisa - inputVal;
                  if (sisaBaru <= 0) {
                    return (
                      <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs font-semibold text-blue-700 flex items-center gap-1.5 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span>Titipan lunas / diambil tuntas. Sisa saldo menjadi Rp 0.</span>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-700 flex items-center justify-between animate-in fade-in">
                      <span>Sisa saldo titipan baru:</span>
                      <span className="font-mono text-blue-700 font-bold">{formatRupiah(sisaBaru)}</span>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan Penyerahan * (Disertai Keterangan Per Nama)
                </label>
                <input
                  type="text"
                  value={paymentModal.keterangan}
                  onChange={(e) => setPaymentModal((p) => ({ ...p, keterangan: e.target.value }))}
                  placeholder="Contoh: Diambil tunai untuk belanja / Transfer BNI / Bagi hasil"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Penyerahan
                </label>
                <input
                  type="date"
                  value={paymentModal.tanggal}
                  onChange={(e) => setPaymentModal((p) => ({ ...p, tanggal: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModal((p) => ({ ...p, isOpen: false }))}
                  className="px-3 py-1.5 border border-slate-200 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  id="btn-submit-pembayaran-titipan"
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                >
                  Simpan Penyerahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / LENGKAPI KONTAK NO WA MODAL */}
      <EditContactModal
        isOpen={contactModalData.isOpen}
        onClose={() => setContactModalData((prev) => ({ ...prev, isOpen: false }))}
        customerName={contactModalData.customerName}
        initialPhone={contactModalData.phone}
        onSave={handleSaveContactModal}
      />

      {/* SHARE REKAP MODAL */}
      <ShareModal
        isOpen={shareModalData.isOpen}
        onClose={() => setShareModalData((prev) => ({ ...prev, isOpen: false }))}
        title="Rekap Titipan & Penyerahan Dana"
        type="titipan"
        name={shareModalData.name}
        items={shareModalData.items}
        payments={shareModalData.payments}
        total={shareModalData.total}
        sisa={shareModalData.sisa}
        initialPhone={shareModalData.phone}
      />

      {/* DOWNLOAD BUKU TITIPAN MODAL */}
      <DownloadLedgerModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        type="titipan"
        titipanData={allPenitipGroups}
      />

      {/* BLUETOOTH THERMAL PRINT MODAL */}
      {btModalData.isOpen && (
        <BluetoothPrintModal
          isOpen={btModalData.isOpen}
          onClose={() => setBtModalData((prev) => ({ ...prev, isOpen: false }))}
          data={btModalData.data}
        />
      )}

      {/* INTERNAL CONTACT PICKER MODAL */}
      <InternalContactPickerModal
        isOpen={showInternalContactPicker}
        onClose={() => setShowInternalContactPicker(false)}
        targetName={nama}
        existingCustomers={allPenitipGroups.map((p) => ({ nama: p.nama, telepon: p.telepon }))}
        onSelectContact={(c) => {
          applyPickedContact(c.name, c.phone);
        }}
      />
    </div>
  );
};
