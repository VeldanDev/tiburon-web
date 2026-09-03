/**
 * Lampiran berkas untuk komposer.
 *
 * Berkas dibaca DI BROWSER dan isinya disisipkan ke dalam pesan — tidak ada
 * unggahan, tidak ada penyimpanan di server, tidak ada berkas sementara yang
 * harus dibersihkan. Itu bukan jalan pintas: gateway ini stateless antar
 * permintaan, jadi berkas yang diunggah tetap harus ikut dikirim di setiap
 * giliran. Menyimpannya di server hanya menambah tempat penyimpanan tanpa
 * menghapus satu pun pengirimannya.
 *
 * Yang diterima hanya berkas berbasis teks. Rantai model bawaan
 * (z-ai/glm-5.2, minimax/minimax-m3) memproses teks, jadi gambar akan
 * DITOLAK dengan alasan yang jelas — bukan diterima lalu diam-diam hilang di
 * tengah jalan, yang jauh lebih membingungkan.
 */

export type Lampiran = {
  nama: string;
  ukuran: number;
  isi: string;
  /** Diisi kalau isinya dipotong karena terlalu panjang. */
  dipotong?: boolean;
};

/**
 * Batas per berkas.
 *
 * 40.000 karakter kira-kira 10-12 ribu token — cukup untuk berkas kode atau
 * dokumen catatan yang wajar, dan masih menyisakan ruang jendela konteks untuk
 * percakapan itu sendiri. Berkas yang lebih besar dipotong, bukan ditolak:
 * separuh dokumen tetap bisa menjawab banyak pertanyaan, dan pemotongannya
 * dikatakan terus terang di antarmuka.
 */
export const BATAS_ISI = 40_000;

/** Batas ukuran mentah, dijaga sebelum berkas dibaca sama sekali. */
export const BATAS_BERKAS = 2 * 1024 * 1024;

const EKSTENSI_TEKS = [
  "txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "toml", "xml",
  "html", "css", "sql", "log", "env", "ini", "conf",
  "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "kt", "c", "h",
  "cpp", "cs", "php", "sh", "bash", "ps1", "swift", "r", "lua", "vue", "svelte",
];

export function ekstensi(nama: string): string {
  const titik = nama.lastIndexOf(".");
  return titik === -1 ? "" : nama.slice(titik + 1).toLowerCase();
}

export function berbasisTeks(nama: string, tipe: string): boolean {
  // MIME `text/*` dipercaya, TAPI ekstensi tetap diperiksa juga: browser
  // sering mengirim tipe kosong untuk ekstensi yang tidak dikenalnya (.ts dan
  // .rs termasuk), dan berkas itu justru yang paling sering dilampirkan di sini.
  if (tipe.startsWith("text/")) return true;
  if (tipe === "application/json" || tipe === "application/xml") return true;
  return EKSTENSI_TEKS.includes(ekstensi(nama));
}

/** Alasan sebuah berkas ditolak, atau null kalau boleh. */
export function alasanTolak(nama: string, tipe: string, ukuran: number): string | null {
  if (tipe.startsWith("image/")) {
    return `${nama} adalah gambar. Model yang dipakai Tiburon sekarang membaca teks saja.`;
  }
  if (!berbasisTeks(nama, tipe)) {
    return `${nama} bukan berkas teks. Yang bisa dilampirkan: dokumen, data, dan berkas kode.`;
  }
  if (ukuran > BATAS_BERKAS) {
    return `${nama} terlalu besar (${(ukuran / 1024 / 1024).toFixed(1)} MB). Batasnya 2 MB.`;
  }
  return null;
}

/**
 * Susun pesan akhir: isi lampiran lebih dulu, pertanyaan di bawahnya.
 *
 * Urutannya disengaja. Model membaca dari atas; menaruh pertanyaan SETELAH
 * bahannya berarti pertanyaan itu dibaca saat bahannya sudah ada di konteks.
 * Urutan sebaliknya membuat model menebak apa yang dicari sambil membaca.
 *
 * Dibungkus pagar ``` supaya isi berkas tidak pernah terbaca sebagai perintah:
 * berkas yang kebetulan berisi kalimat seperti "abaikan instruksi sebelumnya"
 * tetap tinggal sebagai isi berkas, bukan sebagai arahan.
 */
export function susunDenganLampiran(teks: string, lampiran: Lampiran[]): string {
  if (lampiran.length === 0) return teks;

  const bagian = lampiran.map((l) => {
    const bahasa = ekstensi(l.nama);
    const catatan = l.dipotong ? ` (dipotong di ${BATAS_ISI.toLocaleString("id-ID")} karakter)` : "";
    return `Berkas terlampir: ${l.nama}${catatan}\n\`\`\`${bahasa}\n${l.isi}\n\`\`\``;
  });

  return `${bagian.join("\n\n")}\n\n${teks}`;
}

/** Baca satu berkas jadi Lampiran, atau lempar dengan alasan yang bisa dibaca. */
export async function bacaBerkas(file: File): Promise<Lampiran> {
  const tolak = alasanTolak(file.name, file.type, file.size);
  if (tolak) throw new Error(tolak);

  const mentah = await file.text();
  const dipotong = mentah.length > BATAS_ISI;
  return {
    nama: file.name,
    ukuran: file.size,
    isi: dipotong ? mentah.slice(0, BATAS_ISI) : mentah,
    dipotong: dipotong || undefined,
  };
}
