import { 
  DailyRecap, 
  KasAccounts, 
  PaymentRecord, 
  PiutangItem, 
  TitipanItem, 
  CashTransaction,
  AppDataPayload,
  AppBackupData,
  AppBackupSummary
} from '../types';
import { getStoredContacts } from './contacts';

const STORAGE_KEYS = {
  MODAL_AWAL: 'ejurnal_alma_modal_awal',
  KAS_DRAFT: 'ejurnal_alma_kas_draft',
  PIUTANG: 'ejurnal_alma_piutang',
  PIUTANG_PAYMENTS: 'ejurnal_alma_piutang_payments',
  TITIPAN: 'ejurnal_alma_titipan',
  TITIPAN_PAYMENTS: 'ejurnal_alma_titipan_payments',
  REKAP: 'ejurnal_alma_rekap',
  CASH_TRANSACTIONS: 'ejurnal_alma_cash_transactions',
  SETTINGS: 'ejurnal_alma_settings',
  SNAPSHOTS: 'ejurnal_alma_local_snapshots',
};

const DEFAULT_MODAL_AWAL = 0;

const DEFAULT_KAS: KasAccounts = {
  bri: 0,
  bni: 0,
  flip: 0,
  dana: 0,
  od: 0,
  edc: 0,
  cash: 0,
};

const DEFAULT_PIUTANG: PiutangItem[] = [];
const DEFAULT_PIUTANG_PAYMENTS: PaymentRecord[] = [];
const DEFAULT_TITIPAN: TitipanItem[] = [];
const DEFAULT_TITIPAN_PAYMENTS: PaymentRecord[] = [];
const DEFAULT_REKAP: DailyRecap[] = [];
const DEFAULT_CASH_TRANSACTIONS: CashTransaction[] = [];

// Clean Reset Version: wipe out any previous mock demo entries from user's localStorage
const CLEAN_RESET_VERSION_KEY = 'ejurnal_alma_reset_clean_v3';

function checkAndAutoResetLegacyData(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const isReset = localStorage.getItem(CLEAN_RESET_VERSION_KEY);
      if (!isReset) {
        resetAllDataToDefault();
        localStorage.setItem(CLEAN_RESET_VERSION_KEY, 'true');
      }
    }
  } catch (e) {
    console.error('Error auto resetting legacy data:', e);
  }
}

// Execute auto-reset check immediately upon module evaluation
checkAndAutoResetLegacyData();

export function getStoredModalAwal(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MODAL_AWAL);
    if (raw !== null) {
      const num = Number(raw);
      if (!isNaN(num)) return num;
    }
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_MODAL_AWAL;
}

export function setStoredModalAwal(value: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MODAL_AWAL, value.toString());
  } catch (e) {
    console.error(e);
  }
}

export function getStoredKasDraft(): KasAccounts {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.KAS_DRAFT);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        bri: Number(parsed.bri) || 0,
        bni: Number(parsed.bni) || 0,
        flip: Number(parsed.flip) || 0,
        dana: Number(parsed.dana) || 0,
        od: Number(parsed.od) || 0,
        edc: Number(parsed.edc) || 0,
        cash: Number(parsed.cash) || 0,
      };
    }
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_KAS;
}

export function setStoredKasDraft(kas: KasAccounts): void {
  try {
    localStorage.setItem(STORAGE_KEYS.KAS_DRAFT, JSON.stringify(kas));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredPiutang(): PiutangItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PIUTANG);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_PIUTANG;
}

export function setStoredPiutang(items: PiutangItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PIUTANG, JSON.stringify(items));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredPiutangPayments(): PaymentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PIUTANG_PAYMENTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_PIUTANG_PAYMENTS;
}

export function setStoredPiutangPayments(payments: PaymentRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PIUTANG_PAYMENTS, JSON.stringify(payments));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredTitipan(): TitipanItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TITIPAN);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_TITIPAN;
}

export function setStoredTitipan(items: TitipanItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TITIPAN, JSON.stringify(items));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredTitipanPayments(): PaymentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TITIPAN_PAYMENTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_TITIPAN_PAYMENTS;
}

export function setStoredTitipanPayments(payments: PaymentRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TITIPAN_PAYMENTS, JSON.stringify(payments));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredRekap(): DailyRecap[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REKAP);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_REKAP;
}

export function setStoredRekap(rekapList: DailyRecap[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.REKAP, JSON.stringify(rekapList));
  } catch (e) {
    console.error(e);
  }
}

export function getStoredCashTransactions(): CashTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CASH_TRANSACTIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_CASH_TRANSACTIONS;
}

export function setStoredCashTransactions(transactions: CashTransaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CASH_TRANSACTIONS, JSON.stringify(transactions));
  } catch (e) {
    console.error(e);
  }
}

export function resetAllDataToDefault(): void {
  localStorage.setItem(STORAGE_KEYS.MODAL_AWAL, DEFAULT_MODAL_AWAL.toString());
  localStorage.setItem(STORAGE_KEYS.KAS_DRAFT, JSON.stringify(DEFAULT_KAS));
  localStorage.setItem(STORAGE_KEYS.PIUTANG, JSON.stringify(DEFAULT_PIUTANG));
  localStorage.setItem(STORAGE_KEYS.PIUTANG_PAYMENTS, JSON.stringify(DEFAULT_PIUTANG_PAYMENTS));
  localStorage.setItem(STORAGE_KEYS.TITIPAN, JSON.stringify(DEFAULT_TITIPAN));
  localStorage.setItem(STORAGE_KEYS.TITIPAN_PAYMENTS, JSON.stringify(DEFAULT_TITIPAN_PAYMENTS));
  localStorage.setItem(STORAGE_KEYS.REKAP, JSON.stringify(DEFAULT_REKAP));
  localStorage.setItem(STORAGE_KEYS.CASH_TRANSACTIONS, JSON.stringify(DEFAULT_CASH_TRANSACTIONS));
}

