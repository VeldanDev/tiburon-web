/**
 * Membaca daftar tugas terjadwal yang DIMILIKI OpenClaw, langsung dari basis
 * data statusnya.
 *
 * Pola yang sama dengan `lib/korpus.ts`: OpenClaw yang menulis, aplikasi ini
 * hanya membaca, selalu `readOnly`. Kopling ke skema aplikasi lain — dan
 * seperti korpus, skema itu pernah berubah diam-diam saat upgrade. Karena itu
 * `periksaSkemaJadwal()` wajib dipanggil sebelum mempercayai hasilnya.
 *
 * Tugas-tugas ini nyata dan berjalan tiap hari di mesin ini: Radar Pagi 06:30,
 * Radar Peluang 07:00, indexing korpus 09:00/13:00/17:00.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type TugasTerjadwal = {
  id: string;
  nama: string;
  keterangan: string;
  aktif: boolean;
  jadwal: string;
  zona: string;
  jenisMuatan: string;
  jalanBerikutMs: number | null;
  jalanTerakhirMs: number | null;
  statusTerakhir: string | null;
  galatBerturut: number;
};

export type HasilSkemaJadwal = { cocok: boolean; alasan?: string };

export function dbJadwal(): string {
  return (
    process.env.TIBURON_JADWAL_DB ??
    path.join(process.env.USERPROFILE ?? os.homedir(), ".openclaw", "state", "openclaw.sqlite")
  );
}

function buka(p: string): DatabaseSync {
  return new DatabaseSync(p, { readOnly: true });
}

export function periksaSkemaJadwal(dbPath = dbJadwal()): HasilSkemaJadwal {
  if (!fs.existsSync(dbPath)) {
    return { cocok: false, alasan: `Basis data OpenClaw tidak ditemukan: ${dbPath}` };
  }
  let db: DatabaseSync;
  try {
    db = buka(dbPath);
  } catch (e) {
    return { cocok: false, alasan: `Tidak bisa membuka basis data: ${(e as Error).message}` };
  }
  try {
    const ada = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cron_jobs'")
      .get();
    if (!ada) {
      return { cocok: false, alasan: "Skema OpenClaw berubah — tabel cron_jobs tidak ada" };
    }
    return { cocok: true };
  } catch (e) {
    return { cocok: false, alasan: `Gagal membaca skema: ${(e as Error).message}` };
  } finally {
    db.close();
  }
}

function angkaAtauNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function daftarTugas(dbPath = dbJadwal()): TugasTerjadwal[] {
  const db = buka(dbPath);
  try {
    const baris = db
      .prepare(
        `SELECT job_id, name, description, enabled, payload_kind,
                schedule_identity, state_json
         FROM cron_jobs ORDER BY sort_order, name`,
      )
      .all();

    return baris.map((r) => {
      const row = r as {
        job_id: string;
        name: string;
        description: string | null;
        enabled: number;
        payload_kind: string | null;
        schedule_identity: string | null;
        state_json: string | null;
      };

      // schedule_identity dan state_json berupa JSON yang ditulis OpenClaw.
      // Kalau bentuknya berubah, jangan menjatuhkan seluruh daftar — tampilkan
      // apa yang bisa dibaca dan biarkan sisanya kosong.
      let jadwal = "";
      let zona = "";
      try {
        const s = JSON.parse(row.schedule_identity ?? "{}");
        jadwal = s?.schedule?.expr ?? s?.schedule?.kind ?? "";
        if (s?.schedule?.kind === "every" && s?.schedule?.everyMs) {
          jadwal = `tiap ${Math.round(s.schedule.everyMs / 60000)} menit`;
        }
        zona = s?.schedule?.tz ?? "";
      } catch {
        /* biarkan kosong — bentuk berubah, bukan alasan menjatuhkan daftar */
      }

      let st: Record<string, unknown> = {};
      try {
        st = JSON.parse(row.state_json ?? "{}") as Record<string, unknown>;
      } catch {
        /* sama */
      }

      return {
        id: row.job_id,
        nama: row.name,
        keterangan: row.description ?? "",
        aktif: row.enabled === 1,
        jadwal,
        zona,
        jenisMuatan: row.payload_kind ?? "",
        jalanBerikutMs: angkaAtauNull(st.nextRunAtMs),
        jalanTerakhirMs: angkaAtauNull(st.lastRunAtMs),
        statusTerakhir: typeof st.lastRunStatus === "string" ? st.lastRunStatus : null,
        galatBerturut: typeof st.consecutiveErrors === "number" ? st.consecutiveErrors : 0,
      };
    });
  } finally {
    db.close();
  }
}
