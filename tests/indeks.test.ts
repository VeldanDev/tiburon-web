import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PANJANG_POTONGAN, TUMPANG, bangunIndeks, potong } from "@/lib/indeks";
import { cari, daftarBerkas, periksaSkema } from "@/lib/korpus";

const KOTAK = path.join(process.cwd(), "data", "uji-indeks");
const SUMBER = path.join(KOTAK, "dokumen");
const DB = path.join(KOTAK, "indeks.sqlite");

beforeEach(() => {
  fs.rmSync(KOTAK, { recursive: true, force: true });
  fs.mkdirSync(SUMBER, { recursive: true });
});
afterEach(() => {
  try {
    fs.rmSync(KOTAK, { recursive: true, force: true });
  } catch {
    // folder sementara tidak wajib bersih
  }
});

function tulis(nama: string, isi: string | Buffer) {
  const p = path.join(SUMBER, nama);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, isi);
  return p;
}

describe("potong", () => {
  it("teks pendek jadi satu potongan", () => {
    const p = potong("halo dunia");
    expect(p).toHaveLength(1);
    expect(p[0].teks).toBe("halo dunia");
  });

  it("teks kosong tidak menghasilkan potongan", () => {
    expect(potong("")).toHaveLength(0);
    expect(potong("   \n  \n ")).toHaveLength(0);
  });

  it("teks panjang dipecah, dan potongannya tumpang tindih", () => {
    // Kalimat yang jatuh persis di batas potongan akan hilang dari keduanya
    // kalau tidak ada tumpang tindih — dan itu justru kalimat yang paling
    // sering dicari.
    const teks = "a".repeat(PANJANG_POTONGAN * 3);
    const p = potong(teks);
    expect(p.length).toBeGreaterThan(2);
    const total = p.reduce((n, x) => n + x.teks.length, 0);
    expect(total).toBeGreaterThan(teks.length);
  });

  it("selalu maju, tidak pernah menggelung", () => {
    // Tumpang tindih yang lebih besar dari potongannya akan mengisi disk
    // sampai penuh. Nilainya dijaga, tapi ini yang memastikan akibatnya.
    expect(TUMPANG).toBeLessThan(PANJANG_POTONGAN);
    const p = potong("x".repeat(PANJANG_POTONGAN * 10));
    expect(p.length).toBeLessThan(50);
  });

  it("mencatat nomor baris awal dan akhir", () => {
    // "Ada di berkas X" jauh kurang berguna daripada "ada di berkas X sekitar
    // baris 120" pada dokumen ratusan halaman.
    const p = potong("baris satu\nbaris dua\nbaris tiga");
    expect(p[0].awal).toBe(1);
    expect(p[0].akhir).toBeGreaterThanOrEqual(3);
  });
});

