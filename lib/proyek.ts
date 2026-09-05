/**
 * Proyek — wadah untuk percakapan yang membahas hal yang sama.
 *
 * Gagasan dari Projects milik Claude, tapi bagian yang benar-benar berharga
 * di sana bukan pengelompokannya: itu cuma folder. Yang berharga adalah
 * INSTRUKSI PER PROYEK — konteks yang selalu berlaku untuk pekerjaan ini dan
 * tidak berlaku untuk yang lain, sehingga tidak perlu diketik ulang di setiap
 * percakapan baru.
 *
 * Contohnya persis kebutuhan Veldan: percakapan tentang radar butuh tahu
 * bahwa skripnya Python di D:\Downloads\Tiburon\radar, sedangkan percakapan
 * tentang Tiburon sendiri butuh tahu ini Next.js dengan node:sqlite. Menaruh
 * keduanya di instruksi global berarti setiap percakapan membawa konteks
 * setengahnya tidak relevan.
 */
import { konfigurasi } from "@/lib/konfigurasi";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { siapkanSkema } from "@/lib/skema";
import { randomUUID } from "node:crypto";

export type Proyek = {
  id: string;
  nama: string;
  instruksi: string;
  dibuat: number;
  /** Jumlah percakapan di dalamnya. Dihitung saat mendaftar, tidak disimpan —
   *  angka tersimpan yang lupa diperbarui adalah angka yang berbohong. */
  jumlah: number;
};

export const BATAS_INSTRUKSI_PROYEK = 4000;

export function dbProyek(): string {
  return konfigurasi().riwayatDb;
}

function buka(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  try {
    siapkanSkema(db);
  } catch (e) {
    db.close();
    throw e;
  }
  return db;
}

export function daftarProyek(dbPath = dbProyek()): Proyek[] {
  const db = buka(dbPath);
  try {
    return db
      .prepare(
        `SELECT p.id, p.nama, p.instruksi, p.dibuat,
                (SELECT COUNT(*) FROM percakapan c WHERE c.proyek_id = p.id) AS jumlah
         FROM proyek p ORDER BY p.dibuat DESC`,
      )
      .all()
      .map((r) => r as Proyek);
  } finally {
    db.close();
  }
}

export function buatProyek(nama: string, dbPath = dbProyek()): Proyek {
  const bersih = nama.trim().slice(0, 80);
  if (!bersih) throw new Error("Nama proyek tidak boleh kosong");

  const db = buka(dbPath);
  try {
    const proyek: Proyek = {
      id: randomUUID(),
      nama: bersih,
      instruksi: "",
      dibuat: Date.now(),
      jumlah: 0,
    };
    db.prepare("INSERT INTO proyek (id, nama, instruksi, dibuat) VALUES (?,?,'',?)").run(
      proyek.id,
      proyek.nama,
      proyek.dibuat,
    );
    return proyek;
  } finally {
    db.close();
  }
}

export function ubahProyek(
  id: string,
  ubah: { nama?: string; instruksi?: string },
  dbPath = dbProyek(),
): boolean {
  const db = buka(dbPath);
  try {
    const bagian: string[] = [];
    const nilai: string[] = [];
    if (typeof ubah.nama === "string" && ubah.nama.trim()) {
      bagian.push("nama = ?");
      nilai.push(ubah.nama.trim().slice(0, 80));
    }
    // Instruksi kosong SAH — itulah cara mengosongkannya. Karena itu yang
    // diperiksa `typeof`, bukan kebenarannya.
    if (typeof ubah.instruksi === "string") {
      bagian.push("instruksi = ?");
      nilai.push(ubah.instruksi.slice(0, BATAS_INSTRUKSI_PROYEK));
    }
    if (bagian.length === 0) return false;

    return (
      db.prepare(`UPDATE proyek SET ${bagian.join(", ")} WHERE id = ?`).run(...nilai, id)
        .changes > 0
    );
  } finally {
    db.close();
  }
}

/**
 * Hapus proyek — percakapan di dalamnya DILEPASKAN, bukan ikut terhapus.
 *
 * Ini pilihan yang disengaja dan bukan yang paling mudah. Menghapus folder
 * yang ikut membawa isinya adalah cara paling cepat kehilangan pekerjaan
 * berbulan-bulan karena satu klik, dan percakapan yang kehilangan proyeknya
 * masih sepenuhnya berguna — ia cuma kembali ke daftar umum.
 */
export function hapusProyek(id: string, dbPath = dbProyek()): boolean {
  const db = buka(dbPath);
  try {
    db.exec("BEGIN");
    try {
      db.prepare("UPDATE percakapan SET proyek_id = NULL WHERE proyek_id = ?").run(id);
      const hasil = db.prepare("DELETE FROM proyek WHERE id = ?").run(id);
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

/** Pindahkan percakapan ke proyek, atau keluarkan dengan `null`. */
export function pindahkan(percakapanId: string, proyekId: string | null, dbPath = dbProyek()): boolean {
  const db = buka(dbPath);
  try {
    return (
      db.prepare("UPDATE percakapan SET proyek_id = ? WHERE id = ?").run(proyekId, percakapanId)
        .changes > 0
    );
  } finally {
    db.close();
  }
}

/** Instruksi proyek yang memiliki satu percakapan, untuk disisipkan ke prompt. */
export function instruksiUntukPercakapan(
  percakapanId: string,
  dbPath = dbProyek(),
): string {
  const db = buka(dbPath);
  try {
    const baris = db
      .prepare(
        `SELECT p.instruksi FROM proyek p
         JOIN percakapan c ON c.proyek_id = p.id
         WHERE c.id = ?`,
      )
      .get(percakapanId) as { instruksi: string } | undefined;
    return baris?.instruksi ?? "";
  } finally {
    db.close();
  }
}
