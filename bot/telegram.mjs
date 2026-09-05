/**
 * Bot katalog Telegram — produk yang dijual gig Fiverr sebagai "Catalogue Bot".
 *
 * Pakai:
 *   set TELEGRAM_BOT_TOKEN=...   (di .env.local, atau lingkungan)
 *   npm run bot -- --korpus data/katalog.sqlite --pemilik 1067517433
 *
 * Katalognya dibangun lebih dulu dari folder dokumen klien:
 *   npm run indeks -- "C:\Katalog Toko" --ke data/katalog.sqlite
 *
 * KENAPA LONG POLLING, BUKAN WEBHOOK. Webhook butuh alamat publik ber-HTTPS —
 * artinya domain, sertifikat, dan hosting sebelum satu pesan pun terkirim.
 * Long polling jalan dari laptop mana pun di belakang router mana pun, dan
 * untuk toko yang menerima puluhan pesan sehari, bedanya nol. Kalau nanti
 * volumenya naik, webhook bisa dipasang tanpa mengubah otaknya sama sekali.
 *
 * SATU PROSES SATU TOKEN. Telegram hanya mengizinkan SATU pembaca getUpdates
 * per bot. Menjalankan dua proses dengan token yang sama membuat pesan
 * terbagi acak di antara keduanya — kegagalan yang terlihat seperti "bot
 * kadang tidak membalas", dan hampir mustahil didiagnosis dari gejalanya.
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";

// Kait alias didaftarkan SEBELUM impor pertama: lib/ memakai "@/..." yang
// hanya dimengerti Next dan Vitest, bukan Node murni.
register("./alias.mjs", import.meta.url);
const { jawabPelanggan } = await import("@/lib/bot-jawab.ts");

// .env.local dibaca sendiri: skrip ini jalan di luar Next.js, yang biasanya
// yang memuatnya.
function muatEnv() {
  try {
    const isi = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const baris of isi.split(/\r?\n/)) {
      const m = baris.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // Tidak ada .env.local berarti nilainya datang dari lingkungan.
  }
}
muatEnv();

const argumen = process.argv.slice(2);
function opsi(nama, bawaan = null) {
  const i = argumen.indexOf(`--${nama}`);
  return i !== -1 && argumen[i + 1] ? argumen[i + 1] : bawaan;
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const KORPUS = opsi("korpus", path.join("data", "katalog.sqlite"));
// Id chat pemilik toko. Ke sinilah percakapan yang diserahkan dilaporkan —
// tanpa ini, "diserahkan ke manusia" cuma kalimat sopan yang tidak sampai ke
// siapa pun, dan pelanggannya menunggu jawaban yang tidak akan pernah datang.
const PEMILIK = opsi("pemilik");

if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN belum diisi (.env.local atau lingkungan).");
  process.exit(1);
}
if (!fs.existsSync(KORPUS)) {
  console.error(`Katalog tidak ada: ${KORPUS}`);
  console.error('Bangun dulu:  npm run indeks -- "folder katalog" --ke ' + KORPUS);
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

async function panggil(metode, badan) {
  const r = await fetch(`${API}/${metode}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(badan ?? {}),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`${metode}: ${j.description ?? r.status}`);
  return j.result;
}

async function balas(chatId, teks) {
  await panggil("sendMessage", { chat_id: chatId, text: teks });
}

/**
 * Riwayat singkat per pelanggan, di memori.
 *
 * Dua giliran terakhir saja. Percakapan toko pendek, dan riwayat panjang cuma
 * memberi model lebih banyak kesempatan mencampur barang yang dibicarakan
 * sepuluh pesan lalu dengan yang ditanyakan sekarang.
 */
const riwayat = new Map();
const GILIRAN_DIINGAT = 2;

async function tangani(pesan) {
  const chatId = pesan.chat?.id;
  const teks = (pesan.text ?? "").trim();
  if (!chatId || !teks) return;

  if (teks === "/start") {
    await balas(chatId, "Halo! Tanya apa saja soal produk, stok, harga, atau pengiriman.");
    return;
  }

  const lama = riwayat.get(chatId) ?? [];
  const jawaban = await jawabPelanggan(teks, { dbKorpus: KORPUS, riwayat: lama });

  await balas(chatId, jawaban.teks);

  riwayat.set(
    chatId,
    [...lama, { role: "user", content: teks }, { role: "assistant", content: jawaban.teks }].slice(
      -GILIRAN_DIINGAT * 2,
    ),
  );

  const nama = [pesan.chat.first_name, pesan.chat.username && `@${pesan.chat.username}`]
    .filter(Boolean)
    .join(" ");
  console.log(`  ${nama || chatId}: ${teks}`);
  console.log(`  -> ${jawaban.serahkan ? "[SERAH] " : ""}${jawaban.teks}`);

  if (jawaban.serahkan && PEMILIK && String(chatId) !== String(PEMILIK)) {
    // Pemilik toko diberi tahu SEKALIGUS dengan pertanyaan aslinya, bukan cuma
    // "ada yang butuh bantuan" — supaya ia bisa langsung menjawab tanpa
    // bertanya ulang, dan pelanggannya tidak mengulang dari awal.
    await balas(
      PEMILIK,
      `Perlu dijawab manusia.\n\nDari: ${nama || chatId}\nPertanyaan: ${teks}\n\nBalas ke chat itu langsung.`,
    );
  }
}

let offset = 0;
let berhenti = false;
process.on("SIGINT", () => {
  berhenti = true;
  console.log("\nBerhenti.");
});

const aku = await panggil("getMe");
console.log(`Bot   : @${aku.username}`);
console.log(`Katalog: ${KORPUS}`);
console.log(`Pemilik: ${PEMILIK ?? "(tidak disetel — penyerahan tidak dilaporkan)"}\n`);
console.log("Menunggu pesan. Ctrl+C untuk berhenti.\n");

while (!berhenti) {
  let pembaruan;
  try {
    pembaruan = await panggil("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
  } catch (e) {
    // Jaringan putus atau Telegram membatasi. Dicoba lagi, tidak berhenti:
    // bot yang mati karena satu galat jaringan adalah bot yang mati diam-diam.
    console.error(`  (jaringan: ${e.message})`);
    await new Promise((r) => setTimeout(r, 3000));
    continue;
  }
  for (const u of pembaruan) {
    offset = u.update_id + 1;
    if (!u.message) continue;
    try {
      await tangani(u.message);
    } catch (e) {
      // Satu pesan yang gagal tidak boleh menjatuhkan bot untuk semua orang.
      console.error(`  (galat: ${e.message})`);
    }
  }
}
