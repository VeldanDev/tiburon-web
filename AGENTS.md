<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Tiburon — panduan pengembangan

Aplikasi obrolan milik Veldan, berjalan di mesinnya sendiri. Satu pengguna,
satu mesin, satu korpus. Sebagian besar keputusan di bawah ini masuk akal
justru karena tiga hal itu.

Sebagian aturannya diambil dari `AGENTS.md` milik Hermes Agent (Nous Research,
MIT) setelah repo aslinya dibaca. Yang diambil bukan daftar fiturnya —
melainkan cara memutuskan. Di tempat yang kami berbeda, alasannya ditulis.

## Yang membuat Tiburon ada

Menjawab dari korpus Veldan sendiri, **dan menyebut sumbernya dengan cara yang
bisa diperiksa**. Kartu sumber yang bisa diklik — potongan korpus aslinya
terbuka, kata yang cocok disorot — bukan hiasan; itu seluruh alasannya.
Proyek ini lahir dari ketidakpercayaan pada jawaban yang tidak bisa
diverifikasi: model yang mengarang laporan status, penyedia yang membalas teks
tagihan sebagai jawaban.

Fitur apa pun yang membuat jawaban **lebih sulit diperiksa** bertentangan
dengan alasan proyek ini ada, seberapa pun rapinya ia dibangun.

## Tangga jejak — memutuskan bentuk kapabilitas baru

Pilih anak tangga TERTINGGI (paling sedikit jejaknya) yang benar-benar
menyelesaikan masalahnya:

1. **Perluas yang sudah ada.** Variasi dari sesuatu yang sudah berjalan. Nol
   permukaan baru. Contoh: jalur baru di pemilih jalur, bagian baru di
   pengaturan, perintah baru di `PERINTAH`.
2. **Tetapan atau data.** Kalau bedanya cuma nilai, ia masuk ke modul `lib/`
   yang sudah ada — bukan modul baru. Contoh: `PETA_JALUR`, `BAGIAN`.
3. **Modul `lib/` baru.** Saat logikanya punya aturan sendiri yang layak diuji
   terpisah. Satu modul, satu tanggung jawab, satu berkas uji.
4. **Rute API baru.** Saat ia butuh berjalan di server — basis data, kunci API,
   atau apa pun yang tidak boleh disentuh browser.
5. **Alat agen baru.** Hanya kalau agen benar-benar perlu memanggilnya sendiri
   berkali-kali dalam satu giliran. Alat menambah beban skema di setiap
   permintaan, selamanya.
6. **Subsistem dengan tabelnya sendiri.** Hanya saat datanya benar-benar punya
   siklus hidup sendiri. Tabel baru berarti migrasi, dan migrasi berarti risiko
   pada basis data yang berisi riwayat sungguhan.

## Yang ditolak, walau dibangun rapi

- **Infrastruktur spekulatif.** Kait, opsi, atau lapisan abstraksi tanpa
  pemakai nyata hari ini. Menambahkannya mudah; membuangnya setelah ada yang
  bergantung padanya susah. Kait dengan pemakai nyata yang dinyatakan bukan
  spekulatif, walau pemakainya menyusul.
- **Variabel lingkungan untuk yang bukan rahasia.** `.env.local` khusus
  kredensial. Jalur, ambang, sakelar, dan preferensi tampilan masuk ke
  `lib/konfigurasi.ts`. Satu pengecualian yang ditulis di sana: uji butuh
  menimpa jalur basis data untuk isolasi, dan itu dijembatani di kode.
- **Angka yang ditulis mati di keterangan.** "164 berkas terindeks" bertahan
  berbulan-bulan sementara korpusnya berisi 8. Angka dibaca dari sumbernya,
  atau tidak disebut sama sekali.
- **Kontrol yang tidak melakukan apa-apa.** Kalau ia terlihat bisa ditekan, ia
  harus berbuat. Dua kontrol mati pernah lolos berbulan-bulan di sidebar.
