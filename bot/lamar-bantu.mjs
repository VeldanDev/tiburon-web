/**
 * Asisten lamaran: membaca halaman lowongan yang sedang kamu buka, menilai,
 * menulis lamarannya, lalu menaruhnya di papan klip.
 *
 *   npm run lamar-bantu
 *   npm run lamar-bantu -- --porta 9223   (kalau portanya lain)
 *   npm run lamar-bantu -- --tab upwork    (kalau banyak tab terbuka)
 *
 * Sebelum menjalankannya, buka perambannya dengan porta debug:
 *
 *   Chrome  chrome.exe --remote-debugging-port=9222
 *   Edge    msedge.exe --remote-debugging-port=9222
 *
 * lalu login SENDIRI, buka halaman lowongannya, dan jalankan perintah ini.
 *
 * GARIS YANG SENGAJA TIDAK DILEWATI, dan alasannya bukan kehati-hatian kosong:
 *
 *   TIDAK login otomatis, dan tidak menyimpan kata sandi apa pun. Kamu yang
 *   mengetik sandimu, di perambanmu sendiri. Tidak ada kredensial yang
 *   melewati berkas ini, jadi tidak ada yang bisa bocor darinya.
 *
 *   TIDAK menekan tombol kirim. Dua sebab, dan keduanya nyata: Upwork dan
 *   Fiverr memblokir permanen akun yang terdeteksi diakses otomatis — dan akun
 *   yang sudah bekerja adalah aset yang tidak bisa dibuat ulang. Lalu lamaran
 *   yang terkirim tanpa dibaca manusia mengikatmu pada janji yang tidak kamu
 *   buat, ke orang yang akan menagihnya.
 *
 * Yang dihapus tetap bagian terbesarnya: menyalin iklan, berpindah aplikasi,
 * menyusun kalimat, dan menakar tarif. Yang tersisa untukmu: membaca sekali,
 * lalu Ctrl+V.
 *
 * CDP dipakai langsung lewat WebSocket bawaan Node — tanpa Playwright atau
 * Puppeteer. Keduanya mengunduh perambannya sendiri (ratusan MB) untuk
 * pekerjaan yang di sini cuma "bacakan teks tab yang sedang terbuka".
 */
import { spawn } from "node:child_process";
import { register } from "node:module";
import fs from "node:fs";

register("./alias.mjs", import.meta.url);

for (const b of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = b.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const { kirim } = await import("@/lib/penyedia.ts");
const { JIWA_LAMARAN, susunLamaran } = await import("@/lib/lamaran.ts");

const argumen = process.argv.slice(2);
function opsi(nama, bawaan = null) {
  const i = argumen.indexOf(`--${nama}`);
  return i !== -1 && argumen[i + 1] ? argumen[i + 1] : bawaan;
}

// Porta HARUS lewat bendera bernama. Versi pertama mengambil angka telanjang
// pertama dari argumen, dan langsung salah pada pemakaian sungguhan: "--tab
// 8899" membuatnya mencari peramban di porta 8899. Argumen tanpa nama selalu
// akan tertukar begitu ada argumen kedua.
const PORTA = Number(opsi("porta", "9222"));

/** Situs yang dikenali, dipakai untuk memilih tab yang benar saat ada banyak. */
const SITUS = ["upwork.com", "fiverr.com", "projects.co.id", "sribulancer.com", "freelancer."];

async function daftarTab() {
  const r = await fetch(`http://127.0.0.1:${PORTA}/json/list`);
  if (!r.ok) throw new Error(`porta debug menjawab ${r.status}`);
  return (await r.json()).filter((t) => t.type === "page" && t.url?.startsWith("http"));
}

/**
 * Ambil teks yang TERLIHAT dari sebuah tab.
 *
 * `innerText`, bukan `textContent`: yang kedua ikut membawa isi <script>,
 * menu tersembunyi, dan teks yang di-`display:none` — pada halaman Upwork itu
 * berarti ribuan kata navigasi yang menenggelamkan iklannya sendiri.
 */
async function bacaTab(tab) {
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("tidak bisa menyambung ke tab"));
  });
  const hasil = await new Promise((res, rej) => {
    const batas = setTimeout(() => rej(new Error("tab tidak menjawab")), 15000);
    ws.onmessage = (e) => {
      const p = JSON.parse(e.data);
      if (p.id !== 1) return;
      clearTimeout(batas);
      res(p.result?.result?.value ?? "");
    };
    ws.send(
      JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: { expression: "document.body.innerText", returnByValue: true },
      }),
    );
  });
  ws.close();
  return hasil;
}

