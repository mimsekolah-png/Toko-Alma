# Panduan Penerbitan Gratis (Firebase Hosting Spark Plan)
## Aplikasi E-Jurnal Toko Alma

Aplikasi ini telah dirancang dan dioptimalkan secara khusus agar dapat dipublikasikan dan digunakan **100% GRATIS** tanpa mengaktifkan Google Cloud Billing (tanpa kartu kredit).

---

### Mengapa Gratis & Bebas Google Cloud Billing?
1. **Arsitektur Static Client-Side SPA:**
   Aplikasi ini merupakan single-page application React murni yang berjalan langsung di browser pengguna (HP dan Laptop).
2. **Tidak Menggunakan Cloud Run atau Firebase App Hosting:**
   Firebase App Hosting dan Cloud Run memerlukan server container backend (yang membutuhkan billing). Sebaliknya, **Firebase Hosting Klasik** hanya menyajikan file statis (`dist/`) melalui CDN global Google yang **100% GRATIS** selamanya pada paket Spark.
3. **Database Firestore Tunggal:**
   Data toko disimpan di Firestore gratis (kuota: 50.000 read & 20.000 write per hari).
4. **Firebase Authentication:**
   Mendukung login Google, email/password, dan mode staf anonim gratis hingga 50.000 pengguna aktif per bulan.

---

### File Konfigurasi yang Sudah Disiapkan
* `firebase.json` : Mengatur folder publik ke `dist` dan URL rewrite untuk SPA.
* `.firebaserc` : Mengarahkan default project ke `amanah-toko-almaira`.
* `firestore.rules` : Aturan keamanan database Firestore untuk transaksi toko.
* `package.json` : Menambahkan script `"deploy:hosting": "vite build && firebase deploy --only hosting"`.

---

### Cara Menerbitkan ke Firebase Hosting Gratis (Hanya 3 Langkah)

Buka terminal di komputer/laptop Anda:

#### 1. Pasang Firebase CLI (jika belum ada)
```bash
npm install -g firebase-tools
```

#### 2. Login ke Akun Firebase / Google Anda
```bash
firebase login
```
*(Browser akan terbuka untuk memilih akun Google tempat project `amanah-toko-almaira` berada).*

#### 3. Build & Deploy ke Hosting Gratis
```bash
npm run build && firebase deploy --only hosting
```
atau
```bash
npm run deploy:hosting
```

---

### Alamat Website Gratis Anda
Setelah proses deploy selesai, website toko Anda akan langsung aktif di:
* **`https://amanah-toko-almaira.web.app`**
* **`https://amanah-toko-almaira.firebaseapp.com`**

---

### Cara Menggunakan di HP (Android & iPhone)
1. Buka browser di HP Anda (Google Chrome di Android, Safari di iPhone).
2. Kunjungi alamat website: `https://amanah-toko-almaira.web.app`.
3. Pasang sebagai Aplikasi Cepat (PWA):
   * **Android (Chrome):** Tekan titik tiga di pojok kanan atas &rarr; pilih **"Tambahkan ke Layar Utama" (Add to Home screen)**.
   * **iPhone (Safari):** Tekan tombol **Share** di bawah &rarr; pilih **"Add to Home Screen"**.
4. Ikon **E-Jurnal Toko Alma** akan muncul di menu HP Anda dan dapat dibuka kapan saja.

---

### Sinkronisasi Real-Time HP & Laptop
* Karena semua perangkat terhubung ke satu database Firestore `amanah-toko-almaira`:
  * Setiap kali Anda membuat nota, mencatat kas, mencicil piutang, atau mencatat titipan di HP, data **langsung muncul secara instan di laptop** tanpa perlu reload.
  * Begitu pula sebaliknya: perubahan di laptop langsung tersinkron ke HP kasir.
