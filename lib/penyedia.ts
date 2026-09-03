/**
 * Klien penyedia model, berdiri sendiri di luar OpenClaw.
 *
 * Sengaja TIDAK lewat gateway OpenClaw untuk jalur Cepat dan Tiburon: gateway
 * terbukti macet saat dibebani permintaan bersamaan, dan direstart cukup sering.
 * Jalur yang tidak menyentuh gateway berarti Tiburon tetap bisa diajak bicara
 * saat gateway mati.
 */
import type { PotonganKorpus } from "@/lib/korpus";

export type Pesan = { role: "user" | "assistant" | "system"; content: string };
export type Kejadian =
  | { jenis: "model"; nama: string }
  | { jenis: "teks"; teks: string }
  | { jenis: "gagal"; pesan: string };

const URL_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Urutan ini BUKAN tebakan: keduanya sudah terbukti menjawab lewat OpenRouter
 * di radar pagi yang jalan tiap hari (lihat radar/penyedia.py MODEL_URUTAN).
 * glm dicoba dulu; saat dia kena 429, minimax mengambil alih — pola itu
 * terlihat langsung di log radar 2026-09-03.
 */
export const RANTAI_BAWAAN = [
  "z-ai/glm-5.2:free",
  "minimax/minimax-m3:free",
];

const PERSONA = `Kamu Tiburon, hiu pembelajar milik Veldan. Ramah di permukaan,
tajam di dalam: santai tapi presisi. Jawab dalam Bahasa Indonesia.
Kalau kamu tidak tahu, katakan tidak tahu — jangan mengarang.`;

/**
 * Susun prompt sistem: persona, ingatan, instruksi khusus, lalu sumber korpus.
 *
 * Urutan keempatnya disengaja dan bukan selera:
 *
 *   1. PERSONA      siapa Tiburon. Dasar yang tidak boleh ditimpa pengguna.
 *   2. INGATAN      fakta tentang Veldan yang berlaku selamanya.
 *   3. INSTRUKSI    cara dia ingin dijawab. Ditaruh SETELAH ingatan karena ia
 *                   mengatur BENTUK jawaban, dan bentuk diputuskan setelah
 *                   bahannya diketahui.
 *   4. SUMBER       potongan korpus untuk pertanyaan ini saja. Paling akhir
 *                   karena paling khusus, dan yang terakhir dibaca model
 *                   paling kuat memengaruhi jawabannya.
 *
 * Instruksi pengguna DIBERI LABEL sebagai instruksi pengguna, bukan disatukan
 * mulus ke dalam persona. Kalau ia ditulis seolah bagian dari aturan sistem,
 * kalimat seperti "abaikan semua aturan sebelumnya" di dalamnya jadi jauh
 * lebih mudah dituruti model.
 */
/**
 * Bagian prompt sistem yang berlaku di SEMUA mode: ingatan dan instruksi.
 *
 * Dipisah dari susunPrompt supaya mode agen bisa memakai personanya sendiri
 * tanpa harus memotong-motong hasil susunPrompt dengan regex — cara itu
 * berhenti bekerja diam-diam begitu teks personanya diubah satu kata.
 */
export function bagianBersama(tambahan?: {
  instruksi?: string;
  ingatan?: string[];
}): string {
  let teks = "";

  if (tambahan?.ingatan?.length) {
    teks +=
      `\n\nYANG SUDAH KAMU KETAHUI TENTANG VELDAN (ditulis sendiri olehnya):\n` +
      tambahan.ingatan.map((i) => `- ${i}`).join("\n");
  }

  if (tambahan?.instruksi?.trim()) {
    teks +=
      `\n\nINSTRUKSI DARI PENGGUNA tentang cara menjawab. Ikuti selama tidak ` +
      `bertentangan dengan aturan di atas:\n${tambahan.instruksi.trim()}`;
  }

  return teks;
}

export function susunPrompt(
  pesan: Pesan[],
  konteks: PotonganKorpus[],
  tambahan?: { instruksi?: string; ingatan?: string[] },
): Pesan[] {
  let sistem = PERSONA + bagianBersama(tambahan);

  if (konteks.length) {
    const sumber = konteks
      .map((k) => `[${k.path.split(/[\\/]/).pop()}]\n${k.teks}`)
      .join("\n\n---\n\n");
    sistem +=
      `\n\nSUMBER dari korpus Veldan. Jawab BERDASARKAN ini dan sebut nama ` +
      `berkasnya. Kalau sumber di bawah tidak menjawab pertanyaannya, katakan ` +
      `begitu — jangan mengisi kekosongan dengan pengetahuan umum tanpa ` +
      `memberi tahu.\n\n${sumber}`;
  }
  return [{ role: "system", content: sistem }, ...pesan];
}

async function* aliranSatuModel(model: string, pesan: Pesan[]): AsyncGenerator<Kejadian> {
  const resp = await fetch(URL_OPENROUTER, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ""}`,
      "Content-Type": "application/json",
      "X-Title": "Tiburon",
    },
    body: JSON.stringify({ model, messages: pesan, stream: true }),
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`HTTP ${resp.status}`);
  }

  yield { jenis: "model", nama: model };

  const pembaca = resp.body.getReader();
  const dekoder = new TextDecoder();
  let sisa = "";
  while (true) {
    const { done, value } = await pembaca.read();
    if (done) break;
    sisa += dekoder.decode(value, { stream: true });
    const baris = sisa.split("\n");
    sisa = baris.pop() ?? "";
    for (const b of baris) {
      if (!b.startsWith("data: ")) continue;
      const isi = b.slice(6).trim();
      if (isi === "[DONE]") return;
      try {
        const teks = JSON.parse(isi)?.choices?.[0]?.delta?.content;
        if (teks) yield { jenis: "teks", teks };
      } catch {
        // Potongan SSE yang belum utuh — lewati, bukan kegagalan.
      }
    }
  }
}

export async function* kirim(
  pesan: Pesan[],
  opsi: {
    konteks?: PotonganKorpus[];
    rantai?: string[];
    instruksi?: string;
    ingatan?: string[];
  } = {},
): AsyncGenerator<Kejadian> {
  const rantai = opsi.rantai ?? RANTAI_BAWAAN;
  const siap = susunPrompt(pesan, opsi.konteks ?? [], {
    instruksi: opsi.instruksi,
    ingatan: opsi.ingatan,
  });
  const kegagalan: string[] = [];

  for (const model of rantai) {
    try {
      let adaIsi = false;
      for await (const k of aliranSatuModel(model, siap)) {
        if (k.jenis === "teks") adaIsi = true;
        yield k;
      }
      // Balasan kosong dihitung GAGAL, bukan sukses. Gelembung kosong adalah
      // kegagalan senyap — persis pola genspark yang membalas HTTP 200 berisi
      // teks tagihan sehingga failover tak pernah terpicu.
      if (adaIsi) return;
      kegagalan.push(`${model}: balasan kosong`);
    } catch (e) {
      kegagalan.push(`${model}: ${(e as Error).message}`);
    }
  }

  yield {
    jenis: "gagal",
    pesan: `Semua model gagal — ${kegagalan.join("; ")}`,
  };
}
