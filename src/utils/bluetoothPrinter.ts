import { formatRupiah, formatTanggalIndo } from './formatters';

// Common thermal printer Bluetooth Service UUIDs (ESC/POS)
export const KNOWN_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Common Serial Port Profile (SPP) / BLE UART
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent/China POS Printers (RPP02, Panda, POS-58)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Bluetooth to Serial
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
];

export interface PrinterState {
  isConnected: boolean;
  deviceName: string | null;
  isConnecting: boolean;
  error: string | null;
}

export type PaperWidth = 32 | 48; // 32 chars for 58mm, 48 chars for 80mm

export type PrintDensity = 'extra' | 'bold' | 'normal'; // 'extra': Sangat Tebal & Pekat (Bold+), 'bold': Tebal, 'normal': Standar

export interface ReceiptItem {
  tanggal: string;
  keterangan: string;
  nominal: number;
}

export interface ReceiptPayment {
  tanggal: string;
  keterangan: string;
  nominal: number;
}

export interface ReceiptData {
  type: 'piutang' | 'titipan' | 'kas_harian' | 'pelunasan' | 'cash' | 'test';
  title?: string;
  name?: string;
  phone?: string;
  dateStr?: string;
  noNota?: string;
  keterangan?: string;
  items?: ReceiptItem[];
  payments?: ReceiptPayment[];
  cashItems?: Array<{ namaBarang: string; jumlah: number; hargaSatuan: number; subtotal: number }>;
  total?: number;
  totalBayar?: number;
  sisa?: number;
  sisaSebelum?: number;
  nominalBayar?: number;
  uangDiterima?: number;
  kembalian?: number;
  statusLunas?: boolean;
  kasBreakdown?: { [key: string]: number };
  totalKas?: number;
  labaHarian?: number;
  labaBulanan?: number;
}

class BluetoothPrinterService {
  private device: any = null;
  private characteristic: any = null;
  private listeners: Array<(state: PrinterState) => void> = [];

  private state: PrinterState = {
    isConnected: false,
    deviceName: null,
    isConnecting: false,
    error: null,
  };

  constructor() {
    // Check if device name was saved in session
    if (typeof window !== 'undefined') {
      const savedName = sessionStorage.getItem('ejurnal_bt_printer_name');
      if (savedName) {
        this.state.deviceName = savedName;
      }
    }
  }

  public subscribe(listener: (state: PrinterState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener({ ...this.state }));
  }

  public getState(): PrinterState {
    return { ...this.state };
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public isPolicyAllowed(): boolean {
    if (typeof document !== 'undefined') {
      try {
        const policy = (document as any).featurePolicy || (document as any).permissionsPolicy;
        if (policy && typeof policy.allowsFeature === 'function') {
          return policy.allowsFeature('bluetooth');
        }
      } catch {
        // ignore
      }
    }
    return true;
  }

  public async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      this.state.error = 'Browser ini tidak mendukung Web Bluetooth. Buka di Google Chrome (Android/PC).';
      this.notify();
      return false;
    }

    if (!this.isPolicyAllowed()) {
      this.state.isConnecting = false;
      this.state.isConnected = false;
      this.state.error = 'Akses Bluetooth dibatasi di jendela pratinjau (iframe). Silakan klik "Buka di Tab Baru" pada browser Google Chrome untuk menghubungkan printer, atau gunakan opsi "Cetak Biasa".';
      this.notify();
      return false;
    }

    this.state.isConnecting = true;
    this.state.error = null;
    this.notify();

