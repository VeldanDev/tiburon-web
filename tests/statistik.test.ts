import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hitungStatistik, bandingkanBuku, HARI_PETA } from "@/lib/statistik";
import { RENTANG, rentangSah } from "@/lib/statistik-bentuk";
import { buatPercakapan, tambahPesan } from "@/lib/riwayat";
import fs from "node:fs";
import os from "node:os";
import { siapkanSkema } from "@/lib/skema";

let db: string;
let dir: string;
const HARI = 86_400_000;
// Siang hari, supaya penambahan/pengurangan jam untuk uji tidak menyeberang
// tengah malam dan mengubah tanggalnya.
const KINI = new Date("2026-09-04T12:00:00").getTime();

function isi(waktu: number[], teks = "halo dunia") {
  const d = new DatabaseSync(db);
  siapkanSkema(d);
  d.prepare("INSERT INTO percakapan (id,judul,dibuat,diperbarui) VALUES ('p','P',1,1)").run();
  const s = d.prepare("INSERT INTO pesan (percakapan_id,peran,isi,waktu) VALUES ('p','user',?,?)");
  for (const w of waktu) s.run(teks, w);
  d.close();
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tiburon-stat-"));
  db = path.join(dir, "riwayat.sqlite");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("hitungStatistik", () => {
  it("membalas nol yang jujur untuk basis data kosong", () => {
    const s = hitungStatistik(db, KINI);
    expect(s.pesan).toBe(0);
    expect(s.hariAktif).toBe(0);
    expect(s.jamPuncak).toBeNull();
    // Peta panas tetap punya bentuk penuh, supaya kisinya tidak berubah ukuran
    // begitu pesan pertama masuk.
    expect(s.harian).toHaveLength(HARI_PETA);
  });

  it("menghitung pesan, hari aktif, dan taksiran token", () => {
    isi([KINI, KINI - HARI, KINI - HARI]);
    const s = hitungStatistik(db, KINI);
    expect(s.pesan).toBe(3);
    expect(s.hariAktif).toBe(2);
    expect(s.token).toBeGreaterThan(0);
  });

  it("menghitung streak berturut-turut", () => {
    isi([KINI, KINI - HARI, KINI - 2 * HARI]);
    const s = hitungStatistik(db, KINI);
    expect(s.streakSaatIni).toBe(3);
    expect(s.streakTerpanjang).toBe(3);
  });

  // Memutus streak tepat tengah malam menghukum orang yang belum sempat
  // membuka aplikasi pagi itu, dan angka yang nol setiap pagi tidak mengukur
  // apa pun.
  it("streak masih hidup kalau terakhirnya KEMARIN", () => {
    isi([KINI - HARI, KINI - 2 * HARI]);
    expect(hitungStatistik(db, KINI).streakSaatIni).toBe(2);
  });

  it("streak putus kalau terakhirnya lebih dari kemarin", () => {
    isi([KINI - 5 * HARI, KINI - 6 * HARI]);
    const s = hitungStatistik(db, KINI);
    expect(s.streakSaatIni).toBe(0);
    expect(s.streakTerpanjang).toBe(2);
  });

  it("mengingat streak terpanjang walau yang sekarang lebih pendek", () => {
    isi([
      KINI, // hari ini
      KINI - 10 * HARI, KINI - 11 * HARI, KINI - 12 * HARI, KINI - 13 * HARI,
    ]);
    const s = hitungStatistik(db, KINI);
    expect(s.streakSaatIni).toBe(1);
    expect(s.streakTerpanjang).toBe(4);
  });

  it("menemukan jam puncak", () => {
    const jam = (h: number) => new Date(`2026-09-04T${String(h).padStart(2, "0")}:30:00`).getTime();
    isi([jam(9), jam(17), jam(17), jam(17)]);
    expect(hitungStatistik(db, KINI).jamPuncak).toBe(17);
  });

  // Peta panas harus memuat hari kosong juga: melewatinya akan memampatkan
  // kisi dan membuat jeda seminggu terlihat sama dengan jeda sehari.
  it("peta panas memuat hari kosong secara berurutan", () => {
    isi([KINI, KINI - 3 * HARI]);
    const h = hitungStatistik(db, KINI).harian;
    expect(h).toHaveLength(HARI_PETA);
    expect(h[h.length - 1].jumlah).toBe(1);
    expect(h[h.length - 2].jumlah).toBe(0);
    expect(h[h.length - 4].jumlah).toBe(1);
  });
});

describe("bandingkanBuku", () => {
  it("diam saja untuk angka yang belum berarti", () => {
    expect(bandingkanBuku(1000)).toBeNull();
  });

  // "3x Moby-Dick" lebih bermakna daripada "56x Laskar Pelangi".
  it("memilih buku TERBESAR yang masih terlampaui", () => {
    expect(bandingkanBuku(2_000_000)).toContain("Lord of the Rings");
    expect(bandingkanBuku(300_000)).toContain("Moby-Dick");
  });

  it("menyebut kelipatannya", () => {
    expect(bandingkanBuku(560_000)).toMatch(/2×|2,0×/);
  });
});

describe("rentang statistik", () => {
  it("menerima tiap rentang yang terdaftar", () => {
    for (const r of RENTANG) expect(rentangSah(r.hari)).toBe(r.hari);
    for (const r of RENTANG) expect(rentangSah(String(r.hari))).toBe(r.hari);
  });

  it("jatuh ke bawaan untuk nilai yang tidak dikenal", () => {
    // Rentang bebas dari URL berarti tiap nilai perlu dijaga dari negatif,
    // nol, dan sepuluh juta. Dipatok, jadi penjagaannya cuma satu baris.
    for (const buruk of [0, -5, 9999, 37, NaN, null, undefined, "banyak", {}]) {
      expect(rentangSah(buruk)).toBe(HARI_PETA);
    }
  });

  it("peta panas sepanjang rentang yang diminta, termasuk hari kosong", () => {
    // Melewati hari kosong akan memampatkan kisinya dan membuat jeda seminggu
    // terlihat sama dengan jeda sehari.
    const db = path.join(os.tmpdir(), `rentang-${Date.now()}-${Math.random()}.sqlite`);
    try {
      const id = buatPercakapan("Uji", db);
      tambahPesan(id, { role: "user", content: "x" }, db);

      for (const r of [7, 30, 365]) {
        const s = hitungStatistik(db, Date.now(), r);
        expect(s.hari).toBe(r);
        expect(s.harian).toHaveLength(r);
      }
    } finally {
      try {
        fs.unlinkSync(db);
      } catch {
        // berkas sementara tidak wajib ada
      }
    }
  });
});
