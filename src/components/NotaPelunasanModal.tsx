import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Printer,
  Bluetooth,
  Send,
  Copy,
  Check,
  ArrowRight,
  Receipt,
  Phone,
  BookOpen,
  ShoppingBag
} from 'lucide-react';
import { formatRupiah, formatTanggalIndo } from '../utils/formatters';
import { BluetoothPrintModal } from './BluetoothPrintModal';
import { printReceiptViaBrowser, ReceiptData } from '../utils/bluetoothPrinter';
import {
  getPhoneForName,
  saveContactPhone,
  isContactPickerSupported,
  pickContactFromDevice,
  isInsideIframe,
  toWhatsAppNumber
} from '../utils/contacts';
import { InternalContactPickerModal } from './InternalContactPickerModal';

export interface NotaPelunasanData {
  customerName: string;
  phone?: string;
  tanggal: string;
  keterangan: string;
  sisaSebelum: number;
  nominalBayar: number;
  uangDiterima: number;
  kembalian: number;
  sisaBaru: number;
  isLunas: boolean;
  // Rincian transaksi bon belanja yang dilunasi
  items?: Array<{ tanggal: string; keterangan: string; nominal: number }>;
  payments?: Array<{ tanggal: string; keterangan: string; nominal: number }>;
  totalBon?: number;
  totalDibayarSebelumnya?: number;
}

interface NotaPelunasanModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: NotaPelunasanData | null;
}

