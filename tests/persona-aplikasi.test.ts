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
    // Dicocokkan dengan MAKNANYA, bukan satu kata: uji yang mengunci kata
    // tertentu pecah tiap kali kalimatnya dirapikan, dan uji yang pecah
    // karena alasan sepele akan dilonggarkan orang alih-alih dibaca.
    expect(prompt.toLowerCase()).toMatch(/korpus hanya bisa kamu baca/);
  });

  it("menyuruhnya menyesuaikan panjang jawaban dengan bobot pertanyaan", () => {
    // Diambil dari SOUL.md Hermes, yang sumbernya dibaca langsung. Ini satu
    // baris yang paling banyak mengubah rasa tiap jawaban.
    expect(prompt.toLowerCase()).toMatch(/panjang jawaban mengikuti bobot/);
  });

  it("melarang setuju hanya karena Veldan yang bilang", () => {
    // Tanpa baris ini model cenderung membenarkan apa pun — dan asisten yang
    // selalu setuju tidak menolong siapa pun.
    expect(prompt.toLowerCase()).toMatch(/setuju karena benar/);
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
