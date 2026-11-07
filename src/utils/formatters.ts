export function formatRupiah(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseNumberInput(val: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  // Remove non-digits except minus
  const clean = val.replace(/[^0-9-]/g, '');
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatTanggalIndo(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generatePiutangShareText(
  customerName: string,
  items: Array<{ tanggal: string; keterangan: string; nominal: number }>,
  total: number
): string {
  const today = formatTanggalIndo(getTodayDateString());
  const itemLines = items
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.tanggal} - ${item.keterangan}: ${formatRupiah(item.nominal)}`
    )
    .join('\n');

  return `*REKAP TAGIHAN PIUTANG - TOKO ALMA*
Kepada Yth. Bpk/Ibu: *${customerName}*
Per Tanggal: ${today}

Rincian Tagihan:
${itemLines}
----------------------------------------
*Total Tagihan: ${formatRupiah(total)}*

Mohon konfirmasi jika ada kekeliruan pencatatan atau jika telah melakukan pembayaran.
Terima kasih atas kepercayaannya berbelanja di Toko Alma 🙏
_Admin Toko Alma_`;
}

export function generateTitipanShareText(
  depositorName: string,
  items: Array<{ tanggal: string; keterangan: string; nominal: number }>,
  total: number
): string {
  const today = formatTanggalIndo(getTodayDateString());
  const itemLines = items
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.tanggal} - ${item.keterangan}: ${formatRupiah(item.nominal)}`
    )
    .join('\n');

  return `*BUKTI REKAP TITIPAN - TOKO ALMA*
Kepada Yth: *${depositorName}*
Per Tanggal: ${today}

Rincian Titipan:
${itemLines}
----------------------------------------
*Total Saldo Titipan: ${formatRupiah(total)}*

Catatan: Dana/barang titipan tercatat dan tersimpan dengan aman di Toko Alma.
Terima kasih 🙏
_Admin Toko Alma_`;
}