    try {
      const navBt = (navigator as any).bluetooth;
      const device = await navBt.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_PRINTER_SERVICES,
      });

      if (!device) {
        throw new Error('Tidak ada printer bluetooth yang dipilih.');
      }

      this.device = device;
      this.state.deviceName = device.name || 'Printer Bluetooth';
      sessionStorage.setItem('ejurnal_bt_printer_name', this.state.deviceName);

      device.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null;
        this.state.isConnected = false;
        this.state.isConnecting = false;
        this.notify();
      });

      const server = await device.gatt.connect();

      // Find writable characteristic
      let writeChar: any = null;

      // Try discovering known services first
      for (const serviceUuid of KNOWN_PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writeChar = char;
              break;
            }
          }
          if (writeChar) break;
        } catch {
          // Service not supported on this device, continue checking
        }
      }

      // If still not found, try getting all primary services
      if (!writeChar) {
        try {
          const services = await server.getPrimaryServices();
          for (const service of services) {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                writeChar = char;
                break;
              }
            }
            if (writeChar) break;
          }
        } catch (err) {
          console.warn('Fallback scan error', err);
        }
      }

      if (!writeChar) {
        throw new Error('Karakteristik cetak ESC/POS tidak ditemukan pada printer ini.');
      }

      this.characteristic = writeChar;
      this.state.isConnected = true;
      this.state.isConnecting = false;
      this.state.error = null;
      this.notify();
      return true;
    } catch (err: any) {
      this.state.isConnecting = false;
      this.state.isConnected = false;

      const isPolicyError =
        err?.name === 'SecurityError' ||
        err?.message?.includes('permissions policy') ||
        err?.message?.includes('disallowed');

      const isCancelled =
        err?.name === 'NotFoundError' ||
        err?.message?.includes('User cancelled') ||
        err?.message?.includes('chooser');

      if (isPolicyError) {
        console.warn('Bluetooth access is restricted in the preview iframe by permissions policy.');
        this.state.error = 'Akses Bluetooth dibatasi di jendela pratinjau (iframe). Buka aplikasi di Tab Baru browser Google Chrome untuk menyambungkan printer thermal.';
      } else if (isCancelled) {
        console.info('Pemilihan printer bluetooth dibatalkan oleh pengguna.');
        this.state.error = 'Pemilihan printer dibatalkan.';
      } else {
        console.warn('Bluetooth connection notice:', err?.message || err);
        this.state.error = err?.message || 'Gagal menyambungkan ke printer Bluetooth.';
      }

      this.notify();
      return false;
    }
  }

  public async disconnect() {
    try {
      if (this.device && this.device.gatt && this.device.gatt.connected) {
        this.device.gatt.disconnect();
      }
    } catch (e) {
      console.warn('Error during disconnect', e);
    }
    this.characteristic = null;
    this.state.isConnected = false;
    this.state.isConnecting = false;
    this.notify();
  }

  // Send raw bytes in chunks to prevent BLE thermal buffer overflow
  public async sendRaw(bytes: Uint8Array, chunkSize = 60, delayMs = 25): Promise<void> {
    if (!this.characteristic) {
      const connected = await this.connect();
      if (!connected || !this.characteristic) {
        throw new Error('Printer bluetooth belum terhubung.');
      }
    }

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.slice(offset, offset + chunkSize);
      if (this.characteristic.writeValueWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      if (delayMs > 0 && offset + chunkSize < bytes.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  public async printReceipt(
    data: ReceiptData, 
    paperWidth: PaperWidth = 32, 
    density: PrintDensity = 'extra'
  ): Promise<void> {
    const escposBytes = buildEscPosReceipt(data, paperWidth, density);
    await this.sendRaw(escposBytes);
  }
}

export const bluetoothPrinter = new BluetoothPrinterService();

// ESC/POS COMMAND BUILDER
export function formatTwoColumns(left: string, right: string, width: PaperWidth = 32): string {
  const totalLen = left.length + right.length;
  if (totalLen < width) {
    const spaceCount = width - totalLen;
    return left + ' '.repeat(spaceCount) + right;
  }
  // If left string is too long, truncate or wrap
  const maxLeft = Math.max(1, width - right.length - 1);
  return left.substring(0, maxLeft) + ' ' + right;
}

export function formatCenter(text: string, width: PaperWidth = 32): string {
  if (text.length >= width) return text.substring(0, width);
  const totalPadding = width - text.length;
  const leftPad = Math.floor(totalPadding / 2);
  const rightPad = totalPadding - leftPad;
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
}

export function formatDivider(char = '-', width: PaperWidth = 32): string {
  return char.repeat(width);
}

/**
 * Sanitize text to pure standard ASCII (32-126 plus newline).
 * Eliminates emojis, smart quotes, em-dashes, and high UTF-8 bytes
 * which cause Chinese thermal printers to print Chinese characters (GBK mode).
 */
export function cleanAsciiForThermal(text: string): string {
  if (!text) return '';
  return text
    // Replace smart quotes and typographic punctuation
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u2022]/g, '*')
    .replace(/\u00A0/g, ' ')
    // Strip surrogate pairs (emojis such as 🙏, 🛍️, etc.)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    // Strip remaining miscellaneous symbols & pictographs
    .replace(/[\u2600-\u27BF\uE000-\uF8FF]/g, '')
    // Keep only printable ASCII (0x20 to 0x7E) and newline (0x0A)
    .replace(/[^\x20-\x7E\n]/g, '');
}

