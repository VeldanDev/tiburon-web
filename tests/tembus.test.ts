import { describe, it, expect } from "vitest";
import path from "node:path";
import { putuskan } from "@/lib/izin";

/**
 * Percobaan menembus lantai.
 *
 * Lapisan izin yang tidak diuji dengan cara nakal cuma memberi rasa aman
 * palsu. Tiap kasus di sini adalah bentuk jalur yang WAJAR ditulis model —
 * bukan serangan canggih — dan tiap satu yang lolos berarti kunci API bisa
 * dibaca lalu masuk ke riwayat yang bisa diekspor.
 */
const p = process.cwd();

const COBA: [string, string][] = [
  ["huruf besar", path.join(p, ".ENV.LOCAL")],
  ["keluar lalu balik lewat ..", path.join(p, "lib", "..", ".env.local")],
  ["garis miring maju", p.replace(/\\/g, "/") + "/.env.local"],
  ["dikutip", '"' + path.join(p, ".env.local") + '"'],
  ["spasi di ujung", path.join(p, ".env.local") + "  "],
  ["relatif polos", ".env.local"],
  ["relatif dengan ./", "./.env.local"],
  ["dua titik berlapis", path.join(p, "a", "b", "..", "..", ".env.local")],
];

describe("percobaan menembus lantai berkas rahasia", () => {
  for (const [nama, jalur] of COBA) {
    it(nama, () => {
      const k = putuskan({ jenis: "baca-berkas", sasaran: jalur });
      expect(k.hasil, `LOLOS lewat ${nama}: ${jalur}`).toBe("tolak");
    });
  }
});

describe("percobaan menembus lantai perintah", () => {
  const perintah: [string, string][] = [
    ["huruf besar", "RM -RF /"],
    ["flag digabung", "rm -rf ~/data"],
    ["flag terpisah", "rm -r -f /"],
    ["disambung dengan &&", "npm run build && rm -rf dist"],
    ["disambung dengan ;", "cd /tmp; rm -rf ."],
  ];
  for (const [nama, c] of perintah) {
    it(nama, () => {
      expect(putuskan({ jenis: "jalankan", sasaran: c }).hasil, `LOLOS: ${c}`).toBe("tolak");
    });
  }
});
