import { describe, it, expect, vi, afterEach } from "vitest";
import { kirim, susunPrompt } from "@/lib/penyedia";

afterEach(() => vi.unstubAllGlobals());

function responsSSE(teks: string) {
  const body = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(
        `data: ${JSON.stringify({ choices: [{ delta: { content: teks } }] })}\n\n`,
      ));
      c.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe("susunPrompt", () => {
  it("menyisipkan potongan korpus beserta nama berkasnya", () => {
    const p = susunPrompt(
      [{ role: "user", content: "apa itu enkripsi?" }],
      [{ path: "D:/x/buku.md", teks: "Enkripsi adalah...", skor: -1 }],
    );
    const sistem = p.find((m) => m.role === "system")!;
    expect(sistem.content).toContain("buku.md");
    expect(sistem.content).toContain("Enkripsi adalah");
  });

  it("tanpa korpus, tidak mengarang bagian sumber", () => {
    const p = susunPrompt([{ role: "user", content: "halo" }], []);
    expect(p.find((m) => m.role === "system")!.content).not.toContain("SUMBER");
  });
});

describe("kirim", () => {
  it("memancarkan model yang menjawab lalu teksnya", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responsSSE("halo")));
    const kejadian = [];
    for await (const k of kirim([{ role: "user", content: "hai" }], { rantai: ["model-a"] })) {
      kejadian.push(k);
    }
    expect(kejadian[0]).toEqual({ jenis: "model", nama: "model-a" });
    expect(kejadian.some((k) => k.jenis === "teks" && k.teks === "halo")).toBe(true);
  });

  it("pindah ke model berikutnya saat model pertama gagal", async () => {
    const panggil = vi.fn()
      .mockResolvedValueOnce(new Response("kuota habis", { status: 429 }))
      .mockResolvedValueOnce(responsSSE("dari cadangan"));
    vi.stubGlobal("fetch", panggil);

    const kejadian = [];
    for await (const k of kirim([{ role: "user", content: "hai" }], { rantai: ["a", "b"] })) {
      kejadian.push(k);
    }
    expect(panggil).toHaveBeenCalledTimes(2);
    expect(kejadian.find((k) => k.jenis === "model")).toEqual({ jenis: "model", nama: "b" });
  });

  it("saat SEMUA model gagal, menyebut tiap model dan sebabnya", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("kuota habis", { status: 429 })));
    const kejadian = [];
    for await (const k of kirim([{ role: "user", content: "hai" }], { rantai: ["a", "b"] })) {
      kejadian.push(k);
    }
    const gagal = kejadian.at(-1)!;
    if (gagal.jenis !== "gagal") {
      throw new Error(`kejadian terakhir seharusnya "gagal", dapat: ${gagal.jenis}`);
    }
    expect(gagal.pesan).toContain("a");
    expect(gagal.pesan).toContain("b");
    expect(gagal.pesan).toContain("429");
  });
});
