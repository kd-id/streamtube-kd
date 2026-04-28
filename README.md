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

## 📌 Topik Penting Update Terakhir
- **Penyimpanan:** Beralih penuh dari `localStorage` front-end yang rilis kemarin, kini menggunakan data backend utuh menggunakan **SQLite3**.
- **Media & File:** Semua aset stream langsung di transcode oleh System ke folder `/uploads/`.
- **System Specs Analyzer:** Aplikasi mencatat beban Ping Network, Kapasitas RAM/ROM, dan jumlah kelonggaran Core CPU VPS secara real-time.
