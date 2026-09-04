"use client";

/**
 * Jalur bawaan untuk obrolan baru.
 *
 * Toggle di puncak sidebar dulunya kontrol mati: warnanya berganti, lalu
 * nilainya tidak dibaca di mana pun. Kontrol paling menonjol di seluruh
 * aplikasi yang tidak melakukan apa-apa adalah cacat yang sama seperti angka
 * yang selalu kosong — ia terbaca sebagai aplikasi rusak.
 *
 * Sekarang ia menyetel jalur AWAL tiap obrolan baru. Pemilih jalur di komposer
 * tetap berkuasa per pesan; yang disetel di sini cuma titik mulainya.
 *
 * Disimpan di localStorage, bukan di basis data. Sama seperti tema: ini
 * preferensi perangkat, bukan milik pengguna. Laptop yang dipakai bekerja dan
 * HP yang dipakai bertanya cepat pantas mulai di kedalaman yang berbeda.
 */

import { createContext, useContext, useEffect, useState } from "react";
import type { Jalur } from "@/components/chat/PemilihJalur";

const KUNCI = "tiburon-jalur-awal";

/**
 * Toggle-nya BINER, jalurnya ada empat.
 *
 * "Obrolan" berarti cepat, "Kode" berarti kode. Tiburon dan Agen sengaja tidak
 * bisa dijadikan bawaan dari sini: keduanya membakar kuota jauh lebih cepat,
 * dan bawaan yang mahal adalah bawaan yang menghabiskan kuota seseorang tanpa
 * ia pernah memilihnya. Keduanya tetap satu klik jauhnya di komposer.
 */
export type Mode = "obrolan" | "kode";

export function modeDari(jalur: Jalur): Mode {
  return jalur === "kode" ? "kode" : "obrolan";
}

function jalurDari(mode: Mode): Jalur {
  return mode === "kode" ? "kode" : "cepat";
}

type Isi = {
  jalurAwal: Jalur;
  /** false sampai localStorage terbaca. Sebelum itu tidak ada yang boleh dianggap final. */
  siap: boolean;
  setMode: (m: Mode) => void;
};

const Konteks = createContext<Isi>({ jalurAwal: "cepat", siap: false, setMode: () => {} });

export function PenyediaJalurAwal({ children }: { children: React.ReactNode }) {
  const [jalurAwal, setJalurAwal] = useState<Jalur>("cepat");
  const [siap, setSiap] = useState(false);

  // Dibaca di useEffect, BUKAN saat inisialisasi state: localStorage tidak ada
  // di server, dan membacanya saat render membuat markup server dan klien
  // berbeda — persis galat hidrasi yang baru saja kita telusuri.
  useEffect(() => {
    try {
      const tersimpan = localStorage.getItem(KUNCI);
      if (tersimpan === "kode" || tersimpan === "cepat") setJalurAwal(tersimpan);
    } catch {
      // Penyimpanan ditolak (mode privat, setelan situs). Bawaannya tetap
      // cepat, dan itu pilihan yang benar untuk keraguan: paling hemat kuota.
    }
    setSiap(true);
  }, []);

  function setMode(m: Mode) {
    const j = jalurDari(m);
    setJalurAwal(j);
    try {
      localStorage.setItem(KUNCI, j);
    } catch {
      // Pilihannya tetap berlaku untuk sesi ini; yang hilang cuma ingatannya.
    }
  }

  return <Konteks.Provider value={{ jalurAwal, siap, setMode }}>{children}</Konteks.Provider>;
}

export function useJalurAwal(): Isi {
  return useContext(Konteks);
}
