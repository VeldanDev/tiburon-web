/**
 * OCR untuk PDF hasil pindai.
 *
 * KENAPA INI ADA. Arsip kantor di Indonesia penuh PDF hasil pindai — surat
 * bertanda tangan, nota, sertifikat, dokumen lama yang di-scan lalu disimpan.
 * Tanpa OCR, semuanya dilaporkan "butuh OCR" dan tidak satu pun bisa dijawab.
 * Pada arsip tertentu itu berarti separuh isinya hilang.
 *
 * KENAPA OPSIONAL, BUKAN SELALU MENYALA. Tiga alasan, dan ketiganya nyata:
 *
 *   lambat        satu halaman ~1-3 detik. Arsip 300 halaman pindai berarti
 *                 sepuluh menit. Pengindeksan yang biasanya selesai dalam
 *                 hitungan detik tiba-tiba butuh istirahat kopi, dan yang
 *                 memasang akan mengira prosesnya menggantung.
 *   mengunduh     data bahasa diambil dari jaringan saat pertama dipakai.
 *                 Pemasangan di kantor tanpa internet harus tetap bisa jalan.
 *   tidak selalu  banyak arsip sama sekali tidak punya berkas pindai.
 *   perlu         Menyalakannya di situ cuma menambah risiko tanpa hasil.
 *
 * Jadi bawaannya MATI, dan dinyalakan dengan `--ocr` saat memang dibutuhkan —
 * setelah pengindeksan pertama menunjukkan berapa banyak berkas pindai yang
 * ada. Urutan itu disengaja: kamu tahu ongkosnya sebelum membayarnya.
 */

/**
 * Bahasa yang dikenali.
 *
 * Indonesia DAN Inggris sekaligus: dokumen kantor Indonesia hampir selalu
 * campur — "Invoice", "Purchase Order", "Terms and Conditions" berdampingan
 * dengan kalimat Indonesia. Memakai satu bahasa saja membuat kata bahasa lain
 * dibaca sebagai huruf acak.
 */
const BAHASA = "ind+eng";

/**
 * Perbesaran saat halaman dirender jadi gambar.
 *
 * 72 dpi bawaan cukup untuk dokumen yang bersih, tapi hasil pindai sungguhan
 * penuh derau dan huruf tipis. Skala 2 kira-kira 150 dpi — batas bawah yang
 * masih dianjurkan untuk OCR. Lebih tinggi lagi memperlambat tanpa menambah
 * ketepatan yang berarti pada dokumen ukuran A4.
 */
export const SKALA = 2;

/**
 * Batas halaman yang di-OCR per berkas.
 *
 * Dokumen pindai 400 halaman hampir selalu arsip lampiran, bukan pengetahuan
 * yang akan ditanyakan. Dibatasi, dan pemotongannya DISEBUT — bukan diam-diam.
 */
export const BATAS_HALAMAN = 40;

type Pekerja = {
  recognize: (b: Buffer) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
};

export type Pembaca = {
  baca: (gambar: Uint8Array) => Promise<string>;
  tutup: () => Promise<void>;
};

/**
 * Bikin satu pembaca OCR yang dipakai ULANG untuk seluruh arsip.
 *
 * Membuat pekerja baru per berkas memakan beberapa detik masing-masing —
 * pada 50 berkas, itu menit-menit yang dihabiskan hanya untuk menyalakan
 * mesin yang sama berulang kali. Pekerjanya dibuat SEKALI, saat berkas
 * pindai pertama benar-benar ditemui, bukan di awal: arsip yang ternyata
 * tidak punya berkas pindai tidak perlu mengunduh apa pun.
 */
export function buatPembaca(lapor?: (pesan: string) => void): Pembaca {
  let pekerja: Promise<Pekerja> | null = null;

  async function siap(): Promise<Pekerja> {
    if (!pekerja) {
      lapor?.("menyiapkan OCR (mengunduh data bahasa saat pertama kali)…");
      const { createWorker } = (await import("tesseract.js")) as unknown as {
        createWorker: (b: string) => Promise<Pekerja>;
      };
      pekerja = createWorker(BAHASA);
    }
    return pekerja;
  }

  return {
    async baca(gambar: Uint8Array): Promise<string> {
      const w = await siap();
      const hasil = await w.recognize(Buffer.from(gambar));
      return hasil.data.text ?? "";
    },
    async tutup(): Promise<void> {
      if (!pekerja) return;
      try {
        (await pekerja).terminate();
      } catch {
        // Pekerja yang gagal ditutup tidak boleh menjatuhkan pengindeksan yang
        // sudah selesai — hasilnya sudah tersimpan.
      }
      pekerja = null;
    },
  };
}
