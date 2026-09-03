"use client";

/**
 * Blok kode dengan pewarnaan sintaks.
 *
 * Tiga hal yang menentukan bentuk komponen ini:
 *
 * 1. Shiki dimuat MALAS (`await import`), bukan lewat impor biasa. Shiki
 *    membawa tata bahasa TextMate lengkap; menariknya ke dalam bundel utama
 *    akan membebani setiap kali aplikasi dibuka, padahal banyak percakapan
 *    tidak berisi kode sama sekali. Ia baru diambil saat blok kode pertama
 *    benar-benar muncul.
 *
 * 2. Kode ditampilkan APA ADANYA lebih dulu, lalu diganti versi berwarna
 *    ketika siap. Menunggu highlighter selesai sebelum menampilkan apa pun
 *    berarti kode berkedip masuk beberapa ratus milidetik setelah teks di
 *    sekitarnya -- persis pada saat pengguna sedang membacanya.
 *
 * 3. Bahasa yang tidak dikenal TIDAK dianggap galat. Model kerap menulis
 *    ```sh, ```console, atau tidak menulis apa-apa; semuanya jatuh ke teks
 *    polos, dan itu hasil yang benar, bukan kegagalan.
 */

import { useEffect, useState } from "react";
import { IkonSalin, IkonCentang } from "@/components/Ikon";
import { useTema } from "@/components/PemilihTema";

/**
 * Tema Shiki dibangun dari palet Tiburon, bukan diambil dari tema bawaan.
 *
 * Tema bawaan mana pun (github-dark, nord, dracula) membawa keluarga warnanya
 * sendiri, dan satu blok kode bertema asing sudah cukup untuk mematahkan
 * seluruh dunia biru laut ini -- justru di elemen yang paling menarik mata.
 */
export const TEMA = {
  name: "tiburon",
  type: "dark" as const,
  colors: { "editor.background": "#060B14", "editor.foreground": "#F4F9FD" },
  settings: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#5B7FA6", fontStyle: "italic" } },
    { scope: ["string", "constant.other.symbol"], settings: { foreground: "#A8DCFB" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "#FFB454" } },
    { scope: ["keyword", "storage", "storage.type", "keyword.control"], settings: { foreground: "#3FA9F5" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call"], settings: { foreground: "#A8DCFB" } },
    { scope: ["entity.name.type", "support.type", "support.class"], settings: { foreground: "#3FA9F5" } },
    { scope: ["variable", "meta.definition.variable"], settings: { foreground: "#F4F9FD" } },
    { scope: ["variable.parameter"], settings: { foreground: "#A8DCFB" } },
    { scope: ["invalid", "invalid.illegal"], settings: { foreground: "#FF5C63" } },
    { scope: ["punctuation", "meta.brace"], settings: { foreground: "#5B7FA6" } },
  ],
};

/**
 * Tema terang, dari palet yang sama.
 *
 * BUKAN tema gelap yang dibalik. Yang berubah adalah peran, bukan nilai:
 * --shell dari teks paling terang menjadi latar, --deep dari panel menjadi
 * teks. Dan dua warna terpaksa digelapkan dengan mencampur --deep, karena
 * kontras aslinya di atas latar putih terlalu rendah untuk dibaca:
 *
 *   --surface  #3FA9F5 di atas #F4F9FD hanya ~2,3:1
 *   --foam     #A8DCFB praktis tak terlihat
 *
 * Nilai campurannya dihitung sekali di sini sebagai hex, bukan color-mix:
 * Shiki mengurai temanya sendiri di JavaScript dan tidak mengenal fungsi CSS.
 */
export const TEMA_TERANG = {
  name: "tiburon-terang",
  type: "light" as const,
  colors: { "editor.background": "#F4F9FD", "editor.foreground": "#0B2545" },
  settings: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#5B7FA6", fontStyle: "italic" } },
    { scope: ["string", "constant.other.symbol"], settings: { foreground: "#1B6B4A" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "#9A5B12" } },
    { scope: ["keyword", "storage", "storage.type", "keyword.control"], settings: { foreground: "#14487F" } },
    { scope: ["entity.name.function", "support.function", "meta.function-call"], settings: { foreground: "#0F5E8C" } },
    { scope: ["entity.name.type", "support.type", "support.class"], settings: { foreground: "#14487F" } },
    { scope: ["variable", "meta.definition.variable"], settings: { foreground: "#0B2545" } },
    { scope: ["variable.parameter"], settings: { foreground: "#0F5E8C" } },
    { scope: ["invalid", "invalid.illegal"], settings: { foreground: "#B3272E" } },
    { scope: ["punctuation", "meta.brace"], settings: { foreground: "#5B7FA6" } },
  ],
};

/**
 * Satu highlighter untuk seluruh aplikasi, dipakai ulang.
 *
 * Disimpan sebagai Promise, bukan sebagai hasilnya: kalau tiga blok kode
 * dirender pada saat yang sama, ketiganya menunggu promise YANG SAMA. Menyimpan
 * hasilnya saja akan membuat ketiganya melihat cache kosong lalu masing-masing
 * membangun highlighter sendiri.
 */
type Penyorot = {
  codeToHtml: (kode: string, opsi: { lang: string; theme: string }) => string;
  getLoadedLanguages: () => string[];
};

