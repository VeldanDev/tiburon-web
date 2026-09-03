export const runtime = "nodejs";

import {
  ambilPengaturan,
  simpanInstruksi,
  tambahIngatan,
  hapusIngatan,
  BATAS_INSTRUKSI,
} from "@/lib/pengaturan";

/**
 * Instruksi khusus dan ingatan tetap.
 *
 *   GET                      -> { instruksi, ingatan[] }
 *   PUT   { instruksi }      -> simpan instruksi khusus
 *   POST  { isi }            -> tambah satu butir ingatan
 *   DELETE ?id=xxx           -> hapus satu butir ingatan
 */
export async function GET() {
  try {
    return Response.json({ ...ambilPengaturan(), batasInstruksi: BATAS_INSTRUKSI });
  } catch (e) {
    return Response.json({ pesan: `Gagal membaca pengaturan: ${(e as Error).message}` }, { status: 500 });
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

export async function PUT(req: Request) {
  const badan = await objek(req);
  if (!badan) return Response.json({ pesan: "Badan permintaan harus objek JSON" }, { status: 400 });

  const { instruksi } = badan;
  // String kosong SAH: itulah cara menghapus instruksi khusus. Menolaknya
  // berarti sekali diisi, ia tidak akan pernah bisa dikosongkan lagi.
  if (typeof instruksi !== "string") {
    return Response.json({ pesan: "Butuh instruksi berupa teks" }, { status: 400 });
  }

  try {
    simpanInstruksi(instruksi);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ pesan: `Gagal menyimpan: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const badan = await objek(req);
  if (!badan) return Response.json({ pesan: "Badan permintaan harus objek JSON" }, { status: 400 });

  const { isi } = badan;
  if (typeof isi !== "string" || !isi.trim()) {
    return Response.json({ pesan: "Butuh isi ingatan" }, { status: 400 });
  }

  try {
    return Response.json(tambahIngatan(isi));
  } catch (e) {
    // Batas jumlah tercapai adalah penolakan yang WAJAR, bukan kerusakan
    // server — 400, supaya antarmuka bisa menampilkan alasannya apa adanya.
    return Response.json({ pesan: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ pesan: "Butuh id" }, { status: 400 });

  try {
    const ada = hapusIngatan(id);
    if (!ada) return Response.json({ pesan: "Ingatan tidak ditemukan" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ pesan: `Gagal menghapus: ${(e as Error).message}` }, { status: 500 });
  }
}
