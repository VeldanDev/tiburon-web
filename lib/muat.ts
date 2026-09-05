/**
 * Membuat percakapan MUAT di jendela model sebelum dikirim.
 *
 * KENAPA INI ADA. Meter konteks sudah memperingatkan sejak 50%, berubah kuning
 * di 75% dan merah di 90% — lalu tidak terjadi apa-apa. Di 101% permintaannya
 * tetap dikirim utuh, dan yang didapat Veldan adalah salah satu dari dua hal
 * yang sama-sama buruk:
 *
 *   galat penyedia   percakapan yang sudah panjang tiba-tiba berhenti bekerja
 *                    seluruhnya, dengan pesan tentang batas token yang tidak
 *                    menyebut satu pun hal yang bisa ia lakukan
 *   pemotongan diam  penyedia membuang bagian awal sendiri, tanpa memberi tahu
 *                    siapa pun, dan model mulai melupakan hal yang jelas-jelas
 *                    ada di layar
 *
 * Peringatan tanpa tindakan hanya memindahkan kegagalan ke tempat yang lebih
 * membingungkan. Modul ini yang bertindak.
 *
 * TIGA ATURAN YANG MEMBENTUKNYA:
 *
 * 1. GILIRAN UTUH, BUKAN PESAN SATUAN. Yang dibuang selalu satu giliran penuh
 *    — pertanyaan beserta jawabannya dan semua hasil alat di dalamnya. Membuang
 *    pesan satuan bisa menyisakan jawaban tanpa pertanyaan (model melihat
 *    dirinya menjawab sesuatu yang tak pernah ditanyakan) atau hasil alat tanpa
 *    panggilannya — yang terakhir bahkan ditolak API-nya mentah-mentah.
 *
 * 2. YANG DIBUANG DISEBUTKAN. Diganti satu catatan, bukan dihilangkan senyap.
 *    Model yang tidak tahu ada bagian yang hilang akan menjawab seolah ia
 *    sudah membaca semuanya — persis kegagalan yang sedang kita hindari.
 *
 * 3. GILIRAN TERAKHIR SELALU IKUT, walau ia sendirian sudah kelewat besar.
 *    Mengirim percakapan tanpa pertanyaan terakhirnya berarti menjawab
 *    pertanyaan yang salah; lebih baik permintaannya gagal dengan jujur
 *    daripada berhasil menjawab hal lain.
 *
 * Ini pemangkas, BUKAN peringkas. Meringkas bagian yang dibuang butuh satu
 * panggilan model lagi — yang bisa gagal justru saat paling dibutuhkan, karena
 * kuota habis adalah keadaan yang sama yang membuat percakapan menumpuk.
 * Pemangkas harus selalu berhasil; peringkas bisa dibangun di atasnya nanti.
 */

/**
 * Rasio taksiran karakter per token.
 *
 * Menghitung token sungguhan butuh tokenizer model itu sendiri — ratusan
 * kilobyte, berbeda tiap model, untuk memperbaiki angka yang gunanya cuma
 * menjawab "masih muat atau tidak". 3,6 adalah rata-rata wajar untuk campuran
 * Bahasa Indonesia dan kode.
 */
const PER_TOKEN = 3.6;

/**
 * Jendela konteks rantai bawaan.
 *
 * Diambil dari yang paling SEMPIT di rantai, bukan yang terluas: kalau model
 * pertama kena 429 dan yang kedua mengambil alih, percakapan yang muat di yang
 * pertama harus tetap muat di penggantinya.
 *
 * Tinggal di sini, bukan di komponen meternya, karena dua tempat yang memegang
 * angka yang sama berarti satu dari keduanya akan tertinggal saat yang lain
 * berubah. Meter yang menghitung dengan batas lama sambil pemangkas memakai
 * batas baru adalah bug yang tidak akan terlihat sampai seseorang bertanya
 * kenapa meternya bilang 80% padahal ada yang dipangkas.
 */
export const JENDELA = 128_000;

/**
 * Ruang yang disisakan untuk jawabannya sendiri.
 *
 * Jendela dipakai bersama oleh yang masuk DAN yang keluar. Mengisinya sampai
 * penuh dengan pertanyaan menyisakan nol ruang untuk menjawab, dan yang
 * terjadi bukan jawaban pendek melainkan jawaban yang terpotong di tengah
 * kalimat.
 */
export const CADANGAN_JAWABAN = 8_000;

/** Anggaran sesungguhnya untuk seluruh percakapan yang dikirim. */
export const ANGGARAN = JENDELA - CADANGAN_JAWABAN;

export function taksirToken(teks: string): number {
  return Math.ceil(teks.length / PER_TOKEN);
}