let janjiHighlighter: Promise<Penyorot> | null = null;

const BAHASA = [
  "typescript", "javascript", "tsx", "jsx", "python", "bash", "shell",
  "json", "yaml", "sql", "css", "html", "markdown", "rust", "go", "diff",
];

// Nama yang sering ditulis model tapi bukan id bahasa Shiki.
const ALIAS: Record<string, string> = {
  ts: "typescript", js: "javascript", py: "python", sh: "bash",
  console: "bash", shellscript: "bash", yml: "yaml", md: "markdown",
  golang: "go", rs: "rust", "": "text",
};

function highlighter(): Promise<Penyorot> {
  janjiHighlighter ??= import("shiki").then(
    (s) =>
      s.createHighlighter({ themes: [TEMA, TEMA_TERANG], langs: BAHASA }) as unknown as Promise<Penyorot>,
  );
  return janjiHighlighter;
}

export function BlokKode({
  kode,
  bahasa,
  ringkas,
}: {
  kode: string;
  bahasa: string;
  /**
   * Batasi tinggi dan beri tombol buka.
   *
   * Dipakai di dalam aliran percakapan untuk blok panjang. Tanpa ini, satu
   * berkas 200 baris mendorong pertanyaan dan jawaban di sekitarnya keluar
   * layar -- dan isi yang sama sudah tersedia utuh di panel artefak.
   */
  ringkas?: boolean;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState(false);
  const [terbentang, setTerbentang] = useState(false);
  const dipendekkan = Boolean(ringkas) && !terbentang;
  const baris = kode.split("\n").length;

  const nama = ALIAS[bahasa.toLowerCase()] ?? bahasa.toLowerCase();
  // Disorot ulang saat tema berganti. Tanpa ketergantungan ini, blok kode
  // tetap memakai warna tema lama sampai halaman dimuat ulang -- kotak gelap
  // di tengah halaman terang.
  const tema = useTema() === "terang" ? "tiburon-terang" : "tiburon";

  useEffect(() => {
    let dibatalkan = false;
    (async () => {
      try {
        const h = await highlighter();
        // Bahasa tak dikenal jatuh ke "text": hasil yang benar, bukan galat.
        const dipakai = h.getLoadedLanguages().includes(nama) ? nama : "text";
        const hasil = h.codeToHtml(kode, { lang: dipakai, theme: tema });
        if (!dibatalkan) setHtml(hasil);
      } catch {
        // Highlighter gagal dimuat (luring, bundel rusak). Kode tetap terbaca
        // apa adanya -- itulah gunanya menampilkannya lebih dulu.
      }
    })();
    return () => {
      dibatalkan = true;
    };
  }, [kode, nama, tema]);

  async function salin() {
    try {
      await navigator.clipboard.writeText(kode);
      setTersalin(true);
      window.setTimeout(() => setTersalin(false), 1400);
    } catch {
      // Clipboard ditolak; teksnya masih bisa diblok sendiri.
    }
  }

  return (
    <div
      className="my-3 overflow-hidden rounded-[var(--radius)] border"
      style={{ borderColor: "var(--garis)", background: "var(--lapis-0)" }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-1"
        style={{ borderColor: "var(--garis)" }}
      >
        <span className="text-[11px]" style={{ color: "var(--redup)" }}>
          {bahasa || "teks"}
        </span>
        <button
          onClick={salin}
          aria-label={tersalin ? "Kode tersalin" : "Salin kode"}
          className="aksi-pesan flex items-center gap-1.5 rounded-[var(--radius-kecil)] px-2 py-0.5 text-[11px]"
          style={{ color: tersalin ? "var(--hidup)" : "var(--redup)" }}
        >
          {tersalin ? <IkonCentang ukuran={11} /> : <IkonSalin ukuran={11} />}
          {tersalin ? "tersalin" : "salin"}
        </button>
      </div>

      <div
        className="relative"
        style={dipendekkan ? { maxHeight: 220, overflow: "hidden" } : undefined}
      >
        {html ? (
          // Keluaran Shiki adalah HTML yang IA SENDIRI hasilkan dari teks kode,
          // bukan HTML dari model: setiap karakter sudah di-escape olehnya saat
          // membangun token. Jadi tidak ada jalan bagi isi jawaban untuk lolos
          // jadi markup di sini.
          <div className="blok-kode overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="blok-kode overflow-x-auto px-3 py-2.5 text-[13px] leading-[1.6]">
            <code>{kode}</code>
          </pre>
        )}

        {dipendekkan && (
          <button
            onClick={() => setTerbentang(true)}
            className="absolute inset-x-0 bottom-0 flex h-16 items-end justify-center pb-1.5 text-[11px]"
            style={{
              // Gradien, bukan tepi tegas: tepi tegas terbaca sebagai akhir
              // kode, dan pengguna tidak tahu masih ada sisanya.
              background:
                "linear-gradient(180deg, transparent, color-mix(in oklab, var(--abyss) 92%, transparent) 70%)",
              color: "var(--teks-kedua)",
            }}
          >
            Tampilkan semua ({baris} baris)
          </button>
        )}
      </div>
    </div>
  );
}
