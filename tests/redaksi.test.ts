import { describe, it, expect } from "vitest";
import { PENANDA, sunting, suntingHasilAlat } from "@/lib/redaksi";

/**
 * Kunci palsu, dirakit dari potongan supaya tidak ada satu pun rangkaian di
 * berkas ini yang terlihat seperti kunci sungguhan bagi pemindai rahasia.
 */
const KUNCI = {
  openrouter: "sk-or-v1-" + "a1b2c3d4e5".repeat(4),
  openai: "sk-" + "T3BlbkFJ".repeat(4),
  github: "ghp_" + "0123456789abcdefghij0123456789",
  aws: "AKIA" + "IOSFODNN7EXAMPLE",
  google: "AIza" + "SyD-1234567890abcdefghijklmnopqrstu",
  slack: "xoxb-" + "123456789012-abcdefghijklmnop",
  groq: "gsk_" + "abcdefghij0123456789ABCDEFGHIJ",
  jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r",
};

function tersembunyi(hasil: string, rahasia: string) {
  expect(hasil, `masih memuat rahasianya: ${rahasia.slice(0, 8)}…`).not.toContain(rahasia);
  expect(hasil).toContain(PENANDA);
}

describe("sunting — kunci berawalan khas", () => {
  for (const [penerbit, kunci] of Object.entries(KUNCI)) {
    it(`menyunting kunci ${penerbit}`, () => {
      const h = sunting(`konfigurasinya: ${kunci} — sekian`);
      expect(h.jumlah).toBeGreaterThan(0);
      tersembunyi(h.teks, kunci);
      // Teks di sekitarnya utuh: yang disunting rahasianya, bukan kalimatnya.
      expect(h.teks).toContain("konfigurasinya:");
      expect(h.teks).toContain("— sekian");
    });
  }

  it("menyunting beberapa kunci dalam satu teks dan menghitung semuanya", () => {
    const h = sunting(`${KUNCI.github}\n${KUNCI.aws}\n${KUNCI.groq}`);
    expect(h.jumlah).toBe(3);
  });
});

describe("sunting — bentuk lain", () => {
  it("menyunting blok kunci privat seluruhnya", () => {
    const blok = [
      "-----BEGIN RSA PRIVATE KEY-----",
      "MIIEowIBAAKCAQEAx7Rn9k2mQ",
      "vQIDAQABAoIBAQCa9Xq1Zk3lQ",
      "-----END RSA PRIVATE KEY-----",
    ].join("\n");
    const h = sunting(`awal\n${blok}\nakhir`);
    expect(h.jumlah).toBe(1);
    // Barisan tengahnya ikut hilang, bukan cuma penanda BEGIN-nya: kunci
    // privat yang tersunting sebagian tetap kunci privat yang bocor.
    expect(h.teks).not.toContain("MIIEowIBAAKCAQEAx7Rn9k2mQ");
    expect(h.teks).toContain("awal");
    expect(h.teks).toContain("akhir");
  });

  it("menyunting token di header Authorization", () => {
    const h = sunting("Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123456789");
    expect(h.jumlah).toBe(1);
    expect(h.teks).not.toContain("abcdefghijklmnopqrstuvwxyz");
    // Jenisnya tetap terbaca — yang rahasia nilainya, bukan fakta bahwa
    // permintaannya memakai Bearer.
    expect(h.teks).toContain("Bearer");
  });

  it("menyunting nilai penetapan bergaya env, walau kuncinya tanpa awalan khas", () => {
    // Kunci buatan sendiri tidak punya awalan penerbit. Satu-satunya petunjuk
    // yang tersisa adalah bahwa pemiliknya menamainya KEY.
    const h = sunting("OPENROUTER_API_KEY=rahasia-buatan-sendiri-yang-panjang");
    expect(h.jumlah).toBe(1);
    expect(h.teks).not.toContain("rahasia-buatan-sendiri");
    expect(h.teks).toContain("OPENROUTER_API_KEY=");
  });

  it("menyunting penetapan yang dikutip dan yang bergaya JSON", () => {
    expect(sunting('DB_PASSWORD="kata-sandi-yang-panjang"').jumlah).toBe(1);
    expect(sunting('  "apiKey": "kunci-rahasia-yang-panjang"').jumlah).toBe(1);
    expect(sunting("export GITHUB_TOKEN=abcdefghijklmnop").jumlah).toBe(1);
  });
});

