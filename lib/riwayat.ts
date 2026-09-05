/**
 * Riwayat percakapan, SQLite lokal.
 *
 * Gateway OpenClaw TIDAK menyimpan riwayat — diuji 2026-09-03: pesan kedua
 * tidak mengingat pesan pertama. Jadi aplikasi yang menyimpannya.
 *
 * Kolom `pemilik` sengaja ada sejak awal walau selalu kosong sekarang.
 * Menambah kolom pada tabel yang sudah berisi data jauh lebih mahal daripada
 * menyiapkannya di awal.
 */
import { konfigurasi } from "@/lib/konfigurasi";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { siapkanSkema } from "@/lib/skema";
import { randomUUID } from "node:crypto";
import type { Pesan } from "@/lib/penyedia";

export type RingkasanPercakapan = {
  id: string;
  judul: string;
  diperbarui: number;
  disemat: boolean;
};

export type HasilCari = {
  id: string;
  judul: string;
  diperbarui: number;
  /** Potongan pesan tempat kata kuncinya ditemukan, untuk ditampilkan. */
  cuplikan: string;
};

export function dbRiwayat(): string {
  return konfigurasi().riwayatDb;
}

function buka(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  try {
    siapkanSkema(db);
  } catch (e) {
    // Handle sudah terbuka (new DatabaseSync berhasil) sebelum exec gagal.
    // Tanpa menutupnya di sini, handle itu bocor ke pemanggil dan tidak
    // pernah bisa ditutup siapa pun — lihat uji "tidak membocorkan koneksi
    // ketika pembuatan tabel gagal". Galatnya tetap naik: ini memperbaiki
    // kebocorannya, bukan menyembunyikan kegagalannya.
    db.close();
    throw e;
  }
  return db;
}

export function buatPercakapan(judul: string, dbPath = dbRiwayat()): string {
  const db = buka(dbPath);
  try {
    const id = randomUUID();
    const now = Date.now();
    db.prepare("INSERT INTO percakapan (id, judul, dibuat, diperbarui) VALUES (?,?,?,?)")
      .run(id, judul, now, now);
    return id;
  } finally {
    db.close();
  }
}

/**
 * Pesan sebagaimana DISIMPAN — `Pesan` ditambah model yang menjawabnya.
 *
 * Sengaja tipe tersendiri, bukan kolom baru di `Pesan`. `Pesan` dikirim apa
 * adanya ke penyedia (`messages: pesan` di lib/penyedia.ts), jadi menambahkan
 * kolom di sana berarti mengirimkan medan tak dikenal ke API model di setiap
 * permintaan. Yang perlu tahu soal model hanyalah lapisan basis data.
 */
export type PesanTersimpan = Pesan & { model?: string | null };

export function tambahPesan(id: string, pesan: PesanTersimpan, dbPath = dbRiwayat()): void {
  const db = buka(dbPath);
  try {
    const now = Date.now();
    db.prepare("INSERT INTO pesan (percakapan_id, peran, isi, waktu, model) VALUES (?,?,?,?,?)")
      // Pesan pengguna tidak pernah punya model. Menyimpan model yang sedang
      // dipilih di sana akan membuat statistik menghitung tiap pertanyaan
      // sebagai satu jawaban dari model itu -- dua kali lipat, dan salah.
      .run(id, pesan.role, pesan.content, now, pesan.role === "assistant" ? (pesan.model ?? null) : null);
    db.prepare("UPDATE percakapan SET diperbarui = ? WHERE id = ?").run(now, id);
  } finally {
    db.close();
  }
}

/**
 * Isi satu percakapan, untuk DITAMPILKAN.
 *
 * Model ikut terbawa supaya lencana "dijawab oleh" bertahan setelah halaman
 * dimuat ulang; sebelumnya nilai itu cuma hidup di memori klien dan hilang
 * begitu tabnya disegarkan. Aman karena hasil fungsi ini hanya pernah pergi ke
 * browser — saat mengirim giliran berikutnya, klien menyusun ulang
 * {role, content} sendiri, jadi `model` tidak pernah ikut ke API model.
 */
export function ambilPercakapan(id: string, dbPath = dbRiwayat()): PesanTersimpan[] {
  const db = buka(dbPath);
  try {
    return db.prepare("SELECT peran, isi, model FROM pesan WHERE percakapan_id = ? ORDER BY id")
      .all(id)
      .map((r) => {
        const row = r as { peran: string; isi: string; model: string | null };
        return { role: row.peran as Pesan["role"], content: row.isi, model: row.model };
      });
  } finally {
    db.close();
  }
}

/**
 * Ganti judul percakapan.
 *
 * `diperbarui` SENGAJA tidak disentuh. Kolom itu artinya "kapan terakhir ada
 * percakapan di sini", dan itulah yang mengurutkan sidebar. Kalau mengganti
 * nama ikut memperbaruinya, merapikan judul obrolan lama akan melemparnya ke
 * puncak daftar seolah baru saja dipakai.
 */
