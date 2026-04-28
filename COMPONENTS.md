# Dokumentasi Komponen StreamTube Pro

Aplikasi StreamTube Pro dibangun menggunakan React (Frontend), Vite (Builder & Dev Server), dan FFmpeg (Core Streaming Backend). Berikut adalah mapping komponen-komponen utamanya:

## 1. Frontend Core (React)
Lokasi utama: `src/`
- **`App.jsx`**
  Mengatur proses routing utama menggunakan React Router. Memisahkan rute `/login` yang publik dengan rute berpelindung (Protected Route).
- **`main.jsx`**
  Entry point React yang membungkus aplikasi dengan Context Providers yang dibutuhkan.

## 2. Data Stores (Hooks / State Management)
Aplikasi ini tidak menggunakan Redux, melainkan bereksperimen dengan **React Context + Custom Hooks** untuk state management yang ringan dan reaktif. Data setiap pengguna (User) disimpan terisolasi di `localStorage`.
Semua hooks terletak di `src/hooks/`.
- **`useAuth.jsx`**: Mengatur autentikasi (Login/Register/Logout) dan manajemen sesi.
- **`useUserKey.js`**: Helper krusial yang mengisolasi (*namespace*) kunci penyimpanan `localStorage` (`readUserData`/`writeUserData`) berdasarkan `userId` masing-masing akun.
- **`useMediaStore.jsx`**: Mengelola daftar video/audio yang telah diunggah.
- **`useStreamStore.jsx`**: Pusat kontrol stream (Mulai Stream, Berhenti Stream, konfigurasi FFmpeg API).
- **`useYouTubeStore.jsx`**: Menyimpan Channel ID, Credentials OAuth2, dan Access Token YouTube.
- **`usePlaylistStore.jsx`**: Mengatur urutan musik dan media untuk stream mode gabungan.
- **`useLogStore.jsx`**: Mencatat semua output log dari server ke tampilan UI.

## 3. Komponen Layout & UI Standar
Lokasi utama: `src/components/`
- **`Layout.jsx`**: Frame utama penyatuan Sidebar, Header, dan Main Content. Merespon state mobile/desktop (`.main-wrapper`).
- **`Sidebar.jsx`**: Menu navigasi samping dengan kemampuan auto-collapse. Berubah menjadi bottom-navigation saat tampilan ponsel.
- **`Header.jsx`**: Bagian atas dengan fitur profil dropdown.

## 4. Halaman Utilitas (Pages)
Lokasi utama: `src/pages/`
Halaman-halaman ini menampilkan logic bisnis utama.
- **`Dashboard.jsx`**: Overveiw statistik channel Youtube dan Mini Network Monitor (menggunakan Navigator API).
- **`Login.jsx`**: Sistem Autentikasi. *(Mode Demo sudah dihilangkan pada final release)*.
- **`Streams.jsx`**: Mengelola daftar stream ("Saved Streams"), pengaturan API key, mengatur media looping, hingga menjalankan action Go Live.
- **`MediaLibrary.jsx`**: Pengelolaan file-file upload. Melakukan interaksi upload ke API endpoint Backend.
- **`Playlist.jsx`**: Manajemen playlist yang menggabungkan video (*tanpa mengubah audio bawaan*).
- **`Settings.jsx`**, **`Analytics.jsx`**, **`Monetization.jsx`**, **`LogViewer.jsx`**.

## 5. Backend Plugin (Streaming Node.js)
Aplikasi ini unik karena fitur backend (Upload File, FFmpeg spawn execution, Stream Logger) menempel *langsung* ke dalam server Vite menggunakan plugin Vite kustom.
Lokasi: `viteStreamPlugin.js`
- **Proses Upload**: Menangani POST ke `/api/upload` lalu menyimpan file secara lokal di folder `public/uploads`.
- **Eksekutor FFmpeg**: Mengeksekusi perintah command-line FFmpeg. Jika streaming Playlist dengan playlist berisi Audio & Video, plugin ini melakukan proses input-mapping otomatis yang kompleks seperti `-map 0:v:0 -map 1:a:0` dll.
- **Log Emitter**: Menerjemahkan Standard Error dari FFmpeg dan menembakkan pesan balik via Server-Sent Events (SSE) `text/event-stream`.
