import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buatPercakapan, tambahPesan, ambilPercakapan, daftarPercakapan } from "@/lib/riwayat";

let db: string;
beforeEach(() => {
  db = path.join(os.tmpdir(), `riwayat-uji-${Date.now()}-${Math.random()}.sqlite`);
});

afterEach(() => {
  // Berkas sementara tidak wajib ada (beberapa uji tidak pernah membuatnya) —
  // kegagalan hapus tidak boleh menggagalkan uji, cuma menumpuk di tmpdir.
  try {
    fs.unlinkSync(db);
  } catch {
    // diabaikan
  }
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

  it("tidak membocorkan koneksi ketika pembuatan tabel gagal", () => {
    // Berkas berisi teks biasa: DatabaseSync bisa membuka handle-nya, tapi
    // CREATE TABLE (yang menulis halaman pertama) melempar "file is not a
    // database" karena headernya bukan SQLite. Ini titik gagal yang sama
    // yang dialami buka(): exec() melempar SETELAH koneksi berhasil dibuka.
    fs.writeFileSync(db, "ini bukan berkas SQLite, cuma teks biasa");

    expect(() => buatPercakapan("Uji", db)).toThrow(/database/i);

    // Bukti tidak ada kebocoran: kalau buka() gagal menutup handle sebelum
    // melempar, Windows mengunci berkasnya dan unlink di bawah ini melempar
    // EBUSY (diverifikasi manual: begitulah perilaku node:sqlite di
    // lingkungan ini). Handle yang ditutup dengan benar tidak mengunci apa
    // pun, jadi unlink berhasil.
    expect(() => fs.unlinkSync(db)).not.toThrow();
  });

  it("mendaftar percakapan terbaru di atas walau `diperbarui` sama persis (tie-breaker)", () => {
    // Date.now() beresolusi milidetik — di mesin cepat, dua panggilan
    // buatPercakapan() berturut-turut bisa jatuh di milidetik yang sama.
    // ORDER BY diperbarui DESC saja tidak menjamin urutan pada nilai seri;
    // uji ini memaksa keduanya benar-benar sama lalu memeriksa bahwa yang
    // dibuat belakangan (Baru) tetap muncul lebih dulu.
    const waktuBeku = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(waktuBeku);
    try {
      const lama = buatPercakapan("Lama-seri", db);
      const baru = buatPercakapan("Baru-seri", db);
      const daftar = daftarPercakapan(db);
      expect(daftar[0].id).toBe(baru);
      expect(daftar[1].id).toBe(lama);
    } finally {
      spy.mockRestore();
    }
  });
});
