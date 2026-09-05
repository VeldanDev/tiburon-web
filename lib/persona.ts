/**
 * Persona — beberapa "siapa" untuk satu Tiburon.
 *
 * Gagasannya diambil dari Hermes, yang menyebut berkas jiwanya sebagai "blok
 * pembangun paling penting": satu dokumen yang mendefinisikan kepribadian
 * asisten, dan bisa diganti seluruhnya tergantung pekerjaan apa yang sedang
 * dikerjakan. Di Hermes ini disebut Pantheon — beberapa persona bernama,
 * masing-masing dengan prompt dan model orkestratornya sendiri.
 *
 * BEDANYA DARI TIGA HAL YANG SUDAH ADA DI TIBURON, dan kenapa ia bukan
 * duplikat salah satunya:
 *
 *   Instruksi khusus  cara kamu ingin dijawab. Berlaku SELALU, di semua
 *                     persona — ia tentang kamu, bukan tentang dia.
 *   Ingatan           fakta tentangmu. Juga selalu, juga tentang kamu.
 *   Proyek            pengelompokan percakapan dengan instruksi tambahan.
 *                     Tentang PEKERJAANNYA, bukan tentang siapa yang bicara.
 *   Persona           siapa yang menjawab, dan dengan model apa.
 *
 * Persona bisa mengganti rantai model. Itu bukan hiasan: persona "peninjau
 * ketat" yang memakai model kecil akan gagal memenuhi janjinya sendiri, dan
 * memisahkan keduanya berarti pengguna harus mengingat pasangan yang benar
 * setiap kali.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { siapkanSkema } from "@/lib/skema";

export type Persona = {
  id: string;
  nama: string;
  /**
   * "Jiwa" — menggantikan persona bawaan di prompt sistem.
   *
   * Disebut jiwa, bukan instruksi, supaya bedanya dari "Instruksi khusus"
   * terbaca dari namanya sendiri: yang satu mendefinisikan lawan bicaramu,
   * yang satu mengatur cara ia menjawabmu.
   */
  jiwa: string;
  /** Rantai model khusus persona ini. Kosong berarti ikut rantai bawaan. */
  rantai: string[];
  dibuat: number;
};

/**
 * Batas jiwa: 1.500 karakter.
 *
 * Angkanya mengikuti alasan Hermes, bukan angkanya: di sana `user.md` dibatasi
 * 1.375 karakter DENGAN SENGAJA, supaya penulisnya dipaksa menyaring hal yang
 * benar-benar penting alih-alih menumpuk semuanya. Batas itu bukan
 * keterbatasan teknis — ia fitur.
 *
 * Teks ini ikut di SETIAP permintaan pada persona itu, jadi tiap barisnya
 * dibayar tiap kali. Prompt sistem yang membengkak juga menenggelamkan
 * bagian yang benar-benar penting di antara basa-basi.
 */
export const BATAS_JIWA = 1500;

/** Persona sebanyak apa pun tidak menolong kalau tidak ada yang ingat isinya. */
export const BATAS_JUMLAH_PERSONA = 12;

