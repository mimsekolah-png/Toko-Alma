import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Send, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Phone, 
  CheckCircle2, 
  Banknote, 
  DollarSign, 
  AlertCircle, 
  X, 
  CreditCard,
  Download,
  Bluetooth,
  Printer,
  BookOpen,
  UserCheck,
  Receipt
} from 'lucide-react';
import { PaymentRecord, PiutangItem } from '../types';
import { formatRupiah, formatTanggalIndo, getTodayDateString } from '../utils/formatters';
import { calculateCustomerCycles, CustomerCycleResult, PastCycle } from '../utils/cycleCalculations';
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
import { NotaPelunasanModal, NotaPelunasanData } from './NotaPelunasanModal';
import { EditContactModal } from './EditContactModal';
import { InternalContactPickerModal } from './InternalContactPickerModal';

interface Menu2PiutangProps {
  piutangList: PiutangItem[];
  payments: PaymentRecord[];
  onAddPiutang: (item: Omit<PiutangItem, 'id' | 'createdAt'>) => void;
  onDeletePiutang: (id: string) => void;
  onAddPayment: (payment: Omit<PaymentRecord, 'id' | 'createdAt'>) => void;
  onDeletePayment: (paymentId: string) => void;
  onUpdateCustomerPhone?: (name: string, phone: string) => void;
}

