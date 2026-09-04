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

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BlokKode } from "@/components/chat/BlokKode";
import { AMBANG_BARIS } from "@/lib/artefak";

/** Ambil teks polos dari anak-anak node, untuk disalin. */
function keTeks(anak: React.ReactNode): string {
  if (typeof anak === "string") return anak;
  if (Array.isArray(anak)) return anak.map(keTeks).join("");
  if (anak && typeof anak === "object" && "props" in anak) {
    return keTeks((anak as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

/**
 * DIMEMOISASI, dan itu bukan optimasi spekulatif.
 *
 * Tiap potongan token yang datang menyetel ulang state percakapan, dan tanpa
 * ini SETIAP jawaban di layar dirender ulang serta memarsing markdown-nya dari
 * awal. Diukur: 30 potongan pada percakapan berisi 4 jawaban menghasilkan 159
 * render markdown. Biayanya (jumlah jawaban x jumlah potongan), jadi yang
 * paling menderita justru percakapan yang paling berguna -- yang sudah
 * panjang, dengan jawaban berkode yang tiap kali disorot ulang.
 *
 * `isi` sebuah string, jadi perbandingan dangkal bawaan memo sudah tepat:
 * hanya jawaban yang sedang tumbuh yang berubah.
 */
export const Markdown = memo(function Markdown({ isi }: { isi: string }) {
  return (
    <div className="markdown-tiburon">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            // Bahasanya ada di className anak `code` sebagai "language-xxx" --
            // react-markdown menaruhnya di sana, bukan di `pre`.
            const anak = children as { props?: { className?: string; children?: React.ReactNode } };
            const bahasa = /language-(\w+)/.exec(anak?.props?.className ?? "")?.[1] ?? "";
            const kode = keTeks(children).replace(/\n$/, "");
            // Blok sepanjang artefak dipendekkan di sini; versi utuhnya ada di
            // panel artefak, yang dibuka lewat chip di bawah jawaban. Tanpa
            // ini kode yang sama tampil dua kali, dan yang di aliran mendorong
            // percakapannya sendiri keluar layar.
            const panjang = kode.split("\n").length >= AMBANG_BARIS;
            return <BlokKode kode={kode} bahasa={bahasa} ringkas={panjang} />;
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
});
