import { describe, it, expect } from "vitest";
import { susunPrompt } from "@/lib/penyedia";

/**
 * Tiburon harus bisa menjelaskan dirinya sendiri.
 *
 * Percobaannya sesederhana mungkin dan gagal: ditanya "apa itu korpus di
 * aplikasi ini", jawabannya "aku tidak memiliki konteks tentang aplikasi
 * tertentu", lalu menjelaskan korpus sebagai istilah linguistik umum.
 *
 * Ini penjaga isinya, bukan penjaga kalimatnya: yang diperiksa adalah bahwa
 * hal-hal yang benar-benar ditanyakan orang di menit pertama masih ada di
 * prompt sistem, bukan kata per katanya.
 */
describe("prompt sistem memuat pengetahuan tentang aplikasinya", () => {
  // Pesan kosong dan konteks kosong: yang diuji bagian tetapnya, yang ikut
  // di setiap permintaan apa pun jalurnya.
  const prompt = susunPrompt([], [])[0].content;

  it("menyebut namanya sendiri dan melarang mengarang nama lain", () => {
    // Model sempat menyebut dirinya "Veldora" di jawaban sungguhan.
    expect(prompt).toContain("Tiburon");
    expect(prompt.toLowerCase()).toMatch(/jangan mengarang nama lain/);
  });

  it("menjelaskan arti korpus DI SINI, bukan istilah umumnya", () => {
    expect(prompt.toLowerCase()).toContain("korpus");
    expect(prompt.toLowerCase()).toMatch(/bukan istilah linguistik/);
  });

  it("menyebut keempat jalurnya", () => {
    for (const jalur of ["Cepat", "Tiburon", "Agen", "Kode"]) {
      expect(prompt).toContain(jalur);
    }
  });

  it("menyebut bahwa korpus hanya bisa dibaca", () => {
    // Batas yang paling mudah salah diklaim model kalau tidak disebut.
    expect(prompt.toUpperCase()).toContain("MEMBACA");
  });

  it("melarang mengarang fitur yang tidak terdaftar", () => {
    // Tanpa baris ini, model menambal kekosongan dengan fitur karangan — dan
    // fitur karangan lebih buruk daripada jawaban tidak tahu.
    expect(prompt.toLowerCase()).toMatch(/jangan mengarang fitur/);
  });

  it("tetap ringkas: ikut di setiap permintaan, jadi tiap barisnya dibayar", () => {
    // Bukan angka keramat, tapi pagar terhadap prompt yang perlahan jadi
    // brosur. Kalau ini pecah, pertanyaannya bukan "naikkan batasnya" tapi
    // "baris mana yang benar-benar pernah ditanyakan orang".
    expect(prompt.length).toBeLessThan(1600);
  });
});
