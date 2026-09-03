import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  daftarProyek, buatProyek, ubahProyek, hapusProyek, pindahkan,
  instruksiUntukPercakapan,
} from "@/lib/proyek";
import { buatPercakapan, daftarPercakapan } from "@/lib/riwayat";

let db: string;
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tiburon-proyek-"));
  db = path.join(dir, "riwayat.sqlite");
  process.env.TIBURON_RIWAYAT_DB = db;
});
afterEach(() => {
  delete process.env.TIBURON_RIWAYAT_DB;
  rmSync(dir, { recursive: true, force: true });
});

describe("proyek", () => {
  it("membuat, menghitung isinya, dan menampilkan yang terbaru di atas", async () => {
    const a = buatProyek("Radar", db);
    await new Promise((r) => setTimeout(r, 2));
    buatProyek("Tiburon", db);

    const c = buatPercakapan("Obrolan", db);
    pindahkan(c, a.id, db);

    const daftar = daftarProyek(db);
    expect(daftar.map((p) => p.nama)).toEqual(["Tiburon", "Radar"]);
    expect(daftar.find((p) => p.id === a.id)!.jumlah).toBe(1);
  });

  it("menolak nama kosong", () => {
    expect(() => buatProyek("   ", db)).toThrow();
  });

  it("menyimpan instruksi, dan boleh dikosongkan kembali", () => {
    const p = buatProyek("Radar", db);
    ubahProyek(p.id, { instruksi: "Skripnya Python" }, db);
    expect(daftarProyek(db)[0].instruksi).toBe("Skripnya Python");
    ubahProyek(p.id, { instruksi: "" }, db);
    expect(daftarProyek(db)[0].instruksi).toBe("");
  });

  it("mengabaikan perubahan yang tidak menyebut apa pun", () => {
    const p = buatProyek("Radar", db);
    expect(ubahProyek(p.id, {}, db)).toBe(false);
  });

  // Menghapus folder yang ikut membawa isinya adalah cara paling cepat
  // kehilangan pekerjaan berbulan-bulan karena satu klik.
  it("menghapus proyek TANPA menghapus percakapannya", () => {
    const p = buatProyek("Radar", db);
    const c = buatPercakapan("Obrolan penting", db);
    pindahkan(c, p.id, db);

    expect(hapusProyek(p.id, db)).toBe(true);
    expect(daftarProyek(db)).toHaveLength(0);

    const sisa = daftarPercakapan(db);
    expect(sisa).toHaveLength(1);
    expect(sisa[0].judul).toBe("Obrolan penting");
  });

  it("mengeluarkan percakapan dari proyek dengan null", () => {
    const p = buatProyek("Radar", db);
    const c = buatPercakapan("Obrolan", db);
    pindahkan(c, p.id, db);
    expect(instruksiUntukPercakapan(c, db)).toBe("");

    ubahProyek(p.id, { instruksi: "Konteks radar" }, db);
    expect(instruksiUntukPercakapan(c, db)).toBe("Konteks radar");

    pindahkan(c, null, db);
    expect(instruksiUntukPercakapan(c, db)).toBe("");
  });

  it("membalas kosong untuk percakapan tanpa proyek", () => {
    const c = buatPercakapan("Lepas", db);
    expect(instruksiUntukPercakapan(c, db)).toBe("");
  });
});

describe("skema terpusat", () => {
  // Sebelumnya tiap modul membuat tabelnya sendiri; modul mana yang kebetulan
  // dibuka lebih dulu menentukan bentuk tabelnya, dan yang kalah cepat memakai
  // tabel tanpa kolom yang ia butuhkan.
  it("modul mana pun yang membuka lebih dulu menghasilkan skema yang sama", () => {
    // proyek.ts yang membuka duluan di basis data yang benar-benar baru.
    buatProyek("Duluan", db);
    // riwayat.ts menyusul, dan harus menemukan kolom yang ia butuhkan.
    const c = buatPercakapan("Menyusul", db);
    expect(daftarPercakapan(db).find((p) => p.id === c)!.disemat).toBe(false);
  });

  it("memigrasikan basis data lama yang tidak punya proyek_id maupun disemat", () => {
    const lama = new DatabaseSync(db);
    lama.exec(`
      CREATE TABLE percakapan (
        id TEXT PRIMARY KEY, judul TEXT NOT NULL,
        pemilik TEXT NOT NULL DEFAULT '',
        dibuat INTEGER NOT NULL, diperbarui INTEGER NOT NULL
      );
      INSERT INTO percakapan VALUES ('lama-1','Obrolan lama','',1,1);
    `);
    lama.close();

    const p = buatProyek("Baru", db);
    expect(pindahkan("lama-1", p.id, db)).toBe(true);
    expect(daftarProyek(db)[0].jumlah).toBe(1);
    expect(daftarPercakapan(db)[0].judul).toBe("Obrolan lama");
  });
});
