import React, { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Bluetooth, 
  BluetoothConnected, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  FileText, 
  Copy, 
  Settings2,
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { 
  bluetoothPrinter, 
  PrinterState, 
  ReceiptData, 
  PaperWidth, 
  PrintDensity,
  generateReceiptPlainText, 
  printReceiptViaBrowser,
  openRawBtPrint
} from '../utils/bluetoothPrinter';

interface BluetoothPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: ReceiptData | null;
  receiptData?: ReceiptData | null;
  onSuccess?: (msg: string) => void;
}

export const BluetoothPrintModal: React.FC<BluetoothPrintModalProps> = ({
  isOpen,
  onClose,
  data,
  receiptData,
  onSuccess,
}) => {
  const activeData = data || receiptData;
  const [printerState, setPrinterState] = useState<PrinterState>(bluetoothPrinter.getState());
  const [paperWidth, setPaperWidth] = useState<PaperWidth>(32); // 32 = 58mm, 48 = 80mm
  const [density, setDensity] = useState<PrintDensity>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ejurnal_print_density');
      if (saved === 'extra' || saved === 'bold' || saved === 'normal') {
        return saved as PrintDensity;
      }
    }
    return 'extra'; // Default is Sangat Tebal & Pekat (Bold+)
  });
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleDensityChange = (newDensity: PrintDensity) => {
    setDensity(newDensity);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ejurnal_print_density', newDensity);
    }
  };

  useEffect(() => {
    const unsubscribe = bluetoothPrinter.subscribe((state) => {
      setPrinterState(state);
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen || !activeData) return null;

  const isBtSupported = bluetoothPrinter.isSupported();
  const receiptPreview = generateReceiptPlainText(activeData, paperWidth);

  const handleConnect = async () => {
    setPrintStatus('Mencari printer bluetooth di sekitar...');
    const ok = await bluetoothPrinter.connect();
    if (ok) {
      setPrintStatus('Printer bluetooth berhasil terhubung!');
      setTimeout(() => setPrintStatus(null), 3000);
    } else {
      setPrintStatus(null);
    }
  };

  const handleDisconnect = async () => {
    await bluetoothPrinter.disconnect();
    setPrintStatus('Koneksi printer diputuskan.');
    setTimeout(() => setPrintStatus(null), 2500);
  };

  const handlePrintBluetooth = async () => {
    setIsPrinting(true);
    setPrintStatus('Mengirim data ke printer bluetooth...');
    try {
      if (!printerState.isConnected) {
        const ok = await bluetoothPrinter.connect();
        if (!ok) {
          setIsPrinting(false);
          return;
        }
      }

      await bluetoothPrinter.printReceipt(activeData, paperWidth, density);
      setPrintStatus('Nota berhasil dicetak!');
      if (onSuccess) {
        onSuccess('Nota berhasil dicetak via Bluetooth!');
      }
      setTimeout(() => {
        setPrintStatus(null);
        setIsPrinting(false);
      }, 2500);
    } catch (err: any) {
      console.warn('Print notice:', err?.message || err);
      setPrintStatus(`Gagal mencetak: ${err?.message || 'Periksa koneksi Bluetooth'}`);
      setIsPrinting(false);
    }
  };

  const handleTestPrint = async () => {
    setIsPrinting(true);
    setPrintStatus('Mencetak nota tes...');
    try {
      await bluetoothPrinter.printReceipt({ type: 'test' }, paperWidth, density);
      setPrintStatus('Nota tes berhasil dicetak!');
      setTimeout(() => {
        setPrintStatus(null);
        setIsPrinting(false);
      }, 2500);
    } catch (err: any) {
      setPrintStatus(`Gagal test print: ${err?.message || 'Error'}`);
      setIsPrinting(false);
    }
  };

  const handleBrowserPrint = () => {
    setPrintStatus('Membuka dialog cetak...');
    const ok = printReceiptViaBrowser(activeData, paperWidth, density);
    if (ok) {
      setTimeout(() => setPrintStatus('Dialog cetak terbuka.'), 500);
      setTimeout(() => setPrintStatus(null), 3500);
    } else {
      setPrintStatus('Gagal membuka dialog cetak browser.');
    }
  };

  const handleRawBtPrint = () => {
    openRawBtPrint(activeData, paperWidth);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(receiptPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy error', e);
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold flex items-center gap-1.5">
                <span>Print Nota via Bluetooth</span>
                <span className="text-[10px] bg-blue-500/30 text-blue-300 font-semibold px-2 py-0.5 rounded-full">
                  Thermal POS
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Cetak struk langsung ke printer thermal mini (58mm / 80mm)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Iframe / Preview Policy Notice */}
          {(typeof window !== 'undefined' && (window.self !== window.top || !bluetoothPrinter.isPolicyAllowed())) && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-blue-900">Perhatian: Mode Pratinjau (iFrame)</div>
                  <p className="text-[11px] text-blue-700 leading-relaxed mt-0.5">
                    Kebijakan keamanan browser membatasi koneksi Web Bluetooth di dalam bingkai pratinjau. Buka di Tab Baru browser untuk menyambungkan printer Bluetooth fisik, atau gunakan opsi <strong>Cetak Biasa</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openInNewTab}
                className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka di Tab Baru</span>
              </button>
            </div>
          )}

          {/* Printer Connection Status Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  printerState.isConnected
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {printerState.isConnected ? (
                  <BluetoothConnected className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Bluetooth className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Status Printer:</div>
                <div className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      printerState.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span>
                    {printerState.isConnected
                      ? `Terhubung: ${printerState.deviceName || 'Printer Thermal'}`
                      : 'Belum Terhubung'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {printerState.isConnected ? (
                <>
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    disabled={isPrinting}
                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition cursor-pointer"
                    title="Uji coba cetak nota tes"
                  >
                    Tes Cetak
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Putuskan
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={printerState.isConnecting}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {printerState.isConnecting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bluetooth className="w-3.5 h-3.5" />
                  )}
                  <span>{printerState.isConnecting ? 'Mencari...' : 'Sambungkan Bluetooth'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Status / Error feedback */}
          {printStatus && (
            <div
              className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                printStatus.includes('Gagal') || printStatus.includes('Error')
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{printStatus}</span>
            </div>
          )}

          {printerState.error && (
            <div className="p-2.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Catatan Koneksi Bluetooth:</span>
              </div>
              <p>{printerState.error}</p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="text-blue-700 hover:underline font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka di Tab Baru agar izin Bluetooth lancar</span>
                </button>
              </div>
            </div>
          )}

          {/* Options: Paper Width & Print Darkness / Density */}
          <div className="space-y-2.5 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ukuran Kertas:</span>
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaperWidth(32)}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      paperWidth === 32
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    58 mm (Mini)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperWidth(48)}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      paperWidth === 48
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    80 mm (Lebar)
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyText}
                className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copied ? 'Tersalin' : 'Salin Teks Nota'}</span>
              </button>
            </div>

            {/* Print Darkness / Thickness Setting */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                  <span className="text-xs font-bold text-slate-800">
                    Ketebalan Huruf Cetak:
                  </span>
                  <span className="text-[10px] bg-slate-900 text-white font-bold px-1.5 py-0.5 rounded shadow-2xs">
                    {density === 'extra' ? 'Sangat Tebal (Bold+)' : density === 'bold' ? 'Tebal (Bold)' : 'Normal'}
                  </span>
                </div>
                <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleDensityChange('extra')}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
                      density === 'extra'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🔥 Sangat Tebal (Bold+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDensityChange('bold')}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      density === 'bold'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Tebal (Bold)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDensityChange('normal')}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      density === 'normal'
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>Normal</span>
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                {density === 'extra' ? (
                  <span>✅ <strong>Mode Sangat Tebal aktif:</strong> Pemanasan thermal head ditingkatkan & teks dicetak ganda (double-strike + emphasized) agar tulisan pekat, tebal, dan sangat jelas terbaca.</span>
                ) : density === 'bold' ? (
                  <span>Teks dicetak dengan huruf tebal (emphasized mode aktif).</span>
                ) : (
                  <span>Format cetak standar (hemat daya & kertas).</span>
                )}
              </p>
            </div>
          </div>

          {/* Live Receipt Paper Simulation Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Pratinjau Struk Cetak ({paperWidth === 32 ? '58mm - 32 Karakter' : '80mm - 48 Karakter'}):
              </label>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {density === 'extra' ? 'Ketebalan: Sangat Tebal (Bold+)' : density === 'bold' ? 'Ketebalan: Tebal (Bold)' : 'Ketebalan: Normal'}
              </span>
            </div>
            <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/70 shadow-inner flex justify-center">
              <div
                className={`bg-white border border-slate-300 rounded shadow-md p-4 font-mono text-slate-950 leading-tight select-all text-xs ${
                  paperWidth === 32 ? 'w-full max-w-[280px]' : 'w-full max-w-[380px]'
                }`}
              >
                <pre 
                  className="whitespace-pre font-mono text-[11px] sm:text-xs leading-snug overflow-x-auto text-black"
                  style={{
                    fontWeight: density === 'extra' ? 900 : density === 'bold' ? 700 : 500,
                    textShadow: density === 'extra' ? '0 0 0.5px #000, 0 0 0.5px #000' : density === 'bold' ? '0 0 0.3px #000' : 'none',
                    WebkitTextStroke: density === 'extra' ? '0.35px #000' : density === 'bold' ? '0.15px #000' : 'none'
                  }}
                >
                  {receiptPreview}
                </pre>
              </div>
            </div>
          </div>

          {/* Guide / Troubleshooting Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1 leading-relaxed">
            <div className="font-bold text-slate-700 flex items-center gap-1">
              <span>💡 Petunjuk Penggunaan Printer Bluetooth:</span>
            </div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Nyalakan Bluetooth pada HP / Komputer Anda dan nyalakan printer thermal.</li>
              <li>Klik tombol <strong>"Sambungkan Bluetooth"</strong> lalu pilih nama printer Anda (contoh: <em>RPP02N, PT-210, POS-58, Panda, VSC</em>).</li>
              <li>Jika Bluetooth tidak muncul atau terhalang izin iframe, gunakan tombol <strong>"Cetak Biasa (58mm/80mm)"</strong> atau buka aplikasi di tab baru.</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="px-3.5 py-2 border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Cetak struk menggunakan dialog cetak browser (mendukung printer USB, Bluetooth via RawBT, atau PDF)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Cetak Biasa ({paperWidth === 32 ? '58mm' : '80mm'})</span>
            </button>

            <button
              type="button"
              onClick={handleRawBtPrint}
              className="px-3 py-2 border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Kirim ke aplikasi RawBT Printer Android"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span>RawBT</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 hover:bg-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Tutup
            </button>

            <button
              id="btn-print-bluetooth-execute"
              type="button"
              onClick={handlePrintBluetooth}
              disabled={isPrinting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isPrinting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bluetooth className="w-3.5 h-3.5" />
              )}
              <span>{isPrinting ? 'Sedang Mencetak...' : 'Cetak via Bluetooth'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
