export const runtime = "nodejs";

import { ambilPercakapan } from "@/lib/riwayat";
import { daftarIngatan, sisakanRuangOtomatis, tambahIngatan } from "@/lib/pengaturan";
import { TIAP_PESAN, usulkanIngatan } from "@/lib/ingatan-otomatis";

/**
 * Kurasi ingatan di latar belakang.
 *
 * Dipanggil klien setelah jawaban selesai, tiap kelipatan TIAP_PESAN. Klien
 * mengirim id percakapannya saja — isi percakapan dibaca di server dari basis
 * data, bukan diterima dari browser: kalau klien yang memasok bahannya, siapa
 * pun yang bisa memanggil rute ini bisa menanam ingatan apa pun tentang
 * pemiliknya.
 *
 * Balasannya selalu 200 kecuali permintaannya sendiri salah bentuk. Ini kerja
 * latar belakang yang tidak dilihat siapa pun saat berjalan; kegagalannya
 * berarti "tidak ada ingatan baru kali ini", bukan sesuatu yang perlu
 * mengganggu layar obrolan.
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

  const { percakapan } = badan as { percakapan?: unknown };
  if (typeof percakapan !== "string" || !percakapan) {
    return Response.json({ pesan: "Butuh id percakapan" }, { status: 400 });
  }

  try {
    const pesan = ambilPercakapan(percakapan);
    // Percakapan yang belum cukup panjang tidak punya cukup bahan untuk
    // menyimpulkan apa pun yang bertahan lama.
    if (pesan.length < TIAP_PESAN) return Response.json({ ditambah: [] });

    const sudahAda = daftarIngatan();
    const calon = await usulkanIngatan(
      pesan.map((p) => ({ role: p.role, content: p.content })),
      sudahAda.map((i) => i.isi),
    );
    if (calon.length === 0) return Response.json({ ditambah: [] });

    // Ruang disisakan dengan membuang ingatan OTOMATIS terlama saja. Yang
    // ditulis tangan tidak pernah disentuh — model boleh mengusulkan apa saja,
    // tapi tidak boleh membuang tulisan pemiliknya.
    const dibuang = sisakanRuangOtomatis(calon.length);

    const ditambah: string[] = [];
    for (const isi of calon) {
      try {
        tambahIngatan(isi, undefined, true);
        ditambah.push(isi);
      } catch {
        // Batas masih tercapai walau sudah disisakan: berarti seluruh sisanya
        // ditulis tangan, dan itu memang tidak boleh diganggu. Berhenti.
        break;
      }
    }

    return Response.json({ ditambah, dibuang });
  } catch (e) {
    return Response.json({ ditambah: [], pesan: (e as Error).message });
  }
}
