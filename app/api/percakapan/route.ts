export const runtime = "nodejs";

import {
  buatPercakapan,
  tambahPesan,
  ambilPercakapan,
  daftarPercakapan,
  gantiJudul,
  hapusPercakapan,
  setSemat,
  cariPercakapan,
} from "@/lib/riwayat";

/**
 * Baca badan permintaan sebagai objek JSON.
 *
 * `null` dan array sengaja ditolak di sini, bukan dibiarkan lewat: keduanya
 * lolos dari `typeof x === "object"` dan pernah meruntuhkan rute lain di
 * proyek ini lewat destrukturisasi, yang naik jadi 500 tanpa penjelasan
 * apa-apa alih-alih 400 yang bisa dibaca.
 */
async function bacaObjek(req: Request): Promise<{ nilai?: Record<string, unknown>; galat?: Response }> {
  let badan: unknown;
  try {
    badan = await req.json();
  } catch {
    return { galat: Response.json({ pesan: "Badan permintaan bukan JSON" }, { status: 400 }) };
  }
  if (typeof badan !== "object" || badan === null || Array.isArray(badan)) {
    return { galat: Response.json({ pesan: "Badan permintaan harus objek JSON" }, { status: 400 }) };
  }
  return { nilai: badan as Record<string, unknown> };
}

/**
 * Riwayat percakapan.
 *
 * Gateway OpenClaw TIDAK menyimpan riwayat — diuji langsung: pesan kedua
 * tidak mengingat pesan pertama. Jadi aplikasi ini yang menyimpannya, dan
 * rute inilah jembatannya ke lib/riwayat.ts.
 *
 *   GET  /api/percakapan          -> daftar ringkas, terbaru di atas
 *   GET  /api/percakapan?id=xxx   -> isi satu percakapan
 *   POST { judul }                -> buat percakapan, balas { id }
 *   PUT  { id, pesan }            -> tambah satu pesan (pesan.model opsional)
 */
export async function GET(req: Request) {
  const param = new URL(req.url).searchParams;
  const id = param.get("id");
  const cari = param.get("cari");
  try {
    if (cari !== null) return Response.json(cariPercakapan(cari));
    return Response.json(id ? ambilPercakapan(id) : daftarPercakapan());
  } catch (e) {
    // Daftar kosong dan gagal membaca TIDAK boleh terlihat sama: yang pertama
    // berarti belum ada obrolan, yang kedua berarti ada yang rusak.
    return Response.json({ pesan: `Gagal membaca riwayat: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { nilai: badan, galat } = await bacaObjek(req);
  if (galat) return galat;

  const { judul } = badan as { judul?: unknown };
  if (typeof judul !== "string" || !judul.trim()) {
    return Response.json({ pesan: "Butuh judul" }, { status: 400 });
  }

  try {
    return Response.json({ id: buatPercakapan(judul) });
  } catch (e) {
    return Response.json({ pesan: `Gagal membuat percakapan: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const { nilai: badan, galat } = await bacaObjek(req);
  if (galat) return galat;

  const { id, pesan } = badan as { id?: unknown; pesan?: unknown };
  const isiPesan = pesan as { role?: unknown; content?: unknown; model?: unknown } | undefined;
  if (
    typeof id !== "string" ||
    typeof isiPesan?.role !== "string" ||
    typeof isiPesan?.content !== "string"
  ) {
    return Response.json({ pesan: "Butuh id dan pesan{role,content}" }, { status: 400 });
  }

  // `model` opsional, tapi kalau ADA ia harus string. Angka atau objek yang
  // lolos ke sini akan tersimpan sebagai teks aneh dan muncul di daftar model
  // terpakai selamanya -- kolom ini tidak pernah dibersihkan lagi.
  if (isiPesan.model !== undefined && isiPesan.model !== null && typeof isiPesan.model !== "string") {
    return Response.json({ pesan: "pesan.model harus string" }, { status: 400 });
  }

  try {
    tambahPesan(id, {
      role: isiPesan.role as "user" | "assistant",
      content: isiPesan.content,
      model: typeof isiPesan.model === "string" ? isiPesan.model : null,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ pesan: `Gagal menyimpan pesan: ${(e as Error).message}` }, { status: 500 });
  }
}

/** Ganti judul satu percakapan. */
export async function PATCH(req: Request) {
  const { nilai: badan, galat } = await bacaObjek(req);
  if (galat) return galat;

  const { id, judul, disemat } = badan as {
    id?: unknown;
    judul?: unknown;
    disemat?: unknown;
  };

  // Menyematkan dan mengganti judul berbagi satu rute karena keduanya adalah
  // "ubah sebagian dari satu percakapan" — itulah arti PATCH.
  if (typeof id === "string" && typeof disemat === "boolean") {
    try {
      const ada = setSemat(id, disemat);
      if (!ada) return Response.json({ pesan: "Percakapan tidak ditemukan" }, { status: 404 });
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ pesan: `Gagal menyematkan: ${(e as Error).message}` }, { status: 500 });
    }
  }

  if (typeof id !== "string" || typeof judul !== "string" || !judul.trim()) {
    return Response.json({ pesan: "Butuh id dan judul, atau id dan disemat" }, { status: 400 });
  }

  try {
    // 404 kalau id-nya tidak ada, BUKAN 200 diam-diam. Antarmuka yang mengira
    // penggantian nama berhasil padahal tidak akan menampilkan judul baru yang
    // hilang lagi begitu halaman dimuat ulang.
    const ada = gantiJudul(id, judul.trim().slice(0, 120));
    if (!ada) return Response.json({ pesan: "Percakapan tidak ditemukan" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ pesan: `Gagal mengganti judul: ${(e as Error).message}` }, { status: 500 });
  }
}

/** Hapus satu percakapan beserta seluruh pesannya. */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ pesan: "Butuh id" }, { status: 400 });

  try {
    const ada = hapusPercakapan(id);
    if (!ada) return Response.json({ pesan: "Percakapan tidak ditemukan" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ pesan: `Gagal menghapus: ${(e as Error).message}` }, { status: 500 });
  }
}
