"use client";

/**
 * Dikte suara lewat Web Speech API.
 *
 * Tanpa pustaka dan tanpa layanan luar: pengenalannya dilakukan browser, dan
 * di Chrome/Edge suaranya memang dikirim ke server Google. Itu disebutkan di
 * tooltip-nya, bukan disembunyikan — Tiburon menjaga API key di server dan
 * korpus di mesin sendiri, jadi satu fitur yang diam-diam mengirim suara
 * keluar akan bertentangan dengan seluruh sikap aplikasi ini.
 *
 * Tombolnya TIDAK DITAMPILKAN sama sekali di browser yang tidak mendukung
 * (Firefox, sebagian besar peramban di Linux). Tombol yang ada tapi selalu
 * gagal lebih buruk daripada tombol yang tidak ada: yang pertama terbaca
 * sebagai aplikasi rusak, yang kedua sebagai fitur yang memang tidak ada.
 */

import { useEffect, useRef, useState } from "react";
import { IkonSuara, IkonHenti } from "@/components/Ikon";

/** Bentuk minimal SpeechRecognition yang benar-benar dipakai di sini. */
type Pengenal = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionLikeEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionLikeEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

function kelasPengenal(): (new () => Pengenal) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Pengenal;
    webkitSpeechRecognition?: new () => Pengenal;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function TombolSuara({
  onTeks,
  nonaktif,
}: {
  /** Dipanggil dengan potongan teks final untuk DISAMBUNG ke isi komposer. */
  onTeks: (teks: string) => void;
  nonaktif?: boolean;
}) {
  const [didukung, setDidukung] = useState(false);
  const [merekam, setMerekam] = useState(false);
  const [galat, setGalat] = useState("");
  const pengenal = useRef<Pengenal | null>(null);

  // Diperiksa di useEffect, bukan saat render: `window` tidak ada saat server
  // merender, dan memeriksanya langsung di badan komponen membuat markup
  // server dan klien berbeda — persis penyebab galat hidrasi.
  useEffect(() => {
    setDidukung(kelasPengenal() !== null);
  }, []);

  useEffect(() => {
    // Pengenal dihentikan saat komponen dilepas. Tanpa ini mikrofon tetap
    // menyala setelah berpindah halaman, dan indikator rekaman di tab browser
    // tidak pernah padam.
    return () => pengenal.current?.stop();
  }, []);

  function mulai() {
    const Kelas = kelasPengenal();
    if (!Kelas) return;

    const p = new Kelas();
    p.lang = "id-ID";
    // continuous: kalimat panjang tidak terpotong saat berhenti menarik napas.
    p.continuous = true;
    // Hasil sementara TIDAK dipakai: menyambungkannya ke komposer membuat teks
    // berkedip berubah-ubah saat kata ditebak ulang, dan kursor melompat tiap
    // kali. Hanya hasil final yang disambung.
    p.interimResults = false;

    p.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const hasil = e.results[i];
        if (hasil.isFinal) onTeks(hasil[0].transcript.trim());
      }
    };

    p.onerror = (e) => {
      // "aborted" dan "no-speech" adalah kejadian normal, bukan kerusakan:
      // yang pertama terjadi setiap kali pengguna menghentikan sendiri.
      if (e.error === "aborted" || e.error === "no-speech") return;
      setGalat(
        e.error === "not-allowed"
          ? "Izin mikrofon ditolak. Aktifkan lewat setelan situs di browser."
          : `Dikte gagal: ${e.error}`,
      );
      setMerekam(false);
    };

    p.onend = () => setMerekam(false);

    pengenal.current = p;
    setGalat("");
    try {
      p.start();
      setMerekam(true);
    } catch (e) {
      setGalat(`Tidak bisa memulai dikte: ${(e as Error).message}`);
    }
  }

  if (!didukung) return null;

  return (
    <>
      <button
        onClick={() => (merekam ? pengenal.current?.stop() : mulai())}
        disabled={nonaktif}
        aria-label={merekam ? "Hentikan dikte" : "Dikte dengan suara"}
        aria-pressed={merekam}
        title="Dikte suara. Pengenalannya dilakukan browser — di Chrome dan Edge, suaramu dikirim ke server Google."
        className="aksi-pesan relative rounded-[var(--radius-kecil)] p-1.5 disabled:opacity-40"
        style={{ color: merekam ? "var(--hidup)" : "var(--redup)" }}
      >
        {merekam ? <IkonHenti ukuran={16} /> : <IkonSuara ukuran={16} />}
        {merekam && (
          <span
            aria-hidden
            className="sonar-cincin absolute inset-0 rounded-full"
            style={{ border: "1px solid var(--hidup)" }}
          />
        )}
      </button>
      {galat && (
        <span role="alert" className="text-[11px]" style={{ color: "var(--warn)" }}>
          {galat}
        </span>
      )}
    </>
  );
}
