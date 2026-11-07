/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Menu1Jurnal } from './components/Menu1Jurnal';
import { Menu2Piutang } from './components/Menu2Piutang';
import { Menu3Titipan } from './components/Menu3Titipan';
import { Menu4Rekap } from './components/Menu4Rekap';
import { Menu5Cash } from './components/Menu5Cash';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { SupabaseModal } from './components/SupabaseModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { 
  fetchSupabaseCashTransactions,
  upsertSupabaseCashTransaction,
  deleteSupabaseCashTransaction,
  fetchSupabasePiutang,
  upsertSupabasePiutang,
  deleteSupabasePiutang,
  fetchSupabasePiutangPayments,
  upsertSupabasePiutangPayment,
  deleteSupabasePiutangPayment,
  fetchSupabaseTitipan,
  upsertSupabaseTitipan,
  deleteSupabaseTitipan,
  fetchSupabaseTitipanPayments,
  upsertSupabaseTitipanPayment,
  deleteSupabaseTitipanPayment,
  fetchSupabaseRekap,
  upsertSupabaseRekap,
  deleteSupabaseRekap,
  fetchSupabaseSettings,
  saveSupabaseModalAwal,
  fetchSupabaseKasDraft,
  saveSupabaseKasDraft,
  subscribeSupabaseRealtime,
  testSupabaseConnection,
  uploadAllDataToSupabase,
} from './supabase';
import { 
  ActiveTab, 
  CashTransaction,
  DailyRecap, 
  KasAccounts, 
  PaymentRecord, 
  PiutangItem, 
  TitipanItem,
  AppDataPayload 
} from './types';
import { 
  getStoredCashTransactions,
  getStoredKasDraft, 
  getStoredModalAwal, 
  getStoredPiutang, 
  getStoredPiutangPayments,
  getStoredRekap, 
  getStoredTitipan, 
  getStoredTitipanPayments,
  resetAllDataToDefault, 
  setStoredCashTransactions,
  setStoredKasDraft, 
  setStoredModalAwal, 
  setStoredPiutang, 
  setStoredPiutangPayments,
  setStoredRekap, 
  setStoredTitipan,
  setStoredTitipanPayments,
  restoreAllDataToStorage
} from './utils/storage';
import { formatRupiah, getTodayDateString } from './utils/formatters';
import { getPhoneForName, saveContactPhone } from './utils/contacts';
import { 
  calculateCustomerCycles, 
  calculatePenitipCycles, 
  getMonthlyBaselineKas,
  getTotalKasKemarin
} from './utils/cycleCalculations';
import { ChevronDown, ChevronUp, CheckCircle2, RotateCcw, AlertTriangle, X } from 'lucide-react';

