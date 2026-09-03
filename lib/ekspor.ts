/**
 * Ekspor percakapan ke Markdown atau JSON.
 *
 * Ada karena percakapan yang tidak bisa dibawa keluar bukan milikmu sepenuhnya
 * — dan Tiburon dibangun justru karena tidak percaya pada hal yang tidak bisa
 * diperiksa sendiri. Dua bentuk, dua kegunaan berbeda:
 *
 *   Markdown  untuk dibaca dan ditempel ke tempat lain
 *   JSON      untuk diproses ulang, atau dipindahkan ke pemasangan Tiburon lain
 */

export type PesanEkspor = {
  peran: "user" | "assistant";
  isi: string;
  model?: string;
  sumber?: string[];
};

/**
 * Nama berkas dari judul.
 *
 * Karakter yang dilarang Windows (\ / : * ? " < > |) DIBUANG, bukan diganti
 * garis bawah satu per satu — judul otomatis kerap berakhir tanda tanya
 * ("Gateway lambat?"), dan "Gateway-lambat-.md" terlihat seperti kesalahan.
 */
export function namaBerkas(judul: string, ekstensi: string): string {
  const bersih =
    judul
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "obrolan";
  return `tiburon-${bersih}.${ekstensi}`;
}

export function keMarkdown(judul: string, pesan: PesanEkspor[], waktu = Date.now()): string {
  const kepala = [
    `# ${judul}`,
    "",
    `Diekspor dari Tiburon, ${new Date(waktu).toLocaleString("id-ID")}`,
    "",
    "---",
    "",
  ];

  const badan = pesan.map((p) => {
    if (p.peran === "user") return `## Kamu\n\n${p.isi}`;
    // Model yang menjawab ikut dicatat. Tanpa itu, membandingkan dua ekspor
    // lama tidak bisa menjawab "kenapa jawaban ini lebih baik" — dan di sini
    // model bisa berganti diam-diam lewat rantai cadangan.
    const kepalaBalasan = p.model ? `## Tiburon · ${p.model}` : "## Tiburon";
    const sumber = p.sumber?.length
      ? `\n\n_Sumber korpus: ${p.sumber.join(", ")}_`
      : "";
    return `${kepalaBalasan}\n\n${p.isi}${sumber}`;
  });

  return `${kepala.join("\n")}${badan.join("\n\n")}\n`;
}

export function keJson(judul: string, pesan: PesanEkspor[], waktu = Date.now()): string {
  return JSON.stringify(
    {
      aplikasi: "Tiburon",
      // Versi format disertakan sejak ekspor pertama. Menambahkannya nanti,
      // setelah berkas tanpa versi tersebar, berarti tidak akan pernah ada
      // cara mengenali berkas yang lama.
      versi: 1,
      judul,
      diekspor: new Date(waktu).toISOString(),
      pesan,
    },
    null,
    2,
  );
}

/**
 * Turunkan berkas ke komputer pengguna.
 *
 * URL objeknya dicabut setelah klik. Tanpa itu, seluruh isi percakapan tetap
 * ditahan di memori sampai tab ditutup — dan ekspor adalah hal yang dilakukan
 * berkali-kali dalam satu sesi.
 */
export function unduh(namaFile: string, isi: string, tipe: string): void {
  const blob = new Blob([isi], { type: `${tipe};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
