export const runtime = "nodejs";

import {
  BATAS_JIWA,
  BATAS_JUMLAH_PERSONA,
  buatPersona,
  daftarPersona,
  hapusPersona,
  setPersonaPercakapan,
  ubahPersona,
} from "@/lib/persona";

/**
 * Persona — beberapa "siapa" untuk satu Tiburon.
 *
 *   GET                              -> daftar persona + batasnya
 *   POST  { nama, jiwa?, rantai? }   -> buat
 *   PUT   { id, nama?, jiwa?, rantai? }        -> ubah
 *   PUT   { percakapan, persona }    -> setel persona sebuah percakapan
 *   DELETE ?id=xxx                   -> hapus, percakapannya dilepaskan
 *
 * Jiwanya TIDAK pernah dikirim balik ke model dari sini; rute obrolan
 * membacanya sendiri dari basis data. Rute ini cuma mengelola isinya.
 */
async function bacaObjek(req: Request) {
  let nilai: unknown;
  try {
    nilai = await req.json();
  } catch {
    return { galat: Response.json({ pesan: "Badan permintaan bukan JSON" }, { status: 400 }) };
  }
  // null dan array sama-sama lolos `typeof x === "object"`, dan keduanya akan
  // meledak saat medannya dibaca.
  if (typeof nilai !== "object" || nilai === null || Array.isArray(nilai)) {
    return { galat: Response.json({ pesan: "Badan permintaan harus objek JSON" }, { status: 400 }) };
  }
  return { nilai: nilai as Record<string, unknown> };
}

/** Rantai model dari kotak teks: satu model per baris. */
function bacaRantai(nilai: unknown): string[] | undefined {
  if (nilai === undefined) return undefined;
  if (Array.isArray(nilai)) return nilai.filter((x): x is string => typeof x === "string");
  if (typeof nilai === "string") {
    return nilai
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

export async function GET() {
  try {
    return Response.json({
      persona: daftarPersona(),
      batasJiwa: BATAS_JIWA,
      batasJumlah: BATAS_JUMLAH_PERSONA,
    });
  } catch (e) {
    // Daftar kosong dan gagal membaca TIDAK boleh terlihat sama.
    return Response.json(
      { persona: [], batasJiwa: BATAS_JIWA, batasJumlah: BATAS_JUMLAH_PERSONA, pesan: `Gagal membaca persona: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const { nilai: badan, galat } = await bacaObjek(req);
  if (galat) return galat;

  const { nama, jiwa, rantai } = badan as Record<string, unknown>;
  if (typeof nama !== "string" || !nama.trim()) {
    return Response.json({ pesan: "Butuh nama persona" }, { status: 400 });
  }
  if (jiwa !== undefined && typeof jiwa !== "string") {
    return Response.json({ pesan: "jiwa harus string" }, { status: 400 });
  }

  try {
    return Response.json(buatPersona(nama, jiwa ?? "", bacaRantai(rantai) ?? []));
  } catch (e) {
    // Batas yang tercapai adalah permintaan yang salah, bukan server yang
    // rusak — dan pesannya sudah menjelaskan apa yang harus dilakukan.
    return Response.json({ pesan: (e as Error).message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const { nilai: badan, galat } = await bacaObjek(req);
  if (galat) return galat;

  const { id, nama, jiwa, rantai, percakapan, persona } = badan as Record<string, unknown>;

  // Menyetel persona sebuah PERCAKAPAN, bukan menyunting personanya.
  if (typeof percakapan === "string") {
    if (persona !== null && typeof persona !== "string") {
      return Response.json({ pesan: "persona harus string atau null" }, { status: 400 });
    }
    try {
      const ada = setPersonaPercakapan(percakapan, persona as string | null);
      if (!ada) return Response.json({ pesan: "Percakapan tidak ditemukan" }, { status: 404 });
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ pesan: `Gagal menyetel persona: ${(e as Error).message}` }, { status: 500 });
    }
  }

  if (typeof id !== "string") {
    return Response.json({ pesan: "Butuh id, atau percakapan+persona" }, { status: 400 });
  }
  if (nama !== undefined && typeof nama !== "string") {
    return Response.json({ pesan: "nama harus string" }, { status: 400 });
  }
  if (jiwa !== undefined && typeof jiwa !== "string") {
    return Response.json({ pesan: "jiwa harus string" }, { status: 400 });
  }

  try {
    const ada = ubahPersona(id, {
      nama: nama as string | undefined,
      jiwa: jiwa as string | undefined,
      rantai: bacaRantai(rantai),
    });
    if (!ada) return Response.json({ pesan: "Persona tidak ditemukan" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ pesan: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ pesan: "Butuh id" }, { status: 400 });

  try {
    const ada = hapusPersona(id);
    if (!ada) return Response.json({ pesan: "Persona tidak ditemukan" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ pesan: `Gagal menghapus: ${(e as Error).message}` }, { status: 500 });
  }
}
