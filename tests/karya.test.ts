/**
 * Karya.
 *
 * Yang diuji adalah pintunya: daftar hanya membaca folder bertanggal dan
 * melewati konten yang dibatalkan, dan jalur gambar tidak bisa dipakai untuk
 * keluar dari akar karya.
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { daftarKarya, jalurGambar } from "@/lib/karya";

let akar = "";

beforeAll(() => {
  akar = fs.mkdtempSync(path.join(os.tmpdir(), "karya-"));
  const buat = (rel: string, isi = "x") => {
    fs.mkdirSync(path.dirname(path.join(akar, rel)), { recursive: true });
    fs.writeFileSync(path.join(akar, rel), isi);
  };
  buat("2026-10-24/khusus-litellm/slide-01.png");
  buat("2026-10-24/khusus-litellm/judul.txt", "Library AI populer LiteLLM sempat jadi malware");
  buat("2026-10-24/_batal-video/slide-01.png");
  buat("2026-10-23/alat/slide-01.png");
  buat("bukan-tanggal/x/slide-01.png");
  buat("rahasia.txt", "jangan");
});

describe("daftarKarya", () => {
  it("membaca folder bertanggal, terbaru dulu, melewati yang dibatalkan", () => {
    const d = daftarKarya(akar);
    expect(d.map((k) => k.folder)).toEqual(["khusus-litellm", "alat"]);
    expect(d[0].judul).toBe("Library AI populer LiteLLM sempat jadi malware");
    expect(d[1].judul).toBe("alat");
  });

  it("akar yang tidak ada berarti daftar kosong, bukan galat", () => {
    expect(daftarKarya(path.join(akar, "tidak-ada"))).toEqual([]);
  });
});

describe("jalurGambar", () => {
  it("memberi jalur untuk gambar di dalam akar", () => {
    expect(jalurGambar("2026-10-24/khusus-litellm/slide-01.png", akar)).toContain("slide-01.png");
  });

  it("menolak jalur yang keluar dari akar atau bukan gambar", () => {
    expect(jalurGambar("../../etc/passwd", akar)).toBeNull();
    expect(jalurGambar("rahasia.txt", akar)).toBeNull();
    expect(jalurGambar("2026-10-24/tidak-ada.png", akar)).toBeNull();
  });
});
