export const runtime = "nodejs";

import {
  daftarProyek,
  buatProyek,
  ubahProyek,
  hapusProyek,
  pindahkan,
} from "@/lib/proyek";

/**
 *   GET                                 -> daftar proyek + jumlah percakapan
 *   POST   { nama }                     -> buat proyek
 *   PATCH  { id, nama?, instruksi? }    -> ubah proyek
 *   PATCH  { percakapan, proyek|null }  -> pindahkan percakapan
 *   DELETE ?id=xxx                      -> hapus proyek (isinya dilepas, bukan dihapus)
 */
export async function GET() {
  try {
    return Response.json(daftarProyek());
  } catch (e) {
    return Response.json({ pesan: `Gagal membaca proyek: ${(e as Error).message}` }, { status: 500 });
  }
}

async function objek(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    if (typeof b !== "object" || b === null || Array.isArray(b)) return null;
    return b as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const badan = await objek(req);
  if (!badan) return Response.json({ pesan: "Badan permintaan harus objek JSON" }, { status: 400 });

  const { nama } = badan;
  if (typeof nama !== "string" || !nama.trim()) {
    return Response.json({ pesan: "Butuh nama proyek" }, { status: 400 });
  }

  try {
    return Response.json(buatProyek(nama));
  } catch (e) {
    return Response.json({ pesan: (e as Error).message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const badan = await objek(req);
  if (!badan) return Response.json({ pesan: "Badan permintaan harus objek JSON" }, { status: 400 });

  // Memindahkan percakapan ke proyek. `proyek: null` mengeluarkannya, jadi
  // yang diperiksa keberadaan kuncinya, bukan kebenaran nilainya — `null`
  // adalah nilai yang SAH di sini, bukan nilai yang hilang.
  if (typeof badan.percakapan === "string") {
    const tujuan = badan.proyek;
    if (tujuan !== null && typeof tujuan !== "string") {
      return Response.json({ pesan: "proyek harus id atau null" }, { status: 400 });
    }
    try {
      const ada = pindahkan(badan.percakapan, tujuan);
      if (!ada) return Response.json({ pesan: "Percakapan tidak ditemukan" }, { status: 404 });
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ pesan: `Gagal memindahkan: ${(e as Error).message}` }, { status: 500 });
    }
  }

  const { id, nama, instruksi } = badan;
  if (typeof id !== "string") {
    return Response.json({ pesan: "Butuh id proyek" }, { status: 400 });
  }

  try {
    const ada = ubahProyek(id, {
      nama: typeof nama === "string" ? nama : undefined,
      instruksi: typeof instruksi === "string" ? instruksi : undefined,
    });
    if (!ada) return Response.json({ pesan: "Proyek tidak ditemukan, atau tidak ada yang diubah" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ pesan: `Gagal mengubah: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ pesan: "Butuh id" }, { status: 400 });

  try {
    const ada = hapusProyek(id);
    if (!ada) return Response.json({ pesan: "Proyek tidak ditemukan" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ pesan: `Gagal menghapus: ${(e as Error).message}` }, { status: 500 });
  }
}
