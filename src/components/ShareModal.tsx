import React, { useState, useEffect } from 'react';
import { X, Copy, Check, MessageSquare, Printer, Send, User, Bluetooth, CheckCircle2 } from 'lucide-react';
import { formatRupiah, formatTanggalIndo, getTodayDateString } from '../utils/formatters';
import { BluetoothPrintModal } from './BluetoothPrintModal';
import { ReceiptData } from '../utils/bluetoothPrinter';
import {
  isContactPickerSupported,
  pickContactFromDevice,
  saveContactPhone,
  getPhoneForName,
  isInsideIframe,
  toWhatsAppNumber
} from '../utils/contacts';
import { InternalContactPickerModal } from './InternalContactPickerModal';

interface ShareItem {
  tanggal: string;
  keterangan: string;
  nominal: number;
}

interface SharePayment {
  tanggal: string;
  keterangan: string;
  nominal: number;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'piutang' | 'titipan';
  name: string;
  items: ShareItem[];
  total: number;
  payments?: SharePayment[];
  sisa?: number;
  initialPhone?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  type,
  name,
  items,
  total,
  payments = [],
  sisa,
  initialPhone = '',
}) => {
  const [phoneNumber, setPhoneNumber] = useState<string>(initialPhone);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showBtModal, setShowBtModal] = useState<boolean>(false);
  const [showInternalContactPicker, setShowInternalContactPicker] = useState<boolean>(false);

  // Otomatis sinkronkan no WA tujuan dengan nomor yang di-input pada nama tersebut
  useEffect(() => {
    if (isOpen && name) {
      const resolved = (initialPhone && initialPhone.trim()) || getPhoneForName(name) || '';
      setPhoneNumber(resolved);
    }
  }, [isOpen, name, initialPhone]);

  if (!isOpen) return null;

  const todayStr = formatTanggalIndo(getTodayDateString());
  const totalBayar = payments.reduce((sum, p) => sum + p.nominal, 0);
  const calculatedSisa = sisa !== undefined ? sisa : Math.max(0, total - totalBayar);

  // Generate Message text
  const messageBody = type === 'piutang'
    ? `*REKAP TAGIHAN PIUTANG - TOKO ALMA*
Kepada Yth. Bpk/Ibu: *${name}*
Per Tanggal: ${todayStr}

Berikut adalah rincian tagihan belanja di Toko Alma:
${items.map((it, idx) => `${idx + 1}. [${it.tanggal}] ${it.keterangan} : ${formatRupiah(it.nominal)}`).join('\n')}
----------------------------------------
*TOTAL TAGIHAN AWAL: ${formatRupiah(total)}*
${payments.length > 0 ? `
Riwayat Pembayaran Masuk:
${payments.map((p, idx) => `  ${idx + 1}. [${p.tanggal}] ${formatRupiah(p.nominal)} (${p.keterangan || 'Bayar'})`).join('\n')}
*TOTAL SUDAH DIBAYAR: ${formatRupiah(totalBayar)}*
----------------------------------------
*SISA TAGIHAN AKTIF: ${formatRupiah(calculatedSisa)}*` : `
*SISA TAGIHAN: ${formatRupiah(total)}*`}

Mohon konfirmasi jika ada kekeliruan pencatatan atau jika telah melakukan pembayaran.
Terima kasih atas kepercayaannya berbelanja di Toko Alma 🙏
_Admin Toko Alma_`
    : `*BUKTI REKAP SALDO TITIPAN - TOKO ALMA*
Kepada Yth: *${name}*
Per Tanggal: ${todayStr}

Berikut adalah rincian saldo titipan di Toko Alma:
${items.map((it, idx) => `${idx + 1}. [${it.tanggal}] ${it.keterangan} : ${formatRupiah(it.nominal)}`).join('\n')}
----------------------------------------
*TOTAL TITIPAN AWAL: ${formatRupiah(total)}*
${payments.length > 0 ? `
Riwayat Pengambilan/Penyerahan Titipan:
${payments.map((p, idx) => `  ${idx + 1}. [${p.tanggal}] ${formatRupiah(p.nominal)} (${p.keterangan || 'Diambil/Diserahkan'})`).join('\n')}
*TOTAL SUDAH DIAMBIL/DIBAYAR: ${formatRupiah(totalBayar)}*
----------------------------------------
*SISA SALDO TITIPAN: ${formatRupiah(calculatedSisa)}*` : `
*SISA SALDO TITIPAN: ${formatRupiah(total)}*`}

Catatan: Dana/barang titipan tercatat dan tersimpan dengan aman di Toko Alma.
Terima kasih 🙏
_Admin Toko Alma_`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageBody);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleSendWhatsApp = () => {
    if (phoneNumber.trim()) {
      saveContactPhone(name, phoneNumber.trim());
    }
    const cleanPhone = toWhatsAppNumber(phoneNumber);
    const encoded = encodeURIComponent(messageBody);
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handlePrintSlip = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${type === 'piutang' ? 'Nota Tagihan' : 'Bukti Titipan'} - ${name}</title>
          <style>
            body { font-family: monospace; font-size: 13px; padding: 20px; max-width: 380px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 12px; }
            .header h2 { margin: 0 0 4px; font-size: 16px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .items { margin: 12px 0; border-bottom: 1px dashed #000; padding-bottom: 8px; }
            .item-row { margin-bottom: 6px; }
            .total { font-weight: bold; font-size: 14px; margin-top: 8px; display: flex; justify-content: space-between; }
            .sisa { font-weight: bold; font-size: 15px; margin-top: 8px; border-top: 1px solid #000; padding-top: 6px; display: flex; justify-content: space-between; }
            .footer { text-align: center; margin-top: 16px; font-size: 11px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>TOKO ALMA</h2>
            <div>${type === 'piutang' ? 'NOTA TAGIHAN PIUTANG' : 'BUKTI SALDO TITIPAN'}</div>
            <div>${todayStr}</div>
          </div>
          <div class="row">
            <span>Nama:</span>
            <strong>${name}</strong>
          </div>
          <div class="items">
            ${items.map(it => `
              <div class="item-row">
                <div>${it.keterangan}</div>
                <div class="row" style="color:#555; font-size:11px;">
                  <span>${it.tanggal}</span>
                  <strong>${formatRupiah(it.nominal)}</strong>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="total">
            <span>Total Awal:</span>
            <span>${formatRupiah(total)}</span>
          </div>
          ${payments.length > 0 ? `
            <div style="margin-top: 8px; font-size: 11px;">
              <div style="font-weight: bold; margin-bottom: 4px;">Riwayat Pembayaran/Pengambilan:</div>
              ${payments.map(p => `
                <div class="row" style="color:#555;">
                  <span>${p.tanggal} - ${p.keterangan || 'Bayar'}</span>
                  <span>- ${formatRupiah(p.nominal)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <div class="sisa">
            <span>SISA:</span>
            <span>${formatRupiah(calculatedSisa)}</span>
          </div>
          <div class="footer">
            <p>Terima kasih atas kerjasamanya 🙏</p>
            <p>Toko Alma</p>
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
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${type === 'piutang' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">{title}</h3>
              <p className="text-xs text-slate-400">Kirim slip rekap per nama ke WhatsApp atau salin teks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Target Customer Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-slate-500">{type === 'piutang' ? 'Nama Pelanggan' : 'Nama Penitip'}</div>
                <div className="text-sm font-bold text-slate-900">{name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Sisa {type === 'piutang' ? 'Tagihan' : 'Titipan'}</div>
              <div className={`text-base font-bold font-mono ${type === 'piutang' ? 'text-blue-600' : 'text-orange-600'}`}>
                {formatRupiah(calculatedSisa)}
              </div>
              {payments.length > 0 && (
                <div className="text-[10px] text-slate-400">
                  Awal: {formatRupiah(total)} | Bayar: {formatRupiah(totalBayar)}
                </div>
              )}
            </div>
          </div>

          {/* Phone Input for WhatsApp */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Nomor WhatsApp Tujuan
              </label>
              <div className="flex items-center gap-1.5">
                {phoneNumber && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Sesuai data {name}</span>
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
                          saveContactPhone(name, picked.phone);
                          return;
                        }
                      } catch (e) {
                        console.warn('Native picker notice:', e);
                      }
                    }
                    setShowInternalContactPicker(true);
                  }}
                  className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60"
                >
                  Ambil Kontak HP
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="tel"
                inputMode="tel"
                placeholder="Contoh: 08123456789 atau 628123456789"
                value={phoneNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9+]/g, '');
                  setPhoneNumber(val);
                  if (val.trim()) {
                    saveContactPhone(name, val.trim());
                  }
                }}
                className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim WA</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {phoneNumber ? (
                <span>Nota rekap akan otomatis dikirimkan ke <strong>{phoneNumber}</strong> ({name}).</span>
              ) : (
                <span>Nomor WA belum tercatat. Masukkan nomor atau ambil kontak agar tersimpan untuk nama ini.</span>
              )}
            </p>
          </div>

          {/* Preview Message */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Pratinjau Teks Pesan
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center space-x-1 cursor-pointer"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tersalin ke Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Pesan</span>
                  </>
                )}
              </button>
            </div>
            <pre className="w-full bg-slate-900 text-slate-200 text-xs font-mono p-3.5 rounded-xl whitespace-pre-wrap border border-slate-800 leading-relaxed max-h-48 overflow-y-auto">
              {messageBody}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              id="btn-share-print-bluetooth"
              type="button"
              onClick={() => setShowBtModal(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              title="Cetak Nota langsung via Printer Bluetooth Thermal"
            >
              <Bluetooth className="w-3.5 h-3.5" />
              <span>Print via Bluetooth</span>
            </button>

            <button
              type="button"
              onClick={handlePrintSlip}
              className="px-3.5 py-2 border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold rounded-lg transition flex items-center space-x-1.5 cursor-pointer"
              title="Cetak struk menggunakan dialog cetak biasa"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Cetak Struk Mini</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Bluetooth Thermal Print Modal */}
      {showBtModal && (
        <BluetoothPrintModal
          isOpen={showBtModal}
          onClose={() => setShowBtModal(false)}
          data={{
            type: type,
            title: title,
            name: name,
            phone: phoneNumber,
            dateStr: todayStr,
            items: items,
            payments: payments,
            total: total,
            totalBayar: totalBayar,
            sisa: calculatedSisa,
          }}
        />
      )}

      {/* Internal Contact Picker Modal */}
      <InternalContactPickerModal
        isOpen={showInternalContactPicker}
        onClose={() => setShowInternalContactPicker(false)}
        targetName={name}
        onSelectContact={(c) => {
          if (c.phone) {
            setPhoneNumber(c.phone);
            saveContactPhone(name, c.phone);
          }
        }}
      />
    </div>
  );
};
