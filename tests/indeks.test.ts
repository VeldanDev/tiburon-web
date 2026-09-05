import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PANJANG_POTONGAN, TUMPANG, bangunIndeks, potong } from "@/lib/indeks";
import { cari, daftarBerkas, periksaSkema } from "@/lib/korpus";

const KOTAK = path.join(process.cwd(), "data", "uji-indeks");
const SUMBER = path.join(KOTAK, "dokumen");
const DB = path.join(KOTAK, "indeks.sqlite");

beforeEach(async () => {
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
  it("teks pendek jadi satu potongan", async () => {
    const p = potong("halo dunia");
    expect(p).toHaveLength(1);
    expect(p[0].teks).toBe("halo dunia");
  });

  it("teks kosong tidak menghasilkan potongan", async () => {
    expect(potong("")).toHaveLength(0);
    expect(potong("   \n  \n ")).toHaveLength(0);
  });

  it("teks panjang dipecah, dan potongannya tumpang tindih", async () => {
    // Kalimat yang jatuh persis di batas potongan akan hilang dari keduanya
    // kalau tidak ada tumpang tindih — dan itu justru kalimat yang paling
    // sering dicari.
    const teks = "a".repeat(PANJANG_POTONGAN * 3);
    const p = potong(teks);
    expect(p.length).toBeGreaterThan(2);
    const total = p.reduce((n, x) => n + x.teks.length, 0);
    expect(total).toBeGreaterThan(teks.length);
  });

  it("selalu maju, tidak pernah menggelung", async () => {
    // Tumpang tindih yang lebih besar dari potongannya akan mengisi disk
    // sampai penuh. Nilainya dijaga, tapi ini yang memastikan akibatnya.
    expect(TUMPANG).toBeLessThan(PANJANG_POTONGAN);
    const p = potong("x".repeat(PANJANG_POTONGAN * 10));
    expect(p.length).toBeLessThan(50);
  });

  it("mencatat nomor baris awal dan akhir", async () => {
    // "Ada di berkas X" jauh kurang berguna daripada "ada di berkas X sekitar
    // baris 120" pada dokumen ratusan halaman.
    const p = potong("baris satu\nbaris dua\nbaris tiga");
    expect(p[0].awal).toBe(1);
    expect(p[0].akhir).toBeGreaterThanOrEqual(3);
  });
});

