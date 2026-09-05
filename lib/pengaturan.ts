/**
 * Pengaturan dan ingatan tetap.
 *
 * Dua hal yang dimiliki ChatGPT, Claude, dan OpenClaw, dan tidak ada di
 * Tiburon sampai sekarang:
 *
 *   Instruksi khusus  cara kamu ingin dijawab, berlaku di semua percakapan
 *   Ingatan tetap     fakta tentangmu yang tidak perlu diulang tiap kali
 *
 * Keduanya disimpan di basis data yang SAMA dengan riwayat, bukan di
 * localStorage. Alasannya: keduanya ikut masuk ke prompt yang disusun di
 * SERVER, dan sesuatu yang hanya hidup di browser tidak pernah sampai ke sana.
 *
 * Ingatan di sini sengaja ditulis tangan, bukan disimpulkan sendiri oleh
 * model. Ingatan otomatis yang salah adalah bentuk kesalahan yang paling sulit
 * ditemukan — ia diam-diam mewarnai setiap jawaban berikutnya, dan pemiliknya
 * tidak pernah tahu kenapa. Seluruh proyek ini berdiri di atas jawaban yang
 * bisa diperiksa; ingatan yang tidak bisa dilihat dan dihapus melanggar itu.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { siapkanSkema } from "@/lib/skema";
import { randomUUID } from "node:crypto";

export type Ingatan = { id: string; isi: string; dibuat: number; otomatis?: boolean };

export type Pengaturan = {
  instruksi: string;
  ingatan: Ingatan[];
};

/** Batas panjang instruksi khusus. */
export const BATAS_INSTRUKSI = 2000;
/** Batas panjang satu butir ingatan. */
export const BATAS_INGATAN = 500;
/**
 * Batas jumlah butir ingatan.
 *
 * Bukan angka sembarangan: seluruh ingatan ikut di setiap permintaan, jadi ia
 * memakan jendela konteks yang sama dengan percakapannya sendiri. 50 butir
 * pendek masih di bawah seribu token; membiarkannya tanpa batas berarti suatu
 * hari percakapan berhenti muat tanpa sebab yang terlihat.
 */
export const BATAS_JUMLAH_INGATAN = 50;

export function dbPengaturan(): string {
  return process.env.TIBURON_RIWAYAT_DB ?? path.join(process.cwd(), "data", "riwayat.sqlite");
}

function buka(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  try {
    siapkanSkema(db);
  } catch (e) {
    // Sama seperti di riwayat.ts: handle sudah terbuka sebelum exec gagal,
    // dan tanpa ditutup di sini ia bocor ke pemanggil selamanya.
    db.close();
    throw e;
  }
  return db;
}

export function ambilInstruksi(dbPath = dbPengaturan()): string {
  const db = buka(dbPath);
  try {
    const baris = db.prepare("SELECT nilai FROM pengaturan WHERE kunci = 'instruksi'").get() as
      | { nilai: string }
      | undefined;
    return baris?.nilai ?? "";
  } finally {
    db.close();
  }
}

export function simpanInstruksi(teks: string, dbPath = dbPengaturan()): void {
  const db = buka(dbPath);
  try {
    db.prepare(
      "INSERT INTO pengaturan (kunci, nilai) VALUES ('instruksi', ?) " +
        "ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai",
    ).run(teks.slice(0, BATAS_INSTRUKSI));
  } finally {
    db.close();
  }
}

export function daftarIngatan(dbPath = dbPengaturan()): Ingatan[] {
  const db = buka(dbPath);
  try {
    return db
      .prepare("SELECT id, isi, dibuat, otomatis FROM ingatan ORDER BY dibuat DESC")
      .all()
      .map((r) => {
        const row = r as unknown as {
          id: string;
          isi: string;
          dibuat: number;
          otomatis: number;
        };
        // `otomatis` dijadikan boolean di sini, bukan diteruskan sebagai 0/1:
        // nilai yang berbeda bentuknya antara basis data dan antarmuka adalah
        // tempat bug menumpuk.
        return { id: row.id, isi: row.isi, dibuat: row.dibuat, otomatis: row.otomatis === 1 };
      });
  } finally {
    db.close();
  }
}

/** Tambah satu butir ingatan. Melempar kalau batas jumlahnya sudah tercapai. */
export function tambahIngatan(
  isi: string,
  dbPath = dbPengaturan(),
  otomatis = false,
): Ingatan {
  const bersih = isi.trim().slice(0, BATAS_INGATAN);
  if (!bersih) throw new Error("Ingatan tidak boleh kosong");

  const db = buka(dbPath);
  try {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM ingatan").get() as { n: number };
    if (n >= BATAS_JUMLAH_INGATAN) {
      // Ditolak terus terang, bukan yang paling lama dibuang diam-diam.
      // Membuang sendiri berarti sesuatu yang sengaja diingat bisa lenyap
      // tanpa ada yang memberitahu.
      throw new Error(
        `Ingatan sudah penuh (${BATAS_JUMLAH_INGATAN} butir). Hapus salah satu lebih dulu.`,
      );
    }
    const butir: Ingatan = { id: randomUUID(), isi: bersih, dibuat: Date.now(), otomatis };
    db.prepare("INSERT INTO ingatan (id, isi, dibuat, otomatis) VALUES (?,?,?,?)").run(
      butir.id,
      butir.isi,
      butir.dibuat,
      otomatis ? 1 : 0,
    );
    return butir;
  } finally {
    db.close();
  }
}

/**
 * Sisakan ruang untuk ingatan otomatis baru dengan membuang yang otomatis
 * TERLAMA — dan tidak pernah menyentuh yang ditulis tangan.
 *
 * Tanpa ini, ingatan otomatis berhenti bekerja diam-diam begitu batas 50
 * tercapai: tambahIngatan melempar, pemanggilnya menelan galatnya, dan tidak
 * ada satu pun tanda bahwa ia sudah lama tidak belajar apa-apa lagi.
 */
export function sisakanRuangOtomatis(butuh: number, dbPath = dbPengaturan()): number {
  const db = buka(dbPath);
  try {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM ingatan").get() as { n: number };
    const kelebihan = n + butuh - BATAS_JUMLAH_INGATAN;
    if (kelebihan <= 0) return 0;

    const buang = db
      .prepare("SELECT id FROM ingatan WHERE otomatis = 1 ORDER BY dibuat ASC LIMIT ?")
      .all(kelebihan) as unknown as { id: string }[];
    const hapus = db.prepare("DELETE FROM ingatan WHERE id = ?");
    for (const x of buang) hapus.run(x.id);
    return buang.length;
  } finally {
    db.close();
  }
}

export function hapusIngatan(id: string, dbPath = dbPengaturan()): boolean {
  const db = buka(dbPath);
  try {
    return db.prepare("DELETE FROM ingatan WHERE id = ?").run(id).changes > 0;
  } finally {
    db.close();
  }
}

export function ambilPengaturan(dbPath = dbPengaturan()): Pengaturan {
  return { instruksi: ambilInstruksi(dbPath), ingatan: daftarIngatan(dbPath) };
}
