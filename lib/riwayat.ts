/**
 * Riwayat percakapan, SQLite lokal.
 *
 * Gateway OpenClaw TIDAK menyimpan riwayat — diuji 2026-09-03: pesan kedua
 * tidak mengingat pesan pertama. Jadi aplikasi yang menyimpannya.
 *
 * Kolom `pemilik` sengaja ada sejak awal walau selalu kosong sekarang.
 * Menambah kolom pada tabel yang sudah berisi data jauh lebih mahal daripada
 * menyiapkannya di awal.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Pesan } from "@/lib/penyedia";

export type RingkasanPercakapan = { id: string; judul: string; diperbarui: number };

export function dbRiwayat(): string {
  return process.env.TIBURON_RIWAYAT_DB ?? path.join(process.cwd(), "data", "riwayat.sqlite");
}

function buka(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS percakapan (
        id TEXT PRIMARY KEY,
        judul TEXT NOT NULL,
        pemilik TEXT NOT NULL DEFAULT '',
        dibuat INTEGER NOT NULL,
        diperbarui INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pesan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        percakapan_id TEXT NOT NULL,
        peran TEXT NOT NULL,
        isi TEXT NOT NULL,
        waktu INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pesan_percakapan ON pesan(percakapan_id, id);
    `);
  } catch (e) {
    // Handle sudah terbuka (new DatabaseSync berhasil) sebelum exec gagal.
    // Tanpa menutupnya di sini, handle itu bocor ke pemanggil dan tidak
    // pernah bisa ditutup siapa pun — lihat uji "tidak membocorkan koneksi
    // ketika pembuatan tabel gagal". Galatnya tetap naik: ini memperbaiki
    // kebocorannya, bukan menyembunyikan kegagalannya.
    db.close();
    throw e;
  }
  return db;
}

export function buatPercakapan(judul: string, dbPath = dbRiwayat()): string {
  const db = buka(dbPath);
  try {
    const id = randomUUID();
    const now = Date.now();
    db.prepare("INSERT INTO percakapan (id, judul, dibuat, diperbarui) VALUES (?,?,?,?)")
      .run(id, judul, now, now);
    return id;
  } finally {
    db.close();
  }
}

export function tambahPesan(id: string, pesan: Pesan, dbPath = dbRiwayat()): void {
  const db = buka(dbPath);
  try {
    const now = Date.now();
    db.prepare("INSERT INTO pesan (percakapan_id, peran, isi, waktu) VALUES (?,?,?,?)")
      .run(id, pesan.role, pesan.content, now);
    db.prepare("UPDATE percakapan SET diperbarui = ? WHERE id = ?").run(now, id);
  } finally {
    db.close();
  }
}

export function ambilPercakapan(id: string, dbPath = dbRiwayat()): Pesan[] {
  const db = buka(dbPath);
  try {
    return db.prepare("SELECT peran, isi FROM pesan WHERE percakapan_id = ? ORDER BY id")
      .all(id)
      .map((r) => {
        const row = r as { peran: string; isi: string };
        return { role: row.peran as Pesan["role"], content: row.isi };
      });
  } finally {
    db.close();
  }
}

/**
 * Ganti judul percakapan.
 *
 * `diperbarui` SENGAJA tidak disentuh. Kolom itu artinya "kapan terakhir ada
 * percakapan di sini", dan itulah yang mengurutkan sidebar. Kalau mengganti
 * nama ikut memperbaruinya, merapikan judul obrolan lama akan melemparnya ke
 * puncak daftar seolah baru saja dipakai.
 */
export function gantiJudul(id: string, judul: string, dbPath = dbRiwayat()): boolean {
  const db = buka(dbPath);
  try {
    const hasil = db.prepare("UPDATE percakapan SET judul = ? WHERE id = ?").run(judul, id);
    return hasil.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * Hapus percakapan beserta seluruh pesannya.
 *
 * Pesan dihapus lebih dulu, dalam satu transaksi. Tanpa transaksi, gagal di
 * tengah jalan meninggalkan pesan yatim yang tidak dimiliki percakapan mana
 * pun — tak terlihat di antarmuka, tapi terus menumpuk di basis data.
 *
 * Tidak ada FOREIGN KEY di skema ini, jadi SQLite tidak akan merapikannya
 * sendiri; harus dilakukan di sini.
 */
export function hapusPercakapan(id: string, dbPath = dbRiwayat()): boolean {
  const db = buka(dbPath);
  try {
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM pesan WHERE percakapan_id = ?").run(id);
      const hasil = db.prepare("DELETE FROM percakapan WHERE id = ?").run(id);
      db.exec("COMMIT");
      return hasil.changes > 0;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  } finally {
    db.close();
  }
}

export function daftarPercakapan(dbPath = dbRiwayat()): RingkasanPercakapan[] {
  const db = buka(dbPath);
  try {
    // Tie-breaker `rowid DESC`: `diperbarui` berasal dari Date.now(), yang
    // beresolusi milidetik — dua percakapan bisa punya nilai yang identik.
    // Tabel `percakapan` bukan WITHOUT ROWID (PK-nya TEXT, bukan INTEGER),
    // jadi kolom rowid bawaan tetap ada dan naik sesuai urutan penyisipan.
    // Tanpa ini, urutan SQLite untuk nilai `diperbarui` yang seri tidak
    // dijamin — lihat uji "terbaru di atas walau diperbarui sama persis".
    return db.prepare("SELECT id, judul, diperbarui FROM percakapan ORDER BY diperbarui DESC, rowid DESC")
      .all()
      .map((r) => r as RingkasanPercakapan);
  } finally {
    db.close();
  }
}
