/**
 * Tanda Tiburon.
 *
 * Dibedakan dengan sengaja dari keluarga ikon di components/Ikon.tsx: ikon
 * digambar dengan garis tipis dan berongga, tanda ini BERISI PENUH. Sebuah
 * logo yang dibangun dari bahasa visual yang sama persis dengan ikon menu
 * akan terbaca sebagai "menu ketujuh", bukan sebagai identitas.
 *
 * Bentuknya menggabungkan dua hal yang membuat Tiburon berbeda dari aplikasi
 * chat lain: sirip yang memotong permukaan, dan sapuan sonar yang keluar dari
 * ujungnya. Yang kedua bukan hiasan -- pencarian korpus itulah pembedanya,
 * dan sirip tanpa sonar cuma akan jadi gambar hiu.
 *
 * Sonarnya memakai --surface, siripnya --shell: dua warna yang sudah ada,
 * dan kontras di antaranya yang membuat tanda ini tetap terbaca saat kecil.
 */

type Props = { ukuran?: number; className?: string; berdenyut?: boolean };

export function TandaTiburon({ ukuran = 40, className, berdenyut }: Props) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      role="img"
      aria-label="Tiburon"
    >
      {/* Sapuan sonar, keluar dari ujung sirip. Makin jauh makin pudar --
          itu yang membuatnya terbaca sebagai gema, bukan sebagai tiga garis. */}
      <g
        stroke="var(--surface)"
        strokeWidth={1.6}
        strokeLinecap="round"
        className={berdenyut ? "tanda-sonar" : undefined}
      >
        <path d="M25.5 12.5a7.5 7.5 0 0 1 0 11" opacity="0.85" />
        <path d="M29 8.5a13 13 0 0 1 0 19" opacity="0.5" />
        <path d="M32.5 4.5a18.5 18.5 0 0 1 0 27" opacity="0.22" />
      </g>

      {/* Sirip. Satu bentuk berisi, dengan tepi belakang yang cekung --
          lengkungan itulah yang membuatnya terbaca sebagai sirip hiu dan
          bukan sekadar segitiga. */}
      <path
        d="M6 27.5C10.5 20.5 15 13 22 8.5c-1 6.8-2.6 13.2-5 19H6Z"
        fill="var(--shell)"
      />

      {/* Garis air. Terpotong oleh sirip, jadi siripnya benar-benar terlihat
          menembus permukaan, bukan mengambang di atasnya. */}
      <path
        d="M2 27.5h4M17 27.5h4"
        stroke="var(--surface)"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}
