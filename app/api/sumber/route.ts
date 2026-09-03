export const runtime = "nodejs";

import { catatSumber, ringkasSumber } from "@/lib/sumber-terpakai";
import { daftarBerkas, periksaSkema } from "@/lib/korpus";

/**
 * GET  — ringkasan berkas korpus yang pernah menjawab, DAN yang belum pernah.
 * POST — catat satu jawaban: berkas apa saja yang dipakai, untuk pertanyaan apa.
 *
 * Yang belum pernah terpakai sama pentingnya dengan yang sering: itu daftar
 * materi yang menumpuk tanpa pernah relevan dengan apa yang benar-benar
 * dikerjakan.
 */
export async function GET() {
  const terpakai = ringkasSumber();

  const skema = periksaSkema();
  if (!skema.cocok) {
    return Response.json({
      terpakai,
      belum: [],
      totalKorpus: 0,
      pesan: `Daftar korpus tidak terbaca — ${skema.alasan}`,
    });
  }

  const semua = daftarBerkas().map((b) => ({
    berkas: b.path.split(/[\\/]/).pop() ?? b.path,
    potongan: b.potongan,
  }));
  const namaTerpakai = new Set(terpakai.map((t) => t.berkas));

  return Response.json({
    terpakai,
    belum: semua.filter((s) => !namaTerpakai.has(s.berkas)),
    totalKorpus: semua.length,
  });
}

export async function POST(req: Request) {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return new Response("Badan permintaan bukan JSON", { status: 400 });
  }
  if (typeof badan !== "object" || badan === null || Array.isArray(badan)) {
    return new Response("Badan permintaan harus objek JSON", { status: 400 });
  }

  const { berkas, kueri } = badan as { berkas?: unknown; kueri?: unknown };
  if (!Array.isArray(berkas) || typeof kueri !== "string") {
    return new Response("Butuh berkas[] dan kueri", { status: 400 });
  }

  try {
    catatSumber(berkas.filter((b): b is string => typeof b === "string"), kueri);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, pesan: (e as Error).message }, { status: 500 });
  }
}
