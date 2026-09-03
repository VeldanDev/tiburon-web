import { describe, it, expect } from "vitest";
import { keMarkdown, keJson, namaBerkas, type PesanEkspor } from "@/lib/ekspor";

const WAKTU = new Date("2026-09-04T10:00:00Z").getTime();
const PESAN: PesanEkspor[] = [
  { peran: "user", isi: "apa itu FTS5?" },
  { peran: "assistant", isi: "Indeks teks penuh.", model: "z-ai/glm-5.2:free", sumber: ["korpus.md"] },
];

describe("namaBerkas", () => {
  // Judul otomatis kerap berakhir tanda tanya ("Gateway lambat?"), dan
  // karakter itu terlarang di Windows.
  it("membuang karakter yang dilarang Windows", () => {
    const n = namaBerkas('Gateway lambat? a/b:c*d"e<f>g|h', "md");
    expect(n).not.toMatch(/[\/:*?"<>|]/);
    expect(n.endsWith(".md")).toBe(true);
  });

  it("tidak meninggalkan tanda hubung menggantung di ujung", () => {
    expect(namaBerkas("Gateway lambat?", "md")).toBe("tiburon-Gateway-lambat.md");
  });

  it("punya nama cadangan kalau judulnya habis tersaring", () => {
    expect(namaBerkas("???", "json")).toBe("tiburon-obrolan.json");
  });
});

describe("keMarkdown", () => {
  it("menyertakan model yang menjawab", () => {
    // Rantai cadangan bisa berganti model diam-diam; tanpa dicatat, membanding
    // dua ekspor lama tidak bisa menjawab kenapa yang satu lebih baik.
    expect(keMarkdown("Uji", PESAN, WAKTU)).toContain("z-ai/glm-5.2:free");
  });

  it("menyertakan sumber korpus dan judulnya", () => {
    const md = keMarkdown("Uji", PESAN, WAKTU);
    expect(md).toContain("korpus.md");
    expect(md.startsWith("# Uji")).toBe(true);
  });

  it("membedakan giliran pengguna dan Tiburon", () => {
    const md = keMarkdown("Uji", PESAN, WAKTU);
    expect(md).toContain("## Kamu");
    expect(md.indexOf("## Kamu")).toBeLessThan(md.indexOf("## Tiburon"));
  });
});

describe("keJson", () => {
  it("membawa nomor versi format sejak ekspor pertama", () => {
    // Menambahkannya nanti, setelah berkas tanpa versi tersebar, berarti tidak
    // akan pernah ada cara mengenali berkas yang lama.
    expect(JSON.parse(keJson("Uji", PESAN, WAKTU)).versi).toBe(1);
  });

  it("menghasilkan JSON sah yang memuat seluruh pesan", () => {
    const j = JSON.parse(keJson("Uji", PESAN, WAKTU));
    expect(j.pesan).toHaveLength(2);
    expect(j.judul).toBe("Uji");
    expect(j.aplikasi).toBe("Tiburon");
  });
});
