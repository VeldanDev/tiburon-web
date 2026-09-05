/**
 * Gerbang sandi — satu sandi, bukan akun.
 *
 * KENAPA INI ADA, DAN KENAPA BARU SEKARANG. Selama Tiburon hanya berjalan di
 * `localhost` milik Veldan, tidak ada yang perlu dijaga: satu-satunya orang
 * yang bisa membukanya adalah orang yang sudah duduk di depan mesinnya.
 *
 * Tapi `npm run dev` mengikat ke SEMUA antarmuka, bukan cuma localhost —
 * layarnya sendiri mencetak `Network: http://192.168.1.4:3000`. Artinya siapa
 * pun di Wi-Fi yang sama sudah bisa membaca seluruh korpus, riwayat, dan
 * catatan pribadi sejak hari pertama, tanpa ditanya apa pun. Di rumah itu
 * berarti satu-dua orang. Di kantor klien, itu berarti semua orang.
 *
 * ATURAN YANG DIPILIH, DAN KENAPA BUKAN YANG LAIN:
 *
 *   localhost           selalu terbuka. Menuntut sandi dari orang yang sudah
 *                       memegang papan ketiknya tidak menambah keamanan apa
 *                       pun — ia hanya menambah gesekan pada pemakaian yang
 *                       paling sering terjadi.
 *
 *   dari jaringan       WAJIB bersandi. Kalau `SANDI_TIBURON` belum diisi,
 *                       permintaannya DITOLAK — bukan diloloskan dengan
 *                       peringatan. Ini keputusan yang paling menentukan di
 *                       berkas ini: pemasangan yang lupa mengisi sandi harus
 *                       gagal dengan berisik, karena kegagalan senyap di sini
 *                       artinya arsip satu kantor terbuka untuk satu jaringan
 *                       penuh, dan tidak ada yang akan tahu sampai terlambat.
 *
 * SATU SANDI, BUKAN AKUN. Tiburon dipakai satu orang, atau satu kantor kecil
 * yang saling percaya. Akun berarti pendaftaran, pemulihan sandi, peran, dan
 * pemisahan data per pengguna — empat hal yang tidak satu pun dibutuhkan
 * hari ini, dan semuanya bisa ditambahkan nanti tanpa membongkar yang ini.
 *
 * KENAPA WEB CRYPTO, BUKAN `node:crypto`. Middleware Next.js berjalan di
 * runtime Edge, yang tidak punya modul bawaan Node sama sekali — versi pertama
 * berkas ini memakai `node:crypto`, lolos seluruh ujinya (Vitest jalan di
 * Node), lalu menjatuhkan server dengan galat 500 pada permintaan pertama.
 * `crypto.subtle` ada di ketiga tempat yang memakainya: Edge, Node, dan uji.
 * Konsekuensinya semua fungsi di sini jadi async, dan itu harga yang murah
 * dibanding dua salinan aturan yang perlahan berbeda.
 */

/** Nama kuki sesi. */
export const NAMA_KUKI = "tiburon_sesi";

/** Sesi berlaku 30 hari. Cukup lama untuk tidak mengganggu, cukup pendek untuk kedaluwarsa. */
export const UMUR_SESI_DETIK = 30 * 24 * 60 * 60;

/**
 * Alamat yang dianggap "mesin ini sendiri".
 *
 * `::1` dan bentuk terpetakan IPv4-nya ikut, karena peramban melaporkan salah
 * satu dari ketiganya tergantung bagaimana ia menyambung — dan gerbang yang
 * hanya mengenali satu bentuk akan mengunci Veldan dari mesinnya sendiri.
 */
const LOKAL = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);

export function alamatLokal(host: string | null | undefined): boolean {
  if (!host) return false;
  // Porta dibuang. "localhost:3000" dan "localhost" adalah tempat yang sama.
  const tanpaPorta = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return LOKAL.has(tanpaPorta.toLowerCase());
}

const enkode = new TextEncoder();

async function hmac(kunci: string, pesan: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    enkode.encode(kunci),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enkode.encode(pesan)));
}

function keHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Bandingkan dua rangkaian tanpa membocorkan panjang kecocokan lewat waktu.
 *
 * Perbandingan `===` biasa berhenti di huruf pertama yang berbeda, dan selisih
 * waktunya — walau mikrodetik — cukup untuk menebak isinya huruf per huruf.
 * Panjang yang berbeda dijawab false lebih dulu; itu aman karena panjang di
 * sini selalu panjang digest, bukan panjang sandinya.
 */
