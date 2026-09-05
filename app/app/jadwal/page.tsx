"use client";

/**
 * Tugas terjadwal.
 *
 * Gagasannya dari Antigravity ("Scheduled Tasks" di sidebar), tapi datanya
 * nyata: cron OpenClaw yang benar-benar berjalan di mesin ini tiap hari.
 *
 * Yang ditonjolkan bukan daftar jadwalnya, melainkan KAPAN BERIKUTNYA dan
 * APAKAH YANG TERAKHIR BERHASIL. Itu dua pertanyaan yang benar-benar dibawa
 * orang saat membuka halaman seperti ini.
 */

import { useEffect, useState } from "react";
import type { TugasTerjadwal } from "@/lib/jadwal";
import { berbedaDariAsli, jadwalManusiawi } from "@/lib/jadwal-bahasa";
import { IkonPeringatan } from "@/components/Ikon";

function jam(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function selisih(ms: number | null): string {
  if (!ms) return "";
  const detik = Math.round((ms - Date.now()) / 1000);
  const lampau = detik < 0;
  const d = Math.abs(detik);
  const teks =
    d < 90
      ? `${d} detik`
      : d < 5400
        ? `${Math.round(d / 60)} menit`
        : d < 172800
          ? `${Math.round(d / 3600)} jam`
          : `${Math.round(d / 86400)} hari`;
  return lampau ? `${teks} lalu` : `${teks} lagi`;
}

export default function HalamanJadwal() {
  const [tugas, setTugas] = useState<TugasTerjadwal[]>([]);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let dibatalkan = false;
    fetch("/api/jadwal")
      .then((r) => r.json())
      .then((d: { tugas: TugasTerjadwal[]; pesan?: string }) => {
        if (dibatalkan) return;
        setTugas(d.tugas ?? []);
        if (d.pesan) setPesan(d.pesan);
      })
      .catch((e) => {
        if (!dibatalkan) setPesan(`Gagal memuat jadwal: ${(e as Error).message}`);
      })
      .finally(() => {
        if (!dibatalkan) setMemuat(false);
      });
    return () => {
      dibatalkan = true;
    };
  }, []);

  const aktif = tugas.filter((t) => t.aktif);
  const mati = tugas.filter((t) => !t.aktif);

  return (
    <div className="h-screen overflow-y-auto" style={{ background: "var(--latar-tiburon)" }}>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1
          className="mb-1 text-[30px] leading-tight"
          style={{ color: "var(--shell)", fontFamily: "var(--font-serif)" }}
        >
          Tugas terjadwal
        </h1>
        <p className="mb-8 text-[13px]" style={{ color: "var(--redup)" }}>
          Dijalankan OpenClaw di latar belakang, bahkan saat Tiburon tidak dibuka.
        </p>

        {pesan && (
          <div
            role="alert"
            className="mb-6 rounded-[var(--radius)] border px-4 py-3 text-[13px]"
            style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
          >
            <IkonPeringatan ukuran={13} className="mr-1 inline-block align-[-2px]" />
          {pesan}
          </div>
        )}

        {memuat && (
          <p className="text-[13px]" style={{ color: "var(--redup)" }}>
            Membaca jadwal…
          </p>
        )}

        {!memuat && tugas.length === 0 && !pesan && (
          <p className="text-[13px]" style={{ color: "var(--redup)" }}>
            Belum ada tugas terjadwal.
          </p>
        )}

        <div className="space-y-3">
          {aktif.map((t) => {
            const gagal = t.statusTerakhir === "error" || t.galatBerturut > 0;
            return (
              <article
                key={t.id}
                className="naik rounded-[var(--radius)] border p-4"
                style={{
                  borderColor: gagal ? "var(--danger)" : "var(--garis)",
                  boxShadow: gagal ? "var(--pendar-bahaya)" : undefined,
                }}
              >
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px]" style={{ color: "var(--shell)" }}>
                    {t.nama}
                  </h2>
                  <span
                    className="angka shrink-0 text-[12px]"
                    style={{ color: gagal ? "var(--danger)" : "var(--surface)" }}
                  >
                    {jam(t.jalanBerikutMs)}
                  </span>
                </div>

                {t.keterangan && (
                  <p className="mb-3 text-[12px]" style={{ color: "var(--redup)" }}>
                    {t.keterangan}
                  </p>
                )}

                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-4">
                  <div>
                    <dt style={{ color: "var(--redup)" }}>Berikutnya</dt>
                    <dd className="angka" style={{ color: "var(--shell)" }}>
                      {selisih(t.jalanBerikutMs) || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--redup)" }}>Terakhir jalan</dt>
                    <dd className="angka" style={{ color: "var(--shell)" }}>
                      {selisih(t.jalanTerakhirMs) || "belum pernah"}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--redup)" }}>Hasil</dt>
                    <dd style={{ color: gagal ? "var(--danger)" : "var(--shell)" }}>
                      {t.statusTerakhir === "ok"
                        ? "berhasil"
                        : t.statusTerakhir === "error"
                          ? `gagal ${t.galatBerturut}×`
                          : (t.statusTerakhir ?? "—")}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--redup)" }}>Jadwal</dt>
                    {/* Terjemahannya di depan, ekspresi aslinya tetap ada di
                        tooltip. Jadwal justru diperiksa orang saat curiga ada
                        yang salah, jadi bentuk mentahnya tidak boleh hilang —
                        cuma tidak perlu jadi yang pertama dibaca. */}
                    <dd
                      className="truncate"
                      style={{ color: "var(--shell)" }}
                      title={berbedaDariAsli(t.jadwal) ? t.jadwal : undefined}
                    >
                      {jadwalManusiawi(t.jadwal) || "—"}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>

        {mati.length > 0 && (
          <>
            <h2 className="mb-2 mt-8 text-[12px]" style={{ color: "var(--redup)" }}>
              Dinonaktifkan
            </h2>
            <div className="space-y-1">
              {mati.map((t) => (
                <div
                  key={t.id}
                  className="flex items-baseline justify-between rounded-[var(--radius-kecil)] px-3 py-2 text-[13px]"
                  style={{ color: "var(--redup)" }}
                >
                  <span>{t.nama}</span>
                  <span
                    className="text-[12px]"
                    title={berbedaDariAsli(t.jadwal) ? t.jadwal : undefined}
                  >
                    {jadwalManusiawi(t.jadwal)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
