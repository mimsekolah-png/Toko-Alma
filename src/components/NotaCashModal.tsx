import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Bluetooth,
  Send,
  Receipt,
  Phone,
  Store,
  Clock,
  User,
  ShoppingBag,
  Banknote,
  Edit3
} from 'lucide-react';
import { CashTransaction } from '../types';
import { formatRupiah, formatTanggalIndo } from '../utils/formatters';
import { BluetoothPrintModal } from './BluetoothPrintModal';
import { ReceiptData } from '../utils/bluetoothPrinter';
import {
  getPhoneForName,
  saveContactPhone,
  isContactPickerSupported,
  pickContactFromDevice,
  isInsideIframe,
  toWhatsAppNumber
} from '../utils/contacts';
import { InternalContactPickerModal } from './InternalContactPickerModal';

interface NotaCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: CashTransaction | null;
  onOpenPelunasan?: (tx: CashTransaction) => void;
  onEditTransaction?: (tx: CashTransaction) => void;
}

export const NotaCashModal: React.FC<NotaCashModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onOpenPelunasan,
  onEditTransaction,
}) => {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [showBtModal, setShowBtModal] = useState<boolean>(false);
  const [showInternalContactPicker, setShowInternalContactPicker] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && transaction) {
      const resolved =
        (transaction.telepon && transaction.telepon.trim()) ||
        getPhoneForName(transaction.namaPelanggan) ||
        '';
      setPhoneNumber(resolved);
    }
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const isLunas = transaction.statusBayar !== 'belum_lunas';
  const uangMasuk = transaction.uangDiterima || 0;
  const sisaTagihan = Math.max(0, transaction.total - uangMasuk);

  const receiptData: ReceiptData = {
    type: 'cash',
    name: transaction.namaPelanggan || 'Pelanggan Umum',
    phone: phoneNumber || transaction.telepon || '',
    dateStr: `${formatTanggalIndo(transaction.tanggal)}${transaction.waktu ? ' ' + transaction.waktu : ''}`,
    noNota: transaction.noNota,
    keterangan: transaction.keterangan,
    cashItems: transaction.items,
    total: transaction.total,
    uangDiterima: transaction.uangDiterima,
    kembalian: transaction.kembalian,
    statusLunas: isLunas,
  };

  const itemLines = transaction.items.map((it, idx) => {
    return `${idx + 1}. *${it.namaBarang}*\n   ${it.jumlah}x @${formatRupiah(it.hargaSatuan)} = *${formatRupiah(it.subtotal)}*`;
  }).join('\n');

  const formattedWaMessage = isLunas
    ? `*🧾 NOTA PEMBAYARAN CASH - TOKO ALMA*
No. Nota: *${transaction.noNota}*
Tanggal : ${formatTanggalIndo(transaction.tanggal)}${transaction.waktu ? ' ' + transaction.waktu : ''}
Pelanggan: *${transaction.namaPelanggan || 'Pelanggan Umum'}*
----------------------------------------
*RINCIAN BELANJA:*
${itemLines}
----------------------------------------
*TOTAL BELANJA : ${formatRupiah(transaction.total)}*
${transaction.uangDiterima > 0 ? `Tunai Diterima : ${formatRupiah(transaction.uangDiterima)}
*KEMBALIAN     : ${formatRupiah(transaction.kembalian)}*\n` : ''}----------------------------------------
*STATUS: LUNAS (CASH)*
${transaction.tanggalLunas ? `Dilunasi: ${formatTanggalIndo(transaction.tanggalLunas)}${transaction.waktuLunas ? ' ' + transaction.waktuLunas : ''}\n` : ''}${transaction.catatanPelunasan ? `Catatan Lunas: ${transaction.catatanPelunasan}\n` : ''}${transaction.keterangan ? `Catatan: _${transaction.keterangan}_\n` : ''}----------------------------------------
Terima kasih telah berbelanja di *Toko Alma*! 🙏
_Barang yang sudah dibeli tidak dapat ditukar/dikembalikan tanpa perjanjian._`
    : `*🧾 NOTA TAGIHAN BELANJA - TOKO ALMA*
No. Nota: *${transaction.noNota}*
Tanggal : ${formatTanggalIndo(transaction.tanggal)}${transaction.waktu ? ' ' + transaction.waktu : ''}
Pelanggan: *${transaction.namaPelanggan || 'Pelanggan Umum'}*
----------------------------------------
*RINCIAN BELANJA:*
${itemLines}
----------------------------------------
*TOTAL BELANJA : ${formatRupiah(transaction.total)}*
${uangMasuk > 0 ? `Uang Muka / DP : ${formatRupiah(uangMasuk)}\n` : ''}*SISA TAGIHAN  : ${formatRupiah(sisaTagihan)}*
----------------------------------------
*STATUS: BELUM DIBAYAR (BISA DIBAYAR KAPAN SAJA)*
${transaction.keterangan ? `Catatan: _${transaction.keterangan}_\n` : ''}----------------------------------------
Nota ini disimpan dan dapat dibayarkan kapan saja di Toko Alma. Terima kasih! 🙏`;

  const handleSendWhatsApp = () => {
    if (phoneNumber.trim() && transaction.namaPelanggan) {
      saveContactPhone(transaction.namaPelanggan, phoneNumber.trim());
    }
    const encodedMessage = encodeURIComponent(formattedWaMessage);
    const targetPhone = toWhatsAppNumber(phoneNumber);

    if (targetPhone) {
      window.open(`https://wa.me/${targetPhone}?text=${encodedMessage}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    }
  };

  const handlePickContact = async () => {
    if (isContactPickerSupported() && !isInsideIframe()) {
      try {
        const picked = await pickContactFromDevice();
        if (picked?.cancelled) return;
        if (picked?.phone) {
          if (picked.allPhones && picked.allPhones.length > 1) {
            setShowInternalContactPicker(true);
            return;
          }
          setPhoneNumber(picked.phone);
          if (transaction.namaPelanggan) {
            saveContactPhone(transaction.namaPelanggan, picked.phone);
          }
          return;
        }
      } catch (err) {
        console.warn('Device picker fallback', err);
      }
    }
    setShowInternalContactPicker(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[94vh]">
          {/* Header */}
          <div className={`p-4 text-white flex items-center justify-between ${
            isLunas
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
              : 'bg-gradient-to-r from-amber-600 to-orange-700'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">
                  {isLunas ? 'Nota Pembayaran Cash' : 'Nota Tagihan Belum Dibayar'}
                </h3>
                <p className="text-[11px] text-white/90 flex items-center gap-1.5">
                  <Store className="w-3 h-3 inline" /> Toko Alma • {isLunas ? 'Transaksi Tunai Kasir' : 'Bisa Dibayar Kapan Saja'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {onEditTransaction && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditTransaction(transaction);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer backdrop-blur-xs"
                  title="Edit / Update Nota Ini"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                  <span>Edit Nota</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Tutup Nota"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body / Receipt Preview */}
          <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-slate-800">
            {/* Status & No Nota Banner */}
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              isLunas
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center gap-2">
                {isLunas ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Status Transaksi</span>
                  <span className="text-xs font-bold">
                    {isLunas ? 'LUNAS (PEMBAYARAN CASH)' : 'BELUM DIBAYAR (BAYAR KAPAN SAJA)'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">No. Nota</span>
                <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-300">
                  {transaction.noNota}
                </span>
              </div>
            </div>

            {/* Pelunasan info if paid later */}
            {isLunas && transaction.tanggalLunas && (
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between">
                <span className="font-semibold">Dilunasi Pada:</span>
                <span className="font-mono font-bold">
                  {formatTanggalIndo(transaction.tanggalLunas)} {transaction.waktuLunas || ''}
                </span>
              </div>
            )}

            {/* Unpaid Notice & Quick Pelunasan button */}
            {!isLunas && onOpenPelunasan && (
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                    Tagihan Belum Lunas
                  </span>
                  <span className="text-xs font-bold text-amber-900">
                    Sisa: {formatRupiah(sisaTagihan)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPelunasan(transaction);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Bayar Sekarang</span>
                </button>
              </div>
            )}

            {/* Thermal Styled Paper Container */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-3 text-xs shadow-2xs">
              {/* Receipt Info */}
              <div className="space-y-1 pb-2 border-b border-slate-200 text-slate-600">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Pelanggan
                  </span>
                  <span className="font-bold text-slate-800">{transaction.namaPelanggan || 'Pelanggan Umum'}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Tanggal & Waktu
                  </span>
                  <span className="font-medium">
                    {formatTanggalIndo(transaction.tanggal)}
                    {transaction.waktu ? ` ${transaction.waktu}` : ''}
                  </span>
                </div>
                {phoneNumber && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> No. WhatsApp
                    </span>
                    <span className="font-mono text-emerald-700 font-semibold">{phoneNumber}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <span className="flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3" /> Rincian Belanja ({transaction.items.length} Item)
                  </span>
                  <span>Subtotal</span>
                </div>
                <div className="space-y-2 divide-y divide-slate-200/60">
                  {transaction.items.map((item, idx) => (
                    <div key={item.id || idx} className="pt-1.5 first:pt-0 flex items-start justify-between">
                      <div className="pr-2">
                        <p className="font-semibold text-slate-800 leading-snug">{item.namaBarang}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {item.jumlah} x {formatRupiah(item.hargaSatuan)}
                        </p>
                      </div>
                      <span className="font-bold font-mono text-slate-800 shrink-0">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Belanja */}
              <div className="pt-2.5 border-t-2 border-slate-300 flex justify-between items-center font-bold text-slate-900 text-sm">
                <span>TOTAL BELANJA</span>
                <span className="font-mono text-emerald-700 text-base">{formatRupiah(transaction.total)}</span>
              </div>

              {/* Paid: Kembalian & Tunai Diterima Highlight */}
              {isLunas && transaction.uangDiterima > 0 && (
                <div className="pt-2 border-t border-dashed border-slate-300 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600">Uang Tunai Diterima</span>
                    <span className="font-mono font-bold text-slate-800">{formatRupiah(transaction.uangDiterima)}</span>
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                        Uang Kembalian
                      </span>
                      <span className="text-[11px] text-amber-700">
                        {transaction.kembalian > 0 ? 'Kembalikan ke pembeli' : 'Uang pas tanpa kembalian'}
                      </span>
                    </div>
                    <span className="text-base font-bold font-mono text-amber-900">
                      {formatRupiah(transaction.kembalian)}
                    </span>
                  </div>
                </div>
              )}

              {/* Unpaid: Sisa Tagihan highlight */}
              {!isLunas && (
                <div className="pt-2 border-t border-dashed border-slate-300 space-y-1.5">
                  {uangMasuk > 0 && (
                    <div className="flex justify-between items-center text-xs text-slate-600">
                      <span>Uang Muka / DP</span>
                      <span className="font-mono font-bold text-slate-800">{formatRupiah(uangMasuk)}</span>
                    </div>
                  )}
                  <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">
                        Sisa Yang Harus Dibayar
                      </span>
                      <span className="text-[11px] text-rose-700 font-semibold">
                        Bisa dilunasi kapan saja
                      </span>
                    </div>
                    <span className="text-base font-bold font-mono text-rose-700">
                      {formatRupiah(sisaTagihan)}
                    </span>
                  </div>
                </div>
              )}

              {transaction.keterangan && (
                <div className="pt-2 border-t border-slate-200 text-slate-600 text-[11px]">
                  <span className="font-semibold text-slate-700">Catatan: </span>
                  <span>{transaction.keterangan}</span>
                </div>
              )}
            </div>

            {/* Target WhatsApp Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Nomor WA Konsumen</span>
                </span>
                {phoneNumber && (
                  <span className="text-[10px] text-emerald-600 font-medium">Nomor terisi</span>
                )}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">WA</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+]/g, ''))}
                    placeholder="Contoh: 08123456789"
                    className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePickContact}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0"
                  title="Ambil nomor dari Kontak HP atau daftar tersimpan"
                >
                  <Phone className="w-3 h-3 text-slate-600" />
                  <span>Kontak</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer: Print & WhatsApp & Pelunasan */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2">
            {!isLunas && onOpenPelunasan && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPelunasan(transaction);
                }}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Banknote className="w-4 h-4 text-emerald-100" />
                <span>Bayar / Lunasi Nota Sekarang</span>
              </button>
            )}

            {onEditTransaction && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditTransaction(transaction);
                }}
                className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                <span>Edit / Perbarui Rincian Barang & Nota Ini</span>
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                id="btn-nota-print-bluetooth"
                onClick={() => setShowBtModal(true)}
                className="w-full py-2.5 sm:py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                title="Cetak nota struk via Printer Bluetooth"
              >
                <Bluetooth className="w-4 h-4 text-blue-200 shrink-0" />
                <span>Print Bluetooth</span>
              </button>

              <button
                type="button"
                id="btn-nota-kirim-wa"
                onClick={handleSendWhatsApp}
                className="w-full py-2.5 sm:py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                title="Kirim nota struk ke WhatsApp konsumen"
              >
                <Send className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>Kirim WA Konsumen</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bluetooth Printer Modal */}
      <BluetoothPrintModal
        isOpen={showBtModal}
        onClose={() => setShowBtModal(false)}
        data={receiptData}
        receiptData={receiptData}
      />

      {/* Internal Contact Picker Modal */}
      <InternalContactPickerModal
        isOpen={showInternalContactPicker}
        onClose={() => setShowInternalContactPicker(false)}
        targetName={transaction.namaPelanggan}
        onSelectContact={(contact) => {
          if (contact.phone) {
            setPhoneNumber(contact.phone);
            if (transaction.namaPelanggan) {
              saveContactPhone(transaction.namaPelanggan, contact.phone);
            }
          }
          setShowInternalContactPicker(false);
        }}
      />
    </>
  );
};
