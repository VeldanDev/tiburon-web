/**
 * Alat agen. Yang diuji terutama JALUR GAGALNYA.
 *
 * Alat yang melempar akan menghentikan seluruh giliran agen; alat yang
 * mengembalikan "tidak bisa karena X" membiarkan model membaca alasannya dan
 * memberitahu penggunanya. Perbedaan itu yang paling menentukan di sini, dan
 * paling mudah rusak tanpa terlihat.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("@/lib/korpus", () => ({
  periksaSkema: vi.fn(() => ({ cocok: true })),
  cari: vi.fn(() => [{ path: "D:/k/catatan.md", teks: "isi potongan", skor: 1 }]),
  daftarBerkas: vi.fn(() => [{ path: "D:/k/catatan.md", potongan: 12 }]),
}));
vi.mock("@/lib/radar-parser", () => ({
  bacaRadar: vi.fn(() => null),
  dirRadar: () => "x",
}));

const { jalankanAlat, ringkasPanggilan, SKEMA_ALAT, adaAlat } = await import("@/lib/alat");
const korpus = await import("@/lib/korpus");

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tiburon-alat-"));
  process.env.TIBURON_RIWAYAT_DB = path.join(dir, "riwayat.sqlite");
  vi.mocked(korpus.periksaSkema).mockReturnValue({ cocok: true });
});
afterEach(() => {
  delete process.env.TIBURON_RIWAYAT_DB;
  rmSync(dir, { recursive: true, force: true });
});

describe("skema alat", () => {
  it("semuanya punya nama, deskripsi, dan parameter", () => {
    expect(SKEMA_ALAT.length).toBeGreaterThan(0);
    for (const s of SKEMA_ALAT) {
      expect(s.function.name).toMatch(/^[a-z_]+$/);
      expect(s.function.description.length).toBeGreaterThan(30);
      expect(s.function.parameters.type).toBe("object");
    }
  });

  it("tidak ada alat yang bisa menulis atau menjalankan perintah", () => {
    // Agen yang bisa menulis butuh lapisan izin per tindakan, dan lapisan itu
    // belum ada. Uji ini adalah pagarnya sampai lapisan itu dibuat.
    const nama = SKEMA_ALAT.map((s) => s.function.name).join(" ");
    expect(nama).not.toMatch(/tulis|hapus|jalankan|eksekusi|write|delete|exec|shell/i);
  });
});

describe("jalankanAlat", () => {
  it("mengembalikan potongan korpus beserta nama berkasnya", () => {
    const hasil = jalankanAlat("cari_korpus", '{"kueri":"radar"}');
    expect(hasil).toContain("catatan.md");
    expect(hasil).toContain("isi potongan");
  });

  // Nama alat yang dikarang dijawab sebagai HASIL, bukan galat, supaya model
  // bisa membaca daftar yang benar dan mencoba lagi.
  it("menjawab nama alat yang tidak ada, bukan melempar", () => {
    const hasil = jalankanAlat("alat_karangan", "{}");
    expect(hasil).toContain("tidak ada");
    expect(hasil).toContain("cari_korpus");
  });

  // Model kerap mengirim JSON yang sedikit cacat. Melempar di sini akan
  // mematikan seluruh percakapan karena satu koma.
  it("bertahan terhadap argumen JSON yang cacat", () => {
    expect(() => jalankanAlat("cari_korpus", "{rusak")).not.toThrow();
    expect(jalankanAlat("cari_korpus", "{rusak")).toContain("kosong");
  });

  it("menjawab skema korpus yang rusak sebagai hasil, bukan galat", () => {
    vi.mocked(korpus.periksaSkema).mockReturnValue({ cocok: false, alasan: "tabel hilang" });
    expect(jalankanAlat("cari_korpus", '{"kueri":"apa"}')).toContain("tabel hilang");
  });

  it("menjawab pencarian korpus yang melempar sebagai hasil", () => {
    vi.mocked(korpus.cari).mockImplementationOnce(() => {
      throw new Error("basis data terkunci");
    });
    expect(jalankanAlat("cari_korpus", '{"kueri":"apa"}')).toContain("basis data terkunci");
  });

  it("menolak tanggal radar yang tidak valid, bukan mencari berkas 'Invalid Date'", () => {
    expect(jalankanAlat("baca_radar", '{"tanggal":"kemarin"}')).toContain("tidak valid");
  });

  it("mengatakan terus terang saat laporan radar belum ada", () => {
    expect(jalankanAlat("baca_radar", '{"tanggal":"2020-01-01"}')).toContain("Belum ada");
  });
});

describe("ringkasPanggilan", () => {
  it("menyebut kuerinya supaya jejaknya bisa dibaca sekilas", () => {
    expect(ringkasPanggilan("cari_korpus", '{"kueri":"arsitektur radar"}')).toContain(
      "arsitektur radar",
    );
  });

  it("tidak meledak untuk alat yang tidak dikenal", () => {
    expect(ringkasPanggilan("hantu", "{}")).toContain("tidak dikenal");
  });

  it("adaAlat mengenali yang ada dan yang tidak", () => {
    expect(adaAlat("cari_korpus")).toBe(true);
    expect(adaAlat("hantu")).toBe(false);
  });
});
