/**
 * Kait resolver supaya Node mengerti `@/lib/...` seperti Next.js dan Vitest.
 *
 * Alias itu disetel di tsconfig.json, dan tsconfig hanya dibaca oleh yang
 * memakainya — Next dan Vitest. Node murni tidak tahu apa-apa soal itu, jadi
 * `bot/telegram.mjs` yang mengimpor lib/bot-jawab.ts akan gagal di impor
 * pertamanya.
 *
 * Dua jalan lain sudah dipertimbangkan dan ditolak:
 *
 *   ubah semua impor jadi relatif   Menyentuh puluhan berkas demi satu skrip,
 *                                   dan membuat kode di lib/ tidak seragam.
 *   pakai bundler                   Satu langkah kompilasi lagi sebelum bot
 *                                   bisa dijalankan di mesin klien.
 *
 * Kaitnya sembilan baris dan hanya dipakai skrip di bot/.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const AKAR = new URL("../", import.meta.url);

/**
 * Ekstensi ditambahkan sendiri kalau tidak ditulis.
 *
 * TypeScript membiarkan `import "@/lib/korpus"` tanpa ekstensi; ESM Node
 * mewajibkannya. Tanpa langkah ini kaitnya berhasil memetakan alias, lalu
 * gagal satu lapis lebih dalam dengan pesan yang menyebut jalur yang sudah
 * benar — kegagalan yang terlihat seperti kesalahan jalur, padahal soal
 * ekstensi.
 */
function lengkapi(href) {
  if (/\.[cm]?[jt]sx?$/.test(href)) return href;
  for (const ext of [".ts", ".tsx", ".mjs", ".js"]) {
    if (fs.existsSync(fileURLToPath(href + ext))) return href + ext;
  }
  return href;
}

export function resolve(spesifier, konteks, berikutnya) {
  if (spesifier.startsWith("@/")) {
    return berikutnya(lengkapi(new URL(spesifier.slice(2), AKAR).href), konteks);
  }
  // Impor relatif DI DALAM lib/ juga sering tanpa ekstensi.
  if (spesifier.startsWith(".") && konteks.parentURL) {
    const penuh = new URL(spesifier, konteks.parentURL).href;
    const lengkap = lengkapi(penuh);
    if (lengkap !== penuh) return berikutnya(lengkap, konteks);
  }
  return berikutnya(spesifier, konteks);
}
