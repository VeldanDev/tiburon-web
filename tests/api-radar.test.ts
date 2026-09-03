import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/radar-parser", () => ({
  bacaRadar: vi.fn((d: Date) =>
    d.getFullYear() === 2026
      ? { tanggal: "2026-09-03", berita: [{ nomor: 1, kategori: "AI", judul: "J", ringkasan: "R", sumber: "S", url: "https://x.test" }], github: [] }
      : null),
  dirRadar: () => "x",
}));

const { GET } = await import("@/app/api/radar/route");
const { bacaRadar } = await import("@/lib/radar-parser");

describe("GET /api/radar", () => {
  it("mengembalikan laporan untuk tanggal yang ada", async () => {
    const resp = await GET(new Request("http://localhost/api/radar?tanggal=2026-09-03"));
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.berita).toHaveLength(1);
  });

  it("membalas 404 dengan pesan yang menjelaskan, bukan halaman kosong", async () => {
    const resp = await GET(new Request("http://localhost/api/radar?tanggal=1999-01-01"));
    expect(resp.status).toBe(404);
    const data = await resp.json();
    expect(data.pesan).toContain("06:30");
  });

  it("menolak tanggal yang tidak valid", async () => {
    const resp = await GET(new Request("http://localhost/api/radar?tanggal=bukan-tanggal"));
    expect(resp.status).toBe(400);
  });

  it("berkas ADA tapi kosong dibedakan dari radar yang belum jalan", async () => {
    // Berkas format lama terurai jadi 0 item. Kalau ini terlihat sama dengan
    // "radar belum jalan", pengguna tidak punya cara tahu bedanya.
    vi.mocked(bacaRadar).mockReturnValueOnce({
      tanggal: "2026-09-01", berita: [], github: [],
    });
    const resp = await GET(new Request("http://localhost/api/radar?tanggal=2026-09-01"));
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.catatan).toBeTruthy();
    expect(data.catatan).toMatch(/format lama/i);
  });

  it("SATU bagian kosong saja sudah cukup untuk memunculkan catatan", async () => {
    // Kalau suatu hari hanya header GitHub yang berubah nama, bagian itu
    // kosong sementara berita tetap terisi. Pemeriksaan gabungan (&&) akan
    // melewatkannya; pemeriksaan per-bagian tidak.
    vi.mocked(bacaRadar).mockReturnValueOnce({
      tanggal: "2026-09-02",
      berita: [{ nomor: 1, kategori: "AI", judul: "J", ringkasan: "R", sumber: "S", url: "https://x.test" }],
      github: [],
    });
    const resp = await GET(new Request("http://localhost/api/radar?tanggal=2026-09-02"));
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.catatan).toMatch(/GitHub Trending/);
    expect(data.catatan).not.toMatch(/berita teknologi dunia/);
  });
});
