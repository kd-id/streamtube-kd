# StreamTube Pro

> Dashboard manajemen multi-platform Live Streaming canggih dengan dukungan native backend (Node.js, Express, FFmpeg, SQLite3).

**Tech Stack:** React 19 · Vite 8 · Node.js · Express · SQLite3 · FFmpeg

---

## 📋 Persyaratan Sistem

- **Node.js**: v18.0+
- **FFmpeg**: Diperlukan untuk kompresi, transcoding live video & pembuatan thumbnail.
- **Git**

---

## 🖥️ Instalasi Lokal (Development)

### 1. Clone & Install

```bash
git clone https://github.com/username/streamtube-pro.git
cd streamtube-pro
npm install
```

### 2. Jalankan Server Dev
Kami menggunakan Vite yang disandingkan penuh dengan *Express backend* via `server.js`.

```bash
npm run dev
```

Aplikasi dan Server Backend akan mengudara secara tandem di:
```
http://localhost:3000
```

*Note: Database (`db/streamtube.db`) dan media unggahan (`uploads/`) diabaikan oleh `.gitignore` untuk menjaga source agar tetap bersih.*

---

## ☁️ Deploy ke VPS (Production - Ubuntu/Debian)

### Langkah 1 — Siapkan Server

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx ffmpeg
```

### Langkah 2 — Upload Code

Clone source code ke VPS (Bisa via Git atau SCP, pastikan Anda `.gitignore` folder `/uploads/` dan `/db/*.db`):
```bash
mkdir -p /var/www/streamtube
cd /var/www/streamtube
git clone https://github.com/username/streamtube-pro.git .

npm install
```

### Langkah 3 — Setup Daemon PM2 untuk Backend

Gunakan PM2 agar Background Worker Node / FFmpeg tetap berjalan di VPS meskipun SSH ditutup:
```bash
npm install -g pm2
npm run build   # Opsional: pre-build front end Vite
pm2 start npm --name "streamtube" -- run start
pm2 save
pm2 startup
```

Server Anda kini berjalan independen pada _port_ `3000`.

### Langkah 4 — Reverse Proxy Nginx

Agar web dapat diakses via nama domain dan Port 80 (HTTP):
```bash
nano /etc/nginx/sites-available/streamtube
```

Paste konfigurasi ini:
```nginx
server {
    listen 80;
    server_name domain-kamu.com;
    
    # Izinkan upload file besar (contoh: maksimal 5GB)
    client_max_body_size 5000M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable & Restart:
```bash
ln -s /etc/nginx/sites-available/streamtube /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

*(Gunakan Certbot Let's Encrypt setelah tahap ini jika butuh HTTPS)*

---

## 🔄 Update Kode ke GitHub (Clean Push)

Setiap kali Anda melakukan perubahan kode dan ingin push ke GitHub, lakukan langkah berikut agar **hanya source code murni** yang terupload (tanpa data user, database, file upload, dsb):

### Cara Cepat (1 Perintah)
```bash
git add .
git commit -m "update: deskripsi perubahan"
git push origin main
```

> `.gitignore` sudah dikonfigurasi untuk memblokir semua file sensitif secara otomatis:
> `uploads/`, `data/`, `db/*.db`, `*.mp4`, `*.m4a`, `*.jpg`, `*.png`, `*.tmp`, dll.

### Jika Ada File Besar Tertinggal di History
Jika push ditolak karena _Large Files Detected (GH001)_, bersihkan history dengan cara berikut:

```bash
# Buat branch baru tanpa riwayat lama
git checkout --orphan clean-main
git add .
git commit -m "clean: fresh source code release"

# Ganti branch main dengan yang bersih
git branch -D main
git branch -m clean-main main
git push --force origin main
```

> ⚠️ **Peringatan:** `--force` akan menghapus seluruh riwayat commit lama di GitHub. Pastikan semua perubahan sudah di-commit sebelum menjalankannya.

---

## 🔄 Update Aplikasi di VPS

Setelah push kode baru ke GitHub, jalankan perintah berikut di VPS untuk menarik pembaruan:

```bash
cd /var/www/streamtube

# Pull perubahan terbaru
git pull origin main

# Install dependencies baru (jika ada)
npm install

# Restart server
pm2 restart streamtube
```

> Data user, database, dan file upload di VPS **tidak akan terpengaruh** karena folder `uploads/`, `data/`, dan `db/*.db` sudah di-exclude oleh `.gitignore`.

---

## 🗑️ Hapus & Install Ulang di VPS (Fresh Reinstall)

Jika Anda ingin menghapus semua kode lama dan install ulang dari nol (**data user/upload tetap aman**):

```bash
cd /var/www/streamtube

# 1. Stop server yang sedang berjalan
pm2 stop streamtube
pm2 delete streamtube

# 2. Backup data user (database & uploads)
cp -r data/ /tmp/streamtube-backup-data/
cp -r uploads/ /tmp/streamtube-backup-uploads/

# 3. Hapus semua kode lama
rm -rf /var/www/streamtube/*
rm -rf /var/www/streamtube/.*  2>/dev/null

# 4. Clone ulang source code terbaru
cd /var/www/streamtube
git clone https://github.com/username/streamtube-pro.git .

# 5. Install dependencies
npm install

# 6. Kembalikan data user dari backup
cp -r /tmp/streamtube-backup-data/ data/
cp -r /tmp/streamtube-backup-uploads/ uploads/

# 7. Jalankan kembali server
pm2 start npm --name "streamtube" -- run start
pm2 save
```

### Jika Ingin Reset Total (Hapus Semua Termasuk Data User)

```bash
pm2 stop streamtube && pm2 delete streamtube
rm -rf /var/www/streamtube/*
cd /var/www/streamtube
git clone https://github.com/username/streamtube-pro.git .
npm install
pm2 start npm --name "streamtube" -- run start
pm2 save
```

> ⚠️ **Peringatan:** Perintah di atas akan menghapus semua data user, database, dan file upload secara permanen. Tidak bisa dikembalikan.

---

## 📌 Catatan Penting
- **Penyimpanan:** Menggunakan **SQLite3** di backend (`data/streamtube.db`), dibuat otomatis saat pertama kali server dijalankan.
- **Folder Uploads:** `uploads/` dibuat otomatis oleh server saat pertama kali dijalankan. Tidak perlu membuat manual.
- **Media & File:** Semua aset stream di-transcode oleh sistem ke folder `/uploads/`.
- **System Specs Analyzer:** Aplikasi mendeteksi Network Speed, RAM, Storage, dan CPU Cores VPS secara real-time.
- **FFmpeg:** Wajib terinstall di server untuk live streaming dan thumbnail generation (`apt install -y ffmpeg`).
