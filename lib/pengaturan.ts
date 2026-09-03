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
import { randomUUID } from "node:crypto";

export type Ingatan = { id: string; isi: string; dibuat: number };

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
    db.exec(`
      CREATE TABLE IF NOT EXISTS pengaturan (
        kunci TEXT PRIMARY KEY,
        nilai TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ingatan (
        id TEXT PRIMARY KEY,
        isi TEXT NOT NULL,
        pemilik TEXT NOT NULL DEFAULT '',
        dibuat INTEGER NOT NULL
      );
    `);
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
      .prepare("SELECT id, isi, dibuat FROM ingatan ORDER BY dibuat DESC")
      .all()
      .map((r) => r as Ingatan);
  } finally {
    db.close();
  }
}

/** Tambah satu butir ingatan. Melempar kalau batas jumlahnya sudah tercapai. */
export function tambahIngatan(isi: string, dbPath = dbPengaturan()): Ingatan {
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
    const butir: Ingatan = { id: randomUUID(), isi: bersih, dibuat: Date.now() };
    db.prepare("INSERT INTO ingatan (id, isi, dibuat) VALUES (?,?,?)").run(
      butir.id,
      butir.isi,
      butir.dibuat,
    );
    return butir;
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
