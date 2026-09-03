"use client";

/**
 * Baris aksi di bawah jawaban: salin, dan ulangi.
 *
 * Dua-duanya ada di Claude, ChatGPT, Codex, dan Grok, dan tidak ada satu pun
 * di Tiburon sebelum ini. Keduanya kecil tapi dipakai puluhan kali sehari —
 * dan itu justru yang menentukan gayanya di sini:
 *
 * Barisnya TIDAK dianimasikan muncul. Sesuatu yang dilihat sesering ini,
 * setiap kali sebuah jawaban selesai, akan terasa lamban kalau harus memudar
 * masuk lebih dulu. Yang beranimasi cuma warnanya saat disentuh.
 *
 * Barisnya juga selalu terlihat, bukan muncul saat hover. Aksi yang
 * disembunyikan di balik hover tidak bisa ditemukan di layar sentuh sama
 * sekali, dan Tiburon dirancang untuk dibuka dari HP juga.
 */

import { useState } from "react";
import { IkonSalin, IkonUlangi, IkonCentang } from "@/components/Ikon";

export function AksiPesan({ isi, onUlangi }: { isi: string; onUlangi?: () => void }) {
  const [tersalin, setTersalin] = useState(false);

  async function salin() {
    try {
      await navigator.clipboard.writeText(isi);
      setTersalin(true);
      window.setTimeout(() => setTersalin(false), 1400);
    } catch {
      // Clipboard bisa ditolak (izin, atau halaman bukan konteks aman).
      // Gagal diam-diam: pengguna masih bisa memblok teksnya sendiri, dan
      // memunculkan galat untuk ini akan lebih mengganggu daripada menolong.
    }
  }

  const gaya = {
    color: "var(--redup)",
    background: "transparent",
  } as const;

  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        onClick={salin}
        aria-label={tersalin ? "Jawaban tersalin" : "Salin jawaban"}
        className="aksi-pesan flex items-center gap-1.5 rounded-[var(--radius-kecil)] px-2 py-1 text-[11px]"
        style={tersalin ? { ...gaya, color: "var(--hidup)" } : gaya}
      >
        {tersalin ? <IkonCentang ukuran={12} /> : <IkonSalin ukuran={12} />}
        {tersalin ? "tersalin" : "salin"}
      </button>

      {onUlangi && (
        <button
          onClick={onUlangi}
          aria-label="Ulangi jawaban"
          title="Tanyakan ulang pertanyaan yang sama"
          className="aksi-pesan flex items-center gap-1.5 rounded-[var(--radius-kecil)] px-2 py-1 text-[11px]"
          style={gaya}
        >
          <IkonUlangi ukuran={12} />
          ulangi
        </button>
      )}
    </div>
  );
}
