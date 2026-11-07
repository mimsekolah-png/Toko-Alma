export interface KasAccounts {
  bri: number;
  bni: number;
  flip: number;
  dana: number;
  od: number;
  edc: number;
  cash: number;
}

export interface PaymentRecord {
  id: string;
  nama: string;
  nominal: number;
  keterangan: string;
  tanggal: string; // YYYY-MM-DD
  createdAt: number;
}

export interface PiutangItem {
  id: string;
  nama: string;
  keterangan: string;
  nominal: number;
  tanggal: string; // YYYY-MM-DD
  status: 'belum_lunas' | 'lunas';
  telepon?: string;
  createdAt: number;
}

export interface TitipanItem {
  id: string;
  nama: string;
  keterangan: string;
  nominal: number;
  tanggal: string; // YYYY-MM-DD
  status: 'aktif' | 'diambil';
  telepon?: string;
  createdAt: number;
}

export interface DailyRecap {
  id: string;
  tanggal: string; // YYYY-MM-DD
  modalAwal: number;
  kas: KasAccounts;
  totalKasMurni: number;
  piutangTotal: number;
  titipanTotal: number;
  totalKasHarian: number; // Kas + piutang - titipan
  totalKasKemarin: number; // total kas hari sebelumnya (atau modal awal jika awal bulan)
  labaHarian: number; // total kas hari ini - total kas kemarin (kembali ke nol setiap awal bulan)
  labaBulanan: number; // total kas hari ini - modal awal (kembali ke nol setiap awal bulan)
  catatan?: string;
  savedAt: string;
}

export interface CashTransactionItem {
  id: string;
  namaBarang: string;
  jumlah: number;
  hargaSatuan: number;
  subtotal: number;
}

export interface CashTransaction {
  id: string;
  noNota: string;
  namaPelanggan: string;
  telepon?: string;
  items: CashTransactionItem[];
  total: number;
  uangDiterima: number;
  kembalian: number;
  statusBayar?: 'lunas' | 'belum_lunas'; // 'lunas' (default) atau 'belum_lunas' (bisa dibayar kapan saja)
  tanggalLunas?: string; // YYYY-MM-DD saat dilunasi
  waktuLunas?: string; // HH:mm saat dilunasi
  catatanPelunasan?: string;
  keterangan?: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string; // HH:mm
  createdAt: number;
}

export type ActiveTab = 'jurnal' | 'piutang' | 'titipan' | 'rekap' | 'cash';

export interface AppDataPayload {
  modalAwal: number;
  kas: KasAccounts;
  piutang: PiutangItem[];
  piutangPayments: PaymentRecord[];
  titipan: TitipanItem[];
  titipanPayments: PaymentRecord[];
  rekap: DailyRecap[];
  cashTransactions: CashTransaction[];
  contacts?: Record<string, string>;
}

export interface AppBackupSummary {
  totalNotaCash: number;
  totalBonPiutang: number;
  totalTitipan: number;
  totalRekap: number;
  totalKasMurni: number;
  totalPiutangAktif?: number;
  totalTitipanAktif?: number;
}

export interface AppBackupData {
  version: number;
  appName: string;
  id: string;
  name: string;
  createdAt: string;
  timestamp: number;
  reason?: 'manual' | 'auto_before_restore' | 'auto_before_reset' | 'cloud' | string;
  data: AppDataPayload;
  summary: AppBackupSummary;
}
