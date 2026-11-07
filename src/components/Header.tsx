import React from 'react';
import { 
  Menu, 
  Layers, 
  Wallet, 
  TrendingUp, 
  FileSpreadsheet,
  Calendar,
  FolderArchive,
  Database
} from 'lucide-react';
import { ActiveTab } from '../types';
import { formatRupiah, formatTanggalIndo, getTodayDateString } from '../utils/formatters';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  totalKasHarian: number;
  labaHarian: number;
  labaBulanan: number;
  onResetData?: () => void;
  viewMode: 'tabs' | 'accordion';
  setViewMode: (mode: 'tabs' | 'accordion') => void;
  onOpenSupabaseModal?: () => void;
  isSupabaseConnected?: boolean;
  onOpenBackupModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  totalKasHarian,
  labaHarian,
  labaBulanan,
  viewMode,
  setViewMode,
  onOpenSupabaseModal,
  isSupabaseConnected = true,
  onOpenBackupModal,
}) => {
  const todayFormatted = formatTanggalIndo(getTodayDateString());

  const tabLabels: Record<ActiveTab, string> = {
    jurnal: 'Input Harian',
    piutang: 'Buku Piutang',
    titipan: 'Buku Titipan',
    rekap: 'Rekap Bulanan',
    cash: 'Pembuat Nota',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 z-10 select-none shadow-2xs">
      {/* Left: Breadcrumbs & Status Tag */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Toggle Button for mobile / desktop sidebar */}
        <button
          id="btn-toggle-menu-bar"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition"
          title={isSidebarCollapsed ? "Buka Menu Navigasi" : "Tutup Menu Navigasi"}
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs sm:text-sm font-semibold text-slate-500">
            Dashboard / <strong className="text-slate-800">{tabLabels[activeTab]}</strong>
          </span>
          <span 
            className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-green-100 text-green-700 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 cursor-help"
            title="Server & Database Terhubung • Keep-Alive Aktif (Server & Link Selalu Siaga)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
            Siaga & Aktif
          </span>
        </div>
      </div>

      {/* Center: High Density Quick Snapshot */}
      <div className="hidden lg:flex items-center gap-3 text-xs">
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Kas:</span>
          <span className="font-bold font-mono text-slate-800">{formatRupiah(totalKasHarian)}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Laba Hari:</span>
          <span className={`font-bold font-mono ${labaHarian >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {labaHarian >= 0 ? '+' : ''}{formatRupiah(labaHarian)}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Laba Bulan:</span>
          <span className={`font-bold font-mono ${labaBulanan >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
            {labaBulanan >= 0 ? '+' : ''}{formatRupiah(labaBulanan)}
          </span>
        </div>
      </div>

      {/* Right: Date Info & Actions */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Tanggal Hari Ini</p>
          <p className="text-xs sm:text-sm font-bold text-slate-800">{todayFormatted}</p>
        </div>

        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
          {/* Supabase PostgreSQL Status Trigger */}
          {onOpenSupabaseModal && (
            <button
              id="btn-supabase-status"
              onClick={onOpenSupabaseModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold transition cursor-pointer"
              title="Kelola Database Supabase PostgreSQL, RLS, Uji Koneksi & Sinkronisasi"
            >
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline font-bold">Supabase DB</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isSupabaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
                title={isSupabaseConnected ? 'Terhubung ke Supabase PostgreSQL' : 'Menghubungkan ke Supabase'}
              ></span>
            </button>
          )}

          {/* Backup & Pulihkan Trigger */}
          {onOpenBackupModal && (
            <button
              id="btn-backup-restore-header"
              onClick={onOpenBackupModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-xs font-semibold transition cursor-pointer"
              title="Backup & Pulihkan Data (Kembalikan data jika salah input)"
            >
              <FolderArchive className="w-3.5 h-3.5 text-teal-600" />
              <span className="hidden sm:inline">Backup & Pulihkan</span>
            </button>
          )}

          <button
            id="btn-switch-view-mode-header"
            onClick={() => setViewMode(viewMode === 'tabs' ? 'accordion' : 'tabs')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            title={viewMode === 'tabs' ? "Buka Semua Menu (Mode Akordeon)" : "Mode Tab Tunggal"}
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
