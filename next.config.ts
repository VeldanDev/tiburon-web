import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Indikator dev Next.js dipindah dari pojok kiri-bawah.
   *
   * Di sana ia duduk PERSIS di atas avatar baris akun, dan sejak baris itu
   * jadi tombol menu, tombol bundar N miliknya menutupi sasaran klik yang
   * sesungguhnya. Terbukti bukan ulah ekstensi: direproduksi di Chrome
   * dengan profil kosong.
   *
   * Dipindah, bukan dimatikan: overlay galatnya tetap berguna, dan pojok
   * kanan-bawah kosong karena komposer terpusat pada lebar maksimum 3xl.
   */
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
