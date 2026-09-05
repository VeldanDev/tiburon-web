/**
 * Membaca satu berkas dari mesin ini — alat pertama yang lewat lapisan izin.
 *
 * Dipilih pertama dari enam kemampuan yang terkunci karena ia yang paling
 * sering berguna dan paling kecil risikonya: membaca tidak mengubah apa pun,
 * dan satu-satunya bahaya nyata — membaca berkas rahasia — sudah ditutup di
 * lantai `lib/izin.ts`, bukan di sini.
 *
 * Yang TIDAK ada di sini, dan alasannya:
 *
 *   offset/limit    Aturan Hermes: jangan pasang jalan pintas membaca sebagian
 *                   pada alat yang isinya memang harus dibaca utuh — "models
 *                   read page 1 and skip the rest". Berkas yang kepanjangan
 *                   DIPOTONG dengan pemberitahuan keras, bukan dipaginasi
 *                   diam-diam.
 *
 *   daftar folder   Sudah ada `daftar_berkas_korpus` untuk korpus, dan
 *                   menjelajah folder sembarang adalah kemampuan yang
 *                   berbeda dengan risikonya sendiri. Satu alat, satu
 *                   tanggung jawab.
 */
import fs from "node:fs";
import path from "node:path";
import { putuskan } from "@/lib/izin";

/**
 * Batas isi yang dikembalikan.
 *
 * Sama dengan batas lampiran (40.000 karakter), dan disamakan dengan sengaja:
 * keduanya menaruh teks orang lain ke dalam jendela konteks yang sama, jadi
 * dua angka berbeda cuma akan membingungkan saat salah satunya kena.
 */
export const BATAS_ISI = 40_000;

/** Berkas lebih besar dari ini tidak dibuka sama sekali. */
export const BATAS_BERKAS = 5 * 1024 * 1024;

/**
 * Ekstensi yang dianggap teks.
 *
 * Daftar putih, bukan daftar hitam: berkas biner yang lolos akan mengirim
 * ribuan karakter sampah ke model dan menghabiskan konteks tanpa memberi
 * apa pun.
 */
const EKSTENSI_TEKS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "toml", "xml",
  "html", "css", "scss", "sql", "log", "ini", "conf", "cfg", "env-contoh",
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "rb", "go", "rs", "java",
  "kt", "c", "h", "cpp", "cs", "php", "sh", "bash", "ps1", "swift", "r",
  "lua", "vue", "svelte", "gitignore", "editorconfig",
]);

function ekstensi(jalur: string): string {
  const nama = path.basename(jalur);
  const titik = nama.lastIndexOf(".");
  // Berkas tanpa titik ("Dockerfile", "Makefile") dianggap teks: itu memang
  // yang biasanya benar, dan isinya tetap diperiksa sebagai teks di bawah.
  return titik <= 0 ? "" : nama.slice(titik + 1).toLowerCase();
}

/**
 * Apakah isinya terlihat biner?
 *
 * Diperiksa dari ISINYA, bukan cuma ekstensinya: berkas `.log` yang ternyata
 * biner tetap akan merusak konteks. Byte nol adalah penanda paling andal —
 * teks sungguhan hampir tidak pernah memuatnya.
 */
function tampakBiner(isi: Buffer): boolean {
  const periksa = isi.subarray(0, 8000);
  return periksa.includes(0);
}

export type HasilBaca = { ok: true; teks: string } | { ok: false; pesan: string };

/**
 * Baca satu berkas, setelah lapisan izin mengizinkannya.
 *
 * Mengembalikan pesan, bukan melempar, untuk SEMUA kegagalan. Alat yang
 * melempar menghentikan seluruh giliran agen; alat yang mengembalikan
 * "tidak bisa karena X" membiarkan model membaca alasannya dan memberi tahu
 * penggunanya. Perbedaan itu yang paling menentukan di sini.
 */
export async function bacaBerkas(
  jalur: string,
  mintaIzin?: (t: { jenis: 'baca-berkas'; sasaran: string }) => Promise<boolean>,
): Promise<HasilBaca> {
  const bersih = jalur.trim();
  if (!bersih) return { ok: false, pesan: "Jalur berkas kosong." };

  const izin = putuskan({ jenis: "baca-berkas", sasaran: bersih });
  if (izin.hasil === "tolak") {
    // Alasannya diteruskan apa adanya. Model perlu tahu ia ditolak KARENA APA
    // supaya tidak mencoba lagi dengan jalur yang sama.
    return { ok: false, pesan: `Tidak diizinkan: ${izin.alasan}` };
  }
  if (izin.hasil === "tanya") {
    // Tanpa jalur bertanya, "tanya" berarti TIDAK — bukan diam-diam jadi ya.
    // Itu keadaan saat alat ini dipanggil dari tempat yang tidak punya layar
    // untuk menampilkan permintaannya.
    if (!mintaIzin) {
      return {
        ok: false,
        pesan: `Butuh izin untuk membaca ${bersih}, dan tidak ada tempat untuk bertanya.`,
      };
    }
    const boleh = await mintaIzin({ jenis: "baca-berkas", sasaran: bersih });
    if (!boleh) {
      // Ditolak, kedaluwarsa, dan dibatalkan semuanya berujung di sini —
      // dan ketiganya memang sama artinya bagi alat ini.
      return { ok: false, pesan: `Veldan tidak mengizinkan membaca ${bersih}.` };
    }
  }

  const mutlak = path.resolve(bersih);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(mutlak);
  } catch {
    return { ok: false, pesan: `Berkas tidak ada: ${mutlak}` };
  }
  if (stat.isDirectory()) {
    return { ok: false, pesan: `Itu folder, bukan berkas: ${mutlak}` };
  }
  if (stat.size > BATAS_BERKAS) {
    const mb = (stat.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      pesan: `Berkas terlalu besar (${mb} MB, batas ${BATAS_BERKAS / 1024 / 1024} MB): ${mutlak}`,
    };
  }

  const ext = ekstensi(mutlak);
  if (ext && !EKSTENSI_TEKS.has(ext)) {
    // Ditolak DENGAN ALASAN, seperti lampiran gambar. Penolakan tanpa alasan
    // terbaca sebagai kerusakan.
    return { ok: false, pesan: `Bukan berkas teks (.${ext}), jadi tidak dibaca: ${mutlak}` };
  }

  let mentah: Buffer;
  try {
    mentah = fs.readFileSync(mutlak);
  } catch (e) {
    return { ok: false, pesan: `Gagal membaca: ${(e as Error).message}` };
  }
  if (tampakBiner(mentah)) {
    return { ok: false, pesan: `Isinya biner, bukan teks: ${mutlak}` };
  }

  const isi = mentah.toString("utf8");
  const dipotong = isi.length > BATAS_ISI;
  const teks = dipotong ? isi.slice(0, BATAS_ISI) : isi;

  // Pemotongan DISEBUT, dan disebut di ATAS isinya. Ditaruh di bawah, model
  // yang berhenti membaca di tengah tidak akan pernah melihatnya — dan lalu
  // menjawab seolah ia sudah membaca seluruh berkas.
  const kepala = dipotong
    ? `[${mutlak} — DIPOTONG di ${BATAS_ISI.toLocaleString("id-ID")} dari ${isi.length.toLocaleString("id-ID")} karakter; bagian akhir TIDAK ada di bawah]`
    : `[${mutlak}]`;

  return { ok: true, teks: `${kepala}\n\n${teks}` };
}
