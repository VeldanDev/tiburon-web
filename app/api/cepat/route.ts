// node:sqlite tidak jalan di Edge runtime.
export const runtime = "nodejs";

import { namaAkhir, petaLabel } from "@/lib/label-berkas";
import { daftarBerkas, cari, periksaSkema, type PotonganKorpus } from "@/lib/korpus";
import { kirim, type Pesan } from "@/lib/penyedia";
import { ambilPengaturan } from "@/lib/pengaturan";
import { instruksiUntukPercakapan } from "@/lib/proyek";

function baris(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/**
 * Baca instruksi khusus dan ingatan.
 *
 * Gagal membacanya TIDAK boleh menggagalkan percakapan: keduanya membuat
 * jawaban lebih pas, tapi percakapan tanpa keduanya tetap percakapan yang sah.
 * Basis data terkunci sesaat sebaiknya berujung pada jawaban yang sedikit
 * lebih umum, bukan pada layar galat.
 */
function bacaTambahan(percakapanId?: string): { instruksi?: string; ingatan?: string[] } {
  try {
    const p = ambilPengaturan();

    // Instruksi proyek DISAMBUNG ke instruksi global, bukan menggantikannya.
    // Keduanya menjawab hal berbeda: yang global soal cara menjawab ("jangan
    // basa-basi"), yang proyek soal konteks pekerjaan ini ("radar itu Python
    // di D:\Downloads"). Salah satunya menang berarti pengguna harus memilih
    // antara gaya dan konteks, padahal ia butuh keduanya.
    const proyek = percakapanId ? instruksiUntukPercakapan(percakapanId) : "";
    const gabung = [p.instruksi, proyek].filter((t) => t.trim()).join("\n\n");

    return { instruksi: gabung, ingatan: p.ingatan.map((i) => i.isi) };
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  let badan: { jalur?: string; pesan?: Pesan[]; percakapan?: string };
  try {
    badan = await req.json();
  } catch {
    return new Response("Badan permintaan bukan JSON", { status: 400 });
  }
  if (typeof badan !== "object" || badan === null || Array.isArray(badan)) {
    return new Response("Badan permintaan harus objek JSON", { status: 400 });
  }
  const { jalur = "cepat", pesan, percakapan } = badan;
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
            // Sumber disebut dengan LABEL UNIK, bukan nama berkas. Korpus ini
            // berisi tiga berkas bernama 2026-09-03.md di folder berbeda;
            // menyebut namanya saja menghasilkan sumber yang tidak bisa
            // ditelusuri -- dan `new Set` di sini dulu bahkan MELEBUR ketiganya
            // jadi satu entri, jadi dua sumber berbeda tampil sebagai satu.
            // Dihitung di try-nya SENDIRI. Daftar berkas dibaca dari tabel lain,
            // dan kegagalannya tidak boleh menghapus daftar sumber yang sudah
            // berhasil dikumpulkan cari() -- itu menukar satu cacat kecil (label
            // kurang tepat) dengan cacat besar (sumbernya hilang sama sekali).
            let label = new Map<string, string>();
            try {
              label = petaLabel(daftarBerkas().map((b) => b.path));
            } catch {
              // Cadangannya nama berkas, seperti sebelumnya.
            }
            kontrol.enqueue(baris({
              jenis: "sumber",
              berkas: [
                ...new Set(
                  konteks.map((k) => label.get(k.path) ?? namaAkhir(k.path)),
                ),
              ],
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

      // kirim() TIDAK melempar: galat per-model ditangkap di dalamnya dan
      // dipancarkan sebagai { jenis: "gagal" }. Jadi aliran ini tidak bisa
      // putus di tengah seperti cari() di atas. Kalau kontrak itu berubah,
      // blok ini butuh try/catch juga.
      // Instruksi khusus dan ingatan dibaca DI SINI, di server, bukan
      // dikirim dari browser. Kalau klien yang mengirimnya, siapa pun yang
      // bisa memanggil rute ini bisa menyuntik prompt sistem apa pun.
      const { instruksi, ingatan } = bacaTambahan(
        typeof percakapan === "string" ? percakapan : undefined,
      );
      for await (const k of kirim(pesan, { konteks, instruksi, ingatan })) {
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
