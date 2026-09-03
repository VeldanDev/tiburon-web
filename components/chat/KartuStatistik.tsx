"use client";

/**
 * Kartu statistik pemakaian di layar kosong.
 *
 * Menggantikan ruang yang sebelumnya diisi chip saran generik. Bedanya bukan
 * hiasan: chip saran memberitahumu apa yang BISA kamu tanyakan, kartu ini
 * memberitahumu apa yang SUDAH kamu kerjakan — dan yang kedua adalah satu-
 * satunya dari keduanya yang tidak bisa ditebak siapa pun kecuali aplikasi ini.
 *
 * Semua angkanya dihitung dari riwayat yang sudah ada; tidak ada pencatatan
 * tambahan dan tidak ada tabel baru. Lihat lib/statistik.ts.
 */

import { useEffect, useState } from "react";
import { HARI_PETA, type Statistik } from "@/lib/statistik-bentuk";

type Data = Statistik & { pembanding: string | null };

function ringkas(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}J`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")}rb`;
  return n.toLocaleString("id-ID");
}

function Petak({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div
      className="rounded-[var(--radius-kecil)] px-3 py-2"
      style={{ background: "var(--sorot-lemah)" }}
    >
      <div className="text-[11px]" style={{ color: "var(--teks-redup)" }}>
        {label}
      </div>
      <div className="angka text-[17px]" style={{ color: "var(--teks-utama)" }}>
        {nilai}
      </div>
    </div>
  );
}

/**
 * Peta panas 12 minggu.
 *
 * Empat tingkat, bukan gradasi mulus. Mata tidak bisa membedakan 40% dari 45%
 * opasitas, tapi bisa langsung melihat empat tingkat berbeda — dan yang
 * ditanyakan orang pada peta seperti ini adalah "hari mana yang ramai", bukan
 * "tepatnya berapa".
 */
function PetaPanas({ harian }: { harian: Statistik["harian"] }) {
  const puncak = Math.max(1, ...harian.map((h) => h.jumlah));

  // Kolom = minggu, baris = hari dalam minggu. Diisi per kolom supaya kisinya
  // terbaca sebagai kalender, bukan sebagai deretan panjang.
  const minggu: Statistik["harian"][] = [];
  for (let i = 0; i < harian.length; i += 7) minggu.push(harian.slice(i, i + 7));

  return (
    <div className="flex gap-[3px] overflow-x-auto pb-1">
      {minggu.map((m, i) => (
        <div key={i} className="flex shrink-0 flex-col gap-[3px]">
          {m.map((h) => {
            const rasio = h.jumlah / puncak;
            const tingkat =
              h.jumlah === 0 ? 0 : rasio > 0.66 ? 3 : rasio > 0.33 ? 2 : 1;
            return (
              <span
                key={h.tanggal}
                title={`${h.tanggal}: ${h.jumlah} pesan`}
                className="h-[9px] w-[9px] rounded-[2px]"
                style={{
                  background:
                    tingkat === 0
                      ? "var(--sorot-lemah)"
                      : `color-mix(in oklab, var(--surface) ${tingkat * 33}%, transparent)`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function KartuStatistik() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let batal = false;
    fetch("/api/statistik")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !batal && d && setData(d))
      // Gagal dibiarkan DIAM: ini keterangan tambahan di layar pembuka, dan
      // spanduk galat karenanya akan menutupi hal pertama yang dilihat
      // pengguna hanya karena hiasan gagal dimuat.
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, []);

  // Belum ada apa-apa untuk diringkas. Kartu berisi nol di semua kolom pada
  // pemakaian pertama terbaca seperti kegagalan, bukan seperti awal.
  if (!data || data.pesan === 0) return null;

  const jam =
    data.jamPuncak === null ? "—" : `${String(data.jamPuncak).padStart(2, "0")}.00`;

  return (
    <div
      className="naik rounded-[var(--radius-besar)] border p-4"
      style={{ borderColor: "var(--garis)", background: "var(--lapis-1)" }}
    >
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Petak label="Obrolan" nilai={ringkas(data.percakapan)} />
        <Petak label="Pesan" nilai={ringkas(data.pesan)} />
        <Petak label="Token (taksiran)" nilai={ringkas(data.token)} />
        <Petak label="Hari aktif" nilai={ringkas(data.hariAktif)} />
        <Petak label="Streak saat ini" nilai={`${data.streakSaatIni}h`} />
        <Petak label="Streak terpanjang" nilai={`${data.streakTerpanjang}h`} />
        <Petak label="Jam puncak" nilai={jam} />
        <Petak label="Rentang" nilai={`${HARI_PETA / 7} minggu`} />
      </div>

      <PetaPanas harian={data.harian} />

      {data.pembanding && (
        <p className="mt-2 text-[11px]" style={{ color: "var(--teks-redup)" }}>
          {data.pembanding}
        </p>
      )}
    </div>
  );
}
