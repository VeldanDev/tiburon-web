import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { konfigurasi, lupakanKonfigurasi } from "@/lib/konfigurasi";
import fs from "node:fs";
import path from "node:path";

const KUNCI = [
  "TIBURON_RIWAYAT_DB",
  "TIBURON_KORPUS_DB",
  "TIBURON_RADAR_DIR",
  "TIBURON_JADWAL_DB",
] as const;

let asli: Record<string, string | undefined>;
beforeEach(() => {
  asli = Object.fromEntries(KUNCI.map((k) => [k, process.env[k]]));
  for (const k of KUNCI) delete process.env[k];
  lupakanKonfigurasi();
});
afterEach(() => {
  for (const k of KUNCI) {
    if (asli[k] === undefined) delete process.env[k];
    else process.env[k] = asli[k]!;
  }
  lupakanKonfigurasi();
});

describe("konfigurasi", () => {
  it("punya bawaan untuk keempat jalur", () => {
    const k = konfigurasi();
    expect(k.riwayatDb).toContain("riwayat.sqlite");
    expect(k.korpusDb).toContain("openclaw");
    expect(k.jadwalDb).toContain("openclaw");
    expect(k.radarDir).toContain("radar");
  });

  it("jadwal menunjuk state/openclaw.sqlite, bukan cron.sqlite", () => {
    // Bawaan ini sempat DITEBAK saat dipindahkan ke modul konfigurasi, dan
    // jadwal langsung mati: tujuh tugas jadi nol. Nilai yang menunjuk ke luar
    // proyek tidak boleh ditebak — ia disalin dari yang terbukti bekerja.
    expect(konfigurasi().jadwalDb).toMatch(/state[\\/]openclaw\.sqlite$/);
  });

  it("korpus menunjuk agen tiburon di dalam .openclaw", () => {
    expect(konfigurasi().korpusDb).toMatch(/agents[\\/]tiburon[\\/]agent[\\/]/);
  });

  it("penimpa lingkungan menang atas bawaan", () => {
    process.env.TIBURON_RIWAYAT_DB = "/tmp/uji.sqlite";
    expect(konfigurasi().riwayatDb).toBe("/tmp/uji.sqlite");
  });

  it("penimpa yang BERUBAH langsung terbaca, tidak dibekukan cache", () => {
    // Ini yang membuat enam uji gagal saat cache-nya masih menyimpan hasil
    // akhir: tiap berkas uji menyetel jalurnya sendiri di beforeEach, dan
    // hasil yang dibekukan membuat berkas kedua memakai basis data berkas
    // pertama. Cache ada untuk menghindari operasi berkas berulang, bukan
    // untuk membekukan lingkungan.
    process.env.TIBURON_RIWAYAT_DB = "/tmp/satu.sqlite";
    expect(konfigurasi().riwayatDb).toBe("/tmp/satu.sqlite");

    process.env.TIBURON_RIWAYAT_DB = "/tmp/dua.sqlite";
    expect(konfigurasi().riwayatDb).toBe("/tmp/dua.sqlite");
  });

  it("penimpa satu jalur tidak menyeret jalur lain", () => {
    process.env.TIBURON_RIWAYAT_DB = "/tmp/uji.sqlite";
    expect(konfigurasi().korpusDb).toContain("openclaw");
  });
});

describe("bawaan yang bisa dipasang di mesin lain", () => {
  it("tidak ada jalur mutlak milik satu mesin yang lolos ke pemasangan lain", async () => {
    // Bawaan yang menunjuk ke D:\vscode\MyProjects\Otak\radar akan menunjuk ke
    // ketiadaan di mesin klien. Uji ini memeriksa PERILAKUNYA — jalur yang
    // dipakai harus benar-benar ada, atau berada di dalam proyek ini.
    const k = konfigurasi();
    for (const [nama, jalur] of Object.entries(k)) {
      const didalam = !path.relative(process.cwd(), jalur).startsWith("..");
      const ada = fs.existsSync(jalur);
      expect(didalam || ada, `${nama} menunjuk ke luar proyek dan tidak ada: ${jalur}`).toBe(true);
    }
  });
});
