import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ambilPercakapan,
  batalkanGiliranTerakhir,
  buatPercakapan,
  daftarPercakapan,
  tambahPesan,
} from "@/lib/riwayat";

let db: string;
beforeEach(() => {
  db = path.join(os.tmpdir(), `undo-uji-${Date.now()}-${Math.random()}.sqlite`);
});
afterEach(() => {
  try {
    fs.unlinkSync(db);
  } catch {
    // berkas sementara tidak wajib ada
  }
});

function isi(id: string, ...pasangan: [string, string][]) {
  for (const [tanya, jawab] of pasangan) {
    tambahPesan(id, { role: "user", content: tanya }, db);
    tambahPesan(id, { role: "assistant", content: jawab }, db);
  }
}

describe("batalkanGiliranTerakhir", () => {
  it("membuang jawaban terakhir DAN pertanyaan yang memicunya", () => {
    const id = buatPercakapan("Uji", db);
    isi(id, ["satu", "jawab satu"], ["dua", "jawab dua"]);

    expect(batalkanGiliranTerakhir(id, db)).toEqual({ dibuang: 2 });
    expect(ambilPercakapan(id, db).map((p) => p.content)).toEqual(["satu", "jawab satu"]);
  });

  it("membuang pertanyaan sendirian kalau jawabannya belum ada", () => {
    // Keadaan setelah menekan Esc: yang tertinggal cuma pertanyaan tanpa
    // jawaban, dan undo harus bisa membersihkannya.
    const id = buatPercakapan("Uji", db);
    isi(id, ["satu", "jawab satu"]);
    tambahPesan(id, { role: "user", content: "dihentikan" }, db);

    expect(batalkanGiliranTerakhir(id, db)).toEqual({ dibuang: 1 });
    expect(ambilPercakapan(id, db).map((p) => p.content)).toEqual(["satu", "jawab satu"]);
  });

  it("bisa dipanggil berkali-kali sampai kosong", () => {
    const id = buatPercakapan("Uji", db);
    isi(id, ["satu", "a"], ["dua", "b"]);

    batalkanGiliranTerakhir(id, db);
    batalkanGiliranTerakhir(id, db);
    expect(ambilPercakapan(id, db)).toEqual([]);
  });

  it("percakapan kosong tidak melempar, cuma tidak membuang apa-apa", () => {
    const id = buatPercakapan("Uji", db);
    expect(batalkanGiliranTerakhir(id, db)).toEqual({ dibuang: 0 });
  });

  it("percakapan yang tidak ada tidak melempar", () => {
    expect(batalkanGiliranTerakhir("tidak-ada", db)).toEqual({ dibuang: 0 });
  });

  it("TIDAK menyentuh percakapan lain", () => {
    // Dua percakapan berisi teks yang sama persis; kalau penghapusannya tidak
    // disaring per percakapan, yang salah tidak akan terlihat dari isinya.
    const a = buatPercakapan("A", db);
    const b = buatPercakapan("B", db);
    isi(a, ["sama", "sama"]);
    isi(b, ["sama", "sama"]);

    batalkanGiliranTerakhir(a, db);
    expect(ambilPercakapan(a, db)).toHaveLength(0);
    expect(ambilPercakapan(b, db)).toHaveLength(2);
  });

  it("tidak memundurkan urutan sidebar", () => {
    // `diperbarui` artinya "kapan terakhir ada percakapan di sini", dan
    // membatalkan giliran tetap kejadian di sini. Memundurkannya akan
    // memindahkan percakapan ini ke bawah seolah ia tidak disentuh hari ini.
    const lama = buatPercakapan("Lama", db);
    isi(lama, ["x", "y"]);
    const baru = buatPercakapan("Baru", db);
    isi(baru, ["x", "y"]);

    batalkanGiliranTerakhir(baru, db);
    expect(daftarPercakapan(db)[0].judul).toBe("Baru");
  });
});