describe("bangunIndeks", () => {
  it("membangun indeks yang bisa dibaca lib/korpus.ts apa adanya", () => {
    // Skemanya sengaja sama persis dengan skema OpenClaw: jalur bacanya sudah
    // ada, sudah diuji, dan sudah menangani kasus sulitnya. Uji ini yang
    // membuktikan kesamaan itu nyata, bukan niat.
    tulis("aturan-cuti.md", "# Aturan Cuti\n\nCuti tahunan 12 hari kerja per tahun.");
    tulis("sop/rujukan.txt", "Pasien BPJS dirujuk lewat faskes tingkat satu.");

    const r = bangunIndeks(SUMBER, DB);
    expect(r.berkas).toBe(2);
    expect(r.potongan).toBeGreaterThanOrEqual(2);

    expect(periksaSkema(DB).cocok).toBe(true);

    const hasil = cari("cuti tahunan", 8, DB);
    expect(hasil.length).toBeGreaterThan(0);
    expect(hasil[0].teks).toContain("12 hari kerja");
    // Jalurnya ikut, karena kartu sumber memakainya untuk menunjukkan asalnya.
    expect(hasil[0].path).toContain("aturan-cuti.md");

    expect(daftarBerkas(DB)).toHaveLength(2);
  });

  it("menemukan berkas di dalam subfolder", () => {
    tulis("a/b/c/dalam.md", "kata-yang-sangat-khusus");
    bangunIndeks(SUMBER, DB);
    expect(cari("kata-yang-sangat-khusus", 8, DB).length).toBeGreaterThan(0);
  });

  it("melaporkan yang dilewati satu per satu, tidak melewatinya diam-diam", () => {
    // Yang memasang harus tahu persis apa yang TIDAK masuk. Berkas yang hilang
    // tanpa penjelasan akan ditemukan berbulan-bulan kemudian, saat seseorang
    // mencari sesuatu yang memang tidak pernah diindeks.
    tulis("laporan.pdf", "%PDF-1.4 pura-pura");
    tulis("gambar.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    tulis("sah.md", "isi yang sah");

    const r = bangunIndeks(SUMBER, DB);
    expect(r.berkas).toBe(1);
    expect(r.dilewati.length).toBe(2);
    const sebab = r.dilewati.map((d) => `${d.jalur} ${d.sebab}`).join("\n");
    expect(sebab).toContain("laporan.pdf");
    expect(sebab.toLowerCase()).toContain("pdf");
  });

  it("berkas berekstensi teks yang isinya biner dilewati", () => {
    tulis("palsu.txt", Buffer.from([0x41, 0x00, 0x42]));
    const r = bangunIndeks(SUMBER, DB);
    expect(r.berkas).toBe(0);
    expect(r.dilewati[0].sebab).toContain("biner");
  });

  it("melewati node_modules dan .git", () => {
    tulis("node_modules/pustaka/berkas.md", "jangan-ikut");
    tulis("nyata.md", "ikut");
    const r = bangunIndeks(SUMBER, DB);
    expect(r.berkas).toBe(1);
    expect(cari("jangan-ikut", 8, DB)).toHaveLength(0);
  });

  it("membangun ulang MENGGANTI isi lama, bukan menumpuk", () => {
    tulis("satu.md", "kucingoranye");
    bangunIndeks(SUMBER, DB);
    fs.rmSync(path.join(SUMBER, "satu.md"));
    tulis("dua.md", "burungbiru");
    bangunIndeks(SUMBER, DB);

    expect(daftarBerkas(DB)).toHaveLength(1);
    // Dokumen yang sudah dihapus tidak boleh tetap terjawab: itu membuat
    // Tiburon mengutip aturan yang sudah dicabut. Kata ujinya sengaja tidak
    // berbagi satu pun kata dengan yang baru — cari() menggabungkan kata
    // dengan OR, jadi "isi pertama" dan "isi kedua" akan saling cocok lewat
    // kata "isi" dan uji ini akan lulus/gagal karena alasan yang salah.
    expect(cari("kucingoranye", 8, DB)).toHaveLength(0);
    expect(cari("burungbiru", 8, DB).length).toBeGreaterThan(0);
  });

  it("folder yang tidak ada melempar dengan jelas", () => {
    expect(() => bangunIndeks(path.join(KOTAK, "hantu"), DB)).toThrow(/tidak ada/i);
  });

  it("indeks lama tetap utuh kalau pembangunan gagal", () => {
    // Sampai pemindahan terakhir, indeks lama masih dipakai. Pengindeksan yang
    // gagal di tengah tidak boleh meninggalkan arsip rusak.
    tulis("bagus.md", "isi yang bisa dicari");
    bangunIndeks(SUMBER, DB);
    const sebelum = fs.statSync(DB).size;

    expect(() => bangunIndeks(path.join(KOTAK, "tidak-ada"), DB)).toThrow();

    expect(fs.existsSync(DB)).toBe(true);
    expect(fs.statSync(DB).size).toBe(sebelum);
    expect(cari("isi yang bisa dicari", 8, DB).length).toBeGreaterThan(0);
    // Dan tidak ada berkas setengah jadi yang tertinggal.
    expect(fs.existsSync(`${DB}.sedang-dibangun`)).toBe(false);
  });

  it("folder kosong menghasilkan indeks kosong yang tetap sah", () => {
    const r = bangunIndeks(SUMBER, DB);
    expect(r.berkas).toBe(0);
    // Sah, bukan rusak: Tiburon harus bisa bilang "belum ada dokumen",
    // bukan "indeksnya korup".
    expect(periksaSkema(DB).cocok).toBe(true);
    expect(cari("apa saja", 8, DB)).toHaveLength(0);
  });
});
