/**
 * Gelung agen.
 *
 * Yang diuji adalah pagar-pagarnya, bukan kecerdasan modelnya: batas putaran,
 * pembatalan, bentuk pesan yang dikirim balik, dan failover antar-model.
 * Ketiganya adalah tempat kuota bisa terbakar diam-diam.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/alat", () => ({
  SKEMA_ALAT: [
    {
      type: "function",
      function: {
        name: "cari_korpus",
        description: "x".repeat(40),
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
  ],
  jalankanAlat: vi.fn(() => "hasil alat"),
  ringkasPanggilan: vi.fn(() => "Mencari korpus"),
}));

const { jalankanAgen, BATAS_PUTARAN } = await import("@/lib/agen");
const alat = await import("@/lib/alat");

/** Balasan model yang memanggil alat. */
function panggilAlat(id = "c1") {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: "",
            tool_calls: [{ id, type: "function", function: { name: "cari_korpus", arguments: "{}" } }],
          },
        },
      ],
    }),
  };
}

/** Balasan model yang langsung menjawab. */
function jawab(teks = "Jawabannya begini.") {
  return { ok: true, json: async () => ({ choices: [{ message: { content: teks } }] }) };
}

async function kumpulkan(gen: AsyncGenerator<unknown>) {
  const hasil = [];
  for await (const k of gen) hasil.push(k);
  return hasil as { jenis: string; [k: string]: unknown }[];
}

beforeEach(() => vi.restoreAllMocks());

describe("jalankanAgen", () => {
  it("menjawab langsung kalau model tidak memanggil alat", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jawab("Halo.")));
    const k = await kumpulkan(jalankanAgen([{ role: "user", content: "halo" }]));
    expect(k.map((x) => x.jenis)).toEqual(["model", "teks"]);
    expect(k[1].teks).toBe("Halo.");
  });

  it("memancarkan alat-mulai dan alat-selesai lalu menjawab", async () => {
    const f = vi.fn();
    f.mockResolvedValueOnce(panggilAlat()).mockResolvedValueOnce(jawab());
    vi.stubGlobal("fetch", f);

    const k = await kumpulkan(jalankanAgen([{ role: "user", content: "cari" }]));
    expect(k.map((x) => x.jenis)).toEqual(["model", "alat-mulai", "alat-selesai", "teks"]);
    expect(k[2].hasil).toBe("hasil alat");
  });

  // Tiap putaran mengirim SELURUH percakapan plus hasil alat sebelumnya kembali
  // ke model. Tanpa batas, agen yang macet membakar kuota tanpa suara.
  it("berhenti setelah BATAS_PUTARAN dan mengatakannya terus terang", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => panggilAlat()));

    const k = await kumpulkan(jalankanAgen([{ role: "user", content: "cari" }]));
    const mulai = k.filter((x) => x.jenis === "alat-mulai");
    expect(mulai).toHaveLength(BATAS_PUTARAN);

    const akhir = k[k.length - 1];
    expect(akhir.jenis).toBe("teks");
    expect(String(akhir.teks)).toContain("Berhenti setelah");
  });

  it("berhenti seketika saat sinyal dibatalkan", async () => {
    const kontrol = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        kontrol.abort();
        return panggilAlat();
      }),
    );

    const k = await kumpulkan(
      jalankanAgen([{ role: "user", content: "cari" }], { signal: kontrol.signal }),
    );
    // Tidak pernah sampai ke putaran kedua.
    expect(k.filter((x) => x.jenis === "alat-mulai").length).toBeLessThanOrEqual(1);
    expect(k.some((x) => x.jenis === "gagal")).toBe(false);
  });

  it("pindah ke model berikutnya saat yang pertama gagal", async () => {
    const f = vi.fn();
    f.mockResolvedValueOnce({ ok: false, status: 429 }).mockResolvedValueOnce(jawab("Dari cadangan."));
    vi.stubGlobal("fetch", f);

    const k = await kumpulkan(
      jalankanAgen([{ role: "user", content: "halo" }], { rantai: ["a", "b"] }),
    );
    expect(k.filter((x) => x.jenis === "model").map((x) => x.nama)).toEqual(["a", "b"]);
    expect(k[k.length - 1].teks).toBe("Dari cadangan.");
  });

  // Gelembung kosong adalah kegagalan senyap -- pola genspark yang membalas
  // HTTP 200 berisi teks tagihan sehingga failover tak pernah terpicu.
  it("menghitung balasan kosong sebagai gagal, bukan sukses", async () => {
    const f = vi.fn();
    f.mockResolvedValueOnce(jawab("")).mockResolvedValueOnce(jawab("Isi sungguhan."));
    vi.stubGlobal("fetch", f);

    const k = await kumpulkan(
      jalankanAgen([{ role: "user", content: "halo" }], { rantai: ["a", "b"] }),
    );
    expect(k[k.length - 1].teks).toBe("Isi sungguhan.");
  });

  it("membalas gagal kalau seluruh rantai habis", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    const k = await kumpulkan(
      jalankanAgen([{ role: "user", content: "halo" }], { rantai: ["a", "b"] }),
    );
    expect(k[k.length - 1].jenis).toBe("gagal");
    expect(String(k[k.length - 1].pesan)).toContain("Semua model gagal");
  });

  // API menolak pesan `tool` yang tidak punya panggilan pasangannya tepat di
  // atasnya. Kalau pesan asisten pembawa tool_calls lupa disimpan, putaran
  // kedua akan ditolak 400 -- dan itu terlihat sebagai "model gagal".
  it("menyertakan pesan asisten pembawa tool_calls sebelum hasil alatnya", async () => {
    const f = vi.fn();
    f.mockResolvedValueOnce(panggilAlat("abc")).mockResolvedValueOnce(jawab());
    vi.stubGlobal("fetch", f);

    await kumpulkan(jalankanAgen([{ role: "user", content: "cari" }]));

    const badan = JSON.parse(f.mock.calls[1][1].body);
    const peran = badan.messages.map((m: { role: string }) => m.role);
    expect(peran).toEqual(["system", "user", "assistant", "tool"]);
    expect(badan.messages[2].tool_calls[0].id).toBe("abc");
    expect(badan.messages[3].tool_call_id).toBe("abc");
  });

  it("membangun ulang percakapan untuk tiap model dalam rantai", async () => {
    const f = vi.fn();
    f.mockResolvedValueOnce(panggilAlat())
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce(jawab("Dari cadangan."));
    vi.stubGlobal("fetch", f);

    await kumpulkan(jalankanAgen([{ role: "user", content: "cari" }], { rantai: ["a", "b"] }));

    // Model kedua TIDAK boleh mewarisi tool_calls milik model pertama yang
    // gagal di tengah -- API menolak pesan `tool` yang yatim.
    const badanKedua = JSON.parse(f.mock.calls[2][1].body);
    expect(badanKedua.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
  });
});

