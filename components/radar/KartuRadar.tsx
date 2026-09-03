import type { ItemRadar } from "@/lib/radar-parser";
import { IkonTautanLuar } from "@/components/Ikon";

export function KartuRadar({ item }: { item: ItemRadar }) {
  return (
    <article className="rounded-[var(--radius)] border p-4"
      style={{ borderColor: "var(--garis)", background: "var(--sorot-lemah)" }}>
      <div className="mb-1 flex items-center gap-2 text-xs opacity-70">
        <span className="tabular-nums">{item.nomor}</span>
        <span className="rounded-full px-2 py-0.5" style={{ background: "var(--sorot)" }}>{item.kategori}</span>
      </div>
      <h3 className="font-medium text-balance">{item.judul}</h3>
      <p className="mt-1 text-sm opacity-80">{item.ringkasan}</p>
      <a href={item.url} target="_blank" rel="noreferrer"
         className="mt-2 inline-block text-xs underline opacity-70 hover:opacity-100">
        {item.sumber || item.url}
      <IkonTautanLuar ukuran={11} className="ml-1 inline-block align-[-1px]" />
      </a>
      {item.relevan && (
        <p className="mt-3 border-l-2 pl-3 text-sm" style={{ borderColor: "var(--surface)" }}>
          <strong>Untuk proyek kita:</strong> {item.relevan}
        </p>
      )}
    </article>
  );
}
