/**
 * Membaca indeks korpus yang DIBANGUN OpenClaw, langsung dari berkas SQLite-nya.
 *
 * Kenapa tidak lewat memory_search OpenClaw: diukur 2026-09-03, memory_search
 * memakan ~40 detik karena tiap pencarian memicu sinkronisasi ulang seluruh
 * korpus. Membaca berkasnya langsung: 0,5 milidetik.
 *
 * Harganya adalah kopling ke internal aplikasi lain, dan itu nyata: skema
 * OpenClaw pernah berubah diam-diam saat upgrade 2026.8.2 dan membuang
 * `memorySearch` tanpa peringatan. Karena itu periksaSkema() WAJIB dipanggil
 * sebelum percaya pada hasil cari(), dan pemanggil wajib punya jalan mundur.
 */
import { konfigurasi } from "@/lib/konfigurasi";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type PotonganKorpus = { path: string; teks: string; skor: number };
export type HasilSkema = { cocok: boolean; alasan?: string };

const TABEL_WAJIB = ["memory_index_chunks", "memory_index_chunks_fts", "memory_index_meta"];

export function dbBawaan(): string {
  return konfigurasi().korpusDb;
}

function buka(dbPath: string): DatabaseSync {
  return new DatabaseSync(dbPath, { readOnly: true });
}

export function periksaSkema(dbPath = dbBawaan()): HasilSkema {
  if (!fs.existsSync(dbPath)) {
    return { cocok: false, alasan: `Berkas indeks tidak ditemukan: ${dbPath}` };
  }
  let db: DatabaseSync;
  try {
    db = buka(dbPath);
  } catch (e) {
    return { cocok: false, alasan: `Tidak bisa membuka indeks: ${(e as Error).message}` };
  }
  try {
    const ada = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view')")
        .all()
        .map((r) => String((r as { name: string }).name)),
    );
    const hilang = TABEL_WAJIB.filter((t) => !ada.has(t));
    if (hilang.length) {
      return {
        cocok: false,
        alasan: `Skema OpenClaw berubah — tabel hilang: ${hilang.join(", ")}`,
      };
    }
    return { cocok: true };
  } catch (e) {
    return { cocok: false, alasan: `Gagal membaca skema: ${(e as Error).message}` };
  } finally {
    db.close();
  }
}

/**
 * FTS5 memperlakukan tanda kutip, tanda kurung, dan operator sebagai sintaks.
 * Kueri dari pengguna adalah teks biasa, jadi tiap kata dibungkus kutip ganda
 * dan digabung dengan OR. Tanpa ini, pertanyaan berisi tanda kutip melempar
 * "fts5: syntax error".
 */
function kueriAman(kueri: string): string {
  const kata = kueri
    .split(/\s+/)
    .map((k) => k.replace(/["*()]/g, "").trim())
    .filter((k) => k.length > 1);
  if (!kata.length) return '""';
  return kata.map((k) => `"${k}"`).join(" OR ");
}

/**
 * Diukur langsung dari node:sqlite (2026-09-03): meski kueriAman() membungkus
 * tiap kata dalam kutip ganda dan membuang " * ( ), FTS5 masih bisa melempar
 * galat sintaks murni — byte nol (\0) di tengah kata lolos dari penyaringan
 * dan membuat FTS5 melempar "unterminated string" persis seperti kutip yang
 * benar-benar tak tertutup. Galat sintaks parser FTS5 "sungguhan" (dipicu
 * lewat kueri mentah, di luar kueriAman) berbunyi `fts5: syntax error near
 * "..."`. Keduanya punya errcode SQLite yang SAMA (1, "SQL logic error")
 * dengan galat skema seperti tabel hilang — jadi satu-satunya pembeda yang
 * bisa diandalkan adalah teks pesannya, bukan kodenya.
 */
function galatSintaksFts(e: unknown): boolean {
  const pesan = e instanceof Error ? e.message : "";
  return pesan === "unterminated string" || pesan.startsWith("fts5: syntax error");
}

export function cari(kueri: string, batas = 8, dbPath = dbBawaan()): PotonganKorpus[] {
  const db = buka(dbPath);
  try {
    const rows = db.prepare(
      `SELECT path, text AS teks, bm25(memory_index_chunks_fts) AS skor
       FROM memory_index_chunks_fts
       WHERE memory_index_chunks_fts MATCH ?
       ORDER BY skor
       LIMIT ?`,
    ).all(kueriAman(kueri), batas);
    return rows.map((r) => {
      const row = r as { path: string; teks: string; skor: number };
      return { path: row.path, teks: row.teks, skor: row.skor };
    });
  } catch (e) {
    // HANYA galat sintaks FTS murni (lihat galatSintaksFts di atas) yang jadi [].
    // Tabel hilang ("no such table: ..." — skema OpenClaw berubah), berkas korup
    // ("file is not a database"), dan galat I/O lain WAJIB naik ke pemanggil:
    // itu bukan "tidak ada hasil", itu kegagalan yang harus terlihat.
    if (galatSintaksFts(e)) {
      return [];
    }
    throw e;
  } finally {
    db.close();
  }
}

export function daftarBerkas(dbPath = dbBawaan()): { path: string; potongan: number }[] {
  const db = buka(dbPath);
  try {
    return db.prepare(
      `SELECT path, COUNT(*) AS potongan FROM memory_index_chunks
       GROUP BY path ORDER BY potongan DESC`,
    ).all().map((r) => {
      const row = r as { path: string; potongan: number };
      return { path: row.path, potongan: row.potongan };
    });
  } finally {
    db.close();
  }
}
