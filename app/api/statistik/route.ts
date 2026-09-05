export const runtime = "nodejs";

import { hitungStatistik, bandingkanBuku } from "@/lib/statistik";
import { rentangSah } from "@/lib/statistik-bentuk";

/**
 * Statistik pemakaian untuk kartu di layar kosong.
 *
 * Dihitung ulang tiap permintaan, tidak disimpan. Riwayat Veldan berukuran
 * ratusan sampai ribuan pesan — memindainya seluruhnya selesai dalam beberapa
 * milidetik, dan cache berarti angka yang basi tanpa ada yang tahu kapan.
 */
export async function GET(req: Request) {
  try {
    // Rentangnya disaring lewat rentangSah: nilai bebas dari URL berarti
    // tiap angka perlu dijaga dari negatif, nol, dan sepuluh juta.
    const hari = rentangSah(new URL(req.url).searchParams.get("hari"));
    const s = hitungStatistik(undefined, undefined, hari);
    return Response.json({ ...s, pembanding: bandingkanBuku(s.token) });
  } catch (e) {
    return Response.json(
      { pesan: `Statistik gagal dihitung: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
