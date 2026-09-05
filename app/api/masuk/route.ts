export const runtime = "nodejs";

import { NAMA_KUKI, UMUR_SESI_DETIK, buatSesi, sandiCocok, sandiTerpasang } from "@/lib/sandi";

/**
 * Menukar sandi dengan kuki sesi.
 *
 * Jeda tetap di setiap kegagalan. Tanpanya, menebak sandi bisa dicoba ribuan
 * kali per menit dari jaringan yang sama; dengan jeda 700 ms, seratus tebakan
 * butuh lebih dari satu menit dan pemiliknya punya waktu menyadarinya. Ini
 * bukan pengganti sandi yang baik — ini yang membuat sandi yang biasa saja
 * tetap cukup.
 */
const JEDA_GAGAL_MS = 700;

export async function POST(req: Request) {
  const sandi = sandiTerpasang();
  if (!sandi) {
    return Response.json(
      { pesan: "SANDI_TIBURON belum diisi di .env.local, jadi tidak ada yang bisa dicocokkan." },
      { status: 503 },
    );
  }

  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return Response.json({ pesan: "Badan permintaan bukan JSON" }, { status: 400 });
  }
  const diberikan = (badan as { sandi?: unknown })?.sandi;
  if (typeof diberikan !== "string") {
    return Response.json({ pesan: "Butuh sandi" }, { status: 400 });
  }

  if (!(await sandiCocok(diberikan, sandi))) {
    await new Promise((r) => setTimeout(r, JEDA_GAGAL_MS));
    // Pesannya sengaja tidak menyebut apa pun tentang sandi yang benar —
    // panjangnya, awalannya, atau seberapa dekat tebakannya.
    return Response.json({ pesan: "Sandi salah." }, { status: 401 });
  }

  const res = Response.json({ ok: true });
  res.headers.append(
    "set-cookie",
    [
      `${NAMA_KUKI}=${await buatSesi(sandi)}`,
      "Path=/",
      `Max-Age=${UMUR_SESI_DETIK}`,
      // HttpOnly: kuki tidak boleh terbaca JavaScript. Kalau suatu hari ada
      // skrip pihak ketiga yang lolos ke halaman, ia tetap tidak bisa
      // membawa sesinya pergi.
      "HttpOnly",
      // Lax, bukan Strict: Strict membuat kuki tidak ikut saat halaman dibuka
      // dari tautan luar, dan orang akan mengira sesinya hilang sendiri.
      "SameSite=Lax",
    ].join("; "),
  );
  return res;
}

/** Keluar: kukinya dihapus dengan menyetel umur nol. */
export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", `${NAMA_KUKI}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res;
}