describe("bangunIndeks", () => {
  it("membangun indeks yang bisa dibaca lib/korpus.ts apa adanya", async () => {
    // Skemanya sengaja sama persis dengan skema OpenClaw: jalur bacanya sudah
    // ada, sudah diuji, dan sudah menangani kasus sulitnya. Uji ini yang
    // membuktikan kesamaan itu nyata, bukan niat.
    tulis("aturan-cuti.md", "# Aturan Cuti\n\nCuti tahunan 12 hari kerja per tahun.");
    tulis("sop/rujukan.txt", "Pasien BPJS dirujuk lewat faskes tingkat satu.");

    const r = await bangunIndeks(SUMBER, DB);
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

  it("menemukan berkas di dalam subfolder", async () => {
    tulis("a/b/c/dalam.md", "kata-yang-sangat-khusus");
    await bangunIndeks(SUMBER, DB);
    expect(cari("kata-yang-sangat-khusus", 8, DB).length).toBeGreaterThan(0);
  });

  it("melaporkan yang dilewati satu per satu, tidak melewatinya diam-diam", async () => {
    // Yang memasang harus tahu persis apa yang TIDAK masuk. Berkas yang hilang
    // tanpa penjelasan akan ditemukan berbulan-bulan kemudian, saat seseorang
    // mencari sesuatu yang memang tidak pernah diindeks.
    tulis("laporan.pdf", "%PDF-1.4 pura-pura");
    tulis("gambar.png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    tulis("sah.md", "isi yang sah");

    const r = await bangunIndeks(SUMBER, DB);
    expect(r.berkas).toBe(1);
    expect(r.dilewati.length).toBe(2);
    const sebab = r.dilewati.map((d) => `${d.jalur} ${d.sebab}`).join("\n");
    expect(sebab).toContain("laporan.pdf");
    expect(sebab.toLowerCase()).toContain("pdf");
  });

  it("berkas berekstensi teks yang isinya biner dilewati", async () => {
    tulis("palsu.txt", Buffer.from([0x41, 0x00, 0x42]));
    const r = await bangunIndeks(SUMBER, DB);
    expect(r.berkas).toBe(0);
    expect(r.dilewati[0].sebab).toContain("biner");
  });

  it("melewati node_modules dan .git", async () => {
    tulis("node_modules/pustaka/berkas.md", "jangan-ikut");
    tulis("nyata.md", "ikut");
    const r = await bangunIndeks(SUMBER, DB);
    expect(r.berkas).toBe(1);
    expect(cari("jangan-ikut", 8, DB)).toHaveLength(0);
  });

  it("membangun ulang MENGGANTI isi lama, bukan menumpuk", async () => {
    tulis("satu.md", "kucingoranye");
    await bangunIndeks(SUMBER, DB);
    fs.rmSync(path.join(SUMBER, "satu.md"));
    tulis("dua.md", "burungbiru");
    await bangunIndeks(SUMBER, DB);

    expect(daftarBerkas(DB)).toHaveLength(1);
    // Dokumen yang sudah dihapus tidak boleh tetap terjawab: itu membuat
    // Tiburon mengutip aturan yang sudah dicabut. Kata ujinya sengaja tidak
    // berbagi satu pun kata dengan yang baru — cari() menggabungkan kata
    // dengan OR, jadi "isi pertama" dan "isi kedua" akan saling cocok lewat
    // kata "isi" dan uji ini akan lulus/gagal karena alasan yang salah.
    expect(cari("kucingoranye", 8, DB)).toHaveLength(0);
    expect(cari("burungbiru", 8, DB).length).toBeGreaterThan(0);
  });

  it("folder yang tidak ada melempar dengan jelas", async () => {
    await expect(bangunIndeks(path.join(KOTAK, "hantu"), DB)).rejects.toThrow(/tidak ada/i);
  });

  it("indeks lama tetap utuh kalau pembangunan gagal", async () => {
    // Sampai pemindahan terakhir, indeks lama masih dipakai. Pengindeksan yang
    // gagal di tengah tidak boleh meninggalkan arsip rusak.
    tulis("bagus.md", "isi yang bisa dicari");
    await bangunIndeks(SUMBER, DB);
    const sebelum = fs.statSync(DB).size;

    await expect(bangunIndeks(path.join(KOTAK, "tidak-ada"), DB)).rejects.toThrow();

    expect(fs.existsSync(DB)).toBe(true);
    expect(fs.statSync(DB).size).toBe(sebelum);
    expect(cari("isi yang bisa dicari", 8, DB).length).toBeGreaterThan(0);
    // Dan tidak ada berkas setengah jadi yang tertinggal.
    expect(fs.existsSync(`${DB}.sedang-dibangun`)).toBe(false);
  });

  it("folder kosong menghasilkan indeks kosong yang tetap sah", async () => {
    const r = await bangunIndeks(SUMBER, DB);
    expect(r.berkas).toBe(0);
    // Sah, bukan rusak: Tiburon harus bisa bilang "belum ada dokumen",
    // bukan "indeksnya korup".
    expect(periksaSkema(DB).cocok).toBe(true);
    expect(cari("apa saja", 8, DB)).toHaveLength(0);
  });
});

describe("bangunIndeks — berkas kantor", () => {
  it("PDF dan Word ikut masuk indeks, terbaca lewat lib/korpus.ts", async () => {
    // Tanpa ini, pemasangan pertama di kantor klien melewati hampir seluruh
    // dokumennya dan melaporkan "0 berkas masuk" — kegagalan total yang
    // terlihat seperti alatnya rusak.
    const asal = path.join(process.cwd(), "data", "uji-kantor-docs");
    const db = path.join(KOTAK, "kantor.sqlite");
    const r = await bangunIndeks(asal, db);

    // Jumlahnya TIDAK dipatok: folder contoh bertambah seiring format baru
    // didukung, dan uji yang memeriksa angka akan gagal karena alasan yang
    // sama sekali bukan bug. Yang diperiksa: berkasnya benar-benar terjawab.
    expect(r.berkas).toBeGreaterThanOrEqual(2);
    expect(cari("cuti tahunan", 8, db).length).toBeGreaterThan(0);
    expect(cari("garansi 12 bulan", 8, db).length).toBeGreaterThan(0);

    // PDF hasil pindai dilewati DENGAN SEBAB, bukan diam-diam.
    const pindai = r.dilewati.find((d) => d.jalur.endsWith("pindai.pdf"));
    expect(pindai).toBeTruthy();
    expect(pindai!.sebab.toLowerCase()).toContain("ocr");
  });
});

describe("bangunIndeks — katalog Excel", () => {
  it("pertanyaan pelanggan menemukan baris katalog yang benar", async () => {
    // Ini rantai penuhnya: Excel -> kalimat -> indeks -> pencarian. Kalau satu
    // mata rantai putus, bot katalog menjawab "tidak tahu" untuk barang yang
    // jelas-jelas ada di daftar harga kliennya.
    const asal = path.join(process.cwd(), "data", "uji-kantor-docs");
    const db = path.join(KOTAK, "excel.sqlite");
    await bangunIndeks(asal, db);

    const h = cari("stok Aero Run biru ukuran 42", 8, db);
    expect(h.length).toBeGreaterThan(0);
    expect(h.map((x) => x.teks).join("\n")).toContain("349000");

    expect(cari("ongkir Bandung", 8, db).length).toBeGreaterThan(0);
  });
});

describe("bangunIndeks — CSV ekspor kasir", () => {
  it("penjualan dan stok bisa dicari setelah diindeks", async () => {
    const asal = path.join(process.cwd(), "data", "uji-kantor-docs");
    const db = path.join(KOTAK, "csv.sqlite");
    await bangunIndeks(asal, db);
    expect(cari("Trail Pro Abu gudang Jakarta", 8, db).length).toBeGreaterThan(0);
  });
});