/**
 * Mengambil seluruh data aplikasi yang tersimpan saat ini
 */
export function getCurrentAppData(): AppDataPayload {
  return {
    modalAwal: getStoredModalAwal(),
    kas: getStoredKasDraft(),
    piutang: getStoredPiutang(),
    piutangPayments: getStoredPiutangPayments(),
    titipan: getStoredTitipan(),
    titipanPayments: getStoredTitipanPayments(),
    rekap: getStoredRekap(),
    cashTransactions: getStoredCashTransactions(),
    contacts: getStoredContacts(),
  };
}

/**
 * Menyusun data backup terstruktur lengkap dengan ringkasan
 */
export function buildBackupData(
  payload: AppDataPayload,
  name?: string,
  reason: string = 'manual'
): AppBackupData {
  const timestamp = Date.now();
  const dateStr = new Date(timestamp).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalKasMurni =
    (payload.kas.bri || 0) +
    (payload.kas.bni || 0) +
    (payload.kas.flip || 0) +
    (payload.kas.dana || 0) +
    (payload.kas.od || 0) +
    (payload.kas.edc || 0) +
    (payload.kas.cash || 0);

  const summary: AppBackupSummary = {
    totalNotaCash: payload.cashTransactions?.length || 0,
    totalBonPiutang: payload.piutang?.length || 0,
    totalTitipan: payload.titipan?.length || 0,
    totalRekap: payload.rekap?.length || 0,
    totalKasMurni,
  };

  return {
    version: 1,
    appName: 'E-Jurnal Toko Alma',
    id: `backup-${timestamp}`,
    name: name || `Cadangan Toko Alma (${dateStr})`,
    createdAt: new Date(timestamp).toISOString(),
    timestamp,
    reason,
    data: {
      modalAwal: Number(payload.modalAwal) || 0,
      kas: payload.kas || DEFAULT_KAS,
      piutang: Array.isArray(payload.piutang) ? payload.piutang : [],
      piutangPayments: Array.isArray(payload.piutangPayments) ? payload.piutangPayments : [],
      titipan: Array.isArray(payload.titipan) ? payload.titipan : [],
      titipanPayments: Array.isArray(payload.titipanPayments) ? payload.titipanPayments : [],
      rekap: Array.isArray(payload.rekap) ? payload.rekap : [],
      cashTransactions: Array.isArray(payload.cashTransactions) ? payload.cashTransactions : [],
      contacts: payload.contacts || getStoredContacts(),
    },
    summary,
  };
}

/**
 * Mengambil daftar riwayat snapshot lokal dari browser
 */
export function getStoredSnapshots(): AppBackupData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }
    }
  } catch (e) {
    console.error('Failed to load snapshots:', e);
  }
  return [];
}

/**
 * Menyimpan snapshot cadangan lokal di browser (maksimal 10 titik terbaru)
 */
export function saveLocalSnapshot(snapshot: AppBackupData): void {
  try {
    const current = getStoredSnapshots();
    // Cegah duplikat id
    const filtered = current.filter((s) => s.id !== snapshot.id);
    const updated = [snapshot, ...filtered].slice(0, 10); // simpan maksimal 10 titik pemulihan
    localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save snapshot:', e);
  }
}

/**
 * Menghapus satu titik snapshot lokal
 */
export function deleteLocalSnapshot(id: string): void {
  try {
    const current = getStoredSnapshots();
    const updated = current.filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to delete snapshot:', e);
  }
}

/**
 * Menghapus seluruh riwayat snapshot lokal
 */
export function clearAllLocalSnapshots(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SNAPSHOTS);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Menyimpan seluruh data payload ke localStorage
 */
export function restoreAllDataToStorage(payload: AppDataPayload): void {
  if (typeof payload.modalAwal === 'number') {
    setStoredModalAwal(payload.modalAwal);
  }
  if (payload.kas) {
    setStoredKasDraft(payload.kas);
  }
  if (Array.isArray(payload.piutang)) {
    setStoredPiutang(payload.piutang);
  }
  if (Array.isArray(payload.piutangPayments)) {
    setStoredPiutangPayments(payload.piutangPayments);
  }
  if (Array.isArray(payload.titipan)) {
    setStoredTitipan(payload.titipan);
  }
  if (Array.isArray(payload.titipanPayments)) {
    setStoredTitipanPayments(payload.titipanPayments);
  }
  if (Array.isArray(payload.rekap)) {
    setStoredRekap(payload.rekap);
  }
  if (Array.isArray(payload.cashTransactions)) {
    setStoredCashTransactions(payload.cashTransactions);
  }
  if (payload.contacts && typeof payload.contacts === 'object') {
    try {
      localStorage.setItem('ejurnal_alma_contacts', JSON.stringify(payload.contacts));
    } catch (e) {
      console.error(e);
    }
  }
}

