import { describe, it, expect, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { periksaSkema, cari, daftarBerkas } from "@/lib/korpus";

const DB_ASLI = path.join(
  process.env.USERPROFILE ?? os.homedir(),
  ".openclaw", "agents", "tiburon", "agent", "openclaw-agent.sqlite",
);

describe("periksaSkema", () => {
  it("cocok pada basis data OpenClaw sungguhan", () => {
    const hasil = periksaSkema(DB_ASLI);
    expect(hasil.cocok, hasil.alasan).toBe(true);
  });

  it("menolak basis data berskema salah, dengan alasan", () => {
    const palsu = path.join(os.tmpdir(), `korpus-palsu-${Date.now()}.sqlite`);
    const db = new DatabaseSync(palsu);
    db.exec("CREATE TABLE lain (a TEXT)");
    db.close();

    const hasil = periksaSkema(palsu);
    expect(hasil.cocok).toBe(false);
    expect(hasil.alasan).toBeTruthy();
    expect(hasil.alasan).toContain("memory_index_chunks");
    fs.unlinkSync(palsu);
  });

  it("menolak berkas yang tidak ada, dengan alasan", () => {
    const hasil = periksaSkema(path.join(os.tmpdir(), "tidak-ada-sama-sekali.sqlite"));
    expect(hasil.cocok).toBe(false);
    expect(hasil.alasan).toBeTruthy();
  });
});

describe("cari", () => {
  it("menemukan potongan dari korpus sungguhan", () => {
    const hasil = cari("enkripsi", 5, DB_ASLI);
    expect(hasil.length).toBeGreaterThan(0);
    expect(hasil[0].path).toBeTruthy();
    expect(hasil[0].teks.length).toBeGreaterThan(0);
  });

  it("mengembalikan array kosong untuk kueri tanpa hasil, bukan melempar", () => {
    expect(cari("zzqqxx-mustahil-ada-kata-ini", 5, DB_ASLI)).toEqual([]);
  });

  it("menghormati batas jumlah hasil", () => {
    expect(cari("a", 3, DB_ASLI).length).toBeLessThanOrEqual(3);
  });

  it("tidak melempar pada kueri berisi karakter khusus FTS", () => {
    expect(() => cari('kunci "publik" AND (enkripsi', 3, DB_ASLI)).not.toThrow();
  });
});

describe("daftarBerkas", () => {
  it("mendaftar berkas terindeks beserta jumlah potongannya", () => {
    const berkas = daftarBerkas(DB_ASLI);
    expect(berkas.length).toBeGreaterThan(0);
    expect(berkas[0].potongan).toBeGreaterThan(0);
  });
});