describe("sunting — yang TIDAK boleh disentuh", () => {
  it("teks biasa tidak berubah sama sekali", () => {
    const teks = "Ini catatan biasa tentang kunci jawaban dan token bahasa.";
    const h = sunting(teks);
    expect(h.jumlah).toBe(0);
    expect(h.teks).toBe(teks);
  });

  it("hash git dan id panjang lain tidak disunting", () => {
    // Alasan daftarnya memakai AWALAN yang dikenal, bukan tebakan bentuk:
    // "rangkaian huruf acak" juga cocok dengan hash, id peti, dan sidik berkas.
    const h = sunting("commit c5fea07a9b3d4e5f60718293a4b5c6d7e8f90123 di cabang master");
    expect(h.jumlah).toBe(0);
  });

  it("berkas contoh dengan nilai kosong tetap utuh", () => {
    // .env.example justru berguna dibaca apa adanya; menyuntingnya membuang
    // informasi tanpa menyelamatkan apa pun.
    const h = sunting("OPENROUTER_API_KEY=\nDATABASE_URL=\nAPI_TOKEN=");
    expect(h.jumlah).toBe(0);
  });

  it("nilai yang jelas penampung tetap utuh", () => {
    const h = sunting(
      [
        "API_KEY=${OPENROUTER_API_KEY}",
        "SECRET_TOKEN=<masukkan-kunci-di-sini>",
        "DB_PASSWORD=ganti-ini-sebelum-dipakai",
        "API_KEY=your-key-here",
      ].join("\n"),
    );
    expect(h.jumlah).toBe(0);
  });

  it("kata pendek bukan rahasia", () => {
    expect(sunting("import sk-learn").jumlah).toBe(0);
    expect(sunting("AKIA belum tentu kunci").jumlah).toBe(0);
  });
});

describe("suntingHasilAlat", () => {
  it("mengembalikan teks apa adanya kalau tidak ada yang disunting", () => {
    const teks = "isi berkas biasa";
    expect(suntingHasilAlat(teks)).toBe(teks);
  });

  it("menyebut penyuntingannya DI ATAS isinya", () => {
    // Ditaruh di bawah, model yang berhenti membaca di tengah tidak akan
    // pernah melihatnya — lalu menjawab seolah berkasnya utuh.
    const hasil = suntingHasilAlat(`baris pertama\nAPI_KEY=${KUNCI.github}\nbaris terakhir`);
    const kepala = hasil.slice(0, hasil.indexOf("\n"));
    expect(kepala.toLowerCase()).toContain("menyunting");
    expect(hasil).not.toContain(KUNCI.github);
  });

  it("menyebut jumlahnya, bukan cuma bahwa ada", () => {
    const hasil = suntingHasilAlat(`${KUNCI.github}\n${KUNCI.aws}`);
    expect(hasil).toContain("2 rahasia");
  });
});

describe("penyuntingan tidak boleh merusak berkas yang sah", () => {
  it("JSON tetap bisa diurai setelah disunting", () => {
    // Koma yang hilang mengubah berkas JSON yang sah jadi berkas rusak, dan
    // model akan melaporkan kerusakan yang kita sendiri yang membuatnya.
    const asli = JSON.stringify(
      { nama: "tiburon", apiKey: "kunci-rahasia-yang-panjang", port: 3000 },
      null,
      2,
    );
    const h = sunting(asli);
    expect(h.jumlah).toBe(1);
    const urai = JSON.parse(h.teks) as Record<string, unknown>;
    expect(urai.apiKey).toBe(PENANDA);
    // Sekitarnya utuh, termasuk yang datang SESUDAH baris yang disunting.
    expect(urai.nama).toBe("tiburon");
    expect(urai.port).toBe(3000);
  });
});
