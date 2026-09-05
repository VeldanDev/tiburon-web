import { describe, it, expect } from "vitest";
import {
  UMUR_SESI_DETIK,
  alamatLokal,
  buatSesi,
  putusanMasuk,
  sandiCocok,
  sesiSah,
} from "@/lib/sandi";

const SANDI = "sandi-uji-yang-panjang";

describe("alamatLokal", () => {
  it("mengenali semua bentuk yang dilaporkan peramban", async () => {
    // Node melaporkan salah satu dari ketiganya tergantung bagaimana peramban
    // menyambung. Gerbang yang hanya mengenali satu bentuk akan mengunci
    // Veldan dari mesinnya sendiri.
    for (const h of ["localhost", "localhost:3000", "127.0.0.1", "127.0.0.1:3000", "[::1]:3000"]) {
      expect(alamatLokal(h), h).toBe(true);
    }
  });

  it("alamat jaringan BUKAN lokal", async () => {
    for (const h of ["192.168.1.4:3000", "10.0.0.5", "tiburon.kantor.lan", "203.0.113.7"]) {
      expect(alamatLokal(h), h).toBe(false);
    }
  });

  it("host kosong bukan lokal", async () => {
    // Ragu berarti TIDAK. Host yang hilang tidak boleh jadi jalan masuk.
    expect(alamatLokal(null)).toBe(false);
    expect(alamatLokal(undefined)).toBe(false);
    expect(alamatLokal("")).toBe(false);
  });
});

describe("sandiCocok", () => {
  it("cocok untuk sandi yang sama", async () => {
    expect(await sandiCocok(SANDI, SANDI)).toBe(true);
  });

  it("tidak cocok untuk yang berbeda, termasuk yang beda satu huruf", async () => {
    expect(await sandiCocok(SANDI + "x", SANDI)).toBe(false);
    expect(await sandiCocok("", SANDI)).toBe(false);
  });

  it("panjang yang berbeda tidak melempar", async () => {
    // Perbandingan yang melempar pada panjang berbeda akan membocorkan panjang
    // sandi sebenarnya lewat galat 500.
    await expect(sandiCocok("pendek", SANDI)).resolves.toBe(false);
  });
});

describe("sesi", () => {
  it("kuki yang baru dibuat sah", async () => {
    expect(await sesiSah(await buatSesi(SANDI), SANDI)).toBe(true);
  });

  it("kuki tidak sah untuk sandi lain", async () => {
    // Mengganti sandi otomatis membatalkan semua sesi yang sudah ada — persis
    // yang diinginkan orang saat ia mengganti sandi.
    expect(await sesiSah(await buatSesi(SANDI), "sandi-yang-lain")).toBe(false);
  });

  it("kuki kedaluwarsa ditolak", async () => {
    const kuki = await buatSesi(SANDI, 0);
    expect(await sesiSah(kuki, SANDI, UMUR_SESI_DETIK * 1000 + 1)).toBe(false);
  });

  it("kadaluarsa yang disunting ditolak", async () => {
    // Kalau angkanya cuma dititipkan tanpa ditandatangani, siapa pun bisa
    // menyuntingnya di perambannya sendiri dan memperpanjang sesinya seumur
    // hidup.
    const kuki = await buatSesi(SANDI);
    const [, acak, tanda] = kuki.split(".");
    const dipalsukan = `${Date.now() + 10 ** 12}.${acak}.${tanda}`;
    expect(await sesiSah(dipalsukan, SANDI)).toBe(false);
  });

  it("tanda tangan yang disunting ditolak", async () => {
    const kuki = await buatSesi(SANDI);
    const [kad, acak, tanda] = kuki.split(".");
    const dibalik = tanda.slice(0, -1) + (tanda.endsWith("a") ? "b" : "a");
    expect(await sesiSah(`${kad}.${acak}.${dibalik}`, SANDI)).toBe(false);
  });

  it("bentuk yang aneh ditolak tanpa melempar", async () => {
    for (const buruk of ["", "a", "a.b", "a.b.c.d", "...", "1.2.zzz", "x".repeat(500)]) {
      await expect(sesiSah(buruk, SANDI), buruk).resolves.toBe(false);
      expect(await sesiSah(buruk, SANDI), buruk).toBe(false);
    }
  });

  it("kuki kosong ditolak", async () => {
    expect(await sesiSah(null, SANDI)).toBe(false);
    expect(await sesiSah(undefined, SANDI)).toBe(false);
  });
});

describe("putusanMasuk", () => {
  it("localhost selalu boleh, dengan atau tanpa sandi", async () => {
    // Menuntut sandi dari orang yang sudah memegang papan ketiknya tidak
    // menambah keamanan apa pun.
    expect((await putusanMasuk({ host: "localhost:3000", kuki: null, sandi: null })).hasil).toBe("boleh");
    expect((await putusanMasuk({ host: "127.0.0.1:3000", kuki: null, sandi: SANDI })).hasil).toBe("boleh");
  });

  it("dari jaringan TANPA sandi terpasang: ditolak, bukan diloloskan", async () => {
    // Keputusan paling menentukan di berkas ini. Pemasangan yang lupa mengisi
    // sandi harus gagal berisik — kegagalan senyap di sini berarti arsip satu
    // kantor terbuka untuk satu jaringan penuh, dan tidak ada yang akan tahu.
    const p = await putusanMasuk({ host: "192.168.1.4:3000", kuki: null, sandi: null });
    expect(p.hasil).toBe("tolak");
    if (p.hasil === "tolak") expect(p.alasan).toContain("SANDI_TIBURON");
  });

  it("dari jaringan dengan sandi terpasang tapi belum masuk: diminta sandi", async () => {
    expect((await putusanMasuk({ host: "192.168.1.4:3000", kuki: null, sandi: SANDI })).hasil).toBe(
      "minta-sandi",
    );
  });

  it("dari jaringan dengan kuki sah: boleh", async () => {
    expect(
      (await putusanMasuk({ host: "192.168.1.4:3000", kuki: await buatSesi(SANDI), sandi: SANDI })).hasil,
    ).toBe("boleh");
  });

  it("dari jaringan dengan kuki milik sandi LAMA: diminta sandi lagi", async () => {
    expect(
      (await putusanMasuk({ host: "192.168.1.4:3000", kuki: await buatSesi("sandi-lama"), sandi: SANDI })).hasil,
    ).toBe("minta-sandi");
  });

  it("host yang hilang diperlakukan sebagai jaringan, bukan lokal", async () => {
    // Ragu berarti TIDAK.
    expect((await putusanMasuk({ host: null, kuki: null, sandi: SANDI })).hasil).toBe("minta-sandi");
    expect((await putusanMasuk({ host: null, kuki: null, sandi: null })).hasil).toBe("tolak");
  });
});
