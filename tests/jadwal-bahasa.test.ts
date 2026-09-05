import { describe, it, expect } from "vitest";
import { berbedaDariAsli, jadwalManusiawi, selangManusiawi } from "@/lib/jadwal-bahasa";

describe("jadwalManusiawi", () => {
  it("menerjemahkan jadwal yang benar-benar dipakai di mesin ini", () => {
    // Diambil dari /api/jadwal yang sedang berjalan, bukan dikarang.
    expect(jadwalManusiawi("30 6 * * *")).toBe("tiap hari 06.30");
    expect(jadwalManusiawi("0 7 * * *")).toBe("tiap hari 07.00");
    expect(jadwalManusiawi("0 3 * * *")).toBe("tiap hari 03.00");
    expect(jadwalManusiawi("tiap 10080 menit")).toBe("tiap minggu");
    expect(jadwalManusiawi("tiap 30 menit")).toBe("tiap 30 menit");
  });

  it("memakai jam gaya Indonesia, dengan titik dan dua digit", () => {
    expect(jadwalManusiawi("5 9 * * *")).toBe("tiap hari 09.05");
    expect(jadwalManusiawi("0 0 * * *")).toBe("tiap hari 00.00");
  });

  it("menyebut nama hari, dan tahu 0 dan 7 sama-sama Minggu", () => {
    expect(jadwalManusiawi("0 6 * * 1")).toBe("tiap Senin 06.00");
    expect(jadwalManusiawi("0 6 * * 0")).toBe("tiap Minggu 06.00");
    expect(jadwalManusiawi("0 6 * * 7")).toBe("tiap Minggu 06.00");
  });

  it("mengenali selang di kolom menit dan jam", () => {
    expect(jadwalManusiawi("*/15 * * * *")).toBe("tiap 15 menit");
    expect(jadwalManusiawi("0 */6 * * *")).toBe("tiap 6 jam");
  });

  it("mengenali tanggal tertentu tiap bulan", () => {
    expect(jadwalManusiawi("0 8 1 * *")).toBe("tiap tanggal 1, 08.00");
  });

  /*
   * Bagian terpenting berkas ini. Jadwal justru diperiksa orang saat ia curiga
   * ada yang salah, dan terjemahan yang menebak lebih berbahaya daripada
   * ekspresi mentah yang jujur.
   */
  it("mengembalikan apa adanya yang di luar bentuk yang dikenali", () => {
    expect(jadwalManusiawi("0 6 * 3 *")).toBe("0 6 * 3 *"); // bulan tertentu
    expect(jadwalManusiawi("0 6 1,15 * *")).toBe("0 6 1,15 * *"); // daftar tanggal
    expect(jadwalManusiawi("0 6-9 * * *")).toBe("0 6-9 * * *"); // rentang jam
    expect(jadwalManusiawi("@reboot")).toBe("@reboot");
    expect(jadwalManusiawi("bukan cron")).toBe("bukan cron");
    expect(jadwalManusiawi("0 6 * *")).toBe("0 6 * *"); // kurang satu kolom
  });

  it("menolak angka di luar jangkauan alih-alih mengarang jam", () => {
    expect(jadwalManusiawi("0 25 * * *")).toBe("0 25 * * *");
    expect(jadwalManusiawi("70 6 * * *")).toBe("70 6 * * *");
  });

  it("kosong tetap kosong", () => {
    expect(jadwalManusiawi("")).toBe("");
    expect(jadwalManusiawi("   ")).toBe("");
  });
});

describe("selangManusiawi", () => {
  it("naik ke satuan terbesar yang masih bulat", () => {
    expect(selangManusiawi(60)).toBe("tiap jam");
    expect(selangManusiawi(120)).toBe("tiap 2 jam");
    expect(selangManusiawi(1440)).toBe("tiap hari");
    expect(selangManusiawi(10080)).toBe("tiap minggu");
    expect(selangManusiawi(2880)).toBe("tiap 2 hari");
  });

  it("tidak memaksakan satuan yang tidak bulat", () => {
    // "1,7 jam" tidak lebih mudah dibaca daripada "100 menit", cuma lebih
    // mengaburkan.
    expect(selangManusiawi(100)).toBe("tiap 100 menit");
    expect(selangManusiawi(45)).toBe("tiap 45 menit");
  });
});

describe("berbedaDariAsli", () => {
  it("menandai kapan bentuk aslinya masih perlu diperlihatkan", () => {
    expect(berbedaDariAsli("30 6 * * *")).toBe(true);
    expect(berbedaDariAsli("tiap 30 menit")).toBe(false);
    expect(berbedaDariAsli("@reboot")).toBe(false);
  });
});
