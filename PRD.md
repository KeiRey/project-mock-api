# Product Requirement Document (PRD) - Versi 2
## Platform: MockFlow Stateless (Next.js & Vercel Stack)

| Detail Produk | Informasi |
| :--- | :--- |
| **Nama Produk** | MockFlow Stateless |
| **Versi** | 2.0 (Updated) |
| **Penulis** | Keimal Reyyan P. A. |
| **Teknologi Stack**| Next.js (Full-stack / App Router) |
| **Platform Deploy**| Vercel (Serverless / Edge Network) |
| **Arsitektur** | Stateless (Zero Database) |
| **Status** | Ready for Development |

---

## 1. Ringkasan Eksekutif & Latar Belakang

Dalam pengembangan perangkat lunak modern, penyelarasan integrasi antara tim Frontend dan Backend sering kali menjadi hambatan utama. Developer membutuhkan alat pengujian instan yang mampu menyimulasikan respons API atau menguji kiriman Webhook tanpa harus terikat pada konfigurasi database server yang kompleks, lisensi berbayar, atau batasan lokal.

**MockFlow Stateless (V2)** dirancang sebagai solusi arsitektur modern yang memanfaatkan kapabilitas **Next.js secara penuh (Full-stack)** untuk di-deploy secara *seamless* di platform **Vercel Serverless Edge Network**. Dengan pendekatan **100% Stateless**, seluruh konfigurasi data seperti HTTP status code, respons JSON payload, dan kustomisasi header dikompresi langsung ke dalam string token aman berbasis URL client-side. Serverless Route pada Next.js bertindak sebagai penerjemah real-time tanpa menyimpan satu baris data pun di storage fisik permanen. Konsep ini memangkas ongkos operasional infrastruktur server menjadi nol rupiah pada tier gratis Vercel dan memberikan jaminan privasi data mutlak bagi developer.

---

## 2. Tujuan Produk & Target Pengguna

### Tujuan Utama
* **Single Repository Solution:** Membangun aplikasi web utilitas satu-halaman (SPA) interaktif yang menggabungkan UI pembangun (frontend) dan API (backend) dalam satu repositori Next.js tunggal.
* **Zero Database Dependency:** Menghilangkan ketergantungan pada basis data pihak ketiga guna memastikan kecepatan eksekusi respons secepat kilat (*ultra-low latency*).
* **High Scalability:** Memaksimalkan efisiensi ekosistem Vercel Serverless agar produk siap menangani lonjakan request tinggi sejak hari pertama diluncurkan tanpa risiko *server crash*.

### Target Pengguna
* **Frontend Developers:** Membutuhkan endpoint JSON instan untuk menguji state UI/UX sebelum endpoint backend sesungguhnya selesai didevelop.
* **Integration Engineers:** Menguji keandalan sistem pengiriman Webhook dari platform pihak ketiga (seperti payment gateway atau modul logistik) langsung dari internet secara real-time.
* **QA Engineers:** Menyimulasikan skenario kegagalan aplikasi dengan memicu status error HTTP custom (misalnya kode 400, 422, atau 500) secara dinamis.

---

## 3. Arsitektur & Alur Kerja Next.js (Stateless)

Aplikasi ini memanfaatkan arsitektur terpadu Next.js (App Router) tanpa memerlukan service eksternal tambahan. Seluruh logika enkapsulasi dilakukan secara lokal di sisi client dan serverless API dengan alur sebagai berikut:

1. **Konfigurasi di UI:** Pengguna menyusun data HTTP Method, Status Code, Headers, dan isi JSON Body melalui antarmuka web (React Components).
2. **Kompresi Client-Side:** Sisi client menggunakan algoritma kompresi string yang aman untuk URL (seperti `lz-string` atau utilitas `btoa` + URI safe encoding). Objek konfigurasi diubah menjadi token ringkas tunggal.
3. **Generasi Tautan Vercel:** Sistem membuat tautan publik instan dengan format:
   `https://mockflow.vercel.app/api/mock?d=[TOKEN_KOMPRESI]`
4. **Resolusi Serverless API:** Saat URL tersebut dipanggil oleh HTTP client (Postman, cURL, Fetch), Next.js Route Handler (`app/api/mock/route.ts`) menangkap query parameter `d`, mengekstrak dan melakukan dekompresi objek di memori RAM serverless secara instan, lalu langsung melempar respons balik sesuai spesifikasi pengguna.

