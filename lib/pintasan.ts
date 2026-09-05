/**
 * Pintasan papan ketik — SATU sumber, dipakai daftar dan pendengarnya.
 *
 * Panel pintasan sudah lama membawa janji ini di komentarnya: "dibuat dari satu
 * sumber data yang juga dipakai untuk mendaftarkan pendengarnya, supaya panel
 * ini tidak bisa perlahan berbohong". Janji itu tidak pernah benar — daftarnya
 * ditulis tangan di satu berkas, petanya ditulis tangan lagi di berkas lain.
 * Keduanya kebetulan masih cocok, dan "kebetulan masih cocok" persis keadaan
 * yang komentarnya klaim mustahil.
 *
 * Sekarang petanya yang jadi sumber, dan daftarnya diturunkan darinya. Menambah
 * jalur berarti menambah satu baris di sini, dan panelnya ikut sendiri.
 */
import type { Jalur } from "@/components/chat/PemilihJalur";

/** Tombol angka -> jalur. Dibaca pendengar Ctrl/Cmd di layar obrolan. */
export const PETA_JALUR: Record<string, Jalur> = {
  "1": "cepat",
  "2": "tiburon",
  "3": "agen",
  "4": "kode",
};

const ARTI_JALUR: Record<Jalur, string> = {
  cepat: "Jalur Cepat — permukaan, tanpa korpus",
  tiburon: "Jalur Tiburon — membaca korpusmu",
  agen: "Jalur Agen — mencari sendiri berkali-kali",
  kode: "Jalur Kode — paling dalam",
};

export type Pintasan = { tombol: string[]; arti: string };

/** Pintasan yang bukan pemilihan jalur, ditulis apa adanya. */
const LAINNYA: { sebelum: Pintasan[]; sesudah: Pintasan[] } = {
  sebelum: [
    { tombol: ["Enter"], arti: "Kirim pesan" },
    { tombol: ["Shift", "Enter"], arti: "Baris baru" },
    { tombol: ["Esc"], arti: "Hentikan jawaban yang sedang mengalir" },
  ],
  sesudah: [
    { tombol: ["/"], arti: "Buka menu perintah" },
    { tombol: ["/btw"], arti: "Tanya tentang obrolan ini tanpa menambahkannya ke riwayat" },
    { tombol: ["?"], arti: "Buka daftar ini" },
  ],
};

export const PINTASAN: Pintasan[] = [
  ...LAINNYA.sebelum,
  ...Object.entries(PETA_JALUR).map(([tombol, jalur]) => ({
    tombol: ["Ctrl", tombol],
    arti: ARTI_JALUR[jalur],
  })),
  ...LAINNYA.sesudah,
];
