import { describe, it, expect } from "vitest";
import { cocokJalur, labelJalur, petaLabel } from "@/lib/label-berkas";

// Bentuk korpus Veldan yang sesungguhnya, termasuk tiga berkas bernama sama
// yang membongkar seluruh masalahnya.
const KORPUS = [
  "D:/Downloads/Tiburon/03-hasil-analisis/analisis-video.md",
  "D:/Downloads/Tiburon/03-hasil-analisis/analisis-buku-dalam.md",
  "D:/Downloads/Tiburon/03-hasil-analisis/analisis-buku.md",
  "MEMORY.md",
  "USER.md",
  "memory/dreaming/light/2026-09-03.md",
  "memory/dreaming/deep/2026-09-03.md",
  "memory/dreaming/rem/2026-09-03.md",
];

describe("petaLabel", () => {
  it("memakai nama berkas saja kalau memang sudah unik", () => {
    const p = petaLabel(KORPUS);
    expect(p.get("MEMORY.md")).toBe("MEMORY.md");
    // Jalur absolut panjang tidak membuat labelnya ikut panjang: yang dicari
    // sufiks terpendek yang unik, bukan jalur penuh.
    expect(p.get("D:/Downloads/Tiburon/03-hasil-analisis/analisis-video.md")).toBe(
      "analisis-video.md",
    );
  });

  it("menambah folder induk hanya saat namanya bentrok", () => {
    const p = petaLabel(KORPUS);
    expect(p.get("memory/dreaming/light/2026-09-03.md")).toBe("light/2026-09-03.md");
    expect(p.get("memory/dreaming/deep/2026-09-03.md")).toBe("deep/2026-09-03.md");
    expect(p.get("memory/dreaming/rem/2026-09-03.md")).toBe("rem/2026-09-03.md");
  });

  it("tiap berkas korpus dapat label yang berbeda", () => {
    // Penjaga inti. Kalau dua berkas berbagi label, jawaban menyebut sumber
    // yang tidak bisa ditelusuri dan kartu sumbernya membuka isi yang salah.
    const p = petaLabel(KORPUS);
    const label = [...p.values()];
    expect(new Set(label).size).toBe(KORPUS.length);
  });

  it("bertahan saat folder induknya pun bentrok", () => {
    const dalam = ["a/x/1/nota.md", "b/x/1/nota.md"];
    const p = petaLabel(dalam);
    expect(new Set(p.values()).size).toBe(2);
  });

  it("memakai garis miring maju walau jalurnya gaya Windows", () => {
    const p = petaLabel(["C:\\data\\satu\\nota.md", "C:\\data\\dua\\nota.md"]);
    expect([...p.values()].sort()).toEqual(["dua/nota.md", "satu/nota.md"]);
  });
});

describe("labelJalur", () => {
  it("tetap memberi label pada jalur yang belum ada di daftar", () => {
    // Korpus bisa diindeks ulang di tengah jalan; potongan dari berkas yang
    // baru masuk tidak boleh kehilangan namanya.
    expect(labelJalur("baru/catatan.md", KORPUS)).toBe("catatan.md");
  });
});

describe("cocokJalur", () => {
  it("mencocokkan berkas yang ditunjuk labelnya", () => {
    expect(cocokJalur("memory/dreaming/rem/2026-09-03.md", "rem/2026-09-03.md")).toBe(true);
    expect(cocokJalur("MEMORY.md", "MEMORY.md")).toBe(true);
  });

  it("menolak berkas senama di folder lain", () => {
    // Inti perbaikannya: membuka kartu sumber "rem/2026-09-03.md" tidak boleh
    // ikut menarik potongan dari light/ dan deep/.
    expect(cocokJalur("memory/dreaming/light/2026-09-03.md", "rem/2026-09-03.md")).toBe(false);
  });

  it("tidak tertipu nama yang berakhiran sama", () => {
    // Dicocokkan per RUAS, bukan endsWith mentah. Tanpa itu "buku.md" cocok
    // dengan "analisis-buku.md", dan sumbernya salah tanpa ada yang tahu.
    expect(cocokJalur("D:/x/analisis-buku.md", "buku.md")).toBe(false);
    expect(cocokJalur("D:/x/analisis-buku-dalam.md", "analisis-buku.md")).toBe(false);
  });

  it("menolak label kosong", () => {
    expect(cocokJalur("MEMORY.md", "")).toBe(false);
  });
});
