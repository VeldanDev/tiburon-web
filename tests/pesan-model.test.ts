import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buatPercakapan, tambahPesan, ambilPercakapan } from "@/lib/riwayat";
import { siapkanSkema } from "@/lib/skema";
import { hitungStatistik } from "@/lib/statistik";

let db: string;
beforeEach(() => {
  db = path.join(os.tmpdir(), `model-uji-${Date.now()}-${Math.random()}.sqlite`);
});
afterEach(() => {
  try {
    fs.unlinkSync(db);
  } catch {
    // diabaikan
  }
});

function kolom(berkas: string, tabel: string): string[] {
  const d = new DatabaseSync(berkas, { readOnly: true });
  const k = d.prepare(`PRAGMA table_info(${tabel})`).all().map((r) => (r as { name: string }).name);
  d.close();
  return k;
}

describe("kolom model pada tabel pesan", () => {
  it("ada pada basis data baru", () => {
    buatPercakapan("Uji", db);
    expect(kolom(db, "pesan")).toContain("model");
  });

  it("ditambahkan ke basis data lama yang belum punya kolomnya", () => {
    // Bentuk tabel `pesan` PERSIS seperti sebelum kolom model ada. Ini penjaga
    // sesungguhnya: basis data Veldan sudah berisi percakapan sungguhan, dan
    // migrasi yang cuma jalan di basis data kosong tidak menolong siapa pun.
    const lama = new DatabaseSync(db);
    lama.exec(`
      CREATE TABLE pesan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        percakapan_id TEXT NOT NULL,
        peran TEXT NOT NULL,
        isi TEXT NOT NULL,
        waktu INTEGER NOT NULL
      );
    `);
    lama
      .prepare("INSERT INTO pesan (percakapan_id, peran, isi, waktu) VALUES (?,?,?,?)")
      .run("p1", "assistant", "jawaban lama", Date.now());
    lama.close();

    const baru = new DatabaseSync(db);
    siapkanSkema(baru);
    const baris = baru.prepare("SELECT isi, model FROM pesan").all() as {
      isi: string;
      model: string | null;
    }[];
    baru.close();

    expect(kolom(db, "pesan")).toContain("model");
    // Baris lama TETAP ADA dan modelnya null -- bukan dihapus, bukan ditebak.
    expect(baris).toEqual([{ isi: "jawaban lama", model: null }]);
  });
});

describe("tambahPesan", () => {
  it("menyimpan model jawaban dan mengembalikannya saat dibaca", () => {
    const id = buatPercakapan("Uji", db);
    tambahPesan(id, { role: "user", content: "tanya" }, db);
    tambahPesan(id, { role: "assistant", content: "jawab", model: "z-ai/glm-5.2:free" }, db);

    const pesan = ambilPercakapan(id, db);
    expect(pesan[1].model).toBe("z-ai/glm-5.2:free");
  });

  it("membuang model pada pesan pengguna", () => {
    // Pertanyaan tidak dijawab model mana pun. Kalau model yang sedang dipilih
    // ikut tersimpan di baris pengguna, statistik menghitung tiap giliran dua
    // kali -- sekali untuk pertanyaan, sekali untuk jawabannya.
    const id = buatPercakapan("Uji", db);
    tambahPesan(id, { role: "user", content: "tanya", model: "z-ai/glm-5.2:free" }, db);
    expect(ambilPercakapan(id, db)[0].model).toBeNull();
  });

  it("model kosong tersimpan sebagai null, bukan string kosong", () => {
    const id = buatPercakapan("Uji", db);
    tambahPesan(id, { role: "assistant", content: "jawab" }, db);
    expect(ambilPercakapan(id, db)[0].model).toBeNull();
  });
});

describe("statistik model", () => {
  it("mengurutkan model terbanyak dulu dan memisahkan yang tak tercatat", () => {
    const id = buatPercakapan("Uji", db);
    tambahPesan(id, { role: "user", content: "tanya" }, db);
    tambahPesan(id, { role: "assistant", content: "a", model: "alfa" }, db);
    tambahPesan(id, { role: "assistant", content: "b", model: "alfa" }, db);
    tambahPesan(id, { role: "assistant", content: "c", model: "beta" }, db);
    tambahPesan(id, { role: "assistant", content: "d" }, db);

    const s = hitungStatistik(db);
    expect(s.modelTeratas).toEqual([
      { nama: "alfa", jumlah: 2 },
      { nama: "beta", jumlah: 1 },
    ]);
    // Jawaban tanpa model dilaporkan, bukan dilenyapkan dari hitungan.
    expect(s.jawabanTanpaModel).toBe(1);
  });

  it("tidak menghitung pesan pengguna sebagai jawaban tanpa model", () => {
    const id = buatPercakapan("Uji", db);
    tambahPesan(id, { role: "user", content: "satu" }, db);
    tambahPesan(id, { role: "user", content: "dua" }, db);

    const s = hitungStatistik(db);
    expect(s.jawabanTanpaModel).toBe(0);
    expect(s.modelTeratas).toEqual([]);
  });

  it("membatasi daftarnya dan memutus seri dengan urutan nama", () => {
    const id = buatPercakapan("Uji", db);
    for (const m of ["delta", "alfa", "carlie", "beta"]) {
      tambahPesan(id, { role: "assistant", content: "x", model: m }, db);
    }
    // Semua seri di angka 1. Urutan harus tetap sama tiap pemuatan, kalau tidak
    // daftarnya bertukar tempat sendiri dan terbaca seperti angkanya berubah.
    const s = hitungStatistik(db);
    expect(s.modelTeratas.map((m) => m.nama)).toEqual(["alfa", "beta", "carlie"]);
  });
});
