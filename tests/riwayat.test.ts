import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";
import { buatPercakapan, tambahPesan, ambilPercakapan, daftarPercakapan } from "@/lib/riwayat";

let db: string;
beforeEach(() => {
  db = path.join(os.tmpdir(), `riwayat-uji-${Date.now()}-${Math.random()}.sqlite`);
});

describe("riwayat", () => {
  it("menyimpan lalu mengembalikan pesan dengan urutan yang sama", () => {
    const id = buatPercakapan("Uji", db);
    tambahPesan(id, { role: "user", content: "satu" }, db);
    tambahPesan(id, { role: "assistant", content: "dua" }, db);
    const pesan = ambilPercakapan(id, db);
    expect(pesan.map((p) => p.content)).toEqual(["satu", "dua"]);
    expect(pesan[0].role).toBe("user");
  });

  it("mendaftar percakapan, terbaru di atas", () => {
    const a = buatPercakapan("Lama", db);
    const b = buatPercakapan("Baru", db);
    tambahPesan(b, { role: "user", content: "x" }, db);
    const daftar = daftarPercakapan(db);
    expect(daftar[0].id).toBe(b);
    expect(daftar.map((d) => d.judul)).toContain("Lama");
  });

  it("percakapan kosong mengembalikan array kosong, bukan melempar", () => {
    expect(ambilPercakapan("tidak-ada", db)).toEqual([]);
  });

  it("punya kolom pemilik sejak awal, untuk multi-user nanti", () => {
    const id = buatPercakapan("Uji", db);
    const d = new DatabaseSync(db, { readOnly: true });
    const kolom = d.prepare("PRAGMA table_info(percakapan)").all().map((k) => (k as { name: string }).name);
    d.close();
    expect(kolom).toContain("pemilik");
    expect(id).toBeTruthy();
  });
});
