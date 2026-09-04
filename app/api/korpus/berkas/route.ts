export const runtime = "nodejs";

import { daftarBerkas, periksaSkema } from "@/lib/korpus";
import { petaLabel } from "@/lib/label-berkas";

/**
 * Daftar berkas di korpus, beserta berapa potongan yang dihasilkan tiap berkas.
 *
 * Basis data korpus SELALU dibuka readOnly (lihat lib/korpus.ts) — ini milik
 * OpenClaw, dan aplikasi ini cuma menumpang membacanya.
 */
export async function GET() {
  const skema = periksaSkema();
  if (!skema.cocok) {
    // Nol berkas karena indeks tidak terbaca dan nol berkas karena korpusnya
    // memang kosong adalah dua keadaan berbeda, dan pengguna harus bisa
    // membedakannya tanpa menebak.
    return Response.json({ berkas: [], totalPotongan: 0, pesan: skema.alasan });
  }

  try {
    // `nama` adalah LABEL UNIK, bukan nama berkas telanjang. Korpus ini
    // berisi tiga berkas bernama 2026-09-03.md di folder berbeda, dan daftar
    // yang menampilkan tiga baris identik tidak memberi tahu apa pun.
    // `jalur` tetap membawa jalur penuhnya untuk yang membutuhkannya.
    const semua = daftarBerkas();
    const label = petaLabel(semua.map((x) => x.path));
    const berkas = semua.map((x) => ({
      nama: label.get(x.path) ?? x.path,
      jalur: x.path,
      potongan: x.potongan,
    }));
    return Response.json({
      berkas,
      totalPotongan: berkas.reduce((t, b) => t + b.potongan, 0),
    });
  } catch (e) {
    return Response.json(
      { berkas: [], totalPotongan: 0, pesan: `Daftar korpus gagal dibaca: ${(e as Error).message}` },
      { status: 200 },
    );
  }
}
