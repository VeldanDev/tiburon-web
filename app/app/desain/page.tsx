"use client";

/**
 * Desain awal Tiburon — gabungan antarmuka Claude Code, Codex, dan Grok.
 *
 * Halaman ini BUKAN aplikasi yang berjalan. Ini papan desain: seluruh elemen
 * antarmuka dari ketiga agent AI, disusun jadi satu bahasa visual, supaya bisa
 * dilihat sekaligus dan dinilai sebelum dipakai.
 *
 * Sumber komponen: `brainless` (MIT) — github.com/theswerd/brainless
 * Palet dan tipografi sengaja DIBIARKAN seperti aslinya. Identitas Tiburon
 * (hiu biru, palet samudra) baru dipasang setelah arah ini disetujui.
 */

import { useState } from "react";

import { ClaudeHeader } from "@/components/brainless/claude/claude-header";
import { ClaudeMessage } from "@/components/brainless/claude/claude-message";
import { ClaudeThinking } from "@/components/brainless/claude/claude-thinking";
import { ClaudeToolCall } from "@/components/brainless/claude/claude-tool-call";
import { ClaudeTodoList } from "@/components/brainless/claude/claude-todo-list";
import { ClaudeDiff } from "@/components/brainless/claude/claude-diff";
import { ClaudePermission } from "@/components/brainless/claude/claude-permission";
import { ClaudeSlashMenu } from "@/components/brainless/claude/claude-slash-menu";
import { ClaudePrompt } from "@/components/brainless/claude/claude-prompt";

import { CodexHeader } from "@/components/brainless/codex/codex-header";
import { CodexMessage } from "@/components/brainless/codex/codex-message";
import { CodexExec } from "@/components/brainless/codex/codex-exec";
import { CodexWorking } from "@/components/brainless/codex/codex-working";
import { CodexDiff } from "@/components/brainless/codex/codex-diff";
import { CodexPermissions } from "@/components/brainless/codex/codex-permissions";
import { CodexSlashMenu } from "@/components/brainless/codex/codex-slash-menu";
import { CodexPrompt } from "@/components/brainless/codex/codex-prompt";

import { GrokStatus } from "@/components/brainless/grok/grok-status";
import { GrokHeader } from "@/components/brainless/grok/grok-header";
import { GrokMessage } from "@/components/brainless/grok/grok-message";
import { GrokThought } from "@/components/brainless/grok/grok-thought";
import { GrokTool } from "@/components/brainless/grok/grok-tool";
import { GrokWrite } from "@/components/brainless/grok/grok-write";
import { GrokEvent } from "@/components/brainless/grok/grok-event";
import { GrokPermission } from "@/components/brainless/grok/grok-permission";
import { GrokTurnEnd } from "@/components/brainless/grok/grok-turn-end";
import { GrokSlashMenu } from "@/components/brainless/grok/grok-slash-menu";
import { GrokPrompt } from "@/components/brainless/grok/grok-prompt";

import { PemilihJalur, type Jalur } from "@/components/chat/PemilihJalur";

type Panel = "gabungan" | "claude" | "codex" | "grok";

const PANEL: { id: Panel; label: string; latar: string }[] = [
  { id: "gabungan", label: "Gabungan", latar: "#12131c" },
  { id: "claude", label: "Claude Code", latar: "#1a1b26" },
  { id: "codex", label: "Codex", latar: "#0d0d0d" },
  { id: "grok", label: "Grok", latar: "#0a0a0a" },
];

function Bagian({ judul, catatan, children }: {
  judul: string;
  catatan?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-3 border-b border-white/10 pb-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#7aa2f7]">
          {judul}
        </h2>
        {catatan && (
          <span className="font-mono text-[11px] text-[#565f89]">{catatan}</span>
        )}
      </div>
      <div className="space-y-3 pt-1">{children}</div>
    </section>
  );
}

