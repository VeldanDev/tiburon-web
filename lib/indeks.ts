/**
 * Membangun indeks korpus dari sebuah FOLDER berkas.
 *
 * KENAPA INI ADA. Sampai sekarang korpus Tiburon selalu berupa basis data
 * milik OpenClaw — hasil kerja agen lain, yang kebetulan ada di mesin Veldan.
 * Itu cukup selama Tiburon hanya dipakai Veldan. Tapi kantor mana pun yang
 * memasangnya tidak punya OpenClaw; yang mereka punya cuma folder berisi
 * dokumen. Tanpa berkas ini, Tiburon terpasang di kantor orang adalah
 * cangkang kosong yang tidak bisa menjawab apa pun.
 *
 * Skemanya SENGAJA sama persis dengan skema OpenClaw — tiga tabel, nama kolom
 * yang sama, tabel FTS5 yang sama. Bukan karena skema itu istimewa, tapi
 * karena `lib/korpus.ts` sudah membacanya, sudah diuji, dan sudah menangani
 * kasus-kasus sulitnya (galat sintaks FTS5, tabel hilang, berkas korup).
 * Membuat skema kedua berarti dua jalur baca yang perlahan berbeda — pola
 * yang hari ini saja sudah empat kali menggigit proyek ini.
 *
 * YANG TIDAK ADA DI SINI, DAN ALASANNYA:
 *
 *   embedding    Kolomnya diisi string kosong. Pencarian Tiburon memakai BM25
 *                lewat FTS5, bukan kemiripan vektor — mengisi kolom itu berarti
 *                memanggil model embedding untuk tiap potongan, yang lambat,
 *                butuh jaringan, dan tidak dipakai satu baris kode pun.
 *                Diisi saat ada yang benar-benar membacanya.
 *
 *   OCR          PDF hasil PINDAI tidak dibaca. Teksnya memang tidak ada di
 *                dalam berkasnya, jadi yang dibutuhkan bukan pengurai lain
 *                melainkan OCR — kemampuan berbeda dengan biayanya sendiri.
 *                Kasus itu DILAPORKAN dengan sebabnya, bukan dilewati diam-
 *                diam, supaya yang memasang tahu berkas mana yang perlu
 *                dipindai ulang.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { EKSTENSI_KANTOR, ekstrak } from "@/lib/ekstrak";

/**
 * Panjang satu potongan, dalam karakter.
 *
 * Potongan yang terlalu besar mengirim halaman-halaman teks tak relevan ke
 * jendela model; yang terlalu kecil memotong kalimat di tengah dan membuat
 * jawabannya kehilangan konteks. 1.200 kira-kira satu-dua paragraf panjang.
 */
export const PANJANG_POTONGAN = 1_200;

/**
 * Tumpang tindih antar potongan.
 *
 * Kalimat yang jatuh persis di batas potongan akan hilang dari keduanya kalau
 * tidak ada tumpang tindih — dan itu justru kalimat yang paling sering dicari,
 * karena batasnya jatuh di tengah pembahasan, bukan di antara topik.
 */
export const TUMPANG = 150;

/** Berkas lebih besar dari ini dilewati, dan disebut. */
export const BATAS_BERKAS = 5 * 1024 * 1024;

/** Format yang bisa dibaca hari ini. */
export const EKSTENSI = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "yaml", "yml", "html", "xml",
  "log", "ini", "conf", "cfg", "sql", "rtf",
]);

/** Folder yang tidak pernah masuk indeks. */
const LEWATI = new Set([
  "node_modules", ".git", ".next", "dist", "build", "__pycache__",
  ".venv", "venv", ".cache", "AppData",
]);

export type Ringkasan = {
  berkas: number;
  potongan: number;
  dilewati: { jalur: string; sebab: string }[];
};

/**
 * Semua berkas di bawah satu folder, rekursif.
 *
 * Melempar hanya kalau folder AKARNYA tidak bisa dibaca. Folder anak yang
 * ditolak sistem (izin, tautan rusak) dilewati dengan dicatat: satu subfolder
 * yang tidak terbaca tidak boleh membatalkan pengindeksan seluruh arsip.
 */
