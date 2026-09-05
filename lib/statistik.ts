/**
 * Statistik pemakaian, dihitung dari riwayat yang sudah ada.
 *
 * Tidak ada tabel baru dan tidak ada pencatatan tambahan: semuanya diturunkan
 * dari tabel `pesan` yang memang sudah menyimpan waktu tiap giliran. Menambah
 * tabel penghitung berarti dua sumber kebenaran yang bisa berbeda — dan yang
 * palsu selalu yang ditampilkan.
 *
 * Angka token adalah TAKSIRAN, dengan rasio yang sama seperti meter konteks
 * (~3,6 karakter per token). Disebut begitu di antarmukanya, bukan disamarkan
 * jadi angka pasti.
 */
import { konfigurasi } from "@/lib/konfigurasi";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { siapkanSkema } from "@/lib/skema";
import { HARI_PETA, type Statistik } from "@/lib/statistik-bentuk";

export { HARI_PETA, type Statistik };

/*
 * Model yang menjawab dihitung dari kolom `pesan.model`, yang ditambahkan
 * setelah tabelnya dipakai berbulan-bulan. Semua baris yang lebih tua dari
 * kolom itu bernilai NULL, dan itu TIDAK dianggap nol — jumlahnya dibawa
 * keluar sebagai `jawabanTanpaModel` supaya daftarnya tidak diam-diam
 * mengaku menghitung seluruh riwayat.
 *
 * Hanya baris `assistant` yang dihitung. Pertanyaan pengguna tidak dijawab
 * model mana pun, dan menghitungnya akan melipatduakan tiap angka.
 */
const MODEL_DITAMPILKAN = 3;

function dbStat(): string {
  return konfigurasi().riwayatDb;
}

function buka(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  try {
    siapkanSkema(db);
  } catch (e) {
    db.close();
    throw e;
  }
  return db;
}

/** Tanggal lokal YYYY-MM-DD dari milidetik. */
function hari(ms: number): string {
  const d = new Date(ms);
  // Dibangun dari bagian LOKAL, bukan toISOString: toISOString memakai UTC,
  // dan di WIB (UTC+7) pesan jam 1 pagi akan tercatat sebagai hari sebelumnya.
  // Streak jadi putus di tempat yang tidak masuk akal bagi pemiliknya.
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Selisih hari antara dua tanggal YYYY-MM-DD. */
function jarakHari(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)) / 86_400_000);
}

/**
 * Streak terpanjang dan streak yang sedang berjalan.
 *
 * Streak "saat ini" masih hidup kalau hari terakhirnya adalah HARI INI atau
 * KEMARIN. Memutusnya tepat tengah malam menghukum orang yang belum sempat
 * membuka aplikasi pagi itu — dan angka yang turun jadi nol setiap pagi tidak
 * mengukur apa pun.
 */
function hitungStreak(tanggal: string[], hariIni: string): { kini: number; panjang: number } {
  if (tanggal.length === 0) return { kini: 0, panjang: 0 };

  let panjang = 1;
  let berjalan = 1;
  for (let i = 1; i < tanggal.length; i++) {
    berjalan = jarakHari(tanggal[i - 1], tanggal[i]) === 1 ? berjalan + 1 : 1;
    if (berjalan > panjang) panjang = berjalan;
  }

  const terakhir = tanggal[tanggal.length - 1];
  const selisih = jarakHari(terakhir, hariIni);
  if (selisih > 1) return { kini: 0, panjang };

  let kini = 1;
  for (let i = tanggal.length - 1; i > 0; i--) {
    if (jarakHari(tanggal[i - 1], tanggal[i]) !== 1) break;
    kini++;
  }
  return { kini, panjang };
}

export function hitungStatistik(dbPath = dbStat(), sekarang = Date.now()): Statistik {
  const db = buka(dbPath);
  try {
    const { np } = db.prepare("SELECT COUNT(*) AS np FROM percakapan").get() as { np: number };

    const baris = db
      .prepare("SELECT isi, waktu, peran, model FROM pesan ORDER BY waktu")
      .all() as { isi: string; waktu: number; peran: string; model: string | null }[];

    const perHari = new Map<string, number>();
    const perJam = new Array(24).fill(0) as number[];
    const perModel = new Map<string, number>();
    let token = 0;
    let tanpaModel = 0;

    for (const b of baris) {
      token += Math.ceil(b.isi.length / 3.6);
      const h = hari(b.waktu);
      perHari.set(h, (perHari.get(h) ?? 0) + 1);
      perJam[new Date(b.waktu).getHours()]++;

      if (b.peran !== "assistant") continue;
      if (b.model) perModel.set(b.model, (perModel.get(b.model) ?? 0) + 1);
      else tanpaModel++;
    }

    const modelTeratas = [...perModel.entries()]
      // Nama dipakai sebagai pemutus seri supaya urutannya tetap sama di dua
      // pemuatan berturut-turut; daftar yang bertukar tempat sendiri terbaca
      // seperti angkanya berubah padahal tidak.
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MODEL_DITAMPILKAN)
      .map(([nama, jumlah]) => ({ nama, jumlah }));

    const tanggalAktif = [...perHari.keys()].sort();
    const { kini, panjang } = hitungStreak(tanggalAktif, hari(sekarang));

    // Peta panas selalu memuat HARI_PETA hari berturut-turut sampai hari ini,
    // termasuk yang kosong. Melewati hari kosong akan memampatkan kisinya dan
    // membuat jeda seminggu terlihat sama dengan jeda sehari.
    const harian: { tanggal: string; jumlah: number }[] = [];
    for (let i = HARI_PETA - 1; i >= 0; i--) {
      const t = hari(sekarang - i * 86_400_000);
      harian.push({ tanggal: t, jumlah: perHari.get(t) ?? 0 });
    }

    return {
      percakapan: np,
      pesan: baris.length,
      token,
      hariAktif: tanggalAktif.length,
      streakSaatIni: kini,
      streakTerpanjang: panjang,
      jamPuncak: baris.length ? perJam.indexOf(Math.max(...perJam)) : null,
      modelTeratas,
      jawabanTanpaModel: tanpaModel,
      harian,
    };
  } finally {
    db.close();
  }
}

/**
 * Pembanding yang membuat angka besar berarti sesuatu.
 *
 * "15,6 juta token" tidak mengatakan apa-apa kepada siapa pun. Dibandingkan
 * dengan buku yang panjangnya diketahui orang, angka itu berubah jadi ukuran
 * yang bisa dibayangkan.
 *
 * Panjang bukunya dalam token, ditaksir dengan rasio yang sama (~3,6 karakter
 * per token) dari jumlah kata yang diketahui umum.
 */
const BUKU: { nama: string; token: number }[] = [
  { nama: "Laskar Pelangi", token: 150_000 },
  { nama: "Bumi Manusia", token: 190_000 },
  { nama: "Moby-Dick", token: 280_000 },
  { nama: "seluruh trilogi Lord of the Rings", token: 620_000 },
];

export function bandingkanBuku(token: number): string | null {
  if (token < 50_000) return null;

  // Buku TERBESAR yang masih terlampaui, supaya pembandingnya terasa berarti:
  // "3x lipat Moby-Dick" lebih bermakna daripada "56x Laskar Pelangi".
  const cocok = [...BUKU].reverse().find((b) => token >= b.token) ?? BUKU[0];
  const kali = token / cocok.token;
  const angka = kali >= 10 ? Math.round(kali) : Math.round(kali * 10) / 10;
  return `Kamu sudah memakai ~${angka.toLocaleString("id-ID")}× lebih banyak token daripada ${cocok.nama}.`;
}
