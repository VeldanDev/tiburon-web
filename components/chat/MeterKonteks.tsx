"use client";

/**
 * Meter konteks — berapa banyak jendela model yang sudah terpakai.
 *
 * Gagasan dari bilah status Grok, tapi menjawab pertanyaan yang lebih menyakit
 * di sini: rantai model bawaan Tiburon adalah model gratis dengan jendela yang
 * jauh lebih sempit daripada model berbayar. Percakapan panjang, lampiran
 * besar, dan potongan korpus semuanya menumpuk di tempat yang sama, dan
 * sebelum ini tidak ada satu pun tanda sampai jawabannya mulai melupakan awal
 * percakapan tanpa penjelasan.
 *
 * Angkanya TAKSIRAN, dan disebut begitu. Menghitung token sungguhan butuh
 * tokenizer model itu sendiri — ratusan kilobyte yang harus diunduh browser,
 * berbeda tiap model, untuk memperbaiki angka yang gunanya cuma menjawab
 * "masih lega atau sudah mepet". Rasio 1 token ≈ 3,6 karakter adalah rata-rata
 * yang wajar untuk campuran Bahasa Indonesia dan kode.
 */

const PER_TOKEN = 3.6;

/**
 * Jendela konteks rantai bawaan.
 *
 * Diambil dari yang paling SEMPIT di rantai, bukan yang terluas: kalau model
 * pertama kena 429 dan yang kedua mengambil alih, percakapan yang muat di
 * yang pertama harus tetap muat di penggantinya. Meter yang menampilkan
 * batas terluas akan tampak lega tepat sebelum failover memotongnya.
 */
export const JENDELA = 128_000;

export function taksirToken(teks: string): number {
  return Math.ceil(teks.length / PER_TOKEN);
}

export function MeterKonteks({ pesan }: { pesan: { isi: string }[] }) {
  const token = pesan.reduce((n, p) => n + taksirToken(p.isi), 0);
  const rasio = Math.min(1, token / JENDELA);

  // Di bawah 50% tidak ditampilkan sama sekali. Meter yang selalu terlihat
  // pada percakapan yang baru dimulai adalah kecemasan tanpa sebab, dan mata
  // belajar mengabaikannya justru sebelum ia mulai berarti.
  if (rasio < 0.5) return null;

  const warna =
    rasio > 0.9 ? "var(--danger)" : rasio > 0.75 ? "var(--warn)" : "var(--teks-redup)";

  return (
    <span
      className="flex items-center gap-1.5 text-[11px]"
      title={`Taksiran ${token.toLocaleString("id-ID")} dari ~${JENDELA.toLocaleString("id-ID")} token. Angka ini perkiraan, bukan hitungan pasti.`}
    >
      <span
        aria-hidden
        className="h-1 w-10 overflow-hidden rounded-full"
        style={{ background: "var(--garis)" }}
      >
        <span
          className="block h-full rounded-full"
          style={{
            width: `${rasio * 100}%`,
            background: warna,
            transition: "width var(--alih)",
          }}
        />
      </span>
      <span className="angka" style={{ color: warna }}>
        {Math.round(rasio * 100)}%
      </span>
    </span>
  );
}
