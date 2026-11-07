import { PiutangItem, TitipanItem, PaymentRecord, DailyRecap } from '../types';
import { getPhoneForName } from './contacts';

export interface PastCycle<TItem> {
  cycleNumber: number;
  items: TItem[];
  payments: PaymentRecord[];
  totalItem: number;
  totalPayment: number;
  completedAt: string;
}

export interface CustomerCycleResult {
  nama: string;
  telepon: string;
  totalBon: number;
  totalDibayar: number;
  sisaTagihan: number;
  items: PiutangItem[]; // Hanya bon di siklus aktif saat ini
  payments: PaymentRecord[]; // Hanya pembayaran di siklus aktif saat ini
  latestDate: string;
  pastCycles: PastCycle<PiutangItem>[]; // Riwayat siklus sebelumnya yang sudah lunas
  allHistoricalItems: PiutangItem[];
  allHistoricalPayments: PaymentRecord[];
}

export interface PenitipCycleResult {
  nama: string;
  telepon: string;
  totalAwal: number;
  totalDiambil: number;
  sisaSaldo: number;
  items: TitipanItem[]; // Hanya titipan di siklus aktif saat ini
  payments: PaymentRecord[]; // Hanya penyerahan di siklus aktif saat ini
  latestDate: string;
  pastCycles: PastCycle<TitipanItem>[]; // Riwayat siklus sebelumnya yang sudah selesai/diambil
  allHistoricalItems: TitipanItem[];
  allHistoricalPayments: PaymentRecord[];
}

/**
 * Menghitung siklus piutang per pelanggan.
 * JIKA PIUTANG LUNAS (sisaTagihan <= 0), maka ketika ada bon baru diinput
 * dengan nama yang sama, perhitungan bon & sisa DIMULAI DARI NOL KEMBALI.
 */
export function calculateCustomerCycles(
  piutangList: PiutangItem[],
  payments: PaymentRecord[]
): CustomerCycleResult[] {
  const groups: Record<string, {
    nama: string;
    telepon: string;
    items: PiutangItem[];
    payments: PaymentRecord[];
  }> = {};

  // 1. Kumpulkan semua bon
  piutangList.forEach((item) => {
    const key = item.nama.trim().toLowerCase();
    if (!groups[key]) {
      groups[key] = {
        nama: item.nama.trim(),
        telepon: item.telepon || '',
        items: [],
        payments: [],
      };
    }
    groups[key].items.push(item);
    if (item.telepon) {
      groups[key].telepon = item.telepon;
    }
  });

  // 2. Kumpulkan semua pembayaran
  payments.forEach((p) => {
    const key = p.nama.trim().toLowerCase();
    if (!groups[key]) {
      groups[key] = {
        nama: p.nama.trim(),
        telepon: '',
        items: [],
        payments: [],
      };
    }
    groups[key].payments.push(p);
  });

  // 3. Proses kronologis per pelanggan
  const results: CustomerCycleResult[] = [];

  Object.values(groups).forEach((group) => {
    // Gabungkan transaksi menjadi timeline kronologis
    type Event = 
      | { type: 'item'; data: PiutangItem; tanggal: string; createdAt: number }
      | { type: 'payment'; data: PaymentRecord; tanggal: string; createdAt: number };

    const events: Event[] = [
      ...group.items.map((it) => ({
        type: 'item' as const,
        data: it,
        tanggal: it.tanggal,
        createdAt: it.createdAt || 0,
      })),
      ...group.payments.map((p) => ({
        type: 'payment' as const,
        data: p,
        tanggal: p.tanggal,
        createdAt: p.createdAt || 0,
      })),
    ];

    // Urutkan: tanggal ASC, createdAt ASC, bon ('item') sebelum payment jika timestamp sama
    events.sort((a, b) => {
      const dateCmp = a.tanggal.localeCompare(b.tanggal);
      if (dateCmp !== 0) return dateCmp;
      const timeCmp = a.createdAt - b.createdAt;
      if (timeCmp !== 0) return timeCmp;
      if (a.type === 'item' && b.type === 'payment') return -1;
      if (a.type === 'payment' && b.type === 'item') return 1;
      return 0;
    });

    let runningBalance = 0;
    let currentItems: PiutangItem[] = [];
    let currentPayments: PaymentRecord[] = [];
    const pastCycles: PastCycle<PiutangItem>[] = [];
    let latestDate = '';

    events.forEach((ev) => {
      if (ev.tanggal > latestDate) {
        latestDate = ev.tanggal;
      }

      if (ev.type === 'item') {
        // JIKA SIKLUS SEBELUMNYA SUDAH LUNAS (runningBalance === 0 dan sudah ada catatan sebelumnya),
        // maka bon baru ini memulai siklus baru dari NOL KEMBALI!
        if (runningBalance === 0 && (currentItems.length > 0 || currentPayments.length > 0)) {
          pastCycles.push({
            cycleNumber: pastCycles.length + 1,
            items: [...currentItems],
            payments: [...currentPayments],
            totalItem: currentItems.reduce((s, x) => s + x.nominal, 0),
            totalPayment: currentPayments.reduce((s, x) => s + x.nominal, 0),
            completedAt: currentPayments[currentPayments.length - 1]?.tanggal || latestDate,
          });
          currentItems = [];
          currentPayments = [];
          runningBalance = 0;
        }

        currentItems.push(ev.data);
        runningBalance += ev.data.nominal;
      } else {
        // Payment
        currentPayments.push(ev.data);
        runningBalance -= ev.data.nominal;
        if (runningBalance <= 0) {
          runningBalance = 0;
          // Lunas tercapai
        }
      }
    });

    const activeTotalBon = currentItems.reduce((s, x) => s + x.nominal, 0);
    const activeTotalBayar = currentPayments.reduce((s, x) => s + x.nominal, 0);
    const activeSisa = Math.max(0, runningBalance);

    // Urutkan item aktif descending untuk kenyamanan display
    const sortedCurrentItems = [...currentItems].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const sortedCurrentPayments = [...currentPayments].sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    results.push({
      nama: group.nama,
      telepon: group.telepon || getPhoneForName(group.nama) || '',
      totalBon: activeTotalBon,
      totalDibayar: activeTotalBayar,
      sisaTagihan: activeSisa,
      items: sortedCurrentItems,
      payments: sortedCurrentPayments,
      latestDate: latestDate || group.items[0]?.tanggal || '',
      pastCycles,
      allHistoricalItems: [...group.items].sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
      allHistoricalPayments: [...group.payments].sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    });
  });

  return results.sort((a, b) => b.sisaTagihan - a.sisaTagihan);
}

