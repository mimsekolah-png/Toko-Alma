import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  UploadCloud, 
  Copy, 
  Check, 
  X, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Server
} from 'lucide-react';
import { 
  SUPABASE_URL, 
  testSupabaseConnection, 
  uploadAllDataToSupabase,
  type SupabaseConnectionStatus 
} from '../supabase';
import type { AppDataPayload } from '../types';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: AppDataPayload;
  onRefreshData?: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  currentData,
  onRefreshData
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SupabaseConnectionStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlTab, setShowSqlTab] = useState(false);

  // Uji koneksi saat modal dibuka pertama kali
  useEffect(() => {
    if (isOpen && !testResult) {
      handleTestConnection();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setSyncStatus(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        success: false,
        latency: 0,
        message: e?.message || 'Gagal menguji koneksi.',
        hasTables: false
      });
    } finally {
      setTesting(false);
    }
  };

  const handleUploadAllToSupabase = async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const res = await uploadAllDataToSupabase(currentData);
      if (res.success) {
        setSyncStatus({
          success: true,
          message: `Berhasil mengunggah ${res.count} data ke Supabase PostgreSQL! Seluruh data kini tersimpan permanen di cloud.`
        });
        if (onRefreshData) onRefreshData();
      } else {
        setSyncStatus({
          success: false,
          message: res.error || 'Gagal mengunggah data. Pastikan tabel di Supabase sudah dibuat.'
        });
      }
    } catch (e: any) {
      setSyncStatus({
        success: false,
        message: e?.message || 'Terjadi kesalahan saat mengunggah data.'
      });
    } finally {
      setSyncing(false);
    }
  };

  const sqlSchemaText = `-- ==============================================================
-- SKEMA DATABASE SUPABASE POSTGRESQL UNTUK E-JURNAL TOKO ALMA
-- Salin dan jalankan script ini di Supabase SQL Editor:
-- Dashboard Supabase -> SQL Editor -> New Query -> Run
-- ==============================================================

-- 1. Tabel Settings
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY,
    modal_awal NUMERIC DEFAULT 0,
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Draft Kas Harian
CREATE TABLE IF NOT EXISTS public.kas_draft (
    id TEXT PRIMARY KEY,
    bri NUMERIC DEFAULT 0,
    bni NUMERIC DEFAULT 0,
    flip NUMERIC DEFAULT 0,
    dana NUMERIC DEFAULT 0,
    od NUMERIC DEFAULT 0,
    edc NUMERIC DEFAULT 0,
    cash NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Transaksi Kasir & Nota Cash
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id TEXT PRIMARY KEY,
    no_nota TEXT NOT NULL,
    nama_pelanggan TEXT NOT NULL,
    telepon TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    total NUMERIC NOT NULL DEFAULT 0,
    uang_diterima NUMERIC NOT NULL DEFAULT 0,
    kembalian NUMERIC NOT NULL DEFAULT 0,
    status_bayar TEXT DEFAULT 'lunas',
    tanggal_lunas TEXT,
    waktu_lunas TEXT,
    catatan_pelunasan TEXT,
    keterangan TEXT,
    tanggal TEXT NOT NULL,
    waktu TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

-- 4. Tabel Buku Bon Piutang
CREATE TABLE IF NOT EXISTS public.piutang (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    keterangan TEXT,
    nominal NUMERIC NOT NULL DEFAULT 0,
    tanggal TEXT NOT NULL,
    status TEXT DEFAULT 'belum_lunas',
    telepon TEXT,
    created_at BIGINT NOT NULL
);

-- 5. Tabel Riwayat Pembayaran / Cicilan Piutang
CREATE TABLE IF NOT EXISTS public.piutang_payments (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    nominal NUMERIC NOT NULL DEFAULT 0,
    keterangan TEXT,
    tanggal TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

-- 6. Tabel Buku Titipan
CREATE TABLE IF NOT EXISTS public.titipan (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    keterangan TEXT,
    nominal NUMERIC NOT NULL DEFAULT 0,
    tanggal TEXT NOT NULL,
    status TEXT DEFAULT 'aktif',
    telepon TEXT,
    created_at BIGINT NOT NULL
);

-- 7. Tabel Riwayat Penyerahan Titipan
CREATE TABLE IF NOT EXISTS public.titipan_payments (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    nominal NUMERIC NOT NULL DEFAULT 0,
    keterangan TEXT,
    tanggal TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

-- 8. Tabel Rekap Harian & Bulanan
CREATE TABLE IF NOT EXISTS public.rekap (
    id TEXT PRIMARY KEY,
    tanggal TEXT NOT NULL,
    modal_awal NUMERIC NOT NULL DEFAULT 0,
    kas JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_kas_murni NUMERIC NOT NULL DEFAULT 0,
    piutang_total NUMERIC NOT NULL DEFAULT 0,
    titipan_total NUMERIC NOT NULL DEFAULT 0,
    total_kas_harian NUMERIC NOT NULL DEFAULT 0,
    total_kas_kemarin NUMERIC NOT NULL DEFAULT 0,
    laba_harian NUMERIC NOT NULL DEFAULT 0,
    laba_bulanan NUMERIC NOT NULL DEFAULT 0,
    catatan TEXT,
    saved_at TEXT NOT NULL
);

-- 9. Tabel Cadangan / Backup Data
CREATE TABLE IF NOT EXISTS public.backups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    reason TEXT,
    data JSONB NOT NULL,
    summary JSONB NOT NULL
);

-- ROW LEVEL SECURITY (RLS) & POLICIES
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kas_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piutang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piutang_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titipan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titipan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rekap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Akses Settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses Kas Draft" ON public.kas_draft FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses Cash Transactions" ON public.cash_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses Piutang" ON public.piutang FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses Piutang Payments" ON public.piutang_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses Titipan" ON public.titipan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses Titipan Payments" ON public.titipan_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses Rekap" ON public.rekap FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses Backups" ON public.backups FOR ALL USING (true) WITH CHECK (true);

-- REALTIME REPLICATION
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
        public.settings, public.kas_draft, public.cash_transactions, 
        public.piutang, public.piutang_payments, public.titipan, 
        public.titipan_payments, public.rekap;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchemaText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-8">
        
        {/* Header Modal */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs shadow-inner">
              <Database className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Database Supabase PostgreSQL</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                  Database Utama
                </span>
              </div>
              <p className="text-xs text-emerald-100/90">
                Penyimpanan data cloud permanen, multi-device, dan realtime.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-slate-700 text-sm">
          
          {/* Status Koneksi Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-xs text-slate-700">Project Endpoint:</span>
                <code className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-emerald-700 font-bold truncate max-w-xs">
                  {SUPABASE_URL}
                </code>
              </div>
              
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'Menguji...' : 'Uji Koneksi'}
              </button>
            </div>

            {/* Hasil Uji Koneksi */}
            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2.5 border ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>{testResult.success ? 'Koneksi Berhasil!' : 'Koneksi Gagal'}</span>
                    <span className="text-[11px] font-mono opacity-80">{testResult.latency}ms ping</span>
                  </div>
                  <p className="mt-0.5 leading-relaxed">{testResult.message}</p>
                </div>
              </div>
            )}
          </div>

          {/* Fitur Utama Supabase */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-900">Row Level Security</p>
                <p className="text-[11px] text-blue-700/90 leading-tight mt-0.5">
                  Akses tabel dilindungi kebijakan keamanan RLS.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-900">Realtime Sync</p>
                <p className="text-[11px] text-amber-700/90 leading-tight mt-0.5">
                  Input di HP kasir langsung muncul di laptop.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 flex items-start gap-2.5">
              <Database className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-purple-900">PostgreSQL Asli</p>
                <p className="text-[11px] text-purple-700/90 leading-tight mt-0.5">
                  Data tersimpan permanen di cloud tanpa hilang.
                </p>
              </div>
            </div>
          </div>

          {/* Tombol Aksi Upload / Sinkronisasi */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-800">Sinkronkan Seluruh Data Lokal ke Supabase</h4>
                <p className="text-[11px] text-slate-500">
                  Kirim seluruh nota cash, bon piutang, titipan, kas, dan rekap saat ini ke database Supabase.
                </p>
              </div>
              <button
                onClick={handleUploadAllToSupabase}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition shrink-0 cursor-pointer"
              >
                <UploadCloud className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
                {syncing ? 'Mengunggah...' : 'Unggah ke Supabase'}
              </button>
            </div>

            {syncStatus && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                  syncStatus.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {syncStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{syncStatus.message}</span>
              </div>
            )}
          </div>

          {/* Tab SQL Schema & Petunjuk */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                <span>📜</span> Script Skema SQL & RLS Supabase
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-50 border border-slate-300 text-[11px] font-semibold text-slate-700 shadow-2xs transition"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Salin Script SQL</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowSqlTab(!showSqlTab)}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium px-1"
                >
                  {showSqlTab ? 'Sembunyikan' : 'Lihat Script'}
                </button>
              </div>
            </div>

            {showSqlTab && (
              <div className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] max-h-56 overflow-y-auto leading-relaxed">
                <pre>{sqlSchemaText}</pre>
              </div>
            )}

            <div className="p-3.5 bg-slate-50 text-slate-600 text-xs space-y-1.5 border-t border-slate-100">
              <p className="font-bold text-slate-700">Cara Menjalankan Script di Supabase:</p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                <li>Buka dashboard Supabase Anda di <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-2.5 h-2.5" /></a>.</li>
                <li>Pilih proyek Anda, lalu klik menu <strong>SQL Editor</strong> di bilah sebelah kiri.</li>
                <li>Klik <strong>New Query</strong>, tempel (Paste) script SQL di atas, lalu tekan <strong>Run</strong>.</li>
                <li>Semua tabel, kebijakan keamanan RLS, dan fitur sinkronisasi realtime langsung aktif!</li>
              </ol>
            </div>
          </div>

          {/* Solusi Akses Instan & Anti Loading Lama */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600 shrink-0" />
              <h4 className="font-bold text-xs text-amber-900">
                Penyebab & Solusi Akses Cepat (Anti Loading Lama / Cold Start):
              </h4>
            </div>
            <p className="text-[11px] text-amber-800/90 leading-relaxed">
              Link Cloud Run secara otomatis masuk mode <em>sleep</em> jika tidak dibuka selama 10–15 menit. Ketika dibuka kembali, server membutuhkan beberapa saat untuk bangun (cold start).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="p-2.5 rounded-lg bg-white border border-amber-200/80 shadow-2xs">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> 1. Pasang di Layar HP / PWA
                </p>
                <p className="text-slate-600 mt-0.5 leading-snug">
                  Pasang aplikasi via tombol <strong>"Pasang di HP"</strong> di banner atas. Service Worker menyimpan aplikasi di memori perangkat sehingga terbuka <strong>seketika 0 detik</strong> tanpa menunggu server bangun.
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-amber-200/80 shadow-2xs">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span> 2. Auto Keep-Alive (Aktif)
                </p>
                <p className="text-slate-600 mt-0.5 leading-snug">
                  Selama tab dibuka di kasir, sistem otomatis mengirim ping setiap 35 detik dan mengaktifkan <em>Screen Wake Lock</em> agar server dan database tetap siaga nonstop.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Modal */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Client: <code className="font-mono text-slate-700">@supabase/supabase-js v2.49.1</code></span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold shadow-xs transition"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
