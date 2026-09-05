export const runtime = "nodejs";

import { kirim } from "@/lib/penyedia";
import { JIWA_LAMARAN, susunLamaran } from "@/lib/lamaran";

/**
 * Menulis lamaran dari sebuah iklan lowongan.
 *
 * Dialirkan seperti jawaban biasa, dan seperti `/btw` ia TIDAK menyentuh
 * riwayat: lamaran bukan bagian dari percakapan, dan menyimpannya akan
 * membuat tiap percakapan lama ikut membawa iklan lowongan yang sudah tidak
 * relevan ke setiap giliran berikutnya.
 *
 * Faktanya disusun DI SERVER dari `lib/lamaran.ts`, bukan dikirim dari
 * peramban. Kalau daftar fakta datang dari klien, siapa pun yang membuka
 * peramban bisa mengubah klaim yang muncul di lamaran atas nama Veldan.
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

  const { iklan } = badan as { iklan?: unknown };
  if (typeof iklan !== "string" || iklan.trim().length < 40) {
    // Iklan sependek itu tidak bisa dinilai, dan lamaran yang ditulis dari
    // tebakan lebih buruk daripada tidak ada lamaran.
    return Response.json(
      { pesan: "Tempel iklan lowongannya (minimal beberapa kalimat) setelah /lamar." },
      { status: 400 },
    );
  }

  const aliran = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const kirimKejadian = (k: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(k)}\n\n`));
      try {
        for await (const k of kirim(susunLamaran(iklan), { jiwa: JIWA_LAMARAN })) {
          kirimKejadian(k);
        }
      } catch (e) {
        kirimKejadian({ jenis: "gagal", pesan: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(aliran, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
