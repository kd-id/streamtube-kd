# Instalasi & Deployment StreamTube Pro

Aplikasi StreamTube Pro membutuhkan **Node.js** dan **FFmpeg** agar fitur streaming dapat berjalan dengan baik.

## Prasyarat Utama
Pastikan aplikasi berikut sudah terinstal di komputer/server Anda:
1. **Node.js** (Minimal versi 18.x) - [Download di sini](https://nodejs.org/)
2. **FFmpeg** - Wajib ada di *System Path* agar perintah `ffmpeg` bisa dipanggil dari terminal. 
   - *Windows:* [Download FFmpeg](https://ffmpeg.org/download.html) lalu daftarkan ke System Environment Variables.
   - *Ubuntu/Debian:* `sudo apt update && sudo apt install ffmpeg`

---

## 1. Menjalankan di Localhost (Development)

Mode ini cocok untuk pengembangan atau jika Anda hanya ingin mencoba aplikasi secara lokal.

### Langkah-langkah:
1. Buka folder aplikasi di Terminal / Command Prompt.
2. Install semua dependensi Node.js:
   ```bash
   npm install
   ```
3. Jalankan development server:
   ```bash
   npm run dev
   ```
4. Aplikasi akan dapat diakses dari browser, biasanya di:
   **`http://localhost:5173`**
   *(Server Vite akan otomatis menangani backend streaming karena menggunakan `viteStreamPlugin.js`)*

---

## 2. Deploy di Server Production (VPS / Cloud)

Jika Anda ingin menjalankan aplikasi di server yang sebenarnya agar dapat diakses publik selama 24 jam nonstop, gunakan mode Production.

### Langkah-langkah:
1. Pindahkan seluruh source code ke server Anda (contoh: via Git atau SFTP).
2. Install dependensi:
   ```bash
   npm install
   ```
3. Lakukan Build aplikasi untuk meminifikasi kode:
   ```bash
   npm run build
   ```
   *(Perintah ini akan membuat siap saji HTML/CSS/JS statis ke dalam folder `dist`)*
4. Menjalankan di Production sangat disarankan menggunakan Process Manager seperti **PM2**. Ini berfungsi agar jika server restart, aplikasi akan otomatis menyala kembali.
   - Install PM2 secara global:
     ```bash
     npm install -g pm2
     ```
   - Jalankan script preview/server menggunakan PM2:
     ```bash
     pm2 start npm --name "streamtube" -- run preview -- --port 8080 --host
     ```
5. *(Opsional)* Agar PM2 berjalan otomatis saat server restart:
   ```bash
   pm2 startup
   pm2 save
   ```

### Reverse Proxy (Nginx)
Jika Anda mempunyai domain (misal: `stream.domain.com`), Anda bisa mem-forward port PM2 (8080) ke HTTP standar menggunakan Nginx:
```nginx
server {
    listen 80;
    server_name stream.domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
*Pastikan konfigurasi API dan FFmpeg tetap berfungsi normal ketika diletakkan di belakang Nginx/Proxy.*

---

## 3. Cara Update Aplikasi Tanpa Install Ulang (Zero Downtime)

Jika ada pembaruan kode pada aplikasi dan Anda ingin melakukan update di server Production, Anda tidak perlu menginstal ulang aplikasi dari awal atau menghapus PM2.

### Langkah-langkah Update:
1. Pastikan Anda berada di dalam folder instalasi StreamTube Pro.
2. Tarik (pull) kode terbaru dari repository (atau timpa file lama via FTP/SFTP):
   ```bash
   git pull origin main
   ```
3. Install dependensi baru (hanya jika ada tambahan library pada `package.json`):
   ```bash
   npm install
   ```
4. Lakukan Build ulang agar UI terbaru di-compile:
   ```bash
   npm run build
   ```
5. Restart spesifik process PM2 untuk seketika memuat kode terbaru:
   ```bash
   pm2 reload streamtube
   ```
   *(Menggunakan perintah `reload` ketimbang `restart` di PM2 akan mencoba proses pembaharuan dengan minimum downtime pada backend).*
