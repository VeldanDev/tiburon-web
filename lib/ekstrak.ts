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
 *
 * 4. EXCEL DIUBAH JADI KALIMAT, BUKAN DISALIN SEBAGAI TABEL. Baris
 *    `| Aero Run | 42 | 3 | 349000 |` tidak memuat satu pun kata yang akan
 *    diketik pelanggan. Setelah jadi `Produk: Aero Run; Ukuran: 42; Stok: 3;
 *    Harga: 349000`, barulah kueri "stok Aero Run ukuran 42" punya sesuatu
 *    untuk dicocokkan. Ini keputusan yang paling menentukan untuk katalog
 *    produk — dan katalog hampir selalu berbentuk Excel.
 */
import fs from "node:fs";
import path from "node:path";
import type ExcelJS from "exceljs";

export type HasilEkstrak =
  | { ok: true; teks: string; catatan?: string }
  | { ok: false; sebab: string };

/** Ekstensi yang ditangani berkas ini — di luar berkas teks polos. */
export const EKSTENSI_KANTOR = new Set(["pdf", "docx", "xlsx", "xlsm", "xls", "csv", "tsv"]);

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
 * Jumlah baris maksimum per sheet.
 *
 * Sheet berisi 200.000 baris ekspor mentah bukan pengetahuan yang bisa
 * dijawab; ia cuma memenuhi indeks dan memperlambat semua pencarian
 * berikutnya. Dibatasi, dan pemotongannya DISEBUT.
 */
const BATAS_BARIS = 5_000;

/** Ubah satu nilai sel jadi teks yang wajar dibaca manusia. */
function nilaiSel(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    // Sel berformula menyimpan rumus DAN hasilnya. Yang berguna dicari orang
    // adalah hasilnya; rumusnya tidak pernah jadi jawaban.
    if (o.result !== undefined) return nilaiSel(o.result);
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return nilaiSel(o.text);
    return "";
  }
  return String(v).trim();
}

async function dariExcel(jalur: string): Promise<HasilEkstrak> {
  let buku: ExcelJS.Workbook;
  try {
    const ExcelJSMod = (await import("exceljs")).default as unknown as typeof ExcelJS;
    buku = new ExcelJSMod.Workbook();
    await buku.xlsx.readFile(jalur);
  } catch (e) {
    return { ok: false, sebab: `Excel tidak bisa dibaca: ${(e as Error).message}` };
  }

  const bagian: string[] = [];
  let dipotong = 0;

  buku.eachSheet((sheet) => {
    const baris: string[][] = [];
    sheet.eachRow((row) => {
      const sel: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => sel.push(nilaiSel(cell.value)));
      if (sel.some((x) => x !== "")) baris.push(sel);
    });
    if (!baris.length) return;

    // Baris pertama yang terisi dianggap judul kolom. Sheet tanpa judul
    // kolom tetap terbaca — nilainya diberi nomor kolom, yang masih jauh
    // lebih berguna daripada deretan angka telanjang.
    const judul = baris[0].map((h, i) => h || `Kolom ${i + 1}`);
    const isi = baris.slice(1, 1 + BATAS_BARIS);
    if (baris.length - 1 > BATAS_BARIS) dipotong += baris.length - 1 - BATAS_BARIS;

    const kalimat = isi
      .map((r) =>
        judul
          .map((h, i) => (r[i] ? `${h}: ${r[i]}` : ""))
          .filter(Boolean)
          .join("; "),
      )
      .filter((x) => x.length > 0);

    // Nama sheet ikut: pada berkas berisi "Harga 2025" dan "Harga 2026",
    // itulah satu-satunya yang membedakan dua baris yang isinya nyaris sama.
    if (kalimat.length) bagian.push([`[Sheet ${sheet.name}]`, ...kalimat].join("\n"));
  });

  if (!bagian.length) return { ok: false, sebab: "berkas Excel ini kosong" };
  return {
    ok: true,
    teks: bagian.join("\n\n"),
    catatan: dipotong ? `${dipotong} baris tidak diindeks (batas ${BATAS_BARIS} per sheet)` : undefined,
  };
}

/**
 * Tebak pemisah kolom sebuah CSV.
 *
 * KENAPA DITEBAK, BUKAN DIPATOK KOMA. Excel berbahasa Indonesia menyimpan CSV
 * dengan TITIK KOMA, karena koma sudah dipakai sebagai pemisah desimal.
 * Ekspor kasir dan ekspor akuntansi lokal hampir selalu begitu. Pengurai yang
 * memaksa koma akan membaca seluruh baris sebagai satu kolom raksasa — dan
 * hasilnya berkas yang "berhasil" diindeks tapi tidak pernah menjawab apa pun.
 *
 * Ditebak dari BARIS JUDULNYA saja: pemisah yang benar adalah yang membelah
 * baris pertama jadi paling banyak bagian.
 */
