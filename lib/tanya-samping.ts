/**
 * Pertanyaan sampingan: bertanya TENTANG percakapan tanpa menyentuhnya.
 *
 * Diambil dari `/btw` milik Hermes (`agent/side_question.py`), yang menjawab
 * pertanyaan tentang percakapan "without touching it — no synthetic turns, no
 * role-alternation risk, no prompt-cache invalidation".
 *
 * Kenapa ini bukan sekadar mengetik pertanyaannya seperti biasa:
 *
 *   "Tadi kamu pakai model apa?", "Ringkas obrolan ini", "Berkas mana tadi
 *   yang kamu sebut?" — semuanya pertanyaan tentang PERCAKAPANNYA, bukan
 *   kelanjutan dari percakapannya. Ditanyakan biasa, ia menyisip ke tengah
 *   riwayat, ikut terekspor, ikut jadi bahan kurasi ingatan, dan ikut dibaca
 *   model di tiap giliran berikutnya seolah bagian dari topiknya. Percakapan
 *   tentang Docker jadi berisi pertanyaan tentang percakapan itu sendiri.
 *
 * Jawabannya tidak disimpan ke riwayat, tidak dihitung ke kurasi ingatan, dan
 * tidak pernah masuk ekspor.
 */
import type { Pesan } from "@/lib/penyedia";

/** Giliran terakhir yang dibawa. Cukup untuk konteks, tidak sampai membanjiri. */
export const GILIRAN_DIBAWA = 12;

/** Panjang tiap pesan yang dibawa, supaya satu jawaban panjang tidak menelan sisanya. */
export const BATAS_PER_PESAN = 1500;

const PERAN: Record<string, string> = { user: "VELDAN", assistant: "TIBURON" };

/**
 * Instruksi sistem untuk pertanyaan sampingan.
 *
 * Dipakai sebagai `jiwa` — jalur yang MENGGANTIKAN persona Tiburon, bukan
 * ditambahkan sesudahnya. Kalau ditumpuk, persona Tiburon tetap yang pertama
 * dibaca dan model menjawab sebagai Tiburon yang melanjutkan percakapan,
 * persis yang ingin dihindari.
 */
export const JIWA_SAMPING =
  "Kamu menjawab pertanyaan TENTANG sebuah percakapan, bukan melanjutkan " +
  "percakapan itu. Jawab dalam Bahasa Indonesia, sependek mungkin, langsung " +
  "ke jawabannya. Kalau pertanyaannya tidak bisa dijawab dari transkrip yang " +
  "diberikan, katakan begitu — jangan menebak isi yang tidak ada di sana.";

/**
 * Susun pertanyaan sampingan jadi SATU pesan pengguna.
 *
 * Percakapannya dikirim sebagai blok teks di dalam satu pesan, bukan sebagai
 * deretan giliran `user`/`assistant` sungguhan. Bedanya penting: dikirim
 * sebagai giliran sungguhan, model memperlakukan pertanyaan sampingan sebagai
 * kelanjutan topiknya dan menjawab seolah percakapan itu masih berjalan.
 */
export function susunTanyaSamping(riwayat: Pesan[], tanya: string): Pesan[] {
  const dibawa = riwayat.slice(-GILIRAN_DIBAWA);
  const transkrip = dibawa.length
    ? dibawa
        .map(
          (p) =>
            `${PERAN[p.role] ?? p.role.toUpperCase()}: ${p.content.slice(0, BATAS_PER_PESAN)}`,
        )
        .join("\n\n")
    : "(percakapannya masih kosong)";

  return [
    {
      role: "user",
      content:
        `TRANSKRIP PERCAKAPAN:\n\n${transkrip}\n\n---\n\n` +
        `PERTANYAAN TENTANG PERCAKAPAN DI ATAS: ${tanya}`,
    },
  ];
}

/**
 * Pisahkan "/btw" dari pertanyaannya.
 *
 * Mengembalikan null kalau tidak ada pertanyaannya — "/btw" sendirian bukan
 * pertanyaan, dan mengirimkannya akan menghabiskan satu panggilan model cuma
 * untuk meminta model menebak apa yang ingin ditanyakan.
 */
export function baca(teks: string): string | null {
  const cocok = /^\s*\/btw\s+([\s\S]+)$/i.exec(teks);
  const tanya = cocok?.[1]?.trim();
  return tanya ? tanya : null;
}