export function dbPersona(): string {
  return process.env.TIBURON_RIWAYAT_DB ?? path.join(process.cwd(), "data", "riwayat.sqlite");
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

function bentuk(r: unknown): Persona {
  const row = r as { id: string; nama: string; jiwa: string; rantai: string; dibuat: number };
  return {
    id: row.id,
    nama: row.nama,
    jiwa: row.jiwa,
    // Disimpan sebagai teks dipisah baris, bukan JSON: kolom ini disunting
    // manusia lewat kotak teks, dan JSON yang rusak sedikit saja akan
    // menghilangkan seluruh rantainya tanpa pesan apa pun.
    rantai: row.rantai
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    dibuat: row.dibuat,
  };
}

export function daftarPersona(dbPath = dbPersona()): Persona[] {
  const db = buka(dbPath);
  try {
    return db
      .prepare("SELECT id, nama, jiwa, rantai, dibuat FROM persona ORDER BY dibuat")
      .all()
      .map(bentuk);
  } finally {
    db.close();
  }
}

export function ambilPersona(id: string, dbPath = dbPersona()): Persona | null {
  const db = buka(dbPath);
  try {
    const r = db
      .prepare("SELECT id, nama, jiwa, rantai, dibuat FROM persona WHERE id = ?")
      .get(id);
    return r ? bentuk(r) : null;
  } finally {
    db.close();
  }
}

export function buatPersona(
  nama: string,
  jiwa: string,
  rantai: string[] = [],
  dbPath = dbPersona(),
): Persona {
  const bersihNama = nama.trim();
  if (!bersihNama) throw new Error("Persona butuh nama.");
  if (jiwa.length > BATAS_JIWA) {
    throw new Error(`Jiwa maksimal ${BATAS_JIWA} karakter.`);
  }

  const db = buka(dbPath);
  try {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM persona").get() as { n: number };
    // MENOLAK, bukan membuang yang terlama. Persona dibuat dengan susah payah
    // dan dipakai berbulan-bulan; membuangnya diam-diam untuk memberi ruang
    // adalah kehilangan yang tidak akan pernah diketahui pemiliknya.
    if (n >= BATAS_JUMLAH_PERSONA) {
      throw new Error(
        `Persona sudah ${BATAS_JUMLAH_PERSONA}. Hapus salah satu lebih dulu.`,
      );
    }

    const id = randomUUID();
    const dibuat = Date.now();
    db.prepare("INSERT INTO persona (id, nama, jiwa, rantai, dibuat) VALUES (?,?,?,?,?)")
      .run(id, bersihNama, jiwa, rantai.join("\n"), dibuat);
    return { id, nama: bersihNama, jiwa, rantai, dibuat };
  } finally {
    db.close();
  }
}

export function ubahPersona(
  id: string,
  ubah: { nama?: string; jiwa?: string; rantai?: string[] },
  dbPath = dbPersona(),
): boolean {
  if (ubah.jiwa !== undefined && ubah.jiwa.length > BATAS_JIWA) {
    throw new Error(`Jiwa maksimal ${BATAS_JIWA} karakter.`);
  }
  if (ubah.nama !== undefined && !ubah.nama.trim()) {
    throw new Error("Persona butuh nama.");
  }

  const db = buka(dbPath);
  try {
    const lama = db.prepare("SELECT nama, jiwa, rantai FROM persona WHERE id = ?").get(id) as
      | { nama: string; jiwa: string; rantai: string }
      | undefined;
    if (!lama) return false;

    // Medan yang TIDAK dikirim dibiarkan apa adanya. Menyimpan undefined akan
    // mengosongkan jiwa sebuah persona hanya karena penyuntingnya cuma
    // mengganti namanya.
    const hasil = db
      .prepare("UPDATE persona SET nama = ?, jiwa = ?, rantai = ? WHERE id = ?")
      .run(
        ubah.nama?.trim() ?? lama.nama,
        ubah.jiwa ?? lama.jiwa,
        ubah.rantai ? ubah.rantai.join("\n") : lama.rantai,
        id,
      );
    return hasil.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * Hapus persona, dan LEPASKAN percakapan yang memakainya.
 *
 * Aturan yang sama seperti menghapus proyek: percakapannya tidak ikut
 * terhapus. Persona adalah cara menjawab, bukan pemilik percakapannya —
 * membuang riwayat sungguhan karena sebuah pengaturan dihapus adalah
 * kehilangan yang tidak sepadan dengan kerapian apa pun.
 */
export function hapusPersona(id: string, dbPath = dbPersona()): boolean {
  const db = buka(dbPath);
  try {
    db.exec("BEGIN");
    try {
      db.prepare("UPDATE percakapan SET persona_id = NULL WHERE persona_id = ?").run(id);
      const hasil = db.prepare("DELETE FROM persona WHERE id = ?").run(id);
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

/** Setel persona sebuah percakapan. `null` mengembalikannya ke persona bawaan. */
export function setPersonaPercakapan(
  percakapanId: string,
  personaId: string | null,
  dbPath = dbPersona(),
): boolean {
  const db = buka(dbPath);
  try {
    const hasil = db
      .prepare("UPDATE percakapan SET persona_id = ? WHERE id = ?")
      .run(personaId, percakapanId);
    return hasil.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * Persona yang berlaku untuk sebuah percakapan, dibaca DI SERVER.
 *
 * Sama seperti instruksi dan ingatan: klien mengirim id percakapannya saja,
 * tidak pernah isi promptnya. Kalau browser yang memasok isi prompt sistem,
 * siapa pun yang bisa memanggil rutenya bisa menyisipkan apa pun ke dalamnya.
 */
export function personaPercakapan(
  percakapanId: string | null | undefined,
  dbPath = dbPersona(),
): Persona | null {
  if (!percakapanId) return null;
  const db = buka(dbPath);
  try {
    const r = db
      .prepare(
        `SELECT p.id, p.nama, p.jiwa, p.rantai, p.dibuat
           FROM percakapan c JOIN persona p ON p.id = c.persona_id
          WHERE c.id = ?`,
      )
      .get(percakapanId);
    return r ? bentuk(r) : null;
  } finally {
    db.close();
  }
}
