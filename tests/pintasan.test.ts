import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PETA_JALUR, PINTASAN } from "@/lib/pintasan";

describe("pintasan papan ketik", () => {
  it("tiap tombol jalur yang didengar juga terdaftar di panel", () => {
    for (const tombol of Object.keys(PETA_JALUR)) {
      const ada = PINTASAN.some((p) => p.tombol[0] === "Ctrl" && p.tombol[1] === tombol);
      expect(ada, `Ctrl+${tombol} tidak ada di daftar panel`).toBe(true);
    }
  });

  it("tidak mendaftarkan pintasan jalur yang tidak didengar siapa pun", () => {
    // Arah sebaliknya, dan justru ini yang dulu mungkin terjadi: panel menyebut
    // sebuah pintasan, pendengar yang seharusnya menjalankannya sudah dihapus,
    // dan tidak ada yang tahu sampai seseorang menekannya.
    const jalurDiPanel = PINTASAN.filter((p) => p.tombol[0] === "Ctrl").map((p) => p.tombol[1]);
    for (const tombol of jalurDiPanel) {
      expect(PETA_JALUR[tombol], `panel menyebut Ctrl+${tombol}, tidak ada pendengarnya`).toBeTruthy();
    }
  });

  it("layar obrolan tidak lagi menulis petanya sendiri", () => {
    // Penjaga terhadap kambuhnya masalah aslinya: peta kedua yang ditulis
    // tangan di layar obrolan, yang kebetulan cocok sampai suatu hari tidak.
    const berkas = fs.readFileSync(
      path.join(process.cwd(), "app", "app", "page.tsx"),
      "utf8",
    );
    expect(berkas).toContain("PETA_JALUR[e.key]");
    expect(berkas).not.toMatch(/const peta: Record<string, Jalur>/);
  });
});

describe("menu perintah", () => {
  it("tidak menyebut jumlah berkas korpus yang ditulis mati", () => {
    // "164 berkas terindeks" menetap berbulan-bulan sementara korpusnya berisi
    // 8 berkas. Angka yang ditulis mati di keterangan selalu berakhir salah.
    const berkas = fs.readFileSync(
      path.join(process.cwd(), "components", "chat", "MenuPerintah.tsx"),
      "utf8",
    );
    const isiPerintah = berkas.slice(berkas.indexOf("export const PERINTAH"));
    expect(isiPerintah).not.toMatch(/ringkas:.*\d+\s*berkas/);
  });
});
