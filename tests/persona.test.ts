import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BATAS_JIWA,
  BATAS_JUMLAH_PERSONA,
  ambilPersona,
  buatPersona,
  daftarPersona,
  hapusPersona,
  personaPercakapan,
  setPersonaPercakapan,
  ubahPersona,
} from "@/lib/persona";
import { buatPercakapan, tambahPesan, ambilPercakapan } from "@/lib/riwayat";
import { susunPrompt } from "@/lib/penyedia";

let db: string;
beforeEach(() => {
  db = path.join(os.tmpdir(), `persona-uji-${Date.now()}-${Math.random()}.sqlite`);
});
afterEach(() => {
  try {
    fs.unlinkSync(db);
  } catch {
    // berkas sementara tidak wajib ada
  }
});

describe("persona", () => {
  it("menyimpan jiwa dan rantai modelnya sendiri", () => {
    const p = buatPersona("Orpheus", "Kamu perencana yang berpikir lama.", ["a/model", "b/model"], db);
    const kembali = ambilPersona(p.id, db);
    expect(kembali?.nama).toBe("Orpheus");
    expect(kembali?.jiwa).toContain("perencana");
    expect(kembali?.rantai).toEqual(["a/model", "b/model"]);
  });

  it("rantai kosong berarti ikut rantai bawaan, bukan rantai kosong", () => {
    const p = buatPersona("Polos", "jiwa", [], db);
    expect(ambilPersona(p.id, db)?.rantai).toEqual([]);
  });

  it("menolak nama kosong", () => {
    expect(() => buatPersona("   ", "jiwa", [], db)).toThrow(/nama/i);
  });

  it("menolak jiwa yang melewati batas, bukan memotongnya diam-diam", () => {
    // Memotong diam-diam menghasilkan persona yang berbeda dari yang ditulis
    // pemiliknya, dan ia tidak akan pernah tahu bagian mana yang hilang.
    expect(() => buatPersona("Panjang", "x".repeat(BATAS_JIWA + 1), [], db)).toThrow(/karakter/i);
  });

  it("menolak saat penuh, tidak membuang yang terlama", () => {
    for (let i = 0; i < BATAS_JUMLAH_PERSONA; i++) buatPersona(`p${i}`, "j", [], db);
    expect(() => buatPersona("lebih", "j", [], db)).toThrow(/hapus/i);
    // Yang pertama masih ada: tidak ada yang diusir diam-diam.
    expect(daftarPersona(db)).toHaveLength(BATAS_JUMLAH_PERSONA);
    expect(daftarPersona(db)[0].nama).toBe("p0");
  });
});

describe("ubahPersona", () => {
  it("medan yang tidak dikirim dibiarkan apa adanya", () => {
    // Menyimpan undefined akan mengosongkan jiwa sebuah persona hanya karena
    // penyuntingnya cuma mengganti namanya.
    const p = buatPersona("Lama", "jiwa asli", ["m/1"], db);
    ubahPersona(p.id, { nama: "Baru" }, db);

    const kembali = ambilPersona(p.id, db);
    expect(kembali?.nama).toBe("Baru");
    expect(kembali?.jiwa).toBe("jiwa asli");
    expect(kembali?.rantai).toEqual(["m/1"]);
  });

  it("mengembalikan false untuk persona yang tidak ada", () => {
    expect(ubahPersona("tidak-ada", { nama: "x" }, db)).toBe(false);
  });
});

describe("persona pada percakapan", () => {
  it("dibaca dari percakapannya, bukan dikirim klien", () => {
    const p = buatPersona("Orpheus", "Kamu perencana.", [], db);
    const c = buatPercakapan("Uji", db);
    setPersonaPercakapan(c, p.id, db);

    expect(personaPercakapan(c, db)?.nama).toBe("Orpheus");
  });

  it("percakapan tanpa persona mengembalikan null, bukan melempar", () => {
    const c = buatPercakapan("Uji", db);
    expect(personaPercakapan(c, db)).toBeNull();
    expect(personaPercakapan(null, db)).toBeNull();
    expect(personaPercakapan("tidak-ada", db)).toBeNull();
  });

  it("menghapus persona MELEPASKAN percakapannya, tidak menghapusnya", () => {
    // Persona adalah cara menjawab, bukan pemilik percakapannya. Membuang
    // riwayat sungguhan karena sebuah pengaturan dihapus tidak sepadan dengan
    // kerapian apa pun.
    const p = buatPersona("Sementara", "j", [], db);
    const c = buatPercakapan("Penting", db);
    setPersonaPercakapan(c, p.id, db);
    tambahPesan(c, { role: "user", content: "isi yang tidak boleh hilang" }, db);

    expect(hapusPersona(p.id, db)).toBe(true);

    expect(ambilPercakapan(c, db)).toHaveLength(1);
    expect(personaPercakapan(c, db)).toBeNull();
  });
});

describe("jiwa di prompt sistem", () => {
  it("MENGGANTIKAN persona bawaan, bukan ditumpuk di atasnya", () => {
    // Kalau ditumpuk, kedua definisi berlaku sekaligus dan model harus menebak
    // mana yang menang — persona yang dibuat justru untuk mengganti sifat
    // bawaannya jadi tidak pernah benar-benar berlaku.
    const sistem = susunPrompt([], [], { jiwa: "Kamu Orpheus, perencana." })[0].content;
    expect(sistem).toContain("Orpheus");
    expect(sistem).not.toContain("hiu pembelajar milik Veldan");
  });

  it("jiwa kosong tetap memakai persona bawaan", () => {
    for (const jiwa of ["", "   ", undefined]) {
      const sistem = susunPrompt([], [], { jiwa })[0].content;
      expect(sistem).toContain("Tiburon");
    }
  });

  it("instruksi dan ingatan tetap ikut walau jiwanya diganti", () => {
    // Keduanya tentang PENGGUNA, bukan tentang siapa yang menjawab — jadi
    // keduanya berlaku di persona mana pun.
    const sistem = susunPrompt([], [], {
      jiwa: "Kamu Orpheus.",
      instruksi: "Jangan basa-basi",
      ingatan: ["Veldan memakai Next.js"],
    })[0].content;
    expect(sistem).toContain("Jangan basa-basi");
    expect(sistem).toContain("Next.js");
  });
});

describe("skema persona", () => {
  it("kolom persona_id ditambahkan ke basis data lama", () => {
    // Basis data Veldan sudah berisi percakapan sungguhan; migrasi yang cuma
    // jalan di basis data kosong tidak menolong siapa pun.
    const lama = new DatabaseSync(db);
    lama.exec(`
      CREATE TABLE percakapan (
        id TEXT PRIMARY KEY,
        judul TEXT NOT NULL,
        dibuat INTEGER NOT NULL,
        diperbarui INTEGER NOT NULL
      );
    `);
    lama.prepare("INSERT INTO percakapan (id, judul, dibuat, diperbarui) VALUES (?,?,?,?)")
      .run("c1", "Lama", 1, 1);
    lama.close();

    // Membuka lewat modul persona menjalankan migrasinya.
    expect(daftarPersona(db)).toEqual([]);

    const d = new DatabaseSync(db, { readOnly: true });
    const kolom = d.prepare("PRAGMA table_info(percakapan)").all().map((k) => (k as { name: string }).name);
    const baris = d.prepare("SELECT judul FROM percakapan").all();
    d.close();

    expect(kolom).toContain("persona_id");
    expect(baris).toEqual([{ judul: "Lama" }]);
  });
});
