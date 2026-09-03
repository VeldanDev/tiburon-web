/**
 * Sematkan, cari, dan migrasi kolom.
 *
 * Uji migrasi di bawah adalah yang paling penting di berkas ini: Veldan sudah
 * punya basis data riwayat yang dibuat SEBELUM kolom `disemat` ada. CREATE
 * TABLE IF NOT EXISTS tidak menyentuh tabel yang sudah ada, jadi tanpa ALTER
 * TABLE setiap kueri yang menyebut `disemat` akan gagal di basis datanya —
 * bukan di basis data uji yang selalu dibuat baru.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  buatPercakapan,
  tambahPesan,
  daftarPercakapan,
  setSemat,
  cariPercakapan,
} from "@/lib/riwayat";

let db: string;
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tiburon-lanjut-"));
  db = path.join(dir, "riwayat.sqlite");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("sematkan", () => {
  it("menaruh yang disemat di atas walau lebih tua", async () => {
    const tua = buatPercakapan("Yang tua", db);
    await new Promise((r) => setTimeout(r, 2));
    buatPercakapan("Yang baru", db);

    expect(daftarPercakapan(db)[0].judul).toBe("Yang baru");
    setSemat(tua, true, db);
    expect(daftarPercakapan(db)[0].judul).toBe("Yang tua");
    expect(daftarPercakapan(db)[0].disemat).toBe(true);
  });

  it("mengembalikan boolean, bukan 0/1 dari SQLite", () => {
    buatPercakapan("Biasa", db);
    expect(daftarPercakapan(db)[0].disemat).toBe(false);
  });

  it("menyematkan tidak mengubah urutan waktu percakapan lain", async () => {
    const a = buatPercakapan("A", db);
    await new Promise((r) => setTimeout(r, 2));
    const b = buatPercakapan("B", db);
    const sebelum = daftarPercakapan(db).find((p) => p.id === a)!.diperbarui;
    setSemat(a, true, db);
    expect(daftarPercakapan(db).find((p) => p.id === a)!.diperbarui).toBe(sebelum);
    expect(daftarPercakapan(db).find((p) => p.id === b)).toBeTruthy();
  });

  it("membalas false untuk id yang tidak ada", () => {
    expect(setSemat("hantu", true, db)).toBe(false);
  });
});

describe("cari percakapan", () => {
  it("menemukan lewat judul dan lewat isi pesan", () => {
    const id = buatPercakapan("Arsitektur radar", db);
    tambahPesan(id, { role: "user", content: "bagaimana FTS5 mengindeks korpus" }, db);

    expect(cariPercakapan("radar", db)).toHaveLength(1);
    expect(cariPercakapan("FTS5", db)).toHaveLength(1);
    expect(cariPercakapan("tidak ada ini", db)).toHaveLength(0);
  });

  it("mengembalikan cuplikan DI SEKITAR kata yang dicari, bukan awal pesan", () => {
    const id = buatPercakapan("Panjang", db);
    tambahPesan(
      id,
      { role: "user", content: "x".repeat(2000) + " JARUMNYA " + "y".repeat(2000) },
      db,
    );
    const [hasil] = cariPercakapan("JARUMNYA", db);
    expect(hasil.cuplikan).toContain("JARUMNYA");
    // Kalau cuplikannya cuma slice(0, n), ia akan berisi x saja tanpa jarumnya.
    expect(hasil.cuplikan.length).toBeLessThan(300);
  });

  it("mengabaikan kueri yang terlalu pendek", () => {
    buatPercakapan("Apa saja", db);
    expect(cariPercakapan("a", db)).toEqual([]);
    expect(cariPercakapan("  ", db)).toEqual([]);
  });

  // Tanpa ESCAPE, "%" dan "_" jadi wildcard LIKE: mencari "100%" akan cocok
  // dengan SEMUA percakapan yang memuat "100", dan "a_b" dengan "axb".
  it("memperlakukan % dan _ sebagai teks biasa, bukan wildcard", () => {
    buatPercakapan("Diskon 100% hari ini", db);
    buatPercakapan("Angka 100 saja", db);
    expect(cariPercakapan("100%", db)).toHaveLength(1);

    buatPercakapan("nama_berkas", db);
    buatPercakapan("namaXberkas", db);
    expect(cariPercakapan("nama_berkas", db)).toHaveLength(1);
  });
});

describe("migrasi kolom disemat", () => {
  it("menambahkan kolom ke basis data lama yang belum punya", () => {
    // Basis data versi LAMA, persis seperti sebelum fitur sematkan ada.
    const lama = new DatabaseSync(db);
    lama.exec(`
      CREATE TABLE percakapan (
        id TEXT PRIMARY KEY, judul TEXT NOT NULL,
        pemilik TEXT NOT NULL DEFAULT '',
        dibuat INTEGER NOT NULL, diperbarui INTEGER NOT NULL
      );
      CREATE TABLE pesan (
        id INTEGER PRIMARY KEY AUTOINCREMENT, percakapan_id TEXT NOT NULL,
        peran TEXT NOT NULL, isi TEXT NOT NULL, waktu INTEGER NOT NULL
      );
      INSERT INTO percakapan VALUES ('lama-1','Obrolan lama','',1,1);
    `);
    lama.close();

    // Membuka lewat lib harus memigrasikannya, bukan meledak.
    const daftar = daftarPercakapan(db);
    expect(daftar).toHaveLength(1);
    expect(daftar[0].judul).toBe("Obrolan lama");
    expect(daftar[0].disemat).toBe(false);

    // Dan datanya tetap utuh, bukan tabelnya dibuat ulang kosong.
    expect(setSemat("lama-1", true, db)).toBe(true);
    expect(daftarPercakapan(db)[0].disemat).toBe(true);
  });
});
