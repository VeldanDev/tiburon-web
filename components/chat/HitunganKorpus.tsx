"use client";

/**
 * Hitungan cocok korpus, langsung saat mengetik.
 *
 * Menjawab pertanyaan yang selama ini hanya bisa dijawab SESUDAH bertanya:
 * apakah korpusku punya bahan untuk ini?
 *
 * Nol potongan berarti kamu tahu sebelum menekan Enter bahwa jawabannya akan
 * datang dari pengetahuan umum model, bukan dari materimu sendiri. Itu
 * informasi yang mengubah keputusan — kamu bisa mengganti kata kuncinya, atau
 * pindah ke jalur Cepat sekalian.
 *
 * Murah: pencarian korpus 0,5 ms, dan diberi jeda 250 ms supaya tidak
 * menembak tiap ketukan. Jauh lebih murah daripada satu panggilan model.
 *
 * Hanya muncul di jalur Tiburon. Jalur lain tidak menyentuh korpus, jadi
 * angkanya akan menyesatkan.
 */

import { useEffect, useState } from "react";

export function HitunganKorpus({ kueri, aktif }: { kueri: string; aktif: boolean }) {
  const [jumlah, setJumlah] = useState<number | null>(null);
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    if (!aktif || kueri.trim().length < 3 || kueri.startsWith("/")) {
      setJumlah(null);
      setPesan("");
      return;
    }

    let dibatalkan = false;
    const jeda = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/korpus/cari?q=${encodeURIComponent(kueri)}&batas=30`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (dibatalkan) return;
        setJumlah(d.jumlah ?? 0);
        setPesan(d.pesan ?? "");
      } catch {
        // Kegagalan hitungan tidak boleh mengganggu pengetikan. Angkanya
        // disembunyikan; tidak ada angka lebih jujur daripada angka salah.
        if (!dibatalkan) {
          setJumlah(null);
          setPesan("");
        }
      }
    }, 250);

    return () => {
      dibatalkan = true;
      window.clearTimeout(jeda);
    };
  }, [kueri, aktif]);

  if (pesan) {
    return (
      <span className="text-[11px]" style={{ color: "var(--warn)" }} title={pesan}>
        korpus tak terbaca
      </span>
    );
  }

  if (jumlah === null) return null;

  return (
    <span
      className="angka text-[11px]"
      style={{ color: jumlah > 0 ? "var(--surface)" : "var(--redup)" }}
      title={
        jumlah > 0
          ? `${jumlah} potongan korpus cocok dengan kata-katamu`
          : "Tidak ada potongan korpus yang cocok — jawaban akan datang dari pengetahuan umum model"
      }
    >
      {jumlah > 0 ? `${jumlah} potongan cocok` : "korpus tak punya ini"}
    </span>
  );
}
