# SIVAA Bot

**Smart IVA Assistant** - WhatsApp bot untuk Puskesmas Boom Baru yang memberikan informasi tentang kanker serviks dan pemeriksaan IVA.

## Fitur

- Respon otomatis untuk pertanyaan FAQ tentang kanker serviks dan pemeriksaan IVA
- Deteksi sapaan cerdas (halo, hello, hai, dll)
- Penyimpanan sesi ke MongoDB (tidak perlu scan QR ulang setelah restart)
- Pengingat pendaftaran IVA setiap 3 pesan
- Ringan dan hemat memori (menggunakan Baileys, tanpa Puppeteer)

## Prasyarat

- Node.js 18+
- MongoDB Atlas atau MongoDB lokal
- Nomor WhatsApp aktif

## Instalasi

1. Clone repository:
   ```bash
   git clone <repository-url>
   cd bot_sivaa
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set environment variable:
   ```bash
   export MONGO_URI="mongodb+srv://user:password@cluster.mongodb.net/database"
   ```

4. Jalankan bot:
   ```bash
   npm start
   ```

5. Scan QR code yang muncul dengan WhatsApp di HP

## Environment Variables

| Variable | Deskripsi |
|----------|-----------|
| `MONGO_URI` | Connection string MongoDB |
| `PORT` | Port untuk HTTP server (default: 3000) |

## Kata Kunci yang Didukung

### Menu Utama
- `sivaa` atau sapaan (halo, hai, hello, dll) - Menampilkan greeting dan menu utama
- `kanker serviks` - Menu informasi kanker serviks
- `pemeriksaan iva` - Menu informasi pemeriksaan IVA

### Informasi Kanker Serviks (K1-K8)
- `k1` - Apa itu kanker leher rahim?
- `k2` - Faktor risiko & penyebab
- `k3` - Apakah menular?
- `k4` - Gejala yang muncul
- `k5` - Cara deteksi dini
- `k6` - Kapan ditetapkan terkena
- `k7` - Cara pengobatan
- `k8` - Peluang kesembuhan

### Informasi Pemeriksaan IVA (P1-P35)
- `p1` sampai `p35` - Berbagai pertanyaan tentang IVA Test

## Deployment ke Render

1. Push kode ke GitHub

2. Buat Web Service baru di [Render](https://render.com)

3. Hubungkan repository GitHub

4. Konfigurasi:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

5. Tambahkan Environment Variable:
   - `MONGO_URI` = connection string MongoDB Anda

6. Deploy dan tunggu sampai running

7. Cek logs untuk QR code, scan dengan WhatsApp

## Struktur File

```
bot_sivaa/
├── index.js        # Main bot code
├── faq.json        # FAQ responses database
├── package.json    # Dependencies
└── README.md       # Dokumentasi
```

## Troubleshooting

### Bot tidak menampilkan QR code
- Pastikan `MONGO_URI` sudah diset dengan benar
- Cek koneksi internet
- Hapus data auth di MongoDB dan restart

### Connection keeps closing
- Pastikan tidak ada instance bot lain yang berjalan dengan nomor yang sama
- Cek apakah WhatsApp di HP masih terhubung ke internet

### Pesan tidak terkirim
- Pastikan nomor penerima valid (format: 628xxx)
- Cek logs untuk error message

## Reset Sesi

Jika perlu scan QR code ulang:

```bash
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
  .then(() => mongoose.connection.db.collection('auth').deleteMany({}))
  .then(() => { console.log('Auth cleared'); process.exit(0); });
"
```

Lalu restart bot.

## Tech Stack

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Mongoose](https://mongoosejs.com/) - MongoDB ODM
- [Pino](https://getpino.io/) - Logger

## Lisensi

ISC