export function tebakPemisah(barisJudul: string): string {
  const calon = [";", ",", "\t", "|"];
  let terbaik = ",";
  let terbanyak = 0;
  for (const c of calon) {
    const n = pecahBaris(barisJudul, c).length;
    if (n > terbanyak) {
      terbanyak = n;
      terbaik = c;
    }
  }
  return terbaik;
}

/**
 * Pecah satu baris CSV, menghormati tanda kutip.
 *
 * Tanpa ini, alamat "Jl. Merdeka No. 5, Bandung" di dalam kutip akan terbelah
 * jadi dua kolom dan menggeser seluruh kolom sesudahnya — kesalahan yang
 * membuat harga barang muncul di kolom stok.
 */
export function pecahBaris(baris: string, pemisah: string): string[] {
  const hasil: string[] = [];
  let kini = "";
  let dalamKutip = false;
  for (let i = 0; i < baris.length; i++) {
    const c = baris[i];
    if (c === '"') {
      // Dua kutip berturut-turut di dalam kutip berarti satu kutip literal.
      if (dalamKutip && baris[i + 1] === '"') {
        kini += '"';
        i++;
      } else {
        dalamKutip = !dalamKutip;
      }
    } else if (c === pemisah && !dalamKutip) {
      hasil.push(kini.trim());
      kini = "";
    } else {
      kini += c;
    }
  }
  hasil.push(kini.trim());
  return hasil;
}

/**
 * CSV diperlakukan seperti Excel: tiap baris jadi kalimat, bukan deretan nilai.
 *
 * Alasannya sama persis — "Aero Run;Biru;42;3;349000" tidak memuat satu pun
 * kata yang akan diketik pelanggan.
 */
function dariCsv(mentah: string, pemisahPaksa?: string): HasilEkstrak {
  // BOM dibuang: kalau tidak, judul kolom pertama jadi "﻿Produk" dan
  // tidak akan pernah cocok dengan kata "Produk".
  const teks = mentah.replace(/^\uFEFF/, "");
  const baris = teks.split(/\r?\n/).filter((b) => b.trim() !== "");
  if (!baris.length) return { ok: false, sebab: "berkas CSV ini kosong" };

  const pemisah = pemisahPaksa ?? tebakPemisah(baris[0]);
  const judul = pecahBaris(baris[0], pemisah).map((h, i) => h || `Kolom ${i + 1}`);

  // Satu kolom saja berarti tebakannya meleset ATAU berkasnya memang bukan
  // tabel. Dikembalikan apa adanya sebagai teks biasa, bukan dipaksa jadi
  // kalimat "Kolom 1: seluruh baris" yang tidak menolong siapa pun.
  if (judul.length < 2) return { ok: true, teks: rapikan(teks) };

  const isi = baris.slice(1, 1 + BATAS_BARIS);
  const kalimat = isi
    .map((b) => {
      const sel = pecahBaris(b, pemisah);
      return judul
        .map((h, i) => (sel[i] !== undefined && sel[i] !== "" ? `${h}: ${sel[i]}` : ""))
        .filter(Boolean)
        .join("; ");
    })
    .filter((x) => x.length > 0);

  if (!kalimat.length) return { ok: false, sebab: "CSV ini hanya berisi judul kolom" };
  const dipotong = baris.length - 1 - isi.length;
  return {
    ok: true,
    teks: kalimat.join("\n"),
    catatan: dipotong > 0 ? `${dipotong} baris tidak diindeks (batas ${BATAS_BARIS})` : undefined,
  };
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
    if (ext === "xlsx" || ext === "xlsm") return await dariExcel(jalur);
    if (ext === "csv") return dariCsv(fs.readFileSync(jalur, "utf8"));
    // TSV pemisahnya pasti tab; tidak perlu ditebak, dan menebaknya justru
    // bisa salah pada kolom yang isinya memuat koma.
    if (ext === "tsv") return dariCsv(fs.readFileSync(jalur, "utf8"), "\t");
    if (ext === "xls") {
      // Format BIFF lama. Satu-satunya pengurai npm yang membacanya punya
      // kerentanan yang belum ditambal di versi publiknya, dan alat ini
      // membaca berkas kiriman klien — risikonya tidak sebanding dengan
      // perbaikan yang bagi kliennya cuma sepuluh detik.
      return {
        ok: false,
        sebab: "format .xls lama — buka di Excel lalu Save As .xlsx, setelah itu bisa diindeks",
      };
    }
    return await dariPdf(fs.readFileSync(jalur));
  } catch (e) {
    return { ok: false, sebab: (e as Error).message };
  }
}