export const NotaPelunasanModal: React.FC<NotaPelunasanModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [showBtModal, setShowBtModal] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showInternalContactPicker, setShowInternalContactPicker] = useState<boolean>(false);

  // Otomatis sinkronkan nomor WhatsApp tujuan dengan data yang di-input pada nama tersebut
  useEffect(() => {
    if (isOpen && data) {
      const resolved = (data.phone && data.phone.trim()) || getPhoneForName(data.customerName) || '';
      setPhoneNumber(resolved);
    }
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  const receiptData: ReceiptData = {
    type: 'pelunasan',
    name: data.customerName,
    phone: phoneNumber || data.phone || '',
    dateStr: formatTanggalIndo(data.tanggal),
    keterangan: data.keterangan,
    items: data.items,
    payments: data.payments,
    total: data.totalBon,
    totalBayar: data.totalDibayarSebelumnya,
    sisaSebelum: data.sisaSebelum,
    nominalBayar: data.nominalBayar,
    uangDiterima: data.uangDiterima,
    kembalian: data.kembalian,
    sisa: data.sisaBaru,
    statusLunas: data.isLunas,
  };

  const itemsText = data.items && data.items.length > 0
    ? `*RINCIAN BON TRANSAKSI:*
${data.items.map((it, idx) => `${idx + 1}. ${formatTanggalIndo(it.tanggal)} - ${it.keterangan}\n   Nominal: *${formatRupiah(it.nominal)}*`).join('\n')}
----------------------------------------
${data.totalBon !== undefined && data.totalBon > 0 ? `Total Bon Belanja  : ${formatRupiah(data.totalBon)}\n` : ''}${data.payments && data.payments.length > 0 ? `Sudah Dicicil/Bayar: -${formatRupiah(data.payments.reduce((sum, p) => sum + p.nominal, 0))}\n` : ''}----------------------------------------\n`
    : '';

  const paymentsText = data.payments && data.payments.length > 0
    ? `*RIWAYAT PEMBAYARAN SEBELUMNYA:*
${data.payments.map((p, idx) => `${idx + 1}. ${formatTanggalIndo(p.tanggal)} (${p.keterangan || 'Bayar'})\n   Masuk: -${formatRupiah(p.nominal)}`).join('\n')}
----------------------------------------\n`
    : '';

  const formattedWaMessage = `*🧾 ${data.isLunas ? 'BUKTI PELUNASAN PIUTANG' : 'BUKTI PEMBAYARAN BON'} - TOKO ALMA*
Tanggal  : ${formatTanggalIndo(data.tanggal)}
Pelanggan: *${data.customerName}*
----------------------------------------
${itemsText}${paymentsText}Tagihan Sebelumnya : ${formatRupiah(data.sisaSebelum)}
Jumlah Dibayarkan  : *${formatRupiah(data.nominalBayar)}*
Keterangan         : ${data.keterangan || 'Pembayaran'}
----------------------------------------
${data.uangDiterima > 0 ? `Uang Diterima (Cash): ${formatRupiah(data.uangDiterima)}
*KEMBALIAN          : ${formatRupiah(data.kembalian)}*
----------------------------------------\n` : ''}*STATUS : ${data.isLunas ? '✅ LUNAS (Semua kewajiban telah selesai)' : `SISA TAGIHAN: ${formatRupiah(data.sisaBaru)}`}*
----------------------------------------
Terima kasih atas pembayarannya 🙏
_Toko Alma_`;

  const handleSendWhatsApp = () => {
    if (phoneNumber.trim() && data) {
      saveContactPhone(data.customerName, phoneNumber.trim());
    }
    const encodedMessage = encodeURIComponent(formattedWaMessage);
    const targetPhone = toWhatsAppNumber(phoneNumber);

    if (targetPhone) {
      window.open(`https://wa.me/${targetPhone}?text=${encodedMessage}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedWaMessage);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
          {/* Modal Header */}
          <div className={`${data.isLunas ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-blue-600 to-indigo-700'} text-white p-4 flex items-center justify-between`}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">
                  {data.isLunas ? 'Nota Pelunasan Hutang' : 'Nota Pembayaran Bon'}
                </h3>
                <p className="text-[11px] text-white/80">Toko Alma • Transaksi Berhasil Dicatat</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body / Receipt Visual */}
          <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
            {/* Status Banner */}
            <div className={`p-3 rounded-xl flex items-center justify-between ${data.isLunas ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' : 'bg-blue-50 border border-blue-200 text-blue-900'}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-5 h-5 ${data.isLunas ? 'text-emerald-600' : 'text-blue-600'}`} />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Status Transaksi</span>
                  <span className="text-xs font-bold">{data.isLunas ? 'LUNAS SEPENUHNYA' : 'PEMBAYARAN DITERIMA'}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Sisa Tagihan</span>
                <span className="text-sm font-bold font-mono">{formatRupiah(data.sisaBaru)}</span>
              </div>
            </div>

            {/* Receipt Details Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Pelanggan</span>
                <span className="font-bold text-slate-800">{data.customerName}</span>
              </div>

              {(phoneNumber || data.phone) && (
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">No. WhatsApp</span>
                  <span className="font-mono text-slate-700">{phoneNumber || data.phone}</span>
                </div>
              )}

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Tanggal Bayar</span>
                <span className="text-slate-700">{formatTanggalIndo(data.tanggal)}</span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Keterangan Bayar</span>
                <span className="text-slate-800 font-semibold">{data.keterangan || '-'}</span>
              </div>

              {/* Rincian Transaksi Bon yang Dilunasi */}
              {data.items && data.items.length > 0 && (
                <div className="pt-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                      <span>Rincian Transaksi ({data.items.length} Bon)</span>
                    </span>
                    {data.totalBon !== undefined && data.totalBon > 0 && (
                      <span className="text-[11px] font-mono text-slate-500">
                        Total: {formatRupiah(data.totalBon)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {data.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2 rounded-lg border border-slate-200/80 flex items-start justify-between text-xs shadow-2xs"
                      >
                        <div className="pr-2">
                          <p className="font-semibold text-slate-800 leading-snug">
                            <span className="text-slate-400 font-mono mr-1">{idx + 1}.</span>
                            {it.keterangan}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {formatTanggalIndo(it.tanggal)}
                          </p>
                        </div>
                        <span className="font-bold font-mono text-slate-800 shrink-0">
                          {formatRupiah(it.nominal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Riwayat Pembayaran Sebelumnya jika ada */}
              {data.payments && data.payments.length > 0 && (
                <div className="pt-1.5 pb-2 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-1 text-[11px] font-semibold text-emerald-800">
                    <span>Pembayaran Sebelumnya ({data.payments.length})</span>
                    <span className="font-mono">
                      - {formatRupiah(data.payments.reduce((sum, p) => sum + p.nominal, 0))}
                    </span>
                  </div>
                  <div className="space-y-1 max-h-20 overflow-y-auto pr-1 text-[10px]">
                    {data.payments.map((p, idx) => (
                      <div key={idx} className="flex justify-between text-slate-600">
                        <span>{p.tanggal} ({p.keterangan || 'Bayar'})</span>
                        <span className="font-mono text-emerald-700 font-semibold">- {formatRupiah(p.nominal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Tagihan Sebelumnya</span>
                <span className="font-mono text-slate-600">{formatRupiah(data.sisaSebelum)}</span>
              </div>

              <div className="flex justify-between items-center pt-1 font-bold text-slate-900 text-sm">
                <span>Jumlah Dibayar</span>
                <span className="font-mono text-emerald-700">{formatRupiah(data.nominalBayar)}</span>
              </div>

              {/* Kembalian Highlight Box if uangDiterima is entered */}
              {data.uangDiterima > 0 && (
                <div className="mt-2 pt-2 border-t-2 border-dashed border-slate-300 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600">Uang Diterima (Tunai)</span>
                    <span className="font-mono font-bold text-slate-800">{formatRupiah(data.uangDiterima)}</span>
                  </div>

                  <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                        Uang Kembalian Pelanggan
                      </span>
                      <span className="text-[11px] text-amber-700">
                        {data.kembalian > 0 ? 'Serahkan kepada pelanggan' : 'Uang pas tanpa kembalian'}
                      </span>
                    </div>
                    <span className="text-base font-bold font-mono text-amber-900">
                      {formatRupiah(data.kembalian)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp Target Box */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="text-xs font-bold text-slate-800">Nomor WA Tujuan Nota</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {phoneNumber && (
                    <span className="text-[10px] text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-300/60 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Sesuai data {data.customerName}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (isContactPickerSupported() && !isInsideIframe()) {
                        try {
                          const picked = await pickContactFromDevice();
                          if (picked?.cancelled) {
                            return;
                          }
                          if (picked?.phone) {
                            if (picked.allPhones && picked.allPhones.length > 1) {
                              setShowInternalContactPicker(true);
                              return;
                            }
                            setPhoneNumber(picked.phone);
                            saveContactPhone(data.customerName, picked.phone);
                            return;
                          }
                        } catch (e) {
                          console.warn('Native picker notice:', e);
                        }
                      }
                      setShowInternalContactPicker(true);
                    }}
                    className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer bg-white px-2 py-0.5 rounded border border-emerald-300"
                  >
                    Ambil Kontak HP
                  </button>
                </div>
              </div>

              <input
                type="tel"
                inputMode="tel"
                placeholder="Contoh: 08123456789 atau 628123456789"
                value={phoneNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9+]/g, '');
                  setPhoneNumber(val);
                  if (val.trim()) {
                    saveContactPhone(data.customerName, val.trim());
                  }
                }}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 leading-tight">
                {phoneNumber ? (
                  <span>Nota pembayaran akan otomatis dikirimkan ke <strong>{phoneNumber}</strong> ({data.customerName}).</span>
                ) : (
                  <span>Nomor WA belum tercatat. Masukkan nomor agar nota langsung terkirim ke WhatsApp pelanggan ini.</span>
                )}
              </p>
            </div>

            {/* Quick Actions (Print Bluetooth, Send WA, Browser Print) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                id="btn-nota-print-bt"
                type="button"
                onClick={() => setShowBtModal(true)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Bluetooth className="w-4 h-4 text-blue-200" />
                <span>Print Thermal BT</span>
              </button>

              <button
                id="btn-nota-send-wa"
                type="button"
                onClick={handleSendWhatsApp}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Send className="w-4 h-4 text-emerald-200" />
                <span>Kirim WA</span>
              </button>

              <button
                id="btn-nota-copy-text"
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{isCopied ? 'Tersalin!' : 'Salin Teks'}</span>
              </button>

              <button
                id="btn-nota-print-browser"
                type="button"
                onClick={() => printReceiptViaBrowser(receiptData, 32)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Cetak / PDF</span>
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              id="btn-tutup-nota-pelunasan"
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Selesai & Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Bluetooth Thermal Print Modal */}
      {showBtModal && (
        <BluetoothPrintModal
          isOpen={showBtModal}
          onClose={() => setShowBtModal(false)}
          data={receiptData}
          receiptData={receiptData}
        />
      )}

      {/* Internal Contact Picker Modal */}
      {showInternalContactPicker && (
        <InternalContactPickerModal
          isOpen={showInternalContactPicker}
          onClose={() => setShowInternalContactPicker(false)}
          targetName={data.customerName}
          onSelectContact={(contact) => {
            if (contact.phone) {
              setPhoneNumber(contact.phone);
              if (data) {
                saveContactPhone(data.customerName, contact.phone);
              }
            }
          }}
        />
      )}
    </>
  );
};
