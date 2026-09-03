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

const { GET, POST, PUT, PATCH, DELETE } = await import("@/app/api/percakapan/route");

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

describe("ganti nama dan hapus", () => {
  async function buat(judul: string): Promise<string> {
    const r = await POST(
      new Request("http://localhost/api/percakapan", {
        method: "POST",
        body: JSON.stringify({ judul }),
      }),
    );
    return (await r.json()).id;
  }

  it("mengganti judul tanpa mengubah urutan sidebar", async () => {
    const lama = await buat("Lama");
    // Jeda 2ms supaya `diperbarui` keduanya pasti berbeda; tanpa itu urutan
    // ditentukan tie-breaker rowid dan uji ini tidak menguji apa pun.
    await new Promise((r) => setTimeout(r, 2));
    const baru = await buat("Baru");

    await PATCH(
      new Request("http://localhost/api/percakapan", {
        method: "PATCH",
        body: JSON.stringify({ id: lama, judul: "Lama, diganti nama" }),
      }),
    );

    const daftar = await (await GET(new Request("http://localhost/api/percakapan"))).json();
    // Yang baru TETAP di atas: mengganti nama bukan "memakai" percakapan.
    expect(daftar[0].id).toBe(baru);
    expect(daftar[1].judul).toBe("Lama, diganti nama");
  });

  it("membalas 404 saat mengganti judul percakapan yang tidak ada", async () => {
    const r = await PATCH(
      new Request("http://localhost/api/percakapan", {
        method: "PATCH",
        body: JSON.stringify({ id: "tidak-ada", judul: "x" }),
      }),
    );
    expect(r.status).toBe(404);
  });

  it("menghapus percakapan beserta pesannya, tanpa meninggalkan yatim", async () => {
    const id = await buat("Akan dihapus");
    await PUT(
      new Request("http://localhost/api/percakapan", {
        method: "PUT",
        body: JSON.stringify({ id, pesan: { role: "user", content: "halo" } }),
      }),
    );

    const r = await DELETE(new Request(`http://localhost/api/percakapan?id=${id}`, { method: "DELETE" }));
    expect(r.status).toBe(200);

    expect(await (await GET(new Request("http://localhost/api/percakapan"))).json()).toEqual([]);

    // Inti ujinya: skema ini TIDAK punya FOREIGN KEY, jadi SQLite tidak
    // merapikan pesannya sendiri. Kalau hapusPercakapan lupa menghapus baris
    // pesan, baris itu tetap tinggal di basis data selamanya tanpa terlihat.
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(process.env.TIBURON_RIWAYAT_DB!);
    try {
      const sisa = db.prepare("SELECT COUNT(*) AS n FROM pesan").get() as { n: number };
      expect(sisa.n).toBe(0);
    } finally {
      db.close();
    }
  });

  it("membalas 404 saat menghapus yang tidak ada, dan 400 tanpa id", async () => {
    expect(
      (await DELETE(new Request("http://localhost/api/percakapan?id=hantu", { method: "DELETE" }))).status,
    ).toBe(404);
    expect(
      (await DELETE(new Request("http://localhost/api/percakapan", { method: "DELETE" }))).status,
    ).toBe(400);
  });
});
