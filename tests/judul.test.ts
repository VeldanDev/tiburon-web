import { describe, it, expect } from "vitest";
import { judulDari } from "@/lib/judul";

describe("judulDari", () => {
  it("membuang kata pembuka yang tidak membedakan apa pun", () => {
    expect(judulDari("tolong jelaskan cara kerja SQLite FTS5")).toBe(
      "Kerja SQLite FTS5",
    );
  });

  it("memotong di batas kata, bukan di tengah kata", () => {
    const judul = judulDari(
      "rancang arsitektur penyimpanan riwayat percakapan yang tahan mati listrik",
      40,
    );
    expect(judul.endsWith("…")).toBe(true);
    // Yang penting: tidak ada kata yang terbelah. Buang elipsisnya, lalu
    // pastikan sisa terakhirnya adalah kata utuh dari kalimat aslinya.
    const tanpaElipsis = judul.slice(0, -1);
    expect("rancang arsitektur penyimpanan riwayat percakapan yang tahan mati listrik")
      .toContain(tanpaElipsis.toLowerCase());
  });

  it("membuang perintah garis miring dari depan", () => {
    expect(judulDari("/korpus arsitektur radar")).toBe("Arsitektur radar");
  });

  it("memakai kalimat pertama saja", () => {
    expect(judulDari("Kenapa gateway lambat? Aku sudah coba restart tapi tetap sama.")).toBe(
      "Gateway lambat?",
    );
  });

  // Penjaga khusus: tanpa batas "sisakan dua kata", kalimat yang SELURUHNYA
  // tersusun dari kata pembuka akan habis dan judulnya jadi string kosong.
  it("tidak pernah kosong walau semua katanya kata pembuka", () => {
    for (const p of ["apa itu ini", "coba dong ya", "aku mau itu"]) {
      expect(judulDari(p).length).toBeGreaterThan(0);
    }
  });

  it("membalas judul cadangan untuk pesan kosong", () => {
    expect(judulDari("   ")).toBe("Obrolan baru");
    expect(judulDari("/cepat")).toBe("Obrolan baru");
  });

  it("merapatkan spasi dan baris baru", () => {
    expect(judulDari("halo\n\n   dunia   laut")).toBe("Halo dunia laut");
  });
});
