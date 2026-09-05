/**
 * Skema basis data Tiburon — SATU tempat, dipakai semua modul.
 *
 * Sebelumnya tiap modul membuat tabelnya sendiri lewat CREATE TABLE IF NOT
 * EXISTS. Itu berjalan sampai dua modul menyentuh tabel yang sama: modul mana
 * yang kebetulan dibuka lebih dulu menentukan bentuk tabelnya, dan modul yang
 * kalah cepat memakai tabel tanpa kolom yang ia butuhkan. Bug seperti itu
 * hanya muncul pada basis data BARU, dalam urutan pemanggilan tertentu — jenis
 * kegagalan yang paling sulit dilacak.
 *
 * Migrasi di sini ADITIF saja: menambah tabel dan menambah kolom, tidak pernah
 * menghapus atau mengubah tipe. Basis data Veldan sudah berisi percakapan
 * sungguhan, dan migrasi yang bisa kehilangan data tidak sepadan dengan
 * kerapian apa pun.
 */
import type { DatabaseSync } from "node:sqlite";

/** Kolom yang ditambahkan setelah tabelnya sudah dipakai di dunia nyata. */
const TAMBAHAN: { tabel: string; kolom: string; definisi: string }[] = [
  { tabel: "percakapan", kolom: "disemat", definisi: "INTEGER NOT NULL DEFAULT 0" },
  { tabel: "percakapan", kolom: "proyek_id", definisi: "TEXT" },
  // NULL berarti "tidak tercatat", bukan "tidak ada model". Seluruh pesan
  // yang sudah ada sebelum kolom ini bernilai NULL, dan statistik model
  // harus menghitungnya sebagai tidak diketahui -- bukan mengarangnya.
  { tabel: "pesan", kolom: "model", definisi: "TEXT" },
  { tabel: "percakapan", kolom: "persona_id", definisi: "TEXT" },
];

export function siapkanSkema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS percakapan (
      id TEXT PRIMARY KEY,
      judul TEXT NOT NULL,
      pemilik TEXT NOT NULL DEFAULT '',
      dibuat INTEGER NOT NULL,
      diperbarui INTEGER NOT NULL,
      disemat INTEGER NOT NULL DEFAULT 0,
      proyek_id TEXT,
      persona_id TEXT
    );

    CREATE TABLE IF NOT EXISTS pesan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      percakapan_id TEXT NOT NULL,
      peran TEXT NOT NULL,
      isi TEXT NOT NULL,
      waktu INTEGER NOT NULL,
      model TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pesan_percakapan ON pesan(percakapan_id, id);

    CREATE TABLE IF NOT EXISTS persona (
      id TEXT PRIMARY KEY,
      nama TEXT NOT NULL,
      jiwa TEXT NOT NULL DEFAULT '',
      -- Rantai model disimpan sebagai teks dipisah baris, bukan JSON: kolom
      -- ini berasal dari kotak teks yang disunting manusia, dan JSON yang
      -- rusak sedikit saja menghilangkan seluruh rantainya tanpa pesan.
      rantai TEXT NOT NULL DEFAULT '',
      pemilik TEXT NOT NULL DEFAULT '',
      dibuat INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proyek (
      id TEXT PRIMARY KEY,
      nama TEXT NOT NULL,
      instruksi TEXT NOT NULL DEFAULT '',
      pemilik TEXT NOT NULL DEFAULT '',
      dibuat INTEGER NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS sumber_terpakai (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      berkas TEXT NOT NULL,
      kueri TEXT NOT NULL,
      pemilik TEXT NOT NULL DEFAULT '',
      waktu INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sumber_berkas ON sumber_terpakai(berkas, waktu);
  `);

  // Basis data yang dibuat sebelum kolom-kolom ini ada tidak tersentuh oleh
  // CREATE TABLE IF NOT EXISTS di atas — ia melihat tabelnya sudah ada dan
  // berhenti. Kolomnya harus ditambahkan sendiri.
  for (const t of TAMBAHAN) {
    const kolom = db.prepare(`PRAGMA table_info(${t.tabel})`).all() as { name: string }[];
    if (kolom.length > 0 && !kolom.some((k) => k.name === t.kolom)) {
      db.exec(`ALTER TABLE ${t.tabel} ADD COLUMN ${t.kolom} ${t.definisi}`);
    }
  }
}
