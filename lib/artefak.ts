/**
 * Artefak — potongan panjang yang layak punya panelnya sendiri.
 *
 * Gagasan dari Claude. Masalah yang dipecahkannya nyata dan terasa di sini:
 * satu berkas kode 200 baris di tengah percakapan mendorong seluruh pertanyaan
 * dan jawaban di sekitarnya keluar layar, dan membacanya berarti menggulir
 * melewati hal yang sama berulang kali. Memindahkannya ke panel di samping
 * membuat percakapan tetap terbaca sebagai percakapan.
 *
 * Yang membedakan versi ini: artefak TIDAK diminta ke model lewat instruksi
 * khusus. Ia dikenali dari jawaban yang sudah ada. Meminta model membungkus
 * jawabannya dalam penanda khusus berarti setiap model yang lupa formatnya
 * menghasilkan artefak yang hilang — dan rantai Tiburon berisi model gratis
 * yang berganti sendiri saat kena 429.
 */

export type Artefak = {
  /**
   * Diturunkan dari ISI, bukan dari posisi.
   *
   * Chip di bawah jawaban dan daftar di panel dihitung di dua tempat berbeda,
   * dan id berbasis posisi membuat keduanya memberi nomor yang tidak pernah
   * cocok — chip membuka artefak yang salah, atau tidak membuka apa pun. Id
   * berbasis isi selalu sama di mana pun ia dihitung.
   */
  id: string;
  judul: string;
  bahasa: string;
  isi: string;
  baris: number;
};

/**
 * Ambang jumlah baris sebuah blok kode untuk dianggap artefak.
 *
 * 12, bukan 5: cuplikan pendek justru lebih enak dibaca DI TEMPATNYA, di
 * tengah kalimat yang menjelaskannya. Memindahkan setiap potongan tiga baris
 * ke panel samping memutus penjelasan dari contohnya, dan menghasilkan daftar
 * artefak sepanjang percakapannya sendiri.
 */
export const AMBANG_BARIS = 12;

const NAMA_BAHASA: Record<string, string> = {
  ts: "TypeScript", typescript: "TypeScript",
  js: "JavaScript", javascript: "JavaScript",
  tsx: "React (TSX)", jsx: "React (JSX)",
  py: "Python", python: "Python",
  sh: "Shell", bash: "Shell", shell: "Shell",
  json: "JSON", yaml: "YAML", yml: "YAML",
  sql: "SQL", css: "CSS", html: "HTML",
  md: "Markdown", markdown: "Markdown",
  rs: "Rust", rust: "Rust", go: "Go",
};

/**
 * Tebak judul dari isi kode.
 *
 * Diambil dari komentar baris pertama kalau ada — model hampir selalu menaruh
 * nama berkas di sana. Kalau tidak, dari nama fungsi atau kelas pertama.
 * Judul "Blok kode 1" adalah pilihan terakhir, bukan bawaan: daftar artefak
 * yang seluruhnya bernomor tidak membantu siapa pun menemukan apa pun.
 */
function tebakJudul(isi: string, bahasa: string, urutan: number): string {
  const barisAwal = isi.split("\n").slice(0, 3);

  for (const b of barisAwal) {
    // Komentar yang menyebut nama berkas: // app/page.tsx, # radar.py
    const berkas = /(?:\/\/|#|--|\/\*)\s*([\w./-]+\.\w{1,5})/.exec(b);
    if (berkas) return berkas[1];
  }

  const nama =
    /(?:function|class|const|def|interface|type|struct)\s+([A-Za-z_$][\w$]*)/.exec(isi);
  if (nama) return nama[1];

  const label = NAMA_BAHASA[bahasa.toLowerCase()] ?? bahasa;
  return label ? `${label} ${urutan}` : `Blok kode ${urutan}`;
}

/**
 * Hash pendek dan stabil (djb2).
 *
 * Bukan kriptografi dan tidak perlu jadi: gunanya cuma memberi nama yang sama
 * untuk isi yang sama, di dua tempat yang menghitungnya terpisah. Tabrakan
 * antar dua blok kode berbeda di satu percakapan praktis tidak terjadi, dan
 * kalaupun terjadi akibatnya sekadar panel membuka artefak kembar.
 */
function sidik(teks: string): string {
  let h = 5381;
  for (let i = 0; i < teks.length; i++) h = ((h << 5) + h + teks.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Kenali artefak di dalam satu jawaban.
 *
 * Regex-nya sengaja mensyaratkan pagar PENUTUP. Blok yang belum tertutup
 * berarti jawabannya masih mengalir, dan memunculkan artefak setengah jadi
 * membuat panel berkedip-kedip berubah isi di setiap potongan teks yang masuk.
 */
export function kenaliArtefak(teks: string): Artefak[] {
  const hasil: Artefak[] = [];
  const pola = /```([\w+-]*)\n([\s\S]*?)```/g;

  let cocok: RegExpExecArray | null;
  let urutan = 0;
  while ((cocok = pola.exec(teks)) !== null) {
    const bahasa = cocok[1] ?? "";
    const isi = cocok[2].replace(/\n$/, "");
    const baris = isi.split("\n").length;
    if (baris < AMBANG_BARIS) continue;

    urutan++;
    hasil.push({
      id: sidik(isi),
      judul: tebakJudul(isi, bahasa, urutan),
      bahasa,
      isi,
      baris,
    });
  }
  return hasil;
}

/** Kenali artefak di seluruh percakapan, hanya dari balasan asisten. */
export function artefakPercakapan(
  pesan: { peran: "user" | "assistant"; isi: string }[],
): Artefak[] {
  // Pesan pengguna dilewati: lampiran berkas juga dibungkus pagar ```, dan
  // memunculkannya sebagai artefak berarti daftar ini penuh berkas yang sudah
  // dipunyai penggunanya sendiri.
  const semua = pesan.flatMap((p) => (p.peran === "assistant" ? kenaliArtefak(p.isi) : []));

  // Isi yang identik muncul sekali saja. Model kerap menulis ulang seluruh
  // berkas setelah satu perbaikan kecil, dan tanpa ini panel penuh tab yang
  // isinya sama persis.
  const terlihat = new Set<string>();
  return semua.filter((a) => !terlihat.has(a.id) && terlihat.add(a.id));
}

/** Ekstensi berkas untuk mengunduh artefak. */
export function ekstensiUntuk(bahasa: string): string {
  const peta: Record<string, string> = {
    typescript: "ts", javascript: "js", python: "py", shell: "sh",
    bash: "sh", markdown: "md", rust: "rs",
  };
  const b = bahasa.toLowerCase();
  return peta[b] ?? (b && /^[a-z0-9+-]{1,8}$/.test(b) ? b : "txt");
}
