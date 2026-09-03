import Link from "next/link";
import "@/styles/tokens.css";

export default function LayoutAplikasi({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-white/10 p-4 md:block">
        <div className="mb-6 text-lg font-semibold">🦈 Tiburon</div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/app" className="rounded px-2 py-1.5 hover:bg-white/10">Obrolan</Link>
          <Link href="/app/radar" className="rounded px-2 py-1.5 hover:bg-white/10">Radar</Link>
        </nav>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
