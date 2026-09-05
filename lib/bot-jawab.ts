/**
 * Otak bot katalog — yang dijual gig Fiverr sebagai "Catalogue Bot".
 *
 * KENAPA DI DALAM TIBURON. Bot ini butuh persis empat hal yang sudah ada dan
 * sudah diuji di sini: mencari potongan yang relevan dari arsip klien
 * (`lib/korpus.ts`), memanggil rantai model gratis dengan klasifikasi
 * kegagalan (`lib/penyedia.ts`), menyunting rahasia sebelum teks keluar
 * (`lib/redaksi.ts`), dan memangkas percakapan supaya muat (`lib/muat.ts`).
 * Menulis ulang keempatnya di proyek terpisah berarti empat salinan yang
 * perlahan berbeda — dan salinan yang tertinggal di sini bukan cuma
 * merepotkan: ia menjawab pelanggan orang lain dengan kode yang belum
 * diperbaiki.
 *
 * YANG MEMBEDAKANNYA DARI CHATBOT TEMPLATE, dan ini seluruh alasan gig-nya
 * bisa dijual lebih mahal daripada bot no-code seharga sepuluh dolar:
 *
 *   MENYERAH, BUKAN MENGARANG. Kalau arsipnya tidak memuat jawabannya, bot
 *   menyerahkan percakapan ke manusia. Ketakutan terbesar pemilik toko bukan
 *   bot yang bodoh — bot yang bodoh cuma memalukan. Yang menakutkan adalah bot
 *   yang mengarang harga, stok, atau janji pengiriman di depan pelanggannya,
 *   karena itu menciptakan kewajiban yang harus ia tanggung.
 *
 *   TIDAK BOCOR. Katalog klien sering satu berkas dengan hal yang tidak untuk
 *   pelanggan — margin, harga modal, catatan pemasok. Jawaban disaring
 *   sebelum dikirim.
 */
import { cari, type PotonganKorpus } from "@/lib/korpus";
import { kirim, type Pesan } from "@/lib/penyedia";
import { sunting } from "@/lib/redaksi";

/**
 * Berapa potongan katalog yang diberikan ke model.
 *
 * Lebih sedikit daripada jalur obrolan Tiburon (8): pertanyaan pelanggan
 * hampir selalu tentang SATU barang, dan potongan tambahan justru menambah
 * peluang model mencampur harga dua barang berbeda.
 */
const POTONGAN = 5;

/**
 * Penanda yang diminta ditulis model saat ia tidak bisa menjawab.
 *
 * Penanda, bukan tebakan dari bunyi kalimatnya: menebak "sepertinya ia tidak
 * tahu" dari teks bebas akan salah persis pada kalimat yang paling penting.
 */
export const PENANDA_SERAH = "[SERAHKAN]";

export const PERSONA_BOT = `Kamu asisten belanja sebuah toko. Kamu menjawab pelanggan lewat chat.

ATURAN YANG TIDAK BOLEH DILANGGAR:

1. Jawab HANYA dari KATALOG di bawah. Kalau katalognya tidak memuat
   jawabannya — harga, stok, ukuran, warna, ongkir, jam buka, apa pun —
   tulis ${PENANDA_SERAH} lalu satu kalimat ramah bahwa kamu akan memanggil
   orang dari tim. JANGAN menebak, jangan memperkirakan, jangan menjawab
   dari pengetahuan umum.

2. Jangan pernah menyebut angka harga, stok, atau tanggal yang tidak
   tertulis persis di katalog.

3. Jangan pernah menjanjikan diskon, pengembalian dana, garansi, atau
   apa pun yang mengikat toko. Kalau ditanya itu, tulis ${PENANDA_SERAH}.

4. Balas SINGKAT — dua sampai tiga kalimat, seperti orang mengetik di
   chat. Tanpa daftar bernomor, tanpa judul, tanpa basa-basi pembuka.

5. Pakai bahasa yang dipakai pelanggan.

6. JANGAN pernah menyebut nama berkas, "katalog", "dokumen", "data", atau
   dari mana kamu tahu. Pelanggan sedang bicara dengan toko, bukan dengan
   sistem. "Stoknya 3 pasang" — bukan "berdasarkan katalog.md, stoknya 3
   pasang".`;

/** Nama berkas terakhir dari sebuah jalur, apa pun pemisahnya. */
function namaAkhir(jalur: string): string {
  const bagian = jalur.split(/[/\\]/);
  return bagian[bagian.length - 1] ?? "";
}

/** Lolos-kan karakter khas regex supaya namanya dicocokkan apa adanya. */
function lolosRegex(teks: string): string {
  return teks.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
}

/**
 * Buang sebutan nama berkas dari balasan.
 *
 * Yang dibuang cuma nama berkas yang benar-benar dipakai giliran ini, bukan
 * pola umum: menyaring semua kata berakhiran .md akan memotong nama produk
 * yang kebetulan mengandung titik.
 */
function buangSebutanBerkas(teks: string, potongan: PotonganKorpus[]): string {
  let hasil = teks;
  for (const p of potongan) {
    const nama = namaAkhir(p.path);
    if (!nama) continue;
    // Frasa penghubung di depannya ikut dibuang kalau ada — kalau tidak, yang
    // tersisa adalah "berdasarkan , stoknya 3 pasang", yang justru lebih aneh
    // daripada menyebut berkasnya.
    const pola = new RegExp(
      "[ (]*(?:berdasarkan|menurut|sesuai|dari|di|pada)?[ ]*" +
        "(?:berkas |file |dokumen |data )?" +
        lolosRegex(nama) +
        "[ )]*,?",
      "gi",
    );
    hasil = hasil.replace(pola, " ");
  }
  return hasil
    .replace(/ {2,}/g, " ")
    .replace(/ +([.,!?])/g, "$1")
    .trim();
}

