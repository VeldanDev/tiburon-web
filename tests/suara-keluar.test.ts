import { describe, it, expect } from "vitest";
import { untukDibaca } from "@/lib/suara-keluar";

describe("untukDibaca", () => {
  it("membuang blok kode, tidak membacakannya", () => {
    // Mendengarkan seseorang mengeja tanda kurung kurawal selama dua menit
    // tidak menolong siapa pun.
    const hasil = untukDibaca("Begini caranya:\n\n```ts\nconst a = { b: 1 };\n```\n\nSelesai.");
    expect(hasil).not.toContain("const");
    expect(hasil).not.toContain("{");
    expect(hasil).toContain("ada blok kode");
    expect(hasil).toContain("Selesai");
  });

  it("membacakan teks tautannya, bukan alamatnya", () => {
    expect(untukDibaca("Lihat [dokumentasi Next.js](https://nextjs.org/docs)")).toBe(
      "Lihat dokumentasi Next.js",
    );
  });

  it("membuang penanda tebal, miring, judul, dan daftar", () => {
    const hasil = untukDibaca("## Judul\n\n**tebal** dan _miring_\n\n- satu\n- dua");
    expect(hasil).not.toMatch(/[#*_]/);
    expect(hasil).toContain("Judul");
    expect(hasil).toContain("tebal");
    expect(hasil).toContain("satu");
  });

  it("mengubah pipa tabel jadi jeda, bukan dieja", () => {
    const hasil = untukDibaca("| Nama | Nilai |\n| --- | --- |\n| a | 1 |");
    expect(hasil).not.toContain("|");
    expect(hasil).toContain("Nama");
  });

  it("mempertahankan kode sebaris sebagai kata biasa", () => {
    // Nama berkas dan perintah pendek justru berguna didengar.
    expect(untukDibaca("Buka `lib/korpus.ts` dulu")).toBe("Buka lib/korpus.ts dulu");
  });

  it("teks yang isinya cuma blok kode tidak jadi kosong", () => {
    // Kalau hasilnya kosong, tombolnya tersangkut di keadaan sedang membaca.
    expect(untukDibaca("```\nx\n```").trim()).not.toBe("");
  });

  it("teks kosong tetap kosong", () => {
    expect(untukDibaca("")).toBe("");
    expect(untukDibaca("   \n\n  ")).toBe("");
  });
});
