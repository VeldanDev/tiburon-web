import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ANGGARAN_KARAKTER,
  BATAS_SATU_BUTIR,
  TIAP_PESAN,
  saringCalon,
  serupa,
} from "@/lib/ingatan-otomatis";
import {
  BATAS_JUMLAH_INGATAN,
  daftarIngatan,
  sisakanRuangOtomatis,
  tambahIngatan,
} from "@/lib/pengaturan";

let db: string;
beforeEach(() => {
  db = path.join(os.tmpdir(), `ingatan-uji-${Date.now()}-${Math.random()}.sqlite`);
});
afterEach(() => {
  try {
    fs.unlinkSync(db);
  } catch {
    // berkas sementara tidak wajib ada
  }
});

describe("saringCalon", () => {
  it("membersihkan penomoran dan tanda hubung yang ikut terbawa model", () => {
    expect(saringCalon(["- Veldan pakai Next.js", "2. Veldan suka jawaban singkat"], [])).toEqual([
      "Veldan pakai Next.js",
      "Veldan suka jawaban singkat",
    ]);
  });

  it("membuang yang sudah diingat, walau kalimatnya ditulis ulang", () => {
    // Model menulis ulang fakta yang sama dengan kata sambung berbeda tiap
    // dipanggil. Tanpa perbandingan yang dinormalkan, daftar ingatan akan
    // dipenuhi kembaran nyaris identik dalam hitungan hari.
    const ada = ["Veldan memakai Next.js dan node:sqlite"];
    expect(saringCalon(["Veldan memakai node:sqlite dan Next.js"], ada)).toEqual([]);
  });

  it("membuang kembaran di dalam satu usulan yang sama", () => {
    const hasil = saringCalon(["Veldan pakai Next.js", "Next.js dipakai Veldan"], []);
    expect(hasil).toHaveLength(1);
  });

  it("membuang butir yang kepanjangan, bukan memotongnya", () => {
    // Butir yang dipotong di tengah kalimat jadi fakta yang berubah artinya,
    // dan ia akan ikut di setiap jawaban selamanya.
    expect(saringCalon(["x".repeat(BATAS_SATU_BUTIR + 1)], [])).toEqual([]);
  });

  it("berhenti saat anggaran karakter habis", () => {
    // Seluruh isi ingatan ikut di SETIAP permintaan, jadi tiap karakternya
    // dibayar berkali-kali sehari.
    const ada = ["y".repeat(ANGGARAN_KARAKTER - 20)];
    expect(saringCalon(["z".repeat(100)], ada)).toEqual([]);
  });

  it("mengenali balasan TIDAK ADA sebagai bukan ingatan", () => {
    expect(saringCalon(["TIDAK ADA"], [])).toEqual([]);
    expect(saringCalon(["Tidak ada"], [])).toEqual([]);
  });

  it("membuang baris kosong tanpa menggagalkan sisanya", () => {
    expect(saringCalon(["", "  ", "Veldan tinggal di WIB"], [])).toEqual(["Veldan tinggal di WIB"]);
  });
});

describe("serupa", () => {
  it("mengabaikan urutan, tanda baca, dan kata sambung pendek", () => {
    expect(serupa("Veldan pakai Next.js", "next.js dipakai Veldan!")).toBe(true);
  });

  it("tidak menganggap fakta berbeda sebagai sama", () => {
    expect(serupa("Veldan pakai Next.js", "Veldan pakai Python")).toBe(false);
  });
});

describe("sisakanRuangOtomatis", () => {
  it("tidak membuang apa pun selama masih muat", () => {
    tambahIngatan("satu", db);
    expect(sisakanRuangOtomatis(3, db)).toBe(0);
    expect(daftarIngatan(db)).toHaveLength(1);
  });

  it("membuang ingatan OTOMATIS terlama untuk memberi ruang", () => {
    for (let i = 0; i < BATAS_JUMLAH_INGATAN; i++) tambahIngatan(`auto ${i}`, db, true);
    expect(sisakanRuangOtomatis(2, db)).toBe(2);

    const sisa = daftarIngatan(db).map((i) => i.isi);
    expect(sisa).toHaveLength(BATAS_JUMLAH_INGATAN - 2);
    // Yang terlama yang pergi, bukan yang terbaru.
    expect(sisa).not.toContain("auto 0");
    expect(sisa).toContain(`auto ${BATAS_JUMLAH_INGATAN - 1}`);
  });

  it("TIDAK PERNAH menyentuh ingatan yang ditulis tangan", () => {
    // Aturan yang menjaga seluruh keputusan ini tetap bisa dipertanggungjawabkan:
    // model boleh mengusulkan apa saja, tapi tidak boleh membuang tulisan
    // pemiliknya. Tanpa ini, kurasi otomatis perlahan menghapus hal-hal yang
    // sengaja diingat seseorang.
    for (let i = 0; i < BATAS_JUMLAH_INGATAN; i++) tambahIngatan(`tangan ${i}`, db, false);

    expect(sisakanRuangOtomatis(5, db)).toBe(0);
    expect(daftarIngatan(db)).toHaveLength(BATAS_JUMLAH_INGATAN);
  });

  it("hanya membuang sebanyak yang otomatis, sisanya dibiarkan", () => {
    tambahIngatan("tangan", db, false);
    for (let i = 0; i < BATAS_JUMLAH_INGATAN - 1; i++) tambahIngatan(`auto ${i}`, db, true);

    expect(sisakanRuangOtomatis(3, db)).toBe(3);
    expect(daftarIngatan(db).map((i) => i.isi)).toContain("tangan");
  });
});

describe("penanda otomatis", () => {
  it("membedakan yang ditulis tangan dari yang disimpulkan", () => {
    tambahIngatan("ditulis sendiri", db, false);
    tambahIngatan("disimpulkan", db, true);

    const semua = daftarIngatan(db);
    expect(semua.find((i) => i.isi === "ditulis sendiri")?.otomatis).toBe(false);
    expect(semua.find((i) => i.isi === "disimpulkan")?.otomatis).toBe(true);
  });

  it("bawaannya ditulis tangan, bukan otomatis", () => {
    // Kalau bawaannya otomatis, ingatan yang diketik sendiri akan ikut terbuang
    // oleh kurasi — kegagalan yang paling mahal di seluruh berkas ini.
    tambahIngatan("tanpa argumen", db);
    expect(daftarIngatan(db)[0].otomatis).toBe(false);
  });
});

describe("selang kurasi", () => {
  it("mengikuti Hermes: tiap 10", () => {
    expect(TIAP_PESAN).toBe(10);
  });
});