export type Balasan = {
  teks: string;
  /** Percakapan ini perlu dilanjutkan manusia. */
  serahkan: boolean;
  /** Berkas katalog yang dipakai — untuk log pemilik toko, bukan untuk pelanggan. */
  sumber: string[];
};

/**
 * Susun konteks katalog jadi teks.
 *
 * Nama berkasnya ikut supaya pemilik toko bisa melacak jawaban yang aneh
 * kembali ke barisnya sendiri — itu yang membuat bot ini bisa diperbaiki,
 * bukan cuma dikeluhkan.
 */
function susunKatalog(potongan: PotonganKorpus[]): string {
  return potongan
    .map((p) => `[${p.path.split(/[\\/]/).pop()}]\n${p.teks}`)
    .join("\n\n---\n\n");
}

export type OpsiJawab = {
  dbKorpus?: string;
  /** Giliran sebelumnya, terbaru di akhir. Dipangkas oleh pemanggilnya. */
  riwayat?: Pesan[];
  /** Disuntik di uji. Bawaannya rantai model gratis lewat lib/penyedia.ts. */
  panggil?: (pesan: Pesan[], konteks: PotonganKorpus[]) => Promise<string>;
};

async function panggilBawaan(pesan: Pesan[], konteks: PotonganKorpus[]): Promise<string> {
  let keluar = "";
  for await (const k of kirim(pesan, { konteks, jiwa: PERSONA_BOT })) {
    if (k.jenis === "teks") keluar += k.teks;
    if (k.jenis === "gagal") throw new Error(k.pesan);
  }
  return keluar;
}

/**
 * Jawab satu pesan pelanggan.
 *
 * TIDAK PERNAH melempar. Bot yang melempar berhenti membalas siapa pun, dan
 * pemilik toko baru menyadarinya berjam-jam kemudian saat pelanggannya sudah
 * pergi. Semua kegagalan — model mati, kuota habis, katalog rusak — berujung
 * pada penyerahan ke manusia, yang memang jawaban yang benar untuk semuanya.
 */
export async function jawabPelanggan(
  pertanyaan: string,
  opsi: OpsiJawab = {},
): Promise<Balasan> {
  const bersih = pertanyaan.trim();
  if (!bersih) {
    return { teks: "Halo! Ada yang bisa dibantu?", serahkan: false, sumber: [] };
  }

  let potongan: PotonganKorpus[] = [];
  try {
    potongan = cari(bersih, POTONGAN, opsi.dbKorpus);
  } catch {
    // Katalog tidak terbaca. Diserahkan, bukan dijawab dari ketiadaan.
    return {
      teks: "Maaf, saya panggilkan orang dari tim ya untuk pertanyaan ini.",
      serahkan: true,
      sumber: [],
    };
  }

  if (!potongan.length) {
    // Tidak ada yang cocok di katalog. Ini kasus paling sering, dan ini yang
    // paling penting TIDAK dijawab model — memberi model konteks kosong lalu
    // menyuruhnya menjawab adalah cara tercepat membuatnya mengarang.
    return {
      teks: "Untuk yang ini saya panggilkan orang dari tim ya, biar dijawab dengan pasti.",
      serahkan: true,
      sumber: [],
    };
  }

  const pesan: Pesan[] = [
    ...(opsi.riwayat ?? []),
    { role: "user", content: `KATALOG:\n\n${susunKatalog(potongan)}\n\nPELANGGAN: ${bersih}` },
  ];

  let mentah: string;
  try {
    mentah = await (opsi.panggil ?? panggilBawaan)(pesan, potongan);
  } catch {
    return {
      teks: "Sebentar ya, saya panggilkan orang dari tim untuk membantu.",
      serahkan: true,
      sumber: [],
    };
  }

  const serahkan = mentah.includes(PENANDA_SERAH);
  let teks = mentah.replaceAll(PENANDA_SERAH, "").trim();

  if (!teks) {
    // Balasan kosong adalah kegagalan senyap: pelanggan melihat bot yang
    // dibaca tapi tidak menjawab, dan itu lebih buruk daripada tidak ada bot.
    teks = "Sebentar ya, saya panggilkan orang dari tim untuk membantu.";
    return { teks, serahkan: true, sumber: [] };
  }

  // Katalog klien sering satu berkas dengan hal yang tidak untuk pelanggan:
  // harga modal, margin, kontak pemasok. Disaring sebelum keluar.
  teks = sunting(teks).teks;

  // Nama berkas dibuang, walau personanya sudah melarang. Model gratis
  // MENGABAIKAN aturan itu pada percobaan pertama — ia menjawab "berdasarkan
  // katalog.md, stoknya 3 pasang", dan pelanggan yang melihat nama berkas
  // langsung tahu ia bicara dengan mesin. Aturan di persona adalah permintaan;
  // penyaring di sini yang menjaminnya.
  teks = buangSebutanBerkas(teks, potongan);

  return {
    teks,
    serahkan,
    sumber: [...new Set(potongan.map((p) => p.path))],
  };
}