/**
 * Menghitung siklus titipan per penitip.
 * JIKA TITIPAN LUNAS / SELESAI DIAMBIL (sisaSaldo <= 0), maka ketika ada titipan baru diinput
 * dengan nama yang sama, perhitungan titipan & sisa DIMULAI DARI NOL KEMBALI.
 */
export function calculatePenitipCycles(
  titipanList: TitipanItem[],
  payments: PaymentRecord[]
): PenitipCycleResult[] {
  const groups: Record<string, {
    nama: string;
    telepon: string;
    items: TitipanItem[];
    payments: PaymentRecord[];
  }> = {};

  // 1. Kumpulkan semua titipan masuk
  titipanList.forEach((item) => {
    const key = item.nama.trim().toLowerCase();
    if (!groups[key]) {
      groups[key] = {
        nama: item.nama.trim(),
        telepon: item.telepon || '',
        items: [],
        payments: [],
      };
    }
    groups[key].items.push(item);
    if (item.telepon) {
      groups[key].telepon = item.telepon;
    }
  });

  // 2. Kumpulkan semua penyerahan titipan
  payments.forEach((p) => {
    const key = p.nama.trim().toLowerCase();
    if (!groups[key]) {
      groups[key] = {
        nama: p.nama.trim(),
        telepon: '',
        items: [],
        payments: [],
      };
    }
    groups[key].payments.push(p);
  });

  // 3. Proses kronologis per penitip
  const results: PenitipCycleResult[] = [];

  Object.values(groups).forEach((group) => {
    type Event = 
      | { type: 'item'; data: TitipanItem; tanggal: string; createdAt: number }
      | { type: 'payment'; data: PaymentRecord; tanggal: string; createdAt: number };

    const events: Event[] = [
      ...group.items.map((it) => ({
        type: 'item' as const,
        data: it,
        tanggal: it.tanggal,
        createdAt: it.createdAt || 0,
      })),
      ...group.payments.map((p) => ({
        type: 'payment' as const,
        data: p,
        tanggal: p.tanggal,
        createdAt: p.createdAt || 0,
      })),
    ];

    events.sort((a, b) => {
      const dateCmp = a.tanggal.localeCompare(b.tanggal);
      if (dateCmp !== 0) return dateCmp;
      const timeCmp = a.createdAt - b.createdAt;
      if (timeCmp !== 0) return timeCmp;
      if (a.type === 'item' && b.type === 'payment') return -1;
      if (a.type === 'payment' && b.type === 'item') return 1;
      return 0;
    });

    let runningBalance = 0;
    let currentItems: TitipanItem[] = [];
    let currentPayments: PaymentRecord[] = [];
    const pastCycles: PastCycle<TitipanItem>[] = [];
    let latestDate = '';

    events.forEach((ev) => {
      if (ev.tanggal > latestDate) {
        latestDate = ev.tanggal;
      }

      if (ev.type === 'item') {
        // JIKA SIKLUS TITIPAN SEBELUMNYA SUDAH SELESAI DIAMBIL (runningBalance === 0),
        // maka titipan baru ini memulai siklus baru dari NOL KEMBALI!
        if (runningBalance === 0 && (currentItems.length > 0 || currentPayments.length > 0)) {
          pastCycles.push({
            cycleNumber: pastCycles.length + 1,
            items: [...currentItems],
            payments: [...currentPayments],
            totalItem: currentItems.reduce((s, x) => s + x.nominal, 0),
            totalPayment: currentPayments.reduce((s, x) => s + x.nominal, 0),
            completedAt: currentPayments[currentPayments.length - 1]?.tanggal || latestDate,
          });
          currentItems = [];
          currentPayments = [];
          runningBalance = 0;
        }

        currentItems.push(ev.data);
        runningBalance += ev.data.nominal;
      } else {
        currentPayments.push(ev.data);
        runningBalance -= ev.data.nominal;
        if (runningBalance <= 0) {
          runningBalance = 0;
        }
      }
    });

    const activeTotalAwal = currentItems.reduce((s, x) => s + x.nominal, 0);
    const activeTotalDiambil = currentPayments.reduce((s, x) => s + x.nominal, 0);
    const activeSisa = Math.max(0, runningBalance);

    const sortedCurrentItems = [...currentItems].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const sortedCurrentPayments = [...currentPayments].sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    results.push({
      nama: group.nama,
      telepon: group.telepon || getPhoneForName(group.nama) || '',
      totalAwal: activeTotalAwal,
      totalDiambil: activeTotalDiambil,
      sisaSaldo: activeSisa,
      items: sortedCurrentItems,
      payments: sortedCurrentPayments,
      latestDate: latestDate || group.items[0]?.tanggal || '',
      pastCycles,
      allHistoricalItems: [...group.items].sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
      allHistoricalPayments: [...group.payments].sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    });
  });

  return results.sort((a, b) => b.sisaSaldo - a.sisaSaldo);
}

