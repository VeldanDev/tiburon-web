import { describe, it, expect } from "vitest";
import path from "node:path";
import { buangBerulang, ekstrak, rapikan } from "@/lib/ekstrak";

const CONTOH = path.join(process.cwd(), "data", "uji-kantor-docs");

describe("rapikan", () => {
  it("menyambung kata yang dipenggal di ujung baris", () => {
    // PDF memenggal kata di batas baris. Dibiarkan, "peng-" dan "iriman" jadi
    // dua token berbeda dan pencarian "pengiriman" tidak menemukannya.
    expect(rapikan("biaya peng-\niriman naik")).toBe("biaya pengiriman naik");
  });

  it("menjaga batas paragraf, bukan menggabung semuanya", () => {
    expect(rapikan("Judul\n\n\n\nIsi paragraf")).toBe("Judul\n\nIsi paragraf");
  });
});

describe("buangBerulang", () => {
  it("membuang header yang muncul di hampir semua halaman", () => {
    const teks = Array.from({ length: 10 }, (_, i) => `PT Contoh Jaya\nisi halaman ${i}`).join("\n");
    const h = buangBerulang(teks, 10);
    expect(h).not.toContain("PT Contoh Jaya");
    expect(h).toContain("isi halaman 7");
  });

  it("tidak menyentuh dokumen pendek", () => {
    // Pada dokumen 2 halaman, "berulang" tidak berarti apa-apa — dan kalimat
    // yang kebetulan muncul dua kali biasanya memang isi.
    const teks = "Judul sama\nisi\nJudul sama";
    expect(buangBerulang(teks, 2)).toBe(teks);
  });

  it("tidak membuang kalimat panjang walau berulang", () => {
    const panjang = "Ini kalimat isi yang panjang sekali dan memang muncul berkali-kali di dokumen ini.";
    const teks = Array.from({ length: 8 }, () => panjang).join("\n");
    expect(buangBerulang(teks, 8)).toContain(panjang);
  });
});

describe("ekstrak", () => {
  it("membaca teks dari PDF", async () => {
    const h = await ekstrak(path.join(CONTOH, "aturan.pdf"));
    expect(h.ok).toBe(true);
    if (h.ok) {
      expect(h.teks).toContain("Cuti tahunan 12 hari kerja");
      // Penanda halaman yang disisipkan pengurai bukan isi dokumen, dan kalau
      // ikut terindeks ia cocok dengan hampir semua kueri berangka.
      expect(h.teks).not.toMatch(/--\s*\d+\s+of\s+\d+\s*--/);
    }
  });

  it("membaca teks dari Word", async () => {
    const h = await ekstrak(path.join(CONTOH, "garansi.docx"));
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.teks).toContain("Garansi berlaku 12 bulan");
  });

  it("PDF hasil pindai dikenali dan menyebut OCR, bukan dilewati kosong", async () => {
    // Dibiarkan lewat, ia masuk indeks sebagai berkas kosong — dan klien
    // bertanya kenapa dokumennya "sudah masuk" tapi tidak pernah menjawab.
    const h = await ekstrak(path.join(CONTOH, "pindai.pdf"));
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.sebab.toLowerCase()).toContain("ocr");
  });

  it("TIDAK PERNAH melempar, apa pun masukannya", async () => {
    for (const buruk of ["", "   ", "tidak-ada.pdf", "x.docx", "gambar.png"]) {
      await expect(ekstrak(buruk), buruk).resolves.toBeTruthy();
    }
  });
});

describe("ekstrak — Excel", () => {
  it("mengubah baris tabel jadi kalimat yang bisa dicocokkan kueri", async () => {
    // Baris "| Aero Run | 42 | 3 | 349000 |" tidak memuat satu pun kata yang
    // akan diketik pelanggan. Setelah jadi "Produk: Aero Run; Ukuran: 42",
    // barulah kueri "stok Aero Run ukuran 42" punya sesuatu untuk dicocokkan.
    const h = await ekstrak(path.join(CONTOH, "katalog.xlsx"));
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.teks).toContain("Produk: Aero Run; Warna: Biru; Ukuran: 42; Stok: 3; Harga: 349000");
  });

  it("nilai NOL tidak hilang", async () => {
    // "Stok: 0" adalah jawaban yang paling sering dicari pelanggan — dan
    // paling mudah terbuang oleh penyaring nilai kosong yang ceroboh.
    const h = await ekstrak(path.join(CONTOH, "katalog.xlsx"));
    if (h.ok) expect(h.teks).toContain("Stok: 0");
  });

  it("nama sheet ikut, karena itu yang membedakan baris serupa", async () => {
    const h = await ekstrak(path.join(CONTOH, "katalog.xlsx"));
    if (h.ok) {
      expect(h.teks).toContain("[Sheet Katalog]");
      expect(h.teks).toContain("[Sheet Ongkir]");
    }
  });

  it("semua sheet terbaca, bukan hanya yang pertama", async () => {
    const h = await ekstrak(path.join(CONTOH, "katalog.xlsx"));
    if (h.ok) expect(h.teks).toContain("Kota: Bandung; Tarif: 22000");
  });
});

describe("ekstrak — CSV dan TSV", () => {
  it("mengenali pemisah TITIK KOMA, bukan memaksa koma", async () => {
    // Excel berbahasa Indonesia menyimpan CSV dengan titik koma, karena koma
    // sudah dipakai sebagai pemisah desimal. Pengurai yang memaksa koma akan
    // membaca seluruh baris sebagai satu kolom raksasa — berkas yang
    // "berhasil" diindeks tapi tidak pernah menjawab apa pun.
    const h = await ekstrak(path.join(CONTOH, "penjualan.csv"));
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.teks).toContain("Produk: Aero Run Biru; Qty: 2");
  });

  it("koma di dalam tanda kutip tidak membelah kolom", async () => {
    // Tanpa ini, "Aero Run Hitam, edisi terbatas" jadi dua kolom dan menggeser
    // seluruh kolom sesudahnya — harga barang muncul di kolom qty.
    const h = await ekstrak(path.join(CONTOH, "penjualan.csv"));
    if (h.ok) {
      expect(h.teks).toContain("Produk: Aero Run Hitam, edisi terbatas");
      expect(h.teks).toContain("Qty: 3");
    }
  });

  it("BOM tidak menempel di judul kolom pertama", async () => {
    // Kalau menempel, judulnya jadi "﻿Tanggal" dan tidak akan pernah
    // cocok dengan kata "Tanggal".
    const h = await ekstrak(path.join(CONTOH, "penjualan.csv"));
    if (h.ok) {
      expect(h.teks).toContain("Tanggal: 2026-09-01");
      expect(h.teks).not.toContain("﻿");
    }
  });

  it("TSV memakai tab tanpa menebak", async () => {
    const h = await ekstrak(path.join(CONTOH, "stok.tsv"));
    expect(h.ok).toBe(true);
    if (h.ok) expect(h.teks).toContain("Gudang: Bandung; Produk: Aero Run Biru; Jumlah: 12");
  });
});

describe("ekstrak — .xls lama", () => {
  it("ditolak dengan cara memperbaikinya, bukan sekadar 'tidak didukung'", async () => {
    // Pesan yang cuma bilang "format tidak didukung" membuat yang memasang
    // buntu. Pesan yang menyebut Save As .xlsx menyelesaikannya dalam sepuluh
    // detik — dan itu bedanya antara klien yang lanjut dan klien yang berhenti.
    const h = await ekstrak(path.join(CONTOH, "lama.xls"));
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.sebab).toContain(".xlsx");
  });
});
