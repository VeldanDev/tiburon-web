import { describe, expect, it } from "vitest";
import { BAGIAN, ID_BAGIAN, jalurBagian, sahihBagian } from "@/lib/bagian-pengaturan";

describe("sahihBagian", () => {
  it("menerima tiap id yang terdaftar", () => {
    for (const id of ID_BAGIAN) expect(sahihBagian(id)).toBe(id);
  });

  it("jatuh ke tampilan untuk nilai yang tidak dikenal", () => {
    // Bagian cadangannya harus yang TIDAK menunggu server: URL yang rusak
    // tetap membuka sesuatu yang langsung bisa dipakai.
    expect(sahihBagian("bukan-bagian")).toBe("tampilan");
    expect(sahihBagian(null)).toBe("tampilan");
    expect(sahihBagian("")).toBe("tampilan");
  });

  it("tidak tertipu nilai yang mirip", () => {
    // Pencocokan harus PERSIS. Kalau tidak, `?bagian=ingatanku` membuka
    // halaman ingatan dan menyembunyikan salah ketiknya.
    expect(sahihBagian("Ingatan")).toBe("tampilan");
    expect(sahihBagian("ingatanku")).toBe("tampilan");
    expect(sahihBagian(" ingatan")).toBe("tampilan");
  });
});

describe("jalurBagian", () => {
  it("menghasilkan jalur yang dibaca kembali jadi bagian yang sama", () => {
    // Ini penjaga sesungguhnya: tautan menu akun dibuat oleh jalurBagian dan
    // dibaca oleh sahihBagian. Kalau bentuk URL-nya berubah di satu sisi,
    // tautannya tidak gagal dengan berisik -- ia diam-diam membuka bagian
    // yang salah.
    for (const id of ID_BAGIAN) {
      const kueri = new URL(jalurBagian(id), "http://x").searchParams.get("bagian");
      expect(sahihBagian(kueri)).toBe(id);
    }
  });
});

describe("daftar bagian", () => {
  it("tiap id punya barisnya di rel navigasi", () => {
    // Dulu ini uji yang MEMBACA page.tsx dan mencari `id: "..."`. Itu menguji
    // bentuk kode, bukan perilaku. Sekarang halamannya membangun relnya DARI
    // BAGIAN, jadi bagian yang tidak terdaftar tidak lagi bisa ada — dan yang
    // tersisa untuk diuji cuma hubungan antara dua data ini.
    for (const id of ID_BAGIAN) {
      expect(BAGIAN.find((b) => b.id === id), `${id} tidak punya label`).toBeTruthy();
    }
  });

  it("tidak ada label untuk bagian yang tidak ada", () => {
    for (const b of BAGIAN) {
      expect(ID_BAGIAN as readonly string[]).toContain(b.id);
    }
  });
});