export const Menu2Piutang: React.FC<Menu2PiutangProps> = ({
  piutangList,
  payments,
  onAddPiutang,
  onDeletePiutang,
  onAddPayment,
  onDeletePayment,
  onUpdateCustomerPhone,
}) => {
  // Add Debt Form state
  const [nama, setNama] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [nominal, setNominal] = useState('');
  const [tanggal, setTanggal] = useState(getTodayDateString());
  const [telepon, setTelepon] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  // Payment Modal State
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    customerName: string;
    phone: string;
    sisaTagihan: number;
    nominal: string;
    keterangan: string;
    tanggal: string;
    items?: Array<{ tanggal: string; keterangan: string; nominal: number }>;
    payments?: Array<{ tanggal: string; keterangan: string; nominal: number }>;
    totalBon?: number;
    totalBayar?: number;
  }>({
    isOpen: false,
    customerName: '',
    phone: '',
    sisaTagihan: 0,
    nominal: '',
    keterangan: '',
    tanggal: getTodayDateString(),
  });

  // Internal Contact Picker Modal State
  const [showInternalContactPicker, setShowInternalContactPicker] = useState<boolean>(false);

  // Nota Pelunasan Modal State
  const [notaPelunasanData, setNotaPelunasanData] = useState<NotaPelunasanData | null>(null);
  const [showNotaModal, setShowNotaModal] = useState<boolean>(false);

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

  // All customers grouped by cycle:
  // JIKA LUNAS, KETIKA DIINPUT DENGAN NAMA YANG SAMA DIHITUNG DARI NOL KEMBALI
  const allCustomerGroups: CustomerCycleResult[] = useMemo(() => {
    return calculateCustomerCycles(piutangList, payments);
  }, [piutangList, payments]);

  // Group by customer name for active list display
  const groupedCustomers = useMemo(() => {
    // Hanya tampilkan piutang aktif dengan sisa tagihan > 0
    let result = allCustomerGroups.filter((g) => g.sisaTagihan > 0);

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
  }, [allCustomerGroups, searchQuery]);

  // Total summary statistics: Hanya Sisa Piutang Aktif
  const summaryStats = useMemo(() => {
    const active = allCustomerGroups.filter((g) => g.sisaTagihan > 0);
    const sisaPiutang = active.reduce((acc, c) => acc + c.sisaTagihan, 0);
    return {
      sisaPiutang,
      activeCount: active.length,
    };
  }, [allCustomerGroups]);

  // Unique customer names for autocomplete
  const existingCustomerNames = useMemo(() => {
    const names = new Set<string>();
    piutangList.forEach((p) => names.add(p.nama.trim()));
    payments.forEach((p) => names.add(p.nama.trim()));
    return Array.from(names);
  }, [piutangList, payments]);

  const toggleCustomerExpand = (customerName: string) => {
    setExpandedCustomers((prev) => ({
      ...prev,
      [customerName]: !prev[customerName],
    }));
  };

  const isPickerSupported = isContactPickerSupported();

  const handleNamaChange = (val: string) => {
    setNama(val);
    const existing = allCustomerGroups.find(
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

  const handleCreatePiutang = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNominal = parseInt(nominal.replace(/[^0-9]/g, ''), 10);
    if (!nama.trim() || !keterangan.trim() || isNaN(cleanNominal) || cleanNominal <= 0) {
      alert('Mohon lengkapi nama pelanggan, rincian barang/keterangan bon, dan nominal yang valid.');
      return;
    }

    const effectivePhone = telepon.trim() || getPhoneForName(nama.trim()) || undefined;
    if (telepon.trim()) {
      saveContactPhone(nama.trim(), telepon.trim());
      if (onUpdateCustomerPhone) {
        onUpdateCustomerPhone(nama.trim(), telepon.trim());
      }
    }

    onAddPiutang({
      nama: nama.trim(),
      keterangan: keterangan.trim(),
      nominal: cleanNominal,
      tanggal,
      status: 'belum_lunas',
      telepon: effectivePhone,
    });

    // Reset Form
    setKeterangan('');
    setNominal('');
  };

  const openPaymentModal = (customer: CustomerCycleResult) => {
    const customerPhone = customer.telepon || getPhoneForName(customer.nama) || '';
    const sisa = customer.sisaTagihan;
    setPaymentModal({
      isOpen: true,
      customerName: customer.nama,
      phone: customerPhone,
      sisaTagihan: sisa,
      nominal: sisa > 0 ? sisa.toString() : '',
      keterangan: 'Bayar tunai di kasir',
      tanggal: getTodayDateString(),
      items: customer.items.map((it) => ({
        tanggal: it.tanggal,
        keterangan: it.keterangan,
        nominal: it.nominal,
      })),
      payments: customer.payments.map((p) => ({
        tanggal: p.tanggal,
        keterangan: p.keterangan,
        nominal: p.nominal,
      })),
      totalBon: customer.totalBon,
      totalBayar: customer.totalDibayar,
    });
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = parseInt(paymentModal.nominal.replace(/[^0-9]/g, ''), 10);
    if (isNaN(cleanInput) || cleanInput <= 0) {
      alert('Masukkan nominal pembayaran yang valid.');
      return;
    }
    if (!paymentModal.keterangan.trim()) {
      alert('Mohon sertakan keterangan pembayaran (misal: "Bayar tunai di kasir" atau "Transfer BRI").');
      return;
    }

    const sisaSebelum = paymentModal.sisaTagihan;
    // Nominal yang dipotongkan ke hutang (maksimal sebesar sisa hutang yang ada)
    const nominalBayar = Math.min(cleanInput, sisaSebelum);
    // Jika uang yang dibayarkan lebih besar dari sisa hutang, sisanya adalah kembalian
    const kembalian = cleanInput > sisaSebelum ? cleanInput - sisaSebelum : 0;
    const sisaBaru = Math.max(0, sisaSebelum - cleanInput);
    const isLunas = sisaBaru === 0;

    onAddPayment({
      nama: paymentModal.customerName,
      nominal: nominalBayar,
      keterangan: paymentModal.keterangan.trim(),
      tanggal: paymentModal.tanggal,
    });

    setPaymentModal((prev) => ({ ...prev, isOpen: false }));

    // Tampilkan Nota Pelunasan / Pembayaran langsung seketika DISERTAI RINCIAN TRANSAKSI
    setNotaPelunasanData({
      customerName: paymentModal.customerName,
      phone: paymentModal.phone || getPhoneForName(paymentModal.customerName),
      tanggal: paymentModal.tanggal,
      keterangan: paymentModal.keterangan.trim(),
      sisaSebelum,
      nominalBayar,
      uangDiterima: cleanInput,
      kembalian,
      sisaBaru,
      isLunas,
      items: paymentModal.items || [],
      payments: paymentModal.payments || [],
      totalBon: paymentModal.totalBon || 0,
      totalDibayarSebelumnya: paymentModal.totalBayar || 0,
    });
    setShowNotaModal(true);
  };

  // Buka Nota Bukti Pembayaran dari Riwayat Pembayaran Masuk
  const handleViewPaymentReceipt = (customer: CustomerCycleResult, pay: PaymentRecord) => {
    const customerPhone = customer.telepon || getPhoneForName(customer.nama) || '';
    setNotaPelunasanData({
      customerName: customer.nama,
      phone: customerPhone,
      tanggal: pay.tanggal,
      keterangan: pay.keterangan,
      sisaSebelum: customer.sisaTagihan + pay.nominal,
      nominalBayar: pay.nominal,
      uangDiterima: pay.nominal,
      kembalian: 0,
      sisaBaru: customer.sisaTagihan,
      isLunas: customer.sisaTagihan === 0,
      items: customer.items.map((it) => ({
        tanggal: it.tanggal,
        keterangan: it.keterangan,
        nominal: it.nominal,
      })),
      payments: customer.payments.filter((p) => p.id !== pay.id).map((p) => ({
        tanggal: p.tanggal,
        keterangan: p.keterangan,
        nominal: p.nominal,
      })),
      totalBon: customer.totalBon,
      totalDibayarSebelumnya: customer.totalDibayar - pay.nominal,
    });
    setShowNotaModal(true);
  };

  // Buka Nota Bukti Pelunasan Lengkap dari Siklus Lunas Terdahulu
  const handleViewPastCycleReceipt = (customer: CustomerCycleResult, cycle: PastCycle<PiutangItem>) => {
    const customerPhone = customer.telepon || getPhoneForName(customer.nama) || '';
    const lastPayment = cycle.payments[cycle.payments.length - 1];
    setNotaPelunasanData({
      customerName: customer.nama,
      phone: customerPhone,
      tanggal: cycle.completedAt,
      keterangan: lastPayment ? lastPayment.keterangan : 'Pelunasan piutang (Lunas)',
      sisaSebelum: cycle.totalItem,
      nominalBayar: cycle.totalPayment,
      uangDiterima: cycle.totalPayment,
      kembalian: 0,
      sisaBaru: 0,
      isLunas: true,
      items: cycle.items.map((it) => ({
        tanggal: it.tanggal,
        keterangan: it.keterangan,
        nominal: it.nominal,
      })),
      payments: cycle.payments.map((p) => ({
        tanggal: p.tanggal,
        keterangan: p.keterangan,
        nominal: p.nominal,
      })),
      totalBon: cycle.totalItem,
      totalDibayarSebelumnya: cycle.totalPayment,
    });
    setShowNotaModal(true);
  };

  const openShareModal = (customer: CustomerCycleResult) => {
    const customerPhone = customer.telepon || getPhoneForName(customer.nama) || '';
    setShareModalData({
      isOpen: true,
      name: customer.nama,
      items: customer.items.map((it) => ({
        tanggal: it.tanggal,
        keterangan: it.keterangan,
        nominal: it.nominal,
      })),
      payments: customer.payments.map((p) => ({
        tanggal: p.tanggal,
        keterangan: p.keterangan,
        nominal: p.nominal,
      })),
      total: customer.totalBon,
      sisa: customer.sisaTagihan,
      phone: customerPhone,
    });
  };

  const [btModalData, setBtModalData] = useState<{
    isOpen: boolean;
    data: ReceiptData | null;
  }>({ isOpen: false, data: null });

  const openBluetoothModal = (customer: CustomerCycleResult) => {
    const customerPhone = customer.telepon || getPhoneForName(customer.nama) || '';
    setBtModalData({
      isOpen: true,
      data: {
        type: 'piutang',
        name: customer.nama,
        phone: customerPhone,
        dateStr: formatTanggalIndo(getTodayDateString()),
        items: customer.items.map((it) => ({
          tanggal: it.tanggal,
          keterangan: it.keterangan,
          nominal: it.nominal,
        })),
        payments: customer.payments.map((p) => ({
          tanggal: p.tanggal,
          keterangan: p.keterangan,
          nominal: p.nominal,
        })),
        total: customer.totalBon,
        totalBayar: customer.totalDibayar,
        sisa: customer.sisaTagihan,
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
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span>Buku Piutang & Pembayaran Pelanggan</span>
            </h2>
            <p className="text-xs text-slate-500">
              Pencatatan bon belanja, pembayaran/cicilan bertanda keterangan, dan rekap otomatis per nama.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-download-buku-piutang"
              onClick={() => setShowDownloadModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title="Download Buku Piutang (Excel/CSV & Cetak PDF)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Buku Piutang</span>
            </button>

            <button
              id="btn-toggle-tambah-piutang"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Tutup Form Bon' : '+ Catat Bon Piutang'}</span>
            </button>
          </div>
        </div>

        {/* Metric Summary: Hanya Sisa Piutang Aktif */}
        <div className="mt-3 bg-blue-50/70 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-700 block">Sisa Piutang Aktif</span>
              <span className="text-xs text-slate-500 font-medium">
                Kewajiban bon piutang pelanggan yang belum lunas
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold inline-block mb-0.5">
              {summaryStats.activeCount} Orang
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-blue-800">
              {formatRupiah(summaryStats.sisaPiutang)}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: ADD FORM (COLLAPSIBLE) */}
      {showAddForm && (
        <form onSubmit={handleCreatePiutang} className="bg-white rounded-xl border border-blue-200 p-4 shadow-xs">
          <div className="text-xs font-bold text-blue-700 mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Form Input Bon Piutang Baru</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Nama Pelanggan *
              </label>
              <input
                id="input-piutang-nama"
                type="text"
                list="customer-names-list"
                value={nama}
                onChange={(e) => handleNamaChange(e.target.value)}
                placeholder="Contoh: Bpk. Joko"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
              <datalist id="customer-names-list">
                {existingCustomerNames.map((name, i) => (
                  <option key={i} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Nominal Bon (Rp) *
              </label>
              <input
                id="input-piutang-nominal"
                type="text"
                inputMode="numeric"
                value={nominal ? parseInt(nominal.replace(/[^0-9]/g, ''), 10).toLocaleString('id-ID') : ''}
                onChange={(e) => setNominal(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Tanggal Bon
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                id="input-piutang-telepon"
                type="tel"
                inputMode="tel"
                value={telepon}
                onChange={(e) => setTelepon(e.target.value.replace(/[^0-9+]/g, ''))}
                placeholder="08123456789"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Rincian Barang / Keterangan Bon *
              </label>
              <input
                id="input-piutang-keterangan"
                type="text"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Contoh: Beras Ramos 5kg, Minyak 2L, Telur 1kg"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div className="flex items-end">
              <button
                id="btn-simpan-piutang"
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1.5 rounded-lg transition shadow-xs cursor-pointer"
              >
                Simpan Bon Piutang
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
              placeholder="Cari pelanggan piutang aktif..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <span className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold whitespace-nowrap">
            Piutang Aktif ({groupedCustomers.length})
          </span>
        </div>

        <span className="text-xs text-slate-400">
          Menampilkan <strong>{groupedCustomers.length}</strong> pelanggan aktif
        </span>
      </div>

      {/* SECTION 4: CUSTOMER CARDS DENGAN SISA PIUTANG AKTIF */}
      <div className="space-y-3">
        {groupedCustomers.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-semibold">Tidak ada sisa piutang aktif saat ini</p>
          </div>
        ) : (
          groupedCustomers.map((customer) => {
            const isExpanded = !!expandedCustomers[customer.nama];
            const customerPhone = customer.telepon || getPhoneForName(customer.nama) || '';

            return (
              <div
                key={customer.nama}
                className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition shadow-xs"
              >
                {/* Header Bar Customer */}
                <div className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs bg-blue-100 text-blue-700">
                      {customer.nama.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-800">{customer.nama}</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                          Piutang Aktif ({customer.items.length} Bon)
                        </span>
                        {customer.pastCycles && customer.pastCycles.length > 0 && (
                          <span 
                            className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold" 
                            title={`Pelanggan ini pernah melunasi piutang sebelumnya sebanyak ${customer.pastCycles.length} kali.`}
                          >
                            ✓ {customer.pastCycles.length}x Lunas Sebelumnya
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
                        <span>Terkini: {formatTanggalIndo(customer.latestDate)}</span>
                        {customerPhone ? (
                          <button
                            type="button"
                            onClick={() => openEditContact(customer.nama, customerPhone)}
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md cursor-pointer transition border border-emerald-200/60"
                            title="Nomor WhatsApp terhubung. Klik untuk mengubah."
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{customerPhone}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditContact(customer.nama, '')}
                            className="inline-flex items-center gap-1 font-semibold text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md cursor-pointer transition border border-blue-200"
                            title="Hubungkan nomor WA pelanggan ini"
                          >
                            <Phone className="w-3 h-3 text-blue-500" />
                            <span>+ Lengkapi No WA</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown & Actions: HANYA MENAMPILKAN SISA PIUTANG AKTIF */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-between md:justify-end">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Sisa Piutang Aktif
                      </div>
                      <div className="text-sm sm:text-base font-bold font-mono text-blue-700">
                        {formatRupiah(customer.sisaTagihan)}
                      </div>
                    </div>

                    {/* Action Buttons: FITUR BAYAR PER NAMA */}
                    <div className="flex items-center gap-1.5">
                      <button
                        id={`btn-bayar-piutang-${customer.nama.replace(/\s+/g, '-').toLowerCase()}`}
                        onClick={() => openPaymentModal(customer)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer shadow-xs"
                        title="Catat Pembayaran / Cicilan Piutang"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Bayar</span>
                      </button>

                      <button
                        onClick={() => openShareModal(customer)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer"
                        title="Kirim Rekap Tagihan ke WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">WA</span>
                      </button>

                      <button
                        id={`btn-print-bt-piutang-${customer.nama.replace(/\s+/g, '-').toLowerCase()}`}
                        onClick={() => openBluetoothModal(customer)}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer"
                        title="Print Nota Tagihan via Bluetooth Thermal"
                      >
                        <Bluetooth className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Print</span>
                      </button>

                      <button
                        onClick={() => toggleCustomerExpand(customer.nama)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        title="Lihat rincian bon dan pembayaran"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Bon Items + Payment History */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-3.5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Left: Daftar Bon Belanja */}
                      <div className="bg-white rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] font-bold text-slate-600 uppercase mb-2 flex items-center justify-between">
                          <span>Daftar Bon Belanja ({customer.items.length})</span>
                          <span className="font-mono text-slate-500 font-normal">
                            Total: {formatRupiah(customer.totalBon)}
                          </span>
                        </div>

                        {customer.items.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">Tidak ada rincian bon</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {customer.items.map((item) => (
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
                                    onClick={() => onDeletePiutang(item.id)}
                                    className="text-slate-300 hover:text-red-500 p-1 rounded transition cursor-pointer"
                                    title="Hapus bon ini"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Riwayat Pembayaran Masuk (Disertai Keterangan) */}
                      <div className="bg-white rounded-lg border border-emerald-200 p-3">
                        <div className="text-[11px] font-bold text-emerald-700 uppercase mb-2 flex items-center justify-between">
                          <span>Riwayat Pembayaran Diterima ({customer.payments.length})</span>
                          <span className="font-mono text-emerald-700 font-normal">
                            Total: {formatRupiah(customer.totalDibayar)}
                          </span>
                        </div>

                        {customer.payments.length === 0 ? (
                          <div className="p-3 text-center text-slate-400 text-xs">
                            <p>Belum ada pembayaran dicatat.</p>
                            <button
                              onClick={() => openPaymentModal(customer)}
                              className="mt-1 text-[11px] text-emerald-600 font-bold underline cursor-pointer"
                            >
                              + Catat Pembayaran Sekarang
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {customer.payments.map((pay) => (
                              <div
                                key={pay.id}
                                className="flex items-center justify-between p-1.5 rounded bg-emerald-50/50 text-xs border border-emerald-100"
                              >
                                <div>
                                  <div className="font-medium text-emerald-900 flex items-center gap-1.5">
                                    <span>{pay.keterangan}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">{pay.tanggal}</div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-emerald-700">
                                    - {formatRupiah(pay.nominal)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleViewPaymentReceipt(customer, pay)}
                                    className="px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-[10px] font-semibold flex items-center gap-0.5 transition cursor-pointer"
                                    title="Lihat & Cetak Nota Pembayaran Ini Beserta Rincian Transaksi"
                                  >
                                    <Receipt className="w-3 h-3" />
                                    <span>Nota</span>
                                  </button>
                                  <button
                                    onClick={() => onDeletePayment(pay.id)}
                                    className="text-slate-300 hover:text-red-500 p-1 rounded transition cursor-pointer"
                                    title="Hapus pembayaran ini"
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

                    {/* Riwayat Siklus Lunas Sebelumnya */}
                    {customer.pastCycles && customer.pastCycles.length > 0 && (
                      <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs">
                        <div className="font-bold text-slate-700 flex items-center justify-between mb-2">
                          <span className="flex items-center gap-1.5 text-[11px] uppercase font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Riwayat Siklus Lunas Sebelumnya ({customer.pastCycles.length} Kali)
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Setiap lunas, tagihan baru dihitung mulai dari 0 kembali
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {customer.pastCycles.map((cycle) => (
                            <div 
                              key={cycle.cycleNumber} 
                              className="bg-emerald-50/50 p-2 rounded border border-emerald-100 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-slate-800">Siklus #{cycle.cycleNumber}</span>
                                <span className="text-[10px] text-slate-400 ml-2">
                                  Lunas pada: {formatTanggalIndo(cycle.completedAt)} ({cycle.items.length} Bon)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="font-mono text-emerald-700 font-bold text-xs">
                                  Total: {formatRupiah(cycle.totalItem)} (LUNAS)
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleViewPastCycleReceipt(customer, cycle)}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                  title="Lihat & Cetak Bukti Pelunasan Lengkap Siklus Ini Beserta Rincian Bon"
                                >
                                  <Receipt className="w-3 h-3" />
                                  <span>Nota Lunas</span>
                                </button>
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

      {/* MODAL BAYAR PIUTANG DISERTAI KETERANGAN PER NAMA */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-emerald-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold">Catat Pembayaran Piutang</h3>
                  <p className="text-[11px] opacity-80">Pelanggan: {paymentModal.customerName}</p>
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
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Sisa Tagihan Saat Ini</span>
                  <div className="text-base font-bold font-mono text-slate-800">
                    {formatRupiah(paymentModal.sisaTagihan)}
                  </div>
                </div>
                {paymentModal.sisaTagihan > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentModal((p) => ({
                        ...p,
                        nominal: p.sisaTagihan.toString(),
                      }))
                    }
                    className="text-[11px] text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded font-bold cursor-pointer transition"
                  >
                    Bayar Lunas (Uang Pas)
                  </button>
                )}
              </div>

              {/* Single Nominal Input - Cukup satu saja biar tidak error */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nominal Pembayaran / Uang Diterima (Rp) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={paymentModal.nominal ? parseInt(paymentModal.nominal.replace(/[^0-9]/g, ''), 10).toLocaleString('id-ID') : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setPaymentModal((p) => ({ 
                      ...p, 
                      nominal: raw
                    }));
                  }}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

                {/* Real-time Kembalian & Status Display */}
                {(() => {
                  const inputVal = parseInt(paymentModal.nominal.replace(/[^0-9]/g, ''), 10) || 0;
                  const sisaSebelum = paymentModal.sisaTagihan;
                  if (inputVal <= 0) return null;

                  if (inputVal > sisaSebelum) {
                    const kembalian = inputVal - sisaSebelum;
                    return (
                      <div className="mt-2 bg-emerald-50 border border-emerald-300 rounded-lg p-2.5 flex items-center justify-between animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <div>
                            <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                              Status: LUNAS (Bayar Lebih)
                            </span>
                            <span className="text-[11px] text-emerald-600">
                              Bon lunas Rp {sisaSebelum.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-emerald-700 block font-semibold">Kembalian:</span>
                          <span className="text-sm font-bold font-mono text-emerald-700">
                            {formatRupiah(kembalian)}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  if (inputVal === sisaSebelum) {
                    return (
                      <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs font-semibold text-blue-700 flex items-center gap-1.5 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span>Status: LUNAS (Uang Pas {formatRupiah(sisaSebelum)})</span>
                      </div>
                    );
                  }

                  return (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs font-semibold text-amber-800 flex items-center justify-between animate-in fade-in">
                      <span>Status: Bayar Sebagian (Cicil)</span>
                      <span>Sisa tagihan baru: {formatRupiah(sisaSebelum - inputVal)}</span>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan Pembayaran * (Disertai Keterangan Per Nama)
                </label>
                <input
                  type="text"
                  value={paymentModal.keterangan}
                  onChange={(e) => setPaymentModal((p) => ({ ...p, keterangan: e.target.value }))}
                  placeholder="Contoh: Bayar tunai kasir / Transfer BRI / Cicil beras"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tanggal Pembayaran
                </label>
                <input
                  type="date"
                  value={paymentModal.tanggal}
                  onChange={(e) => setPaymentModal((p) => ({ ...p, tanggal: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  id="btn-submit-pembayaran-piutang"
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Simpan & Buka Nota</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NOTA PELUNASAN / PEMBAYARAN MODAL (MUNCUL OTOMATIS) */}
      {notaPelunasanData && (
        <NotaPelunasanModal
          isOpen={showNotaModal}
          onClose={() => setShowNotaModal(false)}
          data={notaPelunasanData}
        />
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
        title="Rekap Piutang & Pembayaran"
        type="piutang"
        name={shareModalData.name}
        items={shareModalData.items}
        payments={shareModalData.payments}
        total={shareModalData.total}
        sisa={shareModalData.sisa}
        initialPhone={shareModalData.phone}
      />

      {/* DOWNLOAD BUKU PIUTANG MODAL */}
      <DownloadLedgerModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        type="piutang"
        piutangData={allCustomerGroups}
      />

      {/* BLUETOOTH THERMAL PRINT MODAL */}
      {btModalData.isOpen && (
        <BluetoothPrintModal
          isOpen={btModalData.isOpen}
          onClose={() => setBtModalData((prev) => ({ ...prev, isOpen: false }))}
          data={btModalData.data}
          receiptData={btModalData.data}
        />
      )}

      {/* INTERNAL CONTACT PICKER MODAL */}
      <InternalContactPickerModal
        isOpen={showInternalContactPicker}
        onClose={() => setShowInternalContactPicker(false)}
        targetName={nama}
        existingCustomers={allCustomerGroups.map((c) => ({ nama: c.nama, telepon: c.telepon }))}
        onSelectContact={(c) => {
          applyPickedContact(c.name, c.phone);
        }}
      />
    </div>
  );
};
