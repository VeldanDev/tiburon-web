/**
 * Kenapa sebuah model gagal, dan apa yang harus dilakukan karenanya.
 *
 * Diambil dari `_STATUS_TO_FAILOVER_REASON` di agent_runtime_helpers.py milik
 * Hermes, yang memetakan kode status ke SEBAB (billing / rate_limit / auth)
 * alih-alih memperlakukan semua kegagalan sama.
 *
 * Bedanya bukan kerapian. "Semua model gagal — z-ai/glm-5.2:free: HTTP 429"
 * memberitahu bahwa sesuatu rusak, tapi tidak memberitahu apakah Veldan harus
 * menunggu sepuluh menit, mengisi saldo, memperbaiki kunci, atau menyalakan
 * Wi-Fi. Keempatnya terlihat identik di layar, padahal tindakannya berbeda
 * total — dan yang paling sering terjadi di sini, 429, justru yang paling
 * tidak perlu ditakutkan.
 */

export type Sebab =
  | "kuota"
  | "saldo"
  | "kunci"
  | "jaringan"
  | "kosong"
  | "model-hilang"
  | "lain";

export type Kegagalan = { model: string; sebab: Sebab; pesan: string };

/**
 * Apa yang bisa dilakukan untuk tiap sebab.
 *
 * Ditulis sebagai tindakan, bukan sebagai penjelasan teknis: yang dibutuhkan
 * orang saat jawabannya gagal adalah langkah berikutnya, bukan istilah.
 */
const TINDAKAN: Record<Sebab, string> = {
  kuota: "Kuota model gratisnya sedang habis. Coba lagi beberapa menit lagi, atau pindah jalur.",
  saldo: "Saldo OpenRouter habis. Isi ulang, atau pakai model yang benar-benar gratis.",
  kunci: "Kunci API ditolak. Periksa OPENROUTER_API_KEY di .env.local.",
  jaringan: "Tidak bisa menghubungi OpenRouter. Periksa sambungan internetmu.",
  kosong: "Model membalas tanpa isi. Biasanya sementara — coba kirim ulang.",
  "model-hilang": "Model ini tidak ada lagi di OpenRouter. Ganti rantai modelnya di persona.",
  lain: "",
};

/**
 * Kenali sebab dari kode status dan teks galatnya.
 *
 * Teksnya ikut diperiksa, bukan cuma kodenya: OpenRouter meneruskan kegagalan
 * penyedia di baliknya dengan kode yang tidak selalu sesuai — 429 yang
 * sebenarnya soal saldo, atau 200 berisi teks tagihan (pola genspark yang
 * sudah pernah menipu failover di sini).
 */
export function kenaliSebab(status: number | null, teks: string): Sebab {
  const t = teks.toLowerCase();

  if (/insufficient|credit|saldo|billing|payment|402/.test(t)) return "saldo";
  if (status === 402) return "saldo";
  if (status === 429 || /rate.?limit|too many requests|quota/.test(t)) return "kuota";
  if (status === 401 || status === 403 || /unauthor|invalid api key|forbidden/.test(t)) {
    return "kunci";
  }
  if (status === 404 || /no endpoints found|not a valid model/.test(t)) return "model-hilang";
  if (/fetch failed|enotfound|econnrefused|etimedout|network|getaddrinfo/.test(t)) {
    return "jaringan";
  }
  return "lain";
}

/**
 * Rangkum kegagalan seluruh rantai jadi satu pesan yang bisa ditindaklanjuti.
 *
 * Kalau SEMUA model gagal karena sebab yang sama, itu yang disebut — karena
 * berarti masalahnya satu, bukan empat. Kalau sebabnya campur, tiap model
 * disebut sendiri: rantai yang setengahnya kehabisan kuota dan setengahnya
 * salah kunci adalah dua masalah, dan menyatukannya menyembunyikan salah satu.
 */
export function rangkumKegagalan(daftar: Kegagalan[]): string {
  if (daftar.length === 0) return "Tidak ada model yang dicoba.";

  const sebab = new Set(daftar.map((k) => k.sebab));
  const rinci = daftar.map((k) => `${k.model}: ${k.pesan}`).join("; ");

  if (sebab.size === 1) {
    const satu = [...sebab][0];
    const tindakan = TINDAKAN[satu];
    // Untuk sebab yang tidak dikenali, rinciannya JUSTRU yang paling berguna —
    // tidak ada tindakan yang bisa disarankan, jadi teks aslinya tidak boleh
    // disembunyikan di balik ringkasan yang tidak mengatakan apa-apa.
    return tindakan ? `${tindakan} (${rinci})` : `Semua model gagal — ${rinci}`;
  }

  return `Semua model gagal karena sebab berbeda — ${rinci}`;
}