function telusuri(akar: string, catat: (jalur: string, sebab: string) => void): string[] {
  const hasil: string[] = [];
  const antrean = [akar];

  while (antrean.length) {
    const kini = antrean.pop()!;
    let isi: fs.Dirent[];
    try {
      isi = fs.readdirSync(kini, { withFileTypes: true });
    } catch (e) {
      catat(kini, `folder tidak terbaca: ${(e as Error).message}`);
      continue;
    }
    for (const d of isi) {
      if (d.name.startsWith(".") && d.name !== ".") continue;
      const penuh = path.join(kini, d.name);
      if (d.isDirectory()) {
        if (!LEWATI.has(d.name)) antrean.push(penuh);
      } else if (d.isFile()) {
        hasil.push(penuh);
      }
    }
  }
  return hasil.sort();
}

/**
 * Pecah teks jadi potongan, dengan nomor baris awal dan akhir tiap potongan.
 *
 * Nomor barisnya ikut karena kartu sumber menampilkannya, dan "ada di berkas
 * X" jauh kurang berguna daripada "ada di berkas X sekitar baris 120" pada
 * dokumen sepanjang ratusan halaman.
 */
export function potong(teks: string): { teks: string; awal: number; akhir: number }[] {
  const hasil: { teks: string; awal: number; akhir: number }[] = [];
  if (!teks.trim()) return hasil;

  // Baris dihitung dari jumlah pergantian baris sebelum posisi itu — sekali
  // jalan, bukan dengan memotong ulang teksnya tiap potongan.
  const barisSampai = (pos: number) => {
    let n = 1;
    for (let i = 0; i < pos && i < teks.length; i++) if (teks[i] === "\n") n++;
    return n;
  };

  let mulai = 0;
  while (mulai < teks.length) {
    const akhir = Math.min(teks.length, mulai + PANJANG_POTONGAN);
    const bagian = teks.slice(mulai, akhir);
    if (bagian.trim()) {
      hasil.push({ teks: bagian, awal: barisSampai(mulai), akhir: barisSampai(akhir) });
    }
    if (akhir >= teks.length) break;
    // Maju sebesar potongan dikurangi tumpang tindihnya. Dijaga selalu maju:
    // tumpang tindih yang lebih besar dari potongannya akan menggelung
    // selamanya dan mengisi disk sampai penuh.
    mulai += Math.max(1, PANJANG_POTONGAN - TUMPANG);
  }
  return hasil;
}

