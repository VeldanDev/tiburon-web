import { redirect } from "next/navigation";

// Tiburon satu pengguna, satu mesin -- tidak ada yang perlu dijual di sini.
// "/" bukan halaman, ia cuma alamat sebelum masuk ke aplikasi sesungguhnya.
export default function Beranda() {
  redirect("/app");
}
