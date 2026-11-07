-- ==============================================================
-- SKEMA DATABASE SUPABASE POSTGRESQL UNTUK E-JURNAL TOKO ALMA
-- Salin dan jalankan script ini di Supabase SQL Editor:
-- Dashboard Supabase -> SQL Editor -> New Query -> Run
-- ==============================================================

-- 1. Tabel Pengaturan (Modal Awal & General Config)
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

-- ==============================================================
-- AKTIFKAN ROW LEVEL SECURITY (RLS) & KEBIJAKAN AKSES AMAN
-- ==============================================================

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kas_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piutang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piutang_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titipan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titipan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rekap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses: Memperbolehkan akses operasional toko (Anon & Authenticated)
DROP POLICY IF EXISTS "Akses Penuh Settings" ON public.settings;
CREATE POLICY "Akses Penuh Settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Akses Penuh Kas Draft" ON public.kas_draft;
CREATE POLICY "Akses Penuh Kas Draft" ON public.kas_draft FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Akses Penuh Cash Transactions" ON public.cash_transactions;
CREATE POLICY "Akses Penuh Cash Transactions" ON public.cash_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Akses Penuh Piutang" ON public.piutang;
CREATE POLICY "Akses Penuh Piutang" ON public.piutang FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Akses Penuh Piutang Payments" ON public.piutang_payments;
CREATE POLICY "Akses Penuh Piutang Payments" ON public.piutang_payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Akses Penuh Titipan" ON public.titipan;
CREATE POLICY "Akses Penuh Titipan" ON public.titipan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Akses Penuh Titipan Payments" ON public.titipan_payments;
CREATE POLICY "Akses Penuh Titipan Payments" ON public.titipan_payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Akses Penuh Rekap" ON public.rekap;
CREATE POLICY "Akses Penuh Rekap" ON public.rekap FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Akses Penuh Backups" ON public.backups;
CREATE POLICY "Akses Penuh Backups" ON public.backups FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================
-- AKTIFKAN SUPABASE REALTIME REPLICATION (SINKRONISASI INSTAN SEMUA HP)
-- ==============================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
        public.settings, 
        public.kas_draft, 
        public.cash_transactions, 
        public.piutang, 
        public.piutang_payments, 
        public.titipan, 
        public.titipan_payments, 
        public.rekap;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
