export const runtime = "nodejs";

import { daftarTugas, periksaSkemaJadwal } from "@/lib/jadwal";

export async function GET() {
  const skema = periksaSkemaJadwal();
  if (!skema.cocok) {
    // Tidak boleh diam. Daftar kosong tanpa penjelasan akan terbaca sebagai
    // "tidak ada tugas terjadwal", padahal yang terjadi adalah basis datanya
    // tidak terbaca.
    return Response.json(
      { tugas: [], pesan: `Jadwal tidak terbaca — ${skema.alasan}` },
      { status: 200 },
    );
  }

  try {
    return Response.json({ tugas: daftarTugas() });
  } catch (e) {
    return Response.json(
      { tugas: [], pesan: `Gagal membaca jadwal: ${(e as Error).message}` },
      { status: 200 },
    );
  }
}