> **Siklus Request:**
> `Client Request (URL + Token)` ➔ `Vercel Edge/Serverless Node` ➔ `Next.js API Handler (Decompress & Parse)` ➔ `Return HTTP Response`.
>
> *Seluruh proses ini berjalan murni terisolasi di memori fungsional (stateless compute unit) dengan waktu pemrosesan internal < 10ms.*

---

## 4. Spesifikasi Fitur Utama (MVP)

### 4.1. Dashboard Visual Mock Builder (Next.js Frontend Pages)
* **Method & Status Selector:** Dropdown pilihan HTTP Method (GET, POST, PUT, DELETE) dan form input teks untuk kustomisasi HTTP status code sesuai standar IETF.
* **Monaco JSON Editor:** Komponen editor kode interaktif di frontend Next.js yang mendukung fitur *syntax highlighting* dan pengecekan otomatis validitas skema JSON.
* **Custom Response Headers Container:** Antarmuka baris dinamis untuk menyisipkan header kustom seperti `Content-Type`, `Access-Control-Allow-Origin` (CORS), atau token autentikasi tiruan.

### 4.2. Shareable URL & Copy Utilities
* **Real-time Encoder:** String URL keluaran diperbarui secara otomatis setiap kali ada modifikasi karakter di dalam JSON editor atau pengaturan status.
* **Click-to-Copy:** Utilitas salin cepat satu tombol yang memanfaatkan Clipboard API modern bawaan browser.

### 4.3. Webhook Echo Endpoint
* **Dynamic Reflector Route:** Menyediakan rute API khusus di Next.js (`app/api/echo/route.ts`) yang berfungsi memantulkan kembali (*echoing*) seluruh muatan payload (headers, query parameters, data body) yang dikirim oleh sistem webhook luar secara instan tanpa perlu database log.

---

## 5. Persyaratan Non-Fungsional & Limitasi Vercel

| Aspek Teknikal | Kriteria Batasan (Next.js & Vercel) |
| :--- | :--- |
| **Deployment Platform** | 100% kompatibel dan dioptimalkan penuh untuk infrastruktur Vercel Serverless/Edge Functions tanpa memerlukan konfigurasi docker atau setup server VPS eksternal. |
| **Batas Maksimum Payload** | Mengingat spesifikasi batasan panjang string URL pada browser umum (&plusmn; 2048 karakter), ukuran payload JSON murni yang direkomendasikan adalah **di bawah 1.5 KB** setelah dikompresi agar pas di dalam Query Parameter. |
| **Kepatuhan Keamanan** | Sistem tidak menyimpan rekaman data apa pun (*zero persistence*). Komunikasi data end-to-end sepenuhnya dilindungi oleh enkripsi otomatis SSL/TLS yang disediakan oleh Vercel secara default. |
| **Performa Latensi** | Mengoptimalkan rute API menggunakan konfigurasi Next.js Edge Runtime jika memungkinkan untuk memangkas waktu *cold start* serverless hingga mendekati 0ms. |

---

## 6. Model Bisnis & Strategi Komersial (Tiering)

Meskipun aplikasi ini sepenuhnya berjalan secara stateless tanpa beban biaya pengelolaan basis data, monetisasi dapat diterapkan pada sisi fungsionalitas UI lanjutan:

| Fitur | Free Tier (Murni Stateless URL) | Premium Tier (Commercial License) |
| :--- | :--- | :--- |
| **Ukuran Konfigurasi** | Maksimum terbatas mengikuti limitasi aman panjang URL (&plusmn; 1.5 KB). | Ekspansi hingga 10 KB menggunakan skema hybrid penyimpanan client-side terenkripsi atau Next.js middleware token. |
| **Simulasi Delay** | Tidak tersedia (Respons kilat instan). | Fitur simulasi latensi jaringan buatan (misal menunda kiriman respons selama `n` milidetik untuk menguji ketahanan aplikasi client). |
| **Proteksi Enkripsi** | Hanya kompresi string terbuka (Siapa saja yang memiliki URL dapat melakukan decode). | Fitur proteksi password berbasis enkripsi sisi client (AES-256). Data tidak bisa didekode di server Next.js jika client tidak mengirimkan kunci enkripsi yang benar. |