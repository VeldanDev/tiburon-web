"use client";

/**
 * Halaman masuk — satu kolom sandi, tidak lebih.
 *
 * Sengaja tidak ada "daftar", "lupa sandi", atau "ingat saya". Tiburon dipakai
 * satu orang atau satu kantor kecil: pendaftaran tidak ada gunanya, pemulihan
 * sandi lewat surel butuh surel yang tidak dipasang, dan "ingat saya" adalah
 * pilihan palsu — kukinya memang sudah berumur 30 hari.
 *
 * Yang PENTING di sini justru bagian yang tidak terlihat: halaman ini satu-
 * satunya yang dikecualikan dari gerbang. Kalau ia ikut dijaga, ia jadi pintu
 * yang terkunci dari dalam.
 */

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TandaTiburon } from "@/components/TandaTiburon";

function Formulir() {
  const [sandi, setSandi] = useState("");
  const [galat, setGalat] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!sandi || mengirim) return;
    setMengirim(true);
    setGalat(null);
    try {
      const r = await fetch("/api/masuk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sandi }),
      });
      if (r.ok) {
        // Alamat tujuan hanya diterima kalau ia jalur DI DALAM aplikasi ini.
        // Tanpa pemeriksaan itu, `?lanjut=https://situs-lain` mengubah halaman
        // masuk sendiri jadi papan lompat ke mana pun.
        const lanjut = params.get("lanjut");
        const aman = lanjut && lanjut.startsWith("/") && !lanjut.startsWith("//");
        router.replace(aman ? lanjut : "/app");
        router.refresh();
        return;
      }
      const j = (await r.json().catch(() => null)) as { pesan?: string } | null;
      setGalat(j?.pesan ?? "Sandi salah.");
    } catch {
      setGalat("Tidak bisa menghubungi server.");
    } finally {
      setMengirim(false);
    }
  }

  return (
    <form
      onSubmit={kirim}
      className="flex w-full max-w-xs flex-col gap-4"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-[12px]" style={{ color: "var(--teks-redup)" }}>
          Sandi
        </span>
        <input
          type="password"
          value={sandi}
          onChange={(e) => setSandi(e.target.value)}
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-[var(--radius-kecil)] border px-3 py-2 text-[14px] outline-none"
          style={{
            borderColor: galat ? "var(--danger)" : "var(--garis)",
            background: "var(--lapis-0)",
            color: "var(--teks-utama)",
          }}
        />
      </label>

      {/* Ruangnya disediakan tetap, supaya tombolnya tidak melompat saat galat
          muncul — lompatan itu terbaca sebagai kerusakan, bukan sebagai pesan. */}
      <p
        role="alert"
        className="min-h-[1.2em] text-[12px]"
        style={{ color: "var(--danger)" }}
      >
        {galat}
      </p>

      <button
        type="submit"
        disabled={!sandi || mengirim}
        className="rounded-[var(--radius-kecil)] px-3 py-2 text-[13px] disabled:opacity-45"
        style={{
          background: "var(--lapis-3)",
          color: "var(--teks-utama)",
          boxShadow: "var(--pendar)",
        }}
      >
        {mengirim ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}

export default function Masuk() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-3">
        <TandaTiburon ukuran={34} />
        <p className="text-[12px]" style={{ color: "var(--teks-redup)", fontFamily: "var(--font-mono)" }}>
          Tiburon diakses dari jaringan
        </p>
      </div>

      <Suspense fallback={null}>
        <Formulir />
      </Suspense>
    </main>
  );
}
