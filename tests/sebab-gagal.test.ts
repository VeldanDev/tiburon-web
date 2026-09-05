import { describe, it, expect } from "vitest";
import { kenaliSebab, rangkumKegagalan, type Kegagalan } from "@/lib/sebab-gagal";

describe("kenaliSebab", () => {
  it("mengenali 429 yang benar-benar terjadi hari ini", () => {
    // Teks aslinya, dari balasan OpenRouter yang tercatat di sesi ini.
    expect(
      kenaliSebab(429, "z-ai/glm-5.2:free is temporarily rate-limited upstream. Please retry shortly"),
    ).toBe("kuota");
  });

  it("membedakan saldo habis dari kuota habis", () => {
    // Keduanya sering datang sebagai 429, dan tindakannya berbeda total: yang
    // satu ditunggu, yang satu dibayar.
    expect(kenaliSebab(402, "Insufficient credits")).toBe("saldo");
    expect(kenaliSebab(429, "Insufficient credits to run this request")).toBe("saldo");
    expect(kenaliSebab(429, "rate limit exceeded")).toBe("kuota");
  });

  it("mengenali kunci yang ditolak", () => {
    expect(kenaliSebab(401, "No auth credentials found")).toBe("kunci");
    expect(kenaliSebab(403, "Forbidden")).toBe("kunci");
    expect(kenaliSebab(null, "Invalid API key provided")).toBe("kunci");
  });

  it("mengenali model yang sudah tidak ada", () => {
    // Rantai yang menunjuk model yang dihapus penyedianya akan gagal selamanya
    // tanpa ada yang tahu kenapa.
    expect(kenaliSebab(404, "No endpoints found for z-ai/glm-9:free")).toBe("model-hilang");
  });

  it("mengenali kegagalan jaringan", () => {
    expect(kenaliSebab(null, "fetch failed")).toBe("jaringan");
    expect(kenaliSebab(null, "getaddrinfo ENOTFOUND openrouter.ai")).toBe("jaringan");
  });

  it("mengaku tidak tahu alih-alih menebak", () => {
    // Sebab yang dipaksakan lebih buruk daripada sebab yang tidak dikenali:
    // ia mengirim orang mengerjakan perbaikan yang salah.
    expect(kenaliSebab(500, "Internal server error")).toBe("lain");
    expect(kenaliSebab(null, "sesuatu yang aneh")).toBe("lain");
  });
});

describe("rangkumKegagalan", () => {
  const buat = (sebab: Kegagalan["sebab"], model = "m"): Kegagalan => ({
    model,
    sebab,
    pesan: "pesan asli",
  });

  it("menyebut tindakannya saat seluruh rantai gagal karena hal yang sama", () => {
    const teks = rangkumKegagalan([buat("kuota", "a"), buat("kuota", "b")]);
    expect(teks).toMatch(/coba lagi beberapa menit/i);
    // Rinciannya tetap dibawa: yang meringkas tidak boleh menghapus buktinya.
    expect(teks).toContain("a: pesan asli");
  });

  it("tidak menyatukan sebab yang berbeda jadi satu cerita", () => {
    // Rantai yang setengahnya kehabisan kuota dan setengahnya salah kunci
    // adalah DUA masalah; menyatukannya menyembunyikan salah satunya.
    const teks = rangkumKegagalan([buat("kuota", "a"), buat("kunci", "b")]);
    expect(teks).toMatch(/sebab berbeda/i);
    expect(teks).toContain("a: pesan asli");
    expect(teks).toContain("b: pesan asli");
  });

  it("untuk sebab tak dikenal, teks aslinya yang ditonjolkan", () => {
    // Tidak ada tindakan yang bisa disarankan, jadi ringkasan yang tidak
    // mengatakan apa-apa justru menyembunyikan satu-satunya petunjuk.
    const teks = rangkumKegagalan([buat("lain")]);
    expect(teks).toContain("m: pesan asli");
  });

  it("tidak melempar saat tidak ada model yang dicoba", () => {
    expect(() => rangkumKegagalan([])).not.toThrow();
  });
});
