import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Upload, 
  History, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileJson, 
  Cloud, 
  Trash2, 
  X, 
  Plus, 
  RefreshCw,
  FolderArchive,
  ArrowRight,
  Database,
  Receipt,
  BookOpen,
  Calendar,
  Layers
} from 'lucide-react';
import { 
  AppBackupData, 
  AppDataPayload, 
  CashTransaction, 
  DailyRecap, 
  KasAccounts, 
  PaymentRecord, 
  PiutangItem, 
  TitipanItem 
} from '../types';
import { 
  buildBackupData, 
  getStoredSnapshots, 
  saveLocalSnapshot, 
  deleteLocalSnapshot, 
  clearAllLocalSnapshots 
} from '../utils/storage';
import { 
  saveSupabaseBackup, 
  deleteSupabaseBackup, 
  fetchSupabaseBackups 
} from '../supabase';
import { formatRupiah } from '../utils/formatters';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: AppDataPayload;
  onRestoreSuccess: (restoredData: AppDataPayload, message: string) => void;
  isSupabaseConnected: boolean;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  currentData,
  onRestoreSuccess,
  isSupabaseConnected,
}) => {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'snapshots'>('backup');
  const [customBackupName, setCustomBackupName] = useState<string>('');
  const [localSnapshots, setLocalSnapshots] = useState<AppBackupData[]>(() => getStoredSnapshots());
  const [cloudBackups, setCloudBackups] = useState<AppBackupData[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Restore file state
  const [parsedRestoreData, setParsedRestoreData] = useState<AppBackupData | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [showConfirmRestore, setShowConfirmRestore] = useState<boolean>(false);
  const [selectedSnapshotForRestore, setSelectedSnapshotForRestore] = useState<AppBackupData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load snapshots & fetch Supabase cloud backups when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSnapshots(getStoredSnapshots());
      setStatusMessage(null);
      setParsedRestoreData(null);
      setRestoreFileName(null);
      setShowConfirmRestore(false);
      setSelectedSnapshotForRestore(null);

      // Ambil daftar backup cloud dari Supabase jika online
      if (isSupabaseConnected) {
        fetchSupabaseBackups()
          .then((remote) => {
            setCloudBackups(remote);
          })
          .catch((e) => {
            console.warn('Supabase backup fetch inactive:', e);
          });
      }
    }
  }, [isOpen, isSupabaseConnected]);

  if (!isOpen) return null;

  // Realtime current data summary
  const totalKasMurni =
    (currentData.kas.bri || 0) +
    (currentData.kas.bni || 0) +
    (currentData.kas.flip || 0) +
    (currentData.kas.dana || 0) +
    (currentData.kas.od || 0) +
    (currentData.kas.edc || 0) +
    (currentData.kas.cash || 0);

  // 1. Download Backup JSON File
  const handleDownloadBackupFile = (customName?: string) => {
    try {
      setIsProcessing(true);
      const name = customName || customBackupName.trim() || undefined;
      const backup = buildBackupData(currentData, name, 'manual');

      // Also save to local snapshot automatically
      saveLocalSnapshot(backup);
      setLocalSnapshots(getStoredSnapshots());

      // Simpan juga ke cadangan cloud Supabase jika terkoneksi
      if (isSupabaseConnected) {
        saveSupabaseBackup(backup).catch(() => {});
      }

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backup, null, 2)
      )}`;
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10);
      const timePart = now.toTimeString().slice(0, 5).replace(':', '-');
      const filename = `backup_toko_alma_${datePart}_${timePart}.json`;

      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setStatusMessage({
        type: 'success',
        text: `✅ File cadangan "${filename}" berhasil diunduh dan disimpan ke riwayat!`,
      });
      setCustomBackupName('');
    } catch (e) {
      console.error(e);
      setStatusMessage({
        type: 'error',
        text: '❌ Gagal mengunduh file cadangan: ' + (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Create Instant Local Snapshot (Titik Pemulihan Cepat)
  const handleCreateSnapshot = async (saveToCloudToo = true) => {
    try {
      setIsProcessing(true);
      const name = customBackupName.trim() || `Titik Pemulihan Kasir (${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})`;
      const snapshot = buildBackupData(currentData, name, 'manual');

      saveLocalSnapshot(snapshot);
      setLocalSnapshots(getStoredSnapshots());

      if (saveToCloudToo && isSupabaseConnected) {
        await saveSupabaseBackup(snapshot);
        fetchSupabaseBackups().then(setCloudBackups).catch(() => {});
      }

      setStatusMessage({
        type: 'success',
        text: `✅ Titik pemulihan "${name}" berhasil dibuat! Anda bisa mengembalikan data kapan saja.`,
      });
      setCustomBackupName('');
    } catch (e) {
      console.error(e);
      setStatusMessage({
        type: 'error',
        text: '❌ Gagal membuat titik pemulihan: ' + (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. File upload and parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFileName(file.name);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Validate structure
        let dataPayload: AppDataPayload | null = null;
        let backupObj: AppBackupData | null = null;

        if (parsed.data && (parsed.data.kas || parsed.data.cashTransactions || parsed.data.piutang)) {
          backupObj = parsed as AppBackupData;
          dataPayload = parsed.data;
        } else if (parsed.kas || parsed.cashTransactions || parsed.piutang) {
          // Direct payload fallback
          dataPayload = parsed as AppDataPayload;
          backupObj = buildBackupData(dataPayload, file.name.replace('.json', ''), 'file_import');
        }

        if (!dataPayload) {
          throw new Error('Format file tidak sesuai! Pastikan file adalah hasil cadangan resmi Toko Alma.');
        }

        setParsedRestoreData(backupObj);
        setStatusMessage({
          type: 'info',
          text: `File "${file.name}" siap dipulihkan. Silakan tinjau ringkasan di bawah sebelum melanjutkan.`,
        });
      } catch (err) {
        console.error(err);
        setParsedRestoreData(null);
        setStatusMessage({
          type: 'error',
          text: '❌ File tidak valid: ' + (err instanceof Error ? err.message : 'Format JSON tidak cocok'),
        });
      }
    };
    reader.onerror = () => {
      setStatusMessage({
        type: 'error',
        text: '❌ Gagal membaca file dari perangkat.',
      });
    };
    reader.readAsText(file);
  };

  // 4. Perform Restore Process (with automatic emergency snapshot)
  const executeRestore = (targetBackup: AppBackupData) => {
    try {
      setIsProcessing(true);

      // AUTO EMERGENCY SNAPSHOT: Sebelum memulihkan data baru, simpan data saat ini agar bisa di-undo!
      const emergencySnapshot = buildBackupData(
        currentData,
        `Cadangan Otomatis (Sebelum Pulihkan Data ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})`,
        'auto_before_restore'
      );
      saveLocalSnapshot(emergencySnapshot);

      const targetData = targetBackup.data;
      let finalData: AppDataPayload;

      if (restoreMode === 'merge') {
        // Mode GABUNGKAN (Merge): Menjaga data baru dan menggabungkan data lama yang belum ada
        const existingNotaIds = new Set(currentData.cashTransactions.map((tx) => tx.id));
        const mergedNotas = [
          ...currentData.cashTransactions,
          ...(targetData.cashTransactions || []).filter((tx) => !existingNotaIds.has(tx.id)),
        ];

        const existingPiutangIds = new Set(currentData.piutang.map((p) => p.id));
        const mergedPiutang = [
          ...currentData.piutang,
          ...(targetData.piutang || []).filter((p) => !existingPiutangIds.has(p.id)),
        ];

        const existingPiutangPayIds = new Set(currentData.piutangPayments.map((p) => p.id));
        const mergedPiutangPayments = [
          ...currentData.piutangPayments,
          ...(targetData.piutangPayments || []).filter((p) => !existingPiutangPayIds.has(p.id)),
        ];

        const existingTitipanIds = new Set(currentData.titipan.map((t) => t.id));
        const mergedTitipan = [
          ...currentData.titipan,
          ...(targetData.titipan || []).filter((t) => !existingTitipanIds.has(t.id)),
        ];

        const existingTitipanPayIds = new Set(currentData.titipanPayments.map((t) => t.id));
        const mergedTitipanPayments = [
          ...currentData.titipanPayments,
          ...(targetData.titipanPayments || []).filter((t) => !existingTitipanPayIds.has(t.id)),
        ];

        const existingRekapDates = new Set(currentData.rekap.map((r) => r.tanggal));
        const mergedRekap = [
          ...currentData.rekap,
          ...(targetData.rekap || []).filter((r) => !existingRekapDates.has(r.tanggal)),
        ];

        finalData = {
          modalAwal: currentData.modalAwal,
          kas: currentData.kas,
          cashTransactions: mergedNotas,
          piutang: mergedPiutang,
          piutangPayments: mergedPiutangPayments,
          titipan: mergedTitipan,
          titipanPayments: mergedTitipanPayments,
          rekap: mergedRekap,
          contacts: { ...(currentData.contacts || {}), ...(targetData.contacts || {}) },
        };
      } else {
        // Mode TIMPA / REPLACE ALL: Menggantikan seluruh data sesuai file backup
        finalData = {
          modalAwal: typeof targetData.modalAwal === 'number' ? targetData.modalAwal : currentData.modalAwal,
          kas: targetData.kas || currentData.kas,
          cashTransactions: Array.isArray(targetData.cashTransactions) ? targetData.cashTransactions : [],
          piutang: Array.isArray(targetData.piutang) ? targetData.piutang : [],
          piutangPayments: Array.isArray(targetData.piutangPayments) ? targetData.piutangPayments : [],
          titipan: Array.isArray(targetData.titipan) ? targetData.titipan : [],
          titipanPayments: Array.isArray(targetData.titipanPayments) ? targetData.titipanPayments : [],
          rekap: Array.isArray(targetData.rekap) ? targetData.rekap : [],
          contacts: targetData.contacts || currentData.contacts,
        };
      }

      // Execute callback to update App state and Firestore
      onRestoreSuccess(
        finalData,
        `Data berhasil dipulihkan dari "${targetBackup.name}" (${restoreMode === 'merge' ? 'Mode Gabung' : 'Mode Timpa Penuh'}). Titik pengaman tersimpan!`
      );

      setShowConfirmRestore(false);
      setSelectedSnapshotForRestore(null);
      setParsedRestoreData(null);
      onClose();
    } catch (e) {
      console.error(e);
      setStatusMessage({
        type: 'error',
        text: '❌ Gagal memulihkan data: ' + (e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSnapshot = async (id: string, isCloud = false) => {
    if (window.confirm('Hapus titik pemulihan ini?')) {
      deleteLocalSnapshot(id);
      setLocalSnapshots(getStoredSnapshots());
      if (isCloud && isSupabaseConnected) {
        await deleteSupabaseBackup(id).catch(console.error);
        fetchSupabaseBackups().then(setCloudBackups).catch(() => {});
      }
      setStatusMessage({
        type: 'info',
        text: 'Titik pemulihan dihapus.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <FolderArchive className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">Backup & Pemulihan Data</h3>
              <p className="text-xs text-teal-100">Amankan data toko & kembalikan jika terjadi salah input</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 gap-1 overflow-x-auto text-xs shrink-0 select-none">
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3.5 py-2.5 font-semibold rounded-t-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-white text-teal-700 border-t-2 border-teal-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Download className="w-4 h-4 text-teal-600" />
            <span>Cadangkan Data (Backup)</span>
          </button>
          
          <button
            onClick={() => setActiveTab('restore')}
            className={`px-3.5 py-2.5 font-semibold rounded-t-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'restore'
                ? 'bg-white text-teal-700 border-t-2 border-teal-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Pulihkan Data (Restore)</span>
          </button>

          <button
            onClick={() => setActiveTab('snapshots')}
            className={`px-3.5 py-2.5 font-semibold rounded-t-lg transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'snapshots'
                ? 'bg-white text-teal-700 border-t-2 border-teal-600 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4 text-amber-600" />
            <span>Titik Pemulihan ({localSnapshots.length})</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700">
          
          {/* Status Message Notification */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-medium animate-in fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-teal-50 border-teal-200 text-teal-900'
              }`}
            >
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
              {statusMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
              {statusMessage.type === 'info' && <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />}
              <div className="flex-1 leading-relaxed">{statusMessage.text}</div>
            </div>
          )}

          {/* TAB 1: CADANGKAN (BACKUP) */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              {/* Ringkasan Data Yang Akan Dicadangkan */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-teal-600" /> Data Aktif Saat Ini
                  </span>
                  <span className="text-xs text-teal-700 font-bold bg-teal-100 px-2 py-0.5 rounded-full">
                    Total Kas: {formatRupiah(totalKasMurni)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
                    <span className="text-slate-400 block text-[10px]">Nota Kasir</span>
                    <span className="font-bold text-slate-800 text-sm font-mono">{currentData.cashTransactions.length}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
                    <span className="text-slate-400 block text-[10px]">Buku Piutang</span>
                    <span className="font-bold text-slate-800 text-sm font-mono">{currentData.piutang.length}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
                    <span className="text-slate-400 block text-[10px]">Buku Titipan</span>
                    <span className="font-bold text-slate-800 text-sm font-mono">{currentData.titipan.length}</span>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
                    <span className="text-slate-400 block text-[10px]">Rekap Harian</span>
                    <span className="font-bold text-slate-800 text-sm font-mono">{currentData.rekap.length}</span>
                  </div>
                </div>
              </div>

              {/* Form Nama Cadangan */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Label / Catatan Cadangan (Opsional):
                </label>
                <input
                  type="text"
                  value={customBackupName}
                  onChange={(e) => setCustomBackupName(e.target.value)}
                  placeholder="Contoh: Sebelum tutup toko sore, sebelum ganti kasir..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-teal-600 transition"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Opsi 1: Download File JSON */}
                <button
                  type="button"
                  onClick={() => handleDownloadBackupFile()}
                  disabled={isProcessing}
                  className="p-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1.5 transition shadow-xs cursor-pointer text-xs"
                >
                  <Download className="w-5 h-5" />
                  <span className="text-sm">Unduh File Cadangan (.JSON)</span>
                  <span className="text-[10px] text-teal-100 font-normal">
                    Simpan file aman di HP, Laptop, atau Google Drive
                  </span>
                </button>

                {/* Opsi 2: Simpan Titik Pemulihan Cepat */}
                <button
                  type="button"
                  onClick={() => handleCreateSnapshot(true)}
                  disabled={isProcessing}
                  className="p-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1.5 transition shadow-xs cursor-pointer text-xs"
                >
                  <History className="w-5 h-5 text-amber-400" />
                  <span className="text-sm">Buat Titik Pemulihan Cepat</span>
                  <span className="text-[10px] text-slate-300 font-normal">
                    Simpan checkpoint untuk di-undo jika salah input
                  </span>
                </button>
              </div>

              {/* Tips & Edukasi */}
              <div className="bg-teal-50/70 border border-teal-200 p-3.5 rounded-xl space-y-1.5 text-xs text-teal-950">
                <div className="flex items-center gap-2 font-bold text-teal-900">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span>Kapan Sebaiknya Melakukan Backup?</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-teal-800">
                  <li>Setiap sebelum pergantian kasir atau sebelum toko tutup setiap malam.</li>
                  <li>Sebelum melakukan reset data atau perubahan besar saldo kas.</li>
                  <li>File backup dapat dipindahkan antar HP dan laptop untuk memulihkan seluruh riwayat kasir.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: PULIHKAN DATA (RESTORE) */}
          {activeTab === 'restore' && (
            <div className="space-y-4">
              {/* File Upload Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-teal-300 hover:border-teal-500 bg-teal-50/40 hover:bg-teal-50/70 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2"
              >
                <div className="p-3 bg-teal-100 text-teal-700 rounded-full">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-slate-800 text-sm">
                    {restoreFileName ? restoreFileName : 'Klik atau Tarik File Cadangan (.JSON) ke Sini'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Mendukung file hasil backup dari HP atau Laptop Toko Alma
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* File Preview Card */}
              {parsedRestoreData && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <FileJson className="w-4 h-4 text-teal-600" />
                      <span className="font-bold text-xs text-slate-800 truncate">
                        {parsedRestoreData.name || 'Pratinjau File Cadangan'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(parsedRestoreData.timestamp).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                      <span className="text-slate-400 block text-[10px]">Nota Kasir</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {parsedRestoreData.data.cashTransactions?.length || 0}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                      <span className="text-slate-400 block text-[10px]">Bon Piutang</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {parsedRestoreData.data.piutang?.length || 0}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                      <span className="text-slate-400 block text-[10px]">Titipan</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {parsedRestoreData.data.titipan?.length || 0}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                      <span className="text-slate-400 block text-[10px]">Rekap Harian</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {parsedRestoreData.data.rekap?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Mode Pilihan Restore */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-700 block">Pilih Cara Pemulihan:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label
                        className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                          restoreMode === 'replace'
                            ? 'bg-rose-50/50 border-rose-300 text-rose-950'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'replace'}
                          onChange={() => setRestoreMode('replace')}
                          className="mt-0.5 text-rose-600 focus:ring-rose-500"
                        />
                        <div>
                          <p className="font-bold text-xs text-rose-900">Ganti Semua (Timpa Penuh)</p>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">
                            Menggantikan seluruh data saat ini persis seperti pada file cadangan (Cocok jika input salah total).
                          </p>
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                          restoreMode === 'merge'
                            ? 'bg-teal-50/50 border-teal-300 text-teal-950'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className="mt-0.5 text-teal-600 focus:ring-teal-500"
                        />
                        <div>
                          <p className="font-bold text-xs text-teal-900">Gabungkan (Merge Data)</p>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">
                            Menambahkan transaksi dari backup yang belum ada, tanpa menghapus data baru yang sudah diinput.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Tombol Eksekusi Pulihkan */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSnapshotForRestore(parsedRestoreData);
                        setShowConfirmRestore(true);
                      }}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition text-xs sm:text-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Lanjutkan Pemulihan Data dari File Ini</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RIWAYAT TITIK PEMULIHAN (SNAPSHOTS) */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-800">Riwayat Checkpoint Otomatis & Manual</h4>
                  <p className="text-[11px] text-slate-500">Klik 'Pulihkan' untuk mengembalikan data jika salah input</p>
                </div>
                {localSnapshots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Bersihkan semua riwayat titik pemulihan lokal?')) {
                        clearAllLocalSnapshots();
                        setLocalSnapshots([]);
                      }
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                  >
                    Hapus Semua Riwayat
                  </button>
                )}
              </div>

              {localSnapshots.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl space-y-2">
                  <History className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-600 text-xs">Belum ada titik pemulihan yang tersimpan</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Buat titik pemulihan di tab 'Cadangkan Data' agar Anda memiliki checkpoint sebelum transaksi penting.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {localSnapshots.map((item) => {
                    const timeAgo = new Date(item.timestamp).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    const isAuto = item.reason?.includes('auto');

                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-slate-200 hover:border-teal-300 rounded-xl p-3.5 space-y-2.5 transition shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-slate-900">{item.name}</span>
                              {isAuto ? (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.2 rounded-full font-semibold">
                                  Otomatis
                                </span>
                              ) : (
                                <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.2 rounded-full font-semibold">
                                  Manual
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono block mt-0.5">{timeAgo}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSnapshotForRestore(item);
                                setShowConfirmRestore(true);
                              }}
                              className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Pulihkan data toko ke titik ini"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Pulihkan</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
                                  JSON.stringify(item, null, 2)
                                )}`;
                                const dl = document.createElement('a');
                                dl.setAttribute('href', jsonString);
                                dl.setAttribute('download', `${item.id}.json`);
                                document.body.appendChild(dl);
                                dl.click();
                                dl.remove();
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                              title="Unduh JSON"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSnapshot(item.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                              title="Hapus titik pemulihan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Snapshot summary pill badges */}
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                          <span className="bg-slate-100 px-2 py-0.5 rounded">
                            Nota: <strong>{item.data.cashTransactions?.length || 0}</strong>
                          </span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded">
                            Piutang: <strong>{item.data.piutang?.length || 0}</strong>
                          </span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded">
                            Titipan: <strong>{item.data.titipan?.length || 0}</strong>
                          </span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded">
                            Rekap: <strong>{item.data.rekap?.length || 0}</strong>
                          </span>
                          {item.summary?.totalKasMurni !== undefined && (
                            <span className="text-teal-700 font-bold ml-auto">
                              Kas: {formatRupiah(item.summary.totalKasMurni)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Sistem Keamanan Data Toko Alma
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>

      {/* MODAL KONFIRMASI PEMULIHAN (SAFETY POPUP) */}
      {showConfirmRestore && selectedSnapshotForRestore && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Konfirmasi Pemulihan Data</h4>
                <p className="text-xs text-slate-500">Pastikan Anda ingin mengembalikan data ke titik ini</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Titik Cadangan:</span>
                <span className="font-bold text-slate-800">{selectedSnapshotForRestore.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mode:</span>
                <span className="font-bold text-teal-700">
                  {restoreMode === 'replace' ? 'Timpa Semua (Replace All)' : 'Gabungkan (Merge)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jumlah Nota:</span>
                <span className="font-mono font-bold text-slate-800">
                  {selectedSnapshotForRestore.data.cashTransactions?.length || 0} nota
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Pengaman Aktif:</strong> Sistem otomatis menyimpan cadangan darurat dari data Anda saat ini sebelum dipulihkan. Jika salah, Anda dapat membatalkannya.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmRestore(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => executeRestore(selectedSnapshotForRestore)}
                disabled={isProcessing}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ya, Pulihkan Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
