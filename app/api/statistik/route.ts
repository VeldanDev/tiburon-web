export const runtime = "nodejs";

import { hitungStatistik, bandingkanBuku } from "@/lib/statistik";

/**
 * Statistik pemakaian untuk kartu di layar kosong.
 *
 * Dihitung ulang tiap permintaan, tidak disimpan. Riwayat Veldan berukuran
 * ratusan sampai ribuan pesan — memindainya seluruhnya selesai dalam beberapa
 * milidetik, dan cache berarti angka yang basi tanpa ada yang tahu kapan.
 */
export async function GET() {
  try {
    const s = hitungStatistik();
    return Response.json({ ...s, pembanding: bandingkanBuku(s.token) });
  } catch (e) {
    return Response.json(
      { pesan: `Statistik gagal dihitung: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
