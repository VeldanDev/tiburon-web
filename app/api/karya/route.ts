export const runtime = "nodejs";

import { daftarKarya } from "@/lib/karya";
import { konfigurasi } from "@/lib/konfigurasi";

export async function GET() {
  try {
    const karya = daftarKarya();
    // Daftar kosong harus menjelaskan dirinya: folder tidak ada dan pipeline
    // belum jalan adalah dua hal berbeda, dan layar tidak boleh menyamakannya.
    if (!karya.length) {
      return Response.json({ karya, pesan: `Belum ada slide di ${konfigurasi().karyaDir}.` });
    }
    return Response.json({ karya });
  } catch (e) {
    return Response.json({ karya: [], pesan: `Gagal membaca karya: ${(e as Error).message}` });
  }
}