/**
 * Buang derau navigasi dari teks halaman.
 *
 * Halaman lowongan mana pun membawa menu, footer, dan panel "pekerjaan
 * serupa". Dibiarkan, model menilai campuran sepuluh lowongan sekaligus dan
 * menulis lamaran untuk pekerjaan yang tidak sedang dibuka.
 */
function bersihkan(teks) {
  const baris = teks
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const buang =
    /^(home|jobs|find work|my jobs|reports|messages|help|sign in|log in|sign up|search|menu|skip to|cookie|© ?\d{4}|privacy|terms|about us|browse|categories|notifications|upgrade|settings)/i;

  const disaring = baris.filter((b) => !(b.length < 25 && buang.test(b)));
  return disaring.join("\n").slice(0, 12000);
}

function salinKePapanKlip(teks) {
  return new Promise((res) => {
    // `clip` bawaan Windows. Gagal menyalin bukan alasan menggagalkan
    // seluruhnya — teksnya tetap tercetak di layar dan bisa disalin manual.
    const p = spawn("cmd", ["/c", "clip"], { stdio: ["pipe", "ignore", "ignore"] });
    p.on("error", () => res(false));
    p.on("close", (c) => res(c === 0));
    p.stdin.end(teks, "utf8");
  });
}

// ---------------------------------------------------------------------------

let tabs;
try {
  tabs = await daftarTab();
} catch (e) {
  console.error(`Tidak bisa membaca peramban di porta ${PORTA}: ${e.message}\n`);
  console.error("Buka perambanmu dengan porta debug dulu, lalu jalankan lagi:");
  console.error("  chrome.exe --remote-debugging-port=9222");
  console.error("  msedge.exe --remote-debugging-port=9222\n");
  console.error("Login sendiri di sana, buka halaman lowongannya, baru jalankan perintah ini.");
  process.exit(1);
}

if (!tabs.length) {
  console.error("Tidak ada tab terbuka di peramban itu.");
  process.exit(1);
}

// Tab situs lowongan didahulukan; kalau tidak ada, pakai tab pertama dan
// SEBUTKAN yang dipakai — supaya salah tab ketahuan sebelum lamarannya ditulis.
const saring = opsi("tab");
const pilih = saring
  ? (tabs.find((t) => t.url.includes(saring)) ?? tabs[0])
  : (tabs.find((t) => SITUS.some((s) => t.url.includes(s))) ?? tabs[0]);
console.log(`Membaca : ${pilih.title?.slice(0, 70) ?? "(tanpa judul)"}`);
console.log(`Alamat  : ${pilih.url.slice(0, 90)}\n`);

const mentah = await bacaTab(pilih);
const iklan = bersihkan(mentah);

if (iklan.length < 200) {
  console.error("Halaman ini terlalu sedikit teksnya untuk dinilai sebagai lowongan.");
  console.error("Pastikan halaman lowongannya sudah terbuka penuh, lalu jalankan lagi.");
  process.exit(1);
}

console.log(`${iklan.length} karakter terbaca. Menilai dan menulis…\n`);

let keluar = "";
try {
  for await (const k of kirim(susunLamaran(iklan), { jiwa: JIWA_LAMARAN })) {
    if (k.jenis === "teks") {
      process.stdout.write(k.teks);
      keluar += k.teks;
    }
    if (k.jenis === "gagal") {
      console.error(`\n\nGagal: ${k.pesan}`);
      process.exit(1);
    }
  }
} catch (e) {
  console.error(`\n\nGagal: ${e.message}`);
  process.exit(1);
}

// Hanya proposalnya yang disalin, bukan penilaian dan catatan tarifnya —
// keduanya untukmu, bukan untuk klien, dan tertempel ke kotak lamaran mereka
// akan terbaca sangat buruk.
const proposal = keluar
  .replace(/^[\s\S]*?PROPOSAL:\s*/i, "")
  .split(/\n-{3,}\n/)[0]
  .trim();

if (/TIDAK LAYAK/i.test(keluar)) {
  console.log("\n\nTidak disalin ke papan klip — lowongan ini dinilai tidak layak dilamar.");
} else if (proposal) {
  const ok = await salinKePapanKlip(proposal);
  console.log(
    ok
      ? "\n\nProposalnya sudah di papan klip. Tinggal Ctrl+V di kotak lamaran, baca sekali, lalu kirim sendiri."
      : "\n\nGagal menyalin ke papan klip — salin manual dari teks di atas.",
  );
}
