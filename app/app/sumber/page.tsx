"use client";

/**
 * Riwayat sumber — berkas korpus mana yang benar-benar pernah menjawab.
 *
 * Halaman ini menjawab pertanyaan yang tidak bisa dijawab dari mana pun lagi:
 * dari 164 berkas yang dikumpulkan bertahun-tahun, mana yang benar-benar
 * terpakai, dan mana yang cuma menumpuk?
 *
 * Bagian "belum pernah menjawab" sengaja ditampilkan sama menonjolnya dengan
 * yang sering dipakai. Itu bukan daftar kegagalan — itu peta antara materi
 * yang dikira berguna dan materi yang ternyata memang dipakai.
 */

import { useEffect, useState } from "react";

type Terpakai = { berkas: string; jumlah: number; terakhirMs: number; contohKueri: string };
type Belum = { berkas: string; potongan: number };

function umur(ms: number): string {
  const d = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (d < 60) return "baru saja";
  if (d < 3600) return `${Math.floor(d / 60)} menit lalu`;
  if (d < 86400) return `${Math.floor(d / 3600)} jam lalu`;
  return `${Math.floor(d / 86400)} hari lalu`;
}

export default function HalamanSumber() {
  const [terpakai, setTerpakai] = useState<Terpakai[]>([]);
  const [belum, setBelum] = useState<Belum[]>([]);
  const [total, setTotal] = useState(0);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let batal = false;
    fetch("/api/sumber")
      .then((r) => r.json())
      .then((d) => {
        if (batal) return;
        setTerpakai(d.terpakai ?? []);
        setBelum(d.belum ?? []);
        setTotal(d.totalKorpus ?? 0);
        if (d.pesan) setPesan(d.pesan);
      })
      .catch((e) => !batal && setPesan(`Gagal memuat: ${(e as Error).message}`))
      .finally(() => !batal && setMemuat(false));
    return () => {
      batal = true;
    };
  }, []);

  const puncak = terpakai[0]?.jumlah ?? 1;

  return (
    <div className="h-screen overflow-y-auto" style={{ background: "var(--latar-tiburon)" }}>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1
          className="mb-1 text-[30px] leading-tight"
          style={{ color: "var(--shell)", fontFamily: "var(--font-serif)" }}
        >
          Riwayat sumber
        </h1>
        <p className="mb-8 text-[13px]" style={{ color: "var(--redup)" }}>
          {total > 0 ? (
            <>
              <span className="angka" style={{ color: "var(--surface)" }}>
                {terpakai.length}
              </span>{" "}
              dari <span className="angka">{total}</span> berkas korpus pernah menjawabmu.
            </>
          ) : (
            "Berkas korpus mana yang benar-benar terpakai."
          )}
        </p>

        {pesan && (
          <div
            role="alert"
            className="mb-6 rounded-[var(--radius)] border px-4 py-3 text-[13px]"
            style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
          >
            ⚠ {pesan}
          </div>
        )}

        {memuat && (
          <p className="text-[13px]" style={{ color: "var(--redup)" }}>
            Membaca riwayat…
          </p>
        )}

        {!memuat && terpakai.length === 0 && !pesan && (
          <p className="text-[13px]" style={{ color: "var(--redup)" }}>
            Belum ada sumber yang tercatat. Tanyakan sesuatu di jalur 🦈 Tiburon,
            dan berkas yang menjawabnya akan muncul di sini.
          </p>
        )}

        <div className="space-y-3">
          {terpakai.map((t) => (
            <article key={t.berkas} className="naik">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h2 className="min-w-0 truncate text-[14px]" style={{ color: "var(--shell)" }}>
                  {t.berkas}
                </h2>
                <span className="angka shrink-0 text-[12px]" style={{ color: "var(--surface)" }}>
                  {t.jumlah}×
                </span>
              </div>

              {/* Bar proporsional. Panjangnya relatif terhadap berkas paling
                  sering dipakai, bukan terhadap total -- yang ingin dilihat
                  adalah peringkat, bukan persentase. */}
              <div className="mb-1 h-[3px] w-full overflow-hidden rounded-full" style={{ background: "var(--garis)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, (t.jumlah / puncak) * 100)}%`,
                    background: "var(--surface)",
                    boxShadow: "var(--pendar)",
                  }}
                />
              </div>

              <p className="truncate text-[12px]" style={{ color: "var(--redup)" }}>
                {umur(t.terakhirMs)} — “{t.contohKueri}”
              </p>
            </article>
          ))}
        </div>

        {belum.length > 0 && (
          <>
            <h2 className="mb-1 mt-10 text-[14px]" style={{ color: "var(--shell)" }}>
              Belum pernah menjawab
            </h2>
            <p className="mb-3 text-[12px]" style={{ color: "var(--redup)" }}>
              {belum.length} berkas terindeks tapi belum pernah muncul sebagai sumber.
              Bukan berarti tidak berguna — mungkin kamu belum menanyakan bidangnya.
            </p>
            <div className="space-y-1">
              {belum.map((b) => (
                <div
                  key={b.berkas}
                  className="flex items-baseline justify-between gap-3 rounded-[var(--radius-kecil)] px-3 py-1.5 text-[12px]"
                  style={{ color: "var(--redup)" }}
                >
                  <span className="min-w-0 truncate">{b.berkas}</span>
                  <span className="angka shrink-0">{b.potongan} potongan</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
