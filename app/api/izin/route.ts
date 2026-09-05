export const runtime = "nodejs";

import { jawabIzin } from "@/lib/izin-tunggu";

/**
 * Jawaban Veldan atas satu permintaan izin.
 *
 * Terpisah dari rute agen karena permintaannya masih menggantung DI SANA:
 * giliran agen sedang menunggu di tengah alirannya sendiri, dan jawabannya
 * harus datang lewat permintaan HTTP yang lain.
 *
 * Bekerja karena Tiburon satu proses di satu mesin — daftar permintaan
 * tertunda hidup di memori proses yang sama. Kalau Tiburon suatu hari
 * berjalan di beberapa proses, daftar itulah yang pertama harus pindah.
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

  const { id, izinkan } = badan as { id?: unknown; izinkan?: unknown };
  if (typeof id !== "string" || typeof izinkan !== "boolean") {
    return Response.json({ pesan: "Butuh id dan izinkan" }, { status: 400 });
  }

  // Id yang tidak ada BUKAN galat: permintaannya sudah kedaluwarsa, sudah
  // dijawab, atau gilirannya sudah dihentikan — ketiganya wajar terjadi saat
  // tombolnya ditekan terlambat, dan tidak ada yang perlu diperbaiki.
  const ketemu = jawabIzin(id, izinkan);
  return Response.json({ ok: true, ketemu });
}
