"use client";

/**
 * Pemilih tema: sistem, terang, gelap.
 *
 * Tiga keadaan, bukan dua. "Sistem" bukan pelengkap — itu pilihan yang paling
 * sering benar: orang yang menyetel laptopnya berganti gelap saat malam
 * mengharapkan aplikasinya ikut, dan sakelar dua arah memaksa mereka
 * mengubahnya sendiri dua kali sehari.
 *
 * Preferensinya disimpan di localStorage, BUKAN di basis data. Ini satu-satunya
 * pengaturan di Tiburon yang memang milik perangkat, bukan milik pengguna:
 * layar laptop di kamar gelap dan layar HP di bawah matahari menuntut jawaban
 * yang berbeda, dan menyimpannya di server justru memaksa keduanya sama.
 */

import { useEffect, useState } from "react";
import { IkonLayar, IkonMatahari, IkonBulan } from "@/components/Ikon";

export type Tema = "sistem" | "terang" | "gelap";

const KUNCI = "tiburon-tema";

/**
 * Skrip yang berjalan SEBELUM halaman digambar.
 *
 * Tanpa ini ada kedipan: server tidak tahu preferensi yang tersimpan di
 * browser, jadi ia selalu mengirim tema gelap, dan pengguna tema terang
 * melihat layar hitam sekejap di setiap pemuatan. Skrip ini menyetel atributnya
 * sebelum cat pertama, jadi tidak ada yang sempat terlihat salah.
 *
 * Ditulis sebagai string dan disuntik lewat dangerouslySetInnerHTML karena ia
 * HARUS berjalan sinkron di <head>; komponen React mana pun berjalan terlambat.
 */
export const SKRIP_TEMA = `
(function () {
  try {
    var t = localStorage.getItem(${JSON.stringify(KUNCI)}) || "sistem";
    var gelap =
      t === "gelap" ||
      (t === "sistem" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-tema", gelap ? "gelap" : "terang");
  } catch (e) {
    // localStorage bisa ditolak (mode privat, setelan situs). Gelap adalah
    // cadangan yang benar: itu tema yang dirancang lebih dulu di sini.
    document.documentElement.setAttribute("data-tema", "gelap");
  }
})();
`;

/** Terapkan pilihan ke atribut di <html>. */
function terapkan(tema: Tema) {
  const gelap =
    tema === "gelap" ||
    (tema === "sistem" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-tema", gelap ? "gelap" : "terang");
}

/**
 * Tema yang SEDANG BERLAKU — "terang" atau "gelap", bukan "sistem".
 *
 * Dipakai komponen yang harus tahu warnanya sungguhan, bukan preferensinya:
 * penyorot sintaks Shiki membangun HTML berwarna di JavaScript dan tidak bisa
 * mewarisi apa pun dari CSS.
 */
export function useTema(): "terang" | "gelap" {
  const [tema, setTema] = useState<"terang" | "gelap">("gelap");

  useEffect(() => {
    const baca = () =>
      setTema(
        document.documentElement.getAttribute("data-tema") === "terang" ? "terang" : "gelap",
      );
    baca();

    // Diamati lewat MutationObserver, bukan lewat state bersama. Atribut di
    // <html> adalah satu-satunya sumber kebenaran di sini -- ia disetel oleh
    // skrip pra-render, oleh pemilih ini, dan oleh perubahan setelan sistem.
    // Mengamati atributnya menangkap ketiganya tanpa ketiganya harus saling tahu.
    const pengamat = new MutationObserver(baca);
    pengamat.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-tema"],
    });
    return () => pengamat.disconnect();
  }, []);

  return tema;
}

const PILIHAN: { nilai: Tema; label: string; Ikon: (p: { ukuran?: number }) => React.ReactElement }[] = [
  { nilai: "sistem", label: "Ikut sistem", Ikon: IkonLayar },
  { nilai: "terang", label: "Terang", Ikon: IkonMatahari },
  { nilai: "gelap", label: "Gelap", Ikon: IkonBulan },
];

export function PemilihTema() {
  const [tema, setTema] = useState<Tema>("sistem");
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    const tersimpan = (localStorage.getItem(KUNCI) as Tema | null) ?? "sistem";
    setTema(tersimpan);
    setSiap(true);
  }, []);

  // Setelan sistem yang berubah harus langsung terlihat, TAPI hanya kalau
  // pilihannya memang "sistem". Tanpa penjaga itu, pengguna yang sengaja
  // memilih terang akan dilempar ke gelap saat laptopnya berganti malam hari.
  useEffect(() => {
    if (tema !== "sistem") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const ubah = () => terapkan("sistem");
    media.addEventListener("change", ubah);
    return () => media.removeEventListener("change", ubah);
  }, [tema]);

  function pilih(baru: Tema) {
    setTema(baru);
    try {
      localStorage.setItem(KUNCI, baru);
    } catch {
      // Penyimpanan ditolak. Temanya tetap berganti untuk sesi ini; yang
      // hilang cuma ingatannya, dan itu lebih baik daripada tombol yang
      // tidak melakukan apa-apa.
    }
    terapkan(baru);
  }

  return (
    <div
      className="flex rounded-[var(--radius-kecil)] p-0.5"
      style={{ background: "var(--lapis-0)" }}
      role="radiogroup"
      aria-label="Tampilan"
    >
      {PILIHAN.map((p) => (
        <button
          key={p.nilai}
          onClick={() => pilih(p.nilai)}
          role="radio"
          // Sebelum localStorage terbaca, TIDAK ada yang ditandai terpilih.
          // Menandai "sistem" lebih dulu membuat tombolnya berkedip pindah
          // sesaat setelah halaman dimuat, di setiap pemuatan.
          aria-checked={siap && tema === p.nilai}
          title={p.label}
          aria-label={p.label}
          className="rounded-[3px] px-2.5 py-1.5 transition"
          style={
            siap && tema === p.nilai
              ? { background: "var(--lapis-2)", color: "var(--teks-kedua)" }
              : { color: "var(--redup)" }
          }
        >
          <p.Ikon ukuran={15} />
        </button>
      ))}
    </div>
  );
}