// Generate ESC/POS byte sequence
export function buildEscPosReceipt(
  data: ReceiptData, 
  width: PaperWidth = 32, 
  density: PrintDensity = 'extra'
): Uint8Array {
  const commands: number[] = [];

  function appendBytes(bytes: number[]) {
    commands.push(...bytes);
  }

  function appendText(text: string) {
    const clean = cleanAsciiForThermal(text);
    for (let i = 0; i < clean.length; i++) {
      commands.push(clean.charCodeAt(i));
    }
  }

  function appendLine(text = '') {
    appendText(text + '\n');
  }

  // 1. ESC @: Initialize printer
  appendBytes([0x1B, 0x40]);

  // 2. FS .: CANCEL CHINESE / KANJI MODE (Crucial: prevents printer from grouping bytes into Chinese GBK characters)
  appendBytes([0x1C, 0x2E]);

  // 3. ESC t 0: Select character code table PC437 (USA / Standard Europe)
  appendBytes([0x1B, 0x74, 0x00]);

  // 4. ESC R 0: International character set: USA
  appendBytes([0x1B, 0x52, 0x00]);

  // 5. Thermal Print Density & Heating Control (ESC 7 & DC2 #)
  if (density === 'extra') {
    // ESC 7 n1 n2 n3: max heating dots=8, heating time=180 (0xB4: higher heating time produces darker, thicker print), interval=3
    appendBytes([0x1B, 0x37, 0x08, 0xB4, 0x03]);
    // DC2 # n: Set high density for POS-58 / Panda / MPT-II / XP-58 (0x24 = 36)
    appendBytes([0x12, 0x23, 0x24]);
    // GS ( K: Set print density (0x1D, 0x28, 0x4B, 0x02, 0x00, 0x31, 0x06)
    appendBytes([0x1D, 0x28, 0x4B, 0x02, 0x00, 0x31, 0x06]);
  } else if (density === 'bold') {
    // ESC 7: heating time=140 (0x8C)
    appendBytes([0x1B, 0x37, 0x08, 0x8C, 0x02]);
    appendBytes([0x12, 0x23, 0x1E]);
    appendBytes([0x1D, 0x28, 0x4B, 0x02, 0x00, 0x31, 0x04]);
  } else {
    // Normal: heating time=80 (0x50)
    appendBytes([0x1B, 0x37, 0x07, 0x50, 0x02]);
  }

  // Base darkness setting helper
  function applyBaseDensity() {
    if (density === 'extra') {
      appendBytes([0x1B, 0x45, 0x01]); // Emphasized (bold) ON
      appendBytes([0x1B, 0x47, 0x01]); // Double-strike ON
    } else if (density === 'bold') {
      appendBytes([0x1B, 0x45, 0x01]); // Emphasized (bold) ON
      appendBytes([0x1B, 0x47, 0x00]); // Double-strike OFF
    } else {
      appendBytes([0x1B, 0x45, 0x00]); // Emphasized OFF
      appendBytes([0x1B, 0x47, 0x00]); // Double-strike OFF
    }
  }

  function setEmphasis(on: boolean) {
    if (on) {
      appendBytes([0x1B, 0x45, 0x01]); // Bold ON
      appendBytes([0x1B, 0x47, 0x01]); // Double-strike ON
    } else {
      applyBaseDensity();
    }
  }

  // Apply default base density
  applyBaseDensity();

  // Header: TOKO ALMA
  // ESC a 1: Align Center
  appendBytes([0x1B, 0x61, 0x01]);
  // GS ! 0x11: Double Width & Double Height
  appendBytes([0x1D, 0x21, 0x11]);
  setEmphasis(true);
  appendLine('TOKO ALMA');
  // GS ! 0x00: Normal font size
  appendBytes([0x1D, 0x21, 0x00]);
  applyBaseDensity();

  appendLine('E-Jurnal & Kas Keuangan');
  appendLine(formatDivider('=', width));

  // ESC a 0: Align Left
  appendBytes([0x1B, 0x61, 0x00]);

  if (data.type === 'test') {
    appendBytes([0x1B, 0x61, 0x01]);
    setEmphasis(true);
    appendLine('** TEST PRINT BLUETOOTH **');
    setEmphasis(false);
    appendLine('Koneksi Printer Berhasil!');
    appendLine(`Lebar Kertas: ${width === 32 ? '58mm (32 Kolom)' : '80mm (48 Kolom)'}`);
    appendLine(`Ketebalan: ${density === 'extra' ? 'Sangat Tebal & Pekat (Bold+)' : density === 'bold' ? 'Tebal (Bold)' : 'Standar'}`);
    appendLine(`Waktu: ${new Date().toLocaleTimeString('id-ID')}`);
    appendBytes([0x1B, 0x61, 0x00]);
    appendLine(formatDivider('-', width));
    appendLine(formatTwoColumns('Status Printer', 'OK / Siap', width));
    appendLine(formatTwoColumns('Tipe Koneksi', 'Bluetooth BLE', width));
    appendLine(formatDivider('=', width));
    appendBytes([0x1B, 0x61, 0x01]);
    appendLine('Terima Kasih');
    appendLine('Toko Alma');
  } else if (data.type === 'piutang') {
    appendBytes([0x1B, 0x61, 0x01]);
    setEmphasis(true);
    appendLine('NOTA TAGIHAN PIUTANG');
    setEmphasis(false);
    appendLine(data.dateStr || formatTanggalIndo(new Date().toISOString().split('T')[0]));
    appendBytes([0x1B, 0x61, 0x00]);
    appendLine(formatDivider('-', width));

    appendLine(`Nama   : ${data.name || '-'}`);
    if (data.phone) {
      appendLine(`No. HP : ${data.phone}`);
    }
    appendLine(formatDivider('-', width));

    // Items list
    appendLine('RINCIAN BON BELANJA:');
    if (data.items && data.items.length > 0) {
      data.items.forEach((it, idx) => {
        const itemHeader = `${idx + 1}. ${it.keterangan}`;
        appendLine(itemHeader);
        const subLine = formatTwoColumns(`   ${it.tanggal}`, formatRupiah(it.nominal), width);
        appendLine(subLine);
      });
    } else {
      appendLine('Tidak ada rincian');
    }

    appendLine(formatDivider('-', width));
    appendLine(formatTwoColumns('TOTAL TAGIHAN AWAL', formatRupiah(data.total || 0), width));

    // Payments list if any
    if (data.payments && data.payments.length > 0) {
      appendLine(formatDivider('.', width));
      appendLine('RIWAYAT PEMBAYARAN:');
      data.payments.forEach((p, idx) => {
        const pDesc = ` ${idx + 1}. ${p.tanggal} (${p.keterangan || 'Bayar'})`;
        appendLine(pDesc);
        appendLine(formatTwoColumns('    Masuk:', `- ${formatRupiah(p.nominal)}`, width));
      });
      const totBayar = data.totalBayar !== undefined 
        ? data.totalBayar 
        : data.payments.reduce((s, p) => s + p.nominal, 0);
      appendLine(formatTwoColumns('TOTAL SUDAH BAYAR', formatRupiah(totBayar), width));
    }

    appendLine(formatDivider('=', width));
    // Sisa Tagihan in Bold
    setEmphasis(true);
    appendLine(formatTwoColumns('SISA TAGIHAN AKTIF', formatRupiah(data.sisa || 0), width));
    setEmphasis(false);
    appendLine(formatDivider('=', width));

    appendBytes([0x1B, 0x61, 0x01]);
    appendLine('Mohon simpan struk ini sebagai');
    appendLine('bukti pencatatan yang sah.');
    appendLine('Terima Kasih Atas Kerjasamanya');
  } else if (data.type === 'titipan') {
    appendBytes([0x1B, 0x61, 0x01]);
    setEmphasis(true);
    appendLine('BUKTI SALDO TITIPAN');
    setEmphasis(false);
    appendLine(data.dateStr || formatTanggalIndo(new Date().toISOString().split('T')[0]));
    appendBytes([0x1B, 0x61, 0x00]);
    appendLine(formatDivider('-', width));

    appendLine(`Penitip : ${data.name || '-'}`);
    if (data.phone) {
      appendLine(`No. HP  : ${data.phone}`);
    }
    appendLine(formatDivider('-', width));

    // Items list
    appendLine('RINCIAN TITIPAN MASUK:');
    if (data.items && data.items.length > 0) {
      data.items.forEach((it, idx) => {
        appendLine(`${idx + 1}. ${it.keterangan}`);
        appendLine(formatTwoColumns(`   ${it.tanggal}`, formatRupiah(it.nominal), width));
      });
    }

    appendLine(formatDivider('-', width));
    appendLine(formatTwoColumns('TOTAL TITIPAN AWAL', formatRupiah(data.total || 0), width));

    if (data.payments && data.payments.length > 0) {
      appendLine(formatDivider('.', width));
      appendLine('PENYERAHAN / PENGAMBILAN:');
      data.payments.forEach((p, idx) => {
        appendLine(` ${idx + 1}. ${p.tanggal} (${p.keterangan || 'Diambil'})`);
        appendLine(formatTwoColumns('    Keluar:', `- ${formatRupiah(p.nominal)}`, width));
      });
      const totBayar = data.totalBayar !== undefined 
        ? data.totalBayar 
        : data.payments.reduce((s, p) => s + p.nominal, 0);
      appendLine(formatTwoColumns('TOTAL SUDAH DIAMBIL', formatRupiah(totBayar), width));
    }

    appendLine(formatDivider('=', width));
    setEmphasis(true);
    appendLine(formatTwoColumns('SISA SALDO TITIPAN', formatRupiah(data.sisa || 0), width));
    setEmphasis(false);
    appendLine(formatDivider('=', width));

    appendBytes([0x1B, 0x61, 0x01]);
    appendLine('Dana/barang tersimpan aman.');
    appendLine('Terima Kasih Atas Kepercayaannya');
  } else if (data.type === 'kas_harian') {
    appendBytes([0x1B, 0x61, 0x01]);
    setEmphasis(true);
    appendLine('REKAP PENUTUPAN KAS HARIAN');
    setEmphasis(false);
    appendLine(data.dateStr || formatTanggalIndo(new Date().toISOString().split('T')[0]));
    appendBytes([0x1B, 0x61, 0x00]);
    appendLine(formatDivider('-', width));

    if (data.kasBreakdown) {
      appendLine('RINCIAN POSISI KAS:');
      Object.entries(data.kasBreakdown).forEach(([k, v]) => {
        appendLine(formatTwoColumns(k.toUpperCase(), formatRupiah(v), width));
      });
      appendLine(formatDivider('-', width));
    }

    appendLine(formatTwoColumns('TOTAL KAS BERJALAN', formatRupiah(data.totalKas || 0), width));
    if (data.labaHarian !== undefined) {
      appendLine(formatTwoColumns('LABA HARIAN', (data.labaHarian >= 0 ? '+' : '') + formatRupiah(data.labaHarian), width));
    }
    if (data.labaBulanan !== undefined) {
      appendLine(formatTwoColumns('LABA BULANAN', (data.labaBulanan >= 0 ? '+' : '') + formatRupiah(data.labaBulanan), width));
    }

    appendLine(formatDivider('=', width));
    appendBytes([0x1B, 0x61, 0x01]);
    appendLine('Arsip Tutup Kas Toko Alma');
    appendLine(`Dicetak: ${new Date().toLocaleTimeString('id-ID')}`);
  } else if (data.type === 'pelunasan') {
    appendBytes([0x1B, 0x61, 0x01]);
    setEmphasis(true);
    appendLine(data.statusLunas ? 'BUKTI PELUNASAN PIUTANG' : 'BUKTI PEMBAYARAN BON');
    setEmphasis(false);
    appendLine(data.dateStr || formatTanggalIndo(new Date().toISOString().split('T')[0]));
    appendBytes([0x1B, 0x61, 0x00]);
    appendLine(formatDivider('-', width));

    appendLine(`Pelanggan : ${data.name || '-'}`);
    if (data.phone) {
      appendLine(`No. HP    : ${data.phone}`);
    }
    appendLine(formatDivider('-', width));

    // Rincian Bon Transaksi yang dilunasi
    if (data.items && data.items.length > 0) {
      appendLine('RINCIAN BON TRANSAKSI:');
      data.items.forEach((it, idx) => {
        const itemHeader = `${idx + 1}. ${it.keterangan}`;
        appendLine(itemHeader);
        const subLine = formatTwoColumns(`   ${it.tanggal}`, formatRupiah(it.nominal), width);
        appendLine(subLine);
      });
      appendLine(formatDivider('-', width));
      if (data.total !== undefined && data.total > 0) {
        appendLine(formatTwoColumns('TOTAL BON BELANJA', formatRupiah(data.total), width));
        appendLine(formatDivider('-', width));
      }
    }

    if (data.payments && data.payments.length > 0) {
      appendLine('PEMBAYARAN SEBELUMNYA:');
      data.payments.forEach((p, idx) => {
        appendLine(` ${idx + 1}. ${p.tanggal} (${p.keterangan || 'Bayar'})`);
        appendLine(formatTwoColumns('    Masuk:', `- ${formatRupiah(p.nominal)}`, width));
      });
      appendLine(formatDivider('-', width));
    }

    if (data.sisaSebelum !== undefined) {
      appendLine(formatTwoColumns('TAGIHAN SEBELUMNYA', formatRupiah(data.sisaSebelum), width));
    }
    setEmphasis(true);
    appendLine(formatTwoColumns('JUMLAH DIBAYARKAN', formatRupiah(data.nominalBayar || 0), width));
    setEmphasis(false);

    if (data.keterangan) {
      appendLine(`Ket: ${data.keterangan}`);
    }

    if (data.uangDiterima !== undefined && data.uangDiterima > 0) {
      appendLine(formatDivider('.', width));
      appendLine(formatTwoColumns('UANG DITERIMA', formatRupiah(data.uangDiterima), width));
      if (data.kembalian !== undefined && data.kembalian > 0) {
        setEmphasis(true);
        appendLine(formatTwoColumns('KEMBALIAN', formatRupiah(data.kembalian), width));
        setEmphasis(false);
      } else if (data.kembalian === 0) {
        appendLine(formatTwoColumns('KEMBALIAN', 'Rp 0 (UANG PAS)', width));
      }
    }

    appendLine(formatDivider('=', width));
    if (data.statusLunas) {
      appendBytes([0x1B, 0x61, 0x01]);
      setEmphasis(true);
      appendLine('*** STATUS: LUNAS ***');
      setEmphasis(false);
      appendLine('Semua kewajiban telah selesai');
      appendBytes([0x1B, 0x61, 0x00]);
    } else {
      setEmphasis(true);
      appendLine(formatTwoColumns('SISA TAGIHAN BARU', formatRupiah(data.sisa || 0), width));
      setEmphasis(false);
    }
    appendLine(formatDivider('=', width));

    appendBytes([0x1B, 0x61, 0x01]);
    appendLine('Terima Kasih Atas Pembayarannya');
    appendLine('Toko Alma');
  } else if (data.type === 'cash') {
    const isLunas = data.statusLunas !== false;
    appendBytes([0x1B, 0x61, 0x01]);
    setEmphasis(true);
    appendLine(isLunas ? 'NOTA PEMBAYARAN TUNAI' : 'NOTA BELANJA (BELUM LUNAS)');
    setEmphasis(false);
    if (data.noNota) {
      appendLine(`No: ${data.noNota}`);
    }
    appendLine(data.dateStr || formatTanggalIndo(new Date().toISOString().split('T')[0]));
    appendBytes([0x1B, 0x61, 0x00]);
    appendLine(formatDivider('-', width));

    appendLine(`Pelanggan : ${data.name || 'Pelanggan Umum'}`);
    if (data.phone) {
      appendLine(`No. HP    : ${data.phone}`);
    }
    appendLine(formatDivider('-', width));

    // Items list
    appendLine('RINCIAN BELANJA:');
    if (data.cashItems && data.cashItems.length > 0) {
      data.cashItems.forEach((it, idx) => {
        const itemHeader = `${idx + 1}. ${it.namaBarang}`;
        appendLine(itemHeader);
        const subLine = formatTwoColumns(`   ${it.jumlah}x @${formatRupiah(it.hargaSatuan)}`, formatRupiah(it.subtotal), width);
        appendLine(subLine);
      });
    } else if (data.items && data.items.length > 0) {
      data.items.forEach((it, idx) => {
        const itemHeader = `${idx + 1}. ${it.keterangan}`;
        appendLine(itemHeader);
        const subLine = formatTwoColumns(`   ${it.tanggal}`, formatRupiah(it.nominal), width);
        appendLine(subLine);
      });
    } else {
      appendLine('1x Transaksi Belanja');
    }

    appendLine(formatDivider('-', width));
    setEmphasis(true);
    appendLine(formatTwoColumns('TOTAL BELANJA', formatRupiah(data.total || 0), width));
    setEmphasis(false);

    if (isLunas) {
      if (data.uangDiterima !== undefined && data.uangDiterima > 0) {
        appendLine(formatDivider('.', width));
        appendLine(formatTwoColumns('TUNAI DITERIMA', formatRupiah(data.uangDiterima), width));
        if (data.kembalian !== undefined && data.kembalian > 0) {
          setEmphasis(true);
          appendLine(formatTwoColumns('KEMBALIAN', formatRupiah(data.kembalian), width));
          setEmphasis(false);
        } else if (data.kembalian === 0) {
          appendLine(formatTwoColumns('KEMBALIAN', 'Rp 0 (UANG PAS)', width));
        }
      }
    } else {
      const uangMasuk = data.uangDiterima || 0;
      const sisaTagihan = Math.max(0, (data.total || 0) - uangMasuk);
      if (uangMasuk > 0) {
        appendLine(formatDivider('.', width));
        appendLine(formatTwoColumns('UANG MUKA / DP', formatRupiah(uangMasuk), width));
      }
      appendLine(formatDivider('=', width));
      setEmphasis(true);
      appendLine(formatTwoColumns('SISA TAGIHAN', formatRupiah(sisaTagihan), width));
      setEmphasis(false);
    }

    if (data.keterangan) {
      appendLine(formatDivider('.', width));
      appendLine(`Ket: ${data.keterangan}`);
    }

    appendLine(formatDivider('=', width));
    appendBytes([0x1B, 0x61, 0x01]);
    setEmphasis(true);
    if (isLunas) {
      appendLine('*** LUNAS (CASH) ***');
      setEmphasis(false);
      appendLine('Barang yang dibeli tidak dapat ditukar/');
      appendLine('dikembalikan tanpa perjanjian.');
      appendLine('Terima Kasih Atas Kunjungan Anda');
    } else {
      appendLine('*** STATUS: BELUM DIBAYAR ***');
      setEmphasis(false);
      appendLine('Nota ini dapat dilunasi kapan saja.');
      appendLine('Terima Kasih Atas Kepercayaannya');
    }
    appendLine('Toko Alma');
  }

  // Reset formatting before feed & cut
  appendBytes([0x1B, 0x45, 0x00]);
  appendBytes([0x1B, 0x47, 0x00]);
  appendBytes([0x1D, 0x21, 0x00]);

  // Feed 4 lines & cut
  appendBytes([0x1B, 0x64, 0x04]);
  // Cut command (GS V 66 0): partial cut if supported
  appendBytes([0x1D, 0x56, 0x42, 0x00]);

  return new Uint8Array(commands);
}