function samaWaktuTetap(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

/** Sandi yang dipasang, atau null kalau belum diisi. */
export function sandiTerpasang(): string | null {
  const s = process.env.SANDI_TIBURON?.trim();
  return s ? s : null;
}

/**
 * Apakah sandi yang diberikan sama dengan yang terpasang?
 *
 * Keduanya di-hash dulu supaya yang dibandingkan selalu sepanjang digest —
 * dengan begitu perbedaan panjang sandi tidak bisa dibaca dari waktu jawabnya.
 */
export async function sandiCocok(diberikan: string, sebenarnya: string): Promise<boolean> {
  const [a, b] = await Promise.all([hmac("banding", diberikan), hmac("banding", sebenarnya)]);
  return samaWaktuTetap(keHex(a), keHex(b));
}

/**
 * Bikin nilai kuki sesi: `kadaluarsa.acak.tandatangan`.
 *
 * Kadaluarsanya ikut DITANDATANGANI, bukan cuma dititipkan. Kalau tidak, siapa
 * pun bisa menyunting angkanya di perambannya sendiri dan memperpanjang
 * sesinya seumur hidup.
 *
 * Rahasia tanda tangannya diturunkan dari sandinya sendiri. Konsekuensinya
 * sengaja: mengganti sandi otomatis membatalkan semua sesi yang sudah ada —
 * yang persis diinginkan orang saat ia mengganti sandi.
 */
export async function buatSesi(sandi: string, sekarang = Date.now()): Promise<string> {
  const kadaluarsa = sekarang + UMUR_SESI_DETIK * 1000;
  const acak = keHex(crypto.getRandomValues(new Uint8Array(8)));
  const isi = `${kadaluarsa}.${acak}`;
  return `${isi}.${keHex(await hmac(`sesi-v1:${sandi}`, isi))}`;
}

/**
 * Apakah kuki ini sah dan belum kedaluwarsa?
 *
 * Semua kegagalan — bentuk salah, tanda tangan salah, sudah lewat waktu —
 * menghasilkan `false` yang sama. Membedakan pesannya hanya memberi tahu
 * penebak seberapa dekat ia.
 */
export async function sesiSah(
  nilai: string | undefined | null,
  sandi: string,
  sekarang = Date.now(),
): Promise<boolean> {
  if (!nilai) return false;
  const bagian = nilai.split(".");
  if (bagian.length !== 3) return false;

  const [kadaluarsa, acak, tanda] = bagian;
  const harusnya = keHex(await hmac(`sesi-v1:${sandi}`, `${kadaluarsa}.${acak}`));

  // Tanda tangan diperiksa DULU, sebelum waktunya. Membaca angka kedaluwarsa
  // dari kuki yang belum terbukti asli berarti mempercayai angka yang ditulis
  // orang lain.
  if (!samaWaktuTetap(tanda, harusnya)) return false;

  const batas = Number(kadaluarsa);
  return Number.isFinite(batas) && batas > sekarang;
}

export type Putusan =
  | { hasil: "boleh" }
  | { hasil: "minta-sandi" }
  | { hasil: "tolak"; alasan: string };

/**
 * Boleh masuk atau tidak.
 *
 * Ini seluruh logikanya, terpisah dari middleware supaya bisa diuji tanpa
 * membangun permintaan HTTP palsu — dan supaya aturannya bisa dibaca dalam
 * satu layar.
 */
export async function putusanMasuk(opsi: {
  host: string | null | undefined;
  kuki: string | null | undefined;
  sandi?: string | null;
  sekarang?: number;
}): Promise<Putusan> {
  const sandi = opsi.sandi === undefined ? sandiTerpasang() : opsi.sandi;

  if (alamatLokal(opsi.host)) return { hasil: "boleh" };

  if (!sandi) {
    // Fail-closed. Pemasangan yang lupa mengisi sandi GAGAL, bukan terbuka.
    return {
      hasil: "tolak",
      alasan:
        "Tiburon diakses dari jaringan, tapi SANDI_TIBURON belum diisi di .env.local. " +
        "Isi sandinya lalu jalankan ulang — akses jaringan tanpa sandi tidak diizinkan.",
    };
  }

  return (await sesiSah(opsi.kuki, sandi, opsi.sekarang))
    ? { hasil: "boleh" }
    : { hasil: "minta-sandi" };
}
