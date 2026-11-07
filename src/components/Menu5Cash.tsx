import React, { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Trash2,
  Receipt,
  Search,
  Printer,
  Bluetooth,
  Clock,
  User,
  ShoppingBag,
  Calendar,
  Phone,
  Banknote,
  CheckCircle2,
  AlertCircle,
  X,
  Edit3,
  Save,
  RotateCcw
} from 'lucide-react';
import { CashTransaction, CashTransactionItem } from '../types';
import { formatRupiah, formatTanggalIndo, getTodayDateString } from '../utils/formatters';
import { NotaCashModal } from './NotaCashModal';
import { BluetoothPrintModal } from './BluetoothPrintModal';
import { printReceiptViaBrowser, ReceiptData } from '../utils/bluetoothPrinter';
import {
  getPhoneForName,
  saveContactPhone,
  isContactPickerSupported,
  pickContactFromDevice,
  isInsideIframe
} from '../utils/contacts';
import { InternalContactPickerModal } from './InternalContactPickerModal';

interface Menu5CashProps {
  transactions: CashTransaction[];
  onAddTransaction: (
    transaction: Omit<CashTransaction, 'id' | 'noNota' | 'createdAt'>
  ) => CashTransaction;
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction?: (transaction: CashTransaction) => void;
  onUpdateCustomerPhone?: (name: string, phone: string) => void;
}

