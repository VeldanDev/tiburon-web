export const runtime = "nodejs";

import { cari, daftarBerkas, periksaSkema, type PotonganKorpus } from "@/lib/korpus";
import { cocokJalur, petaLabel } from "@/lib/label-berkas";

/**
 * Pencarian korpus tanpa menyentuh model sama sekali.
 *
 * Melayani dua hal:
 *   1. Hitungan cocok langsung saat mengetik ("23 potongan cocok"), supaya
 *      kamu tahu SEBELUM bertanya apakah korpusmu punya jawabannya.
 *   2. Isi potongan sungguhan saat sebuah kartu sumber dibuka, supaya klaim
 *      "menjawab dari korpusmu" bisa diperiksa, bukan cuma dipercaya.
 *
 * Pencariannya 0,5 ms, jadi memanggil ini tiap ketikan (dengan jeda) praktis
 * gratis — jauh lebih murah daripada satu panggilan model.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const kueri = (url.searchParams.get("q") ?? "").trim();
  const berkas = url.searchParams.get("berkas");
  const batas = Math.min(Number(url.searchParams.get("batas") ?? 8) || 8, 30);

  if (kueri.length < 2) {
    return Response.json({ jumlah: 0, potongan: [] });
  }

  const skema = periksaSkema();
  if (!skema.cocok) {
    // Tidak boleh diam: hitungan nol karena indeks rusak berbeda artinya
    // dari hitungan nol karena memang tidak ada yang cocok.
    return Response.json({ jumlah: 0, potongan: [], pesan: skema.alasan }, { status: 200 });
  }

  try {
    let potongan: PotonganKorpus[] = cari(kueri, batas);
    const labelKorpus = petaLabel(daftarBerkas().map((x) => x.path));

    // Saat sebuah kartu sumber dibuka, hanya potongan dari berkas itu yang
    // diminta — pengguna sedang memeriksa satu sumber, bukan menelusuri semua.
    if (berkas) {
      // Dicocokkan per RUAS jalur, bukan nama berkas: membandingkan nama saja
      // membuka potongan dari SEMUA berkas yang kebetulan senama, lalu
      // menyajikannya sebagai isi satu sumber.
      potongan = potongan.filter((p) => cocokJalur(p.path, berkas));
    }

    return Response.json({
      jumlah: potongan.length,
      potongan: potongan.map((p) => ({
        berkas: labelKorpus.get(p.path) ?? p.path,
        jalur: p.path,
        teks: p.teks.slice(0, 1200),
        skor: p.skor,
      })),
    });
  } catch (e) {
    return Response.json(
      { jumlah: 0, potongan: [], pesan: `Pencarian korpus gagal: ${(e as Error).message}` },
      { status: 200 },
    );
  }
}
