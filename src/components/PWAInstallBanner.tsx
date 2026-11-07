import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Zap, CheckCircle2, CloudLightning } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('pwa_banner_dismissed') === 'true';
  });

  // Jika sudah terpasang di HP, jangan tampilkan banner pasang
  if (isInstalled || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('pwa_banner_dismissed', 'true');
  };

  return (
    <>
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white px-4 py-2.5 shadow-md border-b border-blue-600/50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
              <Zap className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-300/30">
                  Mode Cepat Aktif
                </span>
                <span className="text-xs text-blue-100 hidden sm:inline">
                  Database & Server Siap Buka Seketika
                </span>
              </div>
              <p className="text-xs text-white/90 font-medium">
                Pasang di Layar Utama HP agar aplikasi terbuka instan tanpa menunggu loading browser.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isInstallable && (
              <button
                onClick={install}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-blue-950 text-xs font-bold shadow transition transform active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                Pasang di HP
              </button>
            )}

            {isIOS && (
              <button
                onClick={() => setShowIOSGuide(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur transition"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Pasang di iPhone
              </button>
            )}

            {!isInstallable && !isIOS && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-blue-900/60 px-2.5 py-1 rounded-md text-blue-200 border border-blue-500/30">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Cache Lokal Siap
              </span>
            )}

            <button
              onClick={handleDismiss}
              className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition"
              title="Tutup banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Panduan iPhone / iPad */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  📱
                </div>
                <h3 className="text-base font-bold text-slate-900">Pasang di iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">1</span>
                <p>Buka tautan ini di browser <strong>Safari</strong> di iPhone Anda.</p>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">2</span>
                <p>Ketuk tombol <strong>Bagikan / Share</strong> (ikon kotak dengan panah ke atas di bilah bawah Safari).</p>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">3</span>
                <p>Gulir ke bawah lalu pilih <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong>.</p>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>Ikon <strong>E-Jurnal Toko Alma</strong> akan muncul di layar HP Anda dan dapat dibuka seketika 24 jam nonstop!</p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