export default function HalamanDesain() {
  const [panel, setPanel] = useState<Panel>("gabungan");
  const [jalur, setJalur] = useState<Jalur>("tiburon");
  const [teks, setTeks] = useState("");

  const latar = PANEL.find((p) => p.id === panel)!.latar;

  return (
    <div
      className="min-h-screen font-mono text-[13px] leading-[1.6] text-[#c0caf5] transition-colors duration-300"
      style={{ background: latar }}
    >
      {/* Bilah pemilih papan */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-black/40 px-6 py-3 backdrop-blur">
        <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-[#565f89]">
          Papan desain Tiburon · gabungan antarmuka agent AI
        </div>
        <div className="flex flex-wrap gap-1">
          {PANEL.map((p) => (
            <button
              key={p.id}
              onClick={() => setPanel(p.id)}
              className={`rounded px-3 py-1 text-[12px] transition ${
                panel === p.id
                  ? "bg-white/15 text-white"
                  : "text-[#7f8bb0] hover:bg-white/5 hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-10 px-6 py-8">
        {/* ---------------- GABUNGAN ---------------- */}
        {panel === "gabungan" && (
          <>
            <Bagian judul="Bilah status" catatan="dari Grok — cabang, konteks, giliran">
              <GrokStatus
                branch="master"
                directory="~/Tiburon"
                contextUsed="24K"
                contextLimit="1.0M"
                turn={3}
                turnTotal={5}
                mcp={2}
                mcpTotal={2}
              />
            </Bagian>

            <Bagian judul="Sambutan" catatan="dari Claude Code — versi, model, tips, what's new">
              <ClaudeHeader
                version="v0.1.0"
                user="Veldan"
                model="Tiburon — korpus pribadi + rantai model cadangan"
                org="Shift Company"
                cwd="~/Tiburon"
                tips={["Pilih jalur Tiburon untuk menjawab dari korpusmu sendiri"]}
                whatsNew={[
                  "Pembacaan korpus langsung dari indeks — 0,5 ms, bukan 40 detik",
                  "Halaman Radar: 40 item pagi dengan penyaring kategori",
                ]}
              />
            </Bagian>

            <Bagian judul="Percakapan" catatan="gelembung Claude + stempel waktu Grok">
              <ClaudeMessage role="user">
                apa beda enkripsi simetris dan kunci publik menurut korpusku?
              </ClaudeMessage>
              <GrokMessage role="user" time="19:42">
                versi Grok — sama, tapi dengan stempel waktu
              </GrokMessage>
              <ClaudeMessage>
                Simetris memakai satu kunci yang sama untuk mengunci dan membuka.
                Kunci publik memakai sepasang kunci berbeda.
              </ClaudeMessage>
            </Bagian>

            <Bagian judul="Berpikir" catatan="tiga gaya — Claude, Codex, Grok">
              <ClaudeThinking running />
              <CodexWorking running label="Mencari korpus" />
              <GrokThought elapsed="0.4s" streaming>
                Membaca indeks korpus, menimbang potongan mana yang paling dekat…
              </GrokThought>
            </Bagian>

            <Bagian judul="Pemanggilan alat" catatan="Claude · Codex · Grok">
              <ClaudeToolCall
                tool="Korpus"
                arg="enkripsi kunci publik"
                result="3 berkas · 0,5 ms"
                defaultOpen
              />
              <CodexExec command="npm test" result="53 passed, 0 failed" status="ok" />
              <GrokTool verb="Baca" path="analisis-buku-dalam.md" meta="606 potongan" />
              <GrokWrite
                before={[{ n: 1, text: "# Radar Pagi — 2026-09-02" }]}
                after={[{ n: 1, text: "# Radar Pagi — 2026-09-03" }]}
              />
              <GrokEvent label="Radar Pagi selesai" hooks={2} hooksOk={2} elapsed="63.8s" />
            </Bagian>

            <Bagian judul="Rencana kerja" catatan="daftar todo Claude Code">
              <ClaudeTodoList
                todos={[
                  { label: "Baca indeks korpus", status: "done" },
                  { label: "Susun konteks untuk model", status: "active" },
                  { label: "Aliran jawaban ke layar", status: "todo" },
                ]}
              />
            </Bagian>

            <Bagian judul="Perubahan berkas" catatan="diff Claude dan Codex">
              <ClaudeDiff
                file="lib/korpus.ts"
                summary="lib/korpus.ts — 4 tambahan, 1 hapusan"
                lines={[
                  { type: "ctx", n: 95, text: "export function cari(kueri: string) {" },
                  { type: "del", n: 96, text: "  } catch { return []; }" },
                  { type: "add", n: 96, text: "  } catch (e) {" },
                  { type: "add", n: 97, text: "    if (galatSintaksFts(e)) return [];" },
                  { type: "add", n: 98, text: "    throw e;" },
                  { type: "add", n: 99, text: "  }" },
                ]}
              />
              <CodexDiff percent={100} fillRows={6} />
            </Bagian>

            <Bagian judul="Minta izin" catatan="tiga gaya dialog persetujuan">
              <ClaudePermission
                title="Perintah Bash"
                command="openclaw memory index --agent tiburon"
                question="Jalankan perintah ini?"
                options={["Ya", "Ya, jangan tanya lagi sesi ini", "Tidak (esc)"]}
              />
              <CodexPermissions title="Perbarui izin model" />
              <GrokPermission
                title="Tulis berkas korpus"
                command="tulis ke D:\\Downloads\\Tiburon\\03-hasil-analisis"
              />
            </Bagian>

            <Bagian judul="Menu perintah" catatan="slash menu — tiga gaya">
              <ClaudeSlashMenu />
              <CodexSlashMenu />
              <GrokSlashMenu />
            </Bagian>

            <Bagian judul="Akhir giliran" catatan="dari Grok">
              <GrokTurnEnd elapsed="2.4s" />
            </Bagian>

            <Bagian judul="Komposer" catatan="tiga gaya input + pemilih jalur milik Tiburon">
              <div className="space-y-4">
                <div>
                  <PemilihJalur jalur={jalur} onGanti={setJalur} />
                </div>
                <ClaudePrompt
                  value={teks}
                  onChange={(e) => setTeks(e.target.value)}
                  placeholder="Gaya Claude Code…"
                  effort={false}
                />
                <CodexPrompt
                  placeholder="Gaya Codex — /skills untuk daftar skill"
                  model="tiburon/korpus"
                  directory="~/Tiburon"
                />
                <GrokPrompt
                  placeholder="Gaya Grok…"
                  model="Tiburon (korpus)"
                  showShortcuts
                />
              </div>
            </Bagian>
          </>
        )}

        {/* ---------------- SATU-SATU ---------------- */}
        {panel === "claude" && (
          <div className="space-y-3 text-[#c0caf5]">
            <ClaudeHeader cwd="~/Tiburon" user="Veldan" />
            <ClaudeMessage role="user">tampilkan radar pagi ini</ClaudeMessage>
            <ClaudeMessage>Ada 30 berita dan 10 repo. 13 bertanda relevan.</ClaudeMessage>
            <ClaudeTodoList
              todos={[
                { label: "Baca berkas radar", status: "done" },
                { label: "Saring per kategori", status: "active" },
                { label: "Render kartu", status: "todo" },
              ]}
            />
            <ClaudeToolCall tool="Read" arg="Otak/radar/2026-09-03.md" result="40 item" />
            <ClaudeThinking running />
            <ClaudeSlashMenu />
            <ClaudePrompt placeholder="Tanya apa saja…" effort={false} />
          </div>
        )}

        {panel === "codex" && (
          <div className="space-y-3 text-[#ededed]">
            <CodexHeader version="v0.1.0" model="tiburon/korpus" directory="~/Tiburon" />
            <CodexMessage role="user">jalankan seluruh uji</CodexMessage>
            <CodexMessage>Menjalankan suite lengkap.</CodexMessage>
            <CodexExec command="npm test" result="53 passed, 0 failed in 2.4s" status="ok" />
            <CodexWorking running label="Memeriksa tipe" />
            <CodexDiff percent={100} fillRows={8} />
            <CodexPermissions />
            <CodexSlashMenu />
            <CodexPrompt model="tiburon/korpus" directory="~/Tiburon" />
          </div>
        )}

        {panel === "grok" && (
          <div className="space-y-3 text-[#e8e8e8]">
            <GrokStatus
              branch="master"
              directory="~/Tiburon"
              contextUsed="24K"
              contextLimit="1.0M"
              turn={2}
              turnTotal={3}
            />
            <GrokHeader
              version="0.1.0"
              headline="Tiburon sudah bisa membaca korpusmu"
              subhead="Pilih jalur Tiburon di komposer untuk mencobanya."
            />
            <GrokMessage role="user" time="19:42">
              apa isi radar pagi ini?
            </GrokMessage>
            <GrokThought elapsed="0.4s" streaming>
              Membaca berkas radar harian…
            </GrokThought>
            <GrokTool verb="Baca" path="Otak/radar/2026-09-03.md" meta="40 item" />
            <GrokWrite
              before={[{ n: 1, text: "# Radar Pagi — 2026-09-02" }]}
              after={[{ n: 1, text: "# Radar Pagi — 2026-09-03" }]}
            />
            <GrokMessage role="assistant" time="19:42">
              30 berita dan 10 repo. 13 bertanda relevan untuk proyekmu.
            </GrokMessage>
            <GrokEvent label="Radar selesai" hooks={2} hooksOk={2} elapsed="63.8s" />
            <GrokPermission />
            <GrokTurnEnd elapsed="2.4s" />
            <GrokSlashMenu />
            <GrokPrompt model="Tiburon (korpus)" showShortcuts />
          </div>
        )}
      </div>
    </div>
  );
}