describe("agen menyebut sumbernya", () => {
  /**
   * Jalur Agen membaca korpus paling banyak, tapi dulu satu-satunya jalur
   * yang tidak pernah memancarkan kejadian `sumber`. Akibatnya jawaban paling
   * teliti justru yang tidak bisa diperiksa: tidak ada chip sumber, tidak ada
   * yang bisa dibuka, dan tidak ada yang tercatat di Riwayat sumber.
   */
  function alatMelapor(berkas: string[], kueri: string) {
    vi.mocked(alat.jalankanAlat).mockImplementation((_n, _a, lapor) => {
      lapor?.(berkas, kueri);
      return "hasil alat";
    });
  }

  it("mengumpulkan berkas dari panggilan alat lalu mengumumkannya", async () => {
    alatMelapor(["rem/2026-09-03.md", "MEMORY.md"], "mimpi rem");
    const f = vi.fn();
    f.mockResolvedValueOnce(panggilAlat()).mockResolvedValueOnce(jawab());
    vi.stubGlobal("fetch", f);

    const k = await kumpulkan(jalankanAgen([{ role: "user", content: "cari" }]));
    const sumber = k.find((x) => x.jenis === "sumber");

    expect(sumber).toBeTruthy();
    expect(sumber!.berkas).toEqual(["rem/2026-09-03.md", "MEMORY.md"]);
    // Kueri agen ikut: kartu sumber memakainya untuk mencari ulang potongannya.
    // Dengan pertanyaan mentah penggunanya, kartunya bisa terbuka kosong.
    expect(sumber!.kueri).toBe("mimpi rem");
  });

  it("mengumumkannya SEKALI walau alat dipanggil berkali-kali", async () => {
    // Layar obrolan mencatat tiap kejadian sumber ke Riwayat sumber. Dipancarkan
    // per panggilan, satu jawaban akan terhitung berkali-kali di sana.
    alatMelapor(["MEMORY.md"], "satu");
    const f = vi.fn();
    f.mockResolvedValueOnce(panggilAlat("a"))
      .mockResolvedValueOnce(panggilAlat("b"))
      .mockResolvedValueOnce(jawab());
    vi.stubGlobal("fetch", f);

    const k = await kumpulkan(jalankanAgen([{ role: "user", content: "cari" }]));
    expect(k.filter((x) => x.jenis === "sumber")).toHaveLength(1);
    // Dan berkas yang sama tidak tercatat dua kali.
    expect(k.find((x) => x.jenis === "sumber")!.berkas).toEqual(["MEMORY.md"]);
  });

  it("diam kalau tidak ada alat yang menyentuh korpus", async () => {
    // Chip sumber kosong di bawah jawaban terbaca seperti fitur rusak.
    vi.mocked(alat.jalankanAlat).mockImplementation(() => "hasil alat");
    const f = vi.fn();
    f.mockResolvedValueOnce(panggilAlat()).mockResolvedValueOnce(jawab());
    vi.stubGlobal("fetch", f);

    const k = await kumpulkan(jalankanAgen([{ role: "user", content: "cari" }]));
    expect(k.filter((x) => x.jenis === "sumber")).toHaveLength(0);
  });
});
