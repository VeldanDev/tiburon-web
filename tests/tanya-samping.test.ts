import { describe, it, expect } from "vitest";
import {
  BATAS_PER_PESAN,
  GILIRAN_DIBAWA,
  JIWA_SAMPING,
  baca,
  susunTanyaSamping,
} from "@/lib/tanya-samping";
import { susunPrompt } from "@/lib/penyedia";

describe("baca /btw", () => {
  it("memisahkan pertanyaannya", () => {
    expect(baca("/btw apa topik obrolan ini?")).toBe("apa topik obrolan ini?");
    expect(baca("  /BTW  ringkas dong  ")).toBe("ringkas dong");
  });

  it("menerima pertanyaan yang menyeberang baris", () => {
    expect(baca("/btw ringkas ini\ndalam dua poin")).toBe("ringkas ini\ndalam dua poin");
  });

  it("menolak /btw tanpa pertanyaan", () => {
    // Mengirimkannya menghabiskan satu panggilan model cuma untuk meminta model
    // menebak apa yang ingin ditanyakan.
    expect(baca("/btw")).toBeNull();
    expect(baca("/btw   ")).toBeNull();
  });

  it("tidak salah mengenali pesan biasa", () => {
    expect(baca("btw aku lupa bilang")).toBeNull();
    expect(baca("tolong jelaskan /btw itu apa")).toBeNull();
  });
});

describe("susunTanyaSamping", () => {
  const riwayat = [
    { role: "user" as const, content: "apa itu korpus" },
    { role: "assistant" as const, content: "kumpulan catatanmu" },
  ];

  it("mengirim transkripnya sebagai SATU pesan pengguna", () => {
    // Dikirim sebagai giliran sungguhan, model memperlakukan pertanyaan
    // sampingan sebagai kelanjutan topiknya dan menjawab seolah percakapannya
    // masih berjalan — persis yang ingin dihindari.
    const pesan = susunTanyaSamping(riwayat, "apa topiknya?");
    expect(pesan).toHaveLength(1);
    expect(pesan[0].role).toBe("user");
    expect(pesan[0].content).toContain("apa itu korpus");
    expect(pesan[0].content).toContain("apa topiknya?");
  });

  it("membawa hanya giliran terakhir", () => {
    const panjang = Array.from({ length: 40 }, (_, i) => ({
      role: "user" as const,
      content: `pesan ke-${i}`,
    }));
    const isi = susunTanyaSamping(panjang, "x")[0].content;
    expect(isi).toContain("pesan ke-39");
    expect(isi).not.toContain("pesan ke-0");
  });

  it("memotong pesan yang sangat panjang", () => {
    // Satu jawaban panjang tidak boleh menelan seluruh konteks sampingannya.
    const isi = susunTanyaSamping(
      [{ role: "assistant", content: "x".repeat(BATAS_PER_PESAN + 500) }],
      "y",
    )[0].content;
    expect(isi.length).toBeLessThan(BATAS_PER_PESAN + 400);
  });

  it("mengatakan transkripnya kosong alih-alih mengirim blok kosong", () => {
    // Blok kosong membuat model menebak; kalimat yang jujur membuatnya
    // mengatakan bahwa ia tidak tahu.
    expect(susunTanyaSamping([], "apa topiknya?")[0].content).toContain("masih kosong");
  });

  it("membawa cukup giliran untuk berguna", () => {
    expect(GILIRAN_DIBAWA).toBeGreaterThanOrEqual(6);
  });
});

describe("jiwa sampingan", () => {
  it("MENGGANTIKAN persona Tiburon, bukan ditumpuk di atasnya", () => {
    // Kalau ditumpuk, persona Tiburon tetap yang pertama dibaca dan model
    // menjawab sebagai Tiburon yang melanjutkan percakapan.
    const sistem = susunPrompt([], [], { jiwa: JIWA_SAMPING })[0].content;
    expect(sistem).toContain("TENTANG sebuah percakapan");
    expect(sistem).not.toContain("hiu pembelajar");
  });

  it("melarang menebak isi yang tidak ada di transkrip", () => {
    expect(JIWA_SAMPING.toLowerCase()).toMatch(/jangan menebak/);
  });
});
