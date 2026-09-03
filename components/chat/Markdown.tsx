"use client";

/**
 * Renderer markdown untuk isi jawaban.
 *
 * Sebelum ini isi pesan dirender sebagai teks mentah dengan `whitespace-pre-wrap`,
 * jadi `**tebal**`, judul, tabel, dan blok kode semuanya muncul sebagai karakter
 * harfiah. Itu celah paling besar dibanding Claude, ChatGPT, Codex, dan Grok —
 * dan paling terasa di jalur Kode, tempat hampir setiap jawaban berisi kode.
 *
 * Dua hal yang membuat versi ini berbeda dari memasang react-markdown begitu saja:
 *
 *   1. Ini dipakai SAAT MENGALIR. Markdown yang setengah jadi adalah keadaan
 *      normal di sini, bukan kasus tepi — pagar ``` yang belum tertutup muncul
 *      di hampir setiap jawaban berkode. react-markdown menanganinya dengan
 *      benar (blok yang belum tertutup tetap dirender sebagai blok), jadi tidak
 *      ada yang perlu ditambal; yang penting adalah TIDAK menambahkan logika
 *      "tunggu sampai lengkap", karena itu justru membuat teks tersendat.
 *
 *   2. Gayanya diambil dari token, bukan dari prose bawaan Tailwind. Kelas
 *      `prose` akan membawa palet abu-abunya sendiri dan langsung bertabrakan
 *      dengan dunia biru laut ini.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";

/** Tombol salin untuk satu blok kode. */
function TombolSalin({ teks }: { teks: string }) {
  const [tersalin, setTersalin] = useState(false);

  async function salin() {
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      window.setTimeout(() => setTersalin(false), 1400);
    } catch {
      // Clipboard ditolak (izin, atau konteks tidak aman). Diam saja lebih
      // baik daripada melempar galat ke tengah percakapan — tombolnya cuma
      // tidak berubah, dan pengguna masih bisa memblok teksnya sendiri.
    }
  }

  return (
    <button
      onClick={salin}
      aria-label={tersalin ? "Kode tersalin" : "Salin kode"}
      className="rounded-[var(--radius-kecil)] px-2 py-0.5 text-[11px] transition"
      style={{
        color: tersalin ? "var(--hidup)" : "var(--redup)",
        background: "transparent",
      }}
    >
      {tersalin ? "tersalin" : "salin"}
    </button>
  );
}

/** Ambil teks polos dari anak-anak node, untuk disalin. */
function keTeks(anak: React.ReactNode): string {
  if (typeof anak === "string") return anak;
  if (Array.isArray(anak)) return anak.map(keTeks).join("");
  if (anak && typeof anak === "object" && "props" in anak) {
    return keTeks((anak as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

export function Markdown({ isi }: { isi: string }) {
  return (
    <div className="markdown-tiburon">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            const teks = keTeks(children);
            return (
              <div
                className="my-3 overflow-hidden rounded-[var(--radius)] border"
                style={{ borderColor: "var(--garis)", background: "var(--lapis-0)" }}
              >
                <div
                  className="flex items-center justify-between border-b px-3 py-1"
                  style={{ borderColor: "var(--garis)" }}
                >
                  <span className="text-[11px]" style={{ color: "var(--redup)" }}>
                    kode
                  </span>
                  <TombolSalin teks={teks} />
                </div>
                {/* overflow-x di pembungkusnya sendiri: baris kode panjang
                    harus menggulir di dalam bloknya, bukan mendorong seluruh
                    kolom percakapan jadi lebih lebar dari layar. */}
                <pre className="overflow-x-auto px-3 py-2.5 text-[13px] leading-[1.6]">
                  {children}
                </pre>
              </div>
            );
          },
          code({ className, children }) {
            // Kode sebaris saja; yang di dalam blok sudah ditangani `pre`
            // di atas dan lewat ke sini tanpa gaya tambahan.
            if (className) return <code className={className}>{children}</code>;
            return (
              <code
                className="rounded-[3px] px-1 py-0.5 text-[0.9em]"
                style={{ background: "var(--lapis-2)", color: "var(--teks-kedua)" }}
              >
                {children}
              </code>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--surface)", textDecoration: "underline" }}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {isi}
      </ReactMarkdown>
    </div>
  );
}
