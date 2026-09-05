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
  /** Model yang paling sering menjawab, terbanyak dulu. Paling banyak tiga. */
  modelTeratas: { nama: string; jumlah: number }[];
  /**
   * Jawaban yang modelnya TIDAK tercatat.
   *
   * Ditampilkan apa adanya, bukan disembunyikan. Kolom `model` baru ada
   * belakangan, jadi semua jawaban sebelum itu bernilai NULL — dan daftar
   * model yang diam-diam menghitung sebagian kecil riwayat akan terbaca
   * seperti menghitung semuanya.
   */
  jawabanTanpaModel: number;
  /** Rentang yang dihitung, dalam hari. */
  hari: number;
  /** Jumlah pesan per hari, sepanjang rentangnya, untuk peta panas. */
  harian: { tanggal: string; jumlah: number }[];
};

/** Hari yang ditampilkan di peta panas: 12 minggu penuh. */
export const HARI_PETA = 84;

/**
 * Rentang yang boleh diminta, dalam hari.
 *
 * `/insights --days N` milik Hermes, dengan pilihan yang dipatok alih-alih
 * angka bebas: rentang bebas berarti tiap nilai perlu dijaga dari angka
 * negatif, nol, dan sepuluh juta — dan tidak ada yang benar-benar ingin
 * melihat 37 hari.
 */
export const RENTANG: { hari: number; label: string }[] = [
  { hari: 7, label: "7 hari" },
  { hari: 30, label: "30 hari" },
  { hari: 84, label: "12 minggu" },
  { hari: 365, label: "1 tahun" },
];

/** Rentang dari nilai apa pun, jatuh ke 12 minggu kalau tidak dikenali. */
export function rentangSah(nilai: unknown): number {
  const n = Number(nilai);
  return RENTANG.some((r) => r.hari === n) ? n : HARI_PETA;
}