/**
 * Bentuk pesan seminimal mungkin, sengaja.
 *
 * Jalur obrolan mengirim `{role, content}`; jalur agen menambahkan `tool_calls`
 * dan `tool_call_id`. Modul ini hanya perlu tahu PERAN dan PANJANGNYA, jadi
 * ia menerima keduanya tanpa harus tahu bedanya — dan satu pemangkas melayani
 * dua jalur, alih-alih dua pemangkas yang perlahan berbeda.
 */
export type PesanMuat = {
  role: string;
  content?: string | null;
  [lain: string]: unknown;
};

/**
 * Berapa token satu pesan.
 *
 * `tool_calls` ikut dihitung lewat bentuk JSON-nya: argumen panggilan alat bisa
 * panjang, dan pesan yang `content`-nya null tapi membawa panggilan besar akan
 * terhitung nol kalau hanya `content` yang dilihat.
 */
export function tokenPesan(p: PesanMuat): number {
  let n = taksirToken(p.content ?? "");
  if (p.tool_calls) n += taksirToken(JSON.stringify(p.tool_calls));
  // Tiap pesan membawa ongkos tetap untuk peran dan pembatasnya. Angkanya
  // kecil, tapi pada percakapan 200 pesan ia jadi ribuan token yang kalau
  // diabaikan membuat taksirannya meleset ke arah yang salah.
  return n + 4;
}

export type HasilMuat = {
  pesan: PesanMuat[];
  /** Berapa giliran yang dibuang. Nol berarti tidak ada yang disentuh. */
  dibuang: number;
  /** Taksiran token setelah dipangkas. */
  token: number;
};

/**
 * Satu giliran: sebuah pesan pengguna beserta semua yang mengikutinya sampai
 * pesan pengguna berikutnya.
 *
 * Pengelompokan memakai peran `user` sebagai batas karena itulah satu-satunya
 * penanda yang ada di kedua jalur. Jawaban, panggilan alat, dan hasil alat
 * semuanya milik giliran yang sama dengan pertanyaan yang memicunya.
 */
function kelompokkan(pesan: PesanMuat[]): PesanMuat[][] {
  const giliran: PesanMuat[][] = [];
  for (const p of pesan) {
    if (p.role === "user" || giliran.length === 0) giliran.push([p]);
    else giliran[giliran.length - 1].push(p);
  }
  return giliran;
}

/**
 * Pangkas percakapan supaya muat, dari yang paling lama.
 *
 * Pesan `system` di awal SELALU dipertahankan seluruhnya: di dalamnya ada
 * persona, instruksi khusus, ingatan, dan potongan korpus — membuangnya berarti
 * menjawab sebagai orang lain dengan bahan yang berbeda, yang jauh lebih buruk
 * daripada kehilangan percakapan lama.
 */
export function muatkan(pesan: PesanMuat[], anggaran = ANGGARAN): HasilMuat {
  const sistem: PesanMuat[] = [];
  let i = 0;
  while (i < pesan.length && pesan[i].role === "system") sistem.push(pesan[i++]);
  const sisa = pesan.slice(i);

  const hitung = (ps: PesanMuat[]) => ps.reduce((n, p) => n + tokenPesan(p), 0);
  const total = hitung(sistem) + hitung(sisa);
  if (total <= anggaran) return { pesan, dibuang: 0, token: total };

  const giliran = kelompokkan(sisa);
  let terpakai = hitung(sistem);
  const disimpan: PesanMuat[][] = [];

  // Dari yang TERBARU ke yang terlama: yang baru saja dibicarakan hampir selalu
  // lebih menentukan jawabannya daripada yang dibicarakan dua jam lalu.
  for (let g = giliran.length - 1; g >= 0; g--) {
    const biaya = hitung(giliran[g]);
    // Giliran terakhir masuk tanpa syarat — lihat aturan 3 di kepala berkas.
    if (disimpan.length === 0 || terpakai + biaya <= anggaran) {
      disimpan.unshift(giliran[g]);
      terpakai += biaya;
    } else break;
  }

  const dibuang = giliran.length - disimpan.length;
  if (dibuang === 0) return { pesan, dibuang: 0, token: total };

  // Catatannya ditaruh SETELAH pesan sistem dan SEBELUM percakapan yang
  // tersisa — persis di lubang tempat yang dibuang tadi berada, supaya
  // urutannya tetap terbaca sebagai satu garis waktu.
  const catatan: PesanMuat = {
    role: "system",
    content:
      `[${dibuang} giliran awal percakapan ini dihilangkan supaya sisanya muat ` +
      `di jendela model. Isinya TIDAK kamu lihat lagi. Kalau jawabannya ` +
      `bergantung pada bagian yang hilang itu, katakan begitu dan minta ` +
      `Veldan mengulang bagian yang perlu — jangan menebak isinya.]`,
  };

  return {
    pesan: [...sistem, catatan, ...disimpan.flat()],
    dibuang,
    token: terpakai + tokenPesan(catatan),
  };
}
