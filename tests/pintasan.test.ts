import { describe, it, expect } from "vitest";
import { PETA_JALUR, PINTASAN } from "@/lib/pintasan";
import { PERINTAH } from "@/components/chat/MenuPerintah";

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

});

describe("menu perintah", () => {
  it("tidak menyebut jumlah berkas korpus yang ditulis mati", () => {
    // "164 berkas terindeks" menetap berbulan-bulan sementara korpusnya
    // berisi 8 berkas. Angka yang ditulis mati di keterangan selalu berakhir
    // salah.
    //
    // Diuji pada DATA yang diekspor, bukan pada teks berkasnya: versi
    // sebelumnya membaca MenuPerintah.tsx, dan uji yang membaca sumber
    // menguji bentuk kode, bukan perilaku.
    for (const p of PERINTAH) {
      expect(p.ringkas, `${p.kunci} menyebut jumlah berkas`).not.toMatch(/\d+\s*berkas/);
    }
  });

  it("tiap perintah memindahkan jalur atau membuka halaman", () => {
    // Perintah yang tidak melakukan keduanya adalah baris menu yang tidak
    // melakukan apa-apa saat ditekan.
    for (const p of PERINTAH) {
      expect(Boolean(p.jalur || p.tuju || p.isi), `${p.kunci} tidak berbuat apa-apa`).toBe(true);
    }
  });
});
