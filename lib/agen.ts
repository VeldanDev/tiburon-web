/**
 * Gelung agen: model memanggil alat, membaca hasilnya, memutuskan lagi.
 *
 * Bedanya dengan jalur obrolan biasa bukan soal kecerdasan modelnya. Di jalur
 * biasa, konteks disiapkan SEBELUM model bicara — satu pencarian korpus
 * berdasarkan pertanyaan mentah, lalu model menjawab dari apa pun yang
 * kebetulan terjaring. Di sini model boleh mencari sendiri, melihat hasilnya
 * kurang tepat, lalu mencari lagi dengan kata yang lebih baik.
 *
 * Tiga pagar yang membuatnya tidak lepas kendali:
 *
 *   BATAS_PUTARAN   agen yang macet dalam gelung memanggil alat yang sama
 *                   berulang-ulang akan menghabiskan kuota tanpa suara
 *   sinyal batal    permintaan yang dihentikan pengguna harus benar-benar
 *                   berhenti, termasuk di tengah putaran alat
 *   alat hanya-baca lihat lib/alat.ts — tidak ada yang bisa dirusak
 */
import { SKEMA_ALAT, jalankanAlat, ringkasPanggilan } from "@/lib/alat";
import { RANTAI_BAWAAN, bagianBersama, type Pesan } from "@/lib/penyedia";

export type KejadianAgen =
  | { jenis: "model"; nama: string }
  | { jenis: "alat-mulai"; nama: string; ringkas: string }
  | { jenis: "alat-selesai"; nama: string; hasil: string }
  | { jenis: "sumber"; berkas: string[]; kueri: string }
  | { jenis: "teks"; teks: string }
  | { jenis: "gagal"; pesan: string };

/**
 * Batas putaran alat dalam satu giliran.
 *
 * 5, bukan 10 atau tak terbatas. Pertanyaan yang jujur membutuhkan satu sampai
 * tiga pencarian; yang menghabiskan lebih dari lima hampir selalu adalah agen
 * yang memanggil alat yang sama berulang karena tidak puas dengan hasilnya —
 * dan tiap putaran mengirim SELURUH percakapan plus hasil alat sebelumnya
 * kembali ke model. Biayanya naik jauh lebih cepat daripada kegunaannya.
 */
export const BATAS_PUTARAN = 5;

const URL_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";

const PERSONA_AGEN = `Kamu Tiburon dalam mode Agent, hiu pembelajar milik Veldan.

DUA SUMBER YANG BERBEDA, jangan tertukar:
- KORPUS: catatan Veldan yang sudah diindeks. Dicari dengan cari_korpus.
  Untuk pertanyaan tentang apa yang pernah dia tulis, baca, atau pelajari.
- BERKAS: berkas sungguhan di mesin ini. Dibaca dengan baca_berkas, dan
  butuh jalurnya. Untuk pertanyaan tentang isi sebuah berkas tertentu —
  kode, konfigurasi, package.json, dan sejenisnya.

Pertanyaan tentang sebuah BERKAS dijawab dari baca_berkas. Jangan mencari
berkas itu di korpus: korpus berisi catatan, bukan salinan berkasmu.

Aturan lain:
- Kalau pertanyaannya mungkin sudah Veldan tulis sendiri, panggil
  cari_korpus dulu. Jangan menjawab dari pengetahuan umum sebelum memeriksa.
- Sebut nama berkas atau sumber yang kamu pakai.
- Kalau alat SUDAH memberi jawabannya, pakai itu. Jangan memanggil alat lain
  untuk mencari hal yang sudah kamu dapatkan.
- Kalau alat tidak menemukan apa pun, katakan terus terang, lalu jawab dari
  pengetahuan umum sambil memberitahu bahwa itu bukan dari materinya.
- Jangan memanggil alat yang sama dua kali dengan kueri yang sama.
Jawab dalam Bahasa Indonesia. Kalau tidak tahu, katakan tidak tahu.`;

/**
 * Petunjuk tempat — di mana agen ini sedang berjalan.
 *
 * "Platform hints" milik Hermes, dan alasannya terlihat langsung saat
 * diuji: tanpa ini, diminta membaca package.json di folder proyek, model
 * menjawab "saya tidak tahu letak folder proyekmu" dan bertanya balik. Ia
 * memang tidak tahu — tidak ada satu pun kalimat di prompt yang
 * memberitahunya.
 *
 * Sengaja cuma satu baris. Ia ikut di setiap permintaan mode agen, dan
 * daftar panjang tentang lingkungan akan menenggelamkan aturan alatnya.
 */
function petunjukTempat(): string {
  return `\n\nFolder proyek Tiburon ada di: ${process.cwd()}`;
}

type PesanAlat = Pesan | {
  role: "assistant";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
} | {
  role: "tool";
  tool_call_id: string;
  content: string;
};

/**
 * Satu panggilan ke model, TIDAK dialirkan.
 *
 * Mode agen sengaja tidak memakai aliran token. Alasannya bukan kemalasan:
 * respons yang mengandung tool_calls harus utuh sebelum bisa dijalankan, dan
 * merakit ulang argumen fungsi dari potongan-potongan delta adalah sumber bug
 * yang terkenal — argumen JSON datang terpecah di tengah string. Yang dialirkan
 * ke antarmuka adalah KEMAJUANNYA (alat apa yang sedang dipanggil), dan itu
 * justru informasi yang lebih berguna daripada teks yang muncul huruf per huruf.
 */