/**
 * Menghitung total kas kemarin untuk perhitungan Laba Harian.
 * KETENTUAN USER:
 * 1. Perhitungan laba setiap awal bulan KEMBALI KE NOL LAGI.
 * 2. Modal yang dihitung di laba adalah MODAL AWAL.
 * 
 * Aturan perhitungan:
 * - Pada awal bulan (hari pertama di bulan ini / belum ada rekap sebelumnya pada bulan yang sama),
 *   total kas acuan adalah MODAL AWAL.
 * - Pada hari-hari berikutnya di bulan yang sama, total kas acuan adalah total kas hari sebelumnya di bulan tersebut.
 */
export function getTotalKasKemarin(
  targetDate: string,
  rekapList: DailyRecap[],
  modalAwal: number
): number {
  if (!targetDate || targetDate.length < 7) return modalAwal;
  const targetMonthPrefix = targetDate.slice(0, 7); // "YYYY-MM"

  // Cari rekap sebelumnya di DALAM BULAN YANG SAMA
  const priorRecapsInSameMonth = rekapList
    .filter((r) => r.tanggal.startsWith(targetMonthPrefix) && r.tanggal < targetDate)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  if (priorRecapsInSameMonth.length > 0) {
    return priorRecapsInSameMonth[0].totalKasHarian;
  }

  // Jika ini awal bulan (belum ada rekap di bulan ini sebelum targetDate), modal yang dihitung adalah MODAL AWAL
  return modalAwal;
}

/**
 * Menghitung saldo kas baseline awal bulan untuk perhitungan Laba Bulanan.
 * KETENTUAN USER:
 * "perhitungan laba setiap awal bulan kembali ke nol lagi, dan modal yang di hitung di laba adalah modal awal."
 * 
 * Baseline modal yang dihitung di laba bulanan adalah MODAL AWAL.
 * Sehingga Laba Bulanan = Total Kas Harian - Modal Awal.
 * Pada awal bulan ketika kas = modal awal, laba bulanan = 0 (kembali ke nol lagi).
 */
export function getMonthlyBaselineKas(
  _targetDate?: string,
  _rekapList?: DailyRecap[],
  modalAwal: number = 0
): number {
  return modalAwal;
}
