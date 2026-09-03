/**
 * Set ikon Tiburon.
 *
 * Semuanya digambar sendiri, dan semuanya mengambil bentuk dari satu tempat:
 * dunia laut dalam dan instrumen yang dipakai orang untuk bekerja di sana.
 * Emoji dibuang — emoji milik Unicode, dipakai jutaan aplikasi lain, dan
 * bentuknya berubah-ubah tergantung sistem operasi.
 *
 * Aturan gambar yang membuatnya terbaca sebagai satu keluarga:
 *   - kanvas 24×24, stroke 1.5, ujung dan sambungan membulat
 *   - garis tunggal; isian hanya untuk titik penekanan
 *   - tiap ikon punya SATU sudut atau ujung tajam — gigi hiu, sifat brand
 *   - currentColor, jadi warnanya ikut konteksnya
 *
 * Ukuran bawaan 18: cukup besar untuk terbaca di sidebar, cukup kecil untuk
 * tidak melawan teks di sebelahnya.
 */

type Props = { ukuran?: number; className?: string };

function Bingkai({ ukuran = 18, className, anak }: Props & { anak: React.ReactNode }) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {anak}
    </svg>
  );
}

/** Korpus — tumpukan lempeng sedimen, lapisan yang mengendap seiring waktu. */
export function IkonKorpus(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M3 7.5 12 4l9 3.5-9 3.5-9-3.5Z" />
          <path d="M3 12.5 12 16l9-3.5" />
          <path d="M3 17 12 20.5 21 17" />
        </>
      }
    />
  );
}

/** Radar — sapuan sonar: busur mengembang dari satu titik. */
export function IkonRadar(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <circle cx="5" cy="19" r="1.4" fill="currentColor" stroke="none" />
          <path d="M5 13.5a5.5 5.5 0 0 1 5.5 5.5" />
          <path d="M5 8.5A10.5 10.5 0 0 1 15.5 19" />
          <path d="M5 3.5A15.5 15.5 0 0 1 20.5 19" />
        </>
      }
    />
  );
}

/** Riwayat sumber — jejak gelembung yang naik dari dasar ke permukaan. */
export function IkonSumber(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <circle cx="7" cy="18.5" r="1.1" />
          <circle cx="11" cy="13" r="1.8" />
          <circle cx="15.5" cy="7" r="2.6" />
          <path d="M20 3.2 21.6 4.8" />
        </>
      }
    />
  );
}

/** Tugas terjadwal — jam pasir, bukan jam bulat: yang penting sisa waktunya. */
export function IkonJadwal(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M7 3h10" />
          <path d="M7 21h10" />
          <path d="M7 3c0 4 5 6.2 5 9s-5 5-5 9" />
          <path d="M17 3c0 4-5 6.2-5 9s5 5 5 9" />
        </>
      }
    />
  );
}

/** Papan desain — kisi dengan satu sel bercahaya. */
export function IkonDesain(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
          <path d="M3.5 10h17M10 3.5v17" />
          <rect x="13" y="13" width="4.5" height="4.5" rx="1" fill="currentColor" stroke="none" />
        </>
      }
    />
  );
}

/** Jalur Cepat — riak permukaan, dua gelombang pendek. */
export function IkonCepat(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M3 9c2.2-2 4.2-2 6.4 0s4.2 2 6.4 0 4.2-2 5.2-1" />
          <path d="M3 15c2.2-2 4.2-2 6.4 0s4.2 2 6.4 0 4.2-2 5.2-1" />
        </>
      }
    />
  );
}

/** Jalur Tiburon — sirip hiu yang memotong garis air. Satu sudut tajam. */
export function IkonTiburon(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M2.5 16.5h19" />
          <path d="M7.5 16.5C10 11 13 7 17.5 4.5c-.6 4.4-1.2 8.4-2.2 12" />
        </>
      }
    />
  );
}

/** Jalur Kode — kurung sudut, bahasa yang dipakai di dasar. */
export function IkonKode(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M8.5 7.5 3.5 12l5 4.5" />
          <path d="M15.5 7.5 20.5 12l-5 4.5" />
          <path d="M13.5 4.5 10.5 19.5" />
        </>
      }
    />
  );
}

/** Banding — dua arus berdampingan, satu lebih dalam dari yang lain. */
export function IkonBanding(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M9 4.5v15" />
          <path d="M15 4.5v15" />
          <path d="M4.5 9h3M4.5 13h3" />
          <path d="M16.5 7h3M16.5 11h3M16.5 15h3" />
        </>
      }
    />
  );
}

/** Baru — kail: yang menarik sesuatu dari kedalaman. */
export function IkonBaru(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M12 3.5v10.5a4 4 0 0 1-8 0" />
          <path d="M9 6.5 12 3.5l3 3" />
          <path d="M17 15v6M14 18h6" />
        </>
      }
    />
  );
}

/** Lampiran — jangkar. */
export function IkonLampir(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v13" />
          <path d="M7 11h10" />
          <path d="M4.5 16a7.5 7.5 0 0 0 15 0" />
        </>
      }
    />
  );
}

/** Peringatan — pelampung suar: segitiga di atas garis air. */
export function IkonPeringatan(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M12 4 20 18H4L12 4Z" />
          <path d="M12 10v3.5" />
          <circle cx="12" cy="16" r="0.6" fill="currentColor" stroke="none" />
        </>
      }
    />
  );
}

/** Model yang menjawab — arus yang berbelok, jalur yang benar-benar diambil. */
export function IkonModel(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M4 7h9a4 4 0 0 1 0 8H7" />
          <path d="M10 12l-3 3 3 3" />
        </>
      }
    />
  );
}

/** Salin — dua sisik yang saling menindih. */
export function IkonSalin(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M9 9.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7Z" />
          <path d="M15 7.5v-1a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1" />
        </>
      }
    />
  );
}

/** Centang — konfirmasi. Satu goresan, tanpa lingkaran. */
export function IkonCentang(p: Props) {
  return <Bingkai {...p} anak={<path d="m4.5 12.5 5 5 10-11" />} />;
}

/** Ulangi — arus yang berputar kembali ke titik awalnya. */
export function IkonUlangi(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M20 12a8 8 0 1 1-2.6-5.9" />
          <path d="M20 4v4.5h-4.5" />
        </>
      }
    />
  );
}

/** Turun ke pesan terbaru — anak panah menyelam. */
export function IkonTurun(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M12 5v13" />
          <path d="m6.5 12.5 5.5 5.5 5.5-5.5" />
        </>
      }
    />
  );
}

/** Kirim — mata panah tunggal condong ke kanan, ujung tajam. */
export function IkonKirim(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M4 12h13" />
          <path d="M12.5 6.5 18.5 12l-6 5.5" />
        </>
      }
    />
  );
}
