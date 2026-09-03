// node:sqlite tidak jalan di Edge runtime.
export const runtime = "nodejs";

import { cari, periksaSkema, type PotonganKorpus } from "@/lib/korpus";
import { kirim, type Pesan } from "@/lib/penyedia";

function baris(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: Request) {
  let badan: { jalur?: string; pesan?: Pesan[] };
  try {
    badan = await req.json();
  } catch {
    return new Response("Badan permintaan bukan JSON", { status: 400 });
  }
  const { jalur = "cepat", pesan } = badan;
  if (!Array.isArray(pesan) || pesan.length === 0) {
    return new Response("Butuh daftar pesan", { status: 400 });
  }

  const aliran = new ReadableStream({
    async start(kontrol) {
      let konteks: PotonganKorpus[] = [];

      if (jalur === "tiburon") {
        const skema = periksaSkema();
        if (!skema.cocok) {
          // Tidak boleh diam. Jawaban tetap diberikan, tapi penggunanya tahu
          // bahwa jawaban itu TIDAK berdasar korpus.
          kontrol.enqueue(baris({
            jenis: "peringatan",
            pesan: `Korpus tidak terbaca — ${skema.alasan}. Jawaban di bawah tidak memakai korpus.`,
          }));
        } else {
          const terakhir = [...pesan].reverse().find((p) => p.role === "user");
          // cari() MELEMPAR pada kegagalan nyata (tabel hilang, berkas korup,
          // galat I/O) — itu disengaja supaya tidak senyap. Tapi lemparan di
          // dalam start() memutus aliran SSE di tengah jalan, dan pengguna
          // melihat jawaban terpotong tanpa penjelasan: kegagalan senyap yang
          // sama, hanya berganti bentuk.
          //
          // Celah waktu di sini nyata: periksaSkema() bisa lulus, lalu OpenClaw
          // mulai reindex, lalu cari() dipanggil dan tabelnya sudah hilang.
          try {
            konteks = cari(terakhir?.content ?? "", 8);
            kontrol.enqueue(baris({
              jenis: "sumber",
              berkas: [...new Set(konteks.map((k) => k.path.split(/[\\/]/).pop()!))],
            }));
          } catch (e) {
            konteks = [];
            kontrol.enqueue(baris({
              jenis: "peringatan",
              pesan:
                `Pencarian korpus gagal — ${(e as Error).message}. ` +
                `Jawaban di bawah TIDAK memakai korpus.`,
            }));
          }
        }
      }

      for await (const k of kirim(pesan, { konteks })) {
        kontrol.enqueue(baris(k));
      }
      kontrol.enqueue(baris({ jenis: "selesai" }));
      kontrol.close();
    },
  });

  return new Response(aliran, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
