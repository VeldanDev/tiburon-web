/**
 * Kelas wadah gulir aplikasi.
 *
 * Ada sebagai tetapan bernama, bukan ditulis langsung di layout.tsx, karena
 * kedua kata di dalamnya menahan bug yang akibatnya sama sekali tidak
 * terlihat seperti sebabnya:
 *
 *   overflow-y-auto  tanpa ini, halaman yang lebih tinggi dari layar membuat
 *                    SELURUH DOKUMEN menggulir — sidebar ikut tersapu keluar
 *                    layar. Terukur di Chrome: halaman Radar menyeretnya
 *                    7.174 piksel, papan desain 3.181.
 *
 *   relative         `position: absolute` tanpa leluhur berposisi memakai
 *                    DOKUMEN sebagai blok penampungnya, jadi ia lolos dari
 *                    kliping overflow di atas. Satu <span class="sr-only">
 *                    selebar 1 piksel memanjangkan dokumen 1.030 piksel
 *                    lewat celah itu.
 *
 * Uji di tests/gulir-kerangka.test.ts menjaga tetapan INI, bukan teks
 * layout.tsx — uji yang membaca berkas sumber menguji bentuk kode, bukan
 * perilaku, dan gagal setiap kali kodenya dirapikan.
 */
export const KELAS_WADAH_GULIR = "relative min-w-0 flex-1 overflow-y-auto";
