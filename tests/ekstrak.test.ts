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
