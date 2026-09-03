/**
 * Rute riwayat percakapan.
 *
 * Rute ini sempat TIDAK ADA sama sekali sementara sidebar sudah memanggilnya,
 * jadi setiap kali aplikasi dibuka muncul spanduk "HTTP 404". Uji pertama di
 * bawah adalah penjaga khusus untuk itu: kalau berkas rutenya hilang lagi,
 * atau GET-nya tidak diekspor, uji ini gagal sebelum ada yang membuka aplikasi.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tiburon-percakapan-"));
  process.env.TIBURON_RIWAYAT_DB = path.join(dir, "riwayat.sqlite");
});

afterEach(() => {
  delete process.env.TIBURON_RIWAYAT_DB;
  rmSync(dir, { recursive: true, force: true });
});

const { GET, POST, PUT } = await import("@/app/api/percakapan/route");

describe("/api/percakapan", () => {
  it("membalas daftar kosong, bukan 404, ketika belum ada obrolan", async () => {
    const resp = await GET(new Request("http://localhost/api/percakapan"));
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual([]);
  });

  it("membuat percakapan lalu mengembalikannya di daftar", async () => {
    const dibuat = await POST(
      new Request("http://localhost/api/percakapan", {
        method: "POST",
        body: JSON.stringify({ judul: "Uji hiu" }),
      }),
    );
    expect(dibuat.status).toBe(200);
    const { id } = await dibuat.json();
    expect(typeof id).toBe("string");

    const daftar = await (await GET(new Request("http://localhost/api/percakapan"))).json();
    expect(daftar).toHaveLength(1);
    expect(daftar[0].judul).toBe("Uji hiu");
  });

  it("menyimpan pesan dan mengembalikannya berurutan", async () => {
    const { id } = await (
      await POST(
        new Request("http://localhost/api/percakapan", {
          method: "POST",
          body: JSON.stringify({ judul: "Berurutan" }),
        }),
      )
    ).json();

    for (const [role, content] of [
      ["user", "halo"],
      ["assistant", "halo juga"],
    ] as const) {
      const r = await PUT(
        new Request("http://localhost/api/percakapan", {
          method: "PUT",
          body: JSON.stringify({ id, pesan: { role, content } }),
        }),
      );
      expect(r.status).toBe(200);
    }

    const isi = await (
      await GET(new Request(`http://localhost/api/percakapan?id=${id}`))
    ).json();
    expect(isi.map((p: { content: string }) => p.content)).toEqual(["halo", "halo juga"]);
  });

  // Badan yang cacat harus dibalas 400 dengan penjelasan, BUKAN 500 dari
  // TypeError yang tidak tertangkap. `null` dan array sengaja diuji terpisah:
  // keduanya lolos dari `typeof x === "object"` dan pernah meruntuhkan rute
  // lain di proyek ini lewat destrukturisasi.
  it.each([
    ["bukan json", "{{{"],
    ["null", "null"],
    ["array", "[]"],
    ["tanpa judul", "{}"],
    ["judul kosong", '{"judul":"   "}'],
  ])("menolak badan %s dengan 400", async (_nama, badan) => {
    const resp = await POST(
      new Request("http://localhost/api/percakapan", { method: "POST", body: badan }),
    );
    expect(resp.status).toBe(400);
    expect((await resp.json()).pesan).toBeTruthy();
  });

  it("menolak PUT tanpa pesan yang lengkap", async () => {
    const resp = await PUT(
      new Request("http://localhost/api/percakapan", {
        method: "PUT",
        body: JSON.stringify({ id: "x", pesan: { role: "user" } }),
      }),
    );
    expect(resp.status).toBe(400);
  });
});
