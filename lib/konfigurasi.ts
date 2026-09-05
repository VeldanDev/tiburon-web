/**
 * Konfigurasi Tiburon — jalur dan ambang, BUKAN rahasia.
 *
 * Aturannya diambil dari Hermes: `.env` khusus kredensial; setelan perilaku
 * (jalur, ambang, sakelar, preferensi tampilan) masuk ke berkas konfigurasi.
 * Alasannya bukan kerapian — variabel lingkungan tidak punya tempat untuk
 * menjelaskan dirinya, tidak muncul di mana pun saat kamu mencari "di mana
 * jalur ini disetel", dan menyamarkan setelan biasa jadi seolah rahasia.
 *
 * Sampai hari ini Tiburon punya empat variabel lingkungan dan hanya SATU yang
 * benar-benar rahasia:
 *
 *   OPENROUTER_API_KEY    rahasia — tetap di .env.local
 *   TIBURON_RIWAYAT_DB    jalur   — pindah ke sini
 *   TIBURON_KORPUS_DB     jalur   — pindah ke sini
 *   TIBURON_RADAR_DIR     jalur   — pindah ke sini
 *   TIBURON_JADWAL_DB     jalur   — pindah ke sini
 *
 * SATU PENGECUALIAN, dan ia dijembatani di sini alih-alih tersebar:
 * uji butuh menimpa jalur basis data supaya tiap berkas uji punya berkasnya
 * sendiri. Itu mekanisme, bukan konfigurasi pengguna — jadi variabel
 * lingkungannya tetap dibaca, tapi hanya sebagai penimpa, dan hanya di sini.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Konfigurasi = {
  riwayatDb: string;
  korpusDb: string;
  radarDir: string;
  jadwalDb: string;
};

/** Berkas konfigurasi opsional di akar proyek. Tidak ada = pakai bawaan. */
const BERKAS = "tiburon.config.json";

/**
 * Bawaan, DISALIN dari nilai yang sudah berjalan — bukan ditebak.
 *
 * Tiga di antaranya sempat kutebak saat memindahkannya ke sini, dan jadwal
 * langsung mati: tujuh tugas jadi nol, karena basis data OpenClaw ada di
 * `state/openclaw.sqlite`, bukan `cron.sqlite`. Nilai yang menunjuk ke luar
 * proyek tidak boleh ditebak — ia harus disalin dari yang terbukti bekerja.
 */
function bawaan(): Konfigurasi {
  const rumah = process.env.USERPROFILE ?? os.homedir();
  return {
    riwayatDb: path.join(process.cwd(), "data", "riwayat.sqlite"),
    // Korpus dan jadwal milik OpenClaw; Tiburon cuma membacanya.
    // Kalau data/korpus.sqlite ada — hasil `npm run indeks` — itu yang dipakai.
    // Kalau tidak, jatuh ke basis data OpenClaw milik Veldan. Urutannya begitu
    // supaya pemasangan baru cukup menjalankan satu perintah tanpa menyunting
    // berkas apa pun, dan supaya pemasangan Veldan sendiri tetap bekerja
    // persis seperti sebelumnya.
    korpusDb: fs.existsSync(path.join(process.cwd(), "data", "korpus.sqlite"))
      ? path.join(process.cwd(), "data", "korpus.sqlite")
      : path.join(rumah, ".openclaw", "agents", "tiburon", "agent", "openclaw-agent.sqlite"),
    jadwalDb: path.join(rumah, ".openclaw", "state", "openclaw.sqlite"),
    // Radar milik Veldan. Pemasangan lain tidak punya foldernya — dan itu
    // wajar: halaman Radar akan bilang foldernya tidak ada, bukan meledak.
    // Jalur mutlak milik satu mesin tidak boleh jadi bawaan yang dikirim ke
    // mesin lain.
    radarDir: fs.existsSync("D:\\vscode\\MyProjects\\Otak\\radar")
      ? "D:\\vscode\\MyProjects\\Otak\\radar"
      : path.join(process.cwd(), "data", "radar"),
  };
}

/**
 * Yang di-cache HANYA isi berkasnya, bukan hasil akhirnya.
 *
 * Bedanya nyata dan sudah membuat enam uji gagal: hasil akhir memuat
 * penimpa dari lingkungan, dan uji menyetel penimpa itu ULANG di tiap
 * berkas. Hasil yang dibekukan membuat berkas uji kedua memakai basis data
 * milik berkas pertama.
 *
 * Cache ada untuk menghindari operasi berkas berulang di jalur yang
 * dipanggil berkali-kali per permintaan — bukan untuk membekukan
 * lingkungan. Dengan hanya isinya yang diingat, cache-nya jadi tak terlihat
 * dari luar, dan seluruh kelas bug urutan-uji itu hilang.
 */
let berkasTersimpan: Partial<Konfigurasi> | null = null;

function bacaBerkas(): Partial<Konfigurasi> {
  if (berkasTersimpan) return berkasTersimpan;
  let hasil: Partial<Konfigurasi> = {};
  try {
    const isi = fs.readFileSync(path.join(process.cwd(), BERKAS), "utf8");
    const urai = JSON.parse(isi);
    // Hanya objek yang diterima. JSON berisi array atau null akan meledak
    // saat medannya dibaca, dan konfigurasi yang rusak tidak boleh
    // menjatuhkan seluruh aplikasi — bawaannya sudah benar untuk pemasangan
    // normal.
    if (typeof urai === "object" && urai !== null && !Array.isArray(urai)) {
      hasil = urai as Partial<Konfigurasi>;
    }
  } catch {
    // Tidak ada berkasnya, atau isinya rusak. Keduanya berarti pakai bawaan.
  }
  berkasTersimpan = hasil;
  return hasil;
}

/**
 * Jalur dan ambang yang berlaku sekarang.
 *
 * Urutannya: bawaan → berkas konfigurasi → penimpa lingkungan. Penimpa
 * lingkungan KHUSUS untuk isolasi uji; lihat catatan di kepala berkas.
 */
export function konfigurasi(): Konfigurasi {
  const dasar = { ...bawaan(), ...bacaBerkas() };
  return {
    riwayatDb: process.env.TIBURON_RIWAYAT_DB ?? dasar.riwayatDb,
    korpusDb: process.env.TIBURON_KORPUS_DB ?? dasar.korpusDb,
    radarDir: process.env.TIBURON_RADAR_DIR ?? dasar.radarDir,
    jadwalDb: process.env.TIBURON_JADWAL_DB ?? dasar.jadwalDb,
  };
}

/** Lupakan berkas konfigurasi yang sudah dibaca. Untuk uji yang menulisnya. */
export function lupakanKonfigurasi(): void {
  berkasTersimpan = null;
}
