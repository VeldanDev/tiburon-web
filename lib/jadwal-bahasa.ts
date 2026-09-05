/**
 * Jadwal cron, dibaca sebagai kalimat.
 *
 * Halaman Tugas terjadwal menampilkan apa adanya yang disimpan penjadwalnya:
 * `30 6 * * *` untuk radar pagi, dan `tiap 10080 menit` untuk peninjauan
 * mingguan. Keduanya benar dan keduanya tidak terbaca — tidak ada yang
 * berpikir dalam 10.080 menit, dan bintang di posisi ketiga tidak berarti apa
 * pun sampai kamu menghitung kolomnya.
 *
 * ATURAN YANG PALING PENTING DI SINI: yang tidak bisa diterjemahkan
 * dikembalikan APA ADANYA. Jadwal adalah hal yang orang periksa justru saat
 * curiga ada yang salah, dan terjemahan yang menebak lebih berbahaya daripada
 * ekspresi mentah yang jujur. Tidak ada tebakan di berkas ini.
 */

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "6" -> "06.00", "30 6" -> "06.30". Format jam Indonesia, titik bukan titik dua. */
function jam(menit: number, jam24: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(jam24)}.${p(menit)}`;
}

/**
 * Selang menit jadi satuan terbesar yang masih bulat.
 *
 * 10080 menit itu tujuh hari, tapi hanya kalau dibagi habis. 100 menit tetap
 * "100 menit" — "1,7 jam" tidak lebih mudah dibaca, cuma lebih mengaburkan.
 */
export function selangManusiawi(menit: number): string {
  if (!Number.isFinite(menit) || menit <= 0) return "";
  if (menit % 1440 === 0) {
    const hari = menit / 1440;
    return hari === 1 ? "tiap hari" : hari === 7 ? "tiap minggu" : `tiap ${hari} hari`;
  }
  if (menit % 60 === 0) {
    const j = menit / 60;
    return j === 1 ? "tiap jam" : `tiap ${j} jam`;
  }
  return `tiap ${menit} menit`;
}

function angka(bagian: string): number | null {
  return /^\d+$/.test(bagian) ? Number(bagian) : null;
}

/**
 * Ekspresi cron lima kolom jadi kalimat, atau null kalau bentuknya di luar
 * yang benar-benar dipakai di sini.
 */
function dariCron(ekspresi: string): string | null {
  const k = ekspresi.trim().split(/\s+/);
  if (k.length !== 5) return null;
  const [mnt, jm, tgl, bln, hari] = k;

  // Bulan tertentu tidak pernah dipakai di sini; menerjemahkannya setengah
  // jalan akan menyembunyikan bagian yang justru membedakannya.
  if (bln !== "*") return null;

  // */N di kolom menit: selang, bukan waktu tertentu.
  const selang = /^\*\/(\d+)$/.exec(mnt);
  if (selang && jm === "*" && tgl === "*" && hari === "*") {
    return selangManusiawi(Number(selang[1]));
  }
  if (mnt === "0" && /^\*\/(\d+)$/.test(jm) && tgl === "*" && hari === "*") {
    return selangManusiawi(Number(/^\*\/(\d+)$/.exec(jm)![1]) * 60);
  }

  const m = angka(mnt);
  const j = angka(jm);
  if (m === null || j === null || m > 59 || j > 23) return null;

  const waktu = jam(m, j);

  if (tgl === "*" && hari === "*") return `tiap hari ${waktu}`;

  if (tgl === "*") {
    const h = angka(hari);
    // 0 dan 7 sama-sama Minggu di cron.
    if (h !== null && h <= 7) return `tiap ${HARI[h % 7]} ${waktu}`;
    return null;
  }

  if (hari === "*") {
    const t = angka(tgl);
    if (t !== null && t >= 1 && t <= 31) return `tiap tanggal ${t}, ${waktu}`;
    return null;
  }

  return null;
}

/**
 * Bentuk yang bisa dibaca untuk satu jadwal.
 *
 * Menerima ekspresi cron maupun bentuk teks "tiap N menit" yang sudah dipakai
 * sebagian penjadwal. Yang tidak dikenali dikembalikan apa adanya — bukan
 * dikosongkan dan bukan ditebak.
 */
export function jadwalManusiawi(jadwal: string): string {
  const teks = (jadwal ?? "").trim();
  if (!teks) return "";

  const menit = /^tiap\s+(\d+)\s+menit$/i.exec(teks);
  if (menit) return selangManusiawi(Number(menit[1]));

  return dariCron(teks) ?? teks;
}

/** Apakah bentuk aslinya perlu tetap diperlihatkan di samping terjemahannya? */
export function berbedaDariAsli(jadwal: string): boolean {
  const teks = (jadwal ?? "").trim();
  return teks.length > 0 && jadwalManusiawi(teks) !== teks;
}
