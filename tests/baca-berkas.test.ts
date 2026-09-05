import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BATAS_ISI, bacaBerkas } from "@/lib/baca-berkas";

const proyek = process.cwd();
const KOTAK = path.join(proyek, "data", "uji-baca");

beforeEach(() => fs.mkdirSync(KOTAK, { recursive: true }));
afterEach(() => {
  try {
    fs.rmSync(KOTAK, { recursive: true, force: true });
  } catch {
    // folder sementara tidak wajib bersih
  }
});

function tulis(nama: string, isi: string | Buffer): string {
  const p = path.join(KOTAK, nama);
  fs.writeFileSync(p, isi);
  return p;
}

function gagal(jalur: string) {
  const h = bacaBerkas(jalur);
  expect(h.ok, `seharusnya gagal: ${jalur}`).toBe(false);
  return h as { ok: false; pesan: string };
}

describe("bacaBerkas — yang berhasil", () => {
  it("membaca berkas teks di dalam proyek", () => {
    const p = tulis("catatan.md", "# Judul\n\nisi catatan");
    const h = bacaBerkas(p);
    expect(h.ok).toBe(true);
    if (h.ok) {
      expect(h.teks).toContain("isi catatan");
      // Jalurnya ikut, supaya model tahu berkas mana yang dibacanya saat
      // beberapa berkas dibuka dalam satu giliran.
      expect(h.teks).toContain(p);
    }
  });

  it("membaca berkas tanpa ekstensi", () => {
    // "Dockerfile", "Makefile", "LICENSE" — semuanya teks, dan menolaknya
    // karena tidak berekstensi akan salah lebih sering daripada benar.
    const p = tulis("Dockerfile", "FROM node:24");
    expect(bacaBerkas(p).ok).toBe(true);
  });

  it("memotong berkas panjang dan menyebutnya DI ATAS isinya", () => {
    // Ditaruh di bawah, model yang berhenti membaca di tengah tidak akan
    // pernah melihatnya — lalu menjawab seolah sudah membaca seluruhnya.
    const p = tulis("panjang.txt", "x".repeat(BATAS_ISI + 5000));
    const h = bacaBerkas(p);
    expect(h.ok).toBe(true);
    if (h.ok) {
      const kepala = h.teks.slice(0, h.teks.indexOf("\n"));
      expect(kepala).toContain("DIPOTONG");
      expect(h.teks.length).toBeLessThan(BATAS_ISI + 500);
    }
  });

  it("berkas yang pas di bawah batas tidak ditandai dipotong", () => {
    const p = tulis("pas.txt", "y".repeat(100));
    const h = bacaBerkas(p);
    if (h.ok) expect(h.teks).not.toContain("DIPOTONG");
  });
});

describe("bacaBerkas — yang ditolak", () => {
  it("berkas rahasia, walau diminta baca saja", () => {
    // Lantai izin, bukan aturan alat ini. Sekali terbaca, kuncinya masuk ke
    // hasil alat, lalu ke percakapan, lalu ke riwayat yang bisa diekspor.
    const h = gagal(path.join(proyek, ".env.local"));
    expect(h.pesan.toLowerCase()).toContain("tidak diizinkan");
  });

  it("berkas di luar folder yang diizinkan", () => {
    const h = gagal("C:\\Windows\\System32\\drivers\\etc\\hosts");
    expect(h.pesan.toLowerCase()).toMatch(/tidak diizinkan|butuh izin/);
  });

  it("folder, bukan berkas", () => {
    expect(gagal(KOTAK).pesan.toLowerCase()).toContain("folder");
  });

  it("berkas yang tidak ada", () => {
    expect(gagal(path.join(KOTAK, "hantu.md")).pesan.toLowerCase()).toContain("tidak ada");
  });

  it("ekstensi yang bukan teks", () => {
    const p = tulis("gambar.png", "apa pun");
    expect(gagal(p).pesan.toLowerCase()).toContain("bukan berkas teks");
  });

  it("berkas berekstensi teks yang ISINYA ternyata biner", () => {
    // Diperiksa dari isinya, bukan cuma ekstensinya: berkas .log yang ternyata
    // biner tetap akan merusak konteks.
    const p = tulis("palsu.log", Buffer.from([0x41, 0x00, 0x42, 0x00, 0x43]));
    expect(gagal(p).pesan.toLowerCase()).toContain("biner");
  });

  it("jalur kosong", () => {
    expect(gagal("   ").pesan.toLowerCase()).toContain("kosong");
  });

  it("TIDAK PERNAH melempar, apa pun masukannya", () => {
    // Alat yang melempar menghentikan seluruh giliran agen; alat yang
    // mengembalikan alasan membiarkan model memberi tahu penggunanya.
    for (const buruk of ["", "   ", "\u0000", "C:\\", "..", "?<>|"]) {
      expect(() => bacaBerkas(buruk), buruk).not.toThrow();
    }
  });
});
