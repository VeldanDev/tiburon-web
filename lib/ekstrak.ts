/**
 * Mengubah berkas kantor jadi teks polos, supaya bisa diindeks.
 *
 * KENAPA INI ADA. Pengindeks hanya membaca berkas teks — dan itu cukup selama
 * korpusnya milik Veldan sendiri, yang memang berisi Markdown. Tapi arsip
 * kantor mana pun di Indonesia isinya PDF hasil pindai dan Word. Tanpa berkas
 * ini, pemasangan pertama di kantor klien akan melewati hampir seluruh
 * dokumennya dan melaporkan "0 berkas masuk indeks" — yaitu kegagalan total
 * yang terlihat seperti alatnya rusak.
 *
 * TIGA ATURAN:
 *
 * 1. GAGAL PER BERKAS, BUKAN PER ARSIP. Satu PDF rusak tidak boleh
 *    membatalkan pengindeksan 500 berkas lainnya. Semua kegagalan
 *    dikembalikan sebagai hasil bernama, bukan dilempar.
 *
 * 2. PDF TANPA TEKS DIKENALI, BUKAN DIBIARKAN KOSONG. PDF hasil pindai
 *    menghasilkan nol karakter walau ekstraksinya "berhasil". Dibiarkan
 *    lewat, ia masuk indeks sebagai berkas kosong — dan klien akan bertanya
 *    kenapa dokumennya "sudah masuk" tapi tidak pernah menjawab apa pun.
 *    Kasus itu dilaporkan dengan sebab yang jelas: butuh OCR.
 *
 * 3. TEKSNYA DINORMALKAN. Header dan footer yang berulang di tiap halaman
 *    PDF adalah derau yang cocok dengan hampir semua kueri, dan mendorong
 *    potongan yang benar keluar dari hasil pencarian.
 */
import fs from "node:fs";
import path from "node:path";

export type HasilEkstrak =
  | { ok: true; teks: string; catatan?: string }
  | { ok: false; sebab: string };

/** Ekstensi yang ditangani berkas ini — di luar berkas teks polos. */
export const EKSTENSI_KANTOR = new Set(["pdf", "docx"]);

/**
 * Ambang teks minimum sebelum sebuah PDF dianggap hasil pindai.
 *
 * Bukan nol: PDF hasil pindai sering tetap memuat beberapa karakter sampah
 * dari lapisan teks yang gagal, dan ambang nol akan meloloskannya.
 */
const MIN_KARAKTER_PDF = 60;

/**
 * Buang baris yang muncul berulang di banyak halaman.
 *
 * Header dan footer PDF ("Halaman 3 dari 40", nama perusahaan, tanggal cetak)
 * muncul di setiap halaman. Dibiarkan, ia jadi potongan yang cocok dengan
 * hampir semua kueri dan mendesak keluar potongan yang benar-benar menjawab.
 *
 * Ambangnya proporsional, bukan angka tetap: dokumen 3 halaman dan dokumen
 * 300 halaman punya arti "berulang" yang berbeda.
 */
export function buangBerulang(teks: string, halaman: number): string {
  if (halaman < 3) return teks;
  const batas = Math.max(3, Math.ceil(halaman * 0.6));

  const hitung = new Map<string, number>();
  for (const baris of teks.split("\n")) {
    const b = baris.trim();
    // Baris panjang tidak mungkin header. Membuangnya berdasarkan pengulangan
    // akan memakan kalimat sah yang kebetulan muncul dua kali.
    if (b.length > 0 && b.length <= 80) hitung.set(b, (hitung.get(b) ?? 0) + 1);
  }
  const derau = new Set([...hitung].filter(([, n]) => n >= batas).map(([b]) => b));
  if (!derau.size) return teks;

  return teks
    .split("\n")
    .filter((baris) => !derau.has(baris.trim()))
    .join("\n");
}

