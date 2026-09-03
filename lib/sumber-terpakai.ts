/**
 * Catatan berkas korpus mana yang benar-benar pernah menjawab.
 *
 * Korpus Veldan berisi 164 berkas. Sampai sekarang tidak ada cara tahu mana
 * yang benar-benar terpakai dan mana yang cuma menumpuk — dan itu pertanyaan
 * yang menentukan: materi apa yang layak ditambah, dan mana yang ternyata
 * tidak pernah relevan dengan apa yang dia kerjakan.
 *
 * Ditulis ke basis data milik aplikasi ini sendiri (baca-tulis), BUKAN ke
 * berkas OpenClaw yang selalu dibuka readOnly.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

export type RingkasanSumber = {
  berkas: string;
  jumlah: number;
  terakhirMs: number;
  contohKueri: string;
};

export function dbSumber(): string {
  return process.env.TIBURON_RIWAYAT_DB ?? path.join(process.cwd(), "data", "riwayat.sqlite");
}

function buka(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sumber_terpakai (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        berkas TEXT NOT NULL,
        kueri TEXT NOT NULL,
        pemilik TEXT NOT NULL DEFAULT '',
        waktu INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sumber_berkas ON sumber_terpakai(berkas, waktu);
    `);
  } catch (e) {
    // Handle sudah terbuka sebelum exec gagal; tanpa ini ia bocor ke pemanggil.
    db.close();
    throw e;
  }
  return db;
}

/** Catat satu jawaban: berkas apa saja yang dipakai, untuk pertanyaan apa. */
export function catatSumber(berkas: string[], kueri: string, dbPath = dbSumber()): void {
  if (berkas.length === 0) return;
  const db = buka(dbPath);
  try {
    const now = Date.now();
    const sisip = db.prepare(
      "INSERT INTO sumber_terpakai (berkas, kueri, waktu) VALUES (?,?,?)",
    );
    for (const b of berkas) sisip.run(b, kueri.slice(0, 300), now);
  } finally {
    db.close();
  }
}

/** Ringkasan per berkas, terbanyak dipakai lebih dulu. */
export function ringkasSumber(dbPath = dbSumber()): RingkasanSumber[] {
  const db = buka(dbPath);
  try {
    return db
      .prepare(
        `SELECT berkas,
                COUNT(*)      AS jumlah,
                MAX(waktu)    AS terakhir,
                (SELECT kueri FROM sumber_terpakai s2
                  WHERE s2.berkas = s1.berkas
                  ORDER BY s2.waktu DESC LIMIT 1) AS contoh
         FROM sumber_terpakai s1
         GROUP BY berkas
         ORDER BY jumlah DESC, terakhir DESC`,
      )
      .all()
      .map((r) => {
        const row = r as { berkas: string; jumlah: number; terakhir: number; contoh: string };
        return {
          berkas: row.berkas,
          jumlah: row.jumlah,
          terakhirMs: row.terakhir,
          contohKueri: row.contoh ?? "",
        };
      });
  } finally {
    db.close();
  }
}
