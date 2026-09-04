import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ID_BAGIAN, jalurBagian, sahihBagian } from "@/lib/bagian-pengaturan";

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

describe("halaman pengaturan", () => {
  it("mendaftarkan setiap bagian di rel kirinya", () => {
    // Tipe IdBagian mencegah id yang SALAH masuk ke rel, tapi tidak mencegah
    // sebuah bagian LUPA didaftarkan -- dan bagian yang tidak punya barisnya
    // hanya bisa dicapai lewat URL yang diketik tangan.
    const berkas = fs.readFileSync(
      path.join(process.cwd(), "app", "app", "pengaturan", "page.tsx"),
      "utf8",
    );
    for (const id of ID_BAGIAN) expect(berkas).toContain(`id: "${id}"`);
  });
});
