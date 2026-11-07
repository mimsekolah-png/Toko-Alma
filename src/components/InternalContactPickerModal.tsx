import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  Search,
  Upload,
  ExternalLink,
  Smartphone,
  User,
  AlertCircle,
  PlusCircle,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import {
  getStoredContacts,
  saveContactPhone,
  saveBulkContacts,
  parseVcfContacts,
  isContactPickerSupported,
  isInsideIframe,
  pickContactFromDevice,
  formatPhoneNumber,
  isLikelyMobileNumber,
  PickedDeviceContact
} from '../utils/contacts';

export interface InternalContactPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: { name: string; phone: string; allPhones?: string[] }) => void;
  targetName?: string;
  existingCustomers?: Array<{ nama: string; telepon?: string }>;
}

export const InternalContactPickerModal: React.FC<InternalContactPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectContact,
  targetName,
  existingCustomers = [],
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [contactsList, setContactsList] = useState<Array<{ name: string; phone: string; source?: string }>>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [noticeMessage, setNoticeMessage] = useState<{ type: 'info' | 'success' | 'warning'; text: string } | null>(null);
  const [multiPhoneCandidate, setMultiPhoneCandidate] = useState<PickedDeviceContact | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supported = isContactPickerSupported();
  const inIframe = isInsideIframe();

  const loadContacts = () => {
    const map = new Map<string, { phone: string; source: string }>();

    // 1. From existing customer transactions
    for (const cust of existingCustomers) {
      if (cust.nama && cust.telepon && cust.telepon.trim()) {
        map.set(cust.nama.trim(), {
          phone: formatPhoneNumber(cust.telepon),
          source: 'Data Toko',
        });
      }
    }

    // 2. From stored contacts book
    const stored = getStoredContacts();
    for (const [name, phone] of Object.entries(stored)) {
      if (name && phone && phone.trim()) {
        map.set(name.trim(), {
          phone: formatPhoneNumber(phone),
          source: map.has(name.trim()) ? 'Data Toko' : 'Kontak HP',
        });
      }
    }

    const list: Array<{ name: string; phone: string; source: string }> = [];
    map.forEach((val, key) => {
      list.push({ name: key, phone: val.phone, source: val.source });
    });

    list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
    setContactsList(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadContacts();
      setSearchTerm(targetName || '');
      setNoticeMessage(null);
      setMultiPhoneCandidate(null);
    }
  }, [isOpen, targetName]);

  if (!isOpen) return null;

  // Handle direct Android Contact Picker API
  const handleNativePicker = async () => {
    setIsProcessing(true);
    setNoticeMessage(null);
    setMultiPhoneCandidate(null);

    try {
      if (inIframe) {
        setNoticeMessage({
          type: 'warning',
          text: 'Panggilan kontak langsung dibatasi di dalam pratinjau browser. Klik tombol "Buka di Tab Baru Chrome HP" di bawah atau pilih dari kontak di bawah.',
        });
        setIsProcessing(false);
        return;
      }

      if (!supported) {
        setNoticeMessage({
          type: 'warning',
          text: 'Fitur Kontak bawaan otomatis membutuhkan browser Google Chrome di HP Android.',
        });
        setIsProcessing(false);
        return;
      }

      const picked = await pickContactFromDevice();

      // User cancelled
      if (picked?.cancelled) {
        setIsProcessing(false);
        return;
      }

      if (picked && picked.phone) {
        // If contact has multiple phone numbers, let the user choose
        if (picked.allPhones && picked.allPhones.length > 1) {
          setMultiPhoneCandidate(picked);
          setIsProcessing(false);
          return;
        }

        handleFinalContactSelection(picked.name || targetName || 'Pelanggan', picked.phone);
      } else if (picked?.unsupported) {
        setNoticeMessage({
          type: 'warning',
          text: 'Fitur kontak langsung tidak diizinkan di jendela pratinjau. Silakan buka aplikasi di tab baru browser Chrome HP.',
        });
      } else {
        setNoticeMessage({
          type: 'warning',
          text: 'Tidak ada nomor telepon yang ditemukan pada kontak yang dipilih.',
        });
      }
    } catch (e: any) {
      console.warn(e);
      setNoticeMessage({
        type: 'warning',
        text: 'Gagal membuka kontak: ' + (e?.message || 'Izin ditolak oleh perangkat.'),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalContactSelection = (selectedName: string, selectedPhone: string) => {
    const formattedPhone = formatPhoneNumber(selectedPhone);
    const effectiveName = targetName && targetName.trim() ? targetName.trim() : selectedName;

    // Save for both the target name and the address book name
    if (effectiveName) {
      saveContactPhone(effectiveName, formattedPhone);
    }
    if (selectedName && selectedName.toLowerCase() !== effectiveName.toLowerCase()) {
      saveContactPhone(selectedName, formattedPhone);
    }

    onSelectContact({
      name: effectiveName,
      phone: formattedPhone,
    });
    onClose();
  };

  // Handle VCF / vCard file from internal storage
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const parsed = parseVcfContacts(text);
      if (parsed.length === 0) {
        setNoticeMessage({
          type: 'warning',
          text: 'Tidak ditemukan nomor telepon valid dalam file kontak (.vcf) tersebut.',
        });
        return;
      }
      const count = saveBulkContacts(parsed);
      loadContacts();
      setNoticeMessage({
        type: 'success',
        text: `Berhasil memuat dan menyinkronkan ${count} kontak dari file HP Anda!`,
      });

      // If only 1 contact was in file, select it directly
      if (parsed.length === 1) {
        handleFinalContactSelection(parsed[0].name, parsed[0].phone);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const cleanSearch = searchTerm.trim();
  const searchDigits = cleanSearch.replace(/[^0-9]/g, '');

  const filteredContacts = contactsList.filter((c) => {
    const nameMatch = c.name.toLowerCase().includes(cleanSearch.toLowerCase());
    const phoneMatch = searchDigits ? c.phone.includes(searchDigits) : false;
    return nameMatch || phoneMatch;
  });

  // Check if search input looks like a raw phone number that can be used directly
  const isDirectPhoneInput = searchDigits.length >= 8 && searchDigits.length <= 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 to-teal-700 px-4 py-3.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-snug">
                Ambil Kontak WhatsApp HP
              </h3>
              <p className="text-[11px] text-emerald-100">
                {targetName ? `Untuk pelanggan: ${targetName}` : 'Pilih nomor dari kontak internal telepon'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-phone chooser prompt if Android contact has multiple numbers */}
        {multiPhoneCandidate && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Pilih Nomor Kontak untuk "{multiPhoneCandidate.name}":</span>
              </div>
              <button
                type="button"
                onClick={() => setMultiPhoneCandidate(null)}
                className="text-[11px] text-amber-700 hover:underline cursor-pointer"
              >
                Batal
              </button>
            </div>
            <p className="text-[11px] text-amber-800">
              Kontak ini memiliki lebih dari 1 nomor telepon di HP Anda. Pilih nomor yang terdaftar di WhatsApp:
            </p>
            <div className="space-y-1.5 pt-1">
              {multiPhoneCandidate.allPhones.map((ph, idx) => {
                const isMobile = isLikelyMobileNumber(ph);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleFinalContactSelection(multiPhoneCandidate.name, ph)}
                    className="w-full flex items-center justify-between p-2.5 bg-white border border-amber-300 rounded-xl hover:bg-emerald-50 hover:border-emerald-500 transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="font-mono text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                        {ph}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isMobile
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isMobile ? 'Nomor HP (WhatsApp)' : 'Telepon'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Panel */}
        <div className="p-3.5 space-y-2.5 bg-slate-50 border-b border-slate-200">
          {/* Main Action: Native Android Picker Button */}
          <button
            type="button"
            onClick={handleNativePicker}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>
              {isProcessing ? 'Sedang Membuka Kontak HP...' : 'Buka Buku Kontak Internal HP'}
            </span>
          </button>

          {/* Iframe Notice & Open in Tab Baru */}
          {inIframe && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] leading-relaxed">
                <span>
                  Akses kontak HP dibatasi oleh browser di dalam jendela pratinjau. Buka web di tab mandiri agar tombol kontak HP langsung aktif:
                </span>
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="mt-1 flex items-center gap-1 font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka di Tab Baru Chrome HP</span>
                </button>
              </div>
            </div>
          )}

          {/* File VCF / Ekspor Kontak HP option */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".vcf,text/vcard"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 transition cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Impor File Kontak HP (.vcf)</span>
            </button>
          </div>

          {noticeMessage && (
            <div
              className={`text-[11px] p-2 rounded-lg border flex items-start gap-1.5 ${
                noticeMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : noticeMessage.type === 'warning'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              <span className="flex-1">{noticeMessage.text}</span>
              <button
                type="button"
                onClick={() => setNoticeMessage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Search & Saved Contacts List */}
        <div className="p-3.5 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Cari / Kontak Tersimpan ({filteredContacts.length})
            </label>
            {targetName && (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                Target: {targetName}
              </span>
            )}
          </div>

          <div className="relative mb-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Ketik nama atau nomor HP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Direct Use Button when typing a number */}
          {isDirectPhoneInput && (
            <button
              type="button"
              onClick={() => handleFinalContactSelection(targetName || 'Pelanggan', searchDigits)}
              className="mb-2 p-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-bold transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>Gunakan nomor "{formatPhoneNumber(searchDigits)}"</span>
              </div>
              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded">
                Gunakan
              </span>
            </button>
          )}

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[160px] max-h-[250px]">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs space-y-1">
                <User className="w-8 h-8 mx-auto text-slate-300" />
                <p>Tidak ada kontak yang cocok dengan "{searchTerm}".</p>
                {isDirectPhoneInput ? (
                  <p className="text-emerald-700 font-medium">
                    Klik tombol "Gunakan nomor" di atas untuk menetapkan nomor ini.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Ketik nomor HP langsung di kolom pencarian atau klik tombol Buka Kontak HP di atas.
                  </p>
                )}
              </div>
            ) : (
              filteredContacts.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleFinalContactSelection(c.name, c.phone)}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50/80 border border-slate-100 hover:border-emerald-300 flex items-center justify-between transition cursor-pointer group bg-white shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                      {c.name ? c.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-800 truncate">
                        {c.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{c.phone}</span>
                        {c.source && (
                          <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded font-sans">
                            {c.source}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pl-2">
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 group-hover:bg-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <span>Pilih</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
