import React, { useState, useEffect } from 'react';
import { X, Phone, UserCheck, BookOpen, Check } from 'lucide-react';
import { pickContactFromDevice, isContactPickerSupported, isInsideIframe } from '../utils/contacts';
import { InternalContactPickerModal } from './InternalContactPickerModal';

interface EditContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  initialPhone?: string;
  onSave: (name: string, phone: string) => void;
}

export const EditContactModal: React.FC<EditContactModalProps> = ({
  isOpen,
  onClose,
  customerName,
  initialPhone = '',
  onSave,
}) => {
  const [phone, setPhone] = useState<string>(initialPhone);
  const [showPickerModal, setShowPickerModal] = useState<boolean>(false);

  useEffect(() => {
    setPhone(initialPhone || '');
  }, [initialPhone, isOpen]);

  if (!isOpen) return null;

  const handlePickFromDevice = async () => {
    if (isContactPickerSupported() && !isInsideIframe()) {
      try {
        const picked = await pickContactFromDevice();
        if (picked?.cancelled) {
          return;
        }
        if (picked?.phone) {
          if (picked.allPhones && picked.allPhones.length > 1) {
            setShowPickerModal(true);
            return;
          }
          setPhone(picked.phone);
          return;
        }
      } catch (e) {
        console.warn('Native picker notice, opening internal contact modal', e);
      }
    }
    setShowPickerModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(customerName, phone.trim());
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200">
          <div className="bg-emerald-600 text-white p-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">Hubungkan Nomor WA</h3>
                <p className="text-[10px] text-emerald-100">Buku Kontak Toko Alma</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Nama Pelanggan / Penitip
                </span>
                <span className="text-xs font-bold text-slate-800 truncate block">
                  {customerName}
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Nomor WhatsApp / HP *
                </label>
                <button
                  type="button"
                  onClick={handlePickFromDevice}
                  className="text-[11px] text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded"
                  title="Buka daftar kontak dari buku telepon internal HP"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Ambil Kontak HP</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                  placeholder="Contoh: 08123456789"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                Nomor ini akan otomatis tersimpan & terhubung ke nama <strong>{customerName}</strong> di seluruh buku piutang, titipan, dan nota berikutnya tanpa perlu ketik ulang.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 border border-slate-200 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan No WA</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <InternalContactPickerModal
        isOpen={showPickerModal}
        onClose={() => setShowPickerModal(false)}
        targetName={customerName}
        onSelectContact={(c) => {
          if (c.phone) setPhone(c.phone);
        }}
      />
    </>
  );
};