// Generate Plain Monospace Text for standard System Print / Preview / RawBT
export function generateReceiptPlainText(data: ReceiptData, width: PaperWidth = 32): string {
  const lines: string[] = [];

  lines.push(formatCenter('TOKO ALMA', width));
  lines.push(formatCenter('E-Jurnal & Kas Keuangan', width));
  lines.push(formatDivider('=', width));

  if (data.type === 'test') {
    lines.push(formatCenter('** TEST PRINT BLUETOOTH **', width));
    lines.push(formatCenter('Koneksi Printer Berhasil!', width));
    lines.push(formatCenter(`Lebar Kertas: ${width === 32 ? '58mm' : '80mm'}`, width));
    lines.push(formatCenter(`Waktu: ${new Date().toLocaleTimeString('id-ID')}`, width));
    lines.push(formatDivider('-', width));
    lines.push(formatTwoColumns('Status Printer', 'OK / Siap', width));
    lines.push(formatTwoColumns('Tipe Koneksi', 'Bluetooth BLE', width));
    lines.push(formatDivider('=', width));
    lines.push(formatCenter('Terima Kasih', width));
    lines.push(formatCenter('Toko Alma', width));
  } else if (data.type === 'piutang') {
    lines.push(formatCenter('NOTA TAGIHAN PIUTANG', width));
    lines.push(formatCenter(data.dateStr || formatTanggalIndo(new Date().toISOString().split('T')[0]), width));
    lines.push(formatDivider('-', width));
    lines.push(`Nama   : ${data.name || '-'}`);
    if (data.phone) lines.push(`No. HP : ${data.phone}`);
    lines.push(formatDivider('-', width));
    lines.push('RINCIAN BON BELANJA:');
    if (data.items && data.items.length > 0) {
      data.items.forEach((it, idx) => {
        lines.push(`${idx + 1}. ${it.keterangan}`);
        lines.push(formatTwoColumns(`   ${it.tanggal}`, formatRupiah(it.nominal), width));
      });
    }
    lines.push(formatDivider('-', width));
    lines.push(formatTwoColumns('TOTAL TAGIHAN AWAL', formatRupiah(data.total || 0), width));
    if (data.payments && data.payments.length > 0) {
      lines.push(formatDivider('.', width));
      lines.push('RIWAYAT PEMBAYARAN:');
      data.payments.forEach((p, idx) => {
        lines.push(` ${idx + 1}. ${p.tanggal} (${p.keterangan || 'Bayar'})`);
        lines.push(formatTwoColumns('    Masuk:', `- ${formatRupiah(p.nominal)}`, width));
      });
      const totBayar = data.totalBayar !== undefined 
        ? data.totalBayar 
        : data.payments.reduce((s, p) => s + p.nominal, 0);
      lines.push(formatTwoColumns('TOTAL SUDAH BAYAR', formatRupiah(totBayar), width));
    }
    lines.push(formatDivider('=', width));
    lines.push(formatTwoColumns('SISA TAGIHAN AKTIF', formatRupiah(data.sisa || 0), width));
    lines.push(formatDivider('=', width));
    lines.push(formatCenter('Mohon simpan struk ini sebagai', width));
    lines.push(formatCenter('bukti pencatatan yang sah.', width));
    lines.push(formatCenter('Terima Kasih Atas Kerjasamanya', width));
  } else if (data.type === 'titipan') {
    lines.push(formatCenter('BUKTI SALDO TITIPAN', width));
    lines.push(formatCenter(data.dateStr || formatTanggalIndo(new Date().toISOString().split('T')[0]), width));
    lines.push(formatDivider('-', width));
    lines.push(`Penitip : ${data.name || '-'}`);
    if (data.phone) lines.push(`No. HP  : ${data.phone}`);
    lines.push(formatDivider('-', width));
    lines.push('RINCIAN TITIPAN MASUK:');
    if (data.items && data.items.length > 0) {
      data.items.forEach((it, idx) => {
        lines.push(`${idx + 1}. ${it.keterangan}`);
        lines.push(formatTwoColumns(`   ${it.tanggal}`, formatRupiah(it.nominal), width));
      });
    }
    lines.push(formatDivider('-', width));
    lines.push(formatTwoColumns('TOTAL TITIPAN AWAL', formatRupiah(data.total || 0), width));
    if (data.payments && data.payments.length > 0) {
      lines.push(formatDivider('.', width));
      lines.push('PENYERAHAN / PENGAMBILAN:');
      data.payments.forEach((p, idx) => {
        lines.push(` ${idx + 1}. ${p.tanggal} (${p.keterangan || 'Diambil'})`);
        lines.push(formatTwoColumns('    Keluar:', `- ${formatRupiah(p.nominal)}`, width));
      });
      const totBayar = data.totalBayar !== undefined 
        ? data.totalBayar 
        : data.payments.reduce((s, p) => s + p.nominal, 0);
      lines.push(formatTwoColumns('TOTAL SUDAH DIAMBIL', formatRupiah(totBayar), width));
    }
    lines.push(formatDivider('=', width));
    lines.push(formatTwoColumns('SISA SALDO TITIPAN', formatRupiah(data.sisa || 0), width));
    lines.push(formatDivider('=', width));
    lines.push(formatCenter('Dana/barang tersimpan aman.', width));
    lines.push(formatCenter('Terima Kasih Atas Kepercayaannya', width));
  } else if (data.type === 'kas_harian') {
    lines.push(formatCenter('REKAP PENUTUPAN KAS', width));
    lines.push(formatCenter(data.dateStr || formatTanggalIndo(new Date().toISOString().split('T')[0]), width));
    lines.push(formatDivider('-', width));
    if (data.kasBreakdown) {
      lines.push('RINCIAN POSISI KAS:');
      Object.entries(data.kasBreakdown).forEach(([k, v]) => {
        lines.push(formatTwoColumns(k.toUpperCase(), formatRupiah(v), width));
      });
      lines.push(formatDivider('-', width));
    }
    lines.push(formatTwoColumns('TOTAL KAS BERJALAN', formatRupiah(data.totalKas || 0), width));
    if (data.labaHarian !== undefined) {
      lines.push(formatTwoColumns('LABA HARIAN', (data.labaHarian >= 0 ? '+' : '') + formatRupiah(data.labaHarian), width));
    }
    if (data.labaBulanan !== undefined) {
      lines.push(formatTwoColumns('LABA BULANAN', (data.labaBulanan >= 0 ? '+' : '') + formatRupiah(data.labaBulanan), width));
    }
    lines.push(formatDivider('=', width));
    lines.push(formatCenter('Arsip Tutup Kas Toko Alma', width));
    lines.push(formatCenter(`Dicetak: ${new Date().toLocaleTimeString('id-ID')}`, width));
  } else if (data.type === 'pelunasan') {
    lines.push(formatCenter(data.statusLunas ? 'BUKTI PELUNASAN PIUTANG' : 'BUKTI PEMBAYARAN BON', width));
    lines.push(formatCenter(data.dateStr || formatTanggalIndo(new Date().toISOString().split('T')[0]), width));
    lines.push(formatDivider('-', width));
    lines.push(`Pelanggan : ${data.name || '-'}`);
    if (data.phone) {
      lines.push(`No. HP    : ${data.phone}`);
    }
    lines.push(formatDivider('-', width));

    // Rincian Bon Transaksi yang dilunasi
    if (data.items && data.items.length > 0) {
      lines.push('RINCIAN BON TRANSAKSI:');
      data.items.forEach((it, idx) => {
        lines.push(`${idx + 1}. ${it.keterangan}`);
        lines.push(formatTwoColumns(`   ${it.tanggal}`, formatRupiah(it.nominal), width));
      });
      lines.push(formatDivider('-', width));
      if (data.total !== undefined && data.total > 0) {
        lines.push(formatTwoColumns('TOTAL BON BELANJA', formatRupiah(data.total), width));
        lines.push(formatDivider('-', width));
      }
    }

    if (data.payments && data.payments.length > 0) {
      lines.push('PEMBAYARAN SEBELUMNYA:');
      data.payments.forEach((p, idx) => {
        lines.push(` ${idx + 1}. ${p.tanggal} (${p.keterangan || 'Bayar'})`);
        lines.push(formatTwoColumns('    Masuk:', `- ${formatRupiah(p.nominal)}`, width));
      });
      lines.push(formatDivider('-', width));
    }

    if (data.sisaSebelum !== undefined) {
      lines.push(formatTwoColumns('TAGIHAN SEBELUMNYA', formatRupiah(data.sisaSebelum), width));
    }
    lines.push(formatTwoColumns('JUMLAH DIBAYARKAN', formatRupiah(data.nominalBayar || 0), width));
    if (data.keterangan) {
      lines.push(`Ket: ${data.keterangan}`);
    }
    if (data.uangDiterima !== undefined && data.uangDiterima > 0) {
      lines.push(formatDivider('.', width));
      lines.push(formatTwoColumns('UANG DITERIMA', formatRupiah(data.uangDiterima), width));
      if (data.kembalian !== undefined && data.kembalian > 0) {
        lines.push(formatTwoColumns('KEMBALIAN', formatRupiah(data.kembalian), width));
      } else if (data.kembalian === 0) {
        lines.push(formatTwoColumns('KEMBALIAN', 'Rp 0 (UANG PAS)', width));
      }
    }
    lines.push(formatDivider('=', width));
    if (data.statusLunas) {
      lines.push(formatCenter('*** STATUS: LUNAS ***', width));
      lines.push(formatCenter('Semua kewajiban telah selesai', width));
    } else {
      lines.push(formatTwoColumns('SISA TAGIHAN BARU', formatRupiah(data.sisa || 0), width));
    }
    lines.push(formatDivider('=', width));
    lines.push(formatCenter('Terima Kasih Atas Pembayarannya', width));
    lines.push(formatCenter('Toko Alma', width));
  } else if (data.type === 'cash') {
    const isLunas = data.statusLunas !== false;
    lines.push(formatCenter(isLunas ? 'NOTA PEMBAYARAN TUNAI' : 'NOTA BELANJA (BELUM LUNAS)', width));
    if (data.noNota) lines.push(formatCenter(`No: ${data.noNota}`, width));
    lines.push(formatCenter(data.dateStr || formatTanggalIndo(new Date().toISOString().split('T')[0]), width));
    lines.push(formatDivider('-', width));
    lines.push(`Pelanggan : ${data.name || 'Pelanggan Umum'}`);
    if (data.phone) lines.push(`No. HP    : ${data.phone}`);
    lines.push(formatDivider('-', width));
    lines.push('RINCIAN BELANJA:');
    if (data.cashItems && data.cashItems.length > 0) {
      data.cashItems.forEach((it, idx) => {
        lines.push(`${idx + 1}. ${it.namaBarang}`);
        lines.push(formatTwoColumns(`   ${it.jumlah}x @${formatRupiah(it.hargaSatuan)}`, formatRupiah(it.subtotal), width));
      });
    } else if (data.items && data.items.length > 0) {
      data.items.forEach((it, idx) => {
        lines.push(`${idx + 1}. ${it.keterangan}`);
        lines.push(formatTwoColumns(`   ${it.tanggal}`, formatRupiah(it.nominal), width));
      });
    } else {
      lines.push('1x Transaksi Belanja');
    }
    lines.push(formatDivider('-', width));
    lines.push(formatTwoColumns('TOTAL BELANJA', formatRupiah(data.total || 0), width));
    if (isLunas) {
      if (data.uangDiterima !== undefined && data.uangDiterima > 0) {
        lines.push(formatDivider('.', width));
        lines.push(formatTwoColumns('TUNAI DITERIMA', formatRupiah(data.uangDiterima), width));
        if (data.kembalian !== undefined && data.kembalian > 0) {
          lines.push(formatTwoColumns('KEMBALIAN', formatRupiah(data.kembalian), width));
        } else if (data.kembalian === 0) {
          lines.push(formatTwoColumns('KEMBALIAN', 'Rp 0 (UANG PAS)', width));
        }
      }
    } else {
      const uangMasuk = data.uangDiterima || 0;
      const sisaTagihan = Math.max(0, (data.total || 0) - uangMasuk);
      if (uangMasuk > 0) {
        lines.push(formatDivider('.', width));
        lines.push(formatTwoColumns('UANG MUKA / DP', formatRupiah(uangMasuk), width));
      }
      lines.push(formatDivider('=', width));
      lines.push(formatTwoColumns('SISA TAGIHAN', formatRupiah(sisaTagihan), width));
    }
    if (data.keterangan) {
      lines.push(formatDivider('.', width));
      lines.push(`Ket: ${data.keterangan}`);
    }
    lines.push(formatDivider('=', width));
    if (isLunas) {
      lines.push(formatCenter('*** LUNAS (CASH) ***', width));
      lines.push(formatCenter('Barang dibeli tidak dapat ditukar', width));
      lines.push(formatCenter('Terima Kasih Atas Kunjungan Anda', width));
    } else {
      lines.push(formatCenter('*** STATUS: BELUM DIBAYAR ***', width));
      lines.push(formatCenter('Dapat dilunasi kapan saja', width));
      lines.push(formatCenter('Terima Kasih Atas Kepercayaannya', width));
    }
    lines.push(formatCenter('Toko Alma', width));
  }

  return lines.join('\n');
}

