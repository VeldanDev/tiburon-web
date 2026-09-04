/**
 * Daftar bagian halaman pengaturan.
 *
 * Dipisah ke sini karena DUA tempat menunjuk ke bagian yang sama: halaman
 * pengaturan yang membacanya dari URL, dan menu akun yang menautkan ke sana.
 * Kalau keduanya menuliskan sendiri string-nya, salah satu bisa berubah tanpa
 * yang lain ikut — dan tautan yang salah TIDAK gagal dengan berisik di sini,
 * ia diam-diam jatuh ke bagian pertama. Pengguna cuma melihat menu yang
 * membuka halaman yang salah, tanpa satu pun pesan galat.
 *
 * Dengan `jalurBagian()` yang bertipe, salah ketik jadi galat kompilasi.
 */

export const ID_BAGIAN = ["tampilan", "instruksi", "ingatan", "pintasan", "tentang"] as const;

export type IdBagian = (typeof ID_BAGIAN)[number];

/**
 * Nilai dari URL, disaring jadi bagian yang benar-benar ada.
 *
 * Cadangannya "tampilan" — bagian yang tidak menunggu apa pun dari server,
 * jadi URL yang rusak tetap membuka sesuatu yang langsung bisa dipakai.
 */
export function sahihBagian(nilai: string | null): IdBagian {
  return (ID_BAGIAN as readonly string[]).includes(nilai ?? "") ? (nilai as IdBagian) : "tampilan";
}

export function jalurBagian(id: IdBagian): string {
  return `/app/pengaturan?bagian=${id}`;
}
