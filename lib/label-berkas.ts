/**
 * Nama yang menunjuk satu berkas korpus, dan hanya satu.
 *
 * Seluruh rantai sumber di Tiburon dulu memakai NAMA BERKAS saja: jawaban
 * menyebutnya, kartu sumber mencarinya, riwayat sumber mencatatnya. Itu
 * berjalan sampai korpusnya berisi tiga berkas bernama sama —
 *
 *   memory/dreaming/light/2026-09-03.md
 *   memory/dreaming/deep/2026-09-03.md
 *   memory/dreaming/rem/2026-09-03.md
 *
 * — dan sejak itu "2026-09-03.md" berhenti berarti apa pun. Jawaban menyebut
 * sumber yang tidak bisa ditelusuri, kartu sumbernya membuka potongan dari
 * ketiganya sekaligus, dan halaman riwayat menganggap ketiganya satu berkas.
 *
 * Untuk aplikasi yang seluruh gunanya adalah "menjawab dari korpusmu dan
 * menyebut sumbernya", sumber yang tidak bisa diidentifikasi bukan cacat
 * kecil — itu janjinya yang batal.
 *
 * Jalan keluarnya bukan menampilkan jalur penuh. `D:/Downloads/Tiburon/
 * 03-hasil-analisis/analisis-video.md` tidak lebih berguna daripada
 * `analisis-video.md`; ia cuma lebih panjang. Yang dipakai di sini adalah
 * SUFIKS TERPENDEK yang masih unik: nama saja kalau memang cukup, ditambah
 * satu folder induk kalau tidak, dan seterusnya.
 */

function ruas(jalur: string): string[] {
  return jalur.split(/[\\/]/).filter(Boolean);
}

/** Sufiks `n` ruas terakhir, selalu dengan garis miring maju. */
function sufiks(jalur: string, n: number): string {
  const r = ruas(jalur);
  return r.slice(Math.max(0, r.length - n)).join("/");
}

/**
 * Peta jalur penuh -> label terpendek yang unik di antara `semua`.
 *
 * Jalur yang tidak ada di `semua` tetap dapat label: ia dihitung terhadap
 * daftar itu juga, jadi potongan dari berkas yang baru diindeks tidak
 * kehilangan namanya.
 */
export function petaLabel(semua: string[]): Map<string, string> {
  const hasil = new Map<string, string>();
  const terdalam = Math.max(1, ...semua.map((j) => ruas(j).length));

  for (const jalur of semua) {
    let label = sufiks(jalur, 1);
    for (let n = 1; n <= terdalam; n++) {
      const calon = sufiks(jalur, n);
      // Unik berarti: tidak ada jalur LAIN yang sufiks n-ruasnya sama.
      const bentrok = semua.some((lain) => lain !== jalur && sufiks(lain, n) === calon);
      label = calon;
      if (!bentrok) break;
    }
    hasil.set(jalur, label);
  }
  return hasil;
}

/** Label untuk satu jalur, dihitung terhadap seluruh korpus. */
export function labelJalur(jalur: string, semua: string[]): string {
  return petaLabel(semua.includes(jalur) ? semua : [...semua, jalur]).get(jalur) ?? sufiks(jalur, 1);
}

/**
 * Apakah `jalur` adalah berkas yang ditunjuk `label`?
 *
 * Dicocokkan per RUAS, bukan dengan endsWith mentah: `endsWith` membuat
 * "analisis-buku.md" cocok dengan "analisis-buku-dalam.md" terbalik, dan lebih
 * buruk lagi membuat "buku.md" cocok dengan "analisis-buku.md".
 */
export function cocokJalur(jalur: string, label: string): boolean {
  const a = ruas(jalur);
  const b = ruas(label);
  if (b.length === 0 || b.length > a.length) return false;
  return b.every((ruasLabel, i) => a[a.length - b.length + i] === ruasLabel);
}

/**
 * Ruas terakhir sebuah jalur — cadangan saat daftar korpus tak terbaca.
 *
 * Bukan pengganti label unik, tapi jauh lebih baik daripada tidak menyebut
 * sumber sama sekali: pencarian yang sudah berhasil tidak boleh kehilangan
 * daftar sumbernya cuma karena daftar berkas gagal dibaca sesudahnya.
 */
export function namaAkhir(jalur: string): string {
  const r = ruas(jalur);
  return r.length > 0 ? r[r.length - 1] : jalur;
}