function skema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_index_chunks (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'memory',
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      hash TEXT NOT NULL,
      model TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;

    CREATE VIRTUAL TABLE IF NOT EXISTS memory_index_chunks_fts USING fts5(
      text,
      id UNINDEXED,
      path UNINDEXED,
      source UNINDEXED,
      model UNINDEXED,
      start_line UNINDEXED,
      end_line UNINDEXED
    );

    CREATE TABLE IF NOT EXISTS memory_index_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;
  `);
}

/**
 * Bangun ulang indeks dari satu folder.
 *
 * Ditulis ke berkas SEMENTARA lalu dipindahkan menimpa yang lama. Menulis
 * langsung ke berkas yang sedang dipakai berarti setiap pengindeksan ulang
 * punya jendela beberapa detik saat pencarian menemukan indeks setengah jadi —
 * dan pengindeksan yang gagal di tengah meninggalkan arsip yang rusak,
 * bukan arsip lama yang masih utuh.
 */
export async function bangunIndeks(
  folder: string,
  tujuan: string,
  lapor?: (pesan: string) => void,
): Promise<Ringkasan> {
  const akar = path.resolve(folder);
  if (!fs.existsSync(akar) || !fs.statSync(akar).isDirectory()) {
    throw new Error(`Folder tidak ada: ${akar}`);
  }

  const dilewati: { jalur: string; sebab: string }[] = [];
  const catat = (jalur: string, sebab: string) => dilewati.push({ jalur, sebab });

  const sementara = `${tujuan}.sedang-dibangun`;
  fs.mkdirSync(path.dirname(tujuan), { recursive: true });
  fs.rmSync(sementara, { force: true });

  const db = new DatabaseSync(sementara);
  let berkasMasuk = 0;
  let potonganMasuk = 0;

  try {
    skema(db);
    db.exec("BEGIN");

    const simpan = db.prepare(
      `INSERT INTO memory_index_chunks
         (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
       VALUES (?, ?, 'berkas', ?, ?, ?, 'fts', ?, '', ?)`,
    );
    const simpanFts = db.prepare(
      `INSERT INTO memory_index_chunks_fts
         (text, id, path, source, model, start_line, end_line)
       VALUES (?, ?, ?, 'berkas', 'fts', ?, ?)`,
    );

    for (const berkas of telusuri(akar, catat)) {
      const ext = path.extname(berkas).slice(1).toLowerCase();
      const kantor = EKSTENSI_KANTOR.has(ext);
      if (!kantor && !EKSTENSI.has(ext)) {
        catat(berkas, ext ? `format .${ext} belum didukung` : "tanpa ekstensi");
        continue;
      }
      let stat: fs.Stats;
      try {
        stat = fs.statSync(berkas);
      } catch (e) {
        catat(berkas, (e as Error).message);
        continue;
      }
      if (stat.size > BATAS_BERKAS) {
        catat(berkas, `terlalu besar (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
        continue;
      }

      let isi: string;
      if (kantor) {
        // PDF dan Word lewat pengurai sendiri. Kegagalannya dicatat dengan
        // sebabnya — "PDF ini hasil pindai, butuh OCR" jauh lebih menolong
        // daripada berkas yang hilang tanpa penjelasan.
        const hasil = await ekstrak(berkas);
        if (!hasil.ok) {
          catat(berkas, hasil.sebab);
          continue;
        }
        isi = hasil.teks;
      } else {
        try {
          const mentah = fs.readFileSync(berkas);
          if (mentah.subarray(0, 8000).includes(0)) {
            catat(berkas, "isinya biner, bukan teks");
            continue;
          }
          isi = mentah.toString("utf8");
        } catch (e) {
          catat(berkas, (e as Error).message);
          continue;
        }
      }

      const bagian = potong(isi);
      if (!bagian.length) {
        catat(berkas, "kosong");
        continue;
      }

      const sekarang = Date.now();
      for (let i = 0; i < bagian.length; i++) {
        const b = bagian[i];
        const hash = createHash("sha256").update(b.teks).digest("hex").slice(0, 32);
        const id = `${hash}-${i}`;
        simpan.run(id, berkas, b.awal, b.akhir, hash, b.teks, sekarang);
        simpanFts.run(b.teks, id, berkas, b.awal, b.akhir);
      }
      berkasMasuk++;
      potonganMasuk += bagian.length;
      lapor?.(`${berkas} — ${bagian.length} potongan`);
    }

    db.prepare("INSERT OR REPLACE INTO memory_index_meta (key, value) VALUES (?, ?)").run(
      "sumber",
      akar,
    );
    db.prepare("INSERT OR REPLACE INTO memory_index_meta (key, value) VALUES (?, ?)").run(
      "dibangun",
      String(Date.now()),
    );
    db.exec("COMMIT");
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Rollback yang gagal tidak boleh menutupi galat aslinya.
    }
    db.close();
    fs.rmSync(sementara, { force: true });
    throw e;
  }

  db.close();
  // Pemindahan terakhir: sampai baris ini, indeks lama masih utuh dan masih
  // dipakai. Kegagalan di mana pun sebelum ini tidak merusak apa pun.
  fs.rmSync(tujuan, { force: true });
  fs.renameSync(sementara, tujuan);

  return { berkas: berkasMasuk, potongan: potonganMasuk, dilewati };
}
