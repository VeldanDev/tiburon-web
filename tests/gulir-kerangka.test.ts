import { describe, it, expect } from "vitest";
import { KELAS_WADAH_GULIR } from "@/lib/kerangka";

/**
 * Kerangka aplikasi harus memiliki gulirnya sendiri.
 *
 * Versi sebelumnya MEMBACA app/app/layout.tsx dan mencocokkan teksnya.
 * Itu menguji bentuk kode, bukan perilaku: ia akan gagal saat berkasnya
 * dirapikan, dan lolos kalau kelasnya dipasang di elemen yang salah.
 * Sekarang yang dijaga adalah tetapan yang benar-benar dipakai layout-nya.
 *
 * Yang TIDAK bisa dijaga di sini: apakah kelasnya terpasang di <main>.
 * jsdom tidak menghitung tata letak sama sekali, jadi tinggi dan kliping
 * semuanya nol. Itu diperiksa di Chrome sungguhan, dan angkanya ada di
 * lib/kerangka.ts.
 */
describe("wadah gulir kerangka", () => {
  it("memiliki gulirnya sendiri, bukan menyerahkannya ke dokumen", () => {
    expect(KELAS_WADAH_GULIR).toContain("overflow-y-auto");
  });

  it("berposisi, supaya elemen absolut tidak lolos dari klipingnya", () => {
    // `position: absolute` tanpa leluhur berposisi memakai DOKUMEN sebagai
    // blok penampungnya. Satu <span class="sr-only"> selebar 1 piksel
    // memanjangkan dokumen 1.030 piksel lewat celah itu.
    expect(KELAS_WADAH_GULIR.split(/\s+/)).toContain("relative");
  });
});
