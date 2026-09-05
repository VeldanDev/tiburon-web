/**
 * `npm run indeks -- <folder>` — bangun indeks korpus dari sebuah folder.
 *
 * Ini perintah yang dijalankan saat memasang Tiburon di kantor orang. Ia
 * satu-satunya langkah yang mengubah "aplikasi kosong" jadi "aplikasi yang
 * tahu isi arsip mereka", jadi ia harus bisa dijalankan tanpa membuka kode
 * sama sekali.
 *
 * Ditulis .mjs, bukan .ts: satu perintah tanpa langkah kompilasi. Menambah
 * tsx atau ts-node hanya demi berkas ini berarti satu ketergantungan lagi
 * yang harus terpasang di mesin klien sebelum apa pun bisa dimulai.
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Modulnya TypeScript, dan Node 24 bisa menjalankannya langsung dengan
// pelucutan tipe. Kalau suatu hari tidak bisa, kegagalannya harus menyebut
// alasannya, bukan sekadar "cannot find module".
let bangunIndeks;
try {
  ({ bangunIndeks } = await import("../lib/indeks.ts"));
} catch (e) {
  console.error("Tidak bisa memuat lib/indeks.ts:", e.message);
  console.error("Butuh Node 24 atau lebih baru. Cek dengan: node --version");
  process.exit(1);
}

const argumen = process.argv.slice(2);
const folder = argumen[0];

if (!folder || folder === "--bantuan" || folder === "-h") {
  console.log(`
  Bangun indeks dokumen untuk Tiburon.

    npm run indeks -- "D:\\\\Dokumen Kantor"
    npm run indeks -- "D:\\\\Dokumen Kantor" --ke data/korpus.sqlite

  Setelah selesai, tunjuk indeksnya di tiburon.config.json:

    { "korpusDb": "data/korpus.sqlite" }

  Format yang terbaca: txt, md, csv, tsv, json, yaml, html, xml, log, sql.
  PDF dan Word BELUM terbaca — yang dilewati disebut satu per satu di bawah.
`);
  process.exit(folder ? 0 : 1);
}

const iKe = argumen.indexOf("--ke");
const tujuan = path.resolve(
  iKe !== -1 && argumen[iKe + 1] ? argumen[iKe + 1] : path.join("data", "korpus.sqlite"),
);

console.log(`Sumber : ${path.resolve(folder)}`);
console.log(`Indeks : ${tujuan}\n`);

const mulai = Date.now();
let ringkasan;
try {
  // Tiap berkas dilaporkan saat diproses. Pada arsip besar, perintah yang diam
  // selama dua menit tidak bisa dibedakan dari perintah yang menggantung.
  ringkasan = bangunIndeks(folder, tujuan, (p) => console.log(`  ${p}`));
} catch (e) {
  console.error(`\nGagal: ${e.message}`);
  process.exit(1);
}

const detik = ((Date.now() - mulai) / 1000).toFixed(1);
console.log(
  `\nSelesai dalam ${detik} detik — ${ringkasan.berkas} berkas, ${ringkasan.potongan} potongan.`,
);

if (ringkasan.dilewati.length) {
  // Disebut satu per satu, bukan dihitung saja. "12 berkas dilewati" tidak
  // memberi tahu siapa pun berkas MANA yang tidak akan pernah terjawab nanti.
  console.log(`\n${ringkasan.dilewati.length} berkas dilewati:`);
  for (const d of ringkasan.dilewati) console.log(`  ${d.jalur}\n    → ${d.sebab}`);
}

if (ringkasan.berkas === 0) {
  console.log(
    "\nTidak ada satu pun berkas yang masuk indeks. Periksa foldernya, atau lihat daftar yang dilewati di atas.",
  );
}

const konfig = path.join(process.cwd(), "tiburon.config.json");
if (!fs.existsSync(konfig)) {
  console.log(`\nLangkah terakhir — buat ${path.basename(konfig)} berisi:`);
  console.log(`  { "korpusDb": ${JSON.stringify(tujuan)} }`);
}
