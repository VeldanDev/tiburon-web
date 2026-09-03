import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/korpus", () => ({
  periksaSkema: vi.fn(() => ({ cocok: true })),
  cari: vi.fn(() => [{ path: "D:/x/buku.md", teks: "isi buku", skor: -1 }]),
  dbBawaan: vi.fn(() => "x"),
}));

vi.mock("@/lib/penyedia", async () => ({
  kirim: async function* () {
    yield { jenis: "model", nama: "model-uji" };
    yield { jenis: "teks", teks: "jawaban" };
  },
  susunPrompt: (p: unknown) => p,
  RANTAI_BAWAAN: ["model-uji"],
}));

const { POST } = await import("@/app/api/cepat/route");
const { cari, periksaSkema } = await import("@/lib/korpus");

function permintaan(body: unknown) {
  return new Request("http://localhost/api/cepat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function bacaSemua(resp: Response): Promise<string> {
  return await resp.text();
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/cepat", () => {
  it("jalur tiburon mencari korpus dan mengumumkan sumbernya", async () => {
    const resp = await POST(permintaan({ jalur: "tiburon", pesan: [{ role: "user", content: "apa itu enkripsi" }] }));
    const teks = await bacaSemua(resp);
    expect(cari).toHaveBeenCalled();
    expect(teks).toContain('"jenis":"sumber"');
    expect(teks).toContain("buku.md");
    expect(teks).toContain('"teks":"jawaban"');
  });

  it("jalur cepat TIDAK menyentuh korpus", async () => {
    const resp = await POST(permintaan({ jalur: "cepat", pesan: [{ role: "user", content: "halo" }] }));
    await bacaSemua(resp);
    expect(cari).not.toHaveBeenCalled();
  });

  it("saat skema korpus berubah, memancarkan peringatan dan tetap menjawab", async () => {
    vi.mocked(periksaSkema).mockReturnValueOnce({ cocok: false, alasan: "tabel hilang: memory_index_chunks" });
    const resp = await POST(permintaan({ jalur: "tiburon", pesan: [{ role: "user", content: "x" }] }));
    const teks = await bacaSemua(resp);
    expect(teks).toContain('"jenis":"peringatan"');
    expect(teks).toContain("memory_index_chunks");
    expect(teks).toContain('"teks":"jawaban"');
  });

  it("menolak badan permintaan tanpa pesan", async () => {
    const resp = await POST(permintaan({ jalur: "cepat" }));
    expect(resp.status).toBe(400);
  });

  it("saat cari() MELEMPAR di tengah, memancarkan peringatan dan tetap menjawab", async () => {
    // cari() melempar pada kegagalan nyata (tabel hilang saat OpenClaw reindex,
    // berkas korup, galat I/O). Aliran SSE tidak boleh putus di tengah dan
    // meninggalkan pengguna dengan jawaban terpotong tanpa penjelasan.
    vi.mocked(cari).mockImplementationOnce(() => {
      throw new Error("no such table: memory_index_chunks_fts");
    });
    const resp = await POST(permintaan({ jalur: "tiburon", pesan: [{ role: "user", content: "x" }] }));
    const teks = await bacaSemua(resp);
    expect(teks).toContain('"jenis":"peringatan"');
    expect(teks).toContain("no such table");
    expect(teks).toContain('"teks":"jawaban"');
    expect(teks).toContain('"jenis":"selesai"');
  });

  it("tidak pernah mengirim kunci API ke klien", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-v1-RAHASIA-JANGAN-BOCOR";
    const resp = await POST(permintaan({ jalur: "cepat", pesan: [{ role: "user", content: "halo" }] }));
    const teks = await bacaSemua(resp);
    expect(teks).not.toContain("RAHASIA-JANGAN-BOCOR");
    expect(teks).not.toContain("sk-or-v1");
  });

  it("menolak badan JSON yang bukan objek, dengan 400 bukan 500", async () => {
    for (const badan of ["null", "[]", "42", '"halo"']) {
      const resp = await POST(
        new Request("http://localhost/api/cepat", { method: "POST", body: badan }),
      );
      expect(resp.status, `badan ${badan} seharusnya 400`).toBe(400);
      expect(await resp.text()).toMatch(/objek/i);
    }
  });
});
