/**
 * Judul percakapan dari pesan pertama.
 *
 * Sebelum ini judulnya `pesan.slice(0, 60)` — memotong buta di karakter ke-60,
 * jadi sidebar penuh judul yang terputus di tengah kata ("bagaimana cara mem").
 *
 * Dibuat tanpa memanggil model, dan itu keputusan yang disengaja. Judul
 * otomatis di aplikasi lain memakai satu panggilan model per percakapan baru.
 * Di sini kuota adalah sumber daya yang paling ketat — kuotanya pernah habis
 * dan mematikan radar — dan membakarnya untuk memberi nama sesuatu yang bisa
 * diganti nama sendiri adalah pertukaran yang buruk.
 */

/**
 * Kata pembuka yang tidak membedakan satu percakapan dari yang lain.
 *
 * "bagaimana cara membuat kue" dan "bagaimana cara membuat roti" berbagi tiga
 * kata pertama; di sidebar selebar 300px, ketiganya memakan ruang yang justru
 * dibutuhkan untuk membedakan keduanya.
 */
const PEMBUKA = [
  "tolong", "coba", "bisakah", "bisa", "apakah", "apa", "bagaimana", "gimana",
  "kenapa", "mengapa", "aku", "saya", "kamu", "kau", "mau", "ingin", "minta",
  "buatkan", "buat", "jelaskan", "carikan", "cari", "tunjukkan", "beri",
  "berikan", "cara", "untuk", "yang", "itu", "ini", "dong", "ya", "nih",
];

/** Perintah garis miring bukan bagian dari isi pertanyaannya. */
function buangPerintah(teks: string): string {
  return teks.replace(/^\/\S+\s*/, "");
}

/**
 * Ringkas satu pesan jadi judul pendek.
 *
 * Batas 48 karakter, bukan 60: sidebar 300px dengan umur relatif di kanannya
 * hanya menyisakan sekitar segitu sebelum terpotong elipsis. Judul yang lebih
 * panjang dari lebar yang tersedia bukan judul, cuma teks yang dipotong dua kali.
 */
export function judulDari(pesan: string, batas = 48): string {
  const bersih = buangPerintah(pesan).replace(/\s+/g, " ").trim();
  if (!bersih) return "Obrolan baru";

  // Kalimat pertama saja. Pertanyaan panjang biasanya menaruh intinya di
  // depan, dan sisanya adalah konteks yang tidak muat di judul.
  const kalimat = bersih.split(/(?<=[.!?])\s+/)[0] ?? bersih;

  const kata = kalimat.split(" ");
  let mulai = 0;
  // Buang kata pembuka, TAPI selalu sisakan minimal dua kata. Tanpa penjaga
  // ini, "apa itu ini" akan habis tak bersisa dan judulnya jadi kosong.
  while (mulai < kata.length - 2 && PEMBUKA.includes(kata[mulai].toLowerCase().replace(/[^\p{L}]/gu, ""))) {
    mulai++;
  }

  const inti = kata.slice(mulai).join(" ") || kalimat;
  const berhuruf = inti.charAt(0).toUpperCase() + inti.slice(1);

  if (berhuruf.length <= batas) return berhuruf;

  // Potong di batas kata, bukan di tengah kata. Kalau kata pertamanya sendiri
  // sudah lebih panjang dari batas, barulah dipotong keras.
  const potong = berhuruf.slice(0, batas);
  const spasi = potong.lastIndexOf(" ");
  return (spasi > batas * 0.5 ? potong.slice(0, spasi) : potong).replace(/[,;:\-\s]+$/, "") + "…";
}
