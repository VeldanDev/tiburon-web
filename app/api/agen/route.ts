// node:sqlite dipakai alat-alatnya, dan itu tidak jalan di Edge runtime.
export const runtime = "nodejs";

import { batalkanIzin, mintaIzin } from "@/lib/izin-tunggu";
import { jalankanAgen } from "@/lib/agen";
import { ambilPengaturan } from "@/lib/pengaturan";
import { instruksiUntukPercakapan } from "@/lib/proyek";
import type { Pesan } from "@/lib/penyedia";

function baris(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/**
 * Mode agen: model memanggil alat sendiri, lalu menjawab.
 *
 * Dipisah dari /api/cepat alih-alih ditambahkan sebagai bendera di sana.
 * Keduanya berbeda sampai ke bentuk percakapannya — jalur biasa mengalirkan
 * token dan menyiapkan konteks lebih dulu; agen memanggil model berkali-kali
 * tanpa aliran dan menyusun pesan `tool` di antaranya. Menyatukannya berarti
 * satu fungsi dengan dua alur yang tidak berbagi apa pun selain namanya.
 */
export async function POST(req: Request) {
  let badan: { pesan?: Pesan[]; percakapan?: string };
  try {
    badan = await req.json();
  } catch {
    return new Response("Badan permintaan bukan JSON", { status: 400 });
  }
  if (typeof badan !== "object" || badan === null || Array.isArray(badan)) {
    return new Response("Badan permintaan harus objek JSON", { status: 400 });
  }

  const { pesan, percakapan } = badan;
  if (!Array.isArray(pesan) || pesan.length === 0) {
    return new Response("Butuh daftar pesan", { status: 400 });
  }

  // Instruksi dan ingatan dibaca DI SERVER, sama seperti di /api/cepat: kalau
  // klien yang mengirim isi prompt sistem, siapa pun yang bisa memanggil rute
  // ini bisa menyuntik apa pun ke dalamnya.
  let instruksi = "";
  let ingatan: string[] = [];
  try {
    const p = ambilPengaturan();
    const proyek =
      typeof percakapan === "string" ? instruksiUntukPercakapan(percakapan) : "";
    instruksi = [p.instruksi, proyek].filter((t) => t.trim()).join("\n\n");
    ingatan = p.ingatan.map((i) => i.isi);
  } catch {
    // Percakapan tanpa keduanya tetap percakapan yang sah.
  }

  const aliran = new ReadableStream({
    async start(kontrol) {
      try {
        for await (const k of jalankanAgen(pesan, {
          instruksi,
          ingatan,
          // Sinyal dari permintaan HTTP diteruskan ke gelung agen. Tanpa ini,
          // menutup tab meninggalkan gelung yang terus memanggil model dan
          // membakar kuota untuk jawaban yang tidak akan pernah dibaca.
          signal: req.signal,

          /**
           * Ajukan izin ke layar, lalu tunggu jawabannya.
           *
           * Disediakan DI SINI, bukan di dalam gelung agen, karena
           * mengajukan izin berarti mengirim sesuatu ke aliran — dan yang
           * memegang alirannya adalah rute ini.
           */
          mintaIzin: async (tindakan) => {
            const { id, janji } = mintaIzin(tindakan);

            // Dibatalkan bersama gilirannya. Tanpa ini, menekan Esc
            // meninggalkan permintaan yang menunggu jawaban untuk pekerjaan
            // yang sudah dihentikan — sampai batas waktunya habis.
            const batal = () => batalkanIzin(id);
            req.signal.addEventListener("abort", batal, { once: true });

            try {
              kontrol.enqueue(baris({ jenis: "izin-diminta", id, tindakan }));
              const izinkan = await janji;
              // Jawabannya ikut dikirim supaya layar bisa menutup
              // dialognya — termasuk saat yang menjawab adalah batas waktu,
              // bukan Veldan.
              kontrol.enqueue(baris({ jenis: "izin-dijawab", id, izinkan }));
              return izinkan;
            } finally {
              req.signal.removeEventListener("abort", batal);
            }
          },
        })) {
          kontrol.enqueue(baris(k));
        }
      } catch (e) {
        // jalankanAgen menangkap galat per-model sendiri, jadi yang sampai ke
        // sini adalah kerusakan yang tak terduga. Tetap dikirim sebagai
        // kejadian, bukan dibiarkan memutus aliran tanpa penjelasan.
        kontrol.enqueue(
          baris({ jenis: "gagal", pesan: `Agen berhenti: ${(e as Error).message}` }),
        );
      }
      kontrol.enqueue(baris({ jenis: "selesai" }));
      kontrol.close();
    },
  });

  return new Response(aliran, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
