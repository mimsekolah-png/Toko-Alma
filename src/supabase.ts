import { createClient } from '@supabase/supabase-js';
import type {
  CashTransaction,
  DailyRecap,
  KasAccounts,
  PaymentRecord,
  PiutangItem,
  TitipanItem,
  AppBackupData,
  AppDataPayload,
} from './types';

// Konfigurasi Project URL & Publishable Key Supabase
export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string) ||
  'https://agggaxhyhuvdqwfnwvon.supabase.co';

export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string) ||
  'sb_publishable_Ki3oVU9WExVLCEeyGTm0Lg_7Ntkjlyf';

// Inisialisasi Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export interface SupabaseConnectionStatus {
  success: boolean;
  latency: number;
  message: string;
  hasTables: boolean;
  missingTables?: string[];
}

/**
 * Pengujian Koneksi Database Supabase
 * Menguji koneksi, latensi, dan keberadaan tabel
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  const t0 = performance.now();
  try {
    // Uji koneksi pertama dengan query ke salah satu tabel
    const { data: _data, error } = await supabase.from('cash_transactions').select('id').limit(1);
    const latency = Math.round(performance.now() - t0);

    if (error) {
      // Kode PGRST205 / PGRST116 berarti tabel belum dibuat di Supabase
      if (error.code === 'PGRST205' || error.message.includes('relation') || error.message.includes('schema cache')) {
        return {
          success: true,
          latency,
          message: 'Terkoneksi ke server Supabase, namun tabel belum dibuat di SQL Editor.',
          hasTables: false,
          missingTables: ['cash_transactions', 'piutang', 'titipan', 'rekap', 'settings', 'kas_draft'],
        };
      }
      return {
        success: false,
        latency,
        message: `Koneksi Supabase error: ${error.message} (${error.code || 'UNKNOWN'})`,
        hasTables: false,
      };
    }

    return {
      success: true,
      latency,
      message: `Terhubung dengan sukses ke Supabase PostgreSQL (${latency}ms). Database siap digunakan!`,
      hasTables: true,
    };
  } catch (err) {
    const latency = Math.round(performance.now() - t0);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      latency,
      message: `Gagal terhubung ke Supabase: ${msg}`,
      hasTables: false,
    };
  }
}

// ==============================================================
// CRUD 1: CASH TRANSACTIONS (Nota Kasir)
// ==============================================================

export async function fetchSupabaseCashTransactions(): Promise<CashTransaction[]> {
  const { data, error } = await supabase
    .from('cash_transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase fetch cash_transactions warning:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    noNota: row.no_nota,
    namaPelanggan: row.nama_pelanggan,
    telepon: row.telepon || undefined,
    items: Array.isArray(row.items) ? row.items : [],
    total: Number(row.total) || 0,
    uangDiterima: Number(row.uang_diterima) || 0,
    kembalian: Number(row.kembalian) || 0,
    statusBayar: row.status_bayar || 'lunas',
    tanggalLunas: row.tanggal_lunas || undefined,
    waktuLunas: row.waktu_lunas || undefined,
    catatanPelunasan: row.catatan_pelunasan || undefined,
    keterangan: row.keterangan || undefined,
    tanggal: row.tanggal,
    waktu: row.waktu,
    createdAt: Number(row.created_at) || Date.now(),
  }));
}

export async function upsertSupabaseCashTransaction(item: CashTransaction): Promise<boolean> {
  const payload = {
    id: item.id,
    no_nota: item.noNota,
    nama_pelanggan: item.namaPelanggan,
    telepon: item.telepon || null,
    items: item.items || [],
    total: item.total,
    uang_diterima: item.uangDiterima,
    kembalian: item.kembalian,
    status_bayar: item.statusBayar || 'lunas',
    tanggal_lunas: item.tanggalLunas || null,
    waktu_lunas: item.waktuLunas || null,
    catatan_pelunasan: item.catatanPelunasan || null,
    keterangan: item.keterangan || null,
    tanggal: item.tanggal,
    waktu: item.waktu,
    created_at: item.createdAt || Date.now(),
  };

  const { error } = await supabase.from('cash_transactions').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Supabase upsert cash_transactions error:', error);
    return false;
  }
  return true;
}

export async function deleteSupabaseCashTransaction(id: string): Promise<boolean> {
  const { error } = await supabase.from('cash_transactions').delete().eq('id', id);
  if (error) {
    console.error('Supabase delete cash_transactions error:', error);
    return false;
  }
  return true;
}

// ==============================================================
// CRUD 2: PIUTANG (Bon Piutang)
// ==============================================================

export async function fetchSupabasePiutang(): Promise<PiutangItem[]> {
  const { data, error } = await supabase
    .from('piutang')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase fetch piutang warning:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    nama: row.nama,
    keterangan: row.keterangan || '',
    nominal: Number(row.nominal) || 0,
    tanggal: row.tanggal,
    status: row.status || 'belum_lunas',
    telepon: row.telepon || undefined,
    createdAt: Number(row.created_at) || Date.now(),
  }));
}

export async function upsertSupabasePiutang(item: PiutangItem): Promise<boolean> {
  const payload = {
    id: item.id,
    nama: item.nama,
    keterangan: item.keterangan,
    nominal: item.nominal,
    tanggal: item.tanggal,
    status: item.status,
    telepon: item.telepon || null,
    created_at: item.createdAt || Date.now(),
  };

  const { error } = await supabase.from('piutang').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Supabase upsert piutang error:', error);
    return false;
  }
  return true;
}

export async function deleteSupabasePiutang(id: string): Promise<boolean> {
  const { error } = await supabase.from('piutang').delete().eq('id', id);
  if (error) {
    console.error('Supabase delete piutang error:', error);
    return false;
  }
  return true;
}

// ==============================================================
// CRUD 3: PIUTANG PAYMENTS (Cicilan Piutang)
// ==============================================================

export async function fetchSupabasePiutangPayments(): Promise<PaymentRecord[]> {
  const { data, error } = await supabase
    .from('piutang_payments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase fetch piutang_payments warning:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    nama: row.nama,
    nominal: Number(row.nominal) || 0,
    keterangan: row.keterangan || '',
    tanggal: row.tanggal,
    createdAt: Number(row.created_at) || Date.now(),
  }));
}

export async function upsertSupabasePiutangPayment(item: PaymentRecord): Promise<boolean> {
  const payload = {
    id: item.id,
    nama: item.nama,
    nominal: item.nominal,
    keterangan: item.keterangan,
    tanggal: item.tanggal,
    created_at: item.createdAt || Date.now(),
  };

  const { error } = await supabase.from('piutang_payments').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Supabase upsert piutang_payments error:', error);
    return false;
  }
  return true;
}

export async function deleteSupabasePiutangPayment(id: string): Promise<boolean> {
  const { error } = await supabase.from('piutang_payments').delete().eq('id', id);
  if (error) {
    console.error('Supabase delete piutang_payments error:', error);
    return false;
  }
  return true;
}

// ==============================================================
// CRUD 4: TITIPAN (Buku Titipan)
// ==============================================================

export async function fetchSupabaseTitipan(): Promise<TitipanItem[]> {
  const { data, error } = await supabase
    .from('titipan')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase fetch titipan warning:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    nama: row.nama,
    keterangan: row.keterangan || '',
    nominal: Number(row.nominal) || 0,
    tanggal: row.tanggal,
    status: row.status || 'aktif',
    telepon: row.telepon || undefined,
    createdAt: Number(row.created_at) || Date.now(),
  }));
}

export async function upsertSupabaseTitipan(item: TitipanItem): Promise<boolean> {
  const payload = {
    id: item.id,
    nama: item.nama,
    keterangan: item.keterangan,
    nominal: item.nominal,
    tanggal: item.tanggal,
    status: item.status,
    telepon: item.telepon || null,
    created_at: item.createdAt || Date.now(),
  };

  const { error } = await supabase.from('titipan').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Supabase upsert titipan error:', error);
    return false;
  }
  return true;
}

export async function deleteSupabaseTitipan(id: string): Promise<boolean> {
  const { error } = await supabase.from('titipan').delete().eq('id', id);
  if (error) {
    console.error('Supabase delete titipan error:', error);
    return false;
  }
  return true;
}

// ==============================================================
// CRUD 5: TITIPAN PAYMENTS (Penyerahan Titipan)
// ==============================================================

export async function fetchSupabaseTitipanPayments(): Promise<PaymentRecord[]> {
  const { data, error } = await supabase
    .from('titipan_payments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase fetch titipan_payments warning:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    nama: row.nama,
    nominal: Number(row.nominal) || 0,
    keterangan: row.keterangan || '',
    tanggal: row.tanggal,
    createdAt: Number(row.created_at) || Date.now(),
  }));
}

export async function upsertSupabaseTitipanPayment(item: PaymentRecord): Promise<boolean> {
  const payload = {
    id: item.id,
    nama: item.nama,
    nominal: item.nominal,
    keterangan: item.keterangan,
    tanggal: item.tanggal,
    created_at: item.createdAt || Date.now(),
  };

  const { error } = await supabase.from('titipan_payments').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Supabase upsert titipan_payments error:', error);
    return false;
  }
  return true;
}

export async function deleteSupabaseTitipanPayment(id: string): Promise<boolean> {
  const { error } = await supabase.from('titipan_payments').delete().eq('id', id);
  if (error) {
    console.error('Supabase delete titipan_payments error:', error);
    return false;
  }
  return true;
}

// ==============================================================
// CRUD 6: REKAP HARIAN (Daily Recap)
// ==============================================================

export async function fetchSupabaseRekap(): Promise<DailyRecap[]> {
  const { data, error } = await supabase
    .from('rekap')
    .select('*')
    .order('tanggal', { ascending: false });

  if (error) {
    console.warn('Supabase fetch rekap warning:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    tanggal: row.tanggal,
    modalAwal: Number(row.modal_awal) || 0,
    kas: (row.kas && typeof row.kas === 'object') ? row.kas : {
      bri: 0, bni: 0, flip: 0, dana: 0, od: 0, edc: 0, cash: 0
    },
    totalKasMurni: Number(row.total_kas_murni) || 0,
    piutangTotal: Number(row.piutang_total) || 0,
    titipanTotal: Number(row.titipan_total) || 0,
    totalKasHarian: Number(row.total_kas_harian) || 0,
    totalKasKemarin: Number(row.total_kas_kemarin) || 0,
    labaHarian: Number(row.laba_harian) || 0,
    labaBulanan: Number(row.laba_bulanan) || 0,
    catatan: row.catatan || undefined,
    savedAt: row.saved_at || new Date().toISOString(),
  }));
}

export async function upsertSupabaseRekap(item: DailyRecap): Promise<boolean> {
  const payload = {
    id: item.id,
    tanggal: item.tanggal,
    modal_awal: item.modalAwal,
    kas: item.kas,
    total_kas_murni: item.totalKasMurni,
    piutang_total: item.piutangTotal,
    titipan_total: item.titipanTotal,
    total_kas_harian: item.totalKasHarian,
    total_kas_kemarin: item.totalKasKemarin,
    laba_harian: item.labaHarian,
    laba_bulanan: item.labaBulanan,
    catatan: item.catatan || null,
    saved_at: item.savedAt,
  };

  const { error } = await supabase.from('rekap').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Supabase upsert rekap error:', error);
    return false;
  }
  return true;
}

export async function deleteSupabaseRekap(id: string): Promise<boolean> {
  const { error } = await supabase.from('rekap').delete().eq('id', id);
  if (error) {
    console.error('Supabase delete rekap error:', error);
    return false;
  }
  return true;
}

// ==============================================================
// CRUD 7: SETTINGS & KAS DRAFT
// ==============================================================

export async function fetchSupabaseSettings(): Promise<{ modalAwal: number }> {
  const { data, error } = await supabase
    .from('settings')
    .select('modal_awal')
    .eq('id', 'general')
    .single();

  if (error || !data) {
    return { modalAwal: 0 };
  }
  return { modalAwal: Number(data.modal_awal) || 0 };
}

export async function saveSupabaseModalAwal(val: number): Promise<boolean> {
  const { error } = await supabase.from('settings').upsert({
    id: 'general',
    modal_awal: val,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error('Supabase save modal awal error:', error);
    return false;
  }
  return true;
}

export async function fetchSupabaseKasDraft(): Promise<KasAccounts | null> {
  const { data, error } = await supabase
    .from('kas_draft')
    .select('*')
    .eq('id', 'draft')
    .single();

  if (error || !data) {
    return null;
  }

  return {
    bri: Number(data.bri) || 0,
    bni: Number(data.bni) || 0,
    flip: Number(data.flip) || 0,
    dana: Number(data.dana) || 0,
    od: Number(data.od) || 0,
    edc: Number(data.edc) || 0,
    cash: Number(data.cash) || 0,
  };
}

export async function saveSupabaseKasDraft(kas: KasAccounts): Promise<boolean> {
  const payload = {
    id: 'draft',
    bri: kas.bri || 0,
    bni: kas.bni || 0,
    flip: kas.flip || 0,
    dana: kas.dana || 0,
    od: kas.od || 0,
    edc: kas.edc || 0,
    cash: kas.cash || 0,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('kas_draft').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Supabase save kas draft error:', error);
    return false;
  }
  return true;
}

// ==============================================================
// CRUD 8: BACKUPS & RESTORE
// ==============================================================

export async function fetchSupabaseBackups(): Promise<AppBackupData[]> {
  const { data, error } = await supabase
    .from('backups')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.warn('Supabase fetch backups warning:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    version: 1,
    appName: 'E-Jurnal Toko Alma',
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    timestamp: Number(row.timestamp),
    reason: row.reason || 'manual',
    data: row.data as AppDataPayload,
    summary: row.summary,
  }));
}

export async function saveSupabaseBackup(backup: AppBackupData): Promise<boolean> {
  const payload = {
    id: backup.id,
    name: backup.name,
    created_at: backup.createdAt,
    timestamp: backup.timestamp,
    reason: backup.reason || 'manual',
    data: backup.data,
    summary: backup.summary,
  };

  const { error } = await supabase.from('backups').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Supabase save backup error:', error);
    return false;
  }
  return true;
}

export async function deleteSupabaseBackup(id: string): Promise<boolean> {
  const { error } = await supabase.from('backups').delete().eq('id', id);
  if (error) {
    console.error('Supabase delete backup error:', error);
    return false;
  }
  return true;
}

// ==============================================================
// BULK UPLOAD SELURUH DATA KE SUPABASE
// ==============================================================

export async function uploadAllDataToSupabase(payload: AppDataPayload): Promise<{ success: boolean; count: number; error?: string }> {
  let count = 0;
  try {
    // 1. Settings & Kas
    await saveSupabaseModalAwal(payload.modalAwal ?? 0);
    await saveSupabaseKasDraft(payload.kas);
    count += 2;

    // 2. Piutang
    if (Array.isArray(payload.piutang) && payload.piutang.length > 0) {
      const rows = payload.piutang.map(p => ({
        id: p.id,
        nama: p.nama,
        keterangan: p.keterangan,
        nominal: p.nominal,
        tanggal: p.tanggal,
        status: p.status,
        telepon: p.telepon || null,
        created_at: p.createdAt || Date.now(),
      }));
      await supabase.from('piutang').upsert(rows, { onConflict: 'id' });
      count += rows.length;
    }

    // 3. Piutang Payments
    if (Array.isArray(payload.piutangPayments) && payload.piutangPayments.length > 0) {
      const rows = payload.piutangPayments.map(p => ({
        id: p.id,
        nama: p.nama,
        nominal: p.nominal,
        keterangan: p.keterangan,
        tanggal: p.tanggal,
        created_at: p.createdAt || Date.now(),
      }));
      await supabase.from('piutang_payments').upsert(rows, { onConflict: 'id' });
      count += rows.length;
    }

    // 4. Titipan
    if (Array.isArray(payload.titipan) && payload.titipan.length > 0) {
      const rows = payload.titipan.map(t => ({
        id: t.id,
        nama: t.nama,
        keterangan: t.keterangan,
        nominal: t.nominal,
        tanggal: t.tanggal,
        status: t.status,
        telepon: t.telepon || null,
        created_at: t.createdAt || Date.now(),
      }));
      await supabase.from('titipan').upsert(rows, { onConflict: 'id' });
      count += rows.length;
    }

    // 5. Titipan Payments
    if (Array.isArray(payload.titipanPayments) && payload.titipanPayments.length > 0) {
      const rows = payload.titipanPayments.map(t => ({
        id: t.id,
        nama: t.nama,
        nominal: t.nominal,
        keterangan: t.keterangan,
        tanggal: t.tanggal,
        created_at: t.createdAt || Date.now(),
      }));
      await supabase.from('titipan_payments').upsert(rows, { onConflict: 'id' });
      count += rows.length;
    }

    // 6. Rekap
    if (Array.isArray(payload.rekap) && payload.rekap.length > 0) {
      const rows = payload.rekap.map(r => ({
        id: r.id,
        tanggal: r.tanggal,
        modal_awal: r.modalAwal,
        kas: r.kas,
        total_kas_murni: r.totalKasMurni,
        piutang_total: r.piutangTotal,
        titipan_total: r.titipanTotal,
        total_kas_harian: r.totalKasHarian,
        total_kas_kemarin: r.totalKasKemarin,
        laba_harian: r.labaHarian,
        laba_bulanan: r.labaBulanan,
        catatan: r.catatan || null,
        saved_at: r.savedAt,
      }));
      await supabase.from('rekap').upsert(rows, { onConflict: 'id' });
      count += rows.length;
    }

    // 7. Cash Transactions
    if (Array.isArray(payload.cashTransactions) && payload.cashTransactions.length > 0) {
      const rows = payload.cashTransactions.map(c => ({
        id: c.id,
        no_nota: c.noNota,
        nama_pelanggan: c.namaPelanggan,
        telepon: c.telepon || null,
        items: c.items || [],
        total: c.total,
        uang_diterima: c.uangDiterima,
        kembalian: c.kembalian,
        status_bayar: c.statusBayar || 'lunas',
        tanggal_lunas: c.tanggalLunas || null,
        waktu_lunas: c.waktuLunas || null,
        catatan_pelunasan: c.catatanPelunasan || null,
        keterangan: c.keterangan || null,
        tanggal: c.tanggal,
        waktu: c.waktu,
        created_at: c.createdAt || Date.now(),
      }));
      await supabase.from('cash_transactions').upsert(rows, { onConflict: 'id' });
      count += rows.length;
    }

    return { success: true, count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error uploading all data to Supabase:', err);
    return { success: false, count, error: msg };
  }
}

// ==============================================================
// REALTIME SUBSCRIPTIONS (MULTI-DEVICE INSTANT SYNC)
// ==============================================================

export interface SupabaseRealtimeHandlers {
  onCashChange?: () => void;
  onPiutangChange?: () => void;
  onTitipanChange?: () => void;
  onRekapChange?: () => void;
  onSettingsChange?: () => void;
}

/**
 * Berlangganan perubahan Supabase Realtime di seluruh tabel
 * Ketika kasir membuat nota di HP, laptop & HP lain langsung terupdate seketika
 */
export function subscribeSupabaseRealtime(handlers: SupabaseRealtimeHandlers) {
  const channel = supabase
    .channel('toko-alma-realtime-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cash_transactions' },
      () => {
        handlers.onCashChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'piutang' },
      () => {
        handlers.onPiutangChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'piutang_payments' },
      () => {
        handlers.onPiutangChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'titipan' },
      () => {
        handlers.onTitipanChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'titipan_payments' },
      () => {
        handlers.onTitipanChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rekap' },
      () => {
        handlers.onRekapChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'settings' },
      () => {
        handlers.onSettingsChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'kas_draft' },
      () => {
        handlers.onSettingsChange?.();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
