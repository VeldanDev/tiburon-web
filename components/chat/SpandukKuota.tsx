"use client";

/**
 * Spanduk kuota.
 *
 * Muncul saat SELURUH rantai model gagal. Isinya bukan "terjadi kesalahan"
 * melainkan: model mana saja yang dicoba, kenapa masing-masing gagal, dan
 * kapan kuotanya pulih.
 *
 * Ini menjawab masalah yang benar-benar terjadi tiap hari di mesin ini:
 * kuota gratis habis, lalu pesan galat mentah dari penyedia tidak memberi
 * tahu apa pun yang berguna. Waktu pulihnya bukan tebakan --
 *
 *   Google      kuota harian reset tengah malam Pacific = 14:00 WIB
 *   OpenRouter  kuota harian reset tengah malam UTC     = 07:00 WIB
 *
 * Keduanya diverifikasi dari perilaku nyata pada 2026-09-02/03.
 */

type Pulih = { nama: string; jam: string; keterangan: string };

const PULIH: Pulih[] = [
  { nama: "Google", jam: "14:00", keterangan: "tengah malam Pasifik" },
  { nama: "OpenRouter", jam: "07:00", keterangan: "tengah malam UTC" },
];

function jamTerdekat(): Pulih {
  const sekarang = new Date();
  const menitSekarang = sekarang.getHours() * 60 + sekarang.getMinutes();
  const berjarak = PULIH.map((p) => {
    const [j, m] = p.jam.split(":").map(Number);
    let selisih = j * 60 + m - menitSekarang;
    if (selisih <= 0) selisih += 24 * 60;
    return { p, selisih };
  }).sort((a, b) => a.selisih - b.selisih);
  return berjarak[0].p;
}

export function SpandukKuota({
  pesan,
  onTutup,
}: {
  pesan: string;
  onTutup: () => void;
}) {
  const berikut = jamTerdekat();

  // Pesan gagal berbentuk "Semua model gagal — a: HTTP 429; b: HTTP 429".
  // Dipecah supaya tiap model jadi barisnya sendiri, bukan satu kalimat
  // panjang yang harus dibaca dua kali.
  const bagian = pesan.split("—").slice(1).join("—").trim();
  const daftar = bagian ? bagian.split(";").map((s) => s.trim()).filter(Boolean) : [];

  return (
    <div
      role="alert"
      className="naik mb-6 rounded-[var(--radius-besar)] border p-4"
      style={{ borderColor: "var(--warn)", background: "var(--hover)" }}
    >
      <div className="mb-1 flex items-center gap-2 text-[14px]" style={{ color: "var(--warn)" }}>
        <span aria-hidden>◷</span>
        Kuota model habis
      </div>

      {daftar.length > 0 ? (
        <ul className="mb-3 space-y-0.5 text-[13px]" style={{ color: "var(--shell)" }}>
          {daftar.map((d) => (
            <li key={d} className="flex gap-2">
              <span style={{ color: "var(--redup)" }}>·</span>
              {d}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-[13px]" style={{ color: "var(--shell)" }}>
          {pesan}
        </p>
      )}

      <p className="mb-3 text-[13px]" style={{ color: "var(--redup)" }}>
        Kuota berikutnya pulih pukul{" "}
        <span className="angka" style={{ color: "var(--surface)" }}>
          {berikut.jam} WIB
        </span>{" "}
        — {berikut.nama}, {berikut.keterangan}.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onTutup}
          className="rounded-[var(--radius)] px-3 py-1.5 text-[13px] transition hover:brightness-125"
          style={{ background: "var(--ocean)", color: "var(--shell)" }}
        >
          Tutup
        </button>
        <a
          href="https://openrouter.ai/settings/keys"
          target="_blank"
          rel="noreferrer"
          className="rounded-[var(--radius)] border px-3 py-1.5 text-[13px] transition hover:brightness-125"
          style={{ borderColor: "var(--garis)", color: "var(--redup)" }}
        >
          Kelola kunci OpenRouter
        </a>
      </div>
    </div>
  );
}