export const Menu5Cash: React.FC<Menu5CashProps> = ({
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  onUpdateCustomerPhone,
}) => {
  const formRef = useRef<HTMLDivElement>(null);

  // Form State
  const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null);
  const [namaPelanggan, setNamaPelanggan] = useState<string>('Pelanggan Umum');
  const [telepon, setTelepon] = useState<string>('');
  const [tanggal, setTanggal] = useState<string>(getTodayDateString());
  const [keterangan, setKeterangan] = useState<string>('');
  const [statusBayar, setStatusBayar] = useState<'lunas' | 'belum_lunas'>('lunas');

  // Current Cart / Items in New Transaction
  const [cartItems, setCartItems] = useState<CashTransactionItem[]>([
    {
      id: '1',
      namaBarang: '',
      jumlah: 1,
      hargaSatuan: 0,
      subtotal: 0,
    },
  ]);

  // Payment calculator state (nominal uang diterima / DP)
  const [uangDiterimaInput, setUangDiterimaInput] = useState<string>('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'month' | 'all'>('today');
  const [filterStatus, setFilterStatus] = useState<'all' | 'belum_lunas' | 'lunas'>('all');

  // Modals state
  const [selectedTxForNota, setSelectedTxForNota] = useState<CashTransaction | null>(null);
  const [showNotaModal, setShowNotaModal] = useState<boolean>(false);
  const [showBtModal, setShowBtModal] = useState<boolean>(false);
  const [directBtReceiptData, setDirectBtReceiptData] = useState<ReceiptData | null>(null);
  const [showInternalContactPicker, setShowInternalContactPicker] = useState<boolean>(false);
  const [showDeleteConfirmId, setShowDeleteConfirmId] = useState<string | null>(null);

  // Pelunasan Modal state (untuk nota yang belum dibayar / bisa dibayar kapan saja)
  const [selectedTxForPelunasan, setSelectedTxForPelunasan] = useState<CashTransaction | null>(null);
  const [showPelunasanModal, setShowPelunasanModal] = useState<boolean>(false);
  const [uangPelunasanInput, setUangPelunasanInput] = useState<string>('');
  const [tanggalPelunasan, setTanggalPelunasan] = useState<string>(getTodayDateString());
  const [catatanPelunasan, setCatatanPelunasan] = useState<string>('');

  // Cart Calculations
  const totalBelanja = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const qty = item.jumlah > 0 ? item.jumlah : 1;
      const price = item.hargaSatuan || 0;
      return acc + (qty * price);
    }, 0);
  }, [cartItems]);

  const uangDiterimaNumber = useMemo(() => {
    const clean = uangDiterimaInput.replace(/[^0-9]/g, '');
    return clean ? Number(clean) : 0;
  }, [uangDiterimaInput]);

  const kembalian = useMemo(() => {
    if (uangDiterimaNumber <= 0 || uangDiterimaNumber < totalBelanja) return 0;
    return uangDiterimaNumber - totalBelanja;
  }, [uangDiterimaNumber, totalBelanja]);

  // Start Editing an existing transaction
  const handleStartEdit = (tx: CashTransaction) => {
    setEditingTransaction(tx);
    setNamaPelanggan(tx.namaPelanggan || 'Pelanggan Umum');
    setTelepon(tx.telepon || '');
    setTanggal(tx.tanggal || getTodayDateString());
    setKeterangan(tx.keterangan || '');
    setStatusBayar(tx.statusBayar || 'lunas');
    setUangDiterimaInput(
      tx.uangDiterima !== undefined && tx.uangDiterima > 0 ? tx.uangDiterima.toString() : ''
    );
    if (tx.items && tx.items.length > 0) {
      setCartItems(tx.items.map((it) => ({ ...it })));
    } else {
      setCartItems([
        {
          id: Date.now().toString(),
          namaBarang: '',
          jumlah: 1,
          hargaSatuan: 0,
          subtotal: 0,
        },
      ]);
    }
    // Smooth scroll to form
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Cancel edit mode and reset form to fresh receipt
  const handleCancelEdit = () => {
    setEditingTransaction(null);
    setNamaPelanggan('Pelanggan Umum');
    setTelepon('');
    setTanggal(getTodayDateString());
    setKeterangan('');
    setStatusBayar('lunas');
    setUangDiterimaInput('');
    setCartItems([
      {
        id: Date.now().toString(),
        namaBarang: '',
        jumlah: 1,
        hargaSatuan: 0,
        subtotal: 0,
      },
    ]);
  };

  // Item change handlers
  const handleItemChange = (
    index: number,
    field: 'namaBarang' | 'jumlah' | 'hargaSatuan',
    value: string | number
  ) => {
    setCartItems((prev) => {
      const copy = [...prev];
      if (!copy[index]) return prev;
      const current = { ...copy[index] };

      if (field === 'namaBarang') {
        current.namaBarang = String(value);
      } else if (field === 'jumlah') {
        const clean = String(value).replace(/[^0-9]/g, '');
        const num = clean ? parseInt(clean, 10) : 0;
        current.jumlah = num;
        const effectivePrice = current.hargaSatuan || 0;
        current.subtotal = (num > 0 ? num : 1) * effectivePrice;
      } else if (field === 'hargaSatuan') {
        const clean = String(value).replace(/[^0-9]/g, '');
        const num = clean ? parseInt(clean, 10) : 0;
        current.hargaSatuan = num;
        const effectiveQty = current.jumlah > 0 ? current.jumlah : 1;
        current.subtotal = effectiveQty * num;
      }

      copy[index] = current;
      return copy;
    });
  };

  const handleAddItem = () => {
    setCartItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        namaBarang: '',
        jumlah: 1,
        hargaSatuan: 0,
        subtotal: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (cartItems.length <= 1) {
      setCartItems([
        {
          id: Date.now().toString(),
          namaBarang: '',
          jumlah: 1,
          hargaSatuan: 0,
          subtotal: 0,
        },
      ]);
      return;
    }
    setCartItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Quick cash buttons
  const handleQuickCash = (amount: number | 'pas') => {
    if (amount === 'pas') {
      setUangDiterimaInput(totalBelanja > 0 ? totalBelanja.toString() : '');
    } else {
      setUangDiterimaInput(amount.toString());
    }
  };

  // Submit Transaction (Save New OR Update Existing Receipt)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi dan normalisasi item belanja (ambil semua item yang ada harganya)
    const validItems: CashTransactionItem[] = cartItems
      .filter((it) => (it.hargaSatuan || 0) > 0)
      .map((it, idx) => {
        const qty = it.jumlah > 0 ? it.jumlah : 1;
        const price = it.hargaSatuan || 0;
        const name = it.namaBarang.trim() || `Barang #${idx + 1}`;
        return {
          id: it.id || `item-${idx}-${Date.now()}`,
          namaBarang: name,
          jumlah: qty,
          hargaSatuan: price,
          subtotal: qty * price,
        };
      });

    if (validItems.length === 0) {
      alert('Mohon isi harga satuan barang (harus lebih dari Rp 0).');
      return;
    }

    const calculatedTotal = validItems.reduce((acc, it) => acc + it.subtotal, 0);
    if (calculatedTotal <= 0) {
      alert('Total belanja harus lebih dari Rp 0.');
      return;
    }

    let finalUangDiterima = 0;
    let finalKembalian = 0;

    if (statusBayar === 'lunas') {
      finalUangDiterima = uangDiterimaNumber > 0 ? uangDiterimaNumber : calculatedTotal;
      if (finalUangDiterima < calculatedTotal) {
        alert(
          `Uang diterima (${formatRupiah(finalUangDiterima)}) kurang dari total belanja (${formatRupiah(calculatedTotal)}).`
        );
        return;
      }
      finalKembalian = Math.max(0, finalUangDiterima - calculatedTotal);
    } else {
      // Belum Lunas / Bisa Dibayar Kapan Saja (Bisa Rp 0 atau DP, tanpa paksaan bayar)
      finalUangDiterima = uangDiterimaNumber;
      finalKembalian = 0;
    }

    const now = new Date();
    const waktuStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (telepon.trim() && namaPelanggan.trim() && namaPelanggan !== 'Pelanggan Umum') {
      saveContactPhone(namaPelanggan.trim(), telepon.trim());
      if (onUpdateCustomerPhone) {
        onUpdateCustomerPhone(namaPelanggan.trim(), telepon.trim());
      }
    }

    // UPDATE EXISTING NOTA
    if (editingTransaction) {
      const updatedTx: CashTransaction = {
        ...editingTransaction,
        namaPelanggan: namaPelanggan.trim() || 'Pelanggan Umum',
        telepon: telepon.trim() || undefined,
        items: validItems,
        total: calculatedTotal,
        uangDiterima: finalUangDiterima,
        kembalian: finalKembalian,
        statusBayar: statusBayar,
        keterangan: keterangan.trim() || undefined,
        tanggal: tanggal || editingTransaction.tanggal,
        tanggalLunas:
          statusBayar === 'lunas'
            ? editingTransaction.tanggalLunas || getTodayDateString()
            : undefined,
        waktuLunas:
          statusBayar === 'lunas'
            ? editingTransaction.waktuLunas || waktuStr
            : undefined,
        catatanPelunasan:
          statusBayar === 'lunas' ? editingTransaction.catatanPelunasan : undefined,
      };

      if (onUpdateTransaction) {
        onUpdateTransaction(updatedTx);
      }

      handleCancelEdit();
      setSelectedTxForNota(updatedTx);
      setShowNotaModal(true);
      return;
    }

    // CREATE NEW NOTA
    const newTx = onAddTransaction({
      namaPelanggan: namaPelanggan.trim() || 'Pelanggan Umum',
      telepon: telepon.trim() || undefined,
      items: validItems,
      total: calculatedTotal,
      uangDiterima: finalUangDiterima,
      kembalian: finalKembalian,
      statusBayar: statusBayar,
      keterangan: keterangan.trim() || undefined,
      tanggal: tanggal || getTodayDateString(),
      waktu: waktuStr,
    });

    handleCancelEdit();

    // Open receipt modal immediately
    setSelectedTxForNota(newTx);
    setShowNotaModal(true);
  };

  // Filtered transactions & counts
  const todayStr = getTodayDateString();
  const currentMonthPrefix = todayStr.slice(0, 7);

  const unpaidCount = useMemo(() => {
    return transactions.filter((tx) => tx.statusBayar === 'belum_lunas').length;
  }, [transactions]);

  const paidCount = useMemo(() => {
    return transactions.filter((tx) => tx.statusBayar !== 'belum_lunas').length;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterPeriod === 'today' && tx.tanggal !== todayStr) return false;
      if (filterPeriod === 'month' && !tx.tanggal.startsWith(currentMonthPrefix)) return false;

      const isTxUnpaid = tx.statusBayar === 'belum_lunas';
      if (filterStatus === 'belum_lunas' && !isTxUnpaid) return false;
      if (filterStatus === 'lunas' && isTxUnpaid) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (tx.namaPelanggan || '').toLowerCase().includes(q);
        const matchNota = (tx.noNota || '').toLowerCase().includes(q);
        const matchKet = (tx.keterangan || '').toLowerCase().includes(q);
        const matchItems = tx.items.some((it) => it.namaBarang.toLowerCase().includes(q));
        return matchName || matchNota || matchKet || matchItems;
      }

      return true;
    });
  }, [transactions, filterPeriod, filterStatus, searchQuery, todayStr, currentMonthPrefix]);

  // Pelunasan Handler
  const handleOpenPelunasan = (tx: CashTransaction) => {
    setSelectedTxForPelunasan(tx);
    const sisa = Math.max(0, tx.total - (tx.uangDiterima || 0));
    setUangPelunasanInput(sisa > 0 ? sisa.toString() : '');
    setTanggalPelunasan(getTodayDateString());
    setCatatanPelunasan('');
    setShowPelunasanModal(true);
  };

  const handleConfirmPelunasan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxForPelunasan) return;

    const sisaTagihan = Math.max(0, selectedTxForPelunasan.total - (selectedTxForPelunasan.uangDiterima || 0));
    const cleanPelunasan = uangPelunasanInput.replace(/[^0-9]/g, '');
    const nominalPelunasan = cleanPelunasan ? Number(cleanPelunasan) : 0;

    if (nominalPelunasan < sisaTagihan) {
      alert(`Uang pelunasan (${formatRupiah(nominalPelunasan)}) kurang dari sisa tagihan (${formatRupiah(sisaTagihan)}).`);
      return;
    }

    const now = new Date();
    const waktuPelunasanStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const calculatedKembalian = Math.max(0, nominalPelunasan - sisaTagihan);

    const updatedTx: CashTransaction = {
      ...selectedTxForPelunasan,
      statusBayar: 'lunas',
      uangDiterima: (selectedTxForPelunasan.uangDiterima || 0) + nominalPelunasan,
      kembalian: calculatedKembalian,
      tanggalLunas: tanggalPelunasan || getTodayDateString(),
      waktuLunas: waktuPelunasanStr,
      catatanPelunasan: catatanPelunasan.trim() || undefined,
    };

    if (onUpdateTransaction) {
      onUpdateTransaction(updatedTx);
    }

    setShowPelunasanModal(false);
    setSelectedTxForPelunasan(null);
    setSelectedTxForNota(updatedTx);
    setShowNotaModal(true);
  };

  // Fast direct Bluetooth print
  const handleQuickBtPrint = (tx: CashTransaction) => {
    const isLunas = tx.statusBayar !== 'belum_lunas';
    const data: ReceiptData = {
      type: 'cash',
      name: tx.namaPelanggan || 'Pelanggan Umum',
      phone: tx.telepon || '',
      dateStr: `${formatTanggalIndo(tx.tanggal)}${tx.waktu ? ' ' + tx.waktu : ''}`,
      noNota: tx.noNota,
      keterangan: tx.keterangan,
      cashItems: tx.items,
      total: tx.total,
      uangDiterima: tx.uangDiterima,
      kembalian: tx.kembalian,
      statusLunas: isLunas,
    };
    setDirectBtReceiptData(data);
    setShowBtModal(true);
  };

  // Fast direct 1-click Thermal Browser Print (58mm)
  const handleQuickBrowserPrint = (tx: CashTransaction) => {
    const isLunas = tx.statusBayar !== 'belum_lunas';
    const data: ReceiptData = {
      type: 'cash',
      name: tx.namaPelanggan || 'Pelanggan Umum',
      phone: tx.telepon || '',
      dateStr: `${formatTanggalIndo(tx.tanggal)}${tx.waktu ? ' ' + tx.waktu : ''}`,
      noNota: tx.noNota,
      keterangan: tx.keterangan,
      cashItems: tx.items,
      total: tx.total,
      uangDiterima: tx.uangDiterima,
      kembalian: tx.kembalian,
      statusLunas: isLunas,
    };
    printReceiptViaBrowser(data, 32);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner - Pure Receipt Focused (No Kas Amounts) */}
      <div className="bg-gradient-to-r from-[#1e293b] via-[#24344d] to-[#1e293b] rounded-2xl p-5 sm:p-6 text-white shadow-md border border-slate-700/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <Receipt className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                  MENU 5
                </span>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  Pembuat Nota & Struk Belanja
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Khusus pembuatan nota kasir, rincian barang, hitung kembalian pembeli, serta cetak struk Bluetooth, PDF, dan WhatsApp.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-2.5 self-start sm:self-auto text-xs">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300 font-medium">
              Total Nota Tersimpan: <strong className="text-white font-mono">{transactions.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Container: Form Input Nota */}
      <div ref={formRef} className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {editingTransaction && (
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-xs">
                <Edit3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[11px] uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded">
                    Mode Edit / Update Nota
                  </span>
                  <span className="font-mono font-bold text-xs bg-white text-slate-900 px-2 py-0.5 rounded shadow-2xs">
                    {editingTransaction.noNota}
                  </span>
                </div>
                <p className="text-[11px] text-amber-50 mt-1">
                  Anda sedang mengubah nota ini. Anda dapat memperbarui barang, jumlah, harga, atau status bayar tanpa harus ada pembayaran (bisa disimpan dengan status Belum Dibayar / Rp 0).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 self-start sm:self-auto border border-white/30"
            >
              <X className="w-3.5 h-3.5" />
              <span>Batal Edit</span>
            </button>
          </div>
        )}

        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {editingTransaction ? (
              <Edit3 className="w-5 h-5 text-amber-600" />
            ) : (
              <Receipt className="w-5 h-5 text-emerald-600" />
            )}
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              {editingTransaction ? (
                <span>
                  Perbarui Nota: <span className="font-mono text-amber-700">{editingTransaction.noNota}</span>
                </span>
              ) : (
                'Formulir Pembuatan Nota Baru'
              )}
            </h3>
          </div>
          {editingTransaction ? (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Batal Edit</span>
            </button>
          ) : (
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              Input nominal otomatis memunculkan keyboard angka di HP
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-6 space-y-6">
          {/* Pelanggan, No WhatsApp & Tanggal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Pelanggan / Pembeli
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={namaPelanggan}
                  onChange={(e) => {
                    setNamaPelanggan(e.target.value);
                    const matchedPhone = getPhoneForName(e.target.value);
                    if (matchedPhone && !telepon) {
                      setTelepon(matchedPhone);
                    }
                  }}
                  placeholder="Contoh: Pelanggan Umum / Bu Siti"
                  className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>No. WhatsApp (Opsional)</span>
                <button
                  type="button"
                  onClick={async () => {
                    if (isContactPickerSupported() && !isInsideIframe()) {
                      try {
                        const picked = await pickContactFromDevice();
                        if (picked?.cancelled) return;
                        if (picked?.phone) {
                          if (picked.allPhones && picked.allPhones.length > 1) {
                            setShowInternalContactPicker(true);
                            return;
                          }
                          setTelepon(picked.phone);
                          if (namaPelanggan && namaPelanggan !== 'Pelanggan Umum') {
                            saveContactPhone(namaPelanggan, picked.phone);
                          }
                          return;
                        }
                      } catch (err) {
                        console.warn('Device contact picker fallback', err);
                      }
                    }
                    setShowInternalContactPicker(true);
                  }}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" /> Ambil Kontak
                </button>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={telepon}
                  onChange={(e) => setTelepon(e.target.value.replace(/[^0-9+]/g, ''))}
                  placeholder="08xxxxxxxxxx"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Nota
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Rincian Barang / Jasa Yang Dibeli */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                Rincian Barang / Jasa ({cartItems.length} Item)
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Baris Barang
              </button>
            </div>

            {/* List of items */}
            <div className="space-y-2.5">
              {cartItems.map((item, index) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase sm:hidden mb-0.5">
                      Nama Barang / Jasa
                    </label>
                    <input
                      type="text"
                      value={item.namaBarang}
                      onChange={(e) => handleItemChange(index, 'namaBarang', e.target.value)}
                      placeholder={`Nama barang #${index + 1} (contoh: Beras 5kg, Minyak 2L)`}
                      className="w-full px-3 py-1.5 text-xs font-semibold bg-slate-50/50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase sm:hidden mb-0.5">
                      Qty / Jumlah
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.jumlah ? item.jumlah.toString() : ''}
                      onChange={(e) => handleItemChange(index, 'jumlah', e.target.value)}
                      placeholder="1"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-center bg-slate-50/50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="col-span-7 sm:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase sm:hidden mb-0.5">
                      Harga Satuan (Rp)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.hargaSatuan ? item.hargaSatuan.toLocaleString('id-ID') : ''}
                      onChange={(e) => handleItemChange(index, 'hargaSatuan', e.target.value)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold text-right bg-slate-50/50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="col-span-12 sm:col-span-2 flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold sm:hidden mr-2">
                        Subtotal:
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-800">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Hapus baris barang ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Perhitungan Pembayaran & Kembalian */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                <Banknote className="w-4 h-4" />
                Status Pembayaran & Perhitungan Kasir
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Total Belanja:</span>
                <span className="text-lg font-mono font-bold text-emerald-400">
                  {formatRupiah(totalBelanja)}
                </span>
              </div>
            </div>

            {/* Pilihan Status Nota: Lunas vs Belum Dibayar (Bisa Dibayar Kapan Saja) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Pilih Status Pembayaran Nota:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStatusBayar('lunas')}
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                    statusBayar === 'lunas'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-xs ring-1 ring-emerald-500'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    statusBayar === 'lunas' ? 'border-emerald-400 bg-emerald-500' : 'border-slate-500'
                  }`}>
                    {statusBayar === 'lunas' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>LUNAS (Bayar Tunai Sekarang)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      Pembeli membayar tunai sekarang, kembalian dihitung otomatis.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusBayar('belum_lunas')}
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                    statusBayar === 'belum_lunas'
                      ? 'bg-amber-950/60 border-amber-500 text-white shadow-xs ring-1 ring-amber-500'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    statusBayar === 'belum_lunas' ? 'border-amber-400 bg-amber-500' : 'border-slate-500'
                  }`}>
                    {statusBayar === 'belum_lunas' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>BELUM DIBAYAR (Bisa Dibayar Kapan Saja)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      Nota dibuat dulu tanpa harus lunas, bisa dilunasi kapan saja sewaktu-waktu.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start pt-1">
              {/* Input Uang Tunai Diterima / Uang Muka DP */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-200">
                  {statusBayar === 'lunas'
                    ? 'Uang Tunai Diterima Dari Pembeli (Rp)'
                    : 'Uang Muka / DP Awal - Opsional (Rp)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold font-mono text-slate-400 text-sm">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={uangDiterimaNumber ? uangDiterimaNumber.toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '');
                      setUangDiterimaInput(clean);
                    }}
                    placeholder={
                      statusBayar === 'lunas'
                        ? totalBelanja > 0
                          ? totalBelanja.toLocaleString('id-ID')
                          : '0'
                        : '0 (Kosongkan jika belum bayar sama sekali)'
                    }
                    className="w-full pl-11 pr-4 py-2.5 text-base font-mono font-bold bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-400 focus:outline-hidden"
                  />
                </div>

                {/* Tombol Cepat Pecahan Uang */}
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block mb-1.5">
                    {statusBayar === 'lunas' ? 'Tombol Cepat Uang Pembayaran:' : 'Tombol Cepat Pembayaran / Uang Muka (DP):'}
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-xs font-mono font-bold">
                    {statusBayar === 'belum_lunas' && (
                      <button
                        type="button"
                        onClick={() => setUangDiterimaInput('')}
                        className="px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 transition cursor-pointer"
                        title="Simpan nota tanpa ada uang pembayaran (Rp 0)"
                      >
                        Rp 0 (Belum Bayar)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleQuickCash('pas')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 transition cursor-pointer"
                    >
                      Uang Pas
                    </button>
                    {[10000, 20000, 50000, 100000, 200000].map((nominal) => (
                      <button
                        key={nominal}
                        type="button"
                        onClick={() => handleQuickCash(nominal)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                      >
                        {nominal.toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Kotak Kembalian Real-time ATAU Sisa Tagihan */}
              <div className="space-y-3">
                {statusBayar === 'lunas' ? (
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      uangDiterimaNumber >= totalBelanja && totalBelanja > 0
                        ? 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
                        : uangDiterimaNumber > 0 && uangDiterimaNumber < totalBelanja
                        ? 'bg-rose-950/40 border-rose-600/60 text-rose-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                          {uangDiterimaNumber < totalBelanja && uangDiterimaNumber > 0
                            ? 'Uang Masih Kurang'
                            : 'Uang Kembalian'}
                        </span>
                        <span className="text-xs font-semibold">
                          {kembalian === 0 && uangDiterimaNumber === totalBelanja && totalBelanja > 0
                            ? 'Uang Pas (Tanpa Kembalian)'
                            : kembalian > 0
                            ? 'Kembalikan ke Pembeli'
                            : uangDiterimaNumber < totalBelanja && uangDiterimaNumber > 0
                            ? `Kurang ${formatRupiah(totalBelanja - uangDiterimaNumber)}`
                            : 'Masukkan uang tunai yang diterima'}
                        </span>
                      </div>
                      <span className="text-xl font-bold font-mono">
                        {uangDiterimaNumber < totalBelanja && uangDiterimaNumber > 0
                          ? `- ${formatRupiah(totalBelanja - uangDiterimaNumber)}`
                          : formatRupiah(kembalian)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border bg-amber-950/40 border-amber-600/60 text-amber-200 transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75 text-amber-300">
                          Sisa Tagihan Belum Dibayar
                        </span>
                        <span className="text-xs font-semibold text-amber-100">
                          {uangDiterimaNumber > 0
                            ? `DP Masuk ${formatRupiah(uangDiterimaNumber)} • Bisa dilunasi kapan saja`
                            : 'Belum ada pembayaran (Rp 0) • Bisa dilunasi kapan saja'}
                        </span>
                      </div>
                      <span className="text-xl font-bold font-mono text-amber-300">
                        {formatRupiah(Math.max(0, totalBelanja - uangDiterimaNumber))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Catatan / Keterangan Tambahan */}
                <div>
                  <input
                    type="text"
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Catatan / Keterangan nota (opsional)"
                    className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-slate-300 placeholder-slate-500 focus:ring-2 focus:ring-emerald-400 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Tombol Simpan & Cetak Nota */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              {editingTransaction && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Batal Edit</span>
                </button>
              )}

              <button
                type="submit"
                id="btn-submit-cash-transaction"
                disabled={totalBelanja <= 0}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition ${
                  totalBelanja <= 0
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : editingTransaction
                    ? statusBayar === 'lunas'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer ring-2 ring-emerald-400'
                      : 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer ring-2 ring-amber-400'
                    : statusBayar === 'lunas'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                    : 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                }`}
              >
                {editingTransaction ? (
                  statusBayar === 'lunas' ? (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Perubahan Nota (Status Lunas)</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Perubahan Nota (Belum Dibayar / Rp 0)</span>
                    </>
                  )
                ) : statusBayar === 'lunas' ? (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Simpan Transaksi & Buat Nota Struk (Lunas)</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Simpan Nota Belum Dibayar (Bisa Dibayar Kapan Saja)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Riwayat Nota Pembayaran */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Riwayat Nota Pembayaran ({filteredTransactions.length} Nota)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar nota belanja yang telah disimpan, nota belum dibayar dapat dilunasi kapan saja sewaktu-waktu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Status: All vs Belum Dibayar vs Lunas */}
            <div className="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  filterStatus === 'all'
                    ? 'bg-white text-slate-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({transactions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('belum_lunas')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === 'belum_lunas'
                    ? 'bg-amber-500 text-white shadow-2xs font-bold'
                    : 'text-amber-800 hover:text-amber-950 font-bold'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Belum Dibayar</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  filterStatus === 'belum_lunas' ? 'bg-amber-600 text-white' : 'bg-amber-200 text-amber-900'
                }`}>
                  {unpaidCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('lunas')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  filterStatus === 'lunas'
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Lunas ({paidCount})</span>
              </button>
            </div>

            {/* Filter Period Pills */}
            <div className="flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterPeriod('today')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  filterPeriod === 'today'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setFilterPeriod('month')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  filterPeriod === 'month'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => setFilterPeriod('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  filterPeriod === 'all'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari no. nota/pembeli..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Tabel Nota / Empty State */}
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Receipt className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-slate-500">
              Belum ada data nota untuk periode dan filter ini.
            </p>
            <p className="text-[11px] text-slate-400">
              Masukkan transaksi baru pada formulir di atas untuk mencetak nota kasir pertama.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">No. Nota & Status</th>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Rincian Barang</th>
                  <th className="py-3 px-4 text-right">Total Belanja</th>
                  <th className="py-3 px-4 text-right">Status Bayar / Kembalian</th>
                  <th className="py-3 px-4 text-center">Aksi Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredTransactions.map((tx) => {
                  const isTxUnpaid = tx.statusBayar === 'belum_lunas';
                  const sisa = Math.max(0, tx.total - (tx.uangDiterima || 0));

                  return (
                    <tr
                      key={tx.id}
                      className={`transition ${
                        editingTransaction?.id === tx.id
                          ? 'bg-amber-100/70 ring-2 ring-amber-400'
                          : isTxUnpaid
                          ? 'bg-amber-50/30 hover:bg-amber-50/60'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-300 text-[11px] shadow-2xs">
                              {tx.noNota}
                            </span>
                            {editingTransaction?.id === tx.id && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold uppercase tracking-wider animate-pulse">
                                Mengedit
                              </span>
                            )}
                          </div>
                          <div>
                            {isTxUnpaid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px]">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>BELUM DIBAYAR</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>LUNAS</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{formatTanggalIndo(tx.tanggal)}</div>
                        {tx.waktu && <div className="text-[10px] text-slate-400 font-mono">{tx.waktu}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{tx.namaPelanggan || 'Pelanggan Umum'}</div>
                        {tx.telepon && (
                          <div className="text-[11px] text-slate-500 font-mono">{tx.telepon}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs">
                        <div className="truncate font-semibold text-slate-800">
                          {tx.items.map((it) => `${it.jumlah}x ${it.namaBarang}`).join(', ')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {tx.items.length} item{tx.keterangan ? ` • ${tx.keterangan}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-bold text-slate-900 text-sm">
                          {formatRupiah(tx.total)}
                        </div>
                        {isTxUnpaid && (
                          <div className="text-[10px] text-rose-600 font-bold font-mono">
                            Sisa: {formatRupiah(sisa)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isTxUnpaid ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md inline-block">
                              Bisa Dibayar Kapan Saja
                            </span>
                            {tx.uangDiterima !== undefined && tx.uangDiterima > 0 && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                DP: {formatRupiah(tx.uangDiterima)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="font-mono text-slate-700">
                              {tx.kembalian > 0 ? formatRupiah(tx.kembalian) : 'Rp 0 (Pas)'}
                            </div>
                            {tx.tanggalLunas && (
                              <div className="text-[10px] text-blue-600 font-semibold">
                                Dilunasi: {formatTanggalIndo(tx.tanggalLunas)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Tombol Edit Nota */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(tx)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs ${
                              editingTransaction?.id === tx.id
                                ? 'bg-amber-500 text-white shadow-xs ring-1 ring-amber-600'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                            title="Edit / Update Nota ini (ubah barang, jumlah, harga, atau pembayaran)"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                            <span>Edit</span>
                          </button>

                          {/* Tombol Bayar Sekarang khusus nota belum lunas */}
                          {isTxUnpaid && (
                            <button
                              type="button"
                              onClick={() => handleOpenPelunasan(tx)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                              title="Bayar / Lunasi Nota Ini Sekarang"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>Bayar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTxForNota(tx);
                              setShowNotaModal(true);
                            }}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title="Buka Nota Struk Lengkap / Kirim WhatsApp"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Nota</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickBrowserPrint(tx)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title="Cetak Langsung Struk Thermal Kasir (58mm)"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600" />
                            <span className="hidden sm:inline">Cetak</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickBtPrint(tx)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                            title="Cetak Cepat ke Printer Bluetooth Thermal"
                          >
                            <Bluetooth className="w-3.5 h-3.5 text-blue-600" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirmId(tx.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Hapus Nota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nota Cash Modal */}
      <NotaCashModal
        isOpen={showNotaModal}
        onClose={() => {
          setShowNotaModal(false);
          setSelectedTxForNota(null);
        }}
        transaction={selectedTxForNota}
        onOpenPelunasan={handleOpenPelunasan}
        onEditTransaction={handleStartEdit}
      />

      {/* Direct Bluetooth Modal from table action */}
      {directBtReceiptData && (
        <BluetoothPrintModal
          isOpen={showBtModal}
          onClose={() => {
            setShowBtModal(false);
            setDirectBtReceiptData(null);
          }}
          data={directBtReceiptData}
          receiptData={directBtReceiptData}
        />
      )}

      {/* Modal Pelunasan Nota (Bisa Dibayar Kapan Saja) */}
      {showPelunasanModal && selectedTxForPelunasan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
            {/* Header Pelunasan */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">Pelunasan Pembayaran Nota</h3>
                  <p className="text-[11px] text-emerald-100">
                    No. Nota: <span className="font-mono font-bold text-white">{selectedTxForPelunasan.noNota}</span> • {selectedTxForPelunasan.namaPelanggan}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPelunasanModal(false);
                  setSelectedTxForPelunasan(null);
                }}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Pelunasan */}
            <form onSubmit={handleConfirmPelunasan} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Rincian Tagihan Nota */}
              {(() => {
                const sisa = Math.max(0, selectedTxForPelunasan.total - (selectedTxForPelunasan.uangDiterima || 0));
                const cleanInput = uangPelunasanInput.replace(/[^0-9]/g, '');
                const numInput = cleanInput ? Number(cleanInput) : 0;
                const kembalianPelunasan = Math.max(0, numInput - sisa);

                return (
                  <>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Total Belanja Nota:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {formatRupiah(selectedTxForPelunasan.total)}
                        </span>
                      </div>
                      {selectedTxForPelunasan.uangDiterima !== undefined && selectedTxForPelunasan.uangDiterima > 0 && (
                        <div className="flex justify-between items-center text-slate-600">
                          <span>DP / Telah Dibayar:</span>
                          <span className="font-mono font-semibold text-emerald-700">
                            - {formatRupiah(selectedTxForPelunasan.uangDiterima)}
                          </span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-rose-700 font-bold">
                        <span className="uppercase text-[11px] tracking-wider">Sisa Tagihan Yang Harus Dibayar:</span>
                        <span className="font-mono text-base">{formatRupiah(sisa)}</span>
                      </div>
                    </div>

                    {/* Input Uang Pelunasan Diterima */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-700">
                        Uang Tunai Pelunasan Diterima (Rp)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold font-mono text-slate-400 text-sm">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={numInput ? numInput.toLocaleString('id-ID') : ''}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/[^0-9]/g, '');
                            setUangPelunasanInput(clean);
                          }}
                          placeholder={sisa.toLocaleString('id-ID')}
                          className="w-full pl-11 pr-4 py-2.5 text-base font-mono font-bold bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>

                      {/* Quick Cash Buttons for Pelunasan */}
                      <div className="flex flex-wrap gap-1.5 text-xs font-mono font-bold pt-1">
                        <button
                          type="button"
                          onClick={() => setUangPelunasanInput(sisa.toString())}
                          className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 transition cursor-pointer"
                        >
                          Uang Pas ({formatRupiah(sisa)})
                        </button>
                        {[10000, 20000, 50000, 100000, 200000].map((nominal) => (
                          <button
                            key={nominal}
                            type="button"
                            onClick={() => setUangPelunasanInput(nominal.toString())}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
                          >
                            {nominal.toLocaleString('id-ID')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Kembalian Preview */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all ${
                        numInput >= sisa && sisa > 0
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : numInput > 0 && numInput < sisa
                          ? 'bg-rose-50 border-rose-300 text-rose-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                            {numInput < sisa && numInput > 0 ? 'Uang Pelunasan Kurang' : 'Uang Kembalian'}
                          </span>
                          <span className="text-xs font-semibold">
                            {kembalianPelunasan === 0 && numInput === sisa
                              ? 'Uang Pas Tanpa Kembalian'
                              : kembalianPelunasan > 0
                              ? 'Kembalikan ke Pembeli'
                              : numInput < sisa && numInput > 0
                              ? `Kurang ${formatRupiah(sisa - numInput)}`
                              : 'Masukkan uang tunai yang diterima'}
                          </span>
                        </div>
                        <span className="text-lg font-bold font-mono">
                          {numInput < sisa && numInput > 0
                            ? `- ${formatRupiah(sisa - numInput)}`
                            : formatRupiah(kembalianPelunasan)}
                        </span>
                      </div>
                    </div>

                    {/* Tanggal & Waktu Pelunasan */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Tanggal Pelunasan
                        </label>
                        <input
                          type="date"
                          value={tanggalPelunasan}
                          onChange={(e) => setTanggalPelunasan(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Catatan Pelunasan (Opsional)
                        </label>
                        <input
                          type="text"
                          value={catatanPelunasan}
                          onChange={(e) => setCatatanPelunasan(e.target.value)}
                          placeholder="Contoh: Titip lewat kasir sore"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Tombol Konfirmasi */}
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPelunasanModal(false);
                          setSelectedTxForPelunasan(null);
                        }}
                        className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={numInput < sisa}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition ${
                          numInput >= sisa
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Konfirmasi & Lunasi Nota</span>
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* Contact Picker Modal */}
      <InternalContactPickerModal
        isOpen={showInternalContactPicker}
        onClose={() => setShowInternalContactPicker(false)}
        targetName={namaPelanggan !== 'Pelanggan Umum' ? namaPelanggan : undefined}
        onSelectContact={(contact) => {
          if (contact.phone) {
            setTelepon(contact.phone);
            if (contact.name && (namaPelanggan === 'Pelanggan Umum' || !namaPelanggan)) {
              setNamaPelanggan(contact.name);
            }
          }
          setShowInternalContactPicker(false);
        }}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">Hapus Nota?</h4>
                <p className="text-[11px] text-slate-500">
                  Data nota belanja ini akan dihapus permanen.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmId(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTransaction(showDeleteConfirmId);
                  setShowDeleteConfirmId(null);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer transition shadow-xs"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
