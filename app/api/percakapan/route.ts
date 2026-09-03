export const runtime = "nodejs";

import {
  buatPercakapan,
  tambahPesan,
  ambilPercakapan,
  daftarPercakapan,
} from "@/lib/riwayat";

/**
 * Riwayat percakapan.
 *
 * Gateway OpenClaw TIDAK menyimpan riwayat — diuji langsung: pesan kedua
 * tidak mengingat pesan pertama. Jadi aplikasi ini yang menyimpannya, dan
 * rute inilah jembatannya ke lib/riwayat.ts.
 *
 *   GET  /api/percakapan          -> daftar ringkas, terbaru di atas
 *   GET  /api/percakapan?id=xxx   -> isi satu percakapan
 *   POST { judul }                -> buat percakapan, balas { id }
 *   PUT  { id, pesan }            -> tambah satu pesan
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  try {
    return Response.json(id ? ambilPercakapan(id) : daftarPercakapan());
  } catch (e) {
    // Daftar kosong dan gagal membaca TIDAK boleh terlihat sama: yang pertama
    // berarti belum ada obrolan, yang kedua berarti ada yang rusak.
    return Response.json({ pesan: `Gagal membaca riwayat: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return Response.json({ pesan: "Badan permintaan bukan JSON" }, { status: 400 });
  }
  if (typeof badan !== "object" || badan === null || Array.isArray(badan)) {
    return Response.json({ pesan: "Badan permintaan harus objek JSON" }, { status: 400 });
  }

  const { judul } = badan as { judul?: unknown };
  if (typeof judul !== "string" || !judul.trim()) {
    return Response.json({ pesan: "Butuh judul" }, { status: 400 });
  }

  try {
    return Response.json({ id: buatPercakapan(judul) });
  } catch (e) {
    return Response.json({ pesan: `Gagal membuat percakapan: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return Response.json({ pesan: "Badan permintaan bukan JSON" }, { status: 400 });
  }
  if (typeof badan !== "object" || badan === null || Array.isArray(badan)) {
    return Response.json({ pesan: "Badan permintaan harus objek JSON" }, { status: 400 });
  }

  const { id, pesan } = badan as { id?: unknown; pesan?: unknown };
  const isiPesan = pesan as { role?: unknown; content?: unknown } | undefined;
  if (
    typeof id !== "string" ||
    typeof isiPesan?.role !== "string" ||
    typeof isiPesan?.content !== "string"
  ) {
    return Response.json({ pesan: "Butuh id dan pesan{role,content}" }, { status: 400 });
  }

  try {
    tambahPesan(id, { role: isiPesan.role as "user" | "assistant", content: isiPesan.content });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ pesan: `Gagal menyimpan pesan: ${(e as Error).message}` }, { status: 500 });
  }
}
