/**
 * Pemindai injeksi untuk teks yang akan MASUK ke prompt sistem.
 *
 * Dibuat setelah membaca `tools/cronjob_prompt_scan.py` dan `threat_patterns.py`
 * milik Hermes, yang memindai prompt cron yang dirakit sebelum dijalankan.
 * Alasan mereka: cron berjalan tanpa pengawasan, jadi muatan injeksi di dalam
 * skill melewati setiap gerbang.
 *
 * ALASAN DI SINI LEBIH MENDESAK, dan lubangnya baru saja dibuat sendiri.
 *
 * Ingatan otomatis mengambil isi percakapan, meminta model menyaring "fakta",
 * lalu menyimpannya — dan ingatan ikut ke prompt sistem SETIAP permintaan, di
 * SETIAP jalur, SELAMANYA, tanpa Veldan melihat prosesnya. Isi percakapan itu
 * sendiri tidak tepercaya: lampiran berkas, teks yang ditempel, dan potongan
 * korpus yang sebagian besar berisi kutipan narasi video orang lain.
 *
 * Satu kalimat "abaikan semua instruksi sebelumnya" yang lolos ke sana bukan
 * gangguan sesaat — ia jadi bagian tetap dari siapa Tiburon.
 *
 * Yang dipindai hanya pola yang TIDAK bertahan dalam prosa normal, mengikuti
 * catatan mereka: kalimat perintah injeksi klasik, perintah menyembunyikan
 * sesuatu dari pengguna, dan unicode tak terlihat. Bukan daftar kata terlarang
 * — "abaikan" sendirian adalah kata biasa.
 */

/**
 * Karakter tak terlihat: lebar-nol, penyambung, dan pembalik arah teks.
 *
 * Diambil apa adanya dari INVISIBLE_CHARS milik Hermes. Pembalik arah (U+202E
 * dan kerabatnya) yang paling berbahaya: ia membuat teks yang TERBACA polos di
 * layar berisi perintah lain saat dibaca mesin.
 */
const TAK_TERLIHAT = new Set(
  [
    "​", "‌", "‍", "⁠", "⁢", "⁣", "⁤", "﻿",
    "‪", "‫", "‬", "‭", "‮", "⁦", "⁧", "⁨", "⁩",
  ],
);

/**
 * Pola perintah injeksi, dua bahasa.
 *
 * Bahasa Indonesia ikut karena di situlah percakapan Veldan berlangsung —
 * daftar yang cuma berbahasa Inggris melewatkan bentuk yang paling mungkin
 * benar-benar muncul di sini.
 *
 * Dua pagar dipasang SETELAH pengujian menolak kalimat yang sah:
 *
 *   \b di depan kata kerja   "abaikan" hidup di dalam "mengabaikan", dan
 *                          "lupakan" di dalam "melupakan". Tanpa batas kata,
 *                          "Veldan sering mengabaikan aturan lint" ditolak
 *                          sebagai serangan.
 *
 *   {0,3} bukan *            celah kata dibatasi tiga. Dengan pengulangan
 *                          bebas, "mengabaikan saran orang lain tentang
 *                          aturan penamaan" ikut cocok karena regex-nya
 *                          melompati sembilan kata mencari "aturan".
 *
 * Arah salahnya dipilih sadar: melewatkan satu serangan menyisakan satu
 * baris yang bisa dihapus dari halaman Ingatan; menolak kalimat sah akan
 * perlahan mengosongkan ingatan tanpa ada yang tahu kenapa.
 */
const POLA: [RegExp, string][] = [
  [/\bignore\s+(?:\w+\s+){0,3}(?:previous|all|above|prior)\s+(?:\w+\s+){0,3}instructions?/i, "injeksi-prompt"],
  [/\babaikan\s+(?:\w+\s+){0,3}(?:instruksi|aturan|perintah|petunjuk)\b/i, "injeksi-prompt"],
  [/\blupakan\s+(?:semua\s+)?(?:instruksi|aturan|perintah)\b/i, "injeksi-prompt"],
  [/\bdisregard\s+(?:your|all|any)\s+(?:instructions?|rules?|guidelines?)/i, "abaikan-aturan"],
  [/\bdo\s+not\s+tell\s+the\s+user/i, "sembunyikan-dari-pengguna"],
  [/\bjangan\s+(?:beri\s*tahu|memberi\s*tahu|katakan\s+(?:ke)?pada)\s+peng?guna/i, "sembunyikan-dari-pengguna"],
  [/system\s+prompt\s+override|ganti\s+prompt\s+sistem/i, "timpa-prompt-sistem"],
  [/\bmulai\s+sekarang\s+kamu\s+adalah|\bfrom\s+now\s+on\s+you\s+are/i, "ganti-identitas"],
];

export type Temuan = { pola: string; contoh: string };

/**
 * Normalkan sebelum mencocokkan.
 *
 * NFKC melipat varian lebar-penuh dan kompatibilitas (ｉｇｎｏｒｅ → ignore),
 * yang kalau tidak akan lolos begitu saja dari tiap pola di atas. Gagasan ini
 * juga dari pemindai mereka.
 */
function normalkan(teks: string): string {
  return teks.normalize("NFKC");
}

/**
 * Periksa satu teks. Mengembalikan temuan pertama, atau null kalau bersih.
 *
 * Berhenti di temuan pertama karena keputusannya biner — teksnya ditolak — dan
 * mendaftar seluruh alasannya tidak mengubah apa pun.
 */
export function pindaiInjeksi(teks: string): Temuan | null {
  for (const ch of teks) {
    if (TAK_TERLIHAT.has(ch)) {
      const kode = ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
      return { pola: "unicode-tak-terlihat", contoh: `U+${kode}` };
    }
  }

  const bersih = normalkan(teks);
  for (const [pola, nama] of POLA) {
    const cocok = bersih.match(pola);
    if (cocok) return { pola: nama, contoh: cocok[0].slice(0, 80) };
  }
  return null;
}

/** Apakah teks ini aman disimpan ke sesuatu yang ikut ke prompt sistem? */
export function amanUntukPrompt(teks: string): boolean {
  return pindaiInjeksi(teks) === null;
}
