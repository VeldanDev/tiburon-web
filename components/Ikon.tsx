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

/** Berkas korpus — lembar dengan sudut terlipat dan garis teks. */
export function IkonBerkas(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3Z" />
          <path d="M13.5 3v5.5H19" />
          <path d="M8.5 13h7M8.5 16.5h4.5" />
        </>
      }
    />
  );
}

/**
 * Panah lipat untuk sesuatu yang membuka ke bawah.
 *
 * Satu ikon yang BERPUTAR, bukan dua ikon berbeda. Mengganti bentuk saat
 * dibuka membuat perubahannya meloncat; memutar bentuk yang sama membuat
 * arah barunya terbaca sebagai gerakan.
 */
export function IkonLipat({ buka, ...p }: Props & { buka?: boolean }) {
  return (
    <Bingkai
      {...p}
      className={`${p.className ?? ""} ikon-lipat`.trim()}
      anak={<path d="m8.5 6 6 6-6 6" />}
    />
  );
}

/** Urutkan — dua panah berlawanan arah. */
export function IkonUrut(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M8 20V5M8 5 4.5 8.5M8 5l3.5 3.5" />
          <path d="M16 4v15M16 19l3.5-3.5M16 19l-3.5-3.5" />
        </>
      }
    />
  );
}

/** Tutup / buang saringan. */
export function IkonTutup(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="m6 6 12 12" />
          <path d="m18 6-12 12" />
        </>
      }
    />
  );
}

/** Tautan ke luar — panah yang meninggalkan bingkainya. */
export function IkonTautanLuar(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M19 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4.5" />
          <path d="M14 4h6v6" />
          <path d="M20 4 11.5 12.5" />
        </>
      }
    />
  );
}

/** Mundur / maju satu hari di radar. */
export function IkonSebelum(p: Props) {
  return <Bingkai {...p} anak={<path d="m14.5 6-6 6 6 6" />} />;
}

export function IkonSesudah(p: Props) {
  return <Bingkai {...p} anak={<path d="m9.5 6 6 6-6 6" />} />;
}

/** Sunting — pena yang menyentuh garis. */
export function IkonSunting(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M15.5 4.5 19.5 8.5 9 19H5v-4L15.5 4.5Z" />
          <path d="m13.5 6.5 4 4" />
        </>
      }
    />
  );
}

/** Hapus — tong dengan tutup. Satu-satunya ikon tanpa sudut tajam: menghapus
 *  adalah hal yang seharusnya terasa tumpul, bukan mengundang. */
export function IkonHapus(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M4.5 7h15" />
          <path d="M9.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V7" />
          <path d="M6.5 7v12a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V7" />
          <path d="M10.5 11v6M13.5 11v6" />
        </>
      }
    />
  );
}

/** Hentikan — bujur sangkar padat. Bentuk berhenti yang sudah dikenal semua
 *  orang; tidak ada gunanya menciptakan bentuk baru untuk ini. */
export function IkonHenti(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" />}
    />
  );
}

/** Cari — lensa dengan gagang, ujung tajam di pangkalnya. */
export function IkonCari(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <circle cx="10.5" cy="10.5" r="6" />
          <path d="m15 15 5 5" />
        </>
      }
    />
  );
}

/** Sematkan — jangkar kecil yang menahan sesuatu di tempatnya. */
export function IkonSemat(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M14.5 3.5 20.5 9.5" />
          <path d="M16.5 5.5 10 8l-1.5 5.5L11 16l5.5-1.5L19 8l-2.5-2.5Z" />
          <path d="m10 14-6 6" />
        </>
      }
    />
  );
}

/** Unduh — panah menyelam ke dasar. */
export function IkonUnduh(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M12 3.5v11" />
          <path d="m7.5 10 4.5 4.5 4.5-4.5" />
          <path d="M4.5 19.5h15" />
        </>
      }
    />
  );
}

