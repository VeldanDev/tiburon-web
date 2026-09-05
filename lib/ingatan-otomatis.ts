/**
 * Ingatan yang menulis dirinya sendiri.
 *
 * Diambil dari Hermes, yang memperbarui memorinya di latar belakang tiap 10
 * giliran percakapan — dengan `memory.md` dibatasi 2.200 karakter DENGAN
 * SENGAJA, supaya agennya dipaksa menyaring fakta terpenting saja alih-alih
 * menumpuk semuanya. Batas itu bukan keterbatasan teknis; ia bagian
 * mekanismenya.
 *
 * INI MEMBALIK KEPUTUSAN AWAL TIBURON, dan pembalikannya disengaja.
 *
 * Sebelumnya ingatan hanya boleh ditulis tangan, dengan alasan yang ditulis di
 * layarnya sendiri: "ingatan otomatis yang salah akan mewarnai setiap jawaban
 * tanpa kamu tahu kenapa". Alasan itu masih benar, dan tidak dibuang — ia
 * dijawab dengan tiga hal yang bisa diperiksa, bukan dengan harapan:
 *
 *   1. Tiap butir otomatis DITANDAI. Kamu selalu bisa melihat mana yang kamu
 *      tulis sendiri dan mana yang disimpulkan.
 *   2. Butir yang KAMU tulis tidak pernah dihapus oleh kurasi otomatis.
 *      Model boleh mengusulkan apa saja, tapi tidak boleh membuang tulisanmu.
 *   3. Semuanya tetap bisa dihapus satu per satu dari halaman Ingatan.
 *
 * Yang tersisa dari kekhawatiran aslinya — bahwa ia bekerja diam-diam — memang
 * tetap ada. Itu harga paritas yang diminta, dan disebut apa adanya di sini
 * alih-alih disamarkan.
 */
import type { Pesan } from "@/lib/penyedia";
import { RANTAI_BAWAAN } from "@/lib/penyedia";

/**
 * Tiap berapa pesan kurasi dijalankan.
 *
 * Sepuluh, mengikuti Hermes. Dihitung dalam PESAN, bukan giliran, karena itu
 * yang benar-benar tersimpan di tabel — satu giliran adalah dua pesan, jadi
 * ini kira-kira tiap lima tanya-jawab.
 */
export const TIAP_PESAN = 10;

/**
 * Anggaran karakter untuk seluruh ingatan otomatis.
 *
 * 2.200, angka Hermes, dan dipakai apa adanya karena alasannya berlaku sama:
 * seluruh isinya ikut di SETIAP permintaan, jadi tiap karakternya dibayar
 * berkali-kali dalam sehari.
 */
export const ANGGARAN_KARAKTER = 2200;

/** Satu butir tidak boleh memakan seluruh anggaran sendirian. */
export const BATAS_SATU_BUTIR = 240;

const PROMPT = `Kamu penyaring ingatan. Dari percakapan di bawah, ambil FAKTA TETAP tentang penggunanya — hal yang masih akan benar bulan depan.

AMBIL: pekerjaan, alat dan bahasa yang dipakai, proyek yang sedang berjalan, preferensi cara bekerja, kendala tetap.
JANGAN AMBIL: isi pertanyaan, jawaban, kejadian sekali lewat, apa pun yang cuma benar hari ini.

Balas HANYA baris-baris fakta, satu per baris, tanpa nomor dan tanpa tanda hubung. Kalau tidak ada yang layak diingat, balas persis: TIDAK ADA`;

/** Buang penomoran, tanda hubung, dan kutip yang kerap ikut terbawa model. */
function bersihkan(baris: string): string {
  return baris
    .trim()
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^["“](.*)["”]$/, "$1")
    .trim();
}

/**
 * Buang imbuhan yang paling sering berubah-ubah, secukupnya saja.
 *
 * Bahasa Indonesia berimbuhan, dan model menulis ulang fakta yang sama
 * sebagai "pakai", "dipakai", lalu "memakai" pada tiga panggilan berturut —
 * tanpa ini ketiganya tersimpan sebagai tiga ingatan berbeda.
 *
 * Sengaja KONSERVATIF, dan arah salahnya dipilih: gagal mengenali kembaran
 * cuma menyisakan satu baris berlebih yang bisa dihapus sendiri; mengira dua
 * fakta berbeda itu sama akan MEMBUANG fakta yang benar tanpa ada yang tahu.
 * Karena itu batangnya wajib tersisa 4 huruf, dan tidak ada tebakan lain.
 */
