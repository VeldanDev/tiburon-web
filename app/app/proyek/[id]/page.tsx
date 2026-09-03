"use client";

/**
 * Satu proyek: nama, instruksi, dan percakapan di dalamnya.
 *
 * Instruksi proyek adalah alasan halaman ini ada. Pengelompokannya sendiri
 * cuma folder — yang membuatnya berharga adalah konteks yang selalu berlaku
 * untuk pekerjaan ini dan tidak berlaku untuk yang lain, sehingga tidak perlu
 * diketik ulang di setiap percakapan baru.
 */

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { IkonCentang, IkonPeringatan, IkonHapus } from "@/components/Ikon";
import type { Proyek } from "@/components/DaftarProyek";

export default function HalamanProyek({ params }: { params: Promise<{ id: string }> }) {
  // Next 16 memberikan params sebagai Promise; `use` membukanya di komponen
  // klien. Tanpa ini, params dibaca sebagai objek biasa dan selalu undefined.
  const { id } = use(params);

  const [proyek, setProyek] = useState<Proyek | null>(null);
  const [instruksi, setInstruksi] = useState("");
  const [tersimpan, setTersimpan] = useState("");
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    let batal = false;
    fetch("/api/proyek")
      .then((r) => r.json())
      .then((d: Proyek[]) => {
        if (batal) return;
        const ketemu = Array.isArray(d) ? d.find((p) => p.id === id) : undefined;
        if (!ketemu) {
          setPesan("Proyek ini tidak ada lagi.");
          return;
        }
        setProyek(ketemu);
        setInstruksi(ketemu.instruksi);
        setTersimpan(ketemu.instruksi);
      })
      .catch((e) => !batal && setPesan(`Gagal memuat: ${(e as Error).message}`))
      .finally(() => !batal && setMemuat(false));
    return () => {
      batal = true;
    };
  }, [id]);

  async function simpan() {
    setMenyimpan(true);
    try {
      const r = await fetch("/api/proyek", {
        method: "PATCH",
        body: JSON.stringify({ id, instruksi }),
      });
      if (!r.ok) throw new Error((await r.json()).pesan ?? `HTTP ${r.status}`);
      setTersimpan(instruksi);
      setPesan("");
    } catch (e) {
      setPesan(`Gagal menyimpan: ${(e as Error).message}`);
    } finally {
      setMenyimpan(false);
    }
  }

  const berubah = instruksi !== tersimpan;

  return (
    <div className="h-screen overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1
          className="mb-1 text-[30px] leading-tight"
          style={{ color: "var(--teks-utama)", fontFamily: "var(--font-serif)" }}
        >
          {proyek?.nama ?? "Proyek"}
        </h1>
        <p className="mb-8 text-[13px]" style={{ color: "var(--teks-redup)" }}>
          {proyek ? (
            <>
              <span className="angka" style={{ color: "var(--teks-kedua)" }}>
                {proyek.jumlah}
              </span>{" "}
              percakapan di proyek ini.
            </>
          ) : (
            "Memuat…"
          )}
        </p>

        {pesan && (
          <div
            role="alert"
            className="naik mb-6 rounded-[var(--radius)] border px-4 py-3 text-[13px]"
            style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
          >
            <IkonPeringatan ukuran={13} className="mr-1 inline-block align-[-2px]" />
            {pesan}
          </div>
        )}

        {!memuat && proyek && (
          <>
            <h2 className="mb-1 text-[15px]" style={{ color: "var(--teks-utama)" }}>
              Instruksi proyek
            </h2>
            <p className="mb-3 text-[12px]" style={{ color: "var(--teks-redup)" }}>
              Konteks yang berlaku untuk setiap percakapan di proyek ini, dan
              tidak untuk yang lain. Contoh: “Radar itu skrip Python di
              D:\Downloads\Tiburon\radar; sumbernya 10 RSS feed.”
            </p>
            <textarea
              value={instruksi}
              onChange={(e) => setInstruksi(e.target.value.slice(0, 4000))}
              rows={10}
              aria-label="Instruksi proyek"
              placeholder="Kosongkan kalau proyek ini cuma pengelompokan."
              className="w-full resize-y rounded-[var(--radius)] border px-3.5 py-2.5 text-[13px] leading-[1.7] outline-none"
              style={{
                borderColor: "var(--garis)",
                background: "var(--lapis-0)",
                color: "var(--teks-utama)",
              }}
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => void simpan()}
                disabled={!berubah || menyimpan}
                className="rounded-[var(--radius-kecil)] px-3 py-1.5 text-[12px] transition disabled:opacity-30"
                style={{ background: "var(--surface)", color: "var(--abyss)" }}
              >
                {menyimpan ? "menyimpan…" : "Simpan"}
              </button>
              {!berubah && !menyimpan && (
                <span
                  className="flex items-center gap-1.5 text-[11px]"
                  style={{ color: "var(--teks-redup)" }}
                >
                  <IkonCentang ukuran={11} />
                  tersimpan
                </span>
              )}
              <span
                className="angka ml-auto text-[11px]"
                style={{ color: "var(--teks-redup)" }}
              >
                {instruksi.length}/4000
              </span>
            </div>

            <div
              className="mt-10 border-t pt-4"
              style={{ borderColor: "var(--garis)" }}
            >
              <Link
                href="/app"
                className="text-[12px] underline"
                style={{ color: "var(--surface)" }}
              >
                Kembali ke obrolan
              </Link>
              {/* Menghapus proyek TIDAK menghapus percakapannya -- itu
                  disebutkan di sini, sebelum tombolnya ditekan, bukan
                  ditemukan sesudahnya. */}
              <button
                onClick={async () => {
                  if (!confirm(`Hapus proyek "${proyek.nama}"? Percakapannya tetap ada.`)) return;
                  await fetch(`/api/proyek?id=${encodeURIComponent(id)}`, { method: "DELETE" });
                  window.location.href = "/app";
                }}
                className="aksi-pesan ml-4 inline-flex items-center gap-1.5 rounded-[var(--radius-kecil)] px-2 py-1 text-[12px]"
                style={{ color: "var(--danger)" }}
              >
                <IkonHapus ukuran={12} />
                Hapus proyek
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
