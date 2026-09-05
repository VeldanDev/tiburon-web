/**
 * Gerbang di depan seluruh aplikasi.
 *
 * Ditaruh di middleware, bukan di tiap halaman dan tiap rute API, karena
 * penjagaan yang harus dipasang berulang kali adalah penjagaan yang suatu hari
 * akan terlupakan di satu tempat — dan satu rute API yang lupa dijaga membuka
 * seluruh korpus, persis seperti kalau tidak ada gerbang sama sekali.
 *
 * Aturannya ada di `lib/sandi.ts`; berkas ini hanya menerjemahkan putusannya
 * jadi tanggapan HTTP.
 */
import { NextResponse, type NextRequest } from "next/server";
import { NAMA_KUKI, putusanMasuk } from "@/lib/sandi";

export const config = {
  /*
   * Berkas statis dan rute masuk dikecualikan.
   *
   * Halaman masuk HARUS terbuka — halaman yang meminta sandi tapi sendirinya
   * butuh sandi adalah pintu yang terkunci dari dalam.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|masuk|api/masuk).*)"],
};

export async function middleware(req: NextRequest) {
  const putusan = await putusanMasuk({
    // `host` dari header, bukan dari URL yang sudah dinormalkan Next: yang
    // menentukan adalah alamat yang DIKETIK peramban, karena itulah yang
    // membedakan "di mesin ini" dari "lewat jaringan".
    host: req.headers.get("host"),
    kuki: req.cookies.get(NAMA_KUKI)?.value,
  });

  if (putusan.hasil === "boleh") return NextResponse.next();

  if (putusan.hasil === "tolak") {
    // Sengaja teks biasa, bukan halaman cantik: ini pesan untuk yang MEMASANG,
    // bukan untuk yang memakai, dan ia perlu terbaca sama jelasnya di peramban
    // maupun di curl.
    return new NextResponse(putusan.alasan, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Permintaan API dijawab 401, bukan dialihkan: pengalihan ke halaman HTML
  // membuat `fetch` menerima halaman masuk sebagai kalau itu datanya, lalu
  // gagal mengurainya dengan pesan yang tidak menyebut sandi sama sekali.
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ pesan: "Belum masuk." }, { status: 401 });
  }

  const tujuan = req.nextUrl.clone();
  tujuan.pathname = "/masuk";
  // Halaman yang dituju dibawa serta, supaya setelah masuk ia mendarat di
  // tempat yang tadi ia klik, bukan selalu di beranda.
  tujuan.searchParams.set("lanjut", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(tujuan);
}
