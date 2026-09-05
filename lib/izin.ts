/**
 * Lapisan izin — yang berdiri di antara "model ingin melakukan X" dan
 * "X benar-benar terjadi".
 *
 * Sampai sekarang seluruh alat agen Tiburon hanya-baca, dan itu satu-satunya
 * alasan tidak ada yang bisa rusak. Enam kemampuan yang diminta Veldan —
 * terminal, tulis berkas, buat jadwal, delegasi, Home Assistant, kontrol
 * peramban — semuanya butuh Tiburon bisa BERBUAT. Berkas ini pintunya.
 *
 * KENAPA IZINNYA TIDAK BISA CUMA "PERCAYA MODELNYA".
 *
 * Yang memutuskan bukan Veldan, tapi model — dan model bisa keliru atau
 * ditipu. Korpus Tiburon berisi kutipan narasi video orang lain; satu kalimat
 * di sana yang berbunyi seperti perintah bisa dituruti sebagai kalau-kalau ia
 * instruksi. Selama alat berbahayanya tidak ada, itu tidak berbahaya. Begitu
 * ada, ia jadi jalur serangan yang lengkap.
 *
 * TIGA TINGKAT, dan hanya tingkat pertama yang tidak bisa ditawar.
 *
 *   LANTAI      tidak pernah boleh, apa pun setelannya. Ditegakkan di kode,
 *               bukan di konfigurasi — setelan yang bisa mematikan pengaman
 *               bukan pengaman.
 *   KEBIJAKAN   diatur Veldan per jenis tindakan: izinkan, tanya, atau tolak.
 *   BAWAAN      apa pun yang tidak dikenali: TANYA. Bukan izinkan.
 *
 * Arah salahnya dipilih sadar dan berbeda dari pemindai injeksi: di sana
 * menolak terlalu banyak berarti ingatan perlahan kosong, jadi ia longgar.
 * Di sini menolak terlalu banyak cuma berarti satu pertanyaan tambahan,
 * sedangkan mengizinkan terlalu banyak berarti berkas hilang. Jadi ia ketat.
 */
import path from "node:path";
import { konfigurasi } from "@/lib/konfigurasi";

export type JenisTindakan =
  | "baca-berkas"
  | "tulis-berkas"
  | "hapus-berkas"
  | "jalankan"
  | "jadwal-buat"
  | "delegasi"
  | "jaringan";

export type Tindakan = {
  jenis: JenisTindakan;
  /** Berkas, perintah, URL, atau nama tugas — tergantung jenisnya. */
  sasaran: string;
};

export type Keputusan =
  | { hasil: "izinkan" }
  | { hasil: "tanya"; alasan: string }
  | { hasil: "tolak"; alasan: string; lantai: boolean };

export type Kebijakan = Record<JenisTindakan, "izinkan" | "tanya" | "tolak">;

/**
 * Bawaan yang ketat.
 *
 * Hanya membaca berkas yang langsung diizinkan, dan itu pun masih dibatasi
 * lantai ke folder yang boleh. Sisanya bertanya. Bawaan yang longgar akan
 * berlaku pada semua orang yang tidak pernah membuka halaman pengaturan —
 * yaitu hampir semua orang.
 */
export const KEBIJAKAN_BAWAAN: Kebijakan = {
  "baca-berkas": "izinkan",
  "tulis-berkas": "tanya",
  "hapus-berkas": "tanya",
  jalankan: "tanya",
  "jadwal-buat": "tanya",
  delegasi: "tanya",
  jaringan: "tanya",
};

/**
 * Berkas yang tidak pernah boleh disentuh — dibaca sekalipun.
 *
 * `.env.local` memuat OPENROUTER_API_KEY. Membacanya berarti kuncinya masuk ke
 * hasil alat, hasil alat masuk ke percakapan, dan percakapan masuk ke riwayat
 * yang bisa diekspor. Satu pembacaan sudah cukup untuk membocorkannya
 * selamanya.
 */
const BERKAS_TERLARANG = [
  ".env",
  ".env.local",
  ".env.production",
  ".npmrc",
  ".netrc",
  "id_rsa",
  "id_ed25519",
];

/**
 * Perintah yang tidak pernah boleh dijalankan, apa pun setelannya.
 *
 * Daftarnya sengaja pendek dan hanya berisi yang merusak secara luas. Daftar
 * panjang yang mencoba menebak semua perintah berbahaya akan penuh lubang dan
 * memberi rasa aman palsu — pertahanan sesungguhnya ada di kebijakan "tanya",
 * bukan di daftar ini.
 */
