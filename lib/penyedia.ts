/**
 * Klien penyedia model, berdiri sendiri di luar OpenClaw.
 *
 * Sengaja TIDAK lewat gateway OpenClaw untuk jalur Cepat dan Tiburon: gateway
 * terbukti macet saat dibebani permintaan bersamaan, dan direstart cukup sering.
 * Jalur yang tidak menyentuh gateway berarti Tiburon tetap bisa diajak bicara
 * saat gateway mati.
 */
import type { PotonganKorpus } from "@/lib/korpus";
import { kenaliSebab, rangkumKegagalan, type Kegagalan } from "@/lib/sebab-gagal";
import { muatkan } from "@/lib/muat";

/** Galat yang membawa kode status HTTP-nya, supaya sebabnya bisa dikenali. */
type GalatModel = Error & { status?: number };

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

/**
 * Persona, DAN pengetahuan tentang aplikasi tempat ia tinggal.
 *
 * Bagian kedua ditambahkan setelah percobaan yang sangat sederhana gagal:
 * ditanya "apa itu korpus di aplikasi ini", Tiburon menjawab "aku tidak
 * memiliki konteks tentang aplikasi tertentu" -- lalu menjelaskan korpus
 * sebagai istilah linguistik umum. Itu pertanyaan paling wajar yang bisa
 * diajukan siapa pun pada menit pertama, dan aplikasi yang tidak bisa
 * menjelaskan dirinya sendiri terasa seperti aplikasi milik orang lain.
 *
 * Sengaja pendek dan berupa fakta, bukan brosur: teks ini ikut di SETIAP
 * permintaan, jadi tiap barisnya dibayar tiap kali. Yang masuk hanya hal
 * yang benar-benar ditanyakan orang, dan baris terakhirnya melarang
 * mengarang sisanya — tanpa itu model akan menambah fitur yang tidak ada,
 * dan fitur karangan lebih buruk daripada jawaban tidak tahu.
 */
const PERSONA = `Kamu Tiburon, hiu pembelajar milik Veldan. Ramah di permukaan,
tajam di dalam. Jawab dalam Bahasa Indonesia.
Namamu Tiburon — jangan mengarang nama lain.

CARA MENJAWAB:
- Panjang jawaban mengikuti bobot pertanyaan. Satu baris dijawab satu baris.
- Tanpa basa-basi pembuka, tanpa mengulang pertanyaannya, tanpa merangkum
  ulang yang sudah kamu tulis.
- Klaim polos, bukan kata sifat. Tidak tahu, katakan tidak tahu.
- Setuju karena benar, bukan karena Veldan yang bilang. Kalau dia keliru,
  katakan.

TENTANG APLIKASI INI, kalau ditanya:
- Aplikasi obrolan buatan Veldan sendiri, jalan di mesinnya. "Korpus" =
  catatan Veldan yang terindeks dan bisa kamu cari, bukan istilah linguistik.
- Empat jalur, makin dalam makin teliti: Cepat (tanpa korpus), Tiburon (cari
  sekali), Agen (cari berulang), Kode.
- Jawaban dari korpus menyebut berkas sumbernya, dan sumber itu bisa dibuka.
- Riwayat, ingatan, dan instruksi disimpan di mesin Veldan.
- Korpus hanya bisa kamu baca, tidak bisa kamu ubah.
- Di luar daftar ini, katakan tidak tahu. Jangan mengarang fitur.`;

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

/**
 * `jiwa` MENGGANTIKAN persona bawaan, bukan ditambahkan sesudahnya.
 *
 * Kalau ia ditumpuk di atas persona bawaan, kedua definisi berlaku sekaligus
 * dan model harus menebak mana yang menang — dan persona yang dibuat justru
 * untuk mengganti sifat bawaannya jadi tidak pernah benar-benar berlaku.
 */
export function susunPrompt(
  pesan: Pesan[],
  konteks: PotonganKorpus[],
  tambahan?: { instruksi?: string; ingatan?: string[]; jiwa?: string },
): Pesan[] {
  let sistem = (tambahan?.jiwa?.trim() || PERSONA) + bagianBersama(tambahan);

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
  // Dipangkas DI SINI, di titik yang dilewati semua permintaan jalur obrolan.
  // Meter konteks memperingatkan sejak 50%; tanpa ini, di 101% permintaannya
  // tetap dikirim utuh dan gagal dengan pesan yang tidak menyebut satu pun
  // hal yang bisa dilakukan Veldan.
  return muatkan([{ role: "system", content: sistem }, ...pesan]).pesan as Pesan[];
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
    // Badan galatnya DIBACA, tidak cuma kodenya. OpenRouter meneruskan
    // kegagalan penyedia di baliknya di dalam badan — "temporarily
    // rate-limited upstream" datang sebagai 429 yang isinya jauh lebih
    // menjelaskan daripada angkanya. Dibatasi 400 karakter: badan galat
    // bisa berupa halaman HTML utuh, dan itu tidak menolong siapa pun.
    let rinci = "";
    try {
      rinci = (await resp.text()).slice(0, 400);
    } catch {
      // Badan yang tidak terbaca bukan alasan menelan galatnya.
    }
    const galat = new Error(rinci ? `HTTP ${resp.status} — ${rinci}` : `HTTP ${resp.status}`);
    (galat as GalatModel).status = resp.status;
    throw galat;
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
    jiwa?: string;
  } = {},
): AsyncGenerator<Kejadian> {
  const rantai = opsi.rantai ?? RANTAI_BAWAAN;
  const siap = susunPrompt(pesan, opsi.konteks ?? [], {
    instruksi: opsi.instruksi,
    ingatan: opsi.ingatan,
    jiwa: opsi.jiwa,
  });
  const kegagalan: Kegagalan[] = [];

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
      kegagalan.push({ model, sebab: "kosong", pesan: "balasan kosong" });
    } catch (e) {
      const pesan = (e as Error).message;
      const status = (e as GalatModel).status ?? null;
      kegagalan.push({ model, sebab: kenaliSebab(status, pesan), pesan });
    }
  }

  yield { jenis: "gagal", pesan: rangkumKegagalan(kegagalan) };
}