function batang(kata: string): string {
  let k = kata;

  // Peluluhan nasal: me- + p/t/k/s meluluhkan huruf pertamanya.
  // memakai -> pakai, menulis -> tulis, mengirim -> kirim, menyaring -> saring
  const luluh: [RegExp, string][] = [
    [/^mem(\w{3,})/, "p$1"],
    [/^men(\w{3,})/, "t$1"],
    [/^meng(\w{3,})/, "k$1"],
    [/^meny(\w{3,})/, "s$1"],
  ];
  for (const [pola, ganti] of luluh) {
    const coba = k.replace(pola, ganti);
    if (coba !== k && coba.length >= 4) return coba;
  }

  for (const awalan of ["di", "me", "ter", "ber", "pe"]) {
    if (k.startsWith(awalan) && k.length - awalan.length >= 4) {
      k = k.slice(awalan.length);
      break;
    }
  }
  for (const akhiran of ["nya", "kan"]) {
    if (k.endsWith(akhiran) && k.length - akhiran.length >= 4) {
      k = k.slice(0, -akhiran.length);
      break;
    }
  }
  return k;
}

/**
 * Apakah dua ingatan pada dasarnya sama?
 *
 * Dibandingkan setelah dinormalkan dan dibuang imbuhannya, bukan persis:
 * model menulis ulang fakta yang sama dengan susunan berbeda tiap dipanggil,
 * dan tanpa ini daftar ingatan akan dipenuhi kembaran nyaris identik dalam
 * hitungan hari.
 */
export function serupa(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map(batang)
      .sort()
      .join(" ");
  return n(a) === n(b);
}

/**
 * Saring calon ingatan terhadap yang sudah ada.
 *
 * Dipisah dari panggilan modelnya supaya bisa diuji tanpa jaringan — dan
 * karena justru di sinilah aturan-aturan yang menjaga ingatan buatan tangan
 * berada.
 */
export function saringCalon(calon: string[], sudahAda: string[]): string[] {
  const hasil: string[] = [];
  let anggaran = ANGGARAN_KARAKTER - sudahAda.join("").length;

  for (const mentah of calon) {
    const isi = bersihkan(mentah);
    if (!isi || isi.toUpperCase() === "TIDAK ADA") continue;
    if (isi.length > BATAS_SATU_BUTIR) continue;
    if (sudahAda.some((s) => serupa(s, isi))) continue;
    if (hasil.some((s) => serupa(s, isi))) continue;
    if (isi.length > anggaran) break;

    hasil.push(isi);
    anggaran -= isi.length;
  }
  return hasil;
}

/**
 * Panggil model untuk menyaring ingatan baru dari percakapan.
 *
 * TIDAK dialirkan dan TIDAK memakai rantai penuh: ini kerja latar belakang
 * yang tidak dilihat siapa pun saat berjalan, jadi ia tidak boleh menghabiskan
 * kuota yang dibutuhkan jawaban sungguhan. Satu model, satu percobaan; gagal
 * berarti tidak ada ingatan baru kali ini, bukan galat yang ditampilkan.
 */
export async function usulkanIngatan(
  pesan: Pesan[],
  sudahAda: string[],
  opsi: { model?: string; signal?: AbortSignal } = {},
): Promise<string[]> {
  const kunci = process.env.OPENROUTER_API_KEY;
  if (!kunci) return [];

  const terakhir = pesan.slice(-TIAP_PESAN * 2);
  const percakapan = terakhir
    .map((p) => `${p.role === "user" ? "PENGGUNA" : "ASISTEN"}: ${p.content.slice(0, 1200)}`)
    .join("\n\n");

  const sistem =
    sudahAda.length > 0
      ? `${PROMPT}\n\nYANG SUDAH DIINGAT (jangan diulang):\n${sudahAda.map((s) => `- ${s}`).join("\n")}`
      : PROMPT;

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kunci}`,
      "Content-Type": "application/json",
      "X-Title": "Tiburon",
    },
    signal: opsi.signal,
    body: JSON.stringify({
      model: opsi.model ?? RANTAI_BAWAAN[0],
      messages: [
        { role: "system", content: sistem },
        { role: "user", content: percakapan },
      ],
      stream: false,
    }),
  });

  if (!resp.ok) return [];
  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const isi = data.choices?.[0]?.message?.content ?? "";
  return saringCalon(isi.split("\n"), sudahAda);
}
