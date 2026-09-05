/**
 * Membacakan jawaban dengan suara.
 *
 * `text_to_speech` milik Hermes, tapi lewat jalan yang jauh lebih murah:
 * `speechSynthesis` bawaan peramban. Tidak ada layanan luar, tidak ada kunci
 * API, tidak ada biaya per kata, dan tidak ada satu pun kata yang meninggalkan
 * mesin ini — sejalan dengan seluruh sikap Tiburon soal data.
 *
 * Harganya: suaranya kalah bagus dari layanan berbayar. Untuk mendengarkan
 * jawaban sambil mengerjakan hal lain, itu pertukaran yang benar.
 */

/**
 * Bersihkan markdown sebelum dibacakan.
 *
 * Tanpa ini pembacanya mengeja pagar kode, bintang tebal, dan tanda pipa
 * tabel satu per satu. Blok kode DIBUANG seluruhnya, bukan dibacakan:
 * mendengarkan seseorang mengeja tanda kurung kurawal selama dua menit tidak
 * menolong siapa pun.
 */
export function untukDibaca(markdown: string): string {
  return markdown
    // Blok kode: dibuang, diganti keterangan singkat.
    .replace(/```[\s\S]*?```/g, " (ada blok kode di sini) ")
    .replace(/`([^`]+)`/g, "$1")
    // Tautan: yang dibacakan teksnya, bukan alamatnya.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    // Baris tabel: pipa jadi jeda, bukan dieja.
    .replace(/\|/g, ", ")
    .replace(/^[\s,:-]+$/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Apakah peramban ini bisa bicara? */
export function didukung(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Pilih suara berbahasa Indonesia kalau ada.
 *
 * Tanpa ini, jawaban berbahasa Indonesia dibacakan dengan fonem Inggris dan
 * hampir tidak terdengar seperti kata apa pun.
 */
function suaraIndonesia(): SpeechSynthesisVoice | null {
  const semua = window.speechSynthesis.getVoices();
  return semua.find((s) => s.lang.toLowerCase().startsWith("id")) ?? null;
}

/**
 * Bacakan sebuah teks. Memanggilnya lagi MENGHENTIKAN yang sedang berjalan.
 *
 * Menumpuk dua pembacaan berarti dua suara bicara bersamaan, dan tidak ada
 * cara menghentikan yang bawah. Karena itu `cancel()` selalu dipanggil dulu —
 * termasuk saat yang diminta adalah teks yang sama, karena itulah yang
 * dilakukan orang saat ingin berhenti: menekan tombolnya lagi.
 */
export function bacakan(teks: string, onSelesai?: () => void): void {
  if (!didukung()) return;
  window.speechSynthesis.cancel();

  const bersih = untukDibaca(teks);
  if (!bersih) {
    onSelesai?.();
    return;
  }

  const ucap = new SpeechSynthesisUtterance(bersih);
  ucap.lang = "id-ID";
  const suara = suaraIndonesia();
  if (suara) ucap.voice = suara;
  ucap.onend = () => onSelesai?.();
  // Galat dianggap selesai: tanpa ini tombolnya tersangkut di keadaan
  // "sedang membaca" selamanya saat suaranya gagal dimuat.
  ucap.onerror = () => onSelesai?.();
  window.speechSynthesis.speak(ucap);
}

export function hentikanBacaan(): void {
  if (didukung()) window.speechSynthesis.cancel();
}
