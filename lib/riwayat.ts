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

export function daftarPercakapan(dbPath = dbRiwayat()): RingkasanPercakapan[] {
  const db = buka(dbPath);
  try {
    return db.prepare("SELECT id, judul, diperbarui FROM percakapan ORDER BY diperbarui DESC")
      .all()
      .map((r) => r as RingkasanPercakapan);
  } finally {
    db.close();
  }
}
