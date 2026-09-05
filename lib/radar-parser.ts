/**
 * Mengurai laporan radar harian yang ditulis D:\Downloads\Tiburon\radar\radar.py.
 *
 * Format berkasnya milik skrip itu, bukan milik aplikasi ini. Kalau formatnya
 * berubah, uji di tests/radar-parser.test.ts yang akan gagal lebih dulu —
 * bukan halaman kosong tanpa penjelasan di layar pengguna.
 */
import { konfigurasi } from "@/lib/konfigurasi";
import fs from "node:fs";
import path from "node:path";

export type ItemRadar = {
  nomor: number; kategori: string; judul: string;
  ringkasan: string; sumber: string; url: string; relevan?: string;
};
export type LaporanRadar = { tanggal: string; berita: ItemRadar[]; github: ItemRadar[] };

export function dirRadar(): string {
  return konfigurasi().radarDir;
}

function tanggalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function uraiBlok(blok: string): ItemRadar | null {
  // Baris kepala punya dua bentuk: berita punya kategori di dalam tebal dan
  // judul di luarnya ("**[Kategori]** Judul"), sedangkan item GitHub punya
  // nama repo di dalam tebal dan sisanya (bahasa, bintang) di luar
  // ("**pemilik/repo** — Bahasa, N bintang"). Satu regex menangkap isi tebal
  // dan sisa barisnya, lalu kita bedakan bentuknya lewat pola `[...]`.
  const kepala = blok.match(/^(\d+)\.\s+\*\*(.+?)\*\*\s*(.*)$/m);
  if (!kepala) return null;
  const baris = blok.split("\n").slice(1).map((b) => b.trim()).filter(Boolean);

  const barisRelevan = baris.find((b) => b.startsWith("**Untuk proyek kita:**"));
  const barisUrl = baris.find((b) => /https?:\/\//.test(b));
  const barisRingkasan = baris.find(
    (b) => b !== barisUrl && !b.startsWith("**Untuk proyek kita:**"),
  );

  const tebal = kepala[2].trim();
  const sisaBaris = kepala[3].trim();
  const kategoriCocok = tebal.match(/^\[(.+)\]$/);

  return {
    nomor: Number(kepala[1]),
    kategori: kategoriCocok ? kategoriCocok[1] : "GitHub",
    judul: kategoriCocok ? sisaBaris : `${tebal}${sisaBaris ? ` ${sisaBaris}` : ""}`,
    ringkasan: barisRingkasan ?? "",
    sumber: barisUrl?.match(/_(.+?)_/)?.[1] ?? "",
    url: barisUrl?.match(/(https?:\/\/\S+)/)?.[1] ?? "",
    relevan: barisRelevan?.replace("**Untuk proyek kita:**", "").trim() || undefined,
  };
}

function uraiBagian(teks: string, judulBagian: RegExp): ItemRadar[] {
  const mulai = teks.search(judulBagian);
  if (mulai === -1) return [];
  const sesudah = teks.slice(mulai);
  const batas = sesudah.slice(1).search(/^## /m);
  const bagian = batas === -1 ? sesudah : sesudah.slice(0, batas + 1);

  return bagian
    .split(/\n(?=\d+\.\s+\*\*)/)
    .map(uraiBlok)
    .filter((x): x is ItemRadar => x !== null);
}

export function bacaRadar(tanggal: Date, dir = dirRadar()): LaporanRadar | null {
  const iso = tanggalISO(tanggal);
  const berkas = path.join(dir, `${iso}.md`);
  if (!fs.existsSync(berkas)) return null;
  const teks = fs.readFileSync(berkas, "utf8");
  const berita = uraiBagian(teks, /^## Berita teknologi dunia/m);
  const github = uraiBagian(teks, /^## GitHub Trending/m);

  // Berkas ada tapi kedua bagian kosong: laporan harian sungguhan selalu
  // punya isi, jadi ini kemungkinan besar berarti formatnya sudah berubah
  // (mis. laporan format lama sebelum "## Berita teknologi dunia" ada).
  // Bukan kegagalan yang perlu dilempar — pemanggil tetap dapat struktur
  // yang sah — tapi jangan sampai kosong tanpa jejak sama sekali.
  if (berita.length === 0 && github.length === 0) {
    console.warn(
      `bacaRadar: ${berkas} ada tapi tidak menghasilkan item apa pun — ` +
        "kemungkinan formatnya sudah berubah dari yang diharapkan pengurai ini.",
    );
  }

  return { tanggal: iso, berita, github };
}