/** Cabang — satu arus yang memisah jadi dua. */
export function IkonCabang(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <circle cx="7" cy="5.5" r="2" />
          <circle cx="7" cy="18.5" r="2" />
          <circle cx="17" cy="12" r="2" />
          <path d="M7 7.5v9" />
          <path d="M7 12h8" />
        </>
      }
    />
  );
}

/** Pintasan papan ketik — tuts. */
export function IkonPintasan(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <rect x="2.5" y="6" width="19" height="12" rx="2" />
          <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01" />
          <path d="M8 14h8" />
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

/**
 * Pengaturan — katup tekanan, bukan roda gigi.
 *
 * Roda gigi adalah ikon paling generik yang ada; ia muncul di setiap aplikasi
 * yang pernah dibuat. Katup adalah alat yang benar-benar dipakai orang di
 * kedalaman untuk mengatur sesuatu, dan bentuknya sama terbacanya.
 */
export function IkonAtur(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          <path d="m5.6 5.6 2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
        </>
      }
    />
  );
}

/**
 * Suara — mikrofon.
 *
 * Satu-satunya ikon di keluarga ini yang TIDAK diberi bentuk laut dalam.
 * Mikrofon adalah bentuk yang sudah dikenal semua orang, dan mengganti ikon
 * perekaman dengan sesuatu yang puitis berarti pengguna harus menebak tombol
 * mana yang menyalakan mikrofonnya — kesalahan yang akibatnya nyata.
 */
export function IkonSuara(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <rect x="9" y="2.5" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
          <path d="M12 17.5V21" />
        </>
      }
    />
  );
}

/**
 * Mode Agen — kawanan: tiga sirip bergerak bersama.
 *
 * Bukan roda gigi atau robot. Yang membedakan mode ini bukan "otomatis"
 * melainkan bahwa Tiburon boleh berkeliling MENCARI sendiri sebelum menjawab,
 * dan kawanan hiu yang menyisir adalah gambaran yang tepat untuk itu.
 */
export function IkonAgen(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M2.5 19h19" />
          <path d="M4.5 19c1.4-3 3-5.2 5.5-6.8-.3 2.5-.7 4.7-1.3 6.8" />
          <path d="M13 19c1.2-4.2 3-7.4 5.8-9.8-.4 3.6-1 6.9-2 9.8" />
          <path d="M9.5 8.5 11 7l1.5 1.5" />
        </>
      }
    />
  );
}

/** Ikut sistem — layar. */
export function IkonLayar(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <rect x="2.5" y="4" width="19" height="13" rx="2" />
          <path d="M9 20.5h6M12 17v3.5" />
        </>
      }
    />
  );
}

/** Terang — matahari di atas garis air. Sinarnya tidak simetris penuh:
 *  satu sinar lebih panjang, mengulang sudut tajam keluarga ikon ini. */
export function IkonMatahari(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <path d="m5.2 5.2 2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
        </>
      }
    />
  );
}

/** Gelap — bulan sabit. */
export function IkonBulan(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />}
    />
  );
}

/**
 * Ingatan — pelampung penanda, bukan otak atau bola lampu.
 *
 * Otak adalah ikon "AI" paling generik yang ada, dan salah artinya di sini:
 * ingatan di Tiburon ditulis tangan, bukan disimpulkan. Pelampung adalah benda
 * yang sengaja kamu jatuhkan supaya bisa menemukan tempat yang sama lagi —
 * persis apa yang dilakukan baris ingatan.
 */
export function IkonPelampung(p: Props) {
  return (
    <Bingkai
      {...p}
      anak={
        <>
          <path d="M12 3.5v8" />
          {/* Panji dengan takik: satu-satunya ujung tajam ikon ini. */}
          <path d="M12.5 4h4.2l-1.7 1.6 1.7 1.6h-4.2" />
          <path d="M7.5 15.5a4.5 4.5 0 0 1 9 0" />
          <path d="M3 15.5h18" />
          <path d="M6 19c2-1.2 4-1.2 6 0s4 1.2 6 0" />
        </>
      }
    />
  );
}