- **Kegagalan yang ditelan.** `.catch(() => {})` pada jalur yang menyimpan
  sesuatu adalah cacat, bukan kehati-hatian. Kalau gagalnya tidak penting,
  tulis kenapa di komentar.
- **Alat yang bisa menulis, tanpa lapisan izin.** Sampai izin per-tindakan ada,
  setiap alat agen hanya-baca. Ada uji yang menolak nama alat yang mengandung
  `tulis|hapus|jalankan|write|delete|exec|shell`.

## Aturan uji

- **Jangan pernah membaca kode sumber di dalam uji.** Uji yang membaca teks
  `.ts`/`.tsx` menguji BENTUK SUMBER, bukan perilaku: ia lolos saat
  implementasinya rusak halus, dan gagal saat kodenya dirapikan dengan benar.
  Kalau ekstraksi terasa mengganggu, ITU sinyalnya untuk ekstrak — bukan untuk
  membuat regex di sekitarnya. Berkas data (`styles/tokens.css`) bukan kode
  sumber; membacanya boleh.
- **Jangan menulis uji pendeteksi perubahan.** Kalau bacanya seperti snapshot,
  hapus. Kalau bacanya seperti kontrak antara dua data, simpan.
- **Buat bug-nya mustahil sebelum membuat ujinya.** Daftar bagian pengaturan
  dipindah ke `lib/` supaya sebuah bagian tidak lagi BISA lupa didaftarkan.
  Itu lebih baik daripada uji yang menjaganya.
- **Periksa uji baru GAGAL tanpa perbaikannya.** Uji yang lolos di kedua
  keadaan tidak menjaga apa pun. Beberapa kali di proyek ini, langkah itu yang
  menemukan bahwa perbaikannya tidak bekerja.

## Bentuk kode

- Nama dalam Bahasa Indonesia, konsisten dengan seluruh basis kode.
- Komentar menjelaskan **kenapa**, bukan apa. Yang paling berharga adalah
  komentar yang menyebut apa yang akan rusak kalau barisnya dibalik.
- Satu pemilik untuk tiap asumsi. `lib/skema.ts` memiliki bentuk tabel,
  `lib/label-berkas.ts` memiliki identitas berkas korpus, `lib/pintasan.ts`
  memiliki peta tombol. Asumsi yang ditulis di dua tempat akan berbeda suatu
  hari, dan tidak gagal dengan berisik saat itu terjadi.
- Migrasi basis data **aditif saja**: tambah tabel, tambah kolom. Tidak pernah
  menghapus atau mengubah tipe. `data/riwayat.sqlite` berisi percakapan
  sungguhan.
- **Arsipkan, jangan hapus** — untuk apa pun yang dibuang oleh proses otomatis.
  Yang dihapus manusia boleh benar-benar hilang; yang dibuang model harus bisa
  dikembalikan.

## Keamanan

- Kunci API hanya di server. Tidak pernah sampai ke browser, tidak pernah
  masuk Git.
- Prompt sistem dirakit **di server**. Klien mengirim id percakapan, tidak
  pernah isi promptnya — kalau browser yang memasok isinya, siapa pun yang bisa
  memanggil rutenya bisa menyisipkan apa pun.
- Basis data korpus selalu dibuka `readOnly: true`.
- Teks yang akan MASUK ke prompt sistem dan bertahan di sana dipindai lebih
  dulu (`lib/pindai-injeksi.ts`). Ini berlaku untuk apa pun yang ditulis model
  dari bahan tak tepercaya — lampiran, tempelan, potongan korpus berisi kutipan
  orang lain.

## Sebelum menyebutnya selesai

`npx tsc --noEmit` bersih, `npx vitest run` hijau, `npm run build` berhasil.
Untuk apa pun yang menyentuh tata letak atau aliran, uji di peramban sungguhan
— jsdom tidak menghitung tata letak sama sekali.
