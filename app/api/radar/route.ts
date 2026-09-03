export const runtime = "nodejs";

import { bacaRadar } from "@/lib/radar-parser";

export async function GET(req: Request) {
  const param = new URL(req.url).searchParams.get("tanggal") ?? "";
  const tanggal = new Date(param);
  if (Number.isNaN(tanggal.getTime())) {
    return Response.json({ pesan: `Tanggal tidak valid: "${param}"` }, { status: 400 });
  }

  const laporan = bacaRadar(tanggal);
  if (!laporan) {
    return Response.json(
      { pesan: `Radar untuk ${param} belum ada. Radar Pagi dijadwalkan tiap hari pukul 06:30 WIB.` },
      { status: 404 },
    );
  }

  // Berkas ADA tapi ada bagian yang kosong. Ini BUKAN hal yang sama dengan
  // "radar belum jalan", dan keduanya tidak boleh terlihat sama di layar.
  // Terjadi nyata pada berkas radar sebelum 2026-09-03, yang formatnya lain --
  // tombol mundur tanggal akan menabraknya di hari pertama dipakai.
  //
  // Tiap bagian diperiksa TERPISAH, bukan digabung dengan &&. Kalau suatu hari
  // hanya satu header yang berubah nama, bagian itu akan diam-diam kosong
  // sementara bagian lain tetap terisi -- dan pemeriksaan gabungan tidak akan
  // menangkapnya sama sekali. Radar normal selalu menulis 30 berita dan
  // 10 repo, jadi nol di salah satunya memang menandakan ada yang salah.
  const kosong: string[] = [];
  if (laporan.berita.length === 0) kosong.push("berita teknologi dunia");
  if (laporan.github.length === 0) kosong.push("GitHub Trending");

  if (kosong.length > 0) {
    return Response.json({
      ...laporan,
      catatan:
        `Bagian ${kosong.join(" dan ")} pada radar ${param} tidak berisi satu item pun. ` +
        `Kemungkinan formatnya berbeda dari yang dikenali pembaca ini ` +
        `(berkas sebelum 2026-09-03 memakai format lama), atau sumbernya gagal pagi itu.`,
    });
  }

  return Response.json(laporan);
}