const PERINTAH_TERLARANG: [RegExp, string][] = [
  [/\brm\s+(-[a-z]*\s+)*-[a-z]*[rf]/i, "menghapus rekursif"],
  [/\b(del|erase)\s+\/s\b/i, "menghapus rekursif di Windows"],
  [/\bformat\s+[a-z]:/i, "memformat drive"],
  [/\brd\s+\/s\b/i, "menghapus folder rekursif di Windows"],
  [/:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, "fork bomb"],
  [/\bmkfs(\.\w+)?\b/i, "membuat sistem berkas baru"],
  [/>\s*\/dev\/(sd|nvme|hd)[a-z0-9]*/i, "menimpa perangkat blok"],
  [/\bdd\s+[^\n]*of=\/dev\//i, "menulis langsung ke perangkat"],
  [/\bshutdown\b|\breboot\b/i, "mematikan atau memulai ulang mesin"],
];

/** Variabel rahasia yang tidak boleh ikut ke dalam perintah atau URL. */
const POLA_RAHASIA = /\b(OPENROUTER_API_KEY|[A-Z_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)[A-Z_]*)\b/;

/** Ubah jalur apa pun jadi bentuk mutlak yang dinormalkan. */
function mutlak(jalur: string): string {
  return path.resolve(jalur.trim().replace(/^["']|["']$/g, ""));
}

/** Apakah `jalur` berada DI DALAM `akar`? */
function diDalam(jalur: string, akar: string): boolean {
  const rel = path.relative(path.resolve(akar), mutlak(jalur));
  // `path.relative` menghasilkan "..\\..." untuk jalur di luar akarnya, dan
  // "" untuk akarnya sendiri. Dibandingkan begini, bukan dengan startsWith
  // pada teksnya: "D:\\proyek-lain" berawalan sama dengan "D:\\proyek".
  return rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
}

/** Folder yang boleh disentuh sama sekali. */
function akarBoleh(): string[] {
  const k = konfigurasi();
  return [process.cwd(), path.dirname(k.riwayatDb), k.radarDir];
}

function namaBerkas(jalur: string): string {
  return path.basename(mutlak(jalur)).toLowerCase();
}

/**
 * Lantai: keputusan yang tidak pernah sampai ke kebijakan.
 *
 * Mengembalikan alasan penolakan, atau null kalau tidak ada lantai yang kena.
 */
function lantai(t: Tindakan): string | null {
  const k = konfigurasi();

  if (t.jenis === "baca-berkas" || t.jenis === "tulis-berkas" || t.jenis === "hapus-berkas") {
    const nama = namaBerkas(t.sasaran);
    if (BERKAS_TERLARANG.some((b) => nama === b || nama.startsWith(b + "."))) {
      return `Berkas rahasia (${nama}) tidak pernah boleh disentuh, bahkan dibaca.`;
    }
    // Korpus hanya-baca adalah janji yang ditulis di seluruh basis kode ini.
    // Ia ditegakkan di sini juga, bukan cuma di readOnly saat membuka —
    // sebuah alat yang menulis lewat jalan lain akan melewati janji itu.
    if (t.jenis !== "baca-berkas" && mutlak(t.sasaran) === mutlak(k.korpusDb)) {
      return "Basis data korpus hanya boleh dibaca, tidak pernah diubah.";
    }
    // MENULIS dan MENGHAPUS di luar folder yang boleh: lantai, tidak bisa
    // ditawar. MEMBACA di luar: bukan lantai — itu justru kasus yang dialog
    // izin ada untuk menyelesaikannya. Menaruhnya di lantai berarti Veldan
    // tidak bisa menunjuk satu berkas di luar proyek walau ia yang meminta,
    // dan dialog izinnya jadi tidak pernah terpicu sama sekali.
    if (t.jenis !== "baca-berkas" && !akarBoleh().some((akar) => diDalam(t.sasaran, akar))) {
      return `Di luar folder yang boleh diubah: ${mutlak(t.sasaran)}`;
    }
  }

  if (t.jenis === "jalankan") {
    for (const [pola, apa] of PERINTAH_TERLARANG) {
      if (pola.test(t.sasaran)) return `Perintah ini ${apa}, dan tidak pernah diizinkan.`;
    }
    if (POLA_RAHASIA.test(t.sasaran)) {
      return "Perintah ini menyebut variabel rahasia; kunci tidak boleh masuk ke perintah.";
    }
  }

  if (t.jenis === "jaringan" && POLA_RAHASIA.test(t.sasaran)) {
    return "Alamat ini menyebut variabel rahasia; kunci tidak boleh masuk ke URL.";
  }

  return null;
}

/**
 * Putuskan satu tindakan.
 *
 * Fungsi murni: tidak menyentuh berkas, tidak menyentuh jaringan, tidak
 * menyimpan apa pun. Seluruh keputusannya bisa diuji tanpa menjalankan apa
 * pun yang berbahaya — dan itu syarat mutlak untuk lapisan seperti ini.
 */
export function putuskan(
  t: Tindakan,
  kebijakan: Partial<Kebijakan> = {},
): Keputusan {
  const alasanLantai = lantai(t);
  if (alasanLantai) return { hasil: "tolak", alasan: alasanLantai, lantai: true };

  // Membaca DI LUAR folder yang boleh selalu bertanya, walau kebijakan
  // "baca-berkas" berbunyi izinkan. Kebijakan itu tentang berkas proyek;
  // berkas di luar adalah keputusan yang berbeda dan harus diambil sadar.
  if (t.jenis === "baca-berkas" && !akarBoleh().some((akar) => diDalam(t.sasaran, akar))) {
    return {
      hasil: "tanya",
      alasan: `Berkas ini di luar folder proyek: ${mutlak(t.sasaran)}`,
    };
  }

  const aturan = { ...KEBIJAKAN_BAWAAN, ...kebijakan }[t.jenis];

  // Jenis yang tidak dikenal sama sekali jatuh ke sini sebagai undefined, dan
  // hasilnya "tanya" — bukan "izinkan". Kapabilitas baru yang lupa didaftarkan
  // harus berhenti, bukan lewat begitu saja.
  if (aturan === "izinkan") return { hasil: "izinkan" };
  if (aturan === "tolak") {
    return { hasil: "tolak", alasan: `Ditolak oleh kebijakan: ${t.jenis}.`, lantai: false };
  }
  return { hasil: "tanya", alasan: `Butuh izinmu: ${t.jenis} — ${t.sasaran}` };
}
