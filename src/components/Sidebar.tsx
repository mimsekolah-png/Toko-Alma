import React, { useState } from 'react';
import { 
  Store, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  FileText, 
  Coins, 
  Archive, 
  FileSpreadsheet,
  Receipt,
  CheckCircle2,
  RotateCcw,
  Lock,
  ShieldAlert,
  X,
  FolderArchive,
  Database
} from 'lucide-react';
import { ActiveTab } from '../types';
import { formatTanggalIndo, getTodayDateString } from '../utils/formatters';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  lastUpdatedDate?: string;
  viewMode: 'tabs' | 'accordion';
  setViewMode: (mode: 'tabs' | 'accordion') => void;
  onResetData?: () => void;
  onOpenBackupModal?: () => void;
  onOpenSupabaseModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  lastUpdatedDate,
  viewMode,
  setViewMode,
  onResetData,
  onOpenBackupModal,
  onOpenSupabaseModal,
}) => {
  const [showSecurityZone, setShowSecurityZone] = useState<boolean>(false);

  const navItems: { id: ActiveTab; label: string; num: string; icon: React.ElementType }[] = [
    { id: 'jurnal', label: 'Menu 1: Input Harian', num: '1', icon: FileText },
    { id: 'piutang', label: 'Menu 2: Piutang', num: '2', icon: Coins },
    { id: 'titipan', label: 'Menu 3: Titipan', num: '3', icon: Archive },
    { id: 'rekap', label: 'Menu 4: Rekap Bulanan', num: '4', icon: FileSpreadsheet },
    { id: 'cash', label: 'Menu 5: Pembuat Nota', num: '5', icon: Receipt },
  ];

  const todayFormatted = formatTanggalIndo(lastUpdatedDate || getTodayDateString());

  return (
    <>
      {/* Mobile Backdrop when Sidebar is Open */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-2xs z-30 sm:hidden transition-opacity" 
          onClick={() => setIsCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${
          isCollapsed ? 'hidden sm:flex sm:w-16' : 'fixed inset-y-0 left-0 z-40 w-64 sm:relative sm:w-64'
        } bg-[#1e293b] text-white flex flex-col shrink-0 transition-all duration-200 select-none border-r border-slate-700/80 shadow-lg`}
      >
        {/* Brand Header */}
        <div className={`p-4 ${isCollapsed ? 'px-2 text-center' : 'p-6'} border-b border-slate-700 flex items-center justify-between`}>
          {!isCollapsed ? (
            <div>
              <h1 className="text-xl font-bold tracking-tight text-blue-400 flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-400 inline shrink-0" />
                <span>E-Jurnal Toko Alma</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">
                Sistem Rekap Keuangan
              </p>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div 
                className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold cursor-pointer hover:bg-blue-500 transition"
                onClick={() => setIsCollapsed(false)}
                title="Buka Menu"
              >
                <Store className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Navigation List */}
        <nav className={`flex-1 ${isCollapsed ? 'p-2 space-y-2' : 'p-4 space-y-2'} text-sm overflow-y-auto`}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id);
                  if (viewMode === 'accordion') {
                    const el = document.getElementById(`section-${item.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }
                  // Close on mobile after selection
                  if (window.innerWidth < 640) {
                    setIsCollapsed(true);
                  }
                }}
                title={item.label}
                className={`w-full flex items-center gap-3 ${
                  isCollapsed ? 'p-2.5 justify-center' : 'p-3'
                } rounded-lg cursor-pointer transition text-left ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'hover:bg-slate-700 text-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </button>
            );
          })}

          {/* View Mode Switcher & Reset in Sidebar */}
          <div className="pt-4 mt-4 border-t border-slate-700/60 space-y-1.5">
            <button
              onClick={() => setViewMode(viewMode === 'tabs' ? 'accordion' : 'tabs')}
              className={`w-full flex items-center gap-3 ${
                isCollapsed ? 'p-2.5 justify-center' : 'p-2.5 px-3'
              } rounded-lg text-xs hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer`}
              title={viewMode === 'tabs' ? 'Ganti ke Mode Buka Semua (Akordeon)' : 'Ganti ke Mode Tab Tunggal'}
            >
              <Layers className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              {!isCollapsed && (
                <span className="truncate">
                  {viewMode === 'tabs' ? 'Buka Semua Menu' : 'Mode Tab Tunggal'}
                </span>
              )}
            </button>

            {onOpenSupabaseModal && (
              <button
                id="btn-sidebar-supabase"
                onClick={() => {
                  onOpenSupabaseModal();
                  if (window.innerWidth < 640) {
                    setIsCollapsed(true);
                  }
                }}
                className={`w-full flex items-center gap-3 ${
                  isCollapsed ? 'p-2.5 justify-center' : 'p-2.5 px-3'
                } rounded-lg text-xs bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/60 hover:text-white transition cursor-pointer font-medium`}
                title="Database Supabase PostgreSQL & RLS"
              >
                <Database className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                {!isCollapsed && (
                  <span className="truncate">Database Supabase</span>
                )}
              </button>
            )}

            {onOpenBackupModal && (
              <button
                id="btn-sidebar-backup-restore"
                onClick={() => {
                  onOpenBackupModal();
                  if (window.innerWidth < 640) {
                    setIsCollapsed(true);
                  }
                }}
                className={`w-full flex items-center gap-3 ${
                  isCollapsed ? 'p-2.5 justify-center' : 'p-2.5 px-3'
                } rounded-lg text-xs bg-teal-950/40 border border-teal-800/60 text-teal-300 hover:bg-teal-900/60 hover:text-white transition cursor-pointer font-medium`}
                title="Backup & Pulihkan Data Toko"
              >
                <FolderArchive className="w-3.5 h-3.5 shrink-0 text-teal-400" />
                {!isCollapsed && (
                  <span className="truncate">Backup & Pulihkan</span>
                )}
              </button>
            )}

            {onResetData && (
              <div className="pt-2">
                {!showSecurityZone ? (
                  <button
                    id="btn-sidebar-security-toggle"
                    onClick={() => {
                      if (isCollapsed) {
                        setIsCollapsed(false);
                      }
                      setShowSecurityZone(true);
                    }}
                    className={`w-full flex items-center gap-3 ${
                      isCollapsed ? 'p-2.5 justify-center' : 'p-2 px-3'
                    } rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition cursor-pointer`}
                    title="Akses Keamanan & Opsi Reset"
                  >
                    <Lock className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    {!isCollapsed && (
                      <span className="truncate text-[11px] text-slate-400">Keamanan Data</span>
                    )}
                  </button>
                ) : (
                  <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 uppercase tracking-wider">
                        <ShieldAlert className="w-3 h-3 text-amber-400" />
                        Akses Pemilik
                      </span>
                      <button
                        onClick={() => setShowSecurityZone(false)}
                        className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
                        title="Tutup & Sembunyikan"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Opsi reset sengaja disembunyikan agar aman dari kesalahan klik.
                    </p>
                    <button
                      id="btn-sidebar-reset-data"
                      onClick={() => {
                        onResetData();
                        setShowSecurityZone(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-semibold bg-rose-950/60 border border-rose-800/80 text-rose-300 hover:bg-rose-900/80 hover:text-white transition cursor-pointer"
                      title="Buka dialog konfirmasi reset data"
                    >
                      <RotateCcw className="w-3 h-3 text-rose-400" />
                      <span>Buka Opsi Reset</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Collapse / Expand Toggle Button */}
        <div className="px-3 py-2 border-t border-slate-700/60 flex justify-end">
          <button
            id="btn-toggle-sidebar-collapse"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition text-xs flex items-center gap-1.5 w-full justify-center cursor-pointer"
            title={isCollapsed ? 'Buka Menu Samping' : 'Tutup Menu Samping'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[11px]">Tutup Menu</span>
              </>
            )}
          </button>
        </div>

        {/* Footer Update Info */}
        {!isCollapsed && (
          <div className="p-4 border-t border-slate-700 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Terakhir Update:</span>
            <span className="font-mono text-slate-300 font-semibold">{todayFormatted.split(',')[1] || todayFormatted}</span>
          </div>
        )}
      </aside>
    </>
  );
};
