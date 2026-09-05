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
import { HARI_PETA, RENTANG, type Statistik } from "@/lib/statistik-bentuk";

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

/**
 * Batang mendatar per model.
 *
 * Diskalakan terhadap yang TERBANYAK, bukan terhadap total. Yang ditanyakan
 * orang pada daftar seperti ini adalah "mana yang paling sering", dan skala
 * relatif menjawabnya dalam sekali lihat; skala terhadap total membuat semua
 * batang pendek begitu modelnya lebih dari dua.
 */
function BatangModel({ daftar }: { daftar: Statistik["modelTeratas"] }) {
  const puncak = Math.max(1, ...daftar.map((m) => m.jumlah));
  return (
    <div className="space-y-1.5">
      {daftar.map((m) => (
        <div key={m.nama} className="flex items-center gap-2.5">
          {/* Nama model panjang dan penuh garis miring. Dipotong dari KIRI
              lewat direction rtl akan mengacak tanda bacanya, jadi dipotong
              biasa: bagian penting nama model ada di depan. */}
          <span
            className="min-w-0 flex-1 truncate text-[12px]"
            title={m.nama}
            style={{ color: "var(--teks-kedua)" }}
          >
            {m.nama}
          </span>
          <span
            aria-hidden
            className="h-[6px] w-[84px] shrink-0 overflow-hidden rounded-full"
            style={{ background: "var(--sorot-lemah)" }}
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(6, (m.jumlah / puncak) * 100)}%`,
                background: "var(--surface)",
              }}
            />
          </span>
          <span
            className="angka w-[42px] shrink-0 text-right text-[11px]"
            style={{ color: "var(--teks-redup)" }}
          >
            {ringkas(m.jumlah)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function KartuStatistik() {
  const [data, setData] = useState<Data | null>(null);
  const [hari, setHari] = useState(HARI_PETA);

  useEffect(() => {
    let batal = false;
    fetch(`/api/statistik?hari=${hari}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !batal && d && setData(d))
      // Gagal dibiarkan DIAM: ini keterangan tambahan di layar pembuka, dan
      // spanduk galat karenanya akan menutupi hal pertama yang dilihat
      // pengguna hanya karena hiasan gagal dimuat.
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [hari]);

  // Belum ada apa-apa untuk diringkas. Kartu berisi nol di semua kolom pada
  // pemakaian pertama terbaca seperti kegagalan, bukan seperti awal.
  //
  // Bentuknya DIPERIKSA, bukan dipercaya: rute yang membalas galat mengirim
  // { pesan } dan bukan angka, dan `data.pesan === 0` meloloskan itu -- lalu
  // ringkas() melempar di tengah render dan seluruh layar kosong ikut mati.
  // Hiasan yang gagal tidak boleh menjatuhkan halaman yang menampungnya.
  if (!data || typeof data.pesan !== "number" || data.pesan === 0) return null;
  if (!Array.isArray(data.harian) || !Array.isArray(data.modelTeratas)) return null;

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
        <Petak
          label="Rentang"
          nilai={RENTANG.find((r) => r.hari === data.hari)?.label ?? `${data.hari} hari`}
        />
      </div>

      <PetaPanas harian={data.harian} />

      {/* Pemilih rentang. Pilihannya DIPATOK, bukan angka bebas: rentang
          bebas berarti tiap nilai perlu dijaga dari negatif, nol, dan
          sepuluh juta — dan tidak ada yang ingin melihat 37 hari. */}
      <div className="mt-3 flex flex-wrap gap-1" role="radiogroup" aria-label="Rentang statistik">
        {RENTANG.map((r) => (
          <button
            key={r.hari}
            role="radio"
            aria-checked={hari === r.hari}
            onClick={() => setHari(r.hari)}
            className="rounded-full px-2.5 py-1 text-[11px] transition"
            style={
              hari === r.hari
                ? { background: "var(--lapis-2)", color: "var(--foam)" }
                : { color: "var(--teks-redup)" }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Muncul hanya setelah ada jawaban yang modelnya benar-benar tercatat.
          Blok kosong berlabel "Dijawab oleh" terbaca seperti fitur rusak, dan
          riwayat lama memang tidak punya kolom ini. */}
      {data.modelTeratas.length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--garis)" }}>
          <div className="mb-2 text-[11px]" style={{ color: "var(--teks-redup)" }}>
            Dijawab oleh
          </div>
          <BatangModel daftar={data.modelTeratas} />
          {data.jawabanTanpaModel > 0 && (
            <p className="mt-2 text-[10.5px]" style={{ color: "var(--teks-redup)" }}>
              {data.jawabanTanpaModel.toLocaleString("id-ID")} jawaban lebih lama
              tersimpan sebelum modelnya ikut dicatat, jadi tidak masuk hitungan ini.
            </p>
          )}
        </div>
      )}

      {data.pembanding && (
        <p className="mt-2 text-[11px]" style={{ color: "var(--teks-redup)" }}>
          {data.pembanding}
        </p>
      )}
    </div>
  );
}
