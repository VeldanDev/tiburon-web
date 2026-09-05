/**
 * Permintaan izin yang menunggu jawaban Veldan.
 *
 * Saat lapisan izin memutuskan "tanya", giliran agen harus BERHENTI sampai
 * ada jawaban. Berkas ini yang menahannya: satu daftar permintaan tertunda,
 * masing-masing sebuah janji yang diselesaikan saat tombol ditekan.
 *
 * KENAPA DI MEMORI, BUKAN DI BASIS DATA. Permintaan izin hanya berarti selama
 * giliran yang memintanya masih berjalan. Kalau prosesnya mati, giliran itu
 * mati juga — dan permintaan yang selamat di basis data akan jadi tombol yang
 * menyetujui sesuatu yang sudah tidak ada. Tiburon satu proses di satu mesin,
 * jadi memori adalah tempat yang benar.
 *
 * DUA PAGAR YANG MEMBUATNYA TIDAK MENGGANTUNG SELAMANYA:
 *
 *   batas waktu   tidak dijawab dalam dua menit berarti TIDAK. Menunggu
 *                 selamanya berarti satu tab yang ditutup menahan satu
 *                 permintaan HTTP sampai server dimatikan.
 *   pembatalan    menekan Esc membatalkan gilirannya, dan permintaan izin
 *                 miliknya ikut dibatalkan — bukan ditinggalkan menunggu
 *                 jawaban untuk pekerjaan yang sudah dihentikan.
 *
 * Keduanya berujung pada TIDAK, tidak pernah pada ya. Izin yang diberikan
 * karena waktu habis adalah izin yang tidak pernah diberikan siapa pun.
 */
import { randomUUID } from "node:crypto";
import type { Tindakan } from "@/lib/izin";

/** Dua menit. Cukup untuk membaca permintaannya, tidak cukup untuk terlupakan. */
export const BATAS_TUNGGU_MS = 120_000;

type Tertunda = {
  tindakan: Tindakan;
  selesai: (izinkan: boolean) => void;
  jam: ReturnType<typeof setTimeout>;
};

const tertunda = new Map<string, Tertunda>();

export type Permintaan = { id: string; tindakan: Tindakan; janji: Promise<boolean> };

/**
 * Ajukan satu permintaan izin dan tunggu jawabannya.
 *
 * Yang memanggil WAJIB memakai `janji`-nya; membiarkannya menggantung berarti
 * gilirannya berjalan terus seolah izinnya sudah diberikan.
 */
export function mintaIzin(tindakan: Tindakan): Permintaan {
  const id = randomUUID();
  let selesai!: (izinkan: boolean) => void;

  const janji = new Promise<boolean>((resolve) => {
    selesai = (izinkan: boolean) => {
      const t = tertunda.get(id);
      if (!t) return;
      clearTimeout(t.jam);
      tertunda.delete(id);
      resolve(izinkan);
    };
  });

  // Jam dipasang SEBELUM permintaannya dikirim ke layar: kalau dipasang
  // sesudah dan pengirimannya gagal, tidak ada yang pernah membersihkannya.
  const jam = setTimeout(() => selesai(false), BATAS_TUNGGU_MS);
  tertunda.set(id, { tindakan, selesai, jam });

  return { id, tindakan, janji };
}

/**
 * Jawab satu permintaan. Mengembalikan false kalau id-nya sudah tidak ada.
 *
 * Id yang tidak ada BUKAN galat: ia berarti permintaannya sudah kedaluwarsa,
 * sudah dijawab, atau gilirannya sudah dihentikan — dan ketiganya wajar
 * terjadi saat tombolnya ditekan terlambat.
 */
export function jawabIzin(id: string, izinkan: boolean): boolean {
  const t = tertunda.get(id);
  if (!t) return false;
  t.selesai(izinkan);
  return true;
}

/**
 * Batalkan permintaan tertentu — dipakai saat gilirannya dihentikan.
 *
 * Dibatalkan berarti TIDAK, sama seperti waktu habis.
 */
export function batalkanIzin(id: string): void {
  tertunda.get(id)?.selesai(false);
}

/** Berapa permintaan yang sedang menunggu. Untuk uji dan pemeriksaan. */
export function jumlahTertunda(): number {
  return tertunda.size;
}
