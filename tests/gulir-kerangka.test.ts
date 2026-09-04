import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Kerangka aplikasi harus memiliki gulirnya sendiri.
 *
 * Diuji lewat berkasnya, bukan lewat tata letak sungguhan: jsdom tidak
 * menghitung tata letak sama sekali, jadi tinggi, overflow, dan kliping semua
 * bernilai nol di sana. Uji ini tidak bisa membuktikan gulirnya benar — yang
 * ia jaga adalah dua kata yang, kalau hilang, membuatnya salah lagi.
 *
 * Keduanya pernah hilang, dan akibatnya tidak terlihat seperti bug gulir:
 * menggulir halaman Radar menyeret seluruh sidebar keluar layar sejauh 7.174
 * piksel. Diukur di Chrome sungguhan, sebelum dan sesudah.
 */
describe("kerangka aplikasi", () => {
  const berkas = fs.readFileSync(
    path.join(process.cwd(), "app", "app", "layout.tsx"),
    "utf8",
  );
  const baris = berkas.split("\n").find((b) => b.includes("<main")) ?? "";

  it("main jadi wadah gulirnya, bukan dokumen", () => {
    // Tanpa ini, halaman yang lebih tinggi dari layar meluber keluar dan yang
    // menggulir jadi seluruh dokumen -- sidebar termasuk.
    expect(baris).toContain("overflow-y-auto");
  });

  it("main berposisi, supaya elemen absolut tidak lolos dari klipingnya", () => {
    // `position: absolute` tanpa leluhur berposisi memakai DOKUMEN sebagai blok
    // penampungnya. Satu <span class="sr-only"> selebar 1 piksel memanjangkan
    // dokumen 1.030 piksel lewat celah itu.
    expect(baris).toContain("relative");
  });
});