export default function App() {
  // App state from persistent storage
  const [modalAwal, setModalAwal] = useState<number>(() => getStoredModalAwal());
  const [kas, setKas] = useState<KasAccounts>(() => getStoredKasDraft());
  const [piutangList, setPiutangList] = useState<PiutangItem[]>(() => getStoredPiutang());
  const [piutangPayments, setPiutangPayments] = useState<PaymentRecord[]>(() => getStoredPiutangPayments());
  const [titipanList, setTitipanList] = useState<TitipanItem[]>(() => getStoredTitipan());
  const [titipanPayments, setTitipanPayments] = useState<PaymentRecord[]>(() => getStoredTitipanPayments());
  const [rekapList, setRekapList] = useState<DailyRecap[]>(() => getStoredRekap());
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>(() => getStoredCashTransactions());

  // UI state - tampilan awal menu dalam keadaan tertutup
  const [activeTab, setActiveTab] = useState<ActiveTab>('jurnal');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'tabs' | 'accordion'>('tabs');
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [resetConfirmText, setResetConfirmText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Database Supabase PostgreSQL & Backup state
  const [showSupabaseModal, setShowSupabaseModal] = useState<boolean>(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(true);
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Server Keep-Alive & Auto-Warmup:
  // Menjaga server Cloud Run & koneksi database selalu hangat selama aplikasi dibuka di kasir/HP.
  // Segera hangatkan koneksi ketika layar dinyalakan kembali (visibilitychange) atau kembali online.
  useEffect(() => {
    let wakeLockSentinel: any = null;

    const pingServer = () => {
      fetch(`/icon.svg?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' }).catch(() => {});
    };

    // Ping awal seketika setelah mount
    pingServer();

    // Ping berkala setiap 35 detik agar server container tidak masuk mode sleep
    const keepAliveInterval = setInterval(pingServer, 35000);

    // Ketika kasir membuka kembali layar HP atau beralih ke tab ini, langsung kirim ping hangat
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pingServer();
        requestWakeLock();
      }
    };

    const handleFocusOrOnline = () => {
      pingServer();
    };

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        try {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        } catch {
          // Ignore jika tidak diizinkan atau tidak didukung
        }
      }
    };

    requestWakeLock();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocusOrOnline);
    window.addEventListener('online', handleFocusOrOnline);

    return () => {
      clearInterval(keepAliveInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocusOrOnline);
      window.removeEventListener('online', handleFocusOrOnline);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);

  // Sinkronisasi Supabase PostgreSQL & Realtime Multi-Device Sync
  useEffect(() => {
    // 1. Pengujian koneksi awal ke Supabase PostgreSQL
    testSupabaseConnection()
      .then((res) => {
        setIsSupabaseConnected(res.success);
        if (res.success && res.hasTables) {
          // Ambil data dari Supabase jika tabel sudah dibuat
          fetchSupabaseCashTransactions().then((txs) => {
            if (txs.length > 0) {
              setCashTransactions(txs);
              setStoredCashTransactions(txs);
            }
          });
          fetchSupabasePiutang().then((p) => {
            if (p.length > 0) {
              setPiutangList(p);
              setStoredPiutang(p);
            }
          });
          fetchSupabasePiutangPayments().then((pp) => {
            if (pp.length > 0) {
              setPiutangPayments(pp);
              setStoredPiutangPayments(pp);
            }
          });
          fetchSupabaseTitipan().then((t) => {
            if (t.length > 0) {
              setTitipanList(t);
              setStoredTitipan(t);
            }
          });
          fetchSupabaseTitipanPayments().then((tp) => {
            if (tp.length > 0) {
              setTitipanPayments(tp);
              setStoredTitipanPayments(tp);
            }
          });
          fetchSupabaseRekap().then((r) => {
            if (r.length > 0) {
              setRekapList(r);
              setStoredRekap(r);
            }
          });
          fetchSupabaseSettings().then((s) => {
            if (s.modalAwal > 0) {
              setModalAwal(s.modalAwal);
              setStoredModalAwal(s.modalAwal);
            }
          });
          fetchSupabaseKasDraft().then((k) => {
            if (k) {
              setKas(k);
              setStoredKasDraft(k);
            }
          });
        }
      })
      .catch(() => {
        setIsSupabaseConnected(false);
      });

    // 2. Berlangganan perubahan Supabase Realtime di semua HP/laptop
    const unsubSupabaseRealtime = subscribeSupabaseRealtime({
      onCashChange: () => {
        fetchSupabaseCashTransactions().then((txs) => {
          if (txs.length > 0) {
            setCashTransactions(txs);
            setStoredCashTransactions(txs);
          }
        });
      },
      onPiutangChange: () => {
        fetchSupabasePiutang().then((p) => {
          setPiutangList(p);
          setStoredPiutang(p);
        });
        fetchSupabasePiutangPayments().then((pp) => {
          setPiutangPayments(pp);
          setStoredPiutangPayments(pp);
        });
      },
      onTitipanChange: () => {
        fetchSupabaseTitipan().then((t) => {
          setTitipanList(t);
          setStoredTitipan(t);
        });
        fetchSupabaseTitipanPayments().then((tp) => {
          setTitipanPayments(tp);
          setStoredTitipanPayments(tp);
        });
      },
      onRekapChange: () => {
        fetchSupabaseRekap().then((r) => {
          setRekapList(r);
          setStoredRekap(r);
        });
      },
      onSettingsChange: () => {
        fetchSupabaseSettings().then((s) => {
          if (s.modalAwal > 0) {
            setModalAwal(s.modalAwal);
            setStoredModalAwal(s.modalAwal);
          }
        });
        fetchSupabaseKasDraft().then((k) => {
          if (k) {
            setKas(k);
            setStoredKasDraft(k);
          }
        });
      },
    });

    return () => {
      unsubSupabaseRealtime();
    };
  }, []);

  // Accordion open/close states for each menu section (default tertutup pada tampilan awal)
  const [accordionState, setAccordionState] = useState<Record<ActiveTab, boolean>>({
    jurnal: false,
    piutang: false,
    titipan: false,
    rekap: false,
    cash: false,
  });

  const toggleAccordionSection = (tab: ActiveTab) => {
    setAccordionState((prev) => ({
      ...prev,
      [tab]: !prev[tab],
    }));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync to storage on state change
  const handleSaveModalAwal = (newModal: number) => {
    setModalAwal(newModal);
    setStoredModalAwal(newModal);
    saveSupabaseModalAwal(newModal).catch(console.error);
    showToast('Modal awal berhasil diperbarui!');
  };

  const handleUpdateKas = (newKas: KasAccounts) => {
    setKas(newKas);
    setStoredKasDraft(newKas);
    saveSupabaseKasDraft(newKas).catch(console.error);
  };

  // Contact linking action
  const handleUpdateCustomerPhone = (name: string, phone: string) => {
    saveContactPhone(name, phone);
    const trimmedName = name.trim().toLowerCase();
    
    // Update existing piutang items
    const updatedPiutang = piutangList.map((item) =>
      item.nama.trim().toLowerCase() === trimmedName ? { ...item, telepon: phone || undefined } : item
    );
    setPiutangList(updatedPiutang);
    setStoredPiutang(updatedPiutang);

    // Update existing titipan items
    const updatedTitipan = titipanList.map((item) =>
      item.nama.trim().toLowerCase() === trimmedName ? { ...item, telepon: phone || undefined } : item
    );
    setTitipanList(updatedTitipan);
    setStoredTitipan(updatedTitipan);

    showToast(`Nomor WA untuk ${name} berhasil disimpan & dihubungkan.`);
  };

  // Piutang actions (CRUD)
  const handleAddPiutang = (item: Omit<PiutangItem, 'id' | 'createdAt'>) => {
    const effectivePhone = item.telepon || getPhoneForName(item.nama) || undefined;
    if (item.telepon) {
      saveContactPhone(item.nama, item.telepon);
    }
    const newItem: PiutangItem = {
      ...item,
      telepon: effectivePhone,
      id: `p-${Date.now()}`,
      createdAt: Date.now(),
    };
    const updated = [newItem, ...piutangList];
    setPiutangList(updated);
    setStoredPiutang(updated);
    upsertSupabasePiutang(newItem).catch(console.error);
    showToast(`Bon piutang untuk ${item.nama} berhasil dicatat.`);
  };

  const handleDeletePiutang = (id: string) => {
    const updated = piutangList.filter((item) => item.id !== id);
    setPiutangList(updated);
    setStoredPiutang(updated);
    deleteSupabasePiutang(id).catch(console.error);
    showToast('Data bon piutang berhasil dihapus.');
  };

  const handleAddPiutangPayment = (payment: Omit<PaymentRecord, 'id' | 'createdAt'>) => {
    const newPayment: PaymentRecord = {
      ...payment,
      id: `pay-p-${Date.now()}`,
      createdAt: Date.now(),
    };
    const updated = [newPayment, ...piutangPayments];
    setPiutangPayments(updated);
    setStoredPiutangPayments(updated);
    upsertSupabasePiutangPayment(newPayment).catch(console.error);
    showToast(`Pembayaran dari ${payment.nama} (${payment.keterangan}) berhasil disimpan.`);
  };

  const handleDeletePiutangPayment = (id: string) => {
    const updated = piutangPayments.filter((p) => p.id !== id);
    setPiutangPayments(updated);
    setStoredPiutangPayments(updated);
    deleteSupabasePiutangPayment(id).catch(console.error);
    showToast('Data pembayaran piutang berhasil dihapus.');
  };

  // Titipan actions (CRUD)
  const handleAddTitipan = (item: Omit<TitipanItem, 'id' | 'createdAt'>) => {
    const effectivePhone = item.telepon || getPhoneForName(item.nama) || undefined;
    if (item.telepon) {
      saveContactPhone(item.nama, item.telepon);
    }
    const newItem: TitipanItem = {
      ...item,
      telepon: effectivePhone,
      id: `t-${Date.now()}`,
      createdAt: Date.now(),
    };
    const updated = [newItem, ...titipanList];
    setTitipanList(updated);
    setStoredTitipan(updated);
    upsertSupabaseTitipan(newItem).catch(console.error);
    showToast(`Titipan dari ${item.nama} berhasil dicatat.`);
  };

  const handleDeleteTitipan = (id: string) => {
    const updated = titipanList.filter((item) => item.id !== id);
    setTitipanList(updated);
    setStoredTitipan(updated);
    deleteSupabaseTitipan(id).catch(console.error);
    showToast('Data titipan berhasil dihapus.');
  };

  const handleAddTitipanPayment = (payment: Omit<PaymentRecord, 'id' | 'createdAt'>) => {
    const newPayment: PaymentRecord = {
      ...payment,
      id: `pay-t-${Date.now()}`,
      createdAt: Date.now(),
    };
    const updated = [newPayment, ...titipanPayments];
    setTitipanPayments(updated);
    setStoredTitipanPayments(updated);
    upsertSupabaseTitipanPayment(newPayment).catch(console.error);
    showToast(`Penyerahan dana ke ${payment.nama} (${payment.keterangan}) berhasil disimpan.`);
  };

  const handleDeleteTitipanPayment = (id: string) => {
    const updated = titipanPayments.filter((p) => p.id !== id);
    setTitipanPayments(updated);
    setStoredTitipanPayments(updated);
    deleteSupabaseTitipanPayment(id).catch(console.error);
    showToast('Data penyerahan titipan berhasil dihapus.');
  };

  // Rekap actions (CRUD)
  const handleSaveDailyRecap = (recapData: Omit<DailyRecap, 'id' | 'savedAt'>) => {
    const existingIdx = rekapList.findIndex((r) => r.tanggal === recapData.tanggal);
    const newEntry: DailyRecap = {
      ...recapData,
      id: existingIdx >= 0 ? rekapList[existingIdx].id : `rekap-${recapData.tanggal}-${Date.now()}`,
      savedAt: new Date().toISOString(),
    };

    let updatedList: DailyRecap[];
    if (existingIdx >= 0) {
      updatedList = [...rekapList];
      updatedList[existingIdx] = newEntry;
    } else {
      updatedList = [...rekapList, newEntry].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    }

    setRekapList(updatedList);
    setStoredRekap(updatedList);
    upsertSupabaseRekap(newEntry).catch(console.error);
    showToast(`Rekap harian tanggal ${recapData.tanggal} berhasil disimpan!`);
  };

  const handleDeleteRekap = (id: string) => {
    const updated = rekapList.filter((r) => r.id !== id);
    setRekapList(updated);
    setStoredRekap(updated);
    deleteSupabaseRekap(id).catch(console.error);
    showToast('Rekap harian berhasil dihapus.');
  };

  // Cash transactions actions (CRUD Menu 5 - Nota Kasir)
  const handleAddCashTransaction = (
    txData: Omit<CashTransaction, 'id' | 'noNota' | 'createdAt'>
  ): CashTransaction => {
    const timestamp = Date.now();
    const targetDate = txData.tanggal || getTodayDateString();

    const dateParts = targetDate.split('-');
    const yy = (dateParts[0] || '').slice(-2);
    const mm = (dateParts[1] || '01').padStart(2, '0');
    const dd = (dateParts[2] || '01').padStart(2, '0');
    const yymmdd = `${yy}${mm}${dd}`;
    const prefix = `Csh ${yymmdd}-`;

    const sameDayTransactions = cashTransactions.filter(
      (tx) => tx.tanggal === targetDate
    );

    let maxSeq = 0;
    sameDayTransactions.forEach((tx) => {
      if (tx.noNota && tx.noNota.startsWith(prefix)) {
        const numPart = parseInt(tx.noNota.slice(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    });

    const nextSeq = Math.max(maxSeq + 1, sameDayTransactions.length + 1);
    const seqStr = String(nextSeq).padStart(2, '0');
    const noNota = `${prefix}${seqStr}`;

    const newTx: CashTransaction = {
      ...txData,
      id: 'tx-' + timestamp,
      noNota,
      createdAt: timestamp,
    };

    const updated = [newTx, ...cashTransactions];
    setCashTransactions(updated);
    setStoredCashTransactions(updated);
    upsertSupabaseCashTransaction(newTx).catch(console.error);
    showToast(`Nota ${noNota} berhasil dibuat!`);

    return newTx;
  };

  const handleDeleteCashTransaction = (id: string) => {
    const updated = cashTransactions.filter((tx) => tx.id !== id);
    setCashTransactions(updated);
    setStoredCashTransactions(updated);
    deleteSupabaseCashTransaction(id).catch(console.error);
    showToast('Transaksi cash berhasil dihapus.');
  };

  const handleUpdateCashTransaction = (updatedTx: CashTransaction) => {
    const updated = cashTransactions.map((tx) => (tx.id === updatedTx.id ? updatedTx : tx));
    setCashTransactions(updated);
    setStoredCashTransactions(updated);
    upsertSupabaseCashTransaction(updatedTx).catch(console.error);
    if (updatedTx.statusBayar === 'lunas') {
      showToast(`Nota ${updatedTx.noNota} berhasil dilunasi!`);
    } else {
      showToast(`Nota ${updatedTx.noNota} berhasil diperbarui.`);
    }
  };

  // Reset to clean 0 data
  const handleResetData = () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      return;
    }
    resetAllDataToDefault();
    setModalAwal(getStoredModalAwal());
    setKas(getStoredKasDraft());
    setPiutangList(getStoredPiutang());
    setPiutangPayments(getStoredPiutangPayments());
    setTitipanList(getStoredTitipan());
    setTitipanPayments(getStoredTitipanPayments());
    setRekapList(getStoredRekap());
    setCashTransactions(getStoredCashTransactions());
    setShowResetConfirm(false);
    setResetConfirmText('');
    showToast('Semua data input berhasil di-reset menjadi 0!');
  };

  // REALTIME FINANCIAL CALCULATIONS
  // 1. Total Kas Murni (BRI + BNI + FLIP + DANA + OD + EDC + CASH)
  const totalKasMurni = useMemo(() => {
    return (kas.bri || 0) + (kas.bni || 0) + (kas.flip || 0) + 
           (kas.dana || 0) + (kas.od || 0) + (kas.edc || 0) + (kas.cash || 0);
  }, [kas]);

  // 2. Piutang otomatis terisi dari Menu 2 (Siklus aktif: jika lunas, nama sama mulai dari 0 kembali)
  const { piutangTotal, activePiutangCount } = useMemo(() => {
    const customerCycles = calculateCustomerCycles(piutangList, piutangPayments);
    const activeCustomers = customerCycles.filter((c) => c.sisaTagihan > 0);
    const total = activeCustomers.reduce((acc, c) => acc + c.sisaTagihan, 0);
    return { piutangTotal: total, activePiutangCount: activeCustomers.length };
  }, [piutangList, piutangPayments]);

  // 3. Titipan otomatis terisi dari Menu 3 (Siklus aktif: jika lunas/selesai diambil, nama sama mulai dari 0 kembali)
  const { titipanTotal, activeTitipanCount } = useMemo(() => {
    const penitipCycles = calculatePenitipCycles(titipanList, titipanPayments);
    const activePenitip = penitipCycles.filter((p) => p.sisaSaldo > 0);
    const total = activePenitip.reduce((acc, p) => acc + p.sisaSaldo, 0);
    return { titipanTotal: total, activeTitipanCount: activePenitip.length };
  }, [titipanList, titipanPayments]);

  // 4. Total Kas Harian: Kas + piutang - titipan
  const totalKasHarian = useMemo(() => {
    return totalKasMurni + piutangTotal - titipanTotal;
  }, [totalKasMurni, piutangTotal, titipanTotal]);

  // 5. Total Kas Kemarin:
  // "perhitungan laba setiap awal bulan kembali ke nol lagi, dan modal yang di hitung di laba adalah modal awal."
  const todayStr = getTodayDateString();
  const totalKasKemarin = useMemo(() => {
    return getTotalKasKemarin(todayStr, rekapList, modalAwal);
  }, [rekapList, todayStr, modalAwal]);

  // 6. Laba Harian: total kas hari ini - total kas kemarin
  // (Pada awal bulan: total kas hari ini - modal awal, sehingga kembali ke nol jika kas = modal awal)
  const labaHarian = useMemo(() => {
    return totalKasHarian - totalKasKemarin;
  }, [totalKasHarian, totalKasKemarin]);

  // Saldo baseline kas awal bulan: modal yang dihitung di laba adalah modal awal
  const saldoAwalBulan = modalAwal;

  // 7. Laba Bulanan: total kas hari ini - modal awal (kembali ke nol setiap awal bulan)
  const labaBulanan = useMemo(() => {
    return totalKasHarian - saldoAwalBulan;
  }, [totalKasHarian, saldoAwalBulan]);

  // Check if today is already saved in rekap
  const isTodaySaved = useMemo(() => {
    return rekapList.some((r) => r.tanggal === todayStr);
  }, [rekapList, todayStr]);

  // Payload cadangan lengkap untuk fitur Backup & Restore
  const currentDataPayload: AppDataPayload = useMemo(() => ({
    modalAwal,
    kas,
    piutang: piutangList,
    piutangPayments,
    titipan: titipanList,
    titipanPayments,
    rekap: rekapList,
    cashTransactions,
  }), [modalAwal, kas, piutangList, piutangPayments, titipanList, titipanPayments, rekapList, cashTransactions]);

  // Handler eksekusi pemulihan data (restore)
  const handleRestoreSuccess = (restoredData: AppDataPayload, message: string) => {
    setModalAwal(restoredData.modalAwal);
    setKas(restoredData.kas);
    setPiutangList(restoredData.piutang);
    setPiutangPayments(restoredData.piutangPayments);
    setTitipanList(restoredData.titipan);
    setTitipanPayments(restoredData.titipanPayments);
    setRekapList(restoredData.rekap);
    setCashTransactions(restoredData.cashTransactions);

    // Simpan ke localStorage
    restoreAllDataToStorage(restoredData);

    // Sinkronkan ke Supabase PostgreSQL agar seluruh HP & Laptop langsung terupdate
    uploadAllDataToSupabase(restoredData).catch(console.error);

    showToast(message);
    setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
  };

  return (
    <div className="flex h-screen w-screen bg-[#f0f2f5] font-sans text-slate-800 overflow-hidden select-none">
      {/* Sidebar (High Density Dark Aside) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        lastUpdatedDate={todayStr}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onResetData={() => setShowResetConfirm(true)}
        onOpenBackupModal={() => setShowBackupModal(true)}
        onOpenSupabaseModal={() => setShowSupabaseModal(true)}
      />

      {/* Main App Container */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* PWA Install Banner & Mode Cepat */}
        <PWAInstallBanner />

        {/* Top Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          totalKasHarian={totalKasHarian}
          labaHarian={labaHarian}
          labaBulanan={labaBulanan}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onOpenSupabaseModal={() => setShowSupabaseModal(true)}
          isSupabaseConnected={isSupabaseConnected}
          onOpenBackupModal={() => setShowBackupModal(true)}
        />

        {/* Scrollable High Density Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Quick Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 bg-[#1e293b] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* VIEW MODE: TABS */}
          {viewMode === 'tabs' && (
            <div className="transition-all duration-150">
              {activeTab === 'jurnal' && (
                <Menu1Jurnal
                  modalAwal={modalAwal}
                  onSaveModalAwal={handleSaveModalAwal}
                  kas={kas}
                  onUpdateKas={handleUpdateKas}
                  piutangTotal={piutangTotal}
                  piutangCount={activePiutangCount}
                  titipanTotal={titipanTotal}
                  titipanCount={activeTitipanCount}
                  totalKasHarian={totalKasHarian}
                  totalKasKemarin={totalKasKemarin}
                  labaHarian={labaHarian}
                  labaBulanan={labaBulanan}
                  saldoAwalBulan={saldoAwalBulan}
                  rekapList={rekapList}
                  onSaveDailyRecap={handleSaveDailyRecap}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                  isTodaySaved={isTodaySaved}
                />
              )}

              {activeTab === 'piutang' && (
                <Menu2Piutang
                  piutangList={piutangList}
                  payments={piutangPayments}
                  onAddPiutang={handleAddPiutang}
                  onDeletePiutang={handleDeletePiutang}
                  onAddPayment={handleAddPiutangPayment}
                  onDeletePayment={handleDeletePiutangPayment}
                  onUpdateCustomerPhone={handleUpdateCustomerPhone}
                />
              )}

              {activeTab === 'titipan' && (
                <Menu3Titipan
                  titipanList={titipanList}
                  payments={titipanPayments}
                  onAddTitipan={handleAddTitipan}
                  onDeleteTitipan={handleDeleteTitipan}
                  onAddPayment={handleAddTitipanPayment}
                  onDeletePayment={handleDeleteTitipanPayment}
                  onUpdateCustomerPhone={handleUpdateCustomerPhone}
                />
              )}

              {activeTab === 'rekap' && (
                <Menu4Rekap
                  rekapList={rekapList}
                  onDeleteRekap={handleDeleteRekap}
                  modalAwal={modalAwal}
                />
              )}

              {activeTab === 'cash' && (
                <Menu5Cash
                  transactions={cashTransactions}
                  onAddTransaction={handleAddCashTransaction}
                  onDeleteTransaction={handleDeleteCashTransaction}
                  onUpdateTransaction={handleUpdateCashTransaction}
                  onUpdateCustomerPhone={handleUpdateCustomerPhone}
                />
              )}
            </div>
          )}

          {/* VIEW MODE: ACCORDION ("pilihan menu dapat dibuka/tutup") */}
          {viewMode === 'accordion' && (
            <div className="space-y-5">
              {/* Menu 1 */}
              <section id="section-jurnal" className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                <div
                  onClick={() => toggleAccordionSection('jurnal')}
                  className="px-5 py-3.5 bg-[#1e293b] text-white flex items-center justify-between cursor-pointer hover:bg-slate-800 transition select-none"
                >
                  <div className="flex items-center space-x-3">
                    <span className="bg-blue-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                      Menu 1
                    </span>
                    <h3 className="text-sm font-bold">Input Harian: Modal Awal, Saldo Kas, Piutang & Titipan</h3>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-300">
                    <span>{accordionState.jurnal ? 'Tutup' : 'Buka'}</span>
                    {accordionState.jurnal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
                {accordionState.jurnal && (
                  <div className="p-4 sm:p-5 bg-slate-50/50">
                    <Menu1Jurnal
                      modalAwal={modalAwal}
                      onSaveModalAwal={handleSaveModalAwal}
                      kas={kas}
                      onUpdateKas={handleUpdateKas}
                      piutangTotal={piutangTotal}
                      piutangCount={activePiutangCount}
                      titipanTotal={titipanTotal}
                      titipanCount={activeTitipanCount}
                      totalKasHarian={totalKasHarian}
                      totalKasKemarin={totalKasKemarin}
                      labaHarian={labaHarian}
                      labaBulanan={labaBulanan}
                      saldoAwalBulan={saldoAwalBulan}
                      rekapList={rekapList}
                      onSaveDailyRecap={handleSaveDailyRecap}
                      onNavigateToTab={(tab) => setActiveTab(tab)}
                      isTodaySaved={isTodaySaved}
                    />
                  </div>
                )}
              </section>

              {/* Menu 2 */}
              <section id="section-piutang" className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                <div
                  onClick={() => toggleAccordionSection('piutang')}
                  className="px-5 py-3.5 bg-slate-900 text-blue-300 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition select-none"
                >
                  <div className="flex items-center space-x-3">
                    <span className="bg-blue-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                      Menu 2
                    </span>
                    <h3 className="text-sm font-bold text-white">Buku Piutang & Rekap Tagihan Pelanggan</h3>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-blue-300">
                    <span>{accordionState.piutang ? 'Tutup' : 'Buka'}</span>
                    {accordionState.piutang ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
                {accordionState.piutang && (
                  <div className="p-4 sm:p-5 bg-blue-50/10">
                    <Menu2Piutang
                      piutangList={piutangList}
                      payments={piutangPayments}
                      onAddPiutang={handleAddPiutang}
                      onDeletePiutang={handleDeletePiutang}
                      onAddPayment={handleAddPiutangPayment}
                      onDeletePayment={handleDeletePiutangPayment}
                      onUpdateCustomerPhone={handleUpdateCustomerPhone}
                    />
                  </div>
                )}
              </section>

              {/* Menu 3 */}
              <section id="section-titipan" className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                <div
                  onClick={() => toggleAccordionSection('titipan')}
                  className="px-5 py-3.5 bg-slate-900 text-orange-300 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition select-none"
                >
                  <div className="flex items-center space-x-3">
                    <span className="bg-orange-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                      Menu 3
                    </span>
                    <h3 className="text-sm font-bold text-white">Buku Titipan Dana / Barang</h3>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-orange-300">
                    <span>{accordionState.titipan ? 'Tutup' : 'Buka'}</span>
                    {accordionState.titipan ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
                {accordionState.titipan && (
                  <div className="p-4 sm:p-5 bg-orange-50/10">
                    <Menu3Titipan
                      titipanList={titipanList}
                      payments={titipanPayments}
                      onAddTitipan={handleAddTitipan}
                      onDeleteTitipan={handleDeleteTitipan}
                      onAddPayment={handleAddTitipanPayment}
                      onDeletePayment={handleDeleteTitipanPayment}
                      onUpdateCustomerPhone={handleUpdateCustomerPhone}
                    />
                  </div>
                )}
              </section>

              {/* Menu 4 */}
              <section id="section-rekap" className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                <div
                  onClick={() => toggleAccordionSection('rekap')}
                  className="px-5 py-3.5 bg-slate-900 text-emerald-300 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition select-none"
                >
                  <div className="flex items-center space-x-3">
                    <span className="bg-emerald-600 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                      Menu 4
                    </span>
                    <h3 className="text-sm font-bold text-white">Rekapitulasi Jurnal & Laporan Bulanan</h3>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-emerald-300">
                    <span>{accordionState.rekap ? 'Tutup' : 'Buka'}</span>
                    {accordionState.rekap ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
                {accordionState.rekap && (
                  <div className="p-4 sm:p-5 bg-emerald-50/10">
                    <Menu4Rekap
                      rekapList={rekapList}
                      onDeleteRekap={handleDeleteRekap}
                      modalAwal={modalAwal}
                    />
                  </div>
                )}
              </section>

              {/* Menu 5 */}
              <section id="section-cash" className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                <div
                  onClick={() => toggleAccordionSection('cash')}
                  className="px-5 py-3.5 bg-slate-900 text-emerald-300 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition select-none"
                >
                  <div className="flex items-center space-x-3">
                    <span className="bg-emerald-500 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                      Menu 5
                    </span>
                    <h3 className="text-sm font-bold text-white">Pembuat Nota & Cetak Struk Belanja</h3>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-emerald-300">
                    <span>{accordionState.cash ? 'Tutup' : 'Buka'}</span>
                    {accordionState.cash ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
                {accordionState.cash && (
                  <div className="p-4 sm:p-5 bg-emerald-50/10">
                    <Menu5Cash
                      transactions={cashTransactions}
                      onAddTransaction={handleAddCashTransaction}
                      onDeleteTransaction={handleDeleteCashTransaction}
                      onUpdateTransaction={handleUpdateCashTransaction}
                      onUpdateCustomerPhone={handleUpdateCustomerPhone}
                    />
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-slate-900">Reset Semua Data Input?</h4>
                  <button
                    onClick={() => {
                      setShowResetConfirm(false);
                      setResetConfirmText('');
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Tindakan ini akan mengosongkan seluruh data yang telah diinput menjadi <strong>0 kembali</strong>:
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 border border-slate-200/80 mb-5 text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Saldo Kas (BRI, BNI, FLIP, DANA, OD, EDC, CASH) &rarr; <strong>0</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Modal Awal Toko &rarr; <strong>Rp 0</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Seluruh Catatan Buku Piutang & Pembayaran &rarr; <strong>Dikosongkan</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Seluruh Catatan Buku Titipan & Penyerahan &rarr; <strong>Dikosongkan</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Riwayat Rekap Harian Tersimpan &rarr; <strong>Dikosongkan</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Seluruh Riwayat Pembayaran Cash & Nota &rarr; <strong>Dikosongkan</strong></span>
              </div>
            </div>

            {/* Keamanan: Konfirmasi Ketik RESET */}
            <div className="mb-4 bg-rose-50/70 border border-rose-200/90 rounded-xl p-3">
              <label htmlFor="input-reset-confirm" className="block text-xs font-bold text-slate-800 mb-1">
                Ketik Konfirmasi Pengamanan:
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                Ketik kata <strong className="text-rose-600 font-mono bg-white px-1.5 py-0.5 rounded border border-rose-300">RESET</strong> di bawah ini untuk membuka tombol:
              </p>
              <input
                type="text"
                id="input-reset-confirm"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Ketik RESET"
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-rose-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-slate-800 tracking-wider uppercase"
                autoFocus
              />
            </div>

            <p className="text-[11px] text-rose-600 font-medium mb-4">
              Perhatian: Data yang telah direset tidak dapat dipulihkan kembali.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText('');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-reset-all"
                disabled={resetConfirmText.trim().toUpperCase() !== 'RESET'}
                onClick={handleResetData}
                className={`px-4 py-2 text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 ${
                  resetConfirmText.trim().toUpperCase() === 'RESET'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ya, Reset Semua ke 0</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supabase PostgreSQL Database Modal */}
      <SupabaseModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
        currentData={currentDataPayload}
        onRefreshData={() => showToast('Data Supabase berhasil disinkronkan!')}
      />

      {/* Backup & Restore Data Modal (Supabase Cloud & Local) */}
      <BackupRestoreModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        currentData={currentDataPayload}
        onRestoreSuccess={handleRestoreSuccess}
        isSupabaseConnected={isSupabaseConnected}
      />
    </div>
  );
}
