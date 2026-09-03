"use client";

/**
 * Kerangka aplikasi Tiburon.
 *
 * Struktur sidebar-nya mengikuti aplikasi Claude desktop, yang jadi rujukan
 * desain awal: toggle mode di paling atas, tombol "Baru" yang menonjol, daftar
 * navigasi berikon, bagian-bagian berjudul dengan aksinya sendiri, daftar
 * percakapan bertanda bulatan, lalu baris akun di paling bawah.
 *
 * Warnanya milik Tiburon — samudra, bukan warm-grey Claude.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IkonBaru,
  IkonDesain,
  IkonJadwal,
  IkonKode,
  IkonKorpus,
  IkonRadar,
  IkonSumber,
  IkonTiburon,
} from "@/components/Ikon";
import "@/styles/tokens.css";

type Mode = "obrolan" | "kode";

/**
 * Umur ringkas untuk daftar percakapan: 4m, 3j, 6h, 2b.
 *
 * Sengaja sesingkat mungkin -- ini kolom sempit di sisi kanan judul, dan
 * angkanya cuma perlu menjawab "baru atau lama", bukan waktu persis.
 *
 * Dihitung di klien saja. Daftar percakapan dimuat lewat useEffect, jadi
 * server tidak pernah merendernya -- tidak ada risiko waktu server dan klien
 * berbeda lalu memicu galat hidrasi.
 */
function umur(ms: number): string {
  const detik = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (detik < 60) return "kini";
  if (detik < 3600) return `${Math.floor(detik / 60)}m`;
  if (detik < 86400) return `${Math.floor(detik / 3600)}j`;
  if (detik < 2592000) return `${Math.floor(detik / 86400)}h`;
  return `${Math.floor(detik / 2592000)}b`;
}

const NAV = [
  { Ikon: IkonKorpus, label: "Korpus", href: "/app/korpus" },
  { Ikon: IkonRadar, label: "Radar", href: "/app/radar" },
  { Ikon: IkonSumber, label: "Riwayat sumber", href: "/app/sumber" },
  { Ikon: IkonJadwal, label: "Tugas terjadwal", href: "/app/jadwal" },
  { Ikon: IkonDesain, label: "Papan desain", href: "/app/desain" },
];

export default function LayoutAplikasi({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("obrolan");
  const [percakapan, setPercakapan] = useState<
    { id: string; judul: string; diperbarui: number }[]
  >([]);
  const jalan = usePathname();

  useEffect(() => {
    fetch("/api/percakapan")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPercakapan)
      .catch(() => setPercakapan([]));
  }, []);

  return (
    <div className="flex h-screen" style={{ background: "var(--lapis-0)" }}>
      <aside
        className="flex w-[300px] shrink-0 flex-col border-r"
        style={{
          borderColor: "var(--garis)",
          // Sidebar duduk SATU tingkat di atas kanvas, dan kabut yang sama
          // dilapiskan di atasnya supaya bagian bawahnya menggelap seperti
          // sisa layar. Tanpa itu ia terlihat seperti panel yang ditempel,
          // bukan bagian dari air yang sama.
          backgroundColor: "var(--lapis-1)",
          backgroundImage: "var(--kabut-dalam)",
        }}
      >
        {/* Toggle mode — pill tersegmen di paling atas */}
        <div className="p-3">
          <div
            className="flex rounded-[var(--radius)] p-0.5"
            style={{ background: "var(--abyss)" }}
          >
            {(["obrolan", "kode"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 rounded-[var(--radius-kecil)] px-3 py-1.5 text-[13px] transition"
                style={
                  mode === m
                    ? { background: "var(--ocean)", color: "var(--shell)" }
                    : { color: "var(--redup)" }
                }
              >
                <span className="flex items-center justify-center gap-1.5">
                  {m === "obrolan" ? <IkonTiburon ukuran={14} /> : <IkonKode ukuran={14} />}
                  {m === "obrolan" ? "Obrolan" : "Kode"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tombol Baru */}
        <div className="px-3 pb-2">
          <Link
            href="/app"
            className="tombol-baru flex items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-[14px]"
            style={{ background: "var(--hover)", color: "var(--shell)" }}
          >
            <IkonBaru ukuran={16} className="ikon-kail" />
            Obrolan baru
          </Link>
        </div>

        {/* Navigasi berikon */}
        <nav className="px-3 pb-3">
          {NAV.map((n) => {
            const aktif = jalan === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={aktif ? "page" : undefined}
                className="baris-nav relative flex items-center gap-3 rounded-[var(--radius)] py-2 pl-4 pr-3 text-[14px]"
                style={{ color: aktif ? "var(--foam)" : "var(--shell)" }}
              >
                {/* Rel kiri: penanda halaman aktif. Ia tumbuh dari tengah ke
                    atas dan bawah, bukan muncul begitu saja -- gerakan yang
                    sama seperti penanda gigi hiu di pemilih jalur. */}
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 w-[2px] -translate-y-1/2 rounded-full"
                  style={{
                    height: aktif ? "18px" : "0px",
                    background: "var(--surface)",
                    boxShadow: aktif ? "var(--pendar)" : "none",
                    transition: "height 200ms var(--keluar)",
                  }}
                />
                <n.Ikon
                  ukuran={17}
                  className={aktif ? "ikon-aktif" : undefined}
                />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Daftar percakapan */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <div
            className="flex items-center justify-between px-3 pb-1 pt-3 text-[12px]"
            style={{ color: "var(--redup)" }}
          >
            <span>Obrolan</span>
            <span className="cursor-pointer hover:brightness-150">⇅</span>
          </div>

          {percakapan.length === 0 ? (
            <p className="px-3 py-2 text-[12px]" style={{ color: "var(--redup)" }}>
              Belum ada obrolan. Mulai dari kotak di sebelah.
            </p>
          ) : (
            percakapan.map((p, i) => (
              <button
                key={p.id}
                className="group flex w-full items-center gap-2 rounded-[var(--radius)] px-3 py-1.5 text-left text-[13px] transition hover:bg-white/5"
                style={{ color: "var(--shell)" }}
                title={new Date(p.diperbarui).toLocaleString("id-ID")}
              >
                {/* Yang paling baru diberi titik hangat, sisanya cincin dingin.
                    Satu titik --hidup di kolom biru ini menjawab "mana yang
                    terakhir kusentuh" tanpa perlu membaca satu kata pun. */}
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${i === 0 ? "titik-hidup" : ""}`}
                  style={
                    i === 0
                      ? undefined
                      : { background: "transparent", border: "1px solid var(--redup)" }
                  }
                />
                <span className="min-w-0 flex-1 truncate">{p.judul}</span>
                <span
                  className="angka shrink-0 text-[11px] tabular-nums"
                  style={{ color: "var(--redup)" }}
                >
                  {umur(p.diperbarui)}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Baris akun */}
        <div
          className="flex items-center gap-2.5 border-t px-4 py-3 text-[13px]"
          style={{ borderColor: "var(--garis)" }}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] leading-none"
            style={{ background: "var(--ocean)", color: "var(--shell)" }}
          >
            V
          </span>
          {/* min-w-0 pada pembungkus: tanpa itu nama panjang mendorong
              baris melewati lebar sidebar, bukan terpotong di dalamnya. */}
          <span className="min-w-0 flex-1 truncate" style={{ color: "var(--shell)" }}>
            Veldan
          </span>
          <span className="shrink-0 text-[11px]" style={{ color: "var(--redup)" }}>
            lokal
          </span>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
