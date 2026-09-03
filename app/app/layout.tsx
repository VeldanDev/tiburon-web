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
import "@/styles/tokens.css";

type Mode = "obrolan" | "kode";

const NAV = [
  { ikon: "🗂", label: "Korpus", href: "/app/korpus" },
  { ikon: "📡", label: "Radar", href: "/app/radar" },
  { ikon: "◷", label: "Tugas terjadwal", href: "/app/jadwal" },
  { ikon: "🎨", label: "Papan desain", href: "/app/desain" },
];

export default function LayoutAplikasi({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("obrolan");
  const [percakapan, setPercakapan] = useState<{ id: string; judul: string }[]>([]);
  const jalan = usePathname();

  useEffect(() => {
    fetch("/api/percakapan")
      .then((r) => (r.ok ? r.json() : []))
      .then(setPercakapan)
      .catch(() => setPercakapan([]));
  }, []);

  return (
    <div className="flex h-screen" style={{ background: "var(--abyss)" }}>
      <aside
        className="flex w-[300px] shrink-0 flex-col border-r"
        style={{ borderColor: "var(--garis)", background: "var(--deep)" }}
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
                {m === "obrolan" ? "🦈 Obrolan" : "⌘ Kode"}
              </button>
            ))}
          </div>
        </div>

        {/* Tombol Baru */}
        <div className="px-3 pb-2">
          <Link
            href="/app"
            className="flex items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-[14px] transition hover:brightness-125"
            style={{ background: "var(--hover)", color: "var(--shell)" }}
          >
            <span style={{ color: "var(--surface)" }}>+</span> Baru
          </Link>
        </div>

        {/* Navigasi berikon */}
        <nav className="px-3 pb-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-[14px] transition hover:bg-white/5"
              style={{ color: jalan === n.href ? "var(--surface)" : "var(--shell)" }}
            >
              <span className="w-4 text-center">{n.ikon}</span>
              {n.label}
            </Link>
          ))}
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
                className="flex w-full items-center gap-2 rounded-[var(--radius)] px-3 py-1.5 text-left text-[13px] transition hover:bg-white/5"
                style={{ color: "var(--shell)" }}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: i === 0 ? "var(--surface)" : "transparent",
                    border: i === 0 ? "none" : "1px solid var(--redup)",
                  }}
                />
                <span className="truncate">{p.judul}</span>
              </button>
            ))
          )}
        </div>

        {/* Baris akun */}
        <div
          className="flex items-center gap-2 border-t px-4 py-3 text-[13px]"
          style={{ borderColor: "var(--garis)" }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px]"
            style={{ background: "var(--ocean)", color: "var(--shell)" }}
          >
            V
          </span>
          <span style={{ color: "var(--shell)" }}>Veldan</span>
          <span style={{ color: "var(--redup)" }}>· lokal</span>
          <span className="ml-auto" style={{ color: "var(--redup)" }}>
            ⌄
          </span>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