// Generate HTML string for thermal receipt printing
export function generateReceiptHtml(
  data: ReceiptData, 
  width: PaperWidth = 32, 
  density: PrintDensity = 'extra'
): string {
  const plainText = generateReceiptPlainText(data, width);
  const mmWidth = width === 32 ? '58mm' : '80mm';
  const fontSize = width === 32 ? '11.5px' : '13px';
  const title = data.noNota ? `Nota-${data.noNota}` : `Nota-${data.name || 'Toko-Alma'}`;

  const isExtra = density === 'extra';
  const isBold = density === 'bold' || density === 'extra';
  const fontWeight = isExtra ? '900' : isBold ? '700' : '500';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      @page {
        size: ${mmWidth} auto;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #000000 !important;
        font-family: 'Courier New', Courier, Consolas, Monaco, monospace;
        font-size: ${fontSize};
        font-weight: ${fontWeight};
        line-height: 1.32;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        width: ${mmWidth};
        max-width: 100%;
        margin: 0 auto;
        padding: 6px 4px;
        font-weight: ${fontWeight};
      }
      pre {
        white-space: pre-wrap;
        word-break: break-all;
        margin: 0;
        padding: 0;
        font-family: 'Courier New', Courier, Consolas, Monaco, monospace;
        font-size: inherit;
        line-height: inherit;
        color: #000000 !important;
        font-weight: ${fontWeight} !important;
        ${isBold ? `
        text-shadow: ${isExtra ? '0 0 0.5px #000000, 0 0 0.5px #000000' : '0 0 0.3px #000000'};
        -webkit-text-stroke: ${isExtra ? '0.4px #000000' : '0.2px #000000'};
        ` : ''}
      }
      @media print {
        html, body {
          width: 100% !important;
          margin: 0 !important;
          padding: 2px 2px !important;
          color: #000000 !important;
          font-weight: ${fontWeight} !important;
        }
        pre {
          color: #000000 !important;
          font-weight: ${fontWeight} !important;
          ${isBold ? `
          text-shadow: ${isExtra ? '0 0 0.5px #000000, 0 0 0.5px #000000' : '0 0 0.3px #000000'} !important;
          -webkit-text-stroke: ${isExtra ? '0.45px #000000' : '0.25px #000000'} !important;
          ` : ''}
        }
      }
    </style>
  </head>
  <body>
    <pre>${plainText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </body>
</html>`;
}

// Fallback Browser Print using hidden iframe (safe against popup blockers & iframe restrictions)
export function printReceiptViaBrowser(
  data: ReceiptData, 
  width: PaperWidth = 32, 
  density: PrintDensity = 'extra'
): boolean {
  const htmlContent = generateReceiptHtml(data, width, density);

  // Method 1: Hidden Iframe Printing (bypasses browser popup blockers)
  try {
    const iframeId = 'receipt-print-frame';
    let printIframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
    
    if (printIframe && printIframe.parentNode) {
      printIframe.parentNode.removeChild(printIframe);
    }

    printIframe = document.createElement('iframe');
    printIframe.id = iframeId;
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '1px';
    printIframe.style.height = '1px';
    printIframe.style.opacity = '0.01';
    printIframe.style.border = 'none';
    printIframe.style.pointerEvents = 'none';
    printIframe.style.zIndex = '-9999';
    document.body.appendChild(printIframe);

    const doc = printIframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          printIframe?.contentWindow?.focus();
          printIframe?.contentWindow?.print();
        } catch (iframeErr) {
          console.warn('Iframe print failed, falling back to window.open:', iframeErr);
          fallbackWindowPrint(htmlContent);
        }
      }, 250);

      return true;
    }
  } catch (err) {
    console.warn('Iframe creation error, falling back to window.open:', err);
  }

  // Method 2: Fallback window.open
  return fallbackWindowPrint(htmlContent);
}

function fallbackWindowPrint(htmlContent: string): boolean {
  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // In case window.open is blocked, try blob URL
      try {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        return true;
      } catch (e) {
        console.error('Blob URL print failed', e);
      }
      alert('Tidak dapat membuka dialog cetak. Silakan periksa izin pop-up browser atau buka aplikasi di tab baru.');
      return false;
    }

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (err) {
        console.warn('window.print error:', err);
      }
    }, 300);

    return true;
  } catch (e) {
    console.error('Print window error:', e);
    return false;
  }
}

// Open RawBT thermal printing intent for Android
export function openRawBtPrint(data: ReceiptData, width: PaperWidth = 32): void {
  const plainText = generateReceiptPlainText(data, width);
  try {
    const base64 = btoa(unescape(encodeURIComponent(plainText)));
    window.location.href = `intent:base64,${base64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
  } catch (e) {
    console.warn('RawBT intent error, opening plain text', e);
  }
}

