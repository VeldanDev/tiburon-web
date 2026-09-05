/**
 * Menyunting rahasia dari hasil alat sebelum ia masuk ke percakapan.
 *
 * KENAPA INI ADA. Lapisan izin menutup berkas rahasia BERDASARKAN NAMANYA:
 * `.env.local`, `id_rsa`, `.npmrc`. Itu menutup tempat kunci biasanya
 * disimpan — tapi tidak menutup kunci yang kebetulan berada di tempat lain:
 *
 *   config.json yang memuat "apiKey": "sk-or-v1-..."
 *   catatan.md tempat Veldan menempelkan token sementara
 *   debug.log yang mencetak header Authorization
 *   docker-compose.yml dengan OPENROUTER_API_KEY=... tertulis langsung
 *
 * Ketiganya berkas teks biasa di dalam proyek, jadi lapisan izin dengan benar
 * mengizinkannya. Yang salah bukan izinnya — yang salah adalah kunci itu ikut
 * masuk ke hasil alat, lalu ke percakapan, lalu ke riwayat yang bisa diekspor,
 * dan mulai saat itu ia ada di tempat yang tidak pernah dimaksudkan.
 *
 * Jadi penyuntingan terjadi di HILIR, di satu titik yang dilewati semua alat,
 * bukan di tiap alat masing-masing. Alat tulis dan alat perintah yang belum
 * ada nanti ikut terlindungi tanpa mengingat apa pun.
 *
 * DUA ATURAN YANG MEMBENTUK DAFTAR POLANYA:
 *
 * 1. AWALAN YANG DIKENAL, BUKAN TEBAKAN BENTUK. "Rangkaian 32 huruf acak"
 *    juga cocok dengan hash git, id peti, dan sidik berkas — menyunting
 *    semuanya akan merusak hasil alat lebih sering daripada menyelamatkan
 *    kunci. Yang disunting adalah yang penerbitnya sendiri memberi awalan
 *    khas: `sk-or-v1-`, `ghp_`, `AKIA`, `xoxb-`.
 *
 * 2. YANG DISUNTING TETAP TERLIHAT. Diganti penanda, bukan dihapus. Model
 *    yang membaca berkas dengan lubang senyap akan menjawab seolah bagian
 *    itu memang kosong; model yang membaca `[RAHASIA-DISUNTING]` tahu ada
 *    sesuatu di sana dan bisa memberi tahu Veldan.
 *
 * Ini pagar terakhir, bukan pagar satu-satunya. Ia tidak menggantikan lantai
 * di `lib/izin.ts` — berkas rahasia tetap tidak boleh dibuka sama sekali,
 * karena kunci yang tidak pernah dibaca jauh lebih aman daripada kunci yang
 * dibaca lalu disunting.
 */

/** Penanda yang menggantikan rahasianya. Sengaja mencolok saat dibaca manusia. */
export const PENANDA = "[RAHASIA-DISUNTING]";

/**
 * Kunci berawalan khas, dari penerbit yang memang memberi awalan.
 *
 * Panjang minimalnya penting: `sk-` saja juga cocok dengan `sk-learn`, dan
 * `AKIA` tanpa batas panjang cocok dengan kata biasa. Yang membuat pola ini
 * aman adalah awalan DAN panjangnya sekaligus.
 */
const POLA_KUNCI: RegExp[] = [
  /sk-or-v1-[A-Za-z0-9]{32,}/g, // OpenRouter — yang dipakai Tiburon sendiri
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, // OpenAI
  /gsk_[A-Za-z0-9]{20,}/g, // Groq
  /hf_[A-Za-z0-9]{20,}/g, // Hugging Face
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g, // GitHub
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /glpat-[A-Za-z0-9_-]{16,}/g, // GitLab
  /xox[abprs]-[A-Za-z0-9-]{10,}/g, // Slack
  /AKIA[0-9A-Z]{16}/g, // AWS
  /AIza[A-Za-z0-9_-]{35}/g, // Google
  /(?:sk|pk|rk)_live_[A-Za-z0-9]{20,}/g, // Stripe
  /dop_v1_[a-f0-9]{60,}/g, // DigitalOcean
  /npm_[A-Za-z0-9]{30,}/g, // npm
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
];