/** Rapikan spasi dan baris kosong berlebih tanpa merusak paragraf. */
export function rapikan(teks: string): string {
  return teks
    .replace(/\r\n?/g, "\n")
    // Tanda sambung di ujung baris — hasil PDF yang memenggal kata.
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Penanda halaman yang disisipkan pdf-parse sendiri ("-- 1 of 12 --").
 *
 * Bukan isi dokumen, dan justru berbahaya kalau ikut terindeks: penanda itu
 * muncul di setiap halaman, sehingga jadi potongan yang cocok dengan hampir
 * semua kueri berangka.
 */
const PENANDA_HALAMAN = /^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm;

type HasilPdf = { text?: string; total?: number };

async function dariPdf(mentah: Buffer): Promise<HasilEkstrak> {
  let hasil: HasilPdf;
  try {
    // pdf-parse v2 memakai kelas, bukan fungsi. Bentuk ekspornya diperiksa
    // dengan menjalankannya, bukan ditebak dari dokumentasi — versi pertama
    // berkas ini memanggilnya sebagai fungsi dan gagal dengan "urai is not a
    // function" pada berkas pertama.
    const { PDFParse } = (await import("pdf-parse")) as unknown as {
      PDFParse: new (o: { data: Uint8Array }) => {
        getText: () => Promise<HasilPdf>;
        destroy?: () => Promise<void>;
      };
    };
    const parser = new PDFParse({ data: new Uint8Array(mentah) });
    try {
      hasil = await parser.getText();
    } finally {
      // Dilepas walau ekstraksinya gagal: pengurai yang tidak ditutup menahan
      // memori, dan pada arsip 500 berkas itu menumpuk sampai prosesnya mati.
      await parser.destroy?.();
    }
  } catch (e) {
    return { ok: false, sebab: `PDF tidak bisa dibaca: ${(e as Error).message}` };
  }

  const tanpaPenanda = (hasil.text ?? "").replace(PENANDA_HALAMAN, "");
  const bersih = rapikan(buangBerulang(tanpaPenanda, hasil.total ?? 1));
  if (bersih.length < MIN_KARAKTER_PDF) {
    // Aturan 2. Ini kasus paling sering di arsip kantor Indonesia, dan yang
    // paling membingungkan kalau didiamkan.
    return {
      ok: false,
      sebab: `PDF ini hasil pindai (tidak ada lapisan teks) — butuh OCR dulu sebelum bisa diindeks`,
    };
  }
  return { ok: true, teks: bersih, catatan: `${hasil.total ?? 1} halaman` };
}

async function dariDocx(jalur: string): Promise<HasilEkstrak> {
  try {
    const mammoth = (await import("mammoth")) as unknown as {
      extractRawText: (o: { path: string }) => Promise<{ value: string }>;
    };
    const { value } = await mammoth.extractRawText({ path: jalur });
    const bersih = rapikan(value ?? "");
    if (!bersih) return { ok: false, sebab: "dokumen Word ini kosong" };
    return { ok: true, teks: bersih };
  } catch (e) {
    return { ok: false, sebab: `Word tidak bisa dibaca: ${(e as Error).message}` };
  }
}

/**
 * Ekstrak teks dari satu berkas kantor.
 *
 * TIDAK PERNAH melempar — semua kegagalan jadi `{ ok: false, sebab }`, supaya
 * satu berkas rusak tidak membatalkan pengindeksan seluruh arsip.
 */
export async function ekstrak(jalur: string): Promise<HasilEkstrak> {
  const ext = path.extname(jalur).slice(1).toLowerCase();
  if (!EKSTENSI_KANTOR.has(ext)) {
    return { ok: false, sebab: `format .${ext} bukan urusan berkas ini` };
  }
  try {
    if (ext === "docx") return await dariDocx(jalur);
    return await dariPdf(fs.readFileSync(jalur));
  } catch (e) {
    return { ok: false, sebab: (e as Error).message };
  }
}
