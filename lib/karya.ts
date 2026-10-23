/**
 * Karya — slide konten @veldorable terbaru, untuk halaman /app/karya.
 *
 * Datanya sudah ada di disk: pipeline Python menulis satu folder per konten
 * (`<tanggal>/<nama>/slide-01.png` + `judul.txt`). Tiburon cuma membacanya,
 * tidak pernah menulis ke sana.
 *
 * Bentuk halamannya diambil dari kiriman Vael 23 Okt (portofolio Framer
 * dengan foto bergantung di tali), lalu dipindah ke dunia Tiburon: tali
 * pancing dan kail, bukan jemuran.
 */
import fs from "node:fs";
import path from "node:path";
import { konfigurasi } from "@/lib/konfigurasi";

export type Karya = {
  tanggal: string;
  folder: string;
  judul: string;
  /** Jalur relatif ke akar karya, dengan garis miring maju. Dipakai rute gambar. */
  gambar: string;
};

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function daftarKarya(akar = konfigurasi().karyaDir, batas = 16): Karya[] {
  if (!fs.existsSync(akar)) return [];
  const hari = fs
    .readdirSync(akar)
    .filter((n) => POLA_TANGGAL.test(n))
    .sort()
    .reverse()
    .slice(0, 6);
  const hasil: Karya[] = [];
  for (const h of hari) {
    const folderHari = path.join(akar, h);
    const isi = fs
      .readdirSync(folderHari, { withFileTypes: true })
      // Folder berawalan "_" adalah konten yang dibatalkan; jangan dipamerkan.
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => ({ nama: d.name, slide: path.join(folderHari, d.name, "slide-01.png") }))
      .filter((x) => fs.existsSync(x.slide))
      .sort((a, b) => fs.statSync(b.slide).mtimeMs - fs.statSync(a.slide).mtimeMs);
    for (const x of isi) {
      const berkasJudul = path.join(folderHari, x.nama, "judul.txt");
      const judul = fs.existsSync(berkasJudul) ? fs.readFileSync(berkasJudul, "utf8").trim() : x.nama;
      hasil.push({ tanggal: h, folder: x.nama, judul: judul.slice(0, 120), gambar: `${h}/${x.nama}/slide-01.png` });
      if (hasil.length >= batas) return hasil;
    }
  }
  return hasil;
}

/**
 * Jalur mutlak untuk satu gambar karya, atau null kalau permintaannya keluar
 * dari akar karya atau bukan gambar. Rute gambar adalah satu-satunya pintu
 * dari browser ke disk, jadi pemeriksaannya di sini, bukan di rute.
 */
export function jalurGambar(relatif: string, akar = konfigurasi().karyaDir): string | null {
  const dasar = path.resolve(akar);
  const penuh = path.resolve(dasar, relatif);
  if (!penuh.startsWith(dasar + path.sep)) return null;
  if (!/\.(png|jpe?g)$/i.test(penuh)) return null;
  return fs.existsSync(penuh) ? penuh : null;
}