/** Blok kunci privat — disunting seluruhnya, bukan baris per baris. */
const POLA_BLOK = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;

/** `Authorization: Bearer <token>` — nilainya saja yang disunting. */
const POLA_BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/gi;

/**
 * Penetapan bergaya berkas env: `OPENROUTER_API_KEY=nilai`.
 *
 * Namanya yang menentukan, bukan bentuk nilainya — kunci buatan sendiri tidak
 * punya awalan khas, dan satu-satunya petunjuk yang tersisa adalah bahwa
 * pemiliknya menamainya KEY, TOKEN, SECRET, atau PASSWORD.
 */
const POLA_PENETAPAN =
  /^([ \t]*(?:export[ \t]+)?["']?[A-Za-z_][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|CREDENTIALS)[A-Za-z0-9_]*["']?[ \t]*[=:][ \t]*)(["']?)([^\r\n]*?)\2([ \t]*,?)[ \t]*$/gim;

/**
 * Nilai yang JELAS bukan rahasia sungguhan.
 *
 * Contoh berkas (`.env.example`) dan berkas susunan yang mengambil nilainya
 * dari tempat lain justru berguna dibaca utuh: menyuntingnya membuang
 * informasi tanpa menyelamatkan apa pun.
 */
function contohBelaka(nilai: string): boolean {
  const n = nilai.trim();
  if (n.length < 8) return true; // "", "xxx", "ubah"
  if (n.includes("${") || n.includes("{{")) return true; // ${OPENROUTER_API_KEY}
  if (/^<.*>$/.test(n)) return true; // <masukkan-kunci-di-sini>
  return /^(your|isi|ganti|ubah|masukkan|contoh|example|placeholder|dummy|changeme|xxx+)/i.test(n);
}

export type HasilRedaksi = { teks: string; jumlah: number };

/**
 * Sunting semua rahasia yang dikenali dari satu teks.
 *
 * Mengembalikan jumlahnya juga: yang memanggil perlu tahu APAKAH ada yang
 * disunting supaya bisa mengatakannya, bukan menyembunyikannya.
 */
export function sunting(teks: string): HasilRedaksi {
  let jumlah = 0;
  let hasil = teks;

  hasil = hasil.replace(POLA_BLOK, () => {
    jumlah++;
    return PENANDA;
  });

  hasil = hasil.replace(
    POLA_PENETAPAN,
    (utuh, kepala: string, kutip: string, nilai: string, ekor: string) => {
      if (contohBelaka(nilai)) return utuh;
      jumlah++;
      // Ekornya dikembalikan apa adanya: koma yang hilang mengubah berkas JSON
      // yang sah menjadi berkas rusak, dan model akan melaporkan kerusakan yang
      // sebenarnya kita sendiri yang membuatnya.
      return `${kepala}${kutip}${PENANDA}${kutip}${ekor}`;
    },
  );

  hasil = hasil.replace(POLA_BEARER, (_utuh, jenis: string) => {
    jumlah++;
    return `${jenis} ${PENANDA}`;
  });

  for (const pola of POLA_KUNCI) {
    hasil = hasil.replace(pola, () => {
      jumlah++;
      return PENANDA;
    });
  }

  return { teks: hasil, jumlah };
}

/**
 * Sunting, dan katakan di ATAS hasilnya kalau ada yang disunting.
 *
 * Di atas, bukan di bawah, dengan alasan yang sama seperti pemberitahuan
 * pemotongan di `lib/baca-berkas.ts`: model yang berhenti membaca di tengah
 * tidak akan pernah melihat catatan yang ditaruh di akhir.
 */
export function suntingHasilAlat(teks: string): string {
  const { teks: bersih, jumlah } = sunting(teks);
  if (jumlah === 0) return teks;
  const kata = jumlah === 1 ? "satu rahasia" : `${jumlah} rahasia`;
  return `[Tiburon menyunting ${kata} dari hasil ini — kunci dan token tidak pernah masuk ke percakapan. Kalau Veldan memang membutuhkannya, ia harus membukanya sendiri.]\n\n${bersih}`;
}