export function gantiJudul(id: string, judul: string, dbPath = dbRiwayat()): boolean {
  const db = buka(dbPath);
  try {
    const hasil = db.prepare("UPDATE percakapan SET judul = ? WHERE id = ?").run(judul, id);
    return hasil.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * Hapus percakapan beserta seluruh pesannya.
 *
 * Pesan dihapus lebih dulu, dalam satu transaksi. Tanpa transaksi, gagal di
 * tengah jalan meninggalkan pesan yatim yang tidak dimiliki percakapan mana
 * pun — tak terlihat di antarmuka, tapi terus menumpuk di basis data.
 *
 * Tidak ada FOREIGN KEY di skema ini, jadi SQLite tidak akan merapikannya
 * sendiri; harus dilakukan di sini.
 */
export function hapusPercakapan(id: string, dbPath = dbRiwayat()): boolean {
  const db = buka(dbPath);
  try {
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM pesan WHERE percakapan_id = ?").run(id);
      const hasil = db.prepare("DELETE FROM percakapan WHERE id = ?").run(id);
      db.exec("COMMIT");
      return hasil.changes > 0;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  } finally {
    db.close();
  }
}

export function daftarPercakapan(dbPath = dbRiwayat()): RingkasanPercakapan[] {
  const db = buka(dbPath);
  try {
    // Tie-breaker `rowid DESC`: `diperbarui` berasal dari Date.now(), yang
    // beresolusi milidetik — dua percakapan bisa punya nilai yang identik.
    // Tabel `percakapan` bukan WITHOUT ROWID (PK-nya TEXT, bukan INTEGER),
    // jadi kolom rowid bawaan tetap ada dan naik sesuai urutan penyisipan.
    // Tanpa ini, urutan SQLite untuk nilai `diperbarui` yang seri tidak
    // dijamin — lihat uji "terbaru di atas walau diperbarui sama persis".
    // Yang disemat selalu di atas, lalu urutan waktu seperti biasa.
    return db
      .prepare(
        `SELECT id, judul, diperbarui, disemat FROM percakapan
         ORDER BY disemat DESC, diperbarui DESC, rowid DESC`,
      )
      .all()
      .map((r) => {
        const row = r as { id: string; judul: string; diperbarui: number; disemat: number };
        // SQLite tidak punya boolean; tanpa konversi ini klien menerima 0/1
        // dan `disemat ? ... : ...` di React akan salah untuk nilai 0 yang
        // sebenarnya sudah benar — tapi menyamakan bentuknya di batas ini
        // mencegah 0/1 bocor ke seluruh antarmuka.
        return { ...row, disemat: row.disemat === 1 };
      });
  } finally {
    db.close();
  }
}

/**
 * Sematkan atau lepas sematan.
 *
 * Seperti gantiJudul, `diperbarui` TIDAK disentuh: menyematkan adalah
 * penilaian tentang pentingnya sesuatu, bukan tanda bahwa ia baru dipakai.
 */
export function setSemat(id: string, disemat: boolean, dbPath = dbRiwayat()): boolean {
  const db = buka(dbPath);
  try {
    const hasil = db
      .prepare("UPDATE percakapan SET disemat = ? WHERE id = ?")
      .run(disemat ? 1 : 0, id);
    return hasil.changes > 0;
  } finally {
    db.close();
  }
}

/**
 * Cari di judul DAN isi pesan.
 *
 * Memakai LIKE, bukan FTS5. Alasannya bukan kemalasan: tabel riwayat ini
 * berisi puluhan sampai ratusan percakapan milik satu orang, dan pemindaian
 * penuh atas data sekecil itu selesai dalam hitungan milidetik. Membangun
 * indeks FTS berarti menambah tabel bayangan yang harus dijaga tetap seiring
 * di setiap penyisipan dan penghapusan — biaya perawatan yang nyata untuk
 * keuntungan yang tidak akan pernah terasa pada ukuran ini.
 *
 * (Korpus itu cerita lain: 1.836 potongan dan memang memakai FTS5.)
 */
export function cariPercakapan(kueri: string, dbPath = dbRiwayat()): HasilCari[] {
  const bersih = kueri.trim();
  if (bersih.length < 2) return [];

  const db = buka(dbPath);
  try {
    // Karakter wildcard LIKE di-escape supaya "100%" dicari sebagai teks
    // "100%", bukan sebagai pola "100 diikuti apa saja".
    const pola = `%${bersih.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    return db
      .prepare(
        `SELECT p.id, p.judul, p.diperbarui,
                (SELECT m.isi FROM pesan m
                  WHERE m.percakapan_id = p.id AND m.isi LIKE ? ESCAPE '\\'
                  ORDER BY m.id LIMIT 1) AS cocok
         FROM percakapan p
         WHERE p.judul LIKE ? ESCAPE '\\'
            OR EXISTS (SELECT 1 FROM pesan m2
                        WHERE m2.percakapan_id = p.id AND m2.isi LIKE ? ESCAPE '\\')
         ORDER BY p.disemat DESC, p.diperbarui DESC
         LIMIT 50`,
      )
      .all(pola, pola, pola)
      .map((r) => {
        const row = r as { id: string; judul: string; diperbarui: number; cocok: string | null };
        return {
          id: row.id,
          judul: row.judul,
          diperbarui: row.diperbarui,
          cuplikan: cuplik(row.cocok ?? "", bersih),
        };
      });
  } finally {
    db.close();
  }
}

/**
 * Ambil potongan teks di sekitar kata yang cocok.
 *
 * Menampilkan 120 karakter pertama pesan tidak berguna kalau kata yang dicari
 * ada di karakter ke-3000 — pengguna melihat cuplikan yang tidak memuat apa
 * pun yang ia cari, dan hasilnya tampak salah.
 */
function cuplik(teks: string, kueri: string, lebar = 90): string {
  if (!teks) return "";
  const posisi = teks.toLowerCase().indexOf(kueri.toLowerCase());
  if (posisi === -1) return teks.slice(0, lebar * 2).replace(/\s+/g, " ").trim();

  const mulai = Math.max(0, posisi - lebar / 2);
  const akhir = Math.min(teks.length, posisi + kueri.length + lebar);
  const potong = teks.slice(mulai, akhir).replace(/\s+/g, " ").trim();
  return `${mulai > 0 ? "…" : ""}${potong}${akhir < teks.length ? "…" : ""}`;
}
