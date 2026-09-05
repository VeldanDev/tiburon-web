export const runtime = "nodejs";

import { kirim, type Pesan } from "@/lib/penyedia";
import { ambilPercakapan } from "@/lib/riwayat";
import { personaPercakapan } from "@/lib/persona";
import { JIWA_SAMPING, susunTanyaSamping } from "@/lib/tanya-samping";

/**
 * Pertanyaan sampingan tentang sebuah percakapan.
 *
 * Dialirkan seperti jawaban biasa supaya terasa sama cepatnya, tapi TIDAK
 * pernah menyentuh riwayat: tidak ada yang disimpan di sini, dan pemanggilnya
 * di klien juga tidak menyimpannya.
 *
 * Transkripnya dibaca DI SERVER dari id percakapan. Klien memang punya
 * riwayatnya di layar, tapi mengirimkannya balik berarti isi prompt datang
 * dari browser — jalur yang sudah ditutup di setiap rute lain di sini.
 */
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

  const { percakapan, tanya } = badan as { percakapan?: unknown; tanya?: unknown };
  if (typeof tanya !== "string" || !tanya.trim()) {
    return Response.json({ pesan: "Butuh pertanyaan" }, { status: 400 });
  }

  let riwayat: Pesan[] = [];
  if (typeof percakapan === "string" && percakapan) {
    try {
      riwayat = ambilPercakapan(percakapan).map((p) => ({ role: p.role, content: p.content }));
    } catch {
      // Riwayat yang tidak terbaca berarti pertanyaan dijawab tanpa konteks,
      // bukan galat: model akan mengatakan sendiri kalau transkripnya kosong.
    }
  }

  // Persona percakapan sengaja hanya dipakai untuk RANTAI MODELNYA, bukan
  // jiwanya: pertanyaan sampingan punya tugas berbeda (menjawab TENTANG
  // percakapan), dan jiwa persona akan melawan tugas itu.
  const persona =
    typeof percakapan === "string" ? personaPercakapan(percakapan) : null;

  const enkoder = new TextEncoder();
  const aliran = new ReadableStream({
    async start(kontrol) {
      const baris = (k: unknown) => enkoder.encode(`data: ${JSON.stringify(k)}\n`);
      try {
        for await (const k of kirim(susunTanyaSamping(riwayat, tanya), {
          // jiwa MENGGANTIKAN persona Tiburon, tidak ditumpuk di atasnya.
          jiwa: JIWA_SAMPING,
          rantai: persona?.rantai.length ? persona.rantai : undefined,
        })) {
          kontrol.enqueue(baris(k));
        }
      } catch (e) {
        kontrol.enqueue(baris({ jenis: "gagal", pesan: (e as Error).message }));
      }
      kontrol.enqueue(baris({ jenis: "selesai" }));
      kontrol.close();
    },
  });

  return new Response(aliran, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
