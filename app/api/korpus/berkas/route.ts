export const runtime = "nodejs";

import { daftarBerkas, periksaSkema } from "@/lib/korpus";

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
    const berkas = daftarBerkas().map((b) => ({
      nama: b.path.split(/[\\/]/).pop() ?? b.path,
      jalur: b.path,
      potongan: b.potongan,
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