async function panggil(
  model: string,
  pesan: PesanAlat[],
  signal?: AbortSignal,
): Promise<{
  isi: string;
  panggilan: { id: string; nama: string; argumen: string }[];
}> {
  const resp = await fetch(URL_OPENROUTER, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ""}`,
      "Content-Type": "application/json",
      "X-Title": "Tiburon",
    },
    body: JSON.stringify({ model, messages: pesan, tools: SKEMA_ALAT, stream: false }),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const data = await resp.json();
  const pilihan = data?.choices?.[0]?.message;
  if (!pilihan) throw new Error("balasan tanpa isi");

  return {
    isi: typeof pilihan.content === "string" ? pilihan.content : "",
    panggilan: Array.isArray(pilihan.tool_calls)
      ? pilihan.tool_calls.map((t: { id?: string; function?: { name?: string; arguments?: string } }) => ({
          id: t.id ?? "",
          nama: t.function?.name ?? "",
          argumen: t.function?.arguments ?? "{}",
        }))
      : [],
  };
}

export async function* jalankanAgen(
  riwayat: Pesan[],
  opsi: {
    rantai?: string[];
    instruksi?: string;
    ingatan?: string[];
    signal?: AbortSignal;
  } = {},
): AsyncGenerator<KejadianAgen> {
  const rantai = opsi.rantai ?? RANTAI_BAWAAN;
  const kegagalan: string[] = [];

  for (const model of rantai) {
    // Percakapan dibangun ULANG untuk tiap model dalam rantai. Kalau dipakai
    // bersama, model kedua mewarisi tool_calls milik model pertama yang gagal
    // di tengah — dan API menolak pesan `tool` yang tidak punya panggilan
    // pasangannya di giliran sebelumnya.
    // Dikumpulkan LINTAS PUTARAN, dan diumumkan sekali di akhir.
    //
    // Sekali, bukan tiap panggilan alat: layar obrolan mencatat tiap
    // kejadian sumber ke Riwayat sumber, jadi memancarkannya lima kali
    // membuat satu jawaban terhitung lima kali di sana.
    //
    // Per model, bukan di luar gelung rantai: kalau model pertama gagal di
    // tengah, berkas yang sempat dibacanya bukan sumber jawaban yang
    // akhirnya diberikan model kedua.
    const sumber = new Set<string>();
    const kueriDipakai = new Set<string>();

    const pesan: PesanAlat[] = [
      // Persona agen menggantikan persona obrolan, tapi ingatan dan instruksi
      // tetap ikut: keduanya berlaku di mode mana pun.
      {
        role: "system",
        content:
          PERSONA_AGEN +
          petunjukTempat() +
          bagianBersama({ instruksi: opsi.instruksi, ingatan: opsi.ingatan }),
      },
      ...riwayat,
    ];

    try {
      yield { jenis: "model", nama: model };

      for (let putaran = 0; putaran < BATAS_PUTARAN; putaran++) {
        if (opsi.signal?.aborted) return;

        const hasil = await panggil(model, pesan, opsi.signal);

        if (hasil.panggilan.length === 0) {
          if (!hasil.isi.trim()) {
            // Balasan kosong dihitung GAGAL, sama seperti di jalur biasa:
            // gelembung kosong adalah kegagalan senyap.
            throw new Error("balasan kosong");
          }
          if (sumber.size) yield { jenis: "sumber", berkas: [...sumber], kueri: [...kueriDipakai].join(" ") };
          yield { jenis: "teks", teks: hasil.isi };
          return;
        }

        // Pesan asisten yang MEMUAT tool_calls harus ikut disimpan sebelum
        // hasil alatnya. API menolak pesan `tool` yang tidak punya panggilan
        // pasangannya tepat di atasnya.
        pesan.push({
          role: "assistant",
          content: hasil.isi || null,
          tool_calls: hasil.panggilan.map((p) => ({
            id: p.id,
            type: "function" as const,
            function: { name: p.nama, arguments: p.argumen },
          })),
        });

        // Teks yang menyertai panggilan alat tetap ditampilkan: model kerap
        // menjelaskan apa yang akan dicarinya, dan itu berguna dibaca.
        if (hasil.isi.trim()) yield { jenis: "teks", teks: hasil.isi };

        for (const p of hasil.panggilan) {
          if (opsi.signal?.aborted) return;

          yield { jenis: "alat-mulai", nama: p.nama, ringkas: ringkasPanggilan(p.nama, p.argumen) };
          const keluaran = jalankanAlat(p.nama, p.argumen, (berkas, kueri) => {
            for (const f of berkas) sumber.add(f);
            kueriDipakai.add(kueri);
          });
          yield { jenis: "alat-selesai", nama: p.nama, hasil: keluaran };

          pesan.push({ role: "tool", tool_call_id: p.id, content: keluaran });
        }
      }

      // Batas putaran tercapai. Dikatakan terus terang, bukan didiamkan:
      // jawaban yang berhenti tanpa penjelasan terbaca sebagai kerusakan.
      if (sumber.size) yield { jenis: "sumber", berkas: [...sumber], kueri: [...kueriDipakai].join(" ") };
      yield {
        jenis: "teks",
        teks:
          `\n\n**Berhenti setelah ${BATAS_PUTARAN} kali memanggil alat.** ` +
          `Pertanyaannya mungkin perlu dipersempit, atau materinya memang belum ada di korpus.`,
      };
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      kegagalan.push(`${model}: ${(e as Error).message}`);
    }
  }

  yield { jenis: "gagal", pesan: `Semua model gagal — ${kegagalan.join("; ")}` };
}
