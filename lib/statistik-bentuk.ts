/**
 * Bentuk data statistik — tipe dan tetapan saja, TANPA impor apa pun.
 *
 * Dipisah dari lib/statistik.ts karena berkas itu mengimpor node:sqlite, dan
 * komponen browser yang mengambil satu tetapan saja dari sana ikut menarik
 * seluruh modulnya ke bundel klien. Build Turbopack menolaknya terus terang
 * ("the chunking context does not support external modules: node:sqlite"),
 * dan itu benar: basis data tidak punya urusan di browser.
 *
 * `import type` saja tidak cukup untuk mencegahnya — tipe memang terhapus saat
 * kompilasi, tapi HARI_PETA adalah nilai sungguhan yang harus ikut.
 */

export type Statistik = {
  percakapan: number;
  pesan: number;
  token: number;
  hariAktif: number;
  streakSaatIni: number;
  streakTerpanjang: number;
  /** Jam 0–23 dengan pesan terbanyak, atau null kalau belum ada pesan. */
  jamPuncak: number | null;
  /** Jumlah pesan per hari, HARI_PETA hari terakhir, untuk peta panas. */
  harian: { tanggal: string; jumlah: number }[];
};

/** Hari yang ditampilkan di peta panas: 12 minggu penuh. */
export const HARI_PETA = 84;
